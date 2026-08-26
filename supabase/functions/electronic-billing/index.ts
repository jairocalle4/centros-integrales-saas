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

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ─── fetch resiliente contra servicios externos en Render (free tier) ─────
// Ninguna de las llamadas a la API SRI reutilizada o al microservicio de
// RIDE capturaba antes una excepción del fetch() mismo (a diferencia de
// una respuesta HTTP no-2xx, que el resto del código ya maneja bien vía
// `ok`/`data`) — si el servicio estaba dormido o hubo cualquier fallo de
// red, la excepción subía cruda hasta el usuario, sin mensaje claro, y en
// el peor caso podía perder el resultado de una operación que ya había
// llegado a autorizarse en el SRI.
//
// `retryOnNetworkError: false` es obligatorio para las dos llamadas que
// mutan estado fiscal real (emitir, reintentar): si el fetch lanza
// DESPUÉS de que el servidor ya procesó el request pero ANTES de que la
// respuesta llegue, reintentar a ciegas podría generar dos comprobantes
// autorizados por el mismo pago. Un 502/503/504 sí se reintenta siempre,
// sea o no "seguro" — esa respuesta confirma que el request nunca llegó a
// procesarse (el proxy de Render no tenía un origen vivo).
async function resilientFetch(
  url: string,
  init: RequestInit = {},
  opts: { retries?: number; baseDelayMs?: number; retryOnNetworkError?: boolean } = {},
): Promise<Response> {
  const { retries = 2, baseDelayMs = 3000, retryOnNetworkError = true } = opts;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await fetch(url, init);
      // 502/503/504 garantizan que el request nunca llegó a procesarse en
      // el origen (el proxy no tenía a quién reenviarlo) — seguro
      // reintentar siempre, incluso en las llamadas que mutan estado
      // fiscal real. 520-527 son códigos propios de Cloudflare/el proxy de
      // borde ("el origen respondió algo vacío o irreconocible" — típico
      // de una instancia de Render despertando de estar inactiva) y NO dan
      // esa misma garantía: el origen sí alcanzó a responder algo, así que
      // solo se reintentan en las llamadas ya marcadas como seguras
      // (mismo flag que gatea las excepciones de red).
      const originNeverReached = [502, 503, 504].includes(response.status);
      const unknownOriginError = response.status >= 520 && response.status <= 527;
      if (attempt < retries && (originNeverReached || (unknownOriginError && retryOnNetworkError))) {
        await sleep(baseDelayMs * (attempt + 1));
        continue;
      }
      return response;
    } catch (err: any) {
      if (!retryOnNetworkError || attempt >= retries) {
        console.error(`resilientFetch: fallo de red contra ${url} (intento ${attempt + 1}/${retries + 1}):`, err?.message ?? err);
        throw new Error(
          'No se pudo conectar con el servicio de facturación electrónica. Si no se usó en un rato puede tardar hasta un minuto en reactivarse — intenta de nuevo en un momento.'
        );
      }
      await sleep(baseDelayMs * (attempt + 1));
    }
  }
  // Inalcanzable en la práctica — el loop siempre retorna o lanza antes.
  throw new Error('No se pudo contactar el servicio de facturación electrónica.');
}

// Cacheado a nivel de módulo — se reutiliza mientras la instancia del Edge
// Function siga caliente, igual que el patrón ya usado por el ERP real
// (ElectronicBillingService.GetAuthTokenAsync).
let cachedSriApiToken: string | null = null;
let cachedSriApiTokenExpiresAt = 0;

async function getSriApiToken(): Promise<string> {
  if (cachedSriApiToken && Date.now() < cachedSriApiTokenExpiresAt) {
    return cachedSriApiToken;
  }
  // Presupuesto de reintento más largo que el resto de llamadas (~50s en
  // vez de ~9s): este es el primer salto de red de todo el flujo, así que
  // es el lugar correcto para absorber un cold-start típico de Render
  // (hasta ~50s) sin que el usuario vea un error y tenga que reintentar a
  // mano — login es siempre seguro de reintentar (no muta nada).
  const response = await resilientFetch(`${SRI_API_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: SRI_API_SERVICE_EMAIL, password: SRI_API_SERVICE_PASSWORD }),
  }, { retries: 4, baseDelayMs: 5000 });
  if (!response.ok) {
    throw new Error(`No se pudo autenticar contra el servicio de facturación (HTTP ${response.status}).`);
  }
  const data = await response.json();
  cachedSriApiToken = data.accessToken;
  cachedSriApiTokenExpiresAt = Date.now() + 55 * 60 * 1000; // el token dura 1h, cacheamos 55m
  if (!cachedSriApiToken) throw new Error('El servicio de facturación no devolvió un accessToken.');
  return cachedSriApiToken;
}

async function sriApiFetch(path: string, init: RequestInit = {}, fetchOpts: { retryOnNetworkError?: boolean } = {}) {
  const token = await getSriApiToken();
  const response = await resilientFetch(`${SRI_API_URL}${path}`, {
    ...init,
    headers: {
      ...(init.body && !(init.body instanceof FormData) ? { 'Content-Type': 'application/json' } : {}),
      Authorization: `Bearer ${token}`,
      ...(init.headers ?? {}),
    },
  }, fetchOpts);
  const data = await response.json().catch(() => ({}));
  return { ok: response.ok, status: response.status, data };
}

async function sriApiFetchText(path: string): Promise<string | null> {
  const token = await getSriApiToken();
  const response = await resilientFetch(`${SRI_API_URL}${path}`, { headers: { Authorization: `Bearer ${token}` } });
  if (!response.ok) return null;
  return await response.text();
}

async function callRideService(payload: unknown) {
  const response = await resilientFetch(`${RIDE_SERVICE_URL}/api/v1/ride/generate`, {
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

// ─── Cálculo de impuestos según régimen tributario ─────────────────────────
// RIMPE Negocio Popular nunca cobra IVA (0%). Régimen General sí — a la
// tarifa general vigente (15% desde abril 2024, Circular SRI
// NAC-DGECCGC25-00000006). El monto que se registra como "pago" ya
// incluye el IVA cuando el régimen es General (precio final que pagó la
// familia), así que la factura desglosa hacia atrás.
const RIMPE_NEGOCIO_POPULAR_LEGEND = 'CONTRIBUYENTE NEGOCIO POPULAR - RÉGIMEN RIMPE';

function computeSriInvoiceTax(total: number, regimenFiscal: string | null | undefined) {
  if (regimenFiscal === 'general') {
    const baseImponible = Math.round((total / 1.15) * 100) / 100;
    // Por diferencia, no por tarifa: garantiza que base + IVA cierre
    // exacto contra el total que la familia realmente pagó — calcular el
    // IVA como base×15% de forma independiente puede descuadrar $0.01.
    const valor = Math.round((total - baseImponible) * 100) / 100;
    return {
      codigo: '2',
      codigoPorcentaje: '4',
      tarifa: 15,
      baseImponible,
      valor,
      // El DTO de la API SRI solo acepta 2 strings legales de RIMPE, o la
      // ausencia del campo — nunca un booleano ni una cadena vacía.
      contribuyenteRimpe: undefined as string | undefined,
    };
  }
  // Cualquier otro valor (incluye null/undefined de filas antiguas)
  // preserva el comportamiento de siempre — ningún centro cambia de
  // tarifa hasta elegir 'general' explícitamente.
  return {
    codigo: '2',
    codigoPorcentaje: '0',
    tarifa: 0,
    baseImponible: total,
    valor: 0,
    contribuyenteRimpe: RIMPE_NEGOCIO_POPULAR_LEGEND as string | undefined,
  };
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

type BrevoConfig = { apiKey: string; senderEmail: string; senderName: string };

// La configuración de Brevo se edita desde el panel de superadmin
// (platform_settings, columnas brevo_*) en vez de ser un secreto fijo de
// esta Edge Function — así se puede rotar la API Key sin redeploy. Se
// lee con adminClient (service role) porque quien llama a handleEmit/
// handleRetry/handleResendEmail es normalmente el dueño de un centro, no
// un superadmin — la RLS de platform_settings (is_platform_admin) le
// negaría la lectura directa, y no tiene por qué necesitar ese permiso
// solo para facturar.
async function getBrevoConfig(adminClient: ReturnType<typeof createClient>): Promise<BrevoConfig | null> {
  const { data } = await adminClient
    .from('platform_settings')
    .select('brevo_api_key, brevo_sender_email, brevo_sender_name')
    .eq('id', true)
    .maybeSingle();
  if (!data?.brevo_api_key || !data?.brevo_sender_email) return null;
  return {
    apiKey: data.brevo_api_key,
    senderEmail: data.brevo_sender_email,
    senderName: data.brevo_sender_name || 'Facturación Electrónica',
  };
}

async function sendInvoiceEmail(params: {
  config: BrevoConfig;
  to: string;
  customerName: string;
  organizationName: string;
  claveAcceso: string;
  total: number;
  pdfBytes: Uint8Array | null;
  xmlContent: string | null;
}): Promise<void> {
  const attachment: { name: string; content: string }[] = [];
  if (params.pdfBytes) {
    attachment.push({ name: `factura-${params.claveAcceso}.pdf`, content: bytesToBase64(params.pdfBytes) });
  }
  if (params.xmlContent) {
    attachment.push({ name: `factura-${params.claveAcceso}.xml`, content: bytesToBase64(new TextEncoder().encode(params.xmlContent)) });
  }

  const response = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'api-key': params.config.apiKey },
    body: JSON.stringify({
      sender: { email: params.config.senderEmail, name: params.config.senderName },
      to: [{ email: params.to, name: params.customerName }],
      subject: `Factura electrónica de ${params.organizationName}`,
      htmlContent: `<p>Hola ${params.customerName},</p><p>Adjuntamos tu factura electrónica por $${params.total.toFixed(2)} emitida por ${params.organizationName}.</p><p>Clave de acceso: ${params.claveAcceso}</p>`,
      ...(attachment.length > 0 ? { attachment } : {}),
    }),
  });
  if (!response.ok) {
    const errBody = await response.json().catch(() => ({}));
    throw new Error(errBody.message || `Brevo respondió HTTP ${response.status}.`);
  }
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
    const authHeader = req.headers.get('Authorization') ?? '';
    const supabaseClient = createClient(
      supabaseUrl,
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );
    // Cliente admin — solo para las dos escrituras que la RLS actual no
    // cubre para un usuario normal: subir archivos al bucket sri-documents
    // (además de la política agregada en la migración de este cambio) y
    // como respaldo si alguna política cambia. El resto de operaciones usa
    // el cliente autenticado del propio usuario, respetando RLS.
    const adminClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');

    // auth.getUser() ignora el header puesto en global.headers — necesita
    // el JWT explícito como argumento (mismo patrón ya probado en
    // supabase/functions/invite-user/index.ts). Sin esto, esta llamada
    // falla siempre con "Unauthorized", sin importar qué tan válida sea
    // la sesión de quien llama.
    const jwt = authHeader.replace('Bearer ', '').trim();
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(jwt);
    if (userError || !user) throw new Error('Unauthorized');

    const body = await req.json();
    const action = body.action ?? 'emit';

    if (action === 'upload_certificate') {
      return await handleUploadCertificate(supabaseClient, body);
    }
    if (action === 'retry') {
      return await handleRetry(supabaseClient, adminClient, body);
    }
    if (action === 'resend_email') {
      return await handleResendEmail(supabaseClient, adminClient, body);
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
  const { organization_id, internal_payment_ids, allow_consumidor_final } = body as {
    organization_id?: string;
    internal_payment_ids?: string[];
    allow_consumidor_final?: boolean;
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
    .select('environment, establecimiento, punto_emision, cert_uploaded_at, sri_api_emisor_id, regimen_fiscal')
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

  // Redondeado a 2 decimales de inmediato — evita que el ruido de coma
  // flotante de JavaScript (ej. 10 - 8.7 = 1.3000000000000007) llegue más
  // adelante al payload hacia la API SRI.
  const total = Math.round(paymentsRows.reduce((sum: number, p: any) => sum + Number(p.amount), 0) * 100) / 100;
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
  let foundRealIdentification = false;

  if (beneficiaryId) {
    const { data: repLink } = await (supabaseClient as any)
      .from('beneficiary_representatives')
      .select('is_primary, representatives ( first_name, last_name, identification, email, phone )')
      .eq('beneficiary_id', beneficiaryId)
      .order('is_primary', { ascending: false });
    const rep = repLink?.[0]?.representatives;
    if (rep?.identification) {
      foundRealIdentification = true;
      customer = {
        tipoIdentificacion: '05', // Cédula
        identificacion: rep.identification,
        razonSocial: `${rep.first_name} ${rep.last_name}`.trim(),
        direccion: org.address || 'Ecuador',
        email: rep.email || undefined,
      };
    }
  }

  // El comprador nunca cae en Consumidor Final en silencio: si no se
  // encontró una cédula real, se corta aquí — antes de tocar la API SRI o
  // guardar nada — a menos que el usuario haya activado explícitamente la
  // opción de facturar como Consumidor Final en la UI.
  if (!foundRealIdentification && allow_consumidor_final !== true) {
    return jsonResponse(
      { error: 'Falta la cédula del comprador. Activa "Facturar como Consumidor Final" para continuar sin ella.' },
      400
    );
  }

  // 5. Emitir contra la instancia reutilizada de open-api-facturacion-sri.
  const ambiente = sriConfig.environment === 'produccion' ? '2' : '1';
  const mainAddress = [org.address, org.city].filter(Boolean).join(', ') || 'Ecuador';
  const tax = computeSriInvoiceTax(total, sriConfig.regimen_fiscal);

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
      contribuyenteRimpe: tax.contribuyenteRimpe,
    },
    comprador: customer,
    detalles: [
      {
        codigoPrincipal: 'SERVICIO',
        descripcion: description,
        cantidad: 1,
        precioUnitario: tax.baseImponible,
        descuento: 0,
        impuestos: [{ codigo: tax.codigo, codigoPorcentaje: tax.codigoPorcentaje, tarifa: tax.tarifa, baseImponible: tax.baseImponible, valor: tax.valor }],
      },
    ],
    pagos: [{ formaPago: '01', total }],
  };

  // Nunca se reintenta a ciegas ante una excepción de red en esta llamada
  // (retryOnNetworkError: false): si el fetch lanza después de que el SRI
  // ya procesó el request pero antes de que la respuesta llegue,
  // reintentar podría generar dos comprobantes autorizados por el mismo
  // pago. Sí se beneficia del reintento seguro ante 502/503/504.
  const { ok, data: emitResult } = await sriApiFetch('/sri/emitir/factura', {
    method: 'POST',
    body: JSON.stringify(emitPayload),
  }, { retryOnNetworkError: false });

  if (!ok || !emitResult.success) {
    const errMsg = extractSriApiErrorMessage(emitResult);
    return jsonResponse({ error: errMsg }, 400);
  }

  const documentId = crypto.randomUUID();
  const isAuthorized = emitResult.estado === 'AUTORIZADO';

  // 6. Persistir el resultado del SRI de inmediato — antes de generar el
  // RIDE o intentar el correo. El SRI ya dio una respuesta definitiva en
  // este punto (autorizado o rechazo limpio); si un paso posterior (RIDE,
  // correo) fallara de forma inesperada, la factura ya autorizada por el
  // SRI no debe quedar sin ningún registro local — ver Fase 6 del plan.
  const { error: insertError } = await supabaseClient.from('sri_documents').insert({
    id: documentId,
    organization_id,
    document_type: '01',
    status: isAuthorized ? 'AUTHORIZED' : 'REJECTED',
    secuencial: extractSecuencial(emitResult.claveAcceso),
    clave_acceso: emitResult.claveAcceso,
    total,
    cliente_identificacion: customer.identificacion,
    cliente_razon_social: customer.razonSocial,
    cliente_email: customer.email ?? null,
    regimen_fiscal_aplicado: sriConfig.regimen_fiscal,
    environment_aplicado: sriConfig.environment,
    authorization_number: emitResult.numeroAutorizacion ?? null,
    authorization_date: emitResult.fechaAutorizacion ?? null,
    xml_url: null,
    pdf_url: null,
    email_sent_at: null,
    email_sent_to: null,
  });
  if (insertError) throw insertError;

  // 7. Enlazar cada pago facturado — siempre, sea AUTHORIZED o REJECTED,
  // para que un rechazo nunca sea indistinguible de "nunca facturado".
  const { error: linkError } = await supabaseClient
    .from('internal_payments')
    .update({ sri_document_id: documentId })
    .in('id', internal_payment_ids);
  if (linkError) throw linkError;

  // 8. Genera el RIDE (PDF) y, si corresponde, envía la factura por
  // correo — ambos best-effort. La factura ya quedó registrada arriba, así
  // que un fallo aquí solo pierde el enriquecimiento (PDF/XML/envío),
  // nunca el registro de la factura en sí. Subir a Storage y enviar el
  // correo no dependen entre sí (el correo solo necesita los bytes del
  // PDF ya en memoria, no la URL de Storage), así que corren en paralelo
  // en vez de uno tras otro — ahorra uno de los saltos de red secuenciales
  // en el camino ya-autorizado.
  let pdfUrl: string | null = null;
  let xmlUrl: string | null = null;
  let emailSentAt: string | null = null;
  let emailSentTo: string | null = null;
  // email_status distingue el motivo exacto para que el frontend pueda
  // mostrarle al usuario por qué no se envió (o si sí se envió) — un
  // simple booleano no alcanza para eso.
  let emailStatus: 'sent' | 'no_email' | 'not_configured' | 'failed' = 'no_email';
  const xmlContentForEmail: string | null = emitResult.xmlAutorizado ?? null;

  if (isAuthorized) {
    let pdfBytes: Uint8Array | null = null;
    try {
      pdfBytes = await callRideService({
        accessKey: emitResult.claveAcceso,
        authorizationNumber: emitResult.numeroAutorizacion,
        authorizationDate: emitResult.fechaAutorizacion,
        issuer: {
          ruc: org.ruc,
          socialReason: org.name,
          mainAddress,
          rimpeType: tax.contribuyenteRimpe,
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
            unitPrice: tax.baseImponible,
            discount: 0,
            taxes: [{ percentageCode: tax.codigoPorcentaje, rate: tax.tarifa, taxableBase: tax.baseImponible, taxAmount: tax.valor }],
          },
        ],
        payments: [{ paymentMethod: 1, total }],
      });
    } catch (rideError: any) {
      // El comprobante ya fue autorizado por el SRI y ya está persistido
      // — no fallar toda la operación por un problema generando el PDF,
      // solo dejar constancia.
      console.error('Error generando el RIDE:', rideError.message);
    }

    const [storageOutcome, emailOutcome] = await Promise.allSettled([
      (async () => {
        if (!pdfBytes) return;
        const bytes = pdfBytes;
        const pdfPath = `${organization_id}/${documentId}.pdf`;
        const { error: pdfUploadError } = await adminClient.storage
          .from('sri-documents')
          .upload(pdfPath, bytes, { contentType: 'application/pdf', upsert: false });
        if (pdfUploadError) throw pdfUploadError;
        pdfUrl = pdfPath;

        if (xmlContentForEmail) {
          const xmlPath = `${organization_id}/${documentId}.xml`;
          const { error: xmlUploadError } = await adminClient.storage
            .from('sri-documents')
            .upload(xmlPath, new TextEncoder().encode(xmlContentForEmail), { contentType: 'application/xml', upsert: false });
          if (!xmlUploadError) xmlUrl = xmlPath;
        }
      })(),
      (async () => {
        if (!customer.email) { emailStatus = 'no_email'; return; }
        const brevoConfig = await getBrevoConfig(adminClient);
        if (!brevoConfig) { emailStatus = 'not_configured'; return; }
        await sendInvoiceEmail({
          config: brevoConfig,
          to: customer.email,
          customerName: customer.razonSocial,
          organizationName: org.name,
          claveAcceso: emitResult.claveAcceso,
          total,
          pdfBytes,
          xmlContent: xmlContentForEmail,
        });
        emailSentAt = new Date().toISOString();
        emailSentTo = customer.email;
        emailStatus = 'sent';
      })(),
    ]);
    if (storageOutcome.status === 'rejected') {
      console.error('Error guardando el RIDE:', (storageOutcome.reason as any)?.message ?? storageOutcome.reason);
    }
    if (emailOutcome.status === 'rejected') {
      console.error('Error enviando la factura por correo:', (emailOutcome.reason as any)?.message ?? emailOutcome.reason);
      emailStatus = 'failed';
    }
  }

  // 9. Si se obtuvo RIDE/XML/confirmación de correo, enriquecer la fila ya
  // persistida — nunca vuelve a tocar `status`, y un fallo aquí no debe
  // hacer fallar la respuesta (la factura ya es válida sin esto).
  if (pdfUrl || xmlUrl || emailSentAt) {
    const { error: enrichError } = await supabaseClient
      .from('sri_documents')
      .update({
        ...(pdfUrl ? { pdf_url: pdfUrl } : {}),
        ...(xmlUrl ? { xml_url: xmlUrl } : {}),
        ...(emailSentAt ? { email_sent_at: emailSentAt, email_sent_to: emailSentTo } : {}),
      })
      .eq('id', documentId);
    if (enrichError) console.error('Error guardando enriquecimiento de la factura (RIDE/correo):', enrichError.message);
  }

  if (!isAuthorized) {
    return jsonResponse({ error: extractSriApiErrorMessage(emitResult), sri_document_id: documentId }, 400);
  }

  return jsonResponse({
    success: true,
    sri_document_id: documentId,
    clave_acceso: emitResult.claveAcceso,
    authorization_number: emitResult.numeroAutorizacion,
    total,
    email_status: emailStatus,
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
    // El schema documentado (FacturaResponseDto) declara mensajes como
    // string[], pero no hay garantía de que el código en ejecución
    // coincida siempre con eso — se soportan ambos shapes para no perder
    // el motivo real de un rechazo del SRI.
    if (typeof first === 'string') return first;
    if (first && typeof first === 'object') {
      return first.informacionAdicional || first.mensaje || 'Error del SRI.';
    }
  }
  if (Array.isArray(result?.message) && result.message.length > 0) return result.message[0];
  if (typeof result?.message === 'string') return result.message;
  return result?.error || 'Error del servicio de facturación.';
}

// ─── Retry a previously REJECTED/ERROR document ────────────────────────────
// Reuses the same clave_acceso/secuencial — the reused API's /reintentar
// endpoint resends the exact XML it already signed the first time, so this
// never mints a new access key. Updates the existing sri_documents row in
// place instead of inserting a new one.

async function handleRetry(
  supabaseClient: ReturnType<typeof createClient>,
  adminClient: ReturnType<typeof createClient>,
  body: any,
) {
  const { organization_id, sri_document_id } = body as {
    organization_id?: string;
    sri_document_id?: string;
  };
  if (!organization_id || !sri_document_id) throw new Error('Falta organization_id o sri_document_id.');

  const { data: doc, error: docError } = await supabaseClient
    .from('sri_documents')
    .select('id, clave_acceso, status, total, cliente_identificacion, cliente_razon_social, cliente_email, regimen_fiscal_aplicado, environment_aplicado, email_sent_at')
    .eq('id', sri_document_id)
    .eq('organization_id', organization_id)
    .maybeSingle();
  if (docError) throw docError;
  if (!doc) throw new Error('Factura no encontrada en este centro.');
  if (doc.status !== 'REJECTED' && doc.status !== 'ERROR') {
    throw new Error(`Solo se pueden reintentar facturas rechazadas o con error (estado actual: ${doc.status}).`);
  }

  // Igual que en la emisión: nunca se reintenta a ciegas ante una
  // excepción de red en una llamada que muta estado fiscal real.
  const { ok, data: retryResult } = await sriApiFetch(`/sri/comprobantes/${doc.clave_acceso}/reintentar`, {
    method: 'POST',
  }, { retryOnNetworkError: false });
  if (!ok) {
    return jsonResponse({ error: extractSriApiErrorMessage(retryResult) }, 400);
  }

  const isAuthorized = retryResult.estado === 'AUTORIZADO';
  if (!isAuthorized) {
    const { error: updateError } = await supabaseClient
      .from('sri_documents')
      .update({ status: 'REJECTED' })
      .eq('id', sri_document_id);
    if (updateError) throw updateError;
    return jsonResponse({ error: retryResult.mensaje || 'El SRI volvió a rechazar el comprobante.' }, 400);
  }

  // Autorizado — marcar el estado local de inmediato. Todo lo que sigue
  // (número de autorización, XML, RIDE, correo) es enriquecimiento
  // best-effort: si algo de eso falla, el hecho de que el SRI autorizó el
  // comprobante ya quedó guardado, nunca se pierde — ver Fase 6 del plan.
  const { error: statusUpdateError } = await supabaseClient
    .from('sri_documents')
    .update({ status: 'AUTHORIZED' })
    .eq('id', sri_document_id);
  if (statusUpdateError) throw statusUpdateError;

  // El XML reenviado es exactamente el que ya se firmó en el intento
  // original — el comprador, régimen y ambiente que contiene quedaron
  // fijados entonces. Por eso el RIDE se regenera desde el snapshot ya
  // guardado en esta fila (cliente_*, regimen_fiscal_aplicado,
  // environment_aplicado), nunca re-consultando representante/config "en
  // vivo": si algo cambió desde el intento original (representante
  // editado, cambio de régimen, cambio pruebas↔producción), un RIDE
  // recalculado "en vivo" mostraría datos distintos a los que el XML
  // reenviado realmente contiene.
  const total = Number(doc.total);
  const tax = computeSriInvoiceTax(total, doc.regimen_fiscal_aplicado);
  const isConsumidorFinal = doc.cliente_identificacion === '9999999999999';
  const customer = {
    identificationType: isConsumidorFinal ? 7 : 5,
    identificationNumber: doc.cliente_identificacion as string,
    // Filas previas a la migración del snapshot no tienen
    // cliente_razon_social — no afirmamos "Consumidor Final" para esas si
    // en realidad se facturaron con una cédula real.
    socialReason: doc.cliente_razon_social || (isConsumidorFinal ? 'Consumidor Final' : 'Cliente'),
    email: doc.cliente_email || undefined,
  };

  let authorizationNumber: string | null = null;
  let authorizationDate: string | null = null;
  let pdfUrl: string | null = null;
  let xmlUrl: string | null = null;
  let emailSentAt: string | null = doc.email_sent_at ?? null;
  let emailSentTo: string | null = doc.cliente_email ?? null;
  let emailStatus: 'sent' | 'no_email' | 'not_configured' | 'failed' = doc.email_sent_at ? 'sent' : 'no_email';
  try {
    // /reintentar no devuelve numeroAutorizacion ni el XML, así que se
    // piden aparte — ahora dentro del mismo try que el resto del
    // enriquecimiento, para que un fallo de red aquí tampoco revierta el
    // status ya guardado arriba.
    const { data: comprobante } = await sriApiFetch(`/sri/comprobantes/${doc.clave_acceso}`);
    const xmlAutorizado = await sriApiFetchText(`/sri/comprobantes/${doc.clave_acceso}/xml`);
    authorizationNumber = comprobante?.numAutorizacion ?? null;
    authorizationDate = comprobante?.fechaAutorizacion ?? null;

    const { data: paymentsRows } = await (supabaseClient as any)
      .from('internal_payments')
      .select('charges ( description )')
      .eq('organization_id', organization_id)
      .eq('sri_document_id', sri_document_id);
    const { data: org } = await supabaseClient
      .from('organizations')
      .select('ruc, name, address, city')
      .eq('id', organization_id)
      .maybeSingle();

    if (org) {
      const description = (paymentsRows ?? []).map((p: any) => p.charges?.description).filter(Boolean).join(', ') || 'Servicio';
      const mainAddress = [org.address, org.city].filter(Boolean).join(', ') || 'Ecuador';
      const ambiente = doc.environment_aplicado === 'produccion' ? 2 : 1;

      const pdfBytes = await callRideService({
        accessKey: doc.clave_acceso,
        authorizationNumber,
        authorizationDate,
        issuer: {
          ruc: org.ruc,
          socialReason: org.name,
          mainAddress,
          rimpeType: tax.contribuyenteRimpe,
          environment: ambiente,
        },
        customer: {
          identificationType: customer.identificationType,
          identificationNumber: customer.identificationNumber,
          socialReason: customer.socialReason,
          address: org.address || 'Ecuador',
          email: customer.email,
        },
        lines: [
          {
            itemCode: 'SERVICIO',
            description,
            quantity: 1,
            unitPrice: tax.baseImponible,
            discount: 0,
            taxes: [{ percentageCode: tax.codigoPorcentaje, rate: tax.tarifa, taxableBase: tax.baseImponible, taxAmount: tax.valor }],
          },
        ],
        payments: [{ paymentMethod: 1, total }],
      });

      // Subir a Storage y enviar el correo (si aún no se había enviado) no
      // dependen entre sí — ambos solo necesitan los bytes del PDF ya en
      // memoria — así que corren en paralelo en vez de uno tras otro.
      const shouldSendEmail = !doc.email_sent_at;
      const [storageOutcome, emailOutcome] = await Promise.allSettled([
        (async () => {
          const pdfPath = `${organization_id}/${sri_document_id}.pdf`;
          const { error: pdfUploadError } = await adminClient.storage
            .from('sri-documents')
            .upload(pdfPath, pdfBytes, { contentType: 'application/pdf', upsert: true });
          if (!pdfUploadError) pdfUrl = pdfPath;

          if (xmlAutorizado) {
            const xmlPath = `${organization_id}/${sri_document_id}.xml`;
            const { error: xmlUploadError } = await adminClient.storage
              .from('sri-documents')
              .upload(xmlPath, new TextEncoder().encode(xmlAutorizado), { contentType: 'application/xml', upsert: true });
            if (!xmlUploadError) xmlUrl = xmlPath;
          }
        })(),
        (async () => {
          // Si esta factura nunca había logrado enviarse por correo (por
          // ejemplo, porque el primer intento fue rechazado antes de
          // llegar a ese paso), se intenta ahora que por fin quedó
          // autorizada — best-effort, igual que en la emisión original.
          if (!shouldSendEmail) return;
          if (!customer.email) { emailStatus = 'no_email'; return; }
          const brevoConfig = await getBrevoConfig(adminClient);
          if (!brevoConfig) { emailStatus = 'not_configured'; return; }
          await sendInvoiceEmail({
            config: brevoConfig,
            to: customer.email,
            customerName: customer.socialReason,
            organizationName: org.name,
            claveAcceso: doc.clave_acceso!,
            total,
            pdfBytes,
            xmlContent: xmlAutorizado,
          });
          emailSentAt = new Date().toISOString();
          emailSentTo = customer.email;
          emailStatus = 'sent';
        })(),
      ]);
      if (storageOutcome.status === 'rejected') {
        console.error('Error guardando el RIDE en el reintento:', (storageOutcome.reason as any)?.message ?? storageOutcome.reason);
      }
      if (emailOutcome.status === 'rejected') {
        console.error('Error enviando la factura por correo en el reintento:', (emailOutcome.reason as any)?.message ?? emailOutcome.reason);
        emailStatus = 'failed';
      }
    }
  } catch (rideError: any) {
    console.error('Error generando/guardando el RIDE en el reintento:', rideError.message);
  }

  const { error: updateError } = await supabaseClient
    .from('sri_documents')
    .update({
      ...(authorizationNumber ? { authorization_number: authorizationNumber } : {}),
      ...(authorizationDate ? { authorization_date: authorizationDate } : {}),
      ...(pdfUrl ? { pdf_url: pdfUrl } : {}),
      ...(xmlUrl ? { xml_url: xmlUrl } : {}),
      ...(emailSentAt ? { email_sent_at: emailSentAt, email_sent_to: emailSentTo } : {}),
    })
    .eq('id', sri_document_id);
  if (updateError) {
    // El status AUTHORIZED ya quedó guardado arriba — un fallo acá solo
    // pierde campos de enriquecimiento, no la autorización en sí.
    console.error('Error guardando enriquecimiento del reintento:', updateError.message);
  }

  return jsonResponse({ success: true, sri_document_id, status: 'AUTHORIZED', email_status: emailStatus });
}

// ─── Reenviar manualmente el correo de una factura ya autorizada ──────────
// A diferencia del envío automático en handleEmit/handleRetry (best-effort,
// nunca bloquea la emisión), aquí un fallo de Brevo SÍ se reporta como
// error: el único propósito de esta acción es justamente enviar el correo.

async function handleResendEmail(
  supabaseClient: ReturnType<typeof createClient>,
  adminClient: ReturnType<typeof createClient>,
  body: any,
) {
  const { organization_id, sri_document_id } = body as {
    organization_id?: string;
    sri_document_id?: string;
  };
  if (!organization_id || !sri_document_id) throw new Error('Falta organization_id o sri_document_id.');

  const { data: doc, error: docError } = await supabaseClient
    .from('sri_documents')
    .select('id, status, clave_acceso, total, cliente_razon_social, cliente_email, pdf_url, xml_url')
    .eq('id', sri_document_id)
    .eq('organization_id', organization_id)
    .maybeSingle();
  if (docError) throw docError;
  if (!doc) throw new Error('Factura no encontrada en este centro.');
  if (doc.status !== 'AUTHORIZED') {
    return jsonResponse({ error: 'Solo se puede reenviar el correo de facturas autorizadas por el SRI.' }, 400);
  }
  if (!doc.pdf_url && !doc.xml_url) {
    return jsonResponse({ error: 'Este comprobante no tiene RIDE ni XML disponibles para adjuntar.' }, 400);
  }

  // A diferencia del envío automático (que usa el correo tal como estaba
  // al emitir), reenviar es una acción explícita del usuario — tiene
  // sentido que recoja el correo MÁS RECIENTE del representante, por si
  // se actualizó después de la emisión original. Si no hay
  // beneficiario/representante vinculado (ej. Consumidor Final), se usa
  // el correo ya guardado en el comprobante.
  let recipientEmail = doc.cliente_email as string | null;
  const { data: paymentLink } = await (supabaseClient as any)
    .from('internal_payments')
    .select('charges ( beneficiary_id )')
    .eq('organization_id', organization_id)
    .eq('sri_document_id', sri_document_id)
    .limit(1)
    .maybeSingle();
  const beneficiaryId = paymentLink?.charges?.beneficiary_id ?? null;
  if (beneficiaryId) {
    const { data: repLink } = await (supabaseClient as any)
      .from('beneficiary_representatives')
      .select('is_primary, representatives ( email )')
      .eq('beneficiary_id', beneficiaryId)
      .order('is_primary', { ascending: false });
    const currentEmail = repLink?.[0]?.representatives?.email;
    if (currentEmail) recipientEmail = currentEmail;
  }

  if (!recipientEmail) {
    return jsonResponse({ error: 'Este comprobante no tiene un correo de cliente registrado.' }, 400);
  }

  const { data: org } = await supabaseClient.from('organizations').select('name').eq('id', organization_id).maybeSingle();

  let pdfBytes: Uint8Array | null = null;
  if (doc.pdf_url) {
    const { data: blob, error } = await adminClient.storage.from('sri-documents').download(doc.pdf_url);
    if (!error && blob) pdfBytes = new Uint8Array(await blob.arrayBuffer());
  }
  let xmlContent: string | null = null;
  if (doc.xml_url) {
    const { data: blob, error } = await adminClient.storage.from('sri-documents').download(doc.xml_url);
    if (!error && blob) xmlContent = await blob.text();
  }
  if (!pdfBytes && !xmlContent) {
    return jsonResponse({ error: 'No se pudo recuperar el RIDE ni el XML desde el almacenamiento.' }, 502);
  }

  try {
    const brevoConfig = await getBrevoConfig(adminClient);
    if (!brevoConfig) {
      return jsonResponse(
        { error: 'El envío de correo no está configurado. Ingresa la API Key de Brevo en Configuración de Plataforma.' },
        400
      );
    }
    await sendInvoiceEmail({
      config: brevoConfig,
      to: recipientEmail,
      customerName: doc.cliente_razon_social || 'Cliente',
      organizationName: org?.name ?? '',
      claveAcceso: doc.clave_acceso!,
      total: Number(doc.total),
      pdfBytes,
      xmlContent,
    });
  } catch (emailError: any) {
    return jsonResponse({ error: 'No se pudo reenviar el correo: ' + emailError.message }, 502);
  }

  // También se actualiza cliente_email — mantiene el snapshot al día con
  // el correo que realmente funcionó, para que una próxima carga de la UI
  // o un reenvío posterior ya no dependan de resolverlo todo de nuevo.
  const { error: updateError } = await supabaseClient
    .from('sri_documents')
    .update({ email_sent_at: new Date().toISOString(), email_sent_to: recipientEmail, cliente_email: recipientEmail })
    .eq('id', sri_document_id);
  if (updateError) throw updateError;

  return jsonResponse({ success: true, sent_to: recipientEmail });
}

// ─── Upload the org's electronic signature to the reused SRI service ──────

async function handleUploadCertificate(supabaseClient: ReturnType<typeof createClient>, body: any) {
  const { organization_id, environment, establecimiento, punto_emision, p12_base64, p12_password, regimen_fiscal } = body as {
    organization_id?: string;
    environment?: string;
    establecimiento?: string;
    punto_emision?: string;
    p12_base64?: string;
    p12_password?: string;
    regimen_fiscal?: string;
  };

  if (!organization_id || !establecimiento || !punto_emision || !p12_base64 || !p12_password) {
    throw new Error('Faltan datos para subir la firma electrónica.');
  }
  const regimenFiscal = regimen_fiscal === 'general' ? 'general' : 'rimpe_negocio_popular';

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

  // Nota: verificado contra el esquema real de la API (/api-json).
  // CreateEmisorDto y UpdateEmisorDto no son el mismo shape — "ruc" solo
  // existe en el de creación (es la clave de búsqueda, no se actualiza) y
  // "estado" no hace falta forzarlo en ninguno de los dos (un emisor nuevo
  // ya nace ACTIVO). ValidationPipe con forbidNonWhitelisted rechaza
  // cualquier campo fuera de lugar, así que cada llamada usa su propio
  // payload en vez de compartir uno solo. contribuyenteRimpe aquí es
  // booleano (DTO del módulo emisores) — distinto del string legal que se
  // usa en el payload de emisión de cada factura (computeSriInvoiceTax).
  const emisorUpdatableFields = {
    razonSocial: org.name,
    nombreComercial: org.name,
    direccionMatriz: mainAddress,
    obligadoContabilidad: false,
    contribuyenteRimpe: regimenFiscal === 'rimpe_negocio_popular',
    ambiente,
  };

  let emisorId: string;
  if (existingEmisor) {
    emisorId = existingEmisor.id;
    const { ok, data } = await sriApiFetch(`/emisores/${emisorId}`, {
      method: 'PUT',
      body: JSON.stringify(emisorUpdatableFields),
    });
    if (!ok) return jsonResponse({ error: extractSriApiErrorMessage(data) }, 400);
  } else {
    const { ok, data } = await sriApiFetch('/emisores', {
      method: 'POST',
      body: JSON.stringify({ ruc: org.ruc, ...emisorUpdatableFields }),
    });
    if (!ok || !data.id) return jsonResponse({ error: extractSriApiErrorMessage(data) }, 400);
    emisorId = data.id;
  }

  // 2. Ensure the "punto de emisión" exists for that emisor. Ruta real
  // confirmada en puntos-emision.controller.ts: @Controller('emisores/puntos-emision')
  // — NO es /puntos-emision/emisor/:id (eso da 404).
  const { data: existingPuntos } = await sriApiFetch(`/emisores/puntos-emision/${emisorId}`);
  const puntosList = Array.isArray(existingPuntos) ? existingPuntos : [];
  const establecimientoPadded = establecimiento.padStart(3, '0');
  const puntoEmisionPadded = punto_emision.padStart(3, '0');
  const puntoExists = puntosList.some(
    (p: any) => p.establecimiento === establecimientoPadded && p.puntoEmision === puntoEmisionPadded
  );
  if (!puntoExists) {
    const { ok, data } = await sriApiFetch(`/emisores/puntos-emision/${emisorId}`, {
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
  // straight through to the service that will use it to sign. Reutiliza
  // sriApiFetch (ya soporta FormData) en vez de un fetch manual — mismo
  // hardening (resilientFetch) que el resto de las llamadas.
  const p12Bytes = Uint8Array.from(atob(p12_base64), (c) => c.charCodeAt(0));
  const formData = new FormData();
  formData.append('ruc', org.ruc);
  formData.append('password', p12_password);
  formData.append('cert', new Blob([p12Bytes], { type: 'application/x-pkcs12' }), 'certificado.p12');

  const { ok: uploadOk, data: uploadData } = await sriApiFetch('/certificates/upload-cert', {
    method: 'POST',
    body: formData,
  });
  if (!uploadOk) {
    return jsonResponse({ error: extractSriApiErrorMessage(uploadData) }, 400);
  }
  // El endpoint puede responder 201 success:true aunque el vínculo
  // certificado↔emisor por RUC haya fallado silenciosamente (es opcional
  // y no bloqueante del lado de la API — ver certificate.controller.ts).
  // Sin este chequeo podríamos marcar "firma subida" sin que el
  // certificado esté realmente disponible para firmar.
  if (uploadData?.data?.emisorBindingWarning) {
    return jsonResponse(
      { error: `El certificado se validó pero no se pudo vincular al emisor: ${uploadData.data.emisorBindingWarning}` },
      400
    );
  }
  if (!uploadData?.data?.emisorBinding) {
    return jsonResponse(
      { error: 'El certificado se subió pero el servicio no confirmó su vínculo con el emisor. Intenta de nuevo.' },
      400
    );
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
      regimen_fiscal: regimenFiscal,
      cert_uploaded_at: new Date().toISOString(),
      sri_api_emisor_id: emisorId,
    },
    { onConflict: 'organization_id' }
  );
  if (upsertError) throw upsertError;

  return jsonResponse({ success: true });
}
