import { createContext, useContext, useState, type ReactNode } from 'react';
import toast from 'react-hot-toast';
import { CheckCircle2, Receipt } from 'lucide-react';
import { fetchJustEmittedInvoice } from './PaymentDetailModal';
import { InvoiceDetailModal } from './InvoiceDetailModal';
import type { InvoiceDetailDocument } from './InvoiceDetailModal';

type OpenInvoiceState = { organizationId: string; invoice: InvoiceDetailDocument; concept: string } | null;

type InvoiceNotificationsContextType = {
  // Usado cuando el usuario eligió "seguir usando la app" mientras se
  // facturaba: para ese momento el modal que disparó la emisión ya se
  // desmontó, así que su estado local (justEmittedInvoice) ya no sirve
  // para mostrar el resultado — esto muestra una notificación persistente
  // arriba a la derecha con un botón "Ver factura" que abre el mismo
  // InvoiceDetailModal desde un lugar que sí sobrevive a la navegación
  // (montado una sola vez en UserLayout).
  notifyInvoiceReady: (organizationId: string, sriDocumentId: string) => Promise<void>;
};

const InvoiceNotificationsContext = createContext<InvoiceNotificationsContextType | null>(null);

export function InvoiceNotificationsProvider({ children }: { children: ReactNode }) {
  const [openInvoice, setOpenInvoice] = useState<OpenInvoiceState>(null);

  const notifyInvoiceReady = async (organizationId: string, sriDocumentId: string) => {
    const detail = await fetchJustEmittedInvoice(sriDocumentId);

    toast.custom(
      (t) => (
        <div
          className={`flex items-center gap-3 bg-white rounded-2xl border border-slate-200 shadow-xl p-4 w-full max-w-sm transition-all ${
            t.visible ? 'animate-fadeInUp' : 'opacity-0'
          }`}
        >
          <div className="w-9 h-9 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-slate-900">Factura emitida</p>
            <p className="text-xs text-slate-500">El comprobante ya fue autorizado por el SRI.</p>
          </div>
          {detail && (
            <button
              onClick={() => {
                toast.dismiss(t.id);
                setOpenInvoice({ organizationId, invoice: detail.invoice, concept: detail.concept });
              }}
              className="shrink-0 inline-flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold px-3 py-2 rounded-lg transition-colors cursor-pointer"
            >
              <Receipt className="w-3.5 h-3.5" />
              Ver factura
            </button>
          )}
        </div>
      ),
      { duration: 15000 }
    );
  };

  return (
    <InvoiceNotificationsContext.Provider value={{ notifyInvoiceReady }}>
      {children}
      {openInvoice && (
        <InvoiceDetailModal
          isOpen
          onClose={() => setOpenInvoice(null)}
          organizationId={openInvoice.organizationId}
          invoice={openInvoice.invoice}
          concept={openInvoice.concept}
          hasAuthorizedCreditNote={false}
          modifiedDocument={null}
          onChanged={() => {}}
        />
      )}
    </InvoiceNotificationsContext.Provider>
  );
}

export function useInvoiceNotifications() {
  const ctx = useContext(InvoiceNotificationsContext);
  if (!ctx) throw new Error('useInvoiceNotifications debe usarse dentro de InvoiceNotificationsProvider');
  return ctx;
}
