import { useState, useEffect, useCallback } from 'react';
import { useOrg } from './OrgContext';
import { supabase } from '../../lib/supabase';
import { Link } from 'react-router';

// ─── Types ────────────────────────────────────────────────────────────────────

type MonthlyRevenue = { month: string; label: string; amount: number };
type AttendanceStat = { status: string; count: number; color: string; label: string };
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
  // Financial KPIs
  revenueThisMonth: number;
  revenueLastMonth: number;
  pendingAmount: number;
  pendingCount: number;
  collectionRate: number;
  overdueAmount: number;
  overdueCount: number;
  // Operational KPIs
  activeBeneficiaries: number;
  activeEnrollments: number;
  attendanceRateWeek: number;
  newEnrollmentsMonth: number;
  // Conversion KPIs
  scheduledAppointments: number;
  conversionRate: number;
  pendingDeposits: number;
  // Charts
  monthlyRevenue: MonthlyRevenue[];
  attendanceStats: AttendanceStat[];
  topServices: ServiceRevenue[];
  // Alerts
  overdueCharges: OverdueCharge[];
  alerts: AlertItem[];
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

const fmt = (n: number) =>
  new Intl.NumberFormat('es-EC', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }).format(n);

const fmtPct = (n: number) => `${Math.round(n)}%`;

function getMonthBounds(offset = 0) {
  const d = new Date();
  const first = new Date(d.getFullYear(), d.getMonth() + offset, 1);
  const last = new Date(d.getFullYear(), d.getMonth() + offset + 1, 0);
  return {
    start: first.toISOString().split('T')[0],
    end: last.toISOString().split('T')[0],
  };
}

function getWeekBounds() {
  const d = new Date();
  const day = d.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  const monday = new Date(d);
  monday.setDate(d.getDate() + mondayOffset);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return {
    start: monday.toISOString().split('T')[0],
    end: sunday.toISOString().split('T')[0],
  };
}

const MONTH_NAMES_SHORT = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

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

function DonutChart({ stats, total }: { stats: AttendanceStat[]; total: number }) {
  const radius = 50;
  const cx = 70;
  const cy = 70;
  const circumference = 2 * Math.PI * radius;

  let cumulativeAngle = -90;

  return (
    <div className="flex items-center gap-6">
      <svg width="140" height="140" viewBox="0 0 140 140">
        <circle cx={cx} cy={cy} r={radius} fill="none" stroke="#f1f5f9" strokeWidth="20" />
        {stats.map((stat, i) => {
          if (total === 0 || stat.count === 0) return null;
          const pct = stat.count / total;
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
              style={{ transform: `rotate(${angle}deg)`, transformOrigin: `${cx}px ${cy}px` }}
            />
          );
        })}
        <text x={cx} y={cy - 5} textAnchor="middle" className="text-slate-900" fontSize="18" fontWeight="bold" fill="#0f172a">
          {total}
        </text>
        <text x={cx} y={cy + 12} textAnchor="middle" fontSize="9" fill="#94a3b8">sesiones</text>
      </svg>
      <div className="space-y-2">
        {stats.map((stat, i) => (
          <div key={i} className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: stat.color }} />
            <span className="text-xs text-slate-600">{stat.label}</span>
            <span className="ml-auto text-xs font-bold text-slate-800">{stat.count}</span>
            <span className="text-[10px] text-slate-400 w-8 text-right">
              {total > 0 ? `${Math.round((stat.count / total) * 100)}%` : '0%'}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function BarChart({ data }: { data: MonthlyRevenue[] }) {
  const maxVal = Math.max(...data.map((d) => d.amount), 1);
  return (
    <div className="flex items-end gap-2 h-32 w-full">
      {data.map((d, i) => {
        const heightPct = (d.amount / maxVal) * 100;
        const isLast = i === data.length - 1;
        return (
          <div key={d.month} className="flex flex-col items-center gap-1 flex-1 group/bar">
            <div className="relative w-full flex items-end justify-center" style={{ height: '100px' }}>
              {d.amount > 0 && (
                <div
                  className="absolute bottom-0 text-[9px] font-semibold text-white opacity-0 group-hover/bar:opacity-100 transition-opacity bg-slate-800/80 rounded px-1 py-0.5 -top-5 left-1/2 -translate-x-1/2 whitespace-nowrap z-10"
                  style={{ top: `${100 - heightPct}px`, transform: 'translate(-50%, -100%)' }}
                >
                  {fmt(d.amount)}
                </div>
              )}
              <div
                className={`w-full rounded-t-lg transition-all duration-500 ${isLast ? 'bg-indigo-500' : 'bg-indigo-200 group-hover/bar:bg-indigo-300'}`}
                style={{ height: `${Math.max(heightPct, d.amount > 0 ? 4 : 0)}%` }}
              />
            </div>
            <span className={`text-[10px] font-medium ${isLast ? 'text-indigo-600' : 'text-slate-400'}`}>{d.label}</span>
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

// ─── Main Component ────────────────────────────────────────────────────────────

export function FinancialDashboard() {
  const { currentOrg } = useOrg();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState(new Date());

  const loadDashboard = useCallback(async () => {
    if (!currentOrg) return;
    setLoading(true);

    const today = new Date().toISOString().split('T')[0];
    const thisMo = getMonthBounds(0);
    const lastMo = getMonthBounds(-1);
    const week = getWeekBounds();
    const overdueThreshold = new Date();
    overdueThreshold.setDate(overdueThreshold.getDate() - 30);
    const overdueDate = overdueThreshold.toISOString().split('T')[0];

    try {
      const [
        pmtThisMonthRes,
        pmtLastMonthRes,
        pmtSixMonthsRes,
        chargesPendingRes,
        chargesOverdueRes,
        beneficiariesRes,
        enrollmentsActiveRes,
        enrollmentsNewRes,
        attendanceWeekRes,
        attendanceMonthRes,
        appointmentsRes,
        serviceRevenueRes,
        overdueChargesRes,
        _absenceAlertsRes,
        nearCompletionRes,
      ] = await Promise.all([
        // 1. Revenue this month
        supabase
          .from('internal_payments')
          .select('amount')
          .eq('organization_id', currentOrg.id)
          .gte('payment_date', thisMo.start)
          .lte('payment_date', thisMo.end),

        // 2. Revenue last month
        supabase
          .from('internal_payments')
          .select('amount')
          .eq('organization_id', currentOrg.id)
          .gte('payment_date', lastMo.start)
          .lte('payment_date', lastMo.end),

        // 3. Revenue last 6 months (for chart)
        supabase
          .from('internal_payments')
          .select('amount, payment_date')
          .eq('organization_id', currentOrg.id)
          .gte('payment_date', (() => {
            const d = new Date();
            d.setMonth(d.getMonth() - 5);
            d.setDate(1);
            return d.toISOString().split('T')[0];
          })())
          .lte('payment_date', today),

        // 4. Pending charges
        supabase
          .from('charges')
          .select('amount, status')
          .eq('organization_id', currentOrg.id)
          .in('status', ['pending', 'partial']),

        // 5. Overdue charges summary
        supabase
          .from('charges')
          .select('amount, status, due_date')
          .eq('organization_id', currentOrg.id)
          .in('status', ['pending', 'partial'])
          .lt('due_date', today),

        // 6. Active beneficiaries
        supabase
          .from('beneficiaries')
          .select('id', { count: 'exact', head: true })
          .eq('organization_id', currentOrg.id)
          .eq('is_active', true),

        // 7. Active enrollments
        (supabase as any)
          .from('enrollments')
          .select('id', { count: 'exact', head: true })
          .eq('organization_id', currentOrg.id)
          .eq('status', 'active'),

        // 8. New enrollments this month
        (supabase as any)
          .from('enrollments')
          .select('id', { count: 'exact', head: true })
          .eq('organization_id', currentOrg.id)
          .gte('created_at', thisMo.start + 'T00:00:00')
          .lte('created_at', thisMo.end + 'T23:59:59'),

        // 9. Attendance this week
        (supabase as any)
          .from('attendance')
          .select('status')
          .eq('organization_id', currentOrg.id)
          .gte('session_date', week.start)
          .lte('session_date', week.end),

        // 10. Attendance this month (for donut)
        (supabase as any)
          .from('attendance')
          .select('status')
          .eq('organization_id', currentOrg.id)
          .gte('session_date', thisMo.start)
          .lte('session_date', thisMo.end),

        // 11. Appointments
        supabase
          .from('appointments')
          .select('status, deposit_amount')
          .eq('organization_id', currentOrg.id),

        // 12. Service revenue (charges joined with services)
        supabase
          .from('charges')
          .select('amount, description, status')
          .eq('organization_id', currentOrg.id)
          .in('status', ['paid', 'partial']),

        // 13. Overdue charges detail (> 30 days)
        supabase
          .from('charges')
          .select(`id, description, amount, due_date, status, beneficiaries(first_name, last_name)`)
          .eq('organization_id', currentOrg.id)
          .in('status', ['pending', 'partial'])
          .lt('due_date', overdueDate)
          .order('due_date', { ascending: true })
          .limit(8),

        // 14. Beneficiaries with too many absences
        (supabase as any)
          .from('commitments')
          .select('beneficiary_id, max_justified_absences, beneficiaries(first_name, last_name)')
          .eq('organization_id', currentOrg.id)
          .limit(20),

        // 15. Enrollments near completion
        (supabase as any)
          .from('enrollment_services')
          .select(`sessions_completed, total_sessions, services(name), enrollments(beneficiaries(first_name, last_name))`)
          .eq('status', 'active')
          .not('total_sessions', 'is', null)
          .limit(20),
      ]);

      // ─── Process Financial KPIs ───────────────────────────────────────────
      const revenueThisMonth = (pmtThisMonthRes.data || []).reduce((sum: number, p: any) => sum + Number(p.amount), 0);
      const revenueLastMonth = (pmtLastMonthRes.data || []).reduce((sum: number, p: any) => sum + Number(p.amount), 0);

      const pendingAmount = (chargesPendingRes.data || []).reduce((sum: number, c: any) => sum + Number(c.amount), 0);
      const pendingCount = chargesPendingRes.data?.length || 0;

      const overdueAmount = (chargesOverdueRes.data || []).reduce((sum: number, c: any) => sum + Number(c.amount), 0);
      const overdueCount = chargesOverdueRes.data?.length || 0;

      const totalBilled = revenueThisMonth + pendingAmount;
      const collectionRate = totalBilled > 0 ? (revenueThisMonth / totalBilled) * 100 : 0;

      // ─── Monthly Revenue Chart (last 6 months) ───────────────────────────
      const monthlyRevMap: Record<string, number> = {};
      (pmtSixMonthsRes.data || []).forEach((p: any) => {
        const d = new Date(p.payment_date);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        monthlyRevMap[key] = (monthlyRevMap[key] || 0) + Number(p.amount);
      });

      const monthlyRevenue: MonthlyRevenue[] = [];
      for (let i = 5; i >= 0; i--) {
        const d = new Date();
        d.setMonth(d.getMonth() - i);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        monthlyRevenue.push({
          month: key,
          label: MONTH_NAMES_SHORT[d.getMonth()],
          amount: monthlyRevMap[key] || 0,
        });
      }

      // ─── Attendance KPIs ─────────────────────────────────────────────────
      const weekAtt = attendanceWeekRes.data || [];
      const weekPresent = weekAtt.filter((a: any) => a.status === 'present' || a.status === 'late').length;
      const weekTotal = weekAtt.filter((a: any) => a.status !== 'scheduled').length;
      const attendanceRateWeek = weekTotal > 0 ? (weekPresent / weekTotal) * 100 : 0;

      const monthAtt = attendanceMonthRes.data || [];
      const attCounts: Record<string, number> = {};
      monthAtt.forEach((a: any) => {
        if (a.status !== 'scheduled') attCounts[a.status] = (attCounts[a.status] || 0) + 1;
      });
      const attendanceStats: AttendanceStat[] = [
        { status: 'present', count: attCounts['present'] || 0, color: '#10b981', label: 'Presentes' },
        { status: 'late', count: attCounts['late'] || 0, color: '#f59e0b', label: 'Tardanzas' },
        { status: 'justified', count: attCounts['justified'] || 0, color: '#6366f1', label: 'Justificadas' },
        { status: 'absent', count: attCounts['absent'] || 0, color: '#f43f5e', label: 'Ausentes' },
      ].filter((s) => s.count > 0);
      const attTotal = attendanceStats.reduce((s, a) => s + a.count, 0);

      // ─── Conversion KPIs ─────────────────────────────────────────────────
      const allAppts = appointmentsRes.data || [];
      const scheduledAppointments = allAppts.filter((a: any) => a.status === 'scheduled').length;
      const convertedAppts = allAppts.filter((a: any) => a.status === 'converted').length;
      const conversionRate = allAppts.length > 0 ? (convertedAppts / allAppts.length) * 100 : 0;
      const pendingDeposits = allAppts
        .filter((a: any) => a.status === 'scheduled' && a.deposit_amount > 0)
        .reduce((sum: number, a: any) => sum + Number(a.deposit_amount), 0);

      // ─── Top Services (by charge description grouping) ───────────────────
      const svcMap: Record<string, ServiceRevenue> = {};
      (serviceRevenueRes.data || []).forEach((c: any) => {
        const key = c.description || 'Otros';
        if (!svcMap[key]) svcMap[key] = { name: key, amount: 0, count: 0 };
        svcMap[key].amount += Number(c.amount);
        svcMap[key].count += 1;
      });
      const topServices = Object.values(svcMap)
        .sort((a, b) => b.amount - a.amount)
        .slice(0, 5);

      // ─── Overdue Charges Detail ───────────────────────────────────────────
      const overdueCharges: OverdueCharge[] = (overdueChargesRes.data || []).map((c: any) => {
        const ben = c.beneficiaries;
        const daysOverdue = Math.floor(
          (Date.now() - new Date(c.due_date).getTime()) / (1000 * 60 * 60 * 24)
        );
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

      // ─── Alerts ───────────────────────────────────────────────────────────
      const alerts: AlertItem[] = [];

      // Overdue > 60 days
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

      // Overdue 30–60 days
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

      // Near-completion enrollments
      const nearCompletion = (nearCompletionRes.data || []).filter((es: any) => {
        if (!es.total_sessions || es.sessions_completed == null) return false;
        const pct = es.sessions_completed / es.total_sessions;
        return pct >= 0.85 && pct < 1;
      });
      if (nearCompletion.length > 0) {
        alerts.push({
          type: 'sessions',
          severity: 'low',
          title: `${nearCompletion.length} inscripción(es) próximas a completarse`,
          subtitle: 'Considera renovar el plan de sesiones',
          value: `${nearCompletion.length} paciente(s)`,
          linkTo: '/app/beneficiarios',
        });
      }

      setData({
        revenueThisMonth,
        revenueLastMonth,
        pendingAmount,
        pendingCount,
        collectionRate,
        overdueAmount,
        overdueCount,
        activeBeneficiaries: beneficiariesRes.count || 0,
        activeEnrollments: (enrollmentsActiveRes as any).count || 0,
        attendanceRateWeek,
        newEnrollmentsMonth: (enrollmentsNewRes as any).count || 0,
        scheduledAppointments,
        conversionRate,
        pendingDeposits,
        monthlyRevenue,
        attendanceStats,
        topServices,
        overdueCharges,
        alerts,
      });
    } catch (err: any) {
      console.error('Error loading financial dashboard:', err);
    } finally {
      setLoading(false);
      setLastRefresh(new Date());
    }
  }, [currentOrg]);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  const revTrend =
    data && data.revenueLastMonth > 0
      ? Math.abs(((data.revenueThisMonth - data.revenueLastMonth) / data.revenueLastMonth) * 100).toFixed(1) + '%'
      : undefined;
  const revTrendUp = data ? data.revenueThisMonth >= data.revenueLastMonth : true;
  const attTotal = data?.attendanceStats.reduce((s, a) => s + a.count, 0) ?? 0;
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

        {/* ── Alerts Banner ───────────────────────────────────────────── */}
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
          <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Resumen Financiero — Este Mes</h2>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <KpiCard
              loading={loading}
              color="bg-emerald-50 text-emerald-600"
              label="Ingresos del Mes"
              value={fmt(data?.revenueThisMonth || 0)}
              sub={`vs ${fmt(data?.revenueLastMonth || 0)} mes anterior`}
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
              sub={`${data?.pendingCount || 0} cargo(s) sin liquidar`}
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
              sub={`${data?.overdueCount || 0} cargo(s) sin pago`}
              icon={
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              }
            />
          </div>
        </div>

        {/* Collection Rate Progress Bar */}
        {!loading && (
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-slate-600">Progreso de cobro del mes</span>
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
              <span className="text-[10px] text-slate-400">Cobrado: {fmt(data?.revenueThisMonth || 0)}</span>
              <span className="text-[10px] text-slate-400">Pendiente: {fmt(data?.pendingAmount || 0)}</span>
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
              sub="niños/pacientes en el centro"
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
              sub={`${data?.newEnrollmentsMonth || 0} nueva(s) este mes`}
              icon={
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              }
            />
            <KpiCard
              loading={loading}
              color="bg-emerald-50 text-emerald-600"
              label="Asistencia Esta Semana"
              value={fmtPct(data?.attendanceRateWeek || 0)}
              sub="presente o tardanza / sesiones"
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
              value={String(data?.newEnrollmentsMonth || 0)}
              sub="inscripciones del mes actual"
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
              sub="pendientes de atender"
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
              sub="citas que se convirtieron en matrículas"
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
              sub="de citas programadas con depósito"
              icon={
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              }
            />
          </div>
        </div>

        {/* ── Charts Row ───────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Revenue Bar Chart */}
          <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Ingresos Mensuales</h3>
                <p className="text-xs text-slate-400">Últimos 6 meses</p>
              </div>
              <div className="w-3 h-3 rounded-full bg-indigo-500" />
            </div>
            {loading ? (
              <div className="h-32 animate-pulse bg-slate-100 rounded-xl" />
            ) : (
              <BarChart data={data?.monthlyRevenue || []} />
            )}
          </div>

          {/* Attendance Donut */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
            <div className="mb-4">
              <h3 className="text-sm font-bold text-slate-900">Asistencia del Mes</h3>
              <p className="text-xs text-slate-400">Distribución de sesiones</p>
            </div>
            {loading ? (
              <div className="h-32 animate-pulse bg-slate-100 rounded-xl" />
            ) : attTotal === 0 ? (
              <div className="h-32 flex items-center justify-center text-slate-400 text-sm">Sin datos de asistencia</div>
            ) : (
              <DonutChart stats={data!.attendanceStats} total={attTotal} />
            )}
          </div>
        </div>

        {/* ── Bottom Row: Top Services + Overdue Table ──────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Top Services */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
            <div className="mb-4">
              <h3 className="text-sm font-bold text-slate-900">Servicios por Ingreso</h3>
              <p className="text-xs text-slate-400">Basado en cobros pagados / parciales</p>
            </div>
            {loading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => <div key={i} className="h-8 animate-pulse bg-slate-100 rounded-lg" />)}
              </div>
            ) : (data?.topServices.length || 0) === 0 ? (
              <div className="h-24 flex items-center justify-center text-slate-400 text-sm">Sin datos de servicios</div>
            ) : (
              <div className="space-y-4">
                {data!.topServices.map((svc, i) => (
                  <HorizBar key={svc.name} name={svc.name} amount={svc.amount} max={maxSvcAmount} rank={i + 1} />
                ))}
              </div>
            )}
          </div>

          {/* Overdue Charges Table */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Cobros Vencidos</h3>
                <p className="text-xs text-slate-400">Pendientes sin pago a la fecha</p>
              </div>
              <Link
                to="/app/cobros"
                className="text-xs font-semibold text-indigo-600 hover:underline"
              >
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
          Los datos se calculan en tiempo real desde tu base de datos. Recarga para ver la información más reciente.
        </p>
      </div>
    </div>
  );
}
