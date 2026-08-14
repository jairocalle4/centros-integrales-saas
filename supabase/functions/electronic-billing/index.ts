import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' } })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    );

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) throw new Error('Unauthorized');

    const body = await req.json();
    const { organization_id, payload } = body;

    // TODO (Fase de Producción): 
    // 1. Obtener certificado P12 de sri_configurations
    // 2. Firmar XML
    // 3. Conectar SOAP a SRI

    // MOCK para Sprint 0: Simular una clave de acceso exitosa
    const mockClaveAcceso = Math.floor(Math.random() * 1e15).toString().padStart(49, '0');

    // Registrar en BD la factura simulada
    const { error: insertError } = await supabaseClient
      .from('sri_documents')
      .insert({
        organization_id,
        document_type: '01',
        status: 'AUTHORIZED',
        secuencial: '001-001-' + Math.floor(Math.random() * 999999).toString().padStart(9, '0'),
        clave_acceso: mockClaveAcceso,
        total: payload?.total || 0,
        cliente_identificacion: payload?.cliente_identificacion || '9999999999',
      });

    if (insertError) {
      console.error('Error insertando doc simulado:', insertError);
      throw new Error('Error al registrar factura');
    }

    return new Response(JSON.stringify({ 
      success: true, 
      clave_acceso: mockClaveAcceso,
      message: 'SIMULACIÓN: Factura autorizada por el SRI (Sprint 0)'
    }), {
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });

  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  }
});
