import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { X, Receipt, Plus, Calendar, DollarSign, CreditCard, Download, Send, Loader2, FileCheck, RotateCcw, FileX, Mail, Ban } from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '../../lib/supabase';
import { formatDate } from '../../lib/formatDate';
import { toWhatsAppNumber } from '../../lib/phone';
import { downloadReceiptPdf, uploadReceiptAndGetSignedUrl } from './ReceiptDocument';
import type { ReceiptOrganization } from './ReceiptDocument';

export type Payment = {
  id: string;
  charge_id: string;
  amount: number;
  payment_date: string;
  method: string;
  reference: string | null;
  notes?: string | null;
  sri_document_id?: string | null;
  sri_documents?: { status: string; pdf_url: string | null; cliente_email: string | null; email_sent_at: string | null } | null;
  voided_at?: string | null;
  voided_reason?: string | null;
};

// ─── Anular un pago individual (no el cargo completo) ──────────────────────
// Soft-delete: nunca se borra la fila, solo se marca voided_at — preserva
// el historial (mismo principio del dominio ya aplicado a beneficiarios y
// miembros). El trigger prevent_void_payment_with_authorized_invoice
// (migración 20260824110000) bloquea del lado de la base de datos anular
// un pago con una factura ya AUTORIZADA — este chequeo del lado del
// cliente es solo para dar feedback inmediato, no la única protección.

export async function voidPayment(paymentId: string, reason?: string): Promise<boolean> {
  const { error } = await supabase
    .from('internal_payments')
    .update({ voided_at: new Date().toISOString(), voided_reason: reason?.trim() || null })
    .eq('id', paymentId);
  if (error) {
    toast.error('No se pudo anular el pago: ' + error.message, { duration: 6000 });
    return false;
  }
  toast.success('Pago anulado.');
  return true;
}

// ─── Factura electrónica: badge + "Ver factura" / "Reintentar" / correo ───
// Compartido entre el historial de pagos de este modal y el módulo de
// Facturas — un pago solo tiene esto si alguna vez se intentó facturar
// (sri_document_id no nulo), sea que haya quedado autorizada o rechazada.

export function InvoiceStatusBadge({ status }: { status: string }) {
  if (status === 'AUTHORIZED') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200">
        <FileCheck className="w-3 h-3" /> Facturada
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold text-red-700 bg-red-50 border border-red-200">
      <FileX className="w-3 h-3" /> Rechazada por el SRI
    </span>
  );
}

export async function openInvoicePdf(pdfUrl: string) {
  const { data, error } = await supabase.storage.from('sri-documents').createSignedUrl(pdfUrl, 120);
  if (error || !data) {
    toast.error('No se pudo abrir la factura: ' + (error?.message || 'error desconocido'));
    return;
  }
  window.open(data.signedUrl, '_blank', 'noopener,noreferrer');
}

// supabase.functions.invoke() solo llena `data` en una respuesta 2xx — en
// una respuesta no-2xx, error.message es un texto genérico y el cuerpo
// real { error: "...", sri_document_id?: "..." } hay que leerlo de
// error.context en su lugar. parseEdgeFunctionErrorBody devuelve el
// cuerpo completo (no solo el mensaje) — RegisterPaymentModal lo necesita
// para decidir si hubo o no un sri_document_id (ver más abajo).
export async function parseEdgeFunctionErrorBody(data: any, error: any): Promise<any> {
  if (data && typeof data === 'object') return data;
  if (error?.context) {
    try {
      const body = await error.context.text();
      const parsed = JSON.parse(body);
      if (parsed && typeof parsed === 'object') return parsed;
    } catch { /* keep falling through to the generic message */ }
  }
  return { error: error?.message || 'Error desconocido.' };
}

// Compartido por retryInvoice/resendInvoiceEmail y por
// InvoiceEnrollmentModal, para no duplicar este desempaquetado.
export async function extractEdgeFunctionError(data: any, error: any): Promise<string> {
  const parsed = await parseEdgeFunctionErrorBody(data, error);
  return parsed?.error || 'Error desconocido.';
}

// email_status viene de handleEmit/handleRetry — distingue si la factura
// se envió por correo, y si no, por qué (para poder decírselo al usuario
// en vez de un silencio).
export function describeEmailStatus(emailStatus?: string): { message: string; tone: 'success' | 'info' | 'error' } | null {
  switch (emailStatus) {
    case 'sent':
      return { message: 'Factura enviada por correo al cliente.', tone: 'success' };
    case 'no_email':
      return { message: 'No se envió por correo: el representante no tiene un email registrado.', tone: 'info' };
    case 'not_configured':
      return { message: 'No se envió por correo: el envío de facturas no está configurado todavía (Configuración de Plataforma).', tone: 'info' };
    case 'failed':
      return { message: 'No se pudo enviar la factura por correo — puedes reintentarlo desde el módulo Facturas.', tone: 'error' };
    default:
      return null;
  }
}

export function showEmailStatusToast(emailStatus?: string) {
  const info = describeEmailStatus(emailStatus);
  if (!info) return;
  if (info.tone === 'error') toast.error(info.message, { duration: 6000 });
  else if (info.tone === 'success') toast.success(info.message, { duration: 4000 });
  else toast(info.message, { duration: 5000, icon: 'ℹ️' });
}

export async function retryInvoice(organizationId: string, sriDocumentId: string): Promise<boolean> {
  const { data, error } = await supabase.functions.invoke('electronic-billing', {
    body: { action: 'retry', organization_id: organizationId, sri_document_id: sriDocumentId },
  });
  if (error || (data as any)?.error) {
    const message = await extractEdgeFunctionError(data, error);
    toast.error('No se pudo reintentar la factura: ' + message, { duration: 6000 });
    return false;
  }
  toast.success('Factura autorizada por el SRI.');
  return true;
}

export async function resendInvoiceEmail(organizationId: string, sriDocumentId: string): Promise<boolean> {
  const { data, error } = await supabase.functions.invoke('electronic-billing', {
    body: { action: 'resend_email', organization_id: organizationId, sri_document_id: sriDocumentId },
  });
  if (error || (data as any)?.error) {
    const message = await extractEdgeFunctionError(data, error);
    toast.error('No se pudo enviar el correo: ' + message, { duration: 6000 });
    return false;
  }
  toast.success('Factura enviada por correo.');
  return true;
}

export type PrimaryRepresentative = { id: string; name: string; phone: string | null; identification: string | null };

export async function fetchPrimaryRepresentative(beneficiaryId: string): Promise<PrimaryRepresentative | null> {
  const { data } = await supabase
    .from('beneficiary_representatives')
    .select('is_primary, representatives ( id, first_name, last_name, phone, identification )')
    .eq('beneficiary_id', beneficiaryId)
    .order('is_primary', { ascending: false });
  const rep = (data as any)?.[0]?.representatives ?? null;
  if (!rep) return null;
  return { id: rep.id, name: `${rep.first_name} ${rep.last_name}`, phone: rep.phone, identification: rep.identification };
}

// ─── Resuelve el representante principal de un beneficiario y si tiene
// cédula registrada — usado para bloquear la emisión de factura hasta que
// el usuario resuelva la cédula o elija explícitamente facturar como
// Consumidor Final. `beneficiaryId` ausente (ej. un cobro general sin
// beneficiario vinculado) también cuenta como "sin identificación": hoy
// ese caso ya caía en Consumidor Final siempre, y debe pasar por el mismo
// control.

export function useComprobanteComprador(beneficiaryId: string | undefined) {
  const [representative, setRepresentative] = useState<PrimaryRepresentative | null>(null);
  const [loading, setLoading] = useState(Boolean(beneficiaryId));

  useEffect(() => {
    if (!beneficiaryId) { setRepresentative(null); setLoading(false); return; }
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const rep = await fetchPrimaryRepresentative(beneficiaryId);
        if (!cancelled) setRepresentative(rep);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [beneficiaryId]);

  return { representative, loading, hasIdentification: Boolean(representative?.identification) };
}

type Props = {
  isOpen: boolean;
  onClose: () => void;
  charge: any; // Using any for simplicity or you can pass Charge type
  payments: Payment[];
  onPayRemaining: (charge: any) => void;
  organization: ReceiptOrganization & { id: string };
  beneficiaryId: string;
  beneficiaryName: string;
  onInvoiceChanged?: () => void;
};

export function PaymentDetailModal({ isOpen, onClose, charge, payments, onPayRemaining, organization, beneficiaryId, beneficiaryName, onInvoiceChanged }: Props) {
  const navigate = useNavigate();
  const [representative, setRepresentative] = useState<PrimaryRepresentative | null>(null);
  const [loadingRep, setLoadingRep] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [retryingId, setRetryingId] = useState<string | null>(null);
  const [resendingId, setResendingId] = useState<string | null>(null);
  const [voidingId, setVoidingId] = useState<string | null>(null);

  const handleVoidPayment = async (payment: Payment) => {
    const confirmed = window.confirm(
      `¿Anular este pago de $${Number(payment.amount).toFixed(2)}? El saldo pendiente del cobro se recalculará. Esta acción no se puede deshacer.`
    );
    if (!confirmed) return;
    setVoidingId(payment.id);
    try {
      const succeeded = await voidPayment(payment.id);
      if (succeeded) onInvoiceChanged?.();
    } finally {
      setVoidingId(null);
    }
  };

  const handleRetryInvoice = async (sriDocumentId: string) => {
    setRetryingId(sriDocumentId);
    try {
      const succeeded = await retryInvoice(organization.id, sriDocumentId);
      if (succeeded) onInvoiceChanged?.();
    } finally {
      setRetryingId(null);
    }
  };

  const handleResendInvoiceEmail = async (sriDocumentId: string) => {
    setResendingId(sriDocumentId);
    try {
      await resendInvoiceEmail(organization.id, sriDocumentId);
    } finally {
      setResendingId(null);
    }
  };

  // Hooks must run unconditionally on every render — the early return below
  // (this modal stays mounted and toggles via `isOpen`) can't come before them.
  useEffect(() => {
    if (!isOpen || !beneficiaryId) { setRepresentative(null); return; }
    let cancelled = false;

    (async () => {
      setLoadingRep(true);
      try {
        const rep = await fetchPrimaryRepresentative(beneficiaryId);
        if (!cancelled) setRepresentative(rep);
      } finally {
        if (!cancelled) setLoadingRep(false);
      }
    })();

    return () => { cancelled = true; };
  }, [isOpen, beneficiaryId]);

  if (!isOpen || !charge) return null;

  const totalPaid = payments.filter(p => !p.voided_at).reduce((sum, p) => sum + Number(p.amount), 0);
  const remaining = Math.max(0, charge.amount - totalPaid);

  const getMethodLabel = (method: string) => {
    switch (method) {
      case 'cash': return 'Efectivo';
      case 'transfer': return 'Transferencia';
      case 'card': return 'Tarjeta';
      default: return method;
    }
  };

  const statusBadge = (status: string) => {
    // "Pendiente" y "Parcial" se muestran igual — desde el cargo, ambos
    // significan lo mismo: todavía se debe algo (ver CobrosModule.tsx).
    if (status === 'pending' || status === 'partial')
      return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200">Pendiente</span>;
    if (status === 'paid')
      return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200">Pagado</span>;
    if (status === 'void')
      return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold text-slate-700 bg-slate-100 border border-slate-200">Anulado</span>;
    return null;
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-200">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-600 flex items-center justify-center">
              <Receipt className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-900">Detalle del Cobro</h3>
              <p className="text-sm text-slate-500 flex items-center gap-2">
                {charge.description} {statusBadge(charge.status)}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:bg-slate-100 hover:text-slate-600 p-2 rounded-xl transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-6">

          {/* Summary Cards */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
              <p className="text-xs text-slate-500 font-medium mb-1">Monto Total</p>
              <p className="text-lg font-bold text-slate-900">${Number(charge.amount).toFixed(2)}</p>
            </div>
            <div className="bg-emerald-50 rounded-xl p-3 border border-emerald-100">
              <p className="text-xs text-emerald-600 font-medium mb-1">Pagado</p>
              <p className="text-lg font-bold text-emerald-700">${totalPaid.toFixed(2)}</p>
            </div>
            <div className={`rounded-xl p-3 border ${remaining > 0 ? 'bg-amber-50 border-amber-100' : 'bg-slate-50 border-slate-100'}`}>
              <p className={`text-xs font-medium mb-1 ${remaining > 0 ? 'text-amber-700' : 'text-slate-500'}`}>Saldo Pendiente</p>
              <p className={`text-lg font-bold ${remaining > 0 ? 'text-amber-700' : 'text-slate-900'}`}>${remaining.toFixed(2)}</p>
            </div>
          </div>

          {/* Payment History */}
          <div>
            <h4 className="text-sm font-semibold text-slate-900 mb-3">Historial de Pagos</h4>
            {payments.length === 0 ? (
              <div className="text-center py-6 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                <p className="text-sm text-slate-500">No hay pagos registrados para este cobro.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {payments.map((payment) => {
                  const isDownloading = downloadingId === payment.id;
                  const isSending = sendingId === payment.id;
                  const whatsappNumber = toWhatsAppNumber(representative?.phone ?? null);
                  const receiptData = {
                    organization,
                    beneficiaryName,
                    chargeDescription: charge.description,
                    payment: {
                      id: payment.id,
                      amount: Number(payment.amount),
                      payment_date: payment.payment_date,
                      method: payment.method,
                      reference: payment.reference,
                      notes: payment.notes,
                    },
                  };

                  const handleDownload = async () => {
                    setDownloadingId(payment.id);
                    try {
                      await downloadReceiptPdf(receiptData);
                    } catch (err: any) {
                      toast.error('Error generando el recibo: ' + err.message);
                    } finally {
                      setDownloadingId(null);
                    }
                  };

                  const handleSend = async () => {
                    if (!whatsappNumber) return;
                    setSendingId(payment.id);
                    try {
                      const url = await uploadReceiptAndGetSignedUrl(receiptData, organization.id);
                      const firstName = representative?.name.split(' ')[0] ?? '';
                      const message = `Hola${firstName ? ' ' + firstName : ''}, aquí tienes el recibo de pago de ${beneficiaryName} por $${Number(payment.amount).toFixed(2)} (${formatDate(payment.payment_date)}):\n${url}`;
                      window.open(`https://wa.me/${whatsappNumber}?text=${encodeURIComponent(message)}`, '_blank', 'noopener,noreferrer');
                    } catch (err: any) {
                      toast.error('Error enviando el recibo: ' + err.message);
                    } finally {
                      setSendingId(null);
                    }
                  };

                  const goAddPhone = () => {
                    onClose();
                    navigate(representative ? `/app/representantes?edit=${representative.id}` : `/app/beneficiarios/${beneficiaryId}`);
                  };

                  const isVoided = Boolean(payment.voided_at);
                  const hasAuthorizedInvoice = payment.sri_document_id && payment.sri_documents?.status === 'AUTHORIZED';

                  return (
                    <div key={payment.id} className={`flex items-center justify-between gap-3 p-3 rounded-xl bg-white border shadow-sm transition-colors ${isVoided ? 'border-slate-100 opacity-60' : 'border-slate-100 hover:border-slate-200'}`}>
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
                          <DollarSign className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <p className={`text-sm font-medium text-slate-900 ${isVoided ? 'line-through' : ''}`}>
                            Abono en {getMethodLabel(payment.method)}
                          </p>
                          <div className="flex items-center gap-2 text-xs text-slate-500">
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              {formatDate(payment.payment_date)}
                            </span>
                            {payment.reference && (
                              <span className="flex items-center gap-1">
                                <CreditCard className="w-3 h-3" /> Ref: {payment.reference}
                              </span>
                            )}
                          </div>
                          <div className="mt-1 flex items-center gap-1.5">
                            {isVoided && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold text-slate-600 bg-slate-100 border border-slate-200">
                                <Ban className="w-3 h-3" /> Anulado
                              </span>
                            )}
                            {payment.sri_document_id && payment.sri_documents && (
                              <InvoiceStatusBadge status={payment.sri_documents.status} />
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 shrink-0">
                        <span className={`font-semibold text-slate-900 ${isVoided ? 'line-through text-slate-400' : ''}`}>
                          ${Number(payment.amount).toFixed(2)}
                        </span>

                        <div className="flex items-center gap-1 border-l border-slate-100 pl-3">
                          {payment.sri_document_id && payment.sri_documents?.status === 'AUTHORIZED' && (
                            <button
                              onClick={() => payment.sri_documents!.pdf_url && openInvoicePdf(payment.sri_documents!.pdf_url)}
                              disabled={!payment.sri_documents.pdf_url}
                              title={payment.sri_documents.pdf_url ? 'Ver factura (RIDE)' : 'El RIDE aún no está disponible'}
                              className="text-slate-500 hover:text-emerald-700 hover:bg-emerald-50 p-1.5 rounded-lg transition-colors disabled:opacity-40 cursor-pointer"
                            >
                              <FileCheck className="w-4 h-4" />
                            </button>
                          )}
                          {payment.sri_document_id && payment.sri_documents?.status === 'AUTHORIZED' && (
                            payment.sri_documents.cliente_email ? (
                              <button
                                onClick={() => handleResendInvoiceEmail(payment.sri_document_id!)}
                                disabled={resendingId === payment.sri_document_id}
                                title={payment.sri_documents.email_sent_at ? 'Reenviar factura por correo' : 'Enviar factura por correo'}
                                className="text-slate-500 hover:text-indigo-700 hover:bg-indigo-50 p-1.5 rounded-lg transition-colors disabled:opacity-50 cursor-pointer"
                              >
                                {resendingId === payment.sri_document_id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
                              </button>
                            ) : (
                              <span title="Sin correo del cliente registrado — no se puede enviar" className="text-slate-300 p-1.5">
                                <Mail className="w-4 h-4" />
                              </span>
                            )
                          )}
                          {payment.sri_document_id && payment.sri_documents && payment.sri_documents.status !== 'AUTHORIZED' && (
                            <button
                              onClick={() => handleRetryInvoice(payment.sri_document_id!)}
                              disabled={retryingId === payment.sri_document_id}
                              title="Reintentar factura electrónica"
                              className="text-slate-500 hover:text-amber-700 hover:bg-amber-50 p-1.5 rounded-lg transition-colors disabled:opacity-50 cursor-pointer"
                            >
                              {retryingId === payment.sri_document_id ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />}
                            </button>
                          )}

                          <button
                            onClick={handleDownload}
                            disabled={isDownloading}
                            title="Descargar recibo"
                            className="text-slate-500 hover:text-indigo-700 hover:bg-indigo-50 p-1.5 rounded-lg transition-colors disabled:opacity-50 cursor-pointer"
                          >
                            {isDownloading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                          </button>

                          {loadingRep ? (
                            <div className="w-7 h-7 flex items-center justify-center">
                              <Loader2 className="w-3.5 h-3.5 text-slate-300 animate-spin" />
                            </div>
                          ) : whatsappNumber ? (
                            <button
                              onClick={handleSend}
                              disabled={isSending}
                              title={`Enviar recibo por WhatsApp a ${representative?.name}`}
                              className="text-slate-500 hover:text-emerald-700 hover:bg-emerald-50 p-1.5 rounded-lg transition-colors disabled:opacity-50 cursor-pointer"
                            >
                              {isSending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                            </button>
                          ) : !beneficiaryId ? (
                            <span
                              title="Cobro sin beneficiario vinculado — no se puede enviar por WhatsApp"
                              className="text-slate-300 p-1.5"
                            >
                              <Send className="w-4 h-4" />
                            </span>
                          ) : (
                            <button
                              onClick={goAddPhone}
                              title={representative ? 'Sin número de WhatsApp registrado — agregar número' : 'Sin representante vinculado — agregar uno'}
                              className="text-[10px] font-semibold text-amber-700 hover:text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-200 px-2 py-1 rounded-lg transition-colors whitespace-nowrap cursor-pointer"
                            >
                              Sin WhatsApp
                            </button>
                          )}

                          {!isVoided && (
                            <button
                              onClick={() => handleVoidPayment(payment)}
                              disabled={voidingId === payment.id || Boolean(hasAuthorizedInvoice)}
                              title={hasAuthorizedInvoice ? 'No se puede anular — tiene una factura autorizada por el SRI' : 'Anular este pago'}
                              className="text-slate-500 hover:text-red-600 hover:bg-red-50 p-1.5 rounded-lg transition-colors disabled:opacity-30 cursor-pointer"
                            >
                              {voidingId === payment.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Ban className="w-4 h-4" />}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
          <p className="text-xs text-slate-500">
            {charge.beneficiaries ? `Beneficiario: ${charge.beneficiaries.first_name} ${charge.beneficiaries.last_name}` : 'Cobro general'}
          </p>
          <div className="flex gap-2">
            {remaining > 0 && charge.status !== 'void' && (
              <button
                onClick={() => {
                  onClose();
                  onPayRemaining(charge);
                }}
                className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-xl hover:bg-indigo-700 shadow-sm transition-all cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                Registrar Pago
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}

// ─── Register Payment ───────────────────────────────────────────────────────
// Shared by CobrosModule and the beneficiary detail page — one form, one
// insert path, so a payment always has method + a mandatory date regardless
// of where it was registered from.

export type ChargeForPayment = {
  id: string;
  organization_id: string;
  description: string;
  amount: number;
};

type RegisterPaymentModalProps = {
  charge: ChargeForPayment;
  paidSoFar: number;
  onClose: () => void;
  onSuccess: () => void;
  hasElectronicBilling?: boolean;
  beneficiaryId?: string;
};

export function RegisterPaymentModal({ charge, paidSoFar, onClose, onSuccess, hasElectronicBilling, beneficiaryId }: RegisterPaymentModalProps) {
  const remaining = Math.max(0, charge.amount - paidSoFar);
  const [amount, setAmount] = useState<number | ''>(remaining);
  const [method, setMethod] = useState('cash');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [reference, setReference] = useState('');
  const [submittingAction, setSubmittingAction] = useState<'save' | 'invoice' | null>(null);
  const [allowConsumidorFinal, setAllowConsumidorFinal] = useState(false);
  const { loading: repLoading, hasIdentification } = useComprobanteComprador(beneficiaryId);

  const validate = (): boolean => {
    if (!amount || Number(amount) <= 0) { toast.error('Ingresa un monto válido.'); return false; }
    if (Number(amount) > remaining) { toast.error(`El abono no puede superar el saldo pendiente de $${remaining.toFixed(2)}.`); return false; }
    if (!date) { toast.error('La fecha de pago es obligatoria.'); return false; }
    return true;
  };

  // Shared by both buttons — inserts the payment and returns its id, or
  // null if validation/insert failed (already toasted).
  const insertPayment = async (): Promise<string | null> => {
    const { data, error } = await supabase
      .from('internal_payments')
      .insert({
        organization_id: charge.organization_id,
        charge_id: charge.id,
        amount: Number(amount),
        payment_date: date,
        method,
        reference: reference.trim() || null,
      })
      .select('id')
      .single();
    if (error || !data) {
      toast.error('Error registrando pago: ' + error?.message);
      return null;
    }
    return data.id;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setSubmittingAction('save');
    try {
      const paymentId = await insertPayment();
      if (!paymentId) return;
      toast.success('Pago registrado correctamente.');
      onSuccess();
      onClose();
    } finally {
      setSubmittingAction(null);
    }
  };

  const handleSaveAndInvoice = async () => {
    if (!validate()) return;
    setSubmittingAction('invoice');
    try {
      const paymentId = await insertPayment();
      if (!paymentId) return;

      const { data, error } = await supabase.functions.invoke('electronic-billing', {
        body: {
          organization_id: charge.organization_id,
          internal_payment_ids: [paymentId],
          allow_consumidor_final: allowConsumidorFinal,
        },
      });

      if (error || (data as any)?.error) {
        const parsed = await parseEdgeFunctionErrorBody(data, error);
        const message = parsed?.error || 'Error desconocido.';
        if (!parsed?.sri_document_id) {
          // El intento nunca llegó a registrarse (ni siquiera rechazado
          // por el SRI) — "Guardar y Facturar" es todo o nada: se revierte
          // el pago recién insertado en vez de dejarlo huérfano sin factura.
          await supabase.from('internal_payments').delete().eq('id', paymentId);
          toast.error('No se pudo facturar — el pago NO se guardó: ' + message, { duration: 7000 });
        } else {
          // El SRI sí respondió (lo rechazó) y ya quedó registrado y
          // vinculado — el pago se conserva para poder reintentar.
          toast.error('El pago se guardó, pero el SRI rechazó la factura: ' + message, { duration: 7000 });
        }
      } else {
        toast.success('Pago guardado y factura electrónica autorizada por el SRI.', { duration: 4000 });
        showEmailStatusToast((data as any)?.email_status);
      }
      onSuccess();
      onClose();
    } finally {
      setSubmittingAction(null);
    }
  };

  const invoiceBlocked = Boolean(hasElectronicBilling) && !repLoading && !hasIdentification && !allowConsumidorFinal;

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xl p-6 w-full max-w-md">
        <div className="flex justify-between items-center mb-4 border-b border-slate-100 pb-3">
          <h3 className="text-lg font-bold text-slate-900">Registrar Pago Interno</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="mb-4 bg-slate-50 p-3 rounded-lg border border-slate-200">
          <p className="text-xs text-slate-500 font-semibold uppercase">Concepto</p>
          <p className="text-sm font-bold text-slate-900">{charge.description}</p>
          <div className="flex justify-between mt-2 text-xs">
            <span className="text-slate-500">Monto total: ${charge.amount.toFixed(2)}</span>
            <span className="text-amber-700 font-semibold">Pendiente: ${remaining.toFixed(2)}</span>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Monto a Pagar (USD) *</label>
            <input
              type="number"
              step="0.01"
              min="0.01"
              max={remaining}
              value={amount}
              onChange={(e) => setAmount(e.target.value === '' ? '' : Number(e.target.value))}
              required
              className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Método de Pago</label>
              <select
                value={method}
                onChange={(e) => setMethod(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="cash">Efectivo</option>
                <option value="transfer">Transferencia</option>
                <option value="card">Tarjeta</option>
                <option value="other">Otro</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Fecha de Pago *</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
                max={new Date().toISOString().split('T')[0]}
                className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Referencia / Comprobante</label>
            <input
              type="text"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder="Ej. Transf #12345"
              className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          {hasElectronicBilling && !repLoading && !hasIdentification && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-800 space-y-2">
              <p>El representante no tiene cédula registrada — no se puede emitir la factura a su nombre.</p>
              <label className="flex items-center gap-2 font-semibold cursor-pointer">
                <input
                  type="checkbox"
                  checked={allowConsumidorFinal}
                  onChange={(e) => setAllowConsumidorFinal(e.target.checked)}
                  className="h-4 w-4 rounded border-amber-300 text-amber-600 focus:ring-amber-500"
                />
                Facturar como Consumidor Final
              </label>
            </div>
          )}

          <div className="flex flex-wrap justify-center gap-3 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              disabled={submittingAction !== null}
              className="px-4 py-2 text-sm font-semibold text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={submittingAction !== null}
              className="inline-flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2 rounded-lg text-sm font-semibold shadow-sm transition-colors disabled:opacity-50"
            >
              {submittingAction === 'save' && <Loader2 className="w-4 h-4 animate-spin" />}
              {submittingAction === 'save' ? 'Registrando...' : 'Confirmar Pago'}
            </button>
            {hasElectronicBilling && (
              <button
                type="button"
                onClick={handleSaveAndInvoice}
                disabled={submittingAction !== null || repLoading || invoiceBlocked}
                title={invoiceBlocked ? 'Falta la cédula del comprador — activa "Facturar como Consumidor Final" para continuar' : 'Guarda el pago y emite de una vez la factura electrónica de este abono'}
                className="inline-flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2 rounded-lg text-sm font-semibold shadow-sm transition-colors disabled:opacity-50"
              >
                {submittingAction === 'invoice' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Receipt className="w-4 h-4" />}
                {submittingAction === 'invoice' ? 'Facturando...' : 'Guardar y Facturar'}
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
