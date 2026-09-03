import { useState } from 'react';
import { X, Receipt, FileCheck, RotateCcw, Mail, Loader2, FileMinus } from 'lucide-react';
import { formatDate } from '../../lib/formatDate';
import { InvoiceStatusBadge, openInvoicePdf, retryInvoice, resendInvoiceEmail } from './PaymentDetailModal';

export type InvoiceDetailDocument = {
  id: string;
  status: string;
  clave_acceso: string;
  total: number;
  cliente_identificacion: string;
  cliente_razon_social: string | null;
  cliente_email: string | null;
  authorization_number: string | null;
  authorization_date: string | null;
  pdf_url: string | null;
  created_at: string;
  document_type: string;
  documento_modificado_id: string | null;
  motivo?: string | null;
};

type ModifiedDocumentRef = { clave_acceso: string; created_at: string };

type Props = {
  isOpen: boolean;
  onClose: () => void;
  organizationId: string;
  invoice: InvoiceDetailDocument;
  concept: string;
  hasAuthorizedCreditNote: boolean;
  modifiedDocument?: ModifiedDocumentRef | null;
  onChanged: () => void;
};

// Vista ampliada de un solo comprobante (factura o nota de crédito) desde
// FacturasModule — antes solo existía la fila de la tabla con íconos, sin
// forma de ver el detalle completo (clave de acceso sin truncar, número
// de autorización, motivo de una nota de crédito) en un solo lugar. Las
// tres acciones reutilizan integralmente las funciones ya existentes
// (openInvoicePdf, retryInvoice, resendInvoiceEmail) — este modal es una
// vista distinta sobre el mismo comportamiento, no una reimplementación.
export function InvoiceDetailModal({
  isOpen,
  onClose,
  organizationId,
  invoice,
  concept,
  hasAuthorizedCreditNote,
  modifiedDocument,
  onChanged,
}: Props) {
  const [retrying, setRetrying] = useState(false);
  const [resending, setResending] = useState(false);

  if (!isOpen) return null;

  const isCreditNote = invoice.document_type === '04';
  // Mismo criterio ampliado que en PaymentDetailModal/FacturasModule: un
  // comprobante AUTHORIZED sin pdf_url todavía necesita "Reintentar" —
  // ahora ese reintento solo regenera el RIDE, ver handleRetry en la Edge
  // Function (no vuelve a someterlo al SRI).
  const needsRetry = invoice.status !== 'AUTHORIZED' || !invoice.pdf_url;

  const handleRetry = async () => {
    setRetrying(true);
    try {
      const succeeded = await retryInvoice(organizationId, invoice.id);
      if (succeeded) onChanged();
    } finally {
      setRetrying(false);
    }
  };

  const handleResend = async () => {
    setResending(true);
    try {
      await resendInvoiceEmail(organizationId, invoice.id);
    } finally {
      setResending(false);
    }
  };

  const row = (label: string, value: React.ReactNode) => (
    <div className="flex items-start justify-between gap-4 py-2 border-b border-slate-100 last:border-0">
      <span className="text-xs font-semibold text-slate-500 uppercase shrink-0 pt-0.5">{label}</span>
      <span className="text-sm text-slate-900 text-right break-all">{value}</span>
    </div>
  );

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-200">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isCreditNote ? 'bg-indigo-100 text-indigo-600' : 'bg-emerald-100 text-emerald-600'}`}>
              {isCreditNote ? <FileMinus className="w-5 h-5" /> : <Receipt className="w-5 h-5" />}
            </div>
            <div>
              <h3 className="font-semibold text-slate-900">{isCreditNote ? 'Detalle de Nota de Crédito' : 'Detalle de Factura'}</h3>
              <p className="text-sm text-slate-500">{formatDate(invoice.created_at)}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:bg-slate-100 hover:text-slate-600 p-2 rounded-xl transition-colors cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <InvoiceStatusBadge
              status={invoice.status}
              documentType={invoice.document_type}
              hasAuthorizedCreditNote={hasAuthorizedCreditNote}
            />
            <span className="text-lg font-bold text-slate-900">${Number(invoice.total).toFixed(2)}</span>
          </div>

          <div className="bg-slate-50 rounded-xl border border-slate-100 px-4">
            {row('Concepto', concept)}
            {row('Cliente', invoice.cliente_razon_social || '—')}
            {row('Identificación', invoice.cliente_identificacion)}
            {invoice.cliente_email && row('Correo', invoice.cliente_email)}
            {row('Clave de acceso', <span className="font-mono text-xs">{invoice.clave_acceso}</span>)}
            {invoice.authorization_number && row('N.° de autorización', <span className="font-mono text-xs">{invoice.authorization_number}</span>)}
            {invoice.authorization_date && row('Fecha de autorización', formatDate(invoice.authorization_date))}
            {isCreditNote && invoice.motivo && row('Motivo', invoice.motivo)}
            {isCreditNote && modifiedDocument && row(
              'Corrige a',
              <>...{modifiedDocument.clave_acceso.slice(-10)} ({formatDate(modifiedDocument.created_at)})</>
            )}
          </div>

          {needsRetry && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-800">
              {invoice.status === 'AUTHORIZED'
                ? 'Este comprobante está autorizado por el SRI pero todavía no tiene su RIDE (PDF) generado — usa "Reintentar" para generarlo, sin volver a someterlo al SRI.'
                : 'Este comprobante no quedó autorizado — usa "Reintentar" para volver a intentarlo ante el SRI.'}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex flex-wrap items-center justify-end gap-2">
          {invoice.status === 'AUTHORIZED' && (
            invoice.cliente_email ? (
              <button
                onClick={handleResend}
                disabled={resending}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-semibold text-indigo-700 hover:bg-indigo-50 rounded-lg transition-colors disabled:opacity-50 cursor-pointer"
              >
                {resending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
                Reenviar correo
              </button>
            ) : (
              <span title="Sin correo del cliente registrado — no se puede enviar" className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-semibold text-slate-300">
                <Mail className="w-4 h-4" />
                Reenviar correo
              </span>
            )
          )}
          {needsRetry && (
            <button
              onClick={handleRetry}
              disabled={retrying}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-semibold text-amber-700 hover:bg-amber-50 rounded-lg transition-colors disabled:opacity-50 cursor-pointer"
            >
              {retrying ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />}
              Reintentar
            </button>
          )}
          <button
            onClick={() => invoice.pdf_url && openInvoicePdf(invoice.pdf_url)}
            disabled={!invoice.pdf_url}
            title={invoice.pdf_url ? 'Ver factura (RIDE)' : 'El RIDE aún no está disponible'}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 text-white text-sm font-semibold rounded-xl hover:bg-emerald-700 shadow-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
          >
            <FileCheck className="w-4 h-4" />
            Ver RIDE
          </button>
        </div>

      </div>
    </div>
  );
}
