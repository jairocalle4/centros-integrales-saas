import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useOrg } from './OrgContext';
import {
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  X,
} from 'lucide-react';
import { Link } from 'react-router';
import { formatDateWithWeekday } from '../../lib/formatDate';

import { CitaRapidaModal } from './CitaRapidaModal';
import { CitasHistorialModal } from './CitasHistorialModal';
import { Plus, UserPlus, History } from 'lucide-react';

type DayEvent = {
  type: 'attendance' | 'charge' | 'appointment' | 'scheduled_session';
  id: string;
  title: string;
  subtitle?: string;
  status?: string;
  amount?: number;
  enrollment_schedule_id?: string;
  timeSlot?: string;
  therapyType?: string;
  patientName?: string;
  representativeName?: string;
  phone?: string;
};

export function DashboardCalendar() {
  const { currentOrg } = useOrg();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [eventsMap, setEventsMap] = useState<Record<string, DayEvent[]>>({});
  const [loading, setLoading] = useState(false);
  const [selectedDay, setSelectedDay] = useState<{ dateStr: string; events: DayEvent[] } | null>(null);
  const [isCitaModalOpen, setIsCitaModalOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  useEffect(() => {
    if (currentOrg) {
      loadMonthEvents();
    }
  }, [currentOrg, year, month]);

  const loadMonthEvents = async () => {
    if (!currentOrg) return;
    setLoading(true);

    try {
      const startDate = new Date(year, month, 1).toISOString().split('T')[0];
      const endDate = new Date(year, month + 1, 0).toISOString().split('T')[0];

      // Fetch all data in parallel for maximum performance
      const [
        { data: attendanceData },
        { data: chargesData },
        { data: appointmentsData },
      ] = await Promise.all([
        supabase
          .from('attendance')
          .select(`
            id,
            session_date,
            status,
            enrollment_schedule_id,
            scheduled_time,
            beneficiaries (
              first_name,
              last_name
            )
          `)
          .eq('organization_id', currentOrg.id)
          .gte('session_date', startDate)
          .lte('session_date', endDate),
          
        supabase
          .from('charges')
          .select(`
            id,
            description,
            amount,
            due_date,
            status,
            beneficiaries (
              first_name,
              last_name
            )
          `)
          .eq('organization_id', currentOrg.id)
          .gte('due_date', startDate)
          .lte('due_date', endDate)
          .neq('period_label', 'Anticipo Reserva'),

        supabase
          .from('appointments')
          .select('*')
          .eq('organization_id', currentOrg.id)
          .gte('appointment_date', startDate)
          .lte('appointment_date', endDate),
      ]);

      const map: Record<string, DayEvent[]> = {};

      if (attendanceData) {
        attendanceData.forEach((att: any) => {
          const date = att.session_date;
          if (!map[date]) map[date] = [];
          const name = att.beneficiaries
            ? `${att.beneficiaries.first_name} ${att.beneficiaries.last_name}`
            : 'Beneficiario';
          
          let title = `Asistencia: ${name}`;
          let subtitle = `Estado: ${att.status}`;
          let type: any = 'attendance';

          if (att.status === 'scheduled') {
            title = `Sesión: ${name}`;
            subtitle = 'Programada';
            type = 'scheduled_session';
          }

          map[date].push({
            type,
            id: att.id,
            title,
            subtitle,
            status: att.status,
            timeSlot: att.scheduled_time ? att.scheduled_time.substring(0, 5) : undefined,
            enrollment_schedule_id: att.enrollment_schedule_id,
          });
        });
      }

      if (chargesData) {
        chargesData.forEach((c: any) => {
          const date = c.due_date;
          if (date) {
            if (!map[date]) map[date] = [];
            const name = c.beneficiaries
              ? `${c.beneficiaries.first_name} ${c.beneficiaries.last_name}`
              : '';
            map[date].push({
              type: 'charge',
              id: c.id,
              title: `Cobro: ${c.description}`,
              subtitle: name ? `Beneficiario: ${name}` : undefined,
              amount: c.amount,
              status: c.status,
            });
          }
        });
      }

      if (appointmentsData) {
        appointmentsData.forEach((app: any) => {
          const date = app.appointment_date;
          if (!map[date]) map[date] = [];
          map[date].push({
            type: 'appointment',
            id: app.id,
            title: `Cita: ${app.patient_name}`,
            subtitle: `${app.time_slot} - Tutor: ${app.representative_name}`,
            timeSlot: app.time_slot,
            therapyType: app.therapy_type,
            patientName: app.patient_name,
            representativeName: app.representative_name,
            phone: app.phone,
            status: app.status,
            amount: app.deposit_amount,
          });
        });
      }

      setEventsMap(map);
    } catch (err) {
      console.error('Error cargando eventos del calendario:', err);
    } finally {
      setLoading(false);
    }
  };

  const handlePrevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };
  const handleNextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };
  const handleToday = () => {
    setCurrentDate(new Date());
  };

  // Calendar math
  const firstDayOfWeek = new Date(year, month, 1).getDay();
  // Adjust so Monday = 0, Sunday = 6
  const startOffset = (firstDayOfWeek + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const todayStr = new Date().toISOString().split('T')[0];

  const monthNames = [
    'Enero',
    'Febrero',
    'Marzo',
    'Abril',
    'Mayo',
    'Junio',
    'Julio',
    'Agosto',
    'Septiembre',
    'Octubre',
    'Noviembre',
    'Diciembre',
  ];

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 space-y-3">
      {/* Calendar Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CalendarIcon className="w-4 h-4 text-indigo-600" />
          <h2 className="text-base font-bold text-slate-900">
            {monthNames[month]} {year}
          </h2>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsHistoryOpen(true)}
            className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors"
          >
            <History className="w-3.5 h-3.5" />
            Historial de Citas
          </button>
          <button
            onClick={handleToday}
            className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors"
          >
            Hoy
          </button>
          <button
            onClick={handlePrevMonth}
            className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600 transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            onClick={handleNextMonth}
            className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600 transition-colors"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Weekdays header */}
      <div className="grid grid-cols-7 gap-1 text-center text-xs font-semibold text-slate-400 uppercase tracking-wider py-1 border-b border-slate-100">
        <div>Lun</div>
        <div>Mar</div>
        <div>Mié</div>
        <div>Jue</div>
        <div>Vie</div>
        <div>Sáb</div>
        <div>Dom</div>
      </div>

      {/* Grid */}
      {loading ? (
        <div className="h-64 flex items-center justify-center text-slate-400 text-sm animate-pulse">
          Cargando agenda...
        </div>
      ) : (
        <div className="grid grid-cols-7 gap-1.5">
          {/* Blank offset days */}
          {[...Array(startOffset)].map((_, i) => (
            <div key={`offset-${i}`} className="h-12 rounded-xl bg-slate-50/50" />
          ))}

          {/* Actual days */}
          {[...Array(daysInMonth)].map((_, i) => {
            const dayNum = i + 1;
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
            const isToday = dateStr === todayStr;
            const dayEvents = eventsMap[dateStr] || [];
            const hasAppointment = dayEvents.some((e) => e.type === 'appointment');
            const hasAttendance = dayEvents.some((e) => e.type === 'attendance');
            const hasCharge = dayEvents.some((e) => e.type === 'charge');

            return (
              <div key={dayNum} className="relative group/day">
                <button
                  onClick={() => setSelectedDay({ dateStr, events: dayEvents })}
                  className={`w-full min-h-[58px] p-1.5 rounded-xl border flex flex-col justify-between transition-all duration-300 ease-out text-left cursor-pointer hover:shadow-md hover:-translate-y-0.5 ${
                    isToday
                      ? 'border-indigo-300 bg-indigo-50/80 font-bold ring-1 ring-indigo-500/20 shadow-sm backdrop-blur-sm'
                      : dayEvents.length > 0
                      ? 'border-slate-200 bg-white hover:border-indigo-300'
                      : 'border-transparent bg-white hover:border-slate-200 hover:bg-slate-50/50'
                  }`}
                >
                  <div className="flex items-center justify-between w-full">
                    <span
                      className={`text-[11px] ${
                        isToday
                          ? 'bg-gradient-to-br from-indigo-500 to-indigo-600 text-white w-5 h-5 rounded-full flex items-center justify-center font-bold shadow-sm'
                          : 'text-slate-600 font-semibold'
                      }`}
                    >
                      {dayNum}
                    </span>

                    {/* Indicator Dots */}
                    <div className="flex gap-0.5 items-center">
                      {hasAppointment && <span className="w-1 h-1 rounded-full bg-indigo-500 animate-pulse shadow-sm" />}
                      {dayEvents.some(e => e.type === 'scheduled_session') && <span className="w-1 h-1 rounded-full bg-cyan-400 shadow-sm" />}
                      {hasAttendance && <span className="w-1 h-1 rounded-full bg-emerald-400 shadow-sm" />}
                      {hasCharge && <span className="w-1 h-1 rounded-full bg-amber-400 shadow-sm" />}
                    </div>
                  </div>

                  {/* Event titles snippet inside cell */}
                  {dayEvents.length > 0 ? (
                    <div className="space-y-0.5 mt-1 w-full">
                      {dayEvents.slice(0, 2).map((ev, eIdx) => (
                        <div
                          key={eIdx}
                          className={`text-[9px] font-medium truncate px-1 py-[1px] rounded-[4px] border ${
                            ev.type === 'appointment'
                              ? 'bg-indigo-50 text-indigo-600 border-indigo-100/50'
                              : ev.type === 'scheduled_session'
                              ? 'bg-cyan-50 text-cyan-600 border-cyan-100/50'
                              : ev.type === 'attendance'
                              ? 'bg-emerald-50 text-emerald-600 border-emerald-100/50'
                              : 'bg-amber-50 text-amber-600 border-amber-100/50'
                          }`}
                        >
                          {ev.title.replace(/^(Cita:|Asistencia:|Cobro:|Sesión:)\s*/, '')}
                        </div>
                      ))}
                      {dayEvents.length > 2 && (
                        <span className="text-[8px] font-semibold text-slate-400 pl-0.5 block">
                          +{dayEvents.length - 2} más
                        </span>
                      )}
                    </div>
                  ) : (
                    <span className="text-[9px] font-medium text-slate-300 opacity-0 group-hover/day:opacity-100 transition-opacity">
                      +
                    </span>
                  )}
                </button>

                {/* Hover Tooltip (Glassmorphism Popover) */}
                {dayEvents.length > 0 && (
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-56 z-20 opacity-0 invisible group-hover/day:opacity-100 group-hover/day:visible transition-all duration-200 pointer-events-none origin-bottom">
                    <div className="bg-white/95 backdrop-blur-md rounded-xl shadow-xl border border-white/20 p-3 relative ring-1 ring-slate-900/5">
                      <div className="text-xs font-bold text-slate-900 mb-2 border-b border-slate-100 pb-1">
                        Agenda del {dayNum} de {monthNames[month]}
                      </div>
                      <div className="space-y-1.5 max-h-40 overflow-y-auto custom-scrollbar">
                        {dayEvents.map((ev, idx) => (
                          <div key={idx} className="flex flex-col gap-0.5 border-l-2 pl-2" style={{
                            borderColor: ev.type === 'appointment' ? '#6366f1' : ev.type === 'scheduled_session' ? '#06b6d4' : ev.type === 'attendance' ? '#10b981' : '#f59e0b'
                          }}>
                            <span className="text-[11px] font-semibold text-slate-800 leading-tight">
                              {ev.title}
                            </span>
                            {ev.subtitle && <span className="text-[10px] text-slate-500 leading-none">{ev.subtitle}</span>}
                            {ev.timeSlot && <span className="text-[9px] font-medium text-slate-400">{ev.timeSlot}</span>}
                          </div>
                        ))}
                      </div>
                      {/* Tooltip arrow */}
                      <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-white/95 backdrop-blur-md border-r border-b border-white/20 ring-1 ring-slate-900/5 rotate-45" />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Legend */}
      <div className="flex flex-wrap items-center justify-end gap-3 pt-2 text-xs text-slate-500 border-t border-slate-100">
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-indigo-500" /> Cita / Evaluación
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-cyan-500" /> Sesión Programada
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> Asistencia
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-amber-500" /> Cobro
        </span>
      </div>

      {/* Day Details Modal / Popover */}
      {selectedDay && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-fadeIn">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl p-6 w-full max-w-md space-y-4 animate-popIn">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Agenda del {formatDateWithWeekday(selectedDay.dateStr)}
                </h3>
                <p className="text-xs text-slate-500">
                  {selectedDay.events.length} evento(s) o recordatorio(s)
                </p>
              </div>
              <button
                onClick={() => setSelectedDay(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {selectedDay.events.length === 0 ? (
              <div className="p-6 text-center text-slate-400 space-y-3">
                <CalendarIcon className="w-10 h-10 text-slate-300 mx-auto" />
                <p className="text-sm font-medium">No hay actividades ni citas programadas para esta fecha.</p>
                <div className="flex flex-wrap justify-center gap-2 pt-2">
                  <button
                    onClick={() => {
                      setSelectedDay(null);
                      setIsCitaModalOpen(true);
                    }}
                    className="text-xs font-semibold bg-indigo-600 text-white px-3 py-2 rounded-lg hover:bg-indigo-700 transition-colors shadow-xs flex items-center gap-1.5 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Agendar Cita Rápida
                  </button>
                  <Link
                    to={`/app/asistencia`}
                    onClick={() => setSelectedDay(null)}
                    className="text-xs font-semibold bg-slate-100 text-slate-700 px-3 py-2 rounded-lg hover:bg-slate-200 transition-colors flex items-center gap-1 cursor-pointer"
                  >
                    Registrar Asistencia
                  </Link>
                </div>
              </div>
            ) : (
              <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
                <div className="flex justify-between items-center">
                  <button
                    onClick={() => {
                      setIsCitaModalOpen(true);
                    }}
                    className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 cursor-pointer"
                  >
                    + Agendar Cita Rápida para este día
                  </button>
                </div>

                {selectedDay.events.map((ev, idx) => (
                  <div
                    key={idx}
                    className={`p-3 rounded-xl border flex flex-col gap-2 ${
                      ev.type === 'appointment'
                        ? 'bg-indigo-50/60 border-indigo-200 text-indigo-900'
                        : ev.type === 'scheduled_session'
                        ? 'bg-cyan-50/50 border-cyan-200 text-cyan-900'
                        : ev.type === 'attendance'
                        ? 'bg-emerald-50/50 border-emerald-200 text-emerald-900'
                        : 'bg-amber-50/50 border-amber-200 text-amber-900'
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-sm">{ev.title}</span>
                          {ev.timeSlot && (
                            <span className="bg-indigo-200/60 text-indigo-800 px-2 py-0.5 rounded text-[11px] font-semibold">
                              {ev.timeSlot}
                            </span>
                          )}
                        </div>
                        {ev.subtitle && <p className="text-xs opacity-80 mt-0.5">{ev.subtitle}</p>}
                      </div>
                      {ev.amount !== undefined && ev.amount > 0 && (
                        <span className="text-xs font-extrabold bg-white px-2 py-0.5 rounded border border-slate-200">
                          ${ev.amount.toFixed(2)}
                        </span>
                      )}
                    </div>

                    {/* Quick actions for appointment */}
                    {ev.type === 'appointment' && (
                      <div className="pt-2 border-t border-indigo-200/50 flex flex-wrap items-center justify-between gap-2 text-xs">
                        <span className="text-[11px] text-indigo-700 font-medium">Acciones del Día:</span>
                        <div className="flex items-center gap-1.5">
                          {ev.status === 'converted' ? (
                            <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 px-2.5 py-1 rounded font-semibold text-[11px] flex items-center gap-1">
                              <UserPlus className="w-3 h-3" />
                              Ya matriculado
                            </span>
                          ) : (
                            <Link
                              to={`/app/matricula?appointmentId=${ev.id}&patientName=${encodeURIComponent(ev.patientName || '')}&repName=${encodeURIComponent(ev.representativeName || '')}&phone=${encodeURIComponent(ev.phone || '')}&depositAmount=${ev.amount || 0}`}
                              onClick={() => setSelectedDay(null)}
                              className="bg-indigo-600 text-white hover:bg-indigo-700 px-2.5 py-1 rounded font-semibold text-[11px] flex items-center gap-1 transition-colors shadow-xs"
                            >
                              <UserPlus className="w-3 h-3" />
                              Matricular
                            </Link>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
      {/* Modal Cita Rápida */}
      <CitaRapidaModal
        isOpen={isCitaModalOpen}
        onClose={() => setIsCitaModalOpen(false)}
        defaultDate={selectedDay?.dateStr}
        onSuccess={() => {
          loadMonthEvents();
          if (selectedDay) {
            setSelectedDay(null);
          }
        }}
      />
      {/* Historial de Citas */}
      <CitasHistorialModal isOpen={isHistoryOpen} onClose={() => setIsHistoryOpen(false)} />
    </div>
  );
}
