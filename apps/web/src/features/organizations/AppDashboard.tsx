import { useState, useEffect } from 'react';
import { Link } from 'react-router';
import { useOrg } from './OrgContext';
import { supabase } from '../../lib/supabase';
import { formatDateWithWeekday } from '../../lib/formatDate';
import { Skeleton, SkeletonCards } from '../../components/ui/Skeleton';
import {
  CalendarCheck,
  DollarSign,
  Baby,
  TrendingUp,
  ArrowRight,
  CheckCircle,
  Clock,
  AlertCircle,
  PlusCircle,
  Calendar,
} from 'lucide-react';

import { DashboardCalendar } from './DashboardCalendar';

type KpiData = {
  totalBeneficiarios: number;
  asistenciaHoy: number;
  cobrosPendientes: number;
  nuevosMesActual: number;
  totalCobradoMes: number;
  pendienteMes: number;
};

type RecentCharge = {
  id: string;
  description: string;
  amount: number;
  status: string;
  due_date: string | null;
  beneficiary_id: string | null;
  beneficiary_name: string;
};

type TodayItem = {
  id: string;
  time: string | null;
  title: string;
  subtitle?: string;
  kind: 'appointment' | 'attendance';
  status: string;
};

export function AppDashboard() {
  const { currentOrg, currentRole } = useOrg();
  // Profesional/Staff solo ven el calendario — nada de cifras de cobros
  // ni accesos rápidos a áreas administrativas/financieras.
  const isOwnerOrAdmin = currentRole === 'owner' || currentRole === 'admin';
  const [kpis, setKpis] = useState<KpiData | null>(null);
  const [recentCharges, setRecentCharges] = useState<RecentCharge[]>([]);
  const [todayAgenda, setTodayAgenda] = useState<TodayItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentOrg) return;
    loadDashboardData();
  }, [currentOrg]);

  const loadDashboardData = async () => {
    if (!currentOrg) return;
    setLoading(true);

    try {
      const today = new Date().toISOString().split('T')[0];
      const firstOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1)
        .toISOString()
        .split('T')[0];

      const [
        { count: totalBen },
        { count: asistHoy },
        { data: chargesData },
        { count: nuevosMes },
        { data: paymentsData },
        { data: attendanceTodayData },
        { data: appointmentsTodayData },
      ] = await Promise.all([
        supabase
          .from('beneficiaries')
          .select('id', { count: 'exact', head: true })
          .eq('organization_id', currentOrg.id)
          .eq('is_active', true),
        supabase
          .from('attendance')
          .select('id', { count: 'exact', head: true })
          .eq('organization_id', currentOrg.id)
          .eq('session_date', today)
          .eq('status', 'present'),
        supabase
          .from('charges')
          .select('id, description, amount, status, due_date, beneficiary_id, internal_payments(amount)')
          .eq('organization_id', currentOrg.id)
          .in('status', ['pending', 'partial'])
          .order('due_date', { ascending: true })
          .limit(5),
        supabase
          .from('beneficiaries')
          .select('id', { count: 'exact', head: true })
          .eq('organization_id', currentOrg.id)
          .gte('created_at', firstOfMonth),
        supabase
          .from('internal_payments')
          .select('amount')
          .eq('organization_id', currentOrg.id)
          .gte('payment_date', firstOfMonth),
        // Reemplaza a "Acciones Rápidas" — sesiones/asistencia de hoy, sin
        // importar el mes que esté navegando el calendario de al lado.
        (supabase as any)
          .from('attendance')
          .select('id, status, scheduled_time, beneficiaries(first_name, last_name)')
          .eq('organization_id', currentOrg.id)
          .eq('session_date', today),
        supabase
          .from('appointments')
          .select('id, patient_name, representative_name, time_slot, status, therapy_type')
          .eq('organization_id', currentOrg.id)
          .eq('appointment_date', today),
      ]);

      // Get beneficiary names for recent charges
      const charges = chargesData || [];
      const benIds = [...new Set(charges.map((c: any) => c.beneficiary_id).filter(Boolean))];
      let benMap: Record<string, string> = {};
      if (benIds.length > 0) {
        const { data: bens } = await supabase
          .from('beneficiaries')
          .select('id, first_name, last_name')
          .in('id', benIds as string[]);
        if (bens) {
          benMap = Object.fromEntries(
            bens.map((b: any) => [b.id, `${b.first_name} ${b.last_name}`])
          );
        }
      }

      // "Pendiente" means the outstanding balance, not the full charge —
      // a partially-paid charge should only count what's left to collect.
      const remainingOf = (c: any) => {
        const paid = (c.internal_payments || []).reduce((s: number, p: any) => s + (p.amount || 0), 0);
        return Math.max(0, (c.amount || 0) - paid);
      };
      const pendingTotal = charges.reduce((acc: number, c: any) => acc + remainingOf(c), 0);
      const cobradoMes = (paymentsData || []).reduce(
        (acc: number, p: any) => acc + (p.amount || 0),
        0
      );

      setKpis({
        totalBeneficiarios: totalBen || 0,
        asistenciaHoy: asistHoy || 0,
        cobrosPendientes: pendingTotal,
        nuevosMesActual: nuevosMes || 0,
        totalCobradoMes: cobradoMes,
        pendienteMes: pendingTotal,
      });

      setRecentCharges(
        charges.map((c: any) => ({
          id: c.id,
          description: c.description,
          amount: remainingOf(c),
          status: c.status,
          due_date: c.due_date,
          beneficiary_id: c.beneficiary_id || null,
          beneficiary_name: benMap[c.beneficiary_id] || 'Sin beneficiario',
        }))
      );

      // Agenda de hoy: sesiones/asistencia + citas de hoy, unificadas y
      // ordenadas por hora (las que no tienen hora quedan al final).
      const attendanceItems: TodayItem[] = (attendanceTodayData || []).map((a: any) => ({
        id: `att-${a.id}`,
        time: a.scheduled_time ? a.scheduled_time.substring(0, 5) : null,
        title: a.beneficiaries ? `${a.beneficiaries.first_name} ${a.beneficiaries.last_name}` : 'Beneficiario',
        kind: 'attendance',
        status: a.status,
      }));
      const appointmentItems: TodayItem[] = (appointmentsTodayData || []).map((a: any) => ({
        id: `apt-${a.id}`,
        time: a.time_slot ? a.time_slot.substring(0, 5) : null,
        title: a.patient_name,
        subtitle: a.therapy_type || `Tutor: ${a.representative_name}`,
        kind: 'appointment',
        status: a.status,
      }));
      const agenda = [...appointmentItems, ...attendanceItems].sort((x, y) => {
        if (x.time && y.time) return x.time.localeCompare(y.time);
        if (x.time) return -1;
        if (y.time) return 1;
        return 0;
      });
      setTodayAgenda(agenda);
    } catch (err) {
      console.error('Error cargando datos del dashboard:', err);
    } finally {
      setLoading(false);
    }
  };

  const statusColor = (status: string) => {
    if (status === 'pending') return 'bg-amber-100 text-amber-700';
    if (status === 'partial') return 'bg-indigo-100 text-indigo-700';
    if (status === 'paid') return 'bg-emerald-100 text-emerald-700';
    return 'bg-red-100 text-red-700';
  };
  const statusLabel = (status: string) => {
    if (status === 'pending') return 'Pendiente';
    if (status === 'partial') return 'Parcial';
    if (status === 'paid') return 'Pagado';
    return 'Anulado';
  };

  const agendaStatusStyle = (item: TodayItem) => {
    if (item.kind === 'appointment') {
      if (item.status === 'converted') return { label: 'Matriculado', color: 'bg-emerald-100 text-emerald-700' };
      if (item.status === 'confirmed') return { label: 'Confirmada', color: 'bg-indigo-100 text-indigo-700' };
      if (item.status === 'cancelled') return { label: 'Cancelada', color: 'bg-slate-100 text-slate-500' };
      return { label: 'Cita agendada', color: 'bg-indigo-100 text-indigo-700' };
    }
    if (item.status === 'present') return { label: 'Presente', color: 'bg-emerald-100 text-emerald-700' };
    if (item.status === 'late') return { label: 'Tardanza', color: 'bg-amber-100 text-amber-700' };
    if (item.status === 'justified') return { label: 'Justificada', color: 'bg-indigo-100 text-indigo-700' };
    if (item.status === 'absent') return { label: 'Ausente', color: 'bg-red-100 text-red-700' };
    return { label: 'Sesión programada', color: 'bg-cyan-100 text-cyan-700' };
  };

  if (!currentOrg) return null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{currentOrg.name}</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {formatDateWithWeekday(new Date())}
          </p>
        </div>
        {isOwnerOrAdmin && (
          <div className="flex items-center gap-2">
            <Link
              to="/app/matricula"
              className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-semibold shadow-sm transition-colors"
            >
              <PlusCircle className="w-4 h-4" />
              Nueva Matrícula
            </Link>
          </div>
        )}
      </div>

      {!isOwnerOrAdmin ? (
        <div className="animate-fadeInUp" style={{ animationDelay: '80ms' }}>
          <DashboardCalendar />
        </div>
      ) : (
      <>
      {/* KPIs */}
      {loading ? (
        <SkeletonCards count={4} />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
          <KpiCard
            icon={<Baby className="w-6 h-6 text-indigo-600" />}
            iconBg="bg-indigo-50"
            label="Beneficiarios Activos"
            value={kpis?.totalBeneficiarios ?? 0}
            subLabel={`+${kpis?.nuevosMesActual ?? 0} este mes`}
            link="/app/beneficiarios"
            delayMs={0}
          />
          <KpiCard
            icon={<CalendarCheck className="w-6 h-6 text-emerald-600" />}
            iconBg="bg-emerald-50"
            label="Asistencia Hoy"
            value={kpis?.asistenciaHoy ?? 0}
            subLabel="presentes registrados"
            link="/app/asistencia"
            delayMs={60}
          />
          <KpiCard
            icon={<DollarSign className="w-6 h-6 text-amber-600" />}
            iconBg="bg-amber-50"
            label="Cobros Pendientes"
            value={`$${(kpis?.cobrosPendientes ?? 0).toFixed(2)}`}
            subLabel="por cobrar"
            link="/app/cobros"
            delayMs={120}
          />
          <KpiCard
            icon={<TrendingUp className="w-6 h-6 text-violet-600" />}
            iconBg="bg-violet-50"
            label="Cobrado Este Mes"
            value={`$${(kpis?.totalCobradoMes ?? 0).toFixed(2)}`}
            subLabel="pagos recibidos"
            link="/app/cobros"
            delayMs={180}
          />
        </div>
      )}

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 items-start">
        {/* Left Column (3/5 width): Hero Interactive Calendar */}
        <div className="lg:col-span-3 space-y-6 animate-fadeInUp" style={{ animationDelay: '220ms' }}>
          <DashboardCalendar />
        </div>

        {/* Right Column (2/5 width): Agenda de Hoy & Cobros Pendientes */}
        <div className="lg:col-span-2 space-y-6">
          {/* Agenda de Hoy Widget */}
          <div className="bg-white rounded-2xl shadow-xs border border-slate-200 overflow-hidden animate-fadeInUp" style={{ animationDelay: '260ms' }}>
            <div className="flex items-center justify-between p-5 border-b border-slate-100 bg-slate-50/50">
              <h2 className="font-bold text-slate-900 flex items-center gap-2 text-sm">
                <Calendar className="w-4 h-4 text-indigo-500" />
                Agenda de Hoy
              </h2>
              <span className="text-xs text-slate-400">{formatDateWithWeekday(new Date())}</span>
            </div>
            {loading ? (
              <div className="p-4 space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <div className="space-y-1.5 flex-1">
                      <Skeleton className="h-3 w-2/3" />
                      <Skeleton className="h-2.5 w-1/3" />
                    </div>
                    <Skeleton className="h-3 w-10 ml-3" />
                  </div>
                ))}
              </div>
            ) : todayAgenda.length === 0 ? (
              <div className="p-8 text-center text-slate-400">
                <Calendar className="w-9 h-9 text-slate-300 mx-auto mb-2" />
                <p className="text-xs font-semibold">Sin citas ni sesiones agendadas para hoy.</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100 max-h-72 overflow-y-auto">
                {todayAgenda.map((item) => {
                  const s = agendaStatusStyle(item);
                  return (
                    <div key={item.id} className="flex items-center justify-between px-4 py-3">
                      <div className="min-w-0 pr-2">
                        <p className="text-xs font-bold text-slate-900 truncate">{item.title}</p>
                        {item.subtitle && <p className="text-[11px] text-slate-500 truncate">{item.subtitle}</p>}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {item.time && (
                          <span className="text-[11px] font-semibold text-slate-500 flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {item.time}
                          </span>
                        )}
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${s.color}`}>{s.label}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          {/* Cobros Pendientes Widget */}
          <div className="bg-white rounded-2xl shadow-xs border border-slate-200 overflow-hidden animate-fadeInUp" style={{ animationDelay: '260ms' }}>
            <div className="flex items-center justify-between p-5 border-b border-slate-100 bg-slate-50/50">
              <h2 className="font-bold text-slate-900 flex items-center gap-2 text-sm">
                <AlertCircle className="w-4 h-4 text-amber-500" />
                Cobros Pendientes
              </h2>
              <Link to="/app/cobros" className="text-xs text-indigo-600 font-semibold hover:underline flex items-center gap-1">
                Ver todos <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
            {loading ? (
              <div className="p-4 space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <div className="space-y-1.5 flex-1">
                      <Skeleton className="h-3 w-2/3" />
                      <Skeleton className="h-2.5 w-1/3" />
                    </div>
                    <Skeleton className="h-3 w-10 ml-3" />
                  </div>
                ))}
              </div>
            ) : recentCharges.length === 0 ? (
              <div className="p-8 text-center text-slate-400">
                <CheckCircle className="w-9 h-9 text-emerald-400 mx-auto mb-2" />
                <p className="text-xs font-semibold text-emerald-700">¡Todo al día! No hay cobros pendientes.</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {recentCharges.map((charge) => {
                  const content = (
                    <>
                      <div className="min-w-0 pr-2">
                        <p className="text-xs font-bold text-slate-900 truncate">{charge.description}</p>
                        <p className="text-[11px] text-slate-500 truncate">{charge.beneficiary_name}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-xs font-extrabold text-slate-900">${charge.amount.toFixed(2)}</span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${statusColor(charge.status)}`}>
                          {statusLabel(charge.status)}
                        </span>
                      </div>
                    </>
                  );
                  return charge.beneficiary_id ? (
                    <Link
                      key={charge.id}
                      to={`/app/beneficiarios/${charge.beneficiary_id}`}
                      className="flex items-center justify-between px-4 py-3 hover:bg-indigo-50 transition-colors cursor-pointer"
                      title="Ver beneficiario y cobrar"
                    >
                      {content}
                    </Link>
                  ) : (
                    <Link
                      key={charge.id}
                      to="/app/cobros"
                      className="flex items-center justify-between px-4 py-3 hover:bg-indigo-50 transition-colors cursor-pointer"
                      title="Ir a Cobros y Servicios"
                    >
                      {content}
                    </Link>
                  );
                })}
              </div>
            )}
          </div>

          {/* Primeros Pasos si no hay beneficiarios */}
          {(kpis?.totalBeneficiarios === 0) && (
            <div className="bg-indigo-50 border border-indigo-200 rounded-2xl p-5 animate-fadeInUp" style={{ animationDelay: '340ms' }}>
              <h3 className="font-bold text-indigo-900 mb-2 flex items-center gap-2 text-xs uppercase tracking-wider">
                <Clock className="w-4 h-4" />
                Primeros Pasos
              </h3>
              <ul className="space-y-2 text-xs font-medium text-indigo-800">
                <li className="flex items-start gap-1.5">
                  <span className="font-bold text-indigo-600">1.</span>
                  <Link to="/app/beneficiarios" className="underline hover:text-indigo-950">Registra tus primeros beneficiarios</Link>
                </li>
                <li className="flex items-start gap-1.5">
                  <span className="font-bold text-indigo-600">2.</span>
                  <Link to="/app/representantes" className="underline hover:text-indigo-950">Añade sus representantes</Link>
                </li>
                <li className="flex items-start gap-1.5">
                  <span className="font-bold text-indigo-600">3.</span>
                  <Link to="/app/cobros" className="underline hover:text-indigo-950">Genera los primeros cobros</Link>
                </li>
              </ul>
            </div>
          )}
        </div>
      </div>
      </>
      )}
    </div>
  );
}

function KpiCard({
  icon,
  iconBg,
  label,
  value,
  subLabel,
  link,
  delayMs = 0,
}: {
  icon: React.ReactNode;
  iconBg: string;
  label: string;
  value: string | number;
  subLabel: string;
  link: string;
  delayMs?: number;
}) {
  return (
    <Link
      to={link}
      className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 flex items-center gap-4 hover:border-slate-300 hover:shadow-md transition-all group animate-fadeInUp"
      style={{ animationDelay: `${delayMs}ms` }}
    >
      <div className={`w-12 h-12 rounded-xl ${iconBg} flex items-center justify-center shrink-0`}>{icon}</div>
      <div className="min-w-0">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider truncate">{label}</p>
        <p className="text-2xl font-bold text-slate-900 leading-tight">{value}</p>
        <p className="text-xs text-slate-400 mt-0.5">{subLabel}</p>
      </div>
    </Link>
  );
}
