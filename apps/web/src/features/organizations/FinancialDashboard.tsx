import { useState, useEffect, useCallback } from 'react';
import { useOrg } from './OrgContext';
import { supabase } from '../../lib/supabase';
import { formatDate } from '../../lib/formatDate';
import { Link } from 'react-router';
import toast from 'react-hot-toast';
import { Calendar, Search, Loader2, CreditCard, Wallet, TrendingUp, TrendingDown } from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

type RangePreset = 'today' | 'last7' | 'thisMonth' | 'lastMonth' | 'thisYear' | 'custom';

type TrendPoint = { key: string; label: string; amount: number };
type DonutStat = { value: number; color: string; label: string };
type ServiceRevenue = { name: string; amount: number; count: number };
type OverdueCharge = {
  id: string;
  description: string;
  amount: number;
  due_date: string;
  status: string;
  days_overdue: number;
  beneficiary_name: string;
};
type AlertItem = {
  type: 'overdue' | 'absences' | 'sessions';
  severity: 'high' | 'medium' | 'low';
  title: string;
  subtitle: string;
  value: string;
  linkTo?: string;
};

type DashboardData = {
  // Financial KPIs — del rango seleccionado, salvo donde se indica "a hoy"
  revenueInRange: number;
  revenuePriorPeriod: number;
  pendingAmount: number; // a hoy
  pendingCount: number; // a hoy
  collectionRate: number; // del rango: ingresos del rango / (ingresos del rango + cargos del rango aún sin pagar)
  dueInRangeUnpaid: number; // denominador extra de collectionRate — cargos que vencían en el rango y siguen sin pagar
  overdueAmount: number; // a hoy
  overdueCount: number; // a hoy
  avgTicket: number;
  expensesInRange: number;
  netProfit: number; // revenueInRange - expensesInRange, real desde que existe el módulo de Gastos
  expensesByCategory: DonutStat[];
  // Operational KPIs
  activeBeneficiaries: number; // a hoy
  activeEnrollments: number; // a hoy
  attendanceRateRange: number;
  newEnrollmentsInRange: number;
  // Conversion KPIs
  scheduledAppointments: number; // a hoy
  conversionRate: number; // del rango
  pendingDeposits: number; // a hoy
  // Charts
  revenueTrend: TrendPoint[];
  attendanceStats: DonutStat[];
  paymentMethodStats: DonutStat[];
  topServices: ServiceRevenue[];
  // Alerts (siempre a hoy)
  overdueCharges: OverdueCharge[];
  alerts: AlertItem[];
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

const fmt = (n: number) =>
  new Intl.NumberFormat('es-EC', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }).format(n);

const fmtPct = (n: number) => `${Math.round(n)}%`;

const isoDate = (d: Date) => d.toISOString().split('T')[0];

function getMonthBounds(offset = 0) {
  const d = new Date();
  const first = new Date(d.getFullYear(), d.getMonth() + offset, 1);
  const last = new Date(d.getFullYear(), d.getMonth() + offset + 1, 0);
  return { start: isoDate(first), end: isoDate(last) };
}

const MONTH_NAMES_SHORT = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  cash: 'Efectivo',
  transfer: 'Transferencia',
  card: 'Tarjeta',
};

const RANGE_PRESETS: { value: RangePreset; label: string }[] = [
  { value: 'today', label: 'Hoy' },
  { value: 'last7', label: 'Últimos 7 días' },
  { value: 'thisMonth', label: 'Este mes' },
  { value: 'lastMonth', label: 'Mes anterior' },
  { value: 'thisYear', label: 'Este año' },
  { value: 'custom', label: 'Personalizado' },
];

function computePresetRange(preset: RangePreset, customStart?: string, customEnd?: string): { start: string; end: string } {
  const today = new Date();
  switch (preset) {
    case 'today':
      return { start: isoDate(today), end: isoDate(today) };
    case 'last7': {
      const start = new Date(today);
      start.setDate(today.getDate() - 6);
      return { start: isoDate(start), end: isoDate(today) };
    }
    case 'lastMonth':
      return getMonthBounds(-1);
    case 'thisYear':
      return { start: isoDate(new Date(today.getFullYear(), 0, 1)), end: isoDate(today) };
    case 'custom':
      return { start: customStart || isoDate(today), end: customEnd || isoDate(today) };
    case 'thisMonth':
    default:
      return getMonthBounds(0);
  }
}

// Ventana inmediatamente anterior, de la misma duración que [start, end] —
// generaliza "mes anterior" a cualquier rango elegido (mismo criterio que
// usan la mayoría de dashboards de analítica al comparar períodos).
function getPriorEquivalentRange(start: string, end: string): { start: string; end: string } {
  const startDate = new Date(start + 'T00:00:00');
  const endDate = new Date(end + 'T00:00:00');
  const spanDays = Math.round((endDate.getTime() - startDate.getTime()) / 86400000) + 1;
  const priorEnd = new Date(startDate);
  priorEnd.setDate(priorEnd.getDate() - 1);
  const priorStart = new Date(priorEnd);
  priorStart.setDate(priorStart.getDate() - (spanDays - 1));
  return { start: isoDate(priorStart), end: isoDate(priorEnd) };
}

// Granularidad adaptativa: por día si el rango cabe en ≤31 días, por semana
// si cabe en ≤180, por mes si es más largo — así "Hoy" no intenta mostrar 6
// meses de barras, y "Este año" no intenta mostrar 365 barras diarias.
function buildRevenueTrend(rows: { amount: number; payment_date: string }[], start: string, end: string): TrendPoint[] {
  const startDate = new Date(start + 'T00:00:00');
  const endDate = new Date(end + 'T00:00:00');
  const spanDays = Math.round((endDate.getTime() - startDate.getTime()) / 86400000) + 1;

  const sumByDay: Record<string, number> = {};
  rows.forEach((r) => {
    sumByDay[r.payment_date] = (sumByDay[r.payment_date] || 0) + Number(r.amount);
  });

  if (spanDays <= 31) {
    const points: TrendPoint[] = [];
    for (let i = 0; i < spanDays; i++) {
      const d = new Date(startDate);
      d.setDate(startDate.getDate() + i);
      const key = isoDate(d);
      points.push({ key, label: String(d.getDate()), amount: sumByDay[key] || 0 });
    }
    return points;
  }

  if (spanDays <= 180) {
    const points: TrendPoint[] = [];
    const cursor = new Date(startDate);
    while (cursor <= endDate) {
      const weekStart = new Date(cursor);
      const weekEnd = new Date(cursor);
      weekEnd.setDate(weekEnd.getDate() + 6);
      const clampedEnd = weekEnd > endDate ? endDate : weekEnd;
      let sum = 0;
      const d = new Date(weekStart);
      while (d <= clampedEnd) {
        sum += sumByDay[isoDate(d)] || 0;
        d.setDate(d.getDate() + 1);
      }
      points.push({
        key: isoDate(weekStart),
        label: `${String(weekStart.getDate()).padStart(2, '0')}/${String(weekStart.getMonth() + 1).padStart(2, '0')}`,
        amount: sum,
      });
      cursor.setDate(cursor.getDate() + 7);
    }
    return points;
  }

  const sumByMonth: Record<string, number> = {};
  rows.forEach((r) => {
    const d = new Date(r.payment_date);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    sumByMonth[key] = (sumByMonth[key] || 0) + Number(r.amount);
  });
  const points: TrendPoint[] = [];
  const cursor = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
  const endMonthCursor = new Date(endDate.getFullYear(), endDate.getMonth(), 1);
  while (cursor <= endMonthCursor) {
    const key = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}`;
    points.push({ key, label: MONTH_NAMES_SHORT[cursor.getMonth()], amount: sumByMonth[key] || 0 });
    cursor.setMonth(cursor.getMonth() + 1);
  }
  return points;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function KpiCard({
  icon,
  label,
  value,
  sub,
  trend,
  trendUp,
  color,
  loading,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  trend?: string;
  trendUp?: boolean;
  color: string;
  loading?: boolean;
}) {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 flex flex-col gap-3 hover:shadow-md transition-all duration-300 hover:-translate-y-0.5 group">
      <div className="flex items-center justify-between">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${color}`}>
          {icon}
        </div>
        {trend && (
          <span className={`text-xs font-bold px-2 py-1 rounded-full ${trendUp ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}`}>
            {trendUp ? '▲' : '▼'} {trend}
          </span>
        )}
      </div>
      {loading ? (
        <div className="animate-pulse space-y-2">
          <div className="h-7 bg-slate-200 rounded-lg w-3/4" />
          <div className="h-3 bg-slate-100 rounded w-1/2" />
        </div>
      ) : (
        <>
          <div>
            <p className="text-2xl font-bold text-slate-900 tracking-tight">{value}</p>
            {sub && <p className="text-xs text-slate-500 mt-0.5">{sub}</p>}
          </div>
          <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">{label}</p>
        </>
      )}
    </div>
  );
}

// Dona genérica — se reutiliza para asistencia, método de pago y estado de
// facturación electrónica: cada uno decide qué representa `value` (conteo de
// sesiones, suma en dólares, conteo de comprobantes) vía `formatValue`.
function DonutChart({
  stats,
  total,
  centerLabel,
  formatValue = (v: number) => String(v),
}: {
  stats: DonutStat[];
  total: number;
  centerLabel: string;
  formatValue?: (v: number) => string;
}) {
  const radius = 50;
  const cx = 70;
  const cy = 70;
  const circumference = 2 * Math.PI * radius;

  let cumulativeAngle = -90;

  return (
    // Antes iba lado a lado con la dona (140px) + leyenda — en tarjetas
    // angostas (3-4 columnas) el monto y el porcentaje no cabían y se
    // salían del borde de la tarjeta. Apilado (dona arriba, leyenda abajo
    // a todo el ancho) la leyenda siempre tiene todo el ancho disponible
    // de la tarjeta, sin importar qué tan angosta sea.
    <div className="flex flex-col items-center gap-4 w-full min-w-0">
      <svg width="140" height="140" viewBox="0 0 140 140" className="shrink-0">
        <circle cx={cx} cy={cy} r={radius} fill="none" stroke="#f1f5f9" strokeWidth="20" />
        {stats.map((stat, i) => {
          if (total === 0 || stat.value === 0) return null;
          const pct = stat.value / total;
          const dash = pct * circumference;
          const gap = circumference - dash;
          const angle = cumulativeAngle;
          cumulativeAngle += pct * 360;
          return (
            <circle
              key={i}
              cx={cx}
              cy={cy}
              r={radius}
              fill="none"
              stroke={stat.color}
              strokeWidth="20"
              strokeDasharray={`${dash} ${gap}`}
              strokeDashoffset={(-circumference * (angle + 90)) / 360}
              style={{ transform: `rotate(${angle}deg)`, transformOrigin: `${cx}px ${cy}px`, transition: 'stroke-dasharray 0.6s ease-out' }}
            />
          );
        })}
        <text x={cx} y={cy - 5} textAnchor="middle" fontSize="15" fontWeight="bold" fill="#0f172a">
          {formatValue(total)}
        </text>
        <text x={cx} y={cy + 12} textAnchor="middle" fontSize="9" fill="#94a3b8">{centerLabel}</text>
      </svg>
      <div className="w-full space-y-2.5 min-w-0">
        {stats.map((stat, i) => (
          <div key={i} className="flex items-center gap-2 min-w-0">
            <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: stat.color }} />
            <span className="text-xs text-slate-600 truncate flex-1 min-w-0" title={stat.label}>{stat.label}</span>
            <span className="text-xs font-bold text-slate-800 shrink-0">{formatValue(stat.value)}</span>
            <span className="text-[10px] text-slate-400 w-9 text-right shrink-0">
              {total > 0 ? `${Math.round((stat.value / total) * 100)}%` : '0%'}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// Alto reservado para las barras y para la etiqueta de monto por encima de
// ellas — separados a propósito: antes la etiqueta se ubicaba con un % de
// una altura en px (confundiendo unidades) y con la barra más alta
// terminaba con `top: 0` desplazada además hacia arriba por su propio
// alto, saliéndose del todo de la tarjeta (se veía tapando el título
// "Ingresos"). Con alto de barra y espacio de etiqueta fijos en píxeles,
// ninguna etiqueta puede salirse del contenedor sin importar qué tan alta
// sea la barra.
const BAR_MAX_HEIGHT = 92;
const BAR_LABEL_SPACE = 26;

function BarChart({ data }: { data: TrendPoint[] }) {
  const maxVal = Math.max(...data.map((d) => d.amount), 1);
  // Con muchas barras (ej. 31 días) mostrar una etiqueta de eje por cada una
  // se amontona — se muestra 1 de cada N, siempre incluyendo la última.
  const labelEvery = data.length > 15 ? Math.ceil(data.length / 10) : 1;
  // El monto de cada barra solo se veía al pasar el mouse — invisible en
  // móvil y en capturas de pantalla. Con pocas barras con datos (lo normal:
  // la mayoría de días sin pagos) se muestra siempre; con muchas, se vuelve
  // a hover para no amontonar el gráfico.
  const nonZeroCount = data.filter((d) => d.amount > 0).length;
  const alwaysShowAmount = nonZeroCount > 0 && nonZeroCount <= 12;
  return (
    <div className="flex items-end gap-1.5 w-full" style={{ height: `${BAR_MAX_HEIGHT + BAR_LABEL_SPACE}px` }}>
      {data.map((d, i) => {
        const barHeightPx = maxVal > 0 ? Math.max((d.amount / maxVal) * BAR_MAX_HEIGHT, d.amount > 0 ? 4 : 0) : 0;
        const isLast = i === data.length - 1;
        const showAxisLabel = isLast || i % labelEvery === 0;
        return (
          <div key={d.key} className="flex flex-col items-center gap-1 flex-1 group/bar min-w-0">
            <div className="relative w-full flex items-end justify-center" style={{ height: `${BAR_MAX_HEIGHT + BAR_LABEL_SPACE}px` }}>
              {d.amount > 0 && (
                <div
                  className={`absolute text-[9px] font-bold text-white bg-slate-800 rounded px-1.5 py-0.5 left-1/2 -translate-x-1/2 whitespace-nowrap z-10 transition-opacity ${
                    alwaysShowAmount ? 'opacity-100' : 'opacity-0 group-hover/bar:opacity-100'
                  }`}
                  style={{ bottom: `${barHeightPx + 4}px` }}
                >
                  {fmt(d.amount)}
                </div>
              )}
              <div
                className={`w-full rounded-t-lg transition-all duration-500 ${isLast ? 'bg-indigo-500' : 'bg-indigo-200 group-hover/bar:bg-indigo-300'}`}
                style={{ height: `${barHeightPx}px` }}
              />
            </div>
            <span className={`text-[9px] font-medium truncate ${isLast ? 'text-indigo-600' : 'text-slate-400'}`}>
              {showAxisLabel ? d.label : ''}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function HorizBar({ name, amount, max, rank }: { name: string; amount: number; max: number; rank: number }) {
  const pct = max > 0 ? (amount / max) * 100 : 0;
  const colors = ['bg-indigo-500', 'bg-violet-500', 'bg-cyan-500', 'bg-emerald-500', 'bg-amber-500'];
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs font-bold text-slate-400 w-4 text-right">{rank}</span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs font-semibold text-slate-700 truncate">{name}</span>
          <span className="text-xs font-bold text-slate-900 ml-2">{fmt(amount)}</span>
        </div>
        <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-700 ${colors[rank - 1] || 'bg-slate-400'}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
    </div>
  );
}

const severityStyles = {
  high: { border: 'border-l-red-500', bg: 'bg-red-50', dot: 'bg-red-500', badge: 'bg-red-100 text-red-700' },
  medium: { border: 'border-l-amber-500', bg: 'bg-amber-50', dot: 'bg-amber-500', badge: 'bg-amber-100 text-amber-700' },
  low: { border: 'border-l-blue-500', bg: 'bg-blue-50', dot: 'bg-blue-500', badge: 'bg-blue-100 text-blue-700' },
};

// Selector de rango — presets + rango libre. Los cambios quedan "en
// borrador" hasta tocar Consultar (no se recarga en cada clic); Limpiar
// vuelve a "Este mes" y recarga de inmediato.
function DateRangeControl({
  draftPreset,
  setDraftPreset,
  draftStart,
  setDraftStart,
  draftEnd,
  setDraftEnd,
  appliedLabel,
  onApply,
  onClear,
  loading,
}: {
  draftPreset: RangePreset;
  setDraftPreset: (p: RangePreset) => void;
  draftStart: string;
  setDraftStart: (v: string) => void;
  draftEnd: string;
  setDraftEnd: (v: string) => void;
  appliedLabel: string;
  onApply: () => void;
  onClear: () => void;
  loading: boolean;
}) {
  const isCustom = draftPreset === 'custom';
  const today = isoDate(new Date());

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 sm:p-5">
      <div className="flex flex-col lg:flex-row lg:items-center gap-4">
        <div className="flex items-center gap-3 shrink-0">
          <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
            <Calendar className="w-4.5 h-4.5" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Período</p>
            <p className="text-sm font-bold text-slate-900 truncate">{appliedLabel}</p>
          </div>
        </div>

        <div className="flex-1 flex flex-wrap items-center gap-2">
          {RANGE_PRESETS.map((p) => (
            <button
              key={p.value}
              type="button"
              onClick={() => setDraftPreset(p.value)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 cursor-pointer ${
                draftPreset === p.value
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={onClear}
            disabled={loading}
            className="px-3 py-2 text-xs font-semibold text-slate-500 hover:text-slate-800 transition-colors disabled:opacity-50 cursor-pointer"
          >
            Limpiar
          </button>
          <button
            type="button"
            onClick={onApply}
            disabled={loading}
            className="inline-flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl text-xs font-bold shadow-sm transition-all disabled:opacity-50 cursor-pointer"
          >
            {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
            Consultar
          </button>
        </div>
      </div>

      <div className={`grid transition-all duration-300 ease-out ${isCustom ? 'grid-rows-[1fr] opacity-100 mt-4 pt-4 border-t border-slate-100' : 'grid-rows-[0fr] opacity-0'}`}>
        <div className="overflow-hidden">
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-slate-500 mb-1">Desde</label>
              <input
                type="date"
                value={draftStart}
                onChange={(e) => setDraftStart(e.target.value)}
                max={draftEnd || today}
                className="bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-500 mb-1">Hasta</label>
              <input
                type="date"
                value={draftEnd}
                onChange={(e) => setDraftEnd(e.target.value)}
                min={draftStart || undefined}
                max={today}
                className="bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────

export function FinancialDashboard() {
  const { currentOrg } = useOrg();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState(new Date());

  const defaultRange = computePresetRange('thisMonth');
  const [draftPreset, setDraftPreset] = useState<RangePreset>('thisMonth');
  const [draftStart, setDraftStart] = useState('');
  const [draftEnd, setDraftEnd] = useState('');
  const [appliedRange, setAppliedRange] = useState(defaultRange);
  const [appliedLabel, setAppliedLabel] = useState('Este mes');

  const handleApply = () => {
    if (draftPreset === 'custom') {
      if (!draftStart || !draftEnd) { toast.error('Selecciona ambas fechas del rango.'); return; }
      if (draftStart > draftEnd) { toast.error('La fecha "desde" no puede ser posterior a "hasta".'); return; }
      setAppliedRange({ start: draftStart, end: draftEnd });
      setAppliedLabel(`${formatDate(draftStart)} – ${formatDate(draftEnd)}`);
    } else {
      setAppliedRange(computePresetRange(draftPreset));
      setAppliedLabel(RANGE_PRESETS.find((p) => p.value === draftPreset)?.label || 'Período');
    }
  };

  const handleClear = () => {
    setDraftPreset('thisMonth');
    setDraftStart('');
    setDraftEnd('');
    setAppliedRange(computePresetRange('thisMonth'));
    setAppliedLabel('Este mes');
  };

  const loadDashboard = useCallback(async () => {
    if (!currentOrg) return;
    setLoading(true);

    const today = isoDate(new Date());
    const { start: rangeStart, end: rangeEnd } = appliedRange;
    const prior = getPriorEquivalentRange(rangeStart, rangeEnd);
    const overdueThreshold = new Date();
    overdueThreshold.setDate(overdueThreshold.getDate() - 30);
    const overdueDate = isoDate(overdueThreshold);

    try {
      const [
        rangePmtRes,
        priorPmtRes,
        chargesPendingRes,
        chargesOverdueRes,
        chargesDueInRangeRes,
        beneficiariesRes,
        enrollmentsActiveRes,
        enrollmentsNewRes,
        attendanceRangeRes,
        appointmentsAllRes,
        appointmentsRangeRes,
        overdueChargesRes,
        expensesRangeRes,
      ] = await Promise.all([
        // 1. Pagos del rango — alimenta ingresos, tendencia, método de pago,
        // servicios por ingreso y ticket promedio, todo desde una sola
        // consulta. Excluye anulados (voided_at) — antes no se excluían en
        // ningún cálculo de este módulo.
        supabase
          .from('internal_payments')
          .select('amount, payment_date, method, charges(description, beneficiary_id)')
          .eq('organization_id', currentOrg.id)
          .is('voided_at', null)
          .gte('payment_date', rangeStart)
          .lte('payment_date', rangeEnd),

        // 2. Pagos del período anterior equivalente (para el trend vs.)
        supabase
          .from('internal_payments')
          .select('amount')
          .eq('organization_id', currentOrg.id)
          .is('voided_at', null)
          .gte('payment_date', prior.start)
          .lte('payment_date', prior.end),

        // 3. Cartera pendiente — a hoy, sin filtro de fecha
        supabase
          .from('charges')
          .select('amount, status')
          .eq('organization_id', currentOrg.id)
          .in('status', ['pending', 'partial']),

        // 4. Cobros vencidos (resumen) — a hoy
        supabase
          .from('charges')
          .select('amount, status, due_date')
          .eq('organization_id', currentOrg.id)
          .in('status', ['pending', 'partial'])
          .lt('due_date', today),

        // 5. Cargos que vencieron DENTRO del rango y siguen sin pagarse —
        // solo para la tasa de cobro del período (denominador correcto: lo
        // que debía cobrarse en este período, no toda la deuda histórica).
        supabase
          .from('charges')
          .select('amount')
          .eq('organization_id', currentOrg.id)
          .in('status', ['pending', 'partial'])
          .gte('due_date', rangeStart)
          .lte('due_date', rangeEnd),

        // 6. Beneficiarios activos — a hoy
        supabase
          .from('beneficiaries')
          .select('id', { count: 'exact', head: true })
          .eq('organization_id', currentOrg.id)
          .eq('is_active', true),

        // 7. Inscripciones activas — a hoy
        (supabase as any)
          .from('enrollments')
          .select('id', { count: 'exact', head: true })
          .eq('organization_id', currentOrg.id)
          .eq('status', 'active'),

        // 8. Nuevas inscripciones del rango
        (supabase as any)
          .from('enrollments')
          .select('id', { count: 'exact', head: true })
          .eq('organization_id', currentOrg.id)
          .gte('created_at', rangeStart + 'T00:00:00')
          .lte('created_at', rangeEnd + 'T23:59:59'),

        // 9. Asistencia del rango (para tasa + donut)
        (supabase as any)
          .from('attendance')
          .select('status')
          .eq('organization_id', currentOrg.id)
          .gte('session_date', rangeStart)
          .lte('session_date', rangeEnd),

        // 10. Todas las citas agendadas (pendientes) — a hoy
        supabase
          .from('appointments')
          .select('status, deposit_amount')
          .eq('organization_id', currentOrg.id)
          .eq('status', 'scheduled'),

        // 11. Citas del rango (para tasa de conversión del período)
        supabase
          .from('appointments')
          .select('status')
          .eq('organization_id', currentOrg.id)
          .gte('appointment_date', rangeStart)
          .lte('appointment_date', rangeEnd),

        // 12. Cobros vencidos > 30 días (detalle + alertas) — a hoy
        supabase
          .from('charges')
          .select(`id, description, amount, due_date, status, beneficiaries(first_name, last_name)`)
          .eq('organization_id', currentOrg.id)
          .in('status', ['pending', 'partial'])
          .lt('due_date', overdueDate)
          .order('due_date', { ascending: true })
          .limit(8),

        // 13. Gastos del rango (excluye anulados) — Gastos del período,
        // desglose por categoría y Utilidad Neta.
        (supabase as any)
          .from('expenses')
          .select('amount, category')
          .eq('organization_id', currentOrg.id)
          .is('voided_at', null)
          .gte('expense_date', rangeStart)
          .lte('expense_date', rangeEnd),
      ]);

      // ─── Ingresos del rango + comparación vs. período anterior ───────────
      const rangePayments = rangePmtRes.data || [];
      const revenueInRange = rangePayments.reduce((sum: number, p: any) => sum + Number(p.amount), 0);
      const revenuePriorPeriod = (priorPmtRes.data || []).reduce((sum: number, p: any) => sum + Number(p.amount), 0);

      const pendingAmount = (chargesPendingRes.data || []).reduce((sum: number, c: any) => sum + Number(c.amount), 0);
      const pendingCount = chargesPendingRes.data?.length || 0;

      const overdueAmount = (chargesOverdueRes.data || []).reduce((sum: number, c: any) => sum + Number(c.amount), 0);
      const overdueCount = chargesOverdueRes.data?.length || 0;

      const dueInRangeUnpaid = (chargesDueInRangeRes.data || []).reduce((sum: number, c: any) => sum + Number(c.amount), 0);
      const collectionRate = (revenueInRange + dueInRangeUnpaid) > 0
        ? (revenueInRange / (revenueInRange + dueInRangeUnpaid)) * 100
        : 100;

      // ─── Tendencia de ingresos (granularidad adaptativa) ─────────────────
      const revenueTrend = buildRevenueTrend(rangePayments, rangeStart, rangeEnd);

      // ─── Servicios por ingreso — desde los pagos del rango, no desde el
      // estado actual de los cargos (cargo y pago son cosas distintas). ────
      const svcMap: Record<string, ServiceRevenue> = {};
      rangePayments.forEach((p: any) => {
        const key = p.charges?.description || 'Otros';
        if (!svcMap[key]) svcMap[key] = { name: key, amount: 0, count: 0 };
        svcMap[key].amount += Number(p.amount);
        svcMap[key].count += 1;
      });
      const topServices = Object.values(svcMap).sort((a, b) => b.amount - a.amount).slice(0, 5);

      // ─── Pago por método ──────────────────────────────────────────────────
      const methodMap: Record<string, number> = {};
      rangePayments.forEach((p: any) => {
        methodMap[p.method] = (methodMap[p.method] || 0) + Number(p.amount);
      });
      const methodColors: Record<string, string> = { cash: '#10b981', transfer: '#6366f1', card: '#8b5cf6' };
      const paymentMethodStats: DonutStat[] = Object.entries(methodMap)
        .map(([method, amount]) => ({
          value: amount,
          color: methodColors[method] || '#94a3b8',
          label: PAYMENT_METHOD_LABELS[method] || 'Otro',
        }))
        .sort((a, b) => b.value - a.value);

      // ─── Ticket promedio (ingresos del rango / beneficiarios distintos) ──
      const distinctBeneficiaries = new Set(
        rangePayments.map((p: any) => p.charges?.beneficiary_id).filter(Boolean)
      );
      const avgTicket = distinctBeneficiaries.size > 0 ? revenueInRange / distinctBeneficiaries.size : 0;

      // ─── Gastos del rango + Utilidad Neta ─────────────────────────────────
      // Ahora que existe el módulo de Gastos, esta es una cifra real, no
      // inventada (antes se descartó explícitamente mostrar "utilidad" sin
      // datos reales de gasto).
      const expenseRows = expensesRangeRes.data || [];
      const expensesInRange = expenseRows.reduce((sum: number, e: any) => sum + Number(e.amount), 0);
      const netProfit = revenueInRange - expensesInRange;

      const categoryMap: Record<string, number> = {};
      expenseRows.forEach((e: any) => {
        categoryMap[e.category] = (categoryMap[e.category] || 0) + Number(e.amount);
      });
      const categoryColors = ['#6366f1', '#f43f5e', '#f59e0b', '#10b981', '#8b5cf6', '#06b6d4', '#ec4899', '#84cc16', '#f97316', '#0ea5e9', '#a855f7', '#94a3b8'];
      const expensesByCategory: DonutStat[] = Object.entries(categoryMap)
        .map(([category, amount], i) => ({ value: amount, color: categoryColors[i % categoryColors.length], label: category }))
        .sort((a, b) => b.value - a.value);

      // ─── Asistencia del rango ─────────────────────────────────────────────
      const rangeAtt = attendanceRangeRes.data || [];
      const attPresent = rangeAtt.filter((a: any) => a.status === 'present' || a.status === 'late').length;
      const attCountable = rangeAtt.filter((a: any) => a.status !== 'scheduled').length;
      const attendanceRateRange = attCountable > 0 ? (attPresent / attCountable) * 100 : 0;

      const attCounts: Record<string, number> = {};
      rangeAtt.forEach((a: any) => {
        if (a.status !== 'scheduled') attCounts[a.status] = (attCounts[a.status] || 0) + 1;
      });
      const attendanceStats: DonutStat[] = [
        { value: attCounts['present'] || 0, color: '#10b981', label: 'Presentes' },
        { value: attCounts['late'] || 0, color: '#f59e0b', label: 'Tardanzas' },
        { value: attCounts['justified'] || 0, color: '#6366f1', label: 'Justificadas' },
        { value: attCounts['absent'] || 0, color: '#f43f5e', label: 'Ausentes' },
      ].filter((s) => s.value > 0);

      // ─── Conversión (citas del rango) + agendadas/depósitos (a hoy) ──────
      const rangeAppts = appointmentsRangeRes.data || [];
      const convertedInRange = rangeAppts.filter((a: any) => a.status === 'converted').length;
      const conversionRate = rangeAppts.length > 0 ? (convertedInRange / rangeAppts.length) * 100 : 0;

      const scheduledNow = appointmentsAllRes.data || [];
      const scheduledAppointments = scheduledNow.length;
      const pendingDeposits = scheduledNow.reduce((sum: number, a: any) => sum + Number(a.deposit_amount || 0), 0);

      // ─── Cobros vencidos (detalle) — a hoy ────────────────────────────────
      const overdueCharges: OverdueCharge[] = (overdueChargesRes.data || []).map((c: any) => {
        const ben = c.beneficiaries;
        const daysOverdue = Math.floor((Date.now() - new Date(c.due_date).getTime()) / 86400000);
        return {
          id: c.id,
          description: c.description,
          amount: Number(c.amount),
          due_date: c.due_date,
          status: c.status,
          days_overdue: daysOverdue,
          beneficiary_name: ben ? `${ben.first_name} ${ben.last_name}` : 'Sin beneficiario',
        };
      });

      // ─── Alertas (a hoy) ───────────────────────────────────────────────────
      const alerts: AlertItem[] = [];
      const criticalOverdue = overdueCharges.filter((c) => c.days_overdue > 60);
      if (criticalOverdue.length > 0) {
        alerts.push({
          type: 'overdue',
          severity: 'high',
          title: `${criticalOverdue.length} cobro(s) vencidos hace más de 60 días`,
          subtitle: 'Requieren atención urgente',
          value: fmt(criticalOverdue.reduce((s, c) => s + c.amount, 0)),
        });
      }
      const moderateOverdue = overdueCharges.filter((c) => c.days_overdue >= 30 && c.days_overdue <= 60);
      if (moderateOverdue.length > 0) {
        alerts.push({
          type: 'overdue',
          severity: 'medium',
          title: `${moderateOverdue.length} cobro(s) vencidos entre 30 y 60 días`,
          subtitle: 'Pendientes de seguimiento',
          value: fmt(moderateOverdue.reduce((s, c) => s + c.amount, 0)),
        });
      }

      setData({
        revenueInRange,
        revenuePriorPeriod,
        pendingAmount,
        pendingCount,
        collectionRate,
        dueInRangeUnpaid,
        overdueAmount,
        overdueCount,
        avgTicket,
        expensesInRange,
        netProfit,
        expensesByCategory,
        activeBeneficiaries: beneficiariesRes.count || 0,
        activeEnrollments: (enrollmentsActiveRes as any).count || 0,
        attendanceRateRange,
        newEnrollmentsInRange: (enrollmentsNewRes as any).count || 0,
        scheduledAppointments,
        conversionRate,
        pendingDeposits,
        revenueTrend,
        attendanceStats,
        paymentMethodStats,
        topServices,
        overdueCharges,
        alerts,
      });
    } catch (err: any) {
      console.error('Error loading financial dashboard:', err);
      toast.error('No se pudo cargar el reporte: ' + (err?.message || 'error desconocido'));
    } finally {
      setLoading(false);
      setLastRefresh(new Date());
    }
  }, [currentOrg, appliedRange]);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  const revTrend =
    data && data.revenuePriorPeriod > 0
      ? Math.abs(((data.revenueInRange - data.revenuePriorPeriod) / data.revenuePriorPeriod) * 100).toFixed(1) + '%'
      : undefined;
  const revTrendUp = data ? data.revenueInRange >= data.revenuePriorPeriod : true;
  const attTotal = data?.attendanceStats.reduce((s, a) => s + a.value, 0) ?? 0;
  const methodTotal = data?.paymentMethodStats.reduce((s, a) => s + a.value, 0) ?? 0;
  const categoryTotal = data?.expensesByCategory.reduce((s, a) => s + a.value, 0) ?? 0;
  const maxSvcAmount = data?.topServices[0]?.amount || 1;

  return (
    <div className="min-h-screen" style={{ background: 'linear-gradient(135deg, #f8faff 0%, #f0f4ff 100%)' }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-8">

        {/* ── Header ──────────────────────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Reportes y Finanzas</h1>
            <p className="text-sm text-slate-500 mt-0.5">
              Resumen financiero y operativo de {currentOrg?.name || 'tu centro'}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-slate-400">
              Actualizado: {lastRefresh.toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit' })}
            </span>
            <button
              onClick={loadDashboard}
              disabled={loading}
              className="flex items-center gap-2 text-sm font-semibold bg-white border border-slate-200 text-slate-700 px-4 py-2 rounded-xl hover:bg-slate-50 transition-colors disabled:opacity-50 shadow-sm"
            >
              <svg className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Actualizar
            </button>
          </div>
        </div>

        {/* ── Selector de rango ───────────────────────────────────────── */}
        <DateRangeControl
          draftPreset={draftPreset}
          setDraftPreset={setDraftPreset}
          draftStart={draftStart}
          setDraftStart={setDraftStart}
          draftEnd={draftEnd}
          setDraftEnd={setDraftEnd}
          appliedLabel={appliedLabel}
          onApply={handleApply}
          onClear={handleClear}
          loading={loading}
        />

        {/* ── Alerts Banner (a hoy) ───────────────────────────────────── */}
        {(data?.alerts.length ?? 0) > 0 && (
          <div className="space-y-2">
            {data!.alerts.map((alert, i) => {
              const s = severityStyles[alert.severity];
              return (
                <div key={i} className={`flex items-center gap-4 p-3.5 rounded-xl border-l-4 ${s.border} ${s.bg} shadow-sm`}>
                  <span className={`w-2 h-2 rounded-full flex-shrink-0 ${s.dot}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-800">{alert.title}</p>
                    <p className="text-xs text-slate-500">{alert.subtitle}</p>
                  </div>
                  <span className={`text-xs font-bold px-2.5 py-1 rounded-lg ${s.badge} flex-shrink-0`}>{alert.value}</span>
                  {alert.linkTo && (
                    <Link to={alert.linkTo} className="text-xs text-indigo-600 font-semibold hover:underline flex-shrink-0">Ver →</Link>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* ── Financial KPIs ──────────────────────────────────────────── */}
        <div>
          <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Resumen Financiero — {appliedLabel}</h2>
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
            <KpiCard
              loading={loading}
              color="bg-emerald-50 text-emerald-600"
              label="Ingresos del Período"
              value={fmt(data?.revenueInRange || 0)}
              sub={`vs ${fmt(data?.revenuePriorPeriod || 0)} período anterior`}
              trend={revTrend}
              trendUp={revTrendUp}
              icon={
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              }
            />
            <KpiCard
              loading={loading}
              color="bg-blue-50 text-blue-600"
              label="Cartera Pendiente"
              value={fmt(data?.pendingAmount || 0)}
              sub={`${data?.pendingCount || 0} cargo(s) sin liquidar — a hoy`}
              icon={
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
              }
            />
            <KpiCard
              loading={loading}
              color="bg-indigo-50 text-indigo-600"
              label="Tasa de Cobro"
              value={fmtPct(data?.collectionRate || 0)}
              sub={
                loading ? '—' :
                (data?.collectionRate || 0) >= 80
                  ? 'Excelente — sigue así 🎉'
                  : (data?.collectionRate || 0) >= 60
                  ? 'Bien — hay margen de mejora'
                  : 'Atención — tasa baja'
              }
              icon={
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              }
            />
            <KpiCard
              loading={loading}
              color="bg-red-50 text-red-600"
              label="Cobros Vencidos"
              value={fmt(data?.overdueAmount || 0)}
              sub={`${data?.overdueCount || 0} cargo(s) sin pago — a hoy`}
              icon={
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              }
            />
            <KpiCard
              loading={loading}
              color="bg-violet-50 text-violet-600"
              label="Ticket Promedio"
              value={fmt(data?.avgTicket || 0)}
              sub="ingreso del período / beneficiarios"
              icon={
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              }
            />
          </div>
        </div>

        {/* ── Gastos y Utilidad ────────────────────────────────────────── */}
        <div>
          <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Gastos y Utilidad — {appliedLabel}</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <KpiCard
              loading={loading}
              color="bg-rose-50 text-rose-600"
              label="Gastos del Período"
              value={fmt(data?.expensesInRange || 0)}
              sub="egresos registrados en el período"
              icon={<Wallet className="w-5 h-5" />}
            />
            <KpiCard
              loading={loading}
              color={(data?.netProfit || 0) >= 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}
              label="Utilidad Neta"
              value={fmt(data?.netProfit || 0)}
              sub="ingresos del período − gastos del período"
              icon={(data?.netProfit || 0) >= 0 ? <TrendingUp className="w-5 h-5" /> : <TrendingDown className="w-5 h-5" />}
            />
          </div>
        </div>

        {/* Collection Rate Progress Bar */}
        {!loading && (
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-slate-600">Progreso de cobro del período</span>
              <span className="text-xs font-bold text-indigo-600">{fmtPct(data?.collectionRate || 0)} cobrado</span>
            </div>
            <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-1000"
                style={{
                  width: `${data?.collectionRate || 0}%`,
                  background: `linear-gradient(90deg, ${(data?.collectionRate || 0) >= 80 ? '#10b981' : (data?.collectionRate || 0) >= 60 ? '#f59e0b' : '#f43f5e'} 0%, ${(data?.collectionRate || 0) >= 80 ? '#059669' : (data?.collectionRate || 0) >= 60 ? '#d97706' : '#dc2626'} 100%)`,
                }}
              />
            </div>
            <div className="flex justify-between mt-1">
              <span className="text-[10px] text-slate-400">Cobrado: {fmt(data?.revenueInRange || 0)}</span>
              <span className="text-[10px] text-slate-400">Vencía en el período y sigue sin pagar: {fmt(data?.dueInRangeUnpaid || 0)}</span>
            </div>
          </div>
        )}

        {/* ── Operational KPIs ─────────────────────────────────────────── */}
        <div>
          <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Operaciones</h2>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <KpiCard
              loading={loading}
              color="bg-violet-50 text-violet-600"
              label="Beneficiarios Activos"
              value={String(data?.activeBeneficiaries || 0)}
              sub="niños/pacientes en el centro — a hoy"
              icon={
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              }
            />
            <KpiCard
              loading={loading}
              color="bg-cyan-50 text-cyan-600"
              label="Inscripciones Activas"
              value={String(data?.activeEnrollments || 0)}
              sub={`${data?.newEnrollmentsInRange || 0} nueva(s) en el período`}
              icon={
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              }
            />
            <KpiCard
              loading={loading}
              color="bg-emerald-50 text-emerald-600"
              label="Tasa de Asistencia"
              value={fmtPct(data?.attendanceRateRange || 0)}
              sub="presente o tardanza / sesiones del período"
              icon={
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                </svg>
              }
            />
            <KpiCard
              loading={loading}
              color="bg-amber-50 text-amber-600"
              label="Nuevas Matrículas"
              value={String(data?.newEnrollmentsInRange || 0)}
              sub="inscripciones creadas en el período"
              icon={
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                </svg>
              }
            />
          </div>
        </div>

        {/* ── Conversion KPIs ──────────────────────────────────────────── */}
        <div>
          <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Captación y Conversión</h2>
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
            <KpiCard
              loading={loading}
              color="bg-indigo-50 text-indigo-600"
              label="Citas Agendadas"
              value={String(data?.scheduledAppointments || 0)}
              sub="pendientes de atender — a hoy"
              icon={
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              }
            />
            <KpiCard
              loading={loading}
              color="bg-emerald-50 text-emerald-600"
              label="Tasa de Conversión"
              value={fmtPct(data?.conversionRate || 0)}
              sub="citas del período que se matricularon"
              icon={
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                </svg>
              }
            />
            <KpiCard
              loading={loading}
              color="bg-amber-50 text-amber-600"
              label="Depósitos por Cobrar"
              value={fmt(data?.pendingDeposits || 0)}
              sub="de citas programadas con depósito — a hoy"
              icon={
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              }
            />
          </div>
        </div>

        {/* ── Charts Row: Tendencia + Asistencia + Método de Pago ────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-stretch">
          <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-100 shadow-sm p-5 flex flex-col">
            <div className="flex items-start justify-between mb-1">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Ingresos</h3>
                <p className="text-xs text-slate-400">{appliedLabel}</p>
              </div>
              {!loading && (
                <p className="text-xl font-extrabold text-indigo-600 tracking-tight">{fmt(data?.revenueInRange || 0)}</p>
              )}
            </div>
            <div className="flex-1 flex items-end mt-3">
              {loading ? (
                <div className="w-full animate-pulse bg-slate-100 rounded-xl" style={{ height: `${BAR_MAX_HEIGHT + BAR_LABEL_SPACE}px` }} />
              ) : (data?.revenueTrend || []).every((d) => d.amount === 0) ? (
                <div className="w-full flex items-center justify-center text-slate-400 text-sm" style={{ height: `${BAR_MAX_HEIGHT + BAR_LABEL_SPACE}px` }}>Sin ingresos en el período</div>
              ) : (
                <BarChart data={data?.revenueTrend || []} />
              )}
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 flex flex-col">
            <div className="mb-1">
              <h3 className="text-sm font-bold text-slate-900">Asistencia</h3>
              <p className="text-xs text-slate-400">Distribución de sesiones — {appliedLabel}</p>
            </div>
            <div className="flex-1 flex items-center justify-center mt-3 min-h-[150px]">
              {loading ? (
                <div className="h-32 w-full animate-pulse bg-slate-100 rounded-xl" />
              ) : attTotal === 0 ? (
                <div className="flex flex-col items-center gap-2 text-slate-400">
                  <svg className="w-8 h-8 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                  <span className="text-sm">Sin datos de asistencia</span>
                </div>
              ) : (
                <DonutChart stats={data!.attendanceStats} total={attTotal} centerLabel="sesiones" />
              )}
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 flex flex-col">
            <div className="flex items-center gap-2 mb-1">
              <CreditCard className="w-4 h-4 text-slate-400 shrink-0" />
              <div>
                <h3 className="text-sm font-bold text-slate-900">Método de Pago</h3>
                <p className="text-xs text-slate-400">{appliedLabel}</p>
              </div>
            </div>
            <div className="flex-1 flex items-center justify-center mt-3 min-h-[150px]">
              {loading ? (
                <div className="h-32 w-full animate-pulse bg-slate-100 rounded-xl" />
              ) : methodTotal === 0 ? (
                <div className="flex flex-col items-center gap-2 text-slate-400">
                  <CreditCard className="w-8 h-8 text-slate-300" />
                  <span className="text-sm">Sin pagos en el período</span>
                </div>
              ) : (
                <DonutChart stats={data!.paymentMethodStats} total={methodTotal} centerLabel="cobrado" formatValue={fmt} />
              )}
            </div>
          </div>
        </div>

        {/* ── Bottom Row: Top Services + Gastos por Categoría + Overdue ──── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
            <div className="mb-4">
              <h3 className="text-sm font-bold text-slate-900">Servicios por Ingreso</h3>
              <p className="text-xs text-slate-400">Basado en pagos recibidos — {appliedLabel}</p>
            </div>
            {loading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => <div key={i} className="h-8 animate-pulse bg-slate-100 rounded-lg" />)}
              </div>
            ) : (data?.topServices.length || 0) === 0 ? (
              <div className="h-24 flex items-center justify-center text-slate-400 text-sm">Sin pagos en el período</div>
            ) : (
              <div className="space-y-4">
                {data!.topServices.map((svc, i) => (
                  <HorizBar key={svc.name} name={svc.name} amount={svc.amount} max={maxSvcAmount} rank={i + 1} />
                ))}
              </div>
            )}
          </div>

          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
            <div className="flex items-center gap-2 mb-4">
              <Wallet className="w-4 h-4 text-slate-400 shrink-0" />
              <div>
                <h3 className="text-sm font-bold text-slate-900">Gastos por Categoría</h3>
                <p className="text-xs text-slate-400">{appliedLabel}</p>
              </div>
            </div>
            {loading ? (
              <div className="h-32 animate-pulse bg-slate-100 rounded-xl" />
            ) : categoryTotal === 0 ? (
              <div className="h-32 flex flex-col items-center justify-center gap-2 text-slate-400">
                <Wallet className="w-8 h-8 text-slate-300" />
                <span className="text-sm">Sin gastos en el período</span>
              </div>
            ) : (
              <DonutChart stats={data!.expensesByCategory} total={categoryTotal} centerLabel="en gastos" formatValue={fmt} />
            )}
          </div>

          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Cobros Vencidos</h3>
                <p className="text-xs text-slate-400">Pendientes sin pago — a hoy</p>
              </div>
              <Link to="/app/cobros" className="text-xs font-semibold text-indigo-600 hover:underline">
                Ver todos →
              </Link>
            </div>
            {loading ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => <div key={i} className="h-10 animate-pulse bg-slate-100 rounded-lg" />)}
              </div>
            ) : (data?.overdueCharges.length || 0) === 0 ? (
              <div className="h-24 flex flex-col items-center justify-center gap-2 text-slate-400 text-sm">
                <svg className="w-8 h-8 text-emerald-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                ¡Sin cobros vencidos! Todo al día.
              </div>
            ) : (
              <div className="divide-y divide-slate-50">
                {data!.overdueCharges.slice(0, 6).map((charge) => (
                  <div key={charge.id} className="py-2.5 flex items-center gap-3">
                    <div className={`w-2 h-8 rounded-full flex-shrink-0 ${charge.days_overdue > 60 ? 'bg-red-500' : 'bg-amber-400'}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-slate-800 truncate">{charge.beneficiary_name}</p>
                      <p className="text-[10px] text-slate-400 truncate">{charge.description}</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-xs font-bold text-slate-900">{fmt(charge.amount)}</p>
                      <p className={`text-[10px] font-semibold ${charge.days_overdue > 60 ? 'text-red-500' : 'text-amber-500'}`}>
                        {charge.days_overdue}d vencido
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-slate-400 pb-4">
          Los datos financieros y operativos siguen el período elegido arriba; cartera vencida y beneficiarios/inscripciones activas se muestran siempre a la fecha de hoy.
        </p>
      </div>
    </div>
  );
}
