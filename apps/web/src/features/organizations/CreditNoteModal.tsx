import { useState } from 'react';
import { X, FileMinus, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { issueCreditNote } from './PaymentDetailModal';

type Props = {
  isOpen: boolean;
  onClose: () => void;
  organizationId: string;
  sriDocumentId: string;
  claveAcceso: string;
  total: number;
  onIssued: () => void;
};

// Anula (100% del monto — no hay soporte para montos parciales en esta
// versión) una factura ya AUTHORIZED, emitiendo una Nota de Crédito ante
// el SRI. Ver issueCreditNote (PaymentDetailModal.tsx) y
// handleEmitCreditNote (Edge Function electronic-billing).
export function CreditNoteModal({ isOpen, onClose, organizationId, sriDocumentId, claveAcceso, total, onIssued }: Props) {
  const [motivo, setMotivo] = useState('');
  const [voidPayments, setVoidPayments] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!motivo.trim()) {
      toast.error('El motivo de la nota de crédito es obligatorio.');
      return;
    }
    setSubmitting(true);
    try {
      const succeeded = await issueCreditNote(organizationId, sriDocumentId, motivo, voidPayments);
      if (succeeded) {
        onIssued();
        onClose();
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xl p-6 w-full max-w-md">
        <div className="flex justify-between items-center mb-4 border-b border-slate-100 pb-3">
          <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <FileMinus className="w-5 h-5 text-red-600" />
            Anular con Nota de Crédito
          </h3>
          <button onClick={onClose} disabled={submitting} className="text-slate-400 hover:text-slate-600 disabled:opacity-50 cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="mb-4 bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-800">
          Se emitirá una nota de crédito por el <strong>monto total de la factura (${total.toFixed(2)})</strong>, clave
          de acceso terminada en <span className="font-mono">...{claveAcceso.slice(-10)}</span>. Una factura ya
          autorizada por el SRI no se puede borrar — esta es la única forma legal de revertirla. Esta acción no se
          puede deshacer.
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Motivo *</label>
            <textarea
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              required
              rows={3}
              placeholder="Ej. Inscripción duplicada por error, cancelación del servicio, etc."
              className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-red-500"
            />
          </div>

          <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
            <input
              type="checkbox"
              checked={voidPayments}
              onChange={(e) => setVoidPayments(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-red-600 focus:ring-red-500"
            />
            Anular también el/los pago(s) vinculados a esta factura
          </label>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-4 py-2 text-sm font-semibold text-slate-600 hover:text-slate-900 rounded-lg transition-colors disabled:opacity-50 cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={submitting || !motivo.trim()}
              className="inline-flex items-center gap-1.5 bg-red-600 hover:bg-red-700 text-white px-5 py-2 rounded-lg text-sm font-semibold shadow-sm transition-colors disabled:opacity-50 cursor-pointer"
            >
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileMinus className="w-4 h-4" />}
              {submitting ? 'Emitiendo...' : 'Emitir Nota de Crédito'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
