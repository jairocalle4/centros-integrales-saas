import { useState, useEffect } from 'react';
import { X, Receipt, FileCheck, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '../../lib/supabase';
import { formatDate } from '../../lib/formatDate';
import { useComprobanteComprador, extractEdgeFunctionError, showEmailStatusToast } from './PaymentDetailModal';

type PendingPayment = {
  id: string;
  amount: number;
  payment_date: string;
  method: string;
  reference: string | null;
};

function methodLabel(method: string): string {
  switch (method) {
    case 'cash': return 'Efectivo';
    case 'transfer': return 'Transferencia';
    case 'card': return 'Tarjeta';
    default: return method || 'Otro';
  }
}

type Props = {
  enrollmentId: string;
  organizationId: string;
  beneficiaryId: string;
  beneficiaryName: string;
  onClose: () => void;
  onSuccess: () => void;
};

export function InvoiceEnrollmentModal({ enrollmentId, organizationId, beneficiaryId, beneficiaryName, onClose, onSuccess }: Props) {
  const [payments, setPayments] = useState<PendingPayment[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [allowConsumidorFinal, setAllowConsumidorFinal] = useState(false);
  const { loading: repLoading, hasIdentification } = useComprobanteComprador(beneficiaryId);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const { data, error } = await (supabase as any)
          .from('internal_payments')
          .select('id, amount, payment_date, method, reference, charges!inner(enrollment_id)')
          .eq('organization_id', organizationId)
          .eq('charges.enrollment_id', enrollmentId)
          .is('sri_document_id', null)
          .order('payment_date', { ascending: true });
        if (error) throw error;
        if (cancelled) return;
        const rows: PendingPayment[] = (data ?? []).map((p: any) => ({
          id: p.id,
          amount: Number(p.amount),
          payment_date: p.payment_date,
          method: p.method,
          reference: p.reference,
        }));
        setPayments(rows);
        setSelectedIds(new Set(rows.map(r => r.id))); // default: all pending selected
      } catch (err: any) {
        toast.error('Error cargando pagos pendientes de facturar: ' + err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [organizationId, enrollmentId]);

  const toggle = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const total = payments
    .filter(p => selectedIds.has(p.id))
    .reduce((sum, p) => sum + p.amount, 0);

  const invoiceBlocked = !repLoading && !hasIdentification && !allowConsumidorFinal;

  const handleSubmit = async () => {
    if (selectedIds.size === 0) return;
    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke('electronic-billing', {
        body: {
          organization_id: organizationId,
          internal_payment_ids: Array.from(selectedIds),
          allow_consumidor_final: allowConsumidorFinal,
        },
      });
      if (error || (data as any)?.error) {
        throw new Error(await extractEdgeFunctionError(data, error));
      }
      toast.success(`Factura electrónica por $${total.toFixed(2)} autorizada por el SRI.`, { duration: 4000 });
      showEmailStatusToast((data as any)?.email_status);
      onSuccess();
      onClose();
    } catch (err: any) {
      toast.error('Error al facturar: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 overflow-y-auto animate-fadeIn">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-lg my-8 overflow-hidden animate-popIn flex flex-col max-h-[85vh]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50 shrink-0">
          <div className="flex items-center gap-2">
            <Receipt className="w-5 h-5 text-indigo-600" />
            <div>
              <h3 className="text-lg font-bold text-slate-900">Facturar Inscripción</h3>
              <p className="text-xs text-slate-500">{beneficiaryName}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 p-6">
          {loading ? (
            <div className="p-10 text-center text-slate-400 animate-pulse text-sm">Cargando pagos pendientes...</div>
          ) : payments.length === 0 ? (
            <div className="py-10 text-center">
              <FileCheck className="w-10 h-10 text-emerald-300 mx-auto mb-3" />
              <p className="font-semibold text-slate-700">No hay pagos pendientes de facturar</p>
              <p className="text-sm text-slate-400 mt-1">Todos los abonos de esta inscripción ya tienen factura electrónica.</p>
            </div>
          ) : (
            <>
              <p className="text-xs text-slate-500 mb-3">
                Por defecto se seleccionan todos los pagos aún no facturados de esta inscripción. Desmarca los que no quieras incluir en esta factura.
              </p>
              <div className="space-y-2">
                {payments.map(p => (
                  <label
                    key={p.id}
                    className="flex items-center gap-3 p-3 rounded-xl border border-slate-100 hover:bg-slate-50 transition-colors cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={selectedIds.has(p.id)}
                      onChange={() => toggle(p.id)}
                      className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-600"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-900">Abono en {methodLabel(p.method)}</p>
                      <p className="text-xs text-slate-500">
                        {formatDate(p.payment_date)}
                        {p.reference && <> · Ref: {p.reference}</>}
                      </p>
                    </div>
                    <span className="font-semibold text-slate-900">${p.amount.toFixed(2)}</span>
                  </label>
                ))}
              </div>

              {!repLoading && !hasIdentification && (
                <div className="mt-4 bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-800 space-y-2">
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
            </>
          )}
        </div>

        {payments.length > 0 && (
          <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between shrink-0">
            <div>
              <p className="text-xs text-slate-500">Total a facturar ({selectedIds.size} pago{selectedIds.size !== 1 ? 's' : ''})</p>
              <p className="text-xl font-bold text-slate-900">${total.toFixed(2)}</p>
            </div>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={onClose}
                disabled={submitting}
                className="px-4 py-2 text-sm font-semibold text-slate-600 hover:text-slate-900 transition-colors disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={submitting || repLoading || selectedIds.size === 0 || invoiceBlocked}
                title={invoiceBlocked ? 'Falta la cédula del comprador — activa "Facturar como Consumidor Final" para continuar' : undefined}
                className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2 rounded-lg text-sm font-semibold shadow-sm transition-colors disabled:opacity-50"
              >
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Receipt className="w-4 h-4" />}
                {submitting ? 'Facturando...' : 'Emitir Factura'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
