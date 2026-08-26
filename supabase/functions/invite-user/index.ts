import { serve } from "https://deno.land/std@0.192.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Manejo de CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    if (req.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), { 
        status: 405, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    // Parse body
    const bodyText = await req.text();
    let body;
    try {
      body = JSON.parse(bodyText);
    } catch (e) {
      return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    const { email, role, organization_id } = body;

    if (!email || !role || !organization_id) {
      return new Response(JSON.stringify({ error: 'Missing required parameters' }), { 
        status: 400, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    // 1. Validar JWT y contexto del usuario que invita
    const authHeader = req.headers.get('Authorization')!;
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'No authorization header' }), { 
        status: 401, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

    // Cliente autenticado con el JWT del invitador
    const authClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    const jwt = authHeader.replace('Bearer ', '').trim();
    const { data: { user }, error: userError } = await authClient.auth.getUser(jwt);
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized: ' + (userError?.message || 'No user') }), { 
        status: 401, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    // 2. Invocar RPC para crear la invitación en la base de datos de manera segura
    // authClient tiene el contexto del invitador
    const { data: token, error: rpcError } = await authClient.rpc('create_invitation', {
      p_organization_id: organization_id,
      p_email: normalizedEmail,
      p_role: role
    });

    if (rpcError) {
      console.error('RPC Error:', rpcError);
      return new Response(JSON.stringify({ error: rpcError.message }), { 
        status: 400, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    if (!token) {
      throw new Error('No token returned from create_invitation');
    }

    // 3. Preparar clientes y URL de redirección
    // Configurar redirectUrl basándose en una variable de entorno segura o valor por defecto
    const siteUrl = Deno.env.get('SITE_URL') || 'http://localhost:5174';
    const redirectUrl = `${siteUrl}/accept-invite?token=${token}`;

    const adminClient = createClient(supabaseUrl, supabaseServiceKey);
    const publicClient = createClient(supabaseUrl, supabaseAnonKey);

    // 4. Determinar si el usuario existe para elegir entre inviteUserByEmail o Magic Link
    // Intentamos crear/enviar la invitación estándar
    const { error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(normalizedEmail, {
      redirectTo: redirectUrl
    });

    if (inviteError) {
      // Si el error es porque el usuario ya existe, usamos signInWithOtp
      if (inviteError.message.toLowerCase().includes('already registered') || 
          inviteError.status === 422 || 
          inviteError.status === 400) {
        
        console.log('Usuario ya existe, enviando Magic Link.');
        const { error: magicLinkError } = await publicClient.auth.signInWithOtp({
          email: normalizedEmail,
          options: {
            shouldCreateUser: false,
            emailRedirectTo: redirectUrl,
          }
        });

        if (magicLinkError) {
          console.error('Magic Link Error:', magicLinkError);
          // Opcional: Actualizar el estado de la invitación a delivery_failed usando adminClient
        }
      } else {
        console.error('Invite Error:', inviteError);
        // Opcional: Actualizar el estado a delivery_failed
      }
    }

    // Respuesta genérica siempre exitosa para no filtrar si el usuario existía
    return new Response(
      JSON.stringify({ message: 'Invitación procesada' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (error) {
    console.error('Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal Server Error', stack: error.stack }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
