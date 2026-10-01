import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import toast from 'react-hot-toast';
import {
  Receipt,
  FileText,
  Loader2,
  CheckCircle2,
  AlertCircle,
  X,
  Eye,
  ExternalLink,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import {
  parseEdgeFunctionErrorBody,
  isConfirmedFunctionRejection,
  showEmailStatusToast,
  fetchJustEmittedInvoice,
} from './PaymentDetailModal';
import { InvoiceDetailModal } from './InvoiceDetailModal';
import type { InvoiceDetailDocument } from './InvoiceDetailModal';

// ─── Facturación electrónica en segundo plano ──────────────────────────────
// Arquitectura: un único "task" global (no uno por modal) con 3 estados
// visibles posibles a la vez — modal de progreso en primer plano, pastilla
// flotante abajo a la derecha mientras sigue en curso, y una tarjeta de
// resultado (en el mismo lugar) cuando termina. Cualquier pantalla que
// dispare una factura (RegisterPaymentModal, InvoiceEnrollmentModal, un
// pago histórico sin facturar desde PaymentDetailModal) solo llama a
// startInvoicingTask y cierra su propio modal — todo lo demás (progreso,
// minimizar, notificar, abrir el detalle) lo maneja este provider, montado
// una sola vez en UserLayout y por lo tanto sobrevive a la navegación.

type InvoicingTask = {
  id: string;
  organizationId: string;
  description: string;
  amount: number;
};

type CompletedNotification = {
  id: string;
  status: 'authorized' | 'error';
  description: string;
  organizationId: string;
  sriDocumentId?: string;
  errorMessage?: string;
};

type StartInvoicingParams = {
  organizationId: string;
  paymentIds: string[];
  allowConsumidorFinal?: boolean;
  description: string;
  amount: number;
  // Llamado una vez que la tarea termina, sea cual sea el resultado —
  // para que quien la disparó pueda refrescar su propia lista.
  onSettled?: () => void;
  // Caso "todo o nada" de RegisterPaymentModal: el pago se acaba de
  // insertar y el SRI rechazó confirmadamente la solicitud sin siquiera
  // llegar a registrarla (sin sri_document_id) — ahí sí hay que revertir
  // el pago recién creado. No aplica a un pago que ya existía de antes.
  onConfirmedRejectionWithoutDocument?: () => void | Promise<void>;
};

type OpenInvoiceState = { organizationId: string; invoice: InvoiceDetailDocument; concept: string } | null;

type InvoiceNotificationsContextType = {
  startInvoicingTask: (params: StartInvoicingParams) => Promise<void>;
};

const InvoiceNotificationsContext = createContext<InvoiceNotificationsContextType | null>(null);

export function InvoiceNotificationsProvider({ children }: { children: ReactNode }) {
  const [activeTask, setActiveTask] = useState<InvoicingTask | null>(null);
  const [isProgressModalOpen, setIsProgressModalOpen] = useState(false);
  // Espejo en ref del estado de arriba — se lee dentro de
  // startInvoicingTask (una función async de larga duración) para decidir,
  // en el momento exacto en que el SRI responde, si el usuario se quedó
  // viendo o ya se fue a hacer otra cosa. Un closure sobre el useState
  // normal quedaría pegado al valor que tenía cuando se llamó la función.
  const isProgressModalOpenRef = useRef(false);
  const [completedNotification, setCompletedNotification] = useState<CompletedNotification | null>(null);
  const [openInvoice, setOpenInvoice] = useState<OpenInvoiceState>(null);

  const sendToBackground = () => {
    setIsProgressModalOpen(false);
    isProgressModalOpenRef.current = false;
  };
  const reopenProgressModal = () => {
    setIsProgressModalOpen(true);
    isProgressModalOpenRef.current = true;
  };
  const dismissNotification = () => setCompletedNotification(null);

  const openInvoiceDetail = async (organizationId: string, sriDocumentId: string) => {
    const detail = await fetchJustEmittedInvoice(sriDocumentId);
    if (detail) {
      setOpenInvoice({ organizationId, invoice: detail.invoice, concept: detail.concept });
    } else {
      toast.error('No se pudo cargar el detalle de la factura — revisa el módulo Facturas.');
    }
  };

  const startInvoicingTask = async (params: StartInvoicingParams) => {
    const id = `inv-${Date.now()}`;
    setActiveTask({ id, organizationId: params.organizationId, description: params.description, amount: params.amount });
    setIsProgressModalOpen(true);
    isProgressModalOpenRef.current = true;

    try {
      const { data, error } = await supabase.functions.invoke('electronic-billing', {
        body: {
          organization_id: params.organizationId,
          internal_payment_ids: params.paymentIds,
          allow_consumidor_final: params.allowConsumidorFinal ?? false,
        },
      });

      if (error || (data as any)?.error) {
        const parsed = await parseEdgeFunctionErrorBody(data, error);
        const message = parsed?.error || 'Error desconocido.';
        const confirmedRejection = isConfirmedFunctionRejection(error);
        const hasDocument = Boolean(parsed?.sri_document_id);

        if (confirmedRejection && !hasDocument) {
          await params.onConfirmedRejectionWithoutDocument?.();
        }
        params.onSettled?.();

        setActiveTask(null);
        setIsProgressModalOpen(false);
        isProgressModalOpenRef.current = false;
        setCompletedNotification({
          id,
          status: 'error',
          description: params.description,
          organizationId: params.organizationId,
          sriDocumentId: hasDocument ? parsed.sri_document_id : undefined,
          errorMessage: !confirmedRejection
            ? 'El servidor tardó demasiado en responder — revisa el módulo Facturas en un momento.'
            : message,
        });
      } else {
        showEmailStatusToast((data as any)?.email_status);
        params.onSettled?.();
        const sriDocumentId = (data as any).sri_document_id as string;
        setActiveTask(null);

        if (isProgressModalOpenRef.current) {
          // Se quedó viendo — pasa directo al detalle, sin notificación.
          setIsProgressModalOpen(false);
          isProgressModalOpenRef.current = false;
          await openInvoiceDetail(params.organizationId, sriDocumentId);
        } else {
          setCompletedNotification({
            id,
            status: 'authorized',
            description: params.description,
            organizationId: params.organizationId,
            sriDocumentId,
          });
        }
      }
    } catch (err: any) {
      params.onSettled?.();
      setActiveTask(null);
      setIsProgressModalOpen(false);
      isProgressModalOpenRef.current = false;
      setCompletedNotification({
        id,
        status: 'error',
        description: params.description,
        organizationId: params.organizationId,
        errorMessage: err?.message || 'Error inesperado facturando.',
      });
    }
  };

  // Auto-descarta la notificación de resultado tras 20s si nadie interactúa.
  useEffect(() => {
    if (!completedNotification) return;
    const timer = setTimeout(() => setCompletedNotification(null), 20000);
    return () => clearTimeout(timer);
  }, [completedNotification]);

  return (
    <InvoiceNotificationsContext.Provider value={{ startInvoicingTask }}>
      {children}

      {/* 1. Modal en primer plano — animación "Facturando..." */}
      {activeTask && isProgressModalOpen && (
        <div className="fixed inset-0 z-[9990] flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-fadeIn">
          <div className="max-w-md w-full bg-white rounded-3xl p-6 sm:p-8 shadow-2xl border border-slate-100 text-center relative overflow-hidden animate-popIn">
            <div className="absolute -top-20 -left-20 w-48 h-48 bg-indigo-500/15 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute -bottom-20 -right-20 w-48 h-48 bg-purple-500/15 rounded-full blur-3xl pointer-events-none" />

            <div className="relative w-24 h-24 mx-auto mb-5 flex items-center justify-center">
              <span className="absolute inset-0 rounded-full bg-indigo-500/20 animate-ping" />
              <span className="absolute -inset-2 rounded-full border-2 border-indigo-400/30 animate-pulse" />
              <div className="absolute inset-0 rounded-full border-[3px] border-transparent border-t-indigo-600 border-r-purple-600 animate-spin" />
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-indigo-600 to-purple-600 text-white flex items-center justify-center shadow-lg shadow-indigo-500/30 z-10">
                <FileText className="w-8 h-8" />
              </div>
            </div>

            <h3 className="text-xl font-black text-slate-900 tracking-tight">Facturando tu comprobante...</h3>
            <p className="text-xs text-slate-500 mt-1.5 flex items-center justify-center gap-1.5 font-medium">
              <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
              Firmando digitalmente y autorizando ante el SRI
            </p>

            <div className="mt-5 p-3.5 bg-slate-50 rounded-2xl border border-slate-200/80 text-left">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-slate-900 truncate pr-2">{activeTask.description}</span>
                <span className="font-black text-indigo-600 text-sm shrink-0">${activeTask.amount.toFixed(2)}</span>
              </div>
              <div className="mt-2.5 flex items-center gap-2 text-[10px] text-slate-500 font-mono bg-white px-2.5 py-1.5 rounded-xl border border-slate-200/60">
                <Loader2 size={12} className="animate-spin text-indigo-600 shrink-0" />
                <span className="truncate">SRI Ecuador • Emisión en línea</span>
              </div>
            </div>

            <button
              type="button"
              onClick={sendToBackground}
              className="w-full mt-6 py-3 px-4 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all cursor-pointer active:scale-98 shadow-sm group"
            >
              <ExternalLink size={16} className="group-hover:translate-x-0.5 transition-transform" />
              Facturar en segundo plano (seguir usando la app)
            </button>
          </div>
        </div>
      )}

      {/* 2. Pastilla flotante abajo a la derecha mientras sigue en curso —
          left-4 right-4 (en vez de solo right-5 + w-full) para que en
          pantallas angostas no se salga por la izquierda: w-full ahí
          resuelve al 100% del viewport, y right-5 sin un left que lo
          compense desplaza la caja fuera de la pantalla. */}
      {activeTask && !isProgressModalOpen && (
        <div className="fixed bottom-5 left-4 right-4 sm:left-auto sm:right-5 z-[9990] flex justify-end animate-fadeInUp">
          <div className="w-full max-w-sm bg-slate-900/95 text-white backdrop-blur-md rounded-2xl p-3.5 shadow-2xl border border-indigo-500/40 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="relative flex items-center justify-center shrink-0">
                <span className="absolute w-8 h-8 bg-indigo-500/30 rounded-full animate-ping" />
                <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 to-indigo-500 flex items-center justify-center text-white shadow-md relative">
                  <Loader2 size={17} className="animate-spin" />
                </div>
              </div>
              <div className="min-w-0">
                <p className="text-xs font-black text-white truncate">Facturando en segundo plano...</p>
                <p className="text-[11px] text-slate-300 truncate">{activeTask.description} · ${activeTask.amount.toFixed(2)}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={reopenProgressModal}
              title="Ver progreso"
              className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-bold text-white transition-colors cursor-pointer shrink-0 border border-white/10 flex items-center gap-1"
            >
              <Eye size={13} />
              Ver
            </button>
          </div>
        </div>
      )}

      {/* 3. Resultado — mismo lugar donde estaba la pastilla de progreso */}
      {completedNotification && (
        <div className="fixed bottom-5 left-4 right-4 sm:left-auto sm:right-5 z-[9999] flex justify-end animate-fadeInUp">
          {completedNotification.status === 'authorized' ? (
            <div className="w-full max-w-sm bg-white rounded-2xl p-4 shadow-2xl border border-emerald-300/80 flex items-start gap-3 relative overflow-hidden ring-4 ring-emerald-500/10">
              <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-gradient-to-b from-emerald-500 to-teal-600" />
              <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 ml-1">
                <CheckCircle2 size={20} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <h4 className="text-xs font-black text-slate-900 flex items-center gap-1.5">
                    Factura emitida
                    <span className="bg-emerald-600 text-white text-[9px] px-1.5 py-0.5 rounded font-bold">AUTORIZADO</span>
                  </h4>
                  <button onClick={dismissNotification} className="text-slate-400 hover:text-slate-600 p-1 rounded-lg transition-colors cursor-pointer shrink-0">
                    <X size={15} />
                  </button>
                </div>
                <p className="text-[11px] text-slate-500 truncate mt-0.5">{completedNotification.description}</p>
                <div className="mt-2.5 flex items-center gap-2">
                  <button
                    onClick={() => {
                      if (completedNotification.sriDocumentId) {
                        openInvoiceDetail(completedNotification.organizationId, completedNotification.sriDocumentId);
                      }
                      dismissNotification();
                    }}
                    className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer active:scale-95"
                  >
                    <Receipt size={13} />
                    Ver factura
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="w-full max-w-sm bg-white rounded-2xl p-4 shadow-2xl border border-rose-300/80 flex items-start gap-3 relative overflow-hidden ring-4 ring-rose-500/10">
              <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-rose-600" />
              <div className="w-9 h-9 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center shrink-0 ml-1">
                <AlertCircle size={20} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <h4 className="text-xs font-black text-slate-900 flex items-center gap-1.5">
                    Error al facturar
                    <span className="bg-rose-600 text-white text-[9px] px-1.5 py-0.5 rounded font-bold">
                      {completedNotification.sriDocumentId ? 'RECHAZADO' : 'PENDIENTE'}
                    </span>
                  </h4>
                  <button onClick={dismissNotification} className="text-slate-400 hover:text-slate-600 p-1 rounded-lg transition-colors cursor-pointer shrink-0">
                    <X size={15} />
                  </button>
                </div>
                <p className="text-[11px] text-rose-700 mt-1 line-clamp-2">{completedNotification.errorMessage}</p>
                <p className="text-[11px] text-slate-500 truncate mt-0.5">{completedNotification.description}</p>
                <div className="mt-2.5 flex items-center gap-2">
                  {completedNotification.sriDocumentId ? (
                    <button
                      onClick={() => {
                        openInvoiceDetail(completedNotification.organizationId, completedNotification.sriDocumentId!);
                        dismissNotification();
                      }}
                      className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer active:scale-95"
                    >
                      <Eye size={13} />
                      Ver / Reintentar
                    </button>
                  ) : (
                    <span className="text-[10px] text-slate-400">Usa "Facturar" en Cobros para volver a intentarlo.</span>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 4. Detalle de la factura, al hacer clic en "Ver factura" */}
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
