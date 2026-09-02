import { useEffect, useState, useCallback } from 'react';
import { FileText, FileCheck, RotateCcw, Loader2, Search, Mail, FileMinus } from 'lucide-react';
import { useOrg } from './OrgContext';
import { supabase } from '../../lib/supabase';
import { formatDate } from '../../lib/formatDate';
import { InvoiceStatusBadge, openInvoicePdf, retryInvoice, resendInvoiceEmail } from './PaymentDetailModal';
import { CreditNoteModal } from './CreditNoteModal';
import { SkeletonTable } from '../../components/ui/Skeleton';

type SriDocumentRow = {
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
  internal_payments: { charges: { description: string } | null }[] | null;
};

function describeInvoice(doc: SriDocumentRow): string {
  const descriptions = (doc.internal_payments || [])
    .map((p) => p.charges?.description)
    .filter((d): d is string => Boolean(d));
  return descriptions.length > 0 ? [...new Set(descriptions)].join(', ') : 'Servicio';
}

export function FacturasModule() {
  const { currentOrg } = useOrg();
  const [documents, setDocuments] = useState<SriDocumentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [retryingId, setRetryingId] = useState<string | null>(null);
  const [resendingId, setResendingId] = useState<string | null>(null);
  const [creditNoteTarget, setCreditNoteTarget] = useState<SriDocumentRow | null>(null);

  // Ya están todas las sri_documents de este centro en `documents` (esta
  // tabla no filtra por document_type) — no hace falta una consulta
  // aparte para saber si una factura ya tiene su nota de crédito.
  const hasAuthorizedCreditNote = (docId: string) =>
    documents.some(d => d.document_type === '04' && d.status === 'AUTHORIZED' && d.documento_modificado_id === docId);

  const loadDocuments = useCallback(async () => {
    if (!currentOrg) return;
    setLoading(true);
    try {
      const { data, error } = await (supabase as any)
        .from('sri_documents')
        .select(
          'id, status, clave_acceso, total, cliente_identificacion, cliente_razon_social, cliente_email, authorization_number, authorization_date, pdf_url, created_at, document_type, documento_modificado_id, internal_payments ( charges ( description ) )'
        )
        .eq('organization_id', currentOrg.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setDocuments((data as SriDocumentRow[]) || []);
    } catch {
      // silent — an empty list with the search/filter UI still visible is
      // an acceptable degraded state here, no destructive action pending
    } finally {
      setLoading(false);
    }
  }, [currentOrg]);

  useEffect(() => {
    loadDocuments();
  }, [loadDocuments]);

  const handleRetry = async (sriDocumentId: string) => {
    if (!currentOrg) return;
    setRetryingId(sriDocumentId);
    try {
      const succeeded = await retryInvoice(currentOrg.id, sriDocumentId);
      if (succeeded) await loadDocuments();
    } finally {
      setRetryingId(null);
    }
  };

  const handleResendEmail = async (sriDocumentId: string) => {
    if (!currentOrg) return;
    setResendingId(sriDocumentId);
    try {
      await resendInvoiceEmail(currentOrg.id, sriDocumentId);
    } finally {
      setResendingId(null);
    }
  };

  const filtered = documents.filter((doc) => {
    const matchesStatus = statusFilter === 'all' || doc.status === statusFilter;
    const search = searchTerm.trim().toLowerCase();
    const matchesSearch =
      !search ||
      doc.clave_acceso.toLowerCase().includes(search) ||
      doc.cliente_identificacion.toLowerCase().includes(search) ||
      (doc.cliente_razon_social ?? '').toLowerCase().includes(search) ||
      describeInvoice(doc).toLowerCase().includes(search);
    // created_at es un timestamp — comparar solo la parte de fecha (los
    // inputs date solo dan YYYY-MM-DD) para que el día "hasta" incluya
    // todas las facturas emitidas ese mismo día.
    const docDate = doc.created_at.slice(0, 10);
    const matchesFrom = !dateFrom || docDate >= dateFrom;
    const matchesTo = !dateTo || docDate <= dateTo;
    return matchesStatus && matchesSearch && matchesFrom && matchesTo;
  });

  return (
    <>
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Facturas Electrónicas</h1>
        <p className="text-sm text-slate-500 mt-0.5">Comprobantes emitidos ante el SRI para este centro.</p>
      </div>

      <div className="flex flex-col sm:flex-row flex-wrap gap-3">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar por representante, cédula, clave de acceso o concepto..."
            className="w-full bg-white border border-slate-300 rounded-lg pl-9 pr-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="all">Todos los estados</option>
          <option value="AUTHORIZED">Autorizadas</option>
          <option value="REJECTED">Rechazadas</option>
          <option value="ERROR">Con error</option>
        </select>
        <div className="flex items-center gap-1.5">
          <label className="text-xs font-semibold text-slate-500">Desde</label>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            max={dateTo || undefined}
            className="bg-white border border-slate-300 rounded-lg px-2.5 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        <div className="flex items-center gap-1.5">
          <label className="text-xs font-semibold text-slate-500">Hasta</label>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            min={dateFrom || undefined}
            className="bg-white border border-slate-300 rounded-lg px-2.5 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        {(dateFrom || dateTo) && (
          <button
            type="button"
            onClick={() => { setDateFrom(''); setDateTo(''); }}
            className="text-xs font-semibold text-slate-500 hover:text-slate-800 px-2"
          >
            Quitar fechas
          </button>
        )}
      </div>

      {loading ? (
        <SkeletonTable rows={6} columns={7} />
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border border-dashed border-slate-200">
          <FileText className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="text-sm text-slate-500">
            {documents.length === 0
              ? 'Todavía no se ha emitido ninguna factura electrónica en este centro.'
              : 'Ningún comprobante coincide con la búsqueda/filtro.'}
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left font-semibold text-slate-600 px-4 py-3">Fecha</th>
                <th className="text-left font-semibold text-slate-600 px-4 py-3">Concepto</th>
                <th className="text-left font-semibold text-slate-600 px-4 py-3">Cliente</th>
                <th className="text-left font-semibold text-slate-600 px-4 py-3">Identificación</th>
                <th className="text-right font-semibold text-slate-600 px-4 py-3">Total</th>
                <th className="text-left font-semibold text-slate-600 px-4 py-3">Estado</th>
                <th className="text-left font-semibold text-slate-600 px-4 py-3">Clave de acceso</th>
                <th className="text-right font-semibold text-slate-600 px-4 py-3">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((doc) => (
                <tr key={doc.id} className="hover:bg-slate-50/50">
                  <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{formatDate(doc.created_at)}</td>
                  <td className="px-4 py-3 text-slate-900 font-medium max-w-xs truncate" title={describeInvoice(doc)}>
                    {describeInvoice(doc)}
                  </td>
                  <td className="px-4 py-3 text-slate-700">{doc.cliente_razon_social || '—'}</td>
                  <td className="px-4 py-3 text-slate-600">{doc.cliente_identificacion}</td>
                  <td className="px-4 py-3 text-right font-semibold text-slate-900">${Number(doc.total).toFixed(2)}</td>
                  <td className="px-4 py-3">
                    <InvoiceStatusBadge
                      status={doc.status}
                      documentType={doc.document_type}
                      hasAuthorizedCreditNote={doc.document_type === '01' && hasAuthorizedCreditNote(doc.id)}
                    />
                  </td>
                  <td className="px-4 py-3 text-slate-400 font-mono text-xs">...{doc.clave_acceso.slice(-10)}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      {doc.status === 'AUTHORIZED' ? (
                        <>
                          <button
                            onClick={() => doc.pdf_url && openInvoicePdf(doc.pdf_url)}
                            disabled={!doc.pdf_url}
                            title={doc.pdf_url ? 'Ver factura (RIDE)' : 'El RIDE aún no está disponible'}
                            className="text-slate-500 hover:text-emerald-700 hover:bg-emerald-50 p-1.5 rounded-lg transition-colors disabled:opacity-40 cursor-pointer"
                          >
                            <FileCheck className="w-4 h-4" />
                          </button>
                          {doc.cliente_email ? (
                            <button
                              onClick={() => handleResendEmail(doc.id)}
                              disabled={resendingId === doc.id}
                              title="Enviar/reenviar factura por correo"
                              className="text-slate-500 hover:text-indigo-700 hover:bg-indigo-50 p-1.5 rounded-lg transition-colors disabled:opacity-50 cursor-pointer"
                            >
                              {resendingId === doc.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
                            </button>
                          ) : (
                            <span title="Sin correo del cliente registrado — no se puede enviar" className="text-slate-300 p-1.5">
                              <Mail className="w-4 h-4" />
                            </span>
                          )}
                          {doc.document_type === '01' && !hasAuthorizedCreditNote(doc.id) && (
                            <button
                              onClick={() => setCreditNoteTarget(doc)}
                              title="Anular esta factura con una Nota de Crédito"
                              className="text-slate-500 hover:text-red-600 hover:bg-red-50 p-1.5 rounded-lg transition-colors cursor-pointer"
                            >
                              <FileMinus className="w-4 h-4" />
                            </button>
                          )}
                        </>
                      ) : (
                        <button
                          onClick={() => handleRetry(doc.id)}
                          disabled={retryingId === doc.id}
                          title="Reintentar factura electrónica"
                          className="text-slate-500 hover:text-amber-700 hover:bg-amber-50 p-1.5 rounded-lg transition-colors disabled:opacity-50 cursor-pointer"
                        >
                          {retryingId === doc.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
    {creditNoteTarget && currentOrg && (
      <CreditNoteModal
        isOpen={Boolean(creditNoteTarget)}
        onClose={() => setCreditNoteTarget(null)}
        organizationId={currentOrg.id}
        sriDocumentId={creditNoteTarget.id}
        claveAcceso={creditNoteTarget.clave_acceso}
        total={Number(creditNoteTarget.total)}
        onIssued={() => { setCreditNoteTarget(null); loadDocuments(); }}
      />
    )}
    </>
  );
}
