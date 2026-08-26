import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { useOrg } from './OrgContext';
import { supabase } from '../../lib/supabase';
import toast from 'react-hot-toast';
import { useAuth } from '../auth/AuthProvider';
import { formatDateWithWeekday } from '../../lib/formatDate';
import { AttendanceHistoryModal } from './AttendanceHistory';
import {
  CalendarCheck,
  CheckCircle,
  XCircle,
  Clock,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Users,
  GraduationCap,
  ExternalLink,
  History,
  BookOpen,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

type AttendanceStatus = 'present' | 'absent' | 'late' | 'justified' | 'scheduled';

interface ScheduledSession {
  // Every row is a real public.attendance row for the selected date —
  // attendance is the single source of truth for what's scheduled, not a
  // day-of-week pattern re-derived on the fly.
  attendance_id: string;
  service_id: string;
  service_name: string;
  scheduled_time: string; // 'HH:MM:SS'
  beneficiary_id: string;
  first_name: string;
  last_name: string;
  status: AttendanceStatus;
  actual_arrival_time: string | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toLocalISODate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function formatDisplayDate(dateStr: string): string {
  return formatDateWithWeekday(dateStr);
}

function offsetDate(dateStr: string, days: number): string {
  const [year, month, day] = dateStr.split('-').map(Number);
  const d = new Date(year, month - 1, day + days);
  return toLocalISODate(d);
}

function formatTime(timeStr: string): string {
  if (!timeStr) return '';
  const [h, m] = timeStr.split(':');
  return `${h}:${m}`;
}

function nowTime(): string {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:00`;
}

function currentYearStart(): string {
  return `${new Date().getFullYear()}-01-01`;
}

// A check-in can be registered a few minutes early — staff mark kids as
// they physically arrive, which is often slightly before the scheduled
// start. 15 minutes matches the window agreed for this module.
const ARRIVAL_UNLOCK_MINUTES = 15;

function canRegisterArrival(selectedDate: string, scheduledTime: string): boolean {
  const sessionDateTime = new Date(`${selectedDate}T${scheduledTime}`);
  const unlockAt = new Date(sessionDateTime.getTime() - ARRIVAL_UNLOCK_MINUTES * 60000);
  return new Date() >= unlockAt;
}

function minusMinutes(timeStr: string, minutes: number): string {
  const [h, m] = timeStr.split(':').map(Number);
  const total = ((h * 60 + m - minutes) % 1440 + 1440) % 1440;
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

// ─── Status config ────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<AttendanceStatus, { label: string; badgeBg: string; badgeText: string; icon: React.ReactNode }> = {
  present: { label: 'Presente', badgeBg: 'bg-emerald-100', badgeText: 'text-emerald-700', icon: <CheckCircle size={14} /> },
  absent:  { label: 'Ausente',  badgeBg: 'bg-red-100',     badgeText: 'text-red-700',     icon: <XCircle size={14} /> },
  late:    { label: 'Tarde',    badgeBg: 'bg-amber-100',   badgeText: 'text-amber-700',   icon: <Clock size={14} /> },
  justified: { label: 'Justificado', badgeBg: 'bg-blue-100', badgeText: 'text-blue-700', icon: <AlertCircle size={14} /> },
  scheduled: { label: 'Sin registrar', badgeBg: 'bg-slate-100', badgeText: 'text-slate-500', icon: null },
};

// ─── StatusBadge ──────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: AttendanceStatus }) {
  const cfg = STATUS_CONFIG[status];
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${cfg.badgeBg} ${cfg.badgeText}`}>
      {cfg.icon}
      {cfg.label}
    </span>
  );
}

// ─── SummaryBar ───────────────────────────────────────────────────────────────

function SummaryBar({ sessions }: { sessions: ScheduledSession[] }) {
  const counts = sessions.reduce(
    (acc, s) => {
      if (s.status === 'present') acc.present++;
      else if (s.status === 'absent') acc.absent++;
      else if (s.status === 'late') acc.late++;
      else if (s.status === 'justified') acc.justified++;
      else acc.unregistered++;
      return acc;
    },
    { present: 0, absent: 0, late: 0, justified: 0, unregistered: 0 }
  );

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-6">
      {[
        { label: 'Presentes',    value: counts.present,     bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', icon: <CheckCircle size={16} /> },
        { label: 'Ausentes',     value: counts.absent,      bg: 'bg-red-50',     text: 'text-red-700',     border: 'border-red-200',     icon: <XCircle size={16} /> },
        { label: 'Tarde',        value: counts.late,        bg: 'bg-amber-50',   text: 'text-amber-700',   border: 'border-amber-200',   icon: <Clock size={16} /> },
        { label: 'Justificados', value: counts.justified,   bg: 'bg-blue-50',    text: 'text-blue-700',    border: 'border-blue-200',    icon: <AlertCircle size={16} /> },
        { label: 'Sin Registrar',value: counts.unregistered,bg: 'bg-slate-50',   text: 'text-slate-600',   border: 'border-slate-200',   icon: <Users size={16} /> },
      ].map(({ label, value, bg, text, border, icon }) => (
        <div key={label} className={`flex items-center gap-2 rounded-xl border p-3 ${bg} ${border}`}>
          <span className={text}>{icon}</span>
          <div>
            <p className={`text-lg font-bold leading-none ${text}`}>{value}</p>
            <p className="text-xs text-slate-500 mt-0.5">{label}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── SessionRow ───────────────────────────────────────────────────────────────

interface SessionRowProps {
  session: ScheduledSession;
  selectedDate: string;
  savingKey: string | null;
  onMark: (attendanceId: string, status: AttendanceStatus) => Promise<void>;
  onNavigate: (beneficiaryId: string) => void;
  onRegisterProgress: (session: ScheduledSession) => void;
}

function SessionRow({ session, selectedDate, savingKey, onMark, onNavigate, onRegisterProgress }: SessionRowProps) {
  const isSaving = savingKey === session.attendance_id;
  const initials = `${session.first_name[0] ?? ''}${session.last_name[0] ?? ''}`.toUpperCase();
  const fullName = `${session.first_name} ${session.last_name}`;

  // "Presente"/"Tarde" describe an observed fact — can't be registered
  // until shortly before the session's own date+time (a small early-arrival
  // buffer). "Ausente"/"Justificado" stay open at any time: a justificación
  // is often reported in advance (the signed acta requires 24h notice), and
  // staff may need to record an absence reported ahead of time too.
  const canArrive = canRegisterArrival(selectedDate, session.scheduled_time);

  // Once a session is registered, it becomes an audit record: staff can no
  // longer flip between presente/tarde/ausente. The only correction path is
  // "Justificado" (e.g. a representative brings a late justification) —
  // once that's set, the record is terminal. This is what makes the module
  // trustworthy for a "the child *was* there that day" dispute.
  const isRegistered = session.status !== 'scheduled';
  const isTerminal = session.status === 'justified';

  const actions: { status: AttendanceStatus; label: string; base: string; active: string; requiresArrival: boolean }[] = [
    { status: 'present',   label: 'Presente',    base: 'border border-emerald-200 text-emerald-700 hover:bg-emerald-50', active: 'bg-emerald-100 border border-emerald-400 text-emerald-800 font-bold', requiresArrival: true },
    { status: 'late',      label: 'Tarde',       base: 'border border-amber-200 text-amber-700 hover:bg-amber-50',       active: 'bg-amber-100 border border-amber-400 text-amber-800 font-bold', requiresArrival: true },
    { status: 'absent',    label: 'Ausente',     base: 'border border-red-200 text-red-700 hover:bg-red-50',             active: 'bg-red-100 border border-red-400 text-red-800 font-bold', requiresArrival: false },
    { status: 'justified', label: 'Justificado', base: 'border border-blue-200 text-blue-700 hover:bg-blue-50',           active: 'bg-blue-100 border border-blue-400 text-blue-800 font-bold', requiresArrival: false },
  ];

  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-3 p-4 border border-slate-100 rounded-xl hover:bg-slate-50 transition-colors">
      {/* Time chip */}
      <div className="flex-shrink-0 text-center bg-indigo-50 border border-indigo-100 rounded-xl px-3 py-2 min-w-[70px]">
        <p className="text-[11px] font-bold text-indigo-400 uppercase tracking-wider">Hora</p>
        <p className="text-base font-extrabold text-indigo-800 font-mono leading-tight">{formatTime(session.scheduled_time)}</p>
      </div>

      {/* Avatar + name + service */}
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <div className="w-10 h-10 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-sm font-bold shrink-0">
          {initials}
        </div>
        <div className="min-w-0">
          <button
            onClick={() => onNavigate(session.beneficiary_id)}
            className="text-sm font-bold text-slate-900 truncate hover:text-indigo-700 transition-colors flex items-center gap-1"
          >
            {fullName}
            <ExternalLink className="w-3 h-3 opacity-50" />
          </button>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-[11px] text-indigo-600 font-semibold flex items-center gap-1">
              <GraduationCap className="w-3 h-3" />
              {session.service_name}
            </span>
            <StatusBadge status={session.status} />
            {session.status === 'late' && session.actual_arrival_time && (
              <span className="text-[11px] text-amber-600 font-mono">
                Llegó: {formatTime(session.actual_arrival_time)}
              </span>
            )}
            {(session.status === 'present' || session.status === 'late') && (
              <button
                onClick={() => onRegisterProgress(session)}
                title="Registrar el avance de esta sesión"
                className="inline-flex items-center gap-1 text-[11px] font-bold text-indigo-700 hover:text-indigo-900 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 px-2 py-0.5 rounded-full transition-colors"
              >
                <BookOpen className="w-3 h-3" />
                Registrar Avance
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Action buttons */}
      <div className="sm:ml-auto flex-shrink-0">
        {isSaving ? (
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <div className="w-3.5 h-3.5 border-2 border-slate-300 border-t-indigo-500 rounded-full animate-spin" />
            Guardando…
          </div>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {actions.map(({ status, label, base, active, requiresArrival }) => {
              let locked = false;
              let lockReason: string | undefined;

              if (isTerminal) {
                locked = true;
                lockReason = 'Registro justificado: no se puede modificar.';
              } else if (isRegistered && status !== 'justified') {
                locked = true;
                lockReason = 'Ya registrado. Solo se puede corregir a "Justificado".';
              } else if (requiresArrival && !canArrive) {
                locked = true;
                lockReason = `Disponible a partir de las ${minusMinutes(session.scheduled_time, ARRIVAL_UNLOCK_MINUTES)}`;
              }

              return (
                <button
                  key={status}
                  onClick={() => onMark(session.attendance_id, status)}
                  disabled={isSaving || locked}
                  title={lockReason}
                  className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                    session.status === status ? active : base
                  }`}
                >
                  {STATUS_CONFIG[status].icon}
                  {label}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main Module ──────────────────────────────────────────────────────────────

export function AsistenciaModule() {
  const { currentOrg } = useOrg();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [selectedDate, setSelectedDate] = useState<string>(() => toLocalISODate(new Date()));
  const [sessions, setSessions] = useState<ScheduledSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);

  // ─── Load sessions for the selected date based on day_of_week schedules ──────

  const loadSessions = useCallback(async () => {
    if (!currentOrg) return;
    setLoading(true);

    try {
      // attendance is the source of truth for what's scheduled on a given
      // date — every row was created explicitly (matrícula, cita rápida, or
      // reposición por falta justificada), never re-derived from a
      // day-of-week pattern.
      const { data, error } = await (supabase as any)
        .from('attendance')
        .select(`
          id,
          status,
          scheduled_time,
          actual_arrival_time,
          service_id,
          services ( name ),
          beneficiaries!inner ( id, first_name, last_name, is_active )
        `)
        .eq('organization_id', currentOrg.id)
        .eq('session_date', selectedDate)
        .eq('beneficiaries.is_active', true);

      if (error) throw error;

      const flat: ScheduledSession[] = (data ?? []).map((att: any) => ({
        attendance_id: att.id,
        service_id: att.service_id,
        service_name: att.services?.name ?? '—',
        scheduled_time: att.scheduled_time ?? '00:00:00',
        beneficiary_id: att.beneficiaries.id,
        first_name: att.beneficiaries.first_name,
        last_name: att.beneficiaries.last_name,
        status: att.status,
        actual_arrival_time: att.actual_arrival_time,
      }));

      flat.sort((a, b) => a.scheduled_time.localeCompare(b.scheduled_time));
      setSessions(flat);
    } catch (err: any) {
      console.error(err);
      toast.error('Error al cargar las sesiones del día: ' + err.message);
    } finally {
      setLoading(false);
    }
  }, [currentOrg, selectedDate]);

  useEffect(() => { loadSessions(); }, [loadSessions]);

  // Consume the deep-linked ?date= (e.g. from "Registrar" in Historial de
  // Asistencia). Reacts to searchParams itself, not just on mount — "Registrar"
  // can be clicked from a modal opened on this same route, which updates the
  // URL without remounting the component, so a mount-only effect would miss it.
  useEffect(() => {
    const d = searchParams.get('date');
    if (d) {
      setSelectedDate(d);
      const next = new URLSearchParams(searchParams);
      next.delete('date');
      setSearchParams(next, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  // ─── Justified absences: offer a makeup session ──────────────────────────────
  // Domain rule (also printed on the signed Acta de Compromiso): at most
  // `commitments.max_justified_absences` (default 2) justified absences per
  // year. Under that limit, offer to add one makeup session a week after the
  // beneficiary's last currently-scheduled session for this same therapy.

  const offerMakeupSession = useCallback(async (
    orgId: string,
    beneficiaryId: string,
    catalogServiceId: string | null,
    serviceName: string
  ) => {
    try {
      const { count } = await supabase
        .from('attendance')
        .select('id', { count: 'exact', head: true })
        .eq('beneficiary_id', beneficiaryId)
        .eq('status', 'justified')
        .gte('session_date', currentYearStart());

      const { data: commitment } = await supabase
        .from('commitments')
        .select('max_justified_absences')
        .eq('beneficiary_id', beneficiaryId)
        .maybeSingle();
      const max = (commitment as any)?.max_justified_absences ?? 2;
      const used = count ?? 0;

      if (used > max) {
        toast.error(
          `Este beneficiario ya acumula ${used} faltas justificadas este año (máximo ${max} según su acta de compromiso). No se agenda reposición automática — un owner/admin puede agendarla manualmente si corresponde.`,
          { duration: 6000 }
        );
        return;
      }

      const wantsMakeup = window.confirm(
        `Esta es la falta justificada #${used} de ${max} permitidas este año para ${serviceName}.\n\n¿Agregar una sesión de reposición una semana después de la última sesión programada?`
      );
      if (!wantsMakeup) return;

      if (!catalogServiceId) {
        toast.error('No se pudo determinar el servicio para agendar la reposición.');
        return;
      }

      const { data: lastRows, error: lastErr } = await (supabase as any)
        .from('attendance')
        .select('session_date, scheduled_time')
        .eq('organization_id', orgId)
        .eq('beneficiary_id', beneficiaryId)
        .eq('service_id', catalogServiceId)
        .order('session_date', { ascending: false })
        .limit(1);
      if (lastErr) throw lastErr;

      const last = lastRows?.[0];
      if (!last) {
        toast.error('No se encontró una sesión previa de esta terapia para calcular la reposición.');
        return;
      }

      const makeupDate = offsetDate(last.session_date, 7);
      const { error: insertErr } = await (supabase as any).from('attendance').insert({
        organization_id: orgId,
        beneficiary_id: beneficiaryId,
        session_date: makeupDate,
        status: 'scheduled',
        service_id: catalogServiceId,
        scheduled_time: last.scheduled_time,
      });
      if (insertErr) throw insertErr;

      toast.success(`Sesión de reposición agendada para el ${formatDisplayDate(makeupDate)}.`, { duration: 4000 });
      if (makeupDate === selectedDate) await loadSessions();
    } catch (err: any) {
      toast.error('Error al agendar la reposición: ' + err.message);
    }
  }, [selectedDate, loadSessions]);

  // ─── Mark attendance ───────────────────────────────────────────────────────

  const handleMark = useCallback(async (attendanceId: string, status: AttendanceStatus) => {
    if (!currentOrg) return;

    const session = sessions.find(s => s.attendance_id === attendanceId);
    if (session) {
      if (session.status === 'justified') {
        toast.error('Este registro ya fue justificado y no se puede modificar.');
        return;
      }
      if (session.status !== 'scheduled' && status !== 'justified') {
        toast.error('Ya fue registrado. Solo se puede corregir a "Justificado".');
        return;
      }
    }

    setSavingKey(attendanceId);

    try {
      const wasAlreadyJustified = session?.status === 'justified';
      const actualArrival = status === 'late' ? nowTime() : null;

      const { error } = await (supabase as any)
        .from('attendance')
        .update({
          status,
          actual_arrival_time: actualArrival,
          recorded_by: user?.id ?? null,
        })
        .eq('id', attendanceId);
      if (error) throw error;

      toast.success(`${status === 'present' ? '✓ Presente' : status === 'late' ? '⏰ Tarde' : status === 'absent' ? '✗ Ausente' : 'Justificado'} registrado.`, { duration: 1500 });
      await loadSessions();

      if (status === 'justified' && !wasAlreadyJustified && session) {
        await offerMakeupSession(currentOrg.id, session.beneficiary_id, session.service_id, session.service_name);
      }
    } catch (err: any) {
      toast.error('Error al registrar: ' + err.message);
    } finally {
      setSavingKey(null);
    }
  }, [currentOrg, sessions, loadSessions, offerMakeupSession]);

  // ─── Date navigation ──────────────────────────────────────────────────────

  const goToDate = (d: string) => setSelectedDate(d);
  const goToPrevDay = () => setSelectedDate(prev => offsetDate(prev, -1));
  const goToNextDay = () => setSelectedDate(prev => offsetDate(prev, 1));
  const isToday = selectedDate === toLocalISODate(new Date());

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 flex items-center gap-2">
            <CalendarCheck className="w-7 h-7 text-indigo-600" />
            Registro de Asistencia
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Solo se muestran los pacientes con sesión programada para el día seleccionado.
          </p>
        </div>
        {currentOrg && (
          <button
            onClick={() => setShowHistory(true)}
            className="inline-flex items-center gap-2 text-sm font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 px-4 py-2 rounded-xl border border-indigo-200 transition-colors self-start"
          >
            <History className="w-4 h-4" />
            Ver Historial
          </button>
        )}
      </div>

      {/* Date Navigator */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-4 flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="flex items-center gap-2">
          <button
            onClick={goToPrevDay}
            className="p-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100 hover:border-slate-300 transition-colors"
          >
            <ChevronLeft size={18} />
          </button>

          <div className="flex flex-col items-center min-w-[200px]">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">
              {isToday ? '📅 Hoy' : 'Fecha Seleccionada'}
            </p>
            <p className="text-base font-extrabold text-slate-900 capitalize">
              {formatDisplayDate(selectedDate)}
            </p>
          </div>

          <button
            onClick={goToNextDay}
            className="p-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100 hover:border-slate-300 transition-colors"
          >
            <ChevronRight size={18} />
          </button>
        </div>

        <div className="flex items-center gap-2 sm:ml-auto">
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => goToDate(e.target.value)}
            className="text-sm border border-slate-300 rounded-xl px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-slate-700"
          />
          {!isToday && (
            <button
              onClick={() => setSelectedDate(toLocalISODate(new Date()))}
              className="px-3 py-2 text-xs font-bold text-indigo-600 hover:text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-xl border border-indigo-200 transition-colors"
            >
              Ir a hoy
            </button>
          )}
        </div>
      </div>

      {/* Loading */}
      {loading ? (
        <div className="flex items-center justify-center py-20 text-slate-400 animate-pulse text-sm">
          Cargando sesiones del día...
        </div>
      ) : sessions.length === 0 ? (
        /* Empty state */
        <div className="bg-white rounded-2xl border border-slate-200 py-20 text-center space-y-4">
          <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto">
            <CalendarCheck className="w-8 h-8 text-slate-400" />
          </div>
          <div>
            <p className="font-bold text-slate-700 text-lg">No hay sesiones programadas</p>
            <p className="text-sm text-slate-400 mt-1">
              No hay pacientes con sesiones configuradas para el día de hoy (<strong className="capitalize">{formatDisplayDate(selectedDate)}</strong>).
            </p>
          </div>
          <div className="text-sm text-slate-500 bg-indigo-50 border border-indigo-100 rounded-xl p-3 max-w-sm mx-auto">
            💡 Para que aparezcan pacientes aquí, al crear la matrícula debes agregar las fechas exactas de cada sesión de terapia.
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Summary */}
          <SummaryBar sessions={sessions} />

          {/* Sessions list */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
              <div>
                <p className="font-bold text-slate-900">
                  {sessions.length} sesión{sessions.length !== 1 ? 'es' : ''} programada{sessions.length !== 1 ? 's' : ''}
                </p>
                <p className="text-xs text-slate-500 capitalize">{formatDisplayDate(selectedDate)}</p>
              </div>
              <div className="flex gap-2">
                {/* Mark all present shortcut */}
                <button
                  onClick={async () => {
                    const unregistered = sessions.filter(s => s.status === 'scheduled');
                    const markable = unregistered.filter(s => canRegisterArrival(selectedDate, s.scheduled_time));
                    if (unregistered.length === 0) { toast('Todos ya tienen asistencia registrada.'); return; }
                    if (markable.length === 0) { toast('Ninguna sesión sin registrar ya llegó a su hora todavía.'); return; }
                    for (const s of markable) {
                      await handleMark(s.attendance_id, 'present');
                    }
                    if (markable.length < unregistered.length) {
                      toast(`${unregistered.length - markable.length} sesión(es) todavía no llegan a su hora — no se marcaron.`, { duration: 4000 });
                    }
                  }}
                  className="px-3 py-1.5 text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg border border-emerald-200 transition"
                >
                  ✓ Todos Presentes
                </button>
              </div>
            </div>

            <div className="divide-y divide-slate-50 p-4 space-y-2">
              {sessions.map(session => (
                <SessionRow
                  key={session.attendance_id}
                  session={session}
                  selectedDate={selectedDate}
                  savingKey={savingKey}
                  onMark={handleMark}
                  onNavigate={(id) => navigate(`/app/beneficiarios/${id}`)}
                  onRegisterProgress={(s) => navigate(
                    `/app/beneficiarios/${s.beneficiary_id}?tab=progreso&openNote=1&noteDate=${selectedDate}&catalogServiceId=${s.service_id}`
                  )}
                />
              ))}
            </div>
          </div>
        </div>
      )}

      {currentOrg && (
        <AttendanceHistoryModal
          isOpen={showHistory}
          onClose={() => setShowHistory(false)}
          organizationId={currentOrg.id}
        />
      )}
    </div>
  );
}
