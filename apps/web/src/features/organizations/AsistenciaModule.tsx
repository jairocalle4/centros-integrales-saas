import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router';
import { useOrg } from './OrgContext';
import { supabase } from '../../lib/supabase';
import toast from 'react-hot-toast';
import { useAuth } from '../auth/AuthProvider';
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
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

type AttendanceStatus = 'present' | 'absent' | 'late' | 'justified';

interface ScheduledSession {
  // From enrollment_schedules join
  schedule_id: string;
  enrollment_service_id: string;
  service_name: string;
  start_time: string; // 'HH:MM:SS'
  end_time: string;
  // Beneficiary info (from enrollment → beneficiary)
  beneficiary_id: string;
  first_name: string;
  last_name: string;
  // Attendance record for this date (may be null)
  attendance_id: string | null;
  attendance_status: AttendanceStatus | null;
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
  const [year, month, day] = dateStr.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return date.toLocaleDateString('es-EC', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function offsetDate(dateStr: string, days: number): string {
  const [year, month, day] = dateStr.split('-').map(Number);
  const d = new Date(year, month - 1, day + days);
  return toLocalISODate(d);
}

function getDayOfWeek(dateStr: string): number {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day).getDay(); // 0=Sun, 1=Mon...
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

// ─── Status config ────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<AttendanceStatus, { label: string; badgeBg: string; badgeText: string; icon: React.ReactNode }> = {
  present: { label: 'Presente', badgeBg: 'bg-emerald-100', badgeText: 'text-emerald-700', icon: <CheckCircle size={14} /> },
  absent:  { label: 'Ausente',  badgeBg: 'bg-red-100',     badgeText: 'text-red-700',     icon: <XCircle size={14} /> },
  late:    { label: 'Tarde',    badgeBg: 'bg-amber-100',   badgeText: 'text-amber-700',   icon: <Clock size={14} /> },
  justified: { label: 'Justificado', badgeBg: 'bg-blue-100', badgeText: 'text-blue-700', icon: <AlertCircle size={14} /> },
};

// ─── StatusBadge ──────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: AttendanceStatus | null }) {
  if (!status) return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-500">
      Sin registrar
    </span>
  );
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
      if (s.attendance_status === 'present') acc.present++;
      else if (s.attendance_status === 'absent') acc.absent++;
      else if (s.attendance_status === 'late') acc.late++;
      else if (s.attendance_status === 'justified') acc.justified++;
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
  savingKey: string | null;
  onMark: (scheduleId: string, beneficiaryId: string, serviceId: string, status: AttendanceStatus, scheduledTime: string) => Promise<void>;
  onNavigate: (beneficiaryId: string) => void;
}

function SessionRow({ session, savingKey, onMark, onNavigate }: SessionRowProps) {
  const key = `${session.schedule_id}-${session.beneficiary_id}`;
  const isSaving = savingKey === key;
  const initials = `${session.first_name[0] ?? ''}${session.last_name[0] ?? ''}`.toUpperCase();
  const fullName = `${session.first_name} ${session.last_name}`;

  const actions: { status: AttendanceStatus; label: string; base: string; active: string }[] = [
    { status: 'present',   label: 'Presente',    base: 'border border-emerald-200 text-emerald-700 hover:bg-emerald-50', active: 'bg-emerald-100 border border-emerald-400 text-emerald-800 font-bold' },
    { status: 'late',      label: 'Tarde',       base: 'border border-amber-200 text-amber-700 hover:bg-amber-50',       active: 'bg-amber-100 border border-amber-400 text-amber-800 font-bold' },
    { status: 'absent',    label: 'Ausente',     base: 'border border-red-200 text-red-700 hover:bg-red-50',             active: 'bg-red-100 border border-red-400 text-red-800 font-bold' },
    { status: 'justified', label: 'Justificado', base: 'border border-blue-200 text-blue-700 hover:bg-blue-50',           active: 'bg-blue-100 border border-blue-400 text-blue-800 font-bold' },
  ];

  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-3 p-4 border border-slate-100 rounded-xl hover:bg-slate-50 transition-colors">
      {/* Time chip */}
      <div className="flex-shrink-0 text-center bg-indigo-50 border border-indigo-100 rounded-xl px-3 py-2 min-w-[70px]">
        <p className="text-[11px] font-bold text-indigo-400 uppercase tracking-wider">Hora</p>
        <p className="text-base font-extrabold text-indigo-800 font-mono leading-tight">{formatTime(session.start_time)}</p>
        <p className="text-[10px] text-indigo-400 font-mono">→ {formatTime(session.end_time)}</p>
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
            <StatusBadge status={session.attendance_status} />
            {session.attendance_status === 'late' && session.actual_arrival_time && (
              <span className="text-[11px] text-amber-600 font-mono">
                Llegó: {formatTime(session.actual_arrival_time)}
              </span>
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
            {actions.map(({ status, label, base, active }) => (
              <button
                key={status}
                onClick={() => onMark(session.schedule_id, session.beneficiary_id, session.enrollment_service_id, status, session.start_time)}
                disabled={isSaving}
                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs transition-colors disabled:opacity-50 ${
                  session.attendance_status === status ? active : base
                }`}
              >
                {STATUS_CONFIG[status].icon}
                {label}
              </button>
            ))}
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

  const [selectedDate, setSelectedDate] = useState<string>(() => toLocalISODate(new Date()));
  const [sessions, setSessions] = useState<ScheduledSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<string | null>(null);

  // ─── Load sessions for the selected date based on day_of_week schedules ──────

  const loadSessions = useCallback(async () => {
    if (!currentOrg) return;
    setLoading(true);

    try {
      const dow = getDayOfWeek(selectedDate); // 0=Sun...6=Sat

      // 1. Get all active enrollment_schedules for this day_of_week in this org
      const { data: schedules, error: schedErr } = await (supabase as any)
        .from('enrollment_schedules')
        .select(`
          id,
          start_time,
          end_time,
          enrollment_service_id,
          enrollment_services!inner (
            id,
            status,
            service_id,
            services ( name ),
            enrollments!inner (
              id,
              status,
              beneficiary_id,
              beneficiaries!inner (
                id,
                first_name,
                last_name,
                is_active
              )
            )
          )
        `)
        .eq('organization_id', currentOrg.id)
        .eq('day_of_week', dow)
        .eq('is_active', true);

      if (schedErr) throw schedErr;

      // 2. Build a flat list of sessions
      const flat: ScheduledSession[] = [];
      for (const sch of schedules ?? []) {
        const svc = (sch as any).enrollment_services;
        if (!svc || svc.status !== 'active') continue;
        const enr = svc.enrollments;
        if (!enr || enr.status !== 'active') continue;
        const ben = enr.beneficiaries;
        if (!ben || !ben.is_active) continue;

        flat.push({
          schedule_id: sch.id,
          enrollment_service_id: svc.id,
          service_name: svc.services?.name ?? '—',
          start_time: sch.start_time,
          end_time: sch.end_time,
          beneficiary_id: ben.id,
          first_name: ben.first_name,
          last_name: ben.last_name,
          attendance_id: null,
          attendance_status: null,
          actual_arrival_time: null,
        });
      }

      // Sort by start_time
      flat.sort((a, b) => a.start_time.localeCompare(b.start_time));

      // 3. Load existing attendance records for this date (keyed by schedule_id OR beneficiary+service)
      if (flat.length > 0) {
        const benIds = [...new Set(flat.map(f => f.beneficiary_id))];
        const { data: attData } = await (supabase as any)
          .from('attendance')
          .select('id, beneficiary_id, status, actual_arrival_time, scheduled_time, enrollment_schedule_id, service_id')
          .eq('organization_id', currentOrg.id)
          .eq('session_date', selectedDate)
          .in('beneficiary_id', benIds);

        // Match attendance by schedule_id first, then by beneficiary+service
        const attBySchedule = new Map<string, any>();
        const attByBenService = new Map<string, any>();
        for (const att of attData ?? []) {
          if (att.enrollment_schedule_id) attBySchedule.set(att.enrollment_schedule_id, att);
          if (att.beneficiary_id && att.service_id) {
            attByBenService.set(`${att.beneficiary_id}-${att.service_id}`, att);
          }
        }

        for (const session of flat) {
          const att = attBySchedule.get(session.schedule_id)
            || attByBenService.get(`${session.beneficiary_id}-${session.enrollment_service_id}`);
          if (att) {
            session.attendance_id = att.id;
            session.attendance_status = att.status;
            session.actual_arrival_time = att.actual_arrival_time;
          }
        }
      }

      setSessions(flat);
    } catch (err: any) {
      console.error(err);
      toast.error('Error al cargar las sesiones del día: ' + err.message);
    } finally {
      setLoading(false);
    }
  }, [currentOrg, selectedDate]);

  useEffect(() => { loadSessions(); }, [loadSessions]);

  // ─── Mark attendance ───────────────────────────────────────────────────────

  const handleMark = useCallback(async (
    scheduleId: string,
    beneficiaryId: string,
    enrollmentServiceId: string,
    status: AttendanceStatus,
    scheduledTime: string
  ) => {
    if (!currentOrg) return;
    const rowKey = `${scheduleId}-${beneficiaryId}`;
    setSavingKey(rowKey);

    try {
      const actualArrival = status === 'late' ? nowTime() : null;

      // Find existing attendance record
      const session = sessions.find(s => s.schedule_id === scheduleId && s.beneficiary_id === beneficiaryId);
      const existingId = session?.attendance_id;

      if (existingId) {
        // Update existing record
        await (supabase as any)
          .from('attendance')
          .update({
            status,
            actual_arrival_time: actualArrival,
            scheduled_time: scheduledTime,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existingId);
      } else {
        // Upsert using beneficiary_id + session_date unique constraint
        // First check if exists (duplicate from another service same day)
        const { data: existing } = await (supabase as any)
          .from('attendance')
          .select('id')
          .eq('organization_id', currentOrg.id)
          .eq('beneficiary_id', beneficiaryId)
          .eq('session_date', selectedDate)
          .eq('enrollment_schedule_id', scheduleId)
          .maybeSingle();

        if (existing) {
          await (supabase as any).from('attendance').update({ status, actual_arrival_time: actualArrival }).eq('id', existing.id);
        } else {
          await (supabase as any).from('attendance').insert({
            organization_id: currentOrg.id,
            beneficiary_id: beneficiaryId,
            session_date: selectedDate,
            status,
            enrollment_schedule_id: scheduleId,
            scheduled_time: scheduledTime,
            actual_arrival_time: actualArrival,
            service_id: enrollmentServiceId,
            recorded_by: user?.id ?? null,
          });
        }
      }

      toast.success(`${status === 'present' ? '✓ Presente' : status === 'late' ? '⏰ Tarde' : status === 'absent' ? '✗ Ausente' : 'Justificado'} registrado.`, { duration: 1500 });
      await loadSessions();
    } catch (err: any) {
      toast.error('Error al registrar: ' + err.message);
    } finally {
      setSavingKey(null);
    }
  }, [currentOrg, selectedDate, sessions, user, loadSessions]);

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
            💡 Para que aparezcan pacientes aquí, al crear la matrícula debes configurar los horarios de cada terapia (día y hora), o hacerlo desde el <strong>Detalle del Beneficiario → Inscripciones → Editar Horario</strong>.
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
                    const unregistered = sessions.filter(s => !s.attendance_status);
                    if (unregistered.length === 0) { toast('Todos ya tienen asistencia registrada.'); return; }
                    for (const s of unregistered) {
                      await handleMark(s.schedule_id, s.beneficiary_id, s.enrollment_service_id, 'present', s.start_time);
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
                  key={`${session.schedule_id}-${session.beneficiary_id}`}
                  session={session}
                  savingKey={savingKey}
                  onMark={handleMark}
                  onNavigate={(id) => navigate(`/app/beneficiarios/${id}`)}
                />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
