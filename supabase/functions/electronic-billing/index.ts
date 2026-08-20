import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
  });
}

// ─── open-api-facturacion-sri (instancia dedicada, reutilizada) ───────────
// Hace la emisión real ante el SRI: XML, firma XAdES-BES, SOAP. Ver
// docs/architecture/ELECTRONIC_BILLING_BOUNDARY.md.
const SRI_API_URL = Deno.env.get('SRI_API_URL') ?? '';
const SRI_API_SERVICE_EMAIL = Deno.env.get('SRI_API_SERVICE_EMAIL') ?? '';
const SRI_API_SERVICE_PASSWORD = Deno.env.get('SRI_API_SERVICE_PASSWORD') ?? '';

// ─── Microservicio propio de RIDE (solo genera el PDF) ─────────────────────
const RIDE_SERVICE_URL = Deno.env.get('RIDE_SERVICE_URL') ?? '';
const RIDE_SERVICE_API_KEY = Deno.env.get('RIDE_SERVICE_API_KEY') ?? '';

// Cacheado a nivel de módulo — se reutiliza mientras la instancia del Edge
// Function siga caliente, igual que el patrón ya usado por el ERP real
// (ElectronicBillingService.GetAuthTokenAsync).
let cachedSriApiToken: string | null = null;
let cachedSriApiTokenExpiresAt = 0;

async function getSriApiToken(): Promise<string> {
  if (cachedSriApiToken && Date.now() < cachedSriApiTokenExpiresAt) {
    return cachedSriApiToken;
  }
  const response = await fetch(`${SRI_API_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: SRI_API_SERVICE_EMAIL, password: SRI_API_SERVICE_PASSWORD }),
  });
  if (!response.ok) {
    throw new Error(`No se pudo autenticar contra el servicio de facturación (HTTP ${response.status}).`);
  }
  const data = await response.json();
  cachedSriApiToken = data.accessToken;
  cachedSriApiTokenExpiresAt = Date.now() + 55 * 60 * 1000; // el token dura 1h, cacheamos 55m
  if (!cachedSriApiToken) throw new Error('El servicio de facturación no devolvió un accessToken.');
  return cachedSriApiToken;
}

async function sriApiFetch(path: string, init: RequestInit = {}) {
  const token = await getSriApiToken();
  const response = await fetch(`${SRI_API_URL}${path}`, {
    ...init,
    headers: {
      ...(init.body && !(init.body instanceof FormData) ? { 'Content-Type': 'application/json' } : {}),
      Authorization: `Bearer ${token}`,
      ...(init.headers ?? {}),
    },
  });
  const data = await response.json().catch(() => ({}));
  return { ok: response.ok, status: response.status, data };
}

async function callRideService(payload: unknown) {
  const response = await fetch(`${RIDE_SERVICE_URL}/api/v1/ride/generate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Billing-Api-Key': RIDE_SERVICE_API_KEY,
    },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    throw new Error(errorBody.error || `El servicio de RIDE respondió HTTP ${response.status}.`);
  }
  return new Uint8Array(await response.arrayBuffer());
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS });
  }

  try {
    if (!SRI_API_URL || !SRI_API_SERVICE_EMAIL || !SRI_API_SERVICE_PASSWORD) {
      throw new Error('SRI_API_URL / SRI_API_SERVICE_EMAIL / SRI_API_SERVICE_PASSWORD no están configuradas en esta Edge Function.');
    }
    if (!RIDE_SERVICE_URL || !RIDE_SERVICE_API_KEY) {
      throw new Error('RIDE_SERVICE_URL / RIDE_SERVICE_API_KEY no están configuradas en esta Edge Function.');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseClient = createClient(
      supabaseUrl,
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    );
    // Cliente admin — solo para las dos escrituras que la RLS actual no
    // cubre para un usuario normal: subir archivos al bucket sri-documents
    // (además de la política agregada en la migración de este cambio) y
    // como respaldo si alguna política cambia. El resto de operaciones usa
    // el cliente autenticado del propio usuario, respetando RLS.
    const adminClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) throw new Error('Unauthorized');

    const body = await req.json();
    const action = body.action ?? 'emit';

    if (action === 'upload_certificate') {
      return await handleUploadCertificate(supabaseClient, body);
    }
    return await handleEmit(supabaseClient, adminClient, body);

  } catch (error: any) {
    return jsonResponse({ error: error.message }, 400);
  }
});

// ─── Emit an electronic document for one or more already-registered payments ──

async function handleEmit(
  supabaseClient: ReturnType<typeof createClient>,
  adminClient: ReturnType<typeof createClient>,
  body: any,
) {
  const { organization_id, internal_payment_ids } = body as {
    organization_id?: string;
    internal_payment_ids?: string[];
  };

  if (!organization_id) throw new Error('Falta organization_id.');
  if (!Array.isArray(internal_payment_ids) || internal_payment_ids.length === 0) {
    throw new Error('Debes indicar al menos un pago a facturar.');
  }

  // 1. Plan gate — this org's *current* plan must include electronic
  // billing. Enforced here, server-side; hiding the button client-side
  // is UX, not the actual gate.
  const { data: subscription, error: subError } = await supabaseClient
    .from('subscriptions')
    .select('plan_id')
    .eq('organization_id', organization_id)
    .maybeSingle();
  if (subError) throw subError;
  if (!subscription?.plan_id) {
    return jsonResponse({ error: 'Este centro no tiene un plan de suscripción activo.' }, 403);
  }

  const { data: plan, error: planError } = await supabaseClient
    .from('subscription_plans')
    .select('features')
    .eq('id', subscription.plan_id)
    .maybeSingle();
  if (planError) throw planError;

  const hasElectronicBilling = Boolean((plan?.features as any)?.has_electronic_billing);
  if (!hasElectronicBilling) {
    return jsonResponse({ error: 'Este centro no tiene habilitada la facturación electrónica en su plan.' }, 403);
  }

  // 2. The org's SRI configuration must be complete (certificate uploaded
  // to the reused SRI service) before it can emit any document.
  const { data: sriConfig, error: sriConfigError } = await supabaseClient
    .from('sri_configurations')
    .select('environment, establecimiento, punto_emision, cert_uploaded_at, sri_api_emisor_id')
    .eq('organization_id', organization_id)
    .maybeSingle();
  if (sriConfigError) throw sriConfigError;
  if (!sriConfig?.cert_uploaded_at || !sriConfig.sri_api_emisor_id) {
    return jsonResponse(
      { error: 'Debes subir la firma electrónica (.p12) en Configuración antes de poder facturar.' },
      403
    );
  }

  // 3. Re-fetch the payments ourselves — never trust a client-supplied
  // total, and this doubles as validating the ids actually belong to this
  // org. Also pull the charge description (for the invoice line) and the
  // beneficiary, to resolve the customer.
  const { data: paymentsRows, error: paymentsError } = await (supabaseClient as any)
    .from('internal_payments')
    .select('id, amount, sri_document_id, charges ( id, description, beneficiary_id )')
    .eq('organization_id', organization_id)
    .in('id', internal_payment_ids);
  if (paymentsError) throw paymentsError;

  if (!paymentsRows || paymentsRows.length !== internal_payment_ids.length) {
    throw new Error('Uno o más pagos indicados no existen en este centro.');
  }

  const alreadyInvoiced = paymentsRows.filter((p: any) => p.sri_document_id !== null);
  if (alreadyInvoiced.length > 0) {
    throw new Error(
      `${alreadyInvoiced.length} de los pagos seleccionados ya fueron facturados electrónicamente antes — no se puede volver a facturar.`
    );
  }

  const total = paymentsRows.reduce((sum: number, p: any) => sum + Number(p.amount), 0);
  const beneficiaryId = paymentsRows[0]?.charges?.beneficiary_id ?? null;
  const description = paymentsRows.map((p: any) => p.charges?.description).filter(Boolean).join(', ') || 'Servicio';

  // 4. Resolve issuer (this org) and customer (beneficiary's primary
  // representative, or a generic "consumidor final" if there isn't one).
  const { data: org, error: orgError } = await supabaseClient
    .from('organizations')
    .select('ruc, name, address, city')
    .eq('id', organization_id)
    .maybeSingle();
  if (orgError) throw orgError;
  if (!org?.ruc) {
    return jsonResponse({ error: 'Este centro no tiene un RUC configurado en Configuración > Datos del Centro.' }, 400);
  }

  let customer = {
    tipoIdentificacion: '07', // Consumidor final
    identificacion: '9999999999999',
    razonSocial: 'Consumidor Final',
    direccion: org.address || 'Ecuador',
    email: undefined as string | undefined,
  };

  if (beneficiaryId) {
    const { data: repLink } = await (supabaseClient as any)
      .from('beneficiary_representatives')
      .select('is_primary, representatives ( first_name, last_name, identification, email, phone )')
      .eq('beneficiary_id', beneficiaryId)
      .order('is_primary', { ascending: false });
    const rep = repLink?.[0]?.representatives;
    if (rep?.identification) {
      customer = {
        tipoIdentificacion: '05', // Cédula
        identificacion: rep.identification,
        razonSocial: `${rep.first_name} ${rep.last_name}`.trim(),
        direccion: org.address || 'Ecuador',
        email: rep.email || undefined,
      };
    }
  }

  // 5. Emitir contra la instancia reutilizada de open-api-facturacion-sri.
  // Tarifa 0% intencional por ahora — RIMPE Negocio Popular nunca cobra
  // IVA; el desglose real de impuestos queda para una fase posterior.
  const ambiente = sriConfig.environment === 'produccion' ? '2' : '1';
  const mainAddress = [org.address, org.city].filter(Boolean).join(', ') || 'Ecuador';

  const emitPayload = {
    ambiente,
    fechaEmision: formatFechaEmisionSri(new Date()),
    emisor: {
      ruc: org.ruc,
      razonSocial: org.name,
      nombreComercial: org.name,
      dirMatriz: mainAddress,
      dirEstablecimiento: mainAddress,
      establecimiento: sriConfig.establecimiento,
      puntoEmision: sriConfig.punto_emision,
      obligadoContabilidad: 'NO',
      contribuyenteRimpe: 'CONTRIBUYENTE NEGOCIO POPULAR - RÉGIMEN RIMPE',
    },
    comprador: customer,
    detalles: [
      {
        codigoPrincipal: 'SERVICIO',
        descripcion: description,
        cantidad: 1,
        precioUnitario: total,
        descuento: 0,
        impuestos: [{ codigo: '2', codigoPorcentaje: '0', tarifa: 0, baseImponible: total, valor: 0 }],
      },
    ],
    pagos: [{ formaPago: '01', total }],
  };

  const { ok, data: emitResult } = await sriApiFetch('/sri/emitir/factura', {
    method: 'POST',
    body: JSON.stringify(emitPayload),
  });

  if (!ok || !emitResult.success) {
    const errMsg = extractSriApiErrorMessage(emitResult);
    return jsonResponse({ error: errMsg }, 400);
  }

  const documentId = crypto.randomUUID();
  const isAuthorized = emitResult.estado === 'AUTORIZADO';

  // 6. Genera el RIDE (PDF) solo si el SRI autorizó el comprobante.
  let pdfUrl: string | null = null;
  let xmlUrl: string | null = null;
  if (isAuthorized) {
    try {
      const pdfBytes = await callRideService({
        accessKey: emitResult.claveAcceso,
        authorizationNumber: emitResult.numeroAutorizacion,
        authorizationDate: emitResult.fechaAutorizacion,
        issuer: {
          ruc: org.ruc,
          socialReason: org.name,
          mainAddress,
          rimpeType: 'CONTRIBUYENTE NEGOCIO POPULAR - RÉGIMEN RIMPE',
          environment: ambiente === '2' ? 2 : 1,
        },
        customer: {
          identificationType: customer.tipoIdentificacion === '05' ? 5 : 7,
          identificationNumber: customer.identificacion,
          socialReason: customer.razonSocial,
          address: customer.direccion,
          email: customer.email,
        },
        lines: [
          {
            itemCode: 'SERVICIO',
            description,
            quantity: 1,
            unitPrice: total,
            discount: 0,
            taxes: [{ percentageCode: '0', rate: 0, taxableBase: total }],
          },
        ],
        payments: [{ paymentMethod: 1, total }],
      });

      const pdfPath = `${organization_id}/${documentId}.pdf`;
      const { error: pdfUploadError } = await adminClient.storage
        .from('sri-documents')
        .upload(pdfPath, pdfBytes, { contentType: 'application/pdf', upsert: false });
      if (pdfUploadError) throw pdfUploadError;
      pdfUrl = pdfPath;

      if (emitResult.xmlAutorizado) {
        const xmlPath = `${organization_id}/${documentId}.xml`;
        const { error: xmlUploadError } = await adminClient.storage
          .from('sri-documents')
          .upload(xmlPath, new TextEncoder().encode(emitResult.xmlAutorizado), { contentType: 'application/xml', upsert: false });
        if (!xmlUploadError) xmlUrl = xmlPath;
      }
    } catch (rideError: any) {
      // El comprobante ya fue autorizado por el SRI — no fallar toda la
      // operación por un problema generando el PDF, solo dejar constancia.
      console.error('Error generando/guardando el RIDE:', rideError.message);
    }
  }

  // 7. Persist the document — single INSERT with everything already known,
  // so no UPDATE policy is ever needed on sri_documents.
  const { error: insertError } = await supabaseClient.from('sri_documents').insert({
    id: documentId,
    organization_id,
    document_type: '01',
    status: isAuthorized ? 'AUTHORIZED' : 'REJECTED',
    secuencial: extractSecuencial(emitResult.claveAcceso),
    clave_acceso: emitResult.claveAcceso,
    total,
    cliente_identificacion: customer.identificacion,
    authorization_number: emitResult.numeroAutorizacion ?? null,
    authorization_date: emitResult.fechaAutorizacion ?? null,
    xml_url: xmlUrl,
    pdf_url: pdfUrl,
  });
  if (insertError) throw insertError;

  if (!isAuthorized) {
    return jsonResponse({ error: extractSriApiErrorMessage(emitResult) }, 400);
  }

  // 8. Link every invoiced payment to the new document — the trigger on
  // internal_payments blocks this from ever being overwritten later.
  const { error: linkError } = await supabaseClient
    .from('internal_payments')
    .update({ sri_document_id: documentId })
    .in('id', internal_payment_ids);
  if (linkError) throw linkError;

  return jsonResponse({
    success: true,
    sri_document_id: documentId,
    clave_acceso: emitResult.claveAcceso,
    authorization_number: emitResult.numeroAutorizacion,
    total,
  });
}

function formatFechaEmisionSri(date: Date): string {
  const dd = String(date.getUTCDate()).padStart(2, '0');
  const mm = String(date.getUTCMonth() + 1).padStart(2, '0');
  const yyyy = date.getUTCFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

function extractSecuencial(claveAcceso?: string): string {
  // El secuencial son los 9 dígitos en la posición 30-38 de la clave de
  // acceso de 49 dígitos del SRI.
  if (claveAcceso && claveAcceso.length === 49) return claveAcceso.substring(30, 39);
  return '000000001';
}

function extractSriApiErrorMessage(result: any): string {
  if (Array.isArray(result?.mensajes) && result.mensajes.length > 0) {
    const first = result.mensajes[0];
    return first.informacionAdicional || first.mensaje || 'Error del SRI.';
  }
  if (Array.isArray(result?.message) && result.message.length > 0) return result.message[0];
  if (typeof result?.message === 'string') return result.message;
  return result?.error || 'Error del servicio de facturación.';
}

// ─── Upload the org's electronic signature to the reused SRI service ──────

async function handleUploadCertificate(supabaseClient: ReturnType<typeof createClient>, body: any) {
  const { organization_id, environment, establecimiento, punto_emision, p12_base64, p12_password } = body as {
    organization_id?: string;
    environment?: string;
    establecimiento?: string;
    punto_emision?: string;
    p12_base64?: string;
    p12_password?: string;
  };

  if (!organization_id || !establecimiento || !punto_emision || !p12_base64 || !p12_password) {
    throw new Error('Faltan datos para subir la firma electrónica.');
  }

  // Only an owner of this org may upload its signing certificate.
  const { data: membership, error: membershipError } = await supabaseClient
    .from('organization_members')
    .select('role')
    .eq('organization_id', organization_id)
    .eq('status', 'active')
    .maybeSingle();
  if (membershipError) throw membershipError;
  if (membership?.role !== 'owner') {
    return jsonResponse({ error: 'Solo el dueño del centro puede subir la firma electrónica.' }, 403);
  }

  const { data: org, error: orgError } = await supabaseClient
    .from('organizations')
    .select('ruc, name, address, city')
    .eq('id', organization_id)
    .maybeSingle();
  if (orgError) throw orgError;
  if (!org?.ruc) {
    return jsonResponse({ error: 'Este centro no tiene un RUC configurado en Configuración > Datos del Centro.' }, 400);
  }

  const ambiente = environment === 'produccion' ? '2' : '1';
  const mainAddress = [org.address, org.city].filter(Boolean).join(', ') || 'Ecuador';

  // 1. Ensure the "emisor" exists in the reused SRI service (create or update).
  const { data: existingEmisores } = await sriApiFetch('/emisores');
  const emisorList = Array.isArray(existingEmisores) ? existingEmisores : [];
  const existingEmisor = emisorList.find((e: any) => e.ruc === org.ruc);

  const emisorPayload = {
    ruc: org.ruc,
    razonSocial: org.name,
    nombreComercial: org.name,
    direccionMatriz: mainAddress,
    obligadoContabilidad: false,
    contribuyenteRimpe: true,
    ambiente,
    estado: 'ACTIVO',
  };

  let emisorId: string;
  if (existingEmisor) {
    emisorId = existingEmisor.id;
    const { ok, data } = await sriApiFetch(`/emisores/${emisorId}`, {
      method: 'PUT',
      body: JSON.stringify(emisorPayload),
    });
    if (!ok) return jsonResponse({ error: extractSriApiErrorMessage(data) }, 400);
  } else {
    const { ok, data } = await sriApiFetch('/emisores', {
      method: 'POST',
      body: JSON.stringify(emisorPayload),
    });
    if (!ok || !data.id) return jsonResponse({ error: extractSriApiErrorMessage(data) }, 400);
    emisorId = data.id;
  }

  // 2. Ensure the "punto de emisión" exists for that emisor.
  const { data: existingPuntos } = await sriApiFetch(`/puntos-emision/emisor/${emisorId}`);
  const puntosList = Array.isArray(existingPuntos) ? existingPuntos : [];
  const establecimientoPadded = establecimiento.padStart(3, '0');
  const puntoEmisionPadded = punto_emision.padStart(3, '0');
  const puntoExists = puntosList.some(
    (p: any) => p.establecimiento === establecimientoPadded && p.puntoEmision === puntoEmisionPadded
  );
  if (!puntoExists) {
    const { ok, data } = await sriApiFetch(`/puntos-emision/emisor/${emisorId}`, {
      method: 'POST',
      body: JSON.stringify({
        establecimiento: establecimientoPadded,
        puntoEmision: puntoEmisionPadded,
        direccionEstablecimiento: mainAddress,
        descripcion: 'Punto de Emisión',
      }),
    });
    if (!ok) return jsonResponse({ error: extractSriApiErrorMessage(data) }, 400);
  }

  // 3. Upload the actual .p12 — never logged, never stored by us, forwarded
  // straight through to the service that will use it to sign.
  const p12Bytes = Uint8Array.from(atob(p12_base64), (c) => c.charCodeAt(0));
  const formData = new FormData();
  formData.append('ruc', org.ruc);
  formData.append('password', p12_password);
  formData.append('cert', new Blob([p12Bytes], { type: 'application/x-pkcs12' }), 'certificado.p12');

  const token = await getSriApiToken();
  const uploadResponse = await fetch(`${SRI_API_URL}/certificates/upload-cert`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  });
  const uploadData = await uploadResponse.json().catch(() => ({}));
  if (!uploadResponse.ok) {
    return jsonResponse({ error: extractSriApiErrorMessage(uploadData) }, 400);
  }

  // 4. Record locally that this org is configured — no secret bytes kept
  // on our side, just enough to gate the "Facturar" button and remember
  // the emisor id for future emissions.
  const { error: upsertError } = await supabaseClient.from('sri_configurations').upsert(
    {
      organization_id,
      environment: environment === 'produccion' ? 'produccion' : 'pruebas',
      establecimiento: establecimientoPadded,
      punto_emision: puntoEmisionPadded,
      cert_uploaded_at: new Date().toISOString(),
      sri_api_emisor_id: emisorId,
    },
    { onConflict: 'organization_id' }
  );
  if (upsertError) throw upsertError;

  return jsonResponse({ success: true });
}
