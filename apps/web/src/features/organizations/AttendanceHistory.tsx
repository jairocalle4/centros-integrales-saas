import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router';
import { supabase } from '../../lib/supabase';
import { formatDate } from '../../lib/formatDate';
import { X, Search, History, CheckCircle, XCircle, Clock, AlertCircle, CalendarCheck } from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

export type AttendanceHistoryStatus = 'present' | 'absent' | 'late' | 'justified' | 'scheduled';

export interface AttendanceHistoryRow {
  id: string;
  session_date: string;
  scheduled_time: string;
  status: AttendanceHistoryStatus;
  actual_arrival_time: string | null;
  service_name: string;
  beneficiary_id: string;
  beneficiary_name: string;
  recorded_by_name: string | null;
}

// ─── Status badge (audit view — read-only, no actions) ─────────────────────────

const HISTORY_STATUS_CONFIG: Record<AttendanceHistoryStatus, { label: string; bg: string; text: string; icon: React.ReactNode }> = {
  present:   { label: 'Presente',     bg: 'bg-emerald-100', text: 'text-emerald-700', icon: <CheckCircle size={13} /> },
  absent:    { label: 'Ausente',      bg: 'bg-red-100',     text: 'text-red-700',     icon: <XCircle size={13} /> },
  late:      { label: 'Tarde',        bg: 'bg-amber-100',   text: 'text-amber-700',   icon: <Clock size={13} /> },
  justified: { label: 'Justificado',  bg: 'bg-blue-100',    text: 'text-blue-700',    icon: <AlertCircle size={13} /> },
  scheduled: { label: 'Sin registrar',bg: 'bg-slate-100',   text: 'text-slate-500',   icon: null },
};

function formatTime(timeStr: string | null): string {
  if (!timeStr) return '';
  const [h, m] = timeStr.split(':');
  return `${h}:${m}`;
}

/**
 * `attendance.recorded_by` FKs to `auth.users`, not `profiles`, so it can't
 * be embedded in one PostgREST select the way `organization_members.user_id`
 * is elsewhere. Resolve names with a follow-up lookup instead.
 */
async function resolveRecordedByNames(userIds: (string | null)[]): Promise<Record<string, string>> {
  const ids = Array.from(new Set(userIds.filter((id): id is string => !!id)));
  if (ids.length === 0) return {};
  const { data } = await supabase
    .from('profiles')
    .select('id, first_name, last_name')
    .in('id', ids);
  const map: Record<string, string> = {};
  for (const p of (data as any) || []) {
    map[p.id] = `${p.first_name ?? ''} ${p.last_name ?? ''}`.trim() || '—';
  }
  return map;
}

export { resolveRecordedByNames };

// ─── Table ────────────────────────────────────────────────────────────────────

export function AttendanceHistoryTable({
  rows,
  showBeneficiary = true,
  onBeforeNavigate,
}: {
  rows: AttendanceHistoryRow[];
  showBeneficiary?: boolean;
  /** Called right before navigating away (e.g. "Registrar") — lets a wrapping modal close itself first. */
  onBeforeNavigate?: () => void;
}) {
  const navigate = useNavigate();

  if (rows.length === 0) {
    return (
      <div className="py-16 text-center">
        <History className="w-12 h-12 text-slate-300 mx-auto mb-3" />
        <p className="font-semibold text-slate-600">Sin registros de asistencia.</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 text-[11px] uppercase font-bold text-slate-500 tracking-wider sticky top-0">
          <tr>
            <th className="px-4 py-3 text-left">Fecha</th>
            {showBeneficiary && <th className="px-4 py-3 text-left">Beneficiario</th>}
            <th className="px-4 py-3 text-left">Servicio</th>
            <th className="px-4 py-3 text-center">Hora Programada</th>
            <th className="px-4 py-3 text-center">Estado</th>
            <th className="px-4 py-3 text-center">Llegada</th>
            <th className="px-4 py-3 text-left">Registrado por</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map(row => {
            const cfg = HISTORY_STATUS_CONFIG[row.status];
            return (
              <tr key={row.id} className="hover:bg-slate-50">
                <td className="px-4 py-3 text-slate-700 whitespace-nowrap">{formatDate(row.session_date)}</td>
                {showBeneficiary && (
                  <td className="px-4 py-3 font-semibold text-slate-900">
                    <Link to={`/app/beneficiarios/${row.beneficiary_id}`} className="hover:text-indigo-700">
                      {row.beneficiary_name}
                    </Link>
                  </td>
                )}
                <td className="px-4 py-3 text-slate-600">{row.service_name}</td>
                <td className="px-4 py-3 text-center font-mono text-slate-700">{formatTime(row.scheduled_time)}</td>
                <td className="px-4 py-3 text-center">
                  <div className="flex flex-col items-center gap-1">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold ${cfg.bg} ${cfg.text}`}>
                      {cfg.icon}
                      {cfg.label}
                    </span>
                    {row.status === 'scheduled' && (
                      <button
                        type="button"
                        onClick={() => {
                          onBeforeNavigate?.();
                          navigate(`/app/asistencia?date=${row.session_date}`);
                        }}
                        title="Ir a Asistencia para registrar esta cita"
                        className="inline-flex items-center gap-1 text-[11px] font-bold text-indigo-600 hover:text-indigo-800 cursor-pointer"
                      >
                        <CalendarCheck className="w-3 h-3" />
                        Registrar
                      </button>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3 text-center font-mono text-slate-500">
                  {row.status === 'late' && row.actual_arrival_time ? formatTime(row.actual_arrival_time) : '—'}
                </td>
                <td className="px-4 py-3 text-slate-600">{row.recorded_by_name ?? '—'}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ─── Global filterable modal ────────────────────────────────────────────────────

function toLocalISODate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function daysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return toLocalISODate(d);
}

export function AttendanceHistoryModal({
  isOpen,
  onClose,
  organizationId,
}: {
  isOpen: boolean;
  onClose: () => void;
  organizationId: string;
}) {
  const [rows, setRows] = useState<AttendanceHistoryRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | AttendanceHistoryStatus>('all');
  const [dateFrom, setDateFrom] = useState(() => daysAgo(30));
  const [dateTo, setDateTo] = useState(() => toLocalISODate(new Date()));

  useEffect(() => {
    if (isOpen) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, dateFrom, dateTo]);

  const load = async () => {
    setLoading(true);
    try {
      const { data, error } = await (supabase as any)
        .from('attendance')
        .select(`
          id,
          session_date,
          scheduled_time,
          status,
          actual_arrival_time,
          recorded_by,
          service_id,
          services ( name ),
          beneficiaries ( id, first_name, last_name )
        `)
        .eq('organization_id', organizationId)
        .gte('session_date', dateFrom)
        .lte('session_date', dateTo)
        .order('session_date', { ascending: false })
        .order('scheduled_time', { ascending: true });
      if (error) throw error;

      const names = await resolveRecordedByNames((data ?? []).map((r: any) => r.recorded_by));

      const flat: AttendanceHistoryRow[] = (data ?? []).map((r: any) => ({
        id: r.id,
        session_date: r.session_date,
        scheduled_time: r.scheduled_time ?? '00:00:00',
        status: r.status,
        actual_arrival_time: r.actual_arrival_time,
        service_name: r.services?.name ?? '—',
        beneficiary_id: r.beneficiaries?.id ?? '',
        beneficiary_name: r.beneficiaries ? `${r.beneficiaries.first_name} ${r.beneficiaries.last_name}` : '—',
        recorded_by_name: r.recorded_by ? names[r.recorded_by] ?? '—' : null,
      }));
      setRows(flat);
    } catch (err) {
      console.error('Error cargando historial de asistencia:', err);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const filtered = rows.filter(r => {
    const q = search.toLowerCase().trim();
    const matchesSearch = !q || r.beneficiary_name.toLowerCase().includes(q);
    const matchesStatus = statusFilter === 'all' || r.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 overflow-y-auto animate-fadeIn">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-5xl my-8 overflow-hidden animate-popIn flex flex-col max-h-[85vh]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50 shrink-0">
          <div className="flex items-center gap-2">
            <History className="w-5 h-5 text-indigo-600" />
            <h3 className="text-lg font-bold text-slate-900">Historial de Asistencia</h3>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row flex-wrap gap-3 shrink-0">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por beneficiario..."
              className="w-full text-sm pl-9 pr-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              max={dateTo}
              className="text-sm border border-slate-200 rounded-lg px-2.5 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <span className="text-slate-400 text-sm">—</span>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              min={dateFrom}
              className="text-sm border border-slate-200 rounded-lg px-2.5 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="all">Todos los estados</option>
            <option value="present">Presente</option>
            <option value="late">Tarde</option>
            <option value="absent">Ausente</option>
            <option value="justified">Justificado</option>
            <option value="scheduled">Sin registrar</option>
          </select>
        </div>

        <div className="overflow-y-auto flex-1 p-4">
          {loading ? (
            <div className="p-10 text-center text-slate-400 animate-pulse text-sm">Cargando historial...</div>
          ) : (
            <AttendanceHistoryTable rows={filtered} showBeneficiary onBeforeNavigate={onClose} />
          )}
        </div>
      </div>
    </div>
  );
}
