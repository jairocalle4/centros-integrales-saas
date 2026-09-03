import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, X } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { formatDate } from '../../lib/formatDate';

type BillingAlert = {
  is_overdue: boolean;
  days_remaining: number | null;
  grace_period_days: number;
  amount: number | null;
  due_date: string | null;
};

// Aviso flotante para el DUEÑO de un centro cuando tiene un cargo de
// plataforma vencido pero el centro sigue activo — todavía dentro del
// plazo de gracia de enforce_payment_grace_period (migración
// 20260903140000) antes de la suspensión automática. Una vez que el
// centro pasa a 'suspended', is_organization_active() ya bloquea toda
// la app con SuspendedTenant (UserLayout.tsx) — este aviso solo cubre
// la ventana previa, que hoy no tenía ninguna señal visible para el
// dueño. Ver get_organization_billing_alert (migración 20260903150000)
// — solo el dueño puede consultarlo, cualquier otro rol es rechazado.
export function BillingGraceAlert({ organizationId }: { organizationId: string }) {
  // Forzar un re-render al descartar — sessionStorage por sí solo no
  // dispara uno.
  const [, forceUpdate] = useState(0);

  const { data } = useQuery({
    queryKey: ['billing-grace-alert', organizationId],
    queryFn: async (): Promise<BillingAlert | null> => {
      const { data, error } = await supabase.rpc('get_organization_billing_alert', {
        p_org_id: organizationId,
      });
      if (error) return null; // un aviso de facturación nunca debe romper el resto de la app
      const row = Array.isArray(data) ? data[0] : data;
      return (row as BillingAlert) ?? null;
    },
    refetchOnWindowFocus: true,
    refetchInterval: 5 * 60 * 1000,
  });

  if (!data?.is_overdue) return null;

  // Incluir due_date en la clave: si este ciclo de vencimiento se paga y
  // más adelante se genera uno nuevo, el aviso vuelve a mostrarse aunque
  // el anterior se haya descartado.
  const dismissKey = `nexo_billing_alert_dismissed_${organizationId}_${data.due_date}`;
  let isDismissed = false;
  try {
    isDismissed = sessionStorage.getItem(dismissKey) === '1';
  } catch { /* un fallo leyendo sessionStorage no debe ocultar el aviso */ }
  if (isDismissed) return null;

  const handleDismiss = () => {
    try { sessionStorage.setItem(dismissKey, '1'); } catch { /* best-effort */ }
    forceUpdate((t) => t + 1);
  };

  const days = data.days_remaining ?? 0;
  const daysLabel = days <= 0
    ? 'Hoy es el último día antes de la suspensión automática.'
    : `Te queda${days === 1 ? '' : 'n'} ${days} día${days === 1 ? '' : 's'} antes de la suspensión automática.`;

  return (
    <div className="fixed bottom-4 right-4 left-4 sm:left-auto sm:w-96 z-40 animate-in fade-in slide-in-from-bottom-4 duration-300">
      <div className="bg-white rounded-2xl shadow-xl border border-red-200 overflow-hidden">
        <div className="flex items-start gap-3 p-4">
          <div className="w-9 h-9 rounded-xl bg-red-100 text-red-600 flex items-center justify-center shrink-0">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-slate-900">Plan vencido</p>
            <p className="text-xs text-slate-600 mt-1">
              Tu centro tiene un pago pendiente vencido. Realiza tu pago de inmediato para evitar la suspensión del servicio.
            </p>
            <p className="text-xs font-semibold text-red-700 mt-2">{daysLabel}</p>
            {data.amount != null && data.due_date && (
              <p className="text-[11px] text-slate-400 mt-1">
                ${Number(data.amount).toFixed(2)} vencido desde el {formatDate(data.due_date)}
              </p>
            )}
          </div>
          <button
            onClick={handleDismiss}
            title="Descartar por ahora"
            className="text-slate-400 hover:text-slate-600 hover:bg-slate-100 p-1 rounded-lg transition-colors shrink-0 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
