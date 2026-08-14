import { useState, useEffect } from 'react';
import { Link } from 'react-router';
import { useOrg } from './OrgContext';
import { supabase } from '../../lib/supabase';
import {
  Users,
  CalendarCheck,
  DollarSign,
  Baby,
  TrendingUp,
  ArrowRight,
  CheckCircle,
  Clock,
  AlertCircle,
  UserPlus,
  PlusCircle,
  ClipboardList,
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
  beneficiary_name: string;
};

export function AppDashboard() {
  const { currentOrg } = useOrg();
  const [kpis, setKpis] = useState<KpiData | null>(null);
  const [recentCharges, setRecentCharges] = useState<RecentCharge[]>([]);
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
          .select('id, description, amount, status, due_date, beneficiary_id')
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

      const pendingTotal = charges.reduce((acc: number, c: any) => acc + (c.amount || 0), 0);
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
          amount: c.amount,
          status: c.status,
          due_date: c.due_date,
          beneficiary_name: benMap[c.beneficiary_id] || 'Sin beneficiario',
        }))
      );
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

  if (!currentOrg) return null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{currentOrg.name}</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {new Date().toLocaleDateString('es-EC', {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            to="/app/matricula"
            className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-semibold shadow-sm transition-colors"
          >
            <PlusCircle className="w-4 h-4" />
            Nueva Matrícula
          </Link>
        </div>
      </div>

      {/* KPIs */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-white rounded-2xl border border-slate-200 p-5 animate-pulse h-28" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard
            icon={<Baby className="w-6 h-6 text-indigo-600" />}
            iconBg="bg-indigo-50"
            label="Beneficiarios Activos"
            value={kpis?.totalBeneficiarios ?? 0}
            subLabel={`+${kpis?.nuevosMesActual ?? 0} este mes`}
            link="/app/beneficiarios"
          />
          <KpiCard
            icon={<CalendarCheck className="w-6 h-6 text-emerald-600" />}
            iconBg="bg-emerald-50"
            label="Asistencia Hoy"
            value={kpis?.asistenciaHoy ?? 0}
            subLabel="presentes registrados"
            link="/app/asistencia"
          />
          <KpiCard
            icon={<DollarSign className="w-6 h-6 text-amber-600" />}
            iconBg="bg-amber-50"
            label="Cobros Pendientes"
            value={`$${(kpis?.cobrosPendientes ?? 0).toFixed(2)}`}
            subLabel="por cobrar"
            link="/app/cobros"
          />
          <KpiCard
            icon={<TrendingUp className="w-6 h-6 text-violet-600" />}
            iconBg="bg-violet-50"
            label="Cobrado Este Mes"
            value={`$${(kpis?.totalCobradoMes ?? 0).toFixed(2)}`}
            subLabel="pagos recibidos"
            link="/app/cobros"
          />
        </div>
      )}

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Left Column (2/3 width): Hero Interactive Calendar */}
        <div className="lg:col-span-2 space-y-6">
          <DashboardCalendar />
        </div>

        {/* Right Column (1/3 width): Cobros Pendientes & Acciones Rápidas */}
        <div className="lg:col-span-1 space-y-6">
          {/* Cobros Pendientes Widget */}
          <div className="bg-white rounded-2xl shadow-xs border border-slate-200 overflow-hidden">
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
              <div className="p-8 text-center text-slate-400 animate-pulse text-xs">Cargando...</div>
            ) : recentCharges.length === 0 ? (
              <div className="p-8 text-center text-slate-400">
                <CheckCircle className="w-9 h-9 text-emerald-400 mx-auto mb-2" />
                <p className="text-xs font-semibold text-emerald-700">¡Todo al día! No hay cobros pendientes.</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {recentCharges.map((charge) => (
                  <div key={charge.id} className="flex items-center justify-between px-4 py-3 hover:bg-slate-50 transition-colors">
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
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Acciones Rápidas Widget */}
          <div className="bg-white rounded-2xl shadow-xs border border-slate-200 p-5">
            <h2 className="font-bold text-slate-900 mb-3.5 flex items-center gap-2 text-sm">
              <ClipboardList className="w-4 h-4 text-indigo-500" />
              Acciones Rápidas
            </h2>
            <div className="space-y-2">
              <QuickAction
                icon={<CalendarCheck className="w-4 h-4" />}
                label="Registrar Asistencia"
                to="/app/asistencia"
                color="indigo"
              />
              <QuickAction
                icon={<Baby className="w-4 h-4" />}
                label="Ver Beneficiarios"
                to="/app/beneficiarios"
                color="violet"
              />
              <QuickAction
                icon={<DollarSign className="w-4 h-4" />}
                label="Gestionar Cobros"
                to="/app/cobros"
                color="emerald"
              />
              <QuickAction
                icon={<UserPlus className="w-4 h-4" />}
                label="Invitar al Equipo"
                to="/app/equipo"
                color="amber"
              />
              <QuickAction
                icon={<Users className="w-4 h-4" />}
                label="Representantes"
                to="/app/representantes"
                color="slate"
              />
            </div>
          </div>

          {/* Primeros Pasos si no hay beneficiarios */}
          {(kpis?.totalBeneficiarios === 0) && (
            <div className="bg-indigo-50 border border-indigo-200 rounded-2xl p-5">
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
}: {
  icon: React.ReactNode;
  iconBg: string;
  label: string;
  value: string | number;
  subLabel: string;
  link: string;
}) {
  return (
    <Link
      to={link}
      className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 flex items-center gap-4 hover:border-slate-300 hover:shadow-md transition-all group"
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

function QuickAction({
  icon,
  label,
  to,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  to: string;
  color: 'indigo' | 'violet' | 'emerald' | 'amber' | 'slate';
}) {
  const colors = {
    indigo: 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100',
    violet: 'bg-violet-50 text-violet-700 hover:bg-violet-100',
    emerald: 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100',
    amber: 'bg-amber-50 text-amber-700 hover:bg-amber-100',
    slate: 'bg-slate-100 text-slate-700 hover:bg-slate-200',
  };
  return (
    <Link
      to={to}
      className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${colors[color]}`}
    >
      {icon}
      {label}
      <ArrowRight className="w-3.5 h-3.5 ml-auto opacity-60" />
    </Link>
  );
}
