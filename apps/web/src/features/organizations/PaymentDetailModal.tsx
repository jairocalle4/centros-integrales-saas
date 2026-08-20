import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { X, Receipt, Plus, Calendar, DollarSign, CreditCard, Download, Send, Loader2 } from 'lucide-react';
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
};

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

type Props = {
  isOpen: boolean;
  onClose: () => void;
  charge: any; // Using any for simplicity or you can pass Charge type
  payments: Payment[];
  onPayRemaining: (charge: any) => void;
  organization: ReceiptOrganization & { id: string };
  beneficiaryId: string;
  beneficiaryName: string;
};

export function PaymentDetailModal({ isOpen, onClose, charge, payments, onPayRemaining, organization, beneficiaryId, beneficiaryName }: Props) {
  const navigate = useNavigate();
  const [representative, setRepresentative] = useState<PrimaryRepresentative | null>(null);
  const [loadingRep, setLoadingRep] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [sendingId, setSendingId] = useState<string | null>(null);

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

  const totalPaid = payments.reduce((sum, p) => sum + Number(p.amount), 0);
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
    if (status === 'pending')
      return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200">Pendiente</span>;
    if (status === 'partial')
      return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold text-blue-700 bg-blue-50 border border-blue-200">Parcial</span>;
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

                  return (
                    <div key={payment.id} className="flex items-center justify-between gap-3 p-3 rounded-xl bg-white border border-slate-100 shadow-sm hover:border-slate-200 transition-colors">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
                          <DollarSign className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-slate-900">
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
                        </div>
                      </div>

                      <div className="flex items-center gap-3 shrink-0">
                        <span className="font-semibold text-slate-900">
                          ${Number(payment.amount).toFixed(2)}
                        </span>

                        <div className="flex items-center gap-1 border-l border-slate-100 pl-3">
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

      const representative = beneficiaryId ? await fetchPrimaryRepresentative(beneficiaryId) : null;
      const { data, error } = await supabase.functions.invoke('electronic-billing', {
        body: {
          organization_id: charge.organization_id,
          internal_payment_ids: [paymentId],
          cliente_identificacion: representative?.identification || undefined,
        },
      });

      if (error || (data as any)?.error) {
        toast.error(
          'El pago se guardó, pero no se pudo facturar: ' + ((data as any)?.error || error?.message),
          { duration: 6000 }
        );
      } else {
        toast.success('Pago guardado y factura electrónica emitida (simulación Sprint 0).', { duration: 4000 });
      }
      onSuccess();
      onClose();
    } finally {
      setSubmittingAction(null);
    }
  };

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
              className="bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2 rounded-lg text-sm font-semibold shadow-sm transition-colors disabled:opacity-50"
            >
              {submittingAction === 'save' ? 'Registrando...' : 'Confirmar Pago'}
            </button>
            {hasElectronicBilling && (
              <button
                type="button"
                onClick={handleSaveAndInvoice}
                disabled={submittingAction !== null}
                title="Guarda el pago y emite de una vez la factura electrónica de este abono"
                className="inline-flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2 rounded-lg text-sm font-semibold shadow-sm transition-colors disabled:opacity-50"
              >
                <Receipt className="w-4 h-4" />
                {submittingAction === 'invoice' ? 'Facturando...' : 'Guardar y Facturar'}
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
