import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router';
import { useOrg } from './OrgContext';
import { supabase } from '../../lib/supabase';
import toast from 'react-hot-toast';
import { EntityAutocomplete } from '../../components/ui/EntityAutocomplete';
import { Skeleton, SkeletonCircle } from '../../components/ui/Skeleton';
import { generateMonthlyDates, nextDayLocal, getDayOfWeekLocal } from '../../lib/monthlySchedule';
import { validateCedulaEcuador } from '../../lib/validateEcuadorId';
import {
  ArrowLeft,
  Baby,
  Users,
  Calendar,
  Phone,
  Mail,
  Star,
  Plus,
  X,
  FileText,
  BookOpen,
  DollarSign,
  Clock,
  Stethoscope,
  CheckCircle,
  AlertCircle,
  Edit2,
  Upload,
  GraduationCap,
  CalendarCheck,
  Mic,
  MicOff,
  Loader2,
  Printer,
} from 'lucide-react';
import { ActaCompromisoModal } from './ActaCompromisoModal';
import type { CommitmentData } from './ActaCompromisoModal';
import { BeneficiaryModal } from './BeneficiariosModule';
import type { BeneficiaryFormState } from './BeneficiariosModule';
import { PaymentDetailModal, RegisterPaymentModal } from './PaymentDetailModal';
import type { Payment } from './PaymentDetailModal';
import { AttendanceHistoryTable, resolveRecordedByNames } from './AttendanceHistory';
import type { AttendanceHistoryRow } from './AttendanceHistory';
import { InvoiceEnrollmentModal } from './InvoiceEnrollmentModal';
import { formatDate, formatDateWithWeekday } from '../../lib/formatDate';
import { downloadSessionNotePdf, downloadProgressReportPdf } from './SessionNoteDocument';

// ─── Types ────────────────────────────────────────────────────────────────────

const DAYS = [
  { value: 1, label: 'Lunes' },
  { value: 2, label: 'Martes' },
  { value: 3, label: 'Miércoles' },
  { value: 4, label: 'Jueves' },
  { value: 5, label: 'Viernes' },
  { value: 6, label: 'Sábado' },
  { value: 0, label: 'Domingo' },
];

type ScheduleSlot = {
  id?: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
};

type Tab = 'resumen' | 'inscripciones' | 'progreso' | 'cobros' | 'asistencia';

type Beneficiary = {
  id: string;
  first_name: string;
  last_name: string;
  birth_date: string | null;
  consultation_reason: string | null;
  photo_consent: boolean | null;
  photo_url: string | null;
  notes: string | null;
  is_active: boolean;
  created_at: string;
};

type Representative = {
  id: string;
  first_name: string;
  last_name: string;
  identification: string | null;
  phone: string | null;
  email: string | null;
  relationship: string | null;
};

type Enrollment = {
  id: string;
  status: string;
  start_date: string;
  notes: string | null;
  created_at: string;
  services: EnrollmentServiceRow[];
};

type EnrollmentServiceRow = {
  id: string;
  service_id: string;
  service_name: string;
  sessions_per_week: number;
  session_duration_min: number;
  unit_price: number;
  sessions_completed: number;
  status: string;
  billing_mode: 'continuous' | 'finite';
  schedules: ScheduleSlot[];
};

type SessionNote = {
  id: string;
  session_date: string;
  therapist_name: string | null;
  observations: string | null;
  goals_achieved: string | null;
  next_steps: string | null;
  rating: number | null;
  enrollment_service_id: string | null;
  created_at: string;
};

type Charge = {
  id: string;
  organization_id: string;
  description: string;
  amount: number;
  due_date: string | null;
  status: string;
  period_label: string | null;
  paid_amount?: number;
  payments: Payment[];
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function calculateAge(birthDate: string | null): string {
  if (!birthDate) return '—';
  const today = new Date();
  const dob = new Date(birthDate);
  let years = today.getFullYear() - dob.getFullYear();
  const monthDiff = today.getMonth() - dob.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) years--;
  if (years < 0) return '—';
  if (years === 0) {
    const months = (today.getMonth() - dob.getMonth() + 12) % 12;
    return `${months} mes(es)`;
  }
  return `${years} año${years !== 1 ? 's' : ''}`;
}

function getInitials(first: string, last: string) {
  return ((first[0] ?? '') + (last[0] ?? '')).toUpperCase();
}

function statusColor(status: string) {
  return status === 'active' ? 'bg-emerald-100 text-emerald-700 border-emerald-200'
    : status === 'completed' ? 'bg-blue-100 text-blue-700 border-blue-200'
    : 'bg-amber-100 text-amber-700 border-amber-200';
}

function statusLabel(status: string) {
  return status === 'active' ? 'Activo' : status === 'completed' ? 'Completado' : 'Suspendido';
}

function chargeStatusColor(status: string) {
  // "Pendiente" y "Parcial" comparten el mismo badge — desde el cargo,
  // ambos significan "todavía se debe algo" (ver CobrosModule.tsx).
  return status === 'paid' ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
    : status === 'void' ? 'text-slate-600 bg-slate-100 border-slate-200'
    : 'text-amber-700 bg-amber-50 border-amber-200';
}

function chargeStatusLabel(status: string) {
  return status === 'paid' ? 'Pagado' : status === 'void' ? 'Anulado' : 'Pendiente';
}

// Cuando el mismo beneficiario tiene dos inscripciones activas del mismo
// servicio (ej. "Nivelación Académica" con dos horarios distintos), el
// nombre solo ya no alcanza para distinguirlas en el dropdown de notas de
// sesión — se agrega el horario para desambiguar.
function describeEnrollmentService(svc: EnrollmentServiceRow, allServices: EnrollmentServiceRow[]): string {
  const isAmbiguous = allServices.filter(s => s.service_name === svc.service_name).length > 1;
  if (!isAmbiguous) return svc.service_name;
  if (svc.schedules && svc.schedules.length > 0) {
    const dayLabels = svc.schedules
      .map(s => DAYS.find(d => d.value === s.day_of_week)?.label.slice(0, 3) ?? '')
      .join('/');
    return `${svc.service_name} (${dayLabels} ${svc.schedules[0].start_time})`;
  }
  return `${svc.service_name} (sin horario asignado)`;
}

// ─── Session Note Form ─────────────────────────────────────────────────────────

interface NoteFormProps {
  beneficiaryId: string;
  organizationId: string;
  enrollmentServices: EnrollmentServiceRow[];
  onClose: () => void;
  onSuccess: () => void;
  initialDate?: string;
  initialServiceId?: string;
}

// ─── Dictado por voz (Web Speech API, nativo del navegador) ────────────────
// Sin costo ni backend — funciona bien en Chrome/Edge de escritorio y
// Android; Safari/iOS tiene soporte parcial. Si el navegador no lo soporta,
// el botón simplemente avisa en vez de fallar en silencio.
function useSpeechDictation(onFinalText: (text: string) => void) {
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);
  const supported = typeof window !== 'undefined' && Boolean((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);

  const toggle = () => {
    if (!supported) {
      toast.error('El dictado por voz no está disponible en este navegador — funciona en Chrome o Edge.');
      return;
    }
    if (isListening) {
      recognitionRef.current?.stop();
      return;
    }
    const SpeechRecognitionCtor = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const recognition = new SpeechRecognitionCtor();
    recognition.lang = 'es-EC';
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.onresult = (event: any) => {
      let finalText = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) finalText += event.results[i][0].transcript;
      }
      if (finalText.trim()) onFinalText(finalText.trim());
    };
    recognition.onerror = () => {
      setIsListening(false);
      toast.error('No se pudo continuar con el dictado por voz.');
    };
    recognition.onend = () => setIsListening(false);
    recognitionRef.current = recognition;
    recognition.start();
    setIsListening(true);
  };

  useEffect(() => () => { recognitionRef.current?.stop(); }, []);

  return { isListening, toggle, supported };
}

function NoteForm({ beneficiaryId, organizationId, enrollmentServices, onClose, onSuccess, initialDate, initialServiceId }: NoteFormProps) {
  const [date, setDate] = useState(initialDate || new Date().toISOString().split('T')[0]);
  const [serviceId, setServiceId] = useState(initialServiceId || enrollmentServices[0]?.id || '');
  const [therapistName, setTherapistName] = useState('');
  const [observations, setObservations] = useState('');
  const [goals, setGoals] = useState('');
  const [nextSteps, setNextSteps] = useState('');
  const [rating, setRating] = useState<number>(3);
  const [submitting, setSubmitting] = useState(false);
  const dictation = useSpeechDictation((text) => {
    setObservations(prev => (prev ? `${prev} ${text}` : text));
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!observations.trim()) { toast.error('Las observaciones son obligatorias.'); return; }
    setSubmitting(true);
    try {
      await (supabase as any).from('session_notes').insert({
        organization_id: organizationId,
        beneficiary_id: beneficiaryId,
        enrollment_service_id: serviceId || null,
        session_date: date,
        therapist_name: therapistName.trim() || null,
        observations: observations.trim(),
        goals_achieved: goals.trim() || null,
        next_steps: nextSteps.trim() || null,
        rating,
      });
      toast.success('Nota de sesión guardada.');
      onSuccess();
      onClose();
    } catch (err: any) {
      toast.error('Error: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 overflow-y-auto animate-fadeIn">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-lg my-8 overflow-hidden animate-popIn">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50">
          <h3 className="font-bold text-slate-900 flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-indigo-600" />
            Nuevo Registro de Avance
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Fecha de Sesión</label>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
                max={new Date().toISOString().split('T')[0]}
                className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500" />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Terapia / Servicio</label>
              <select value={serviceId} onChange={(e) => setServiceId(e.target.value)}
                className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500">
                <option value="">-- Sin vincular --</option>
                {enrollmentServices.map(s => (
                  <option key={s.id} value={s.id}>{describeEnrollmentService(s, enrollmentServices)}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Nombre del Terapeuta</label>
            <input type="text" value={therapistName} onChange={(e) => setTherapistName(e.target.value)}
              placeholder="Ej. Lcda. Balcázar"
              className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500" />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-bold text-slate-700">Observaciones de la Sesión <span className="text-red-500">*</span></label>
              <button
                type="button"
                onClick={dictation.toggle}
                title={dictation.supported ? 'Dictar por voz' : 'Dictado por voz no disponible en este navegador'}
                className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded-lg border transition-colors ${
                  dictation.isListening
                    ? 'bg-red-50 text-red-700 border-red-200 animate-pulse'
                    : 'bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100'
                }`}
              >
                {dictation.isListening ? <MicOff className="w-3 h-3" /> : <Mic className="w-3 h-3" />}
                {dictation.isListening ? 'Escuchando…' : 'Dictar'}
              </button>
            </div>
            <textarea value={observations} onChange={(e) => setObservations(e.target.value)}
              placeholder="¿Qué se trabajó hoy? ¿Cómo respondió el paciente?"
              rows={3}
              className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 resize-none" />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Logros / Objetivos Alcanzados</label>
            <textarea value={goals} onChange={(e) => setGoals(e.target.value)}
              placeholder="¿Qué avances o logros se observaron?"
              rows={2}
              className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 resize-none" />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Plan / Próximos Pasos</label>
            <textarea value={nextSteps} onChange={(e) => setNextSteps(e.target.value)}
              placeholder="¿Qué se trabajará en la próxima sesión?"
              rows={2}
              className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 resize-none" />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-2">Progreso del Paciente (1 = bajo, 5 = excelente)</label>
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5].map(n => (
                <button key={n} type="button"
                  onClick={() => setRating(n)}
                  className={`flex-1 py-2 rounded-xl font-bold text-sm transition-all ${
                    rating === n ? 'bg-indigo-600 text-white shadow-md scale-105' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}>
                  {n} {'⭐'.repeat(n)}
                </button>
              ))}
            </div>
          </div>

          <div className="flex gap-3 pt-2 border-t border-slate-100">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 text-sm font-bold text-slate-600 border border-slate-300 rounded-xl hover:bg-slate-50">Cancelar</button>
            <button type="submit" disabled={submitting}
              className="flex-1 py-2.5 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition disabled:opacity-50 inline-flex items-center justify-center gap-2">
              {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
              {submitting ? 'Guardando...' : 'Guardar Nota'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Link Representative Modal ─────────────────────────────────────────────────

interface LinkRepresentativeModalProps {
  organizationId: string;
  candidates: Representative[]; // org representatives not yet linked to this beneficiary
  saving: boolean;
  onClose: () => void;
  onSelectExisting: (repId: string) => void;
  onCreated: (repId: string) => void;
}

function LinkRepresentativeModal({
  organizationId,
  candidates,
  saving,
  onClose,
  onSelectExisting,
  onCreated,
}: LinkRepresentativeModalProps) {
  const [mode, setMode] = useState<'search' | 'create'>('search');
  const [selected, setSelected] = useState<Representative | null>(null);
  const [form, setForm] = useState({ first_name: '', last_name: '', identification: '', phone: '', email: '', relationship: 'Madre' });
  const [creating, setCreating] = useState(false);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.first_name.trim() || !form.last_name.trim()) {
      toast.error('Ingresa nombres y apellidos del representante.');
      return;
    }
    if (form.identification.trim()) {
      const cedulaError = validateCedulaEcuador(form.identification);
      if (cedulaError) { toast.error(cedulaError); return; }
    }
    setCreating(true);
    try {
      const { data, error } = await supabase
        .from('representatives')
        .insert({
          organization_id: organizationId,
          first_name: form.first_name.trim(),
          last_name: form.last_name.trim(),
          identification: form.identification.trim() || null,
          phone: form.phone.trim() || null,
          email: form.email.trim() || null,
          relationship: form.relationship || 'Madre',
          is_active: true,
        })
        .select('id')
        .single();
      if (error) throw error;
      onCreated(data.id);
    } catch (err: any) {
      toast.error('Error al crear representante: ' + err.message);
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 overflow-y-auto animate-fadeIn">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md my-8 animate-popIn">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50">
          <h3 className="font-bold text-slate-900 flex items-center gap-2">
            <Users className="w-5 h-5 text-indigo-600" />
            Vincular Representante
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 rounded-lg p-1"><X size={18} /></button>
        </div>

        <div className="px-6 pt-4">
          <div className="flex rounded-lg bg-slate-100 p-1 text-xs font-semibold">
            <button
              type="button"
              onClick={() => setMode('search')}
              className={`flex-1 py-1.5 text-center rounded-md transition-all cursor-pointer ${mode === 'search' ? 'bg-white text-indigo-700 shadow-xs font-bold' : 'text-slate-600 hover:text-slate-900'}`}
            >
              Buscar Existente
            </button>
            <button
              type="button"
              onClick={() => setMode('create')}
              className={`flex-1 py-1.5 text-center rounded-md transition-all cursor-pointer ${mode === 'create' ? 'bg-white text-indigo-700 shadow-xs font-bold' : 'text-slate-600 hover:text-slate-900'}`}
            >
              + Crear Nuevo
            </button>
          </div>
        </div>

        <div className="p-6 space-y-4">
          {mode === 'search' ? (
            candidates.length === 0 ? (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-900 text-xs">
                No hay más representantes registrados en el centro para vincular. Usa <strong>"+ Crear Nuevo"</strong>.
              </div>
            ) : (
              <>
                <EntityAutocomplete<Representative>
                  placeholder="Escribe cédula o nombre del tutor..."
                  fetchResults={async (query) => {
                    const q = query.toLowerCase();
                    return candidates.filter(r =>
                      (r.identification || '').includes(q) ||
                      `${r.first_name} ${r.last_name}`.toLowerCase().includes(q)
                    ).slice(0, 8);
                  }}
                  selectedItem={selected}
                  onSelect={setSelected}
                  renderItem={(r) => (
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-xs shrink-0">
                        {r.first_name[0]}{r.last_name[0]}
                      </div>
                      <div>
                        <p className="font-bold text-slate-900 text-sm">{r.first_name} {r.last_name}</p>
                        {r.identification && <p className="text-[11px] text-slate-500 font-mono">CI: {r.identification}</p>}
                      </div>
                    </div>
                  )}
                  renderSelected={(r) => <p>{r.first_name} {r.last_name} {r.identification ? `(CI: ${r.identification})` : ''}</p>}
                />
                <div className="flex justify-end gap-3 pt-2">
                  <button type="button" onClick={onClose} className="px-4 py-2 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-100">Cancelar</button>
                  <button
                    type="button"
                    disabled={!selected || saving}
                    onClick={() => selected && onSelectExisting(selected.id)}
                    className="px-5 py-2 rounded-xl text-sm font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-md disabled:opacity-50 cursor-pointer inline-flex items-center gap-2"
                  >
                    {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                    {saving ? 'Vinculando...' : 'Vincular'}
                  </button>
                </div>
              </>
            )
          ) : (
            <form onSubmit={handleCreate} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Nombres *</label>
                  <input type="text" value={form.first_name} onChange={(e) => setForm(f => ({ ...f, first_name: e.target.value }))}
                    className="w-full text-sm rounded-lg border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Apellidos *</label>
                  <input type="text" value={form.last_name} onChange={(e) => setForm(f => ({ ...f, last_name: e.target.value }))}
                    className="w-full text-sm rounded-lg border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Cédula</label>
                  <input type="text" maxLength={10} value={form.identification} onChange={(e) => setForm(f => ({ ...f, identification: e.target.value.replace(/\D/g, '') }))}
                    className="w-full text-sm rounded-lg border border-slate-300 px-3 py-2 font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Parentesco</label>
                  <select value={form.relationship} onChange={(e) => setForm(f => ({ ...f, relationship: e.target.value }))}
                    className="w-full text-sm rounded-lg border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500">
                    <option value="Madre">Madre</option>
                    <option value="Padre">Padre</option>
                    <option value="Tutor Legal">Tutor Legal</option>
                    <option value="Abuelo/a">Abuelo/a</option>
                    <option value="Otro">Otro</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Teléfono</label>
                  <input type="text" maxLength={10} value={form.phone} onChange={(e) => setForm(f => ({ ...f, phone: e.target.value.replace(/\D/g, '') }))}
                    className="w-full text-sm rounded-lg border border-slate-300 px-3 py-2 font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Correo</label>
                  <input type="email" value={form.email} onChange={(e) => setForm(f => ({ ...f, email: e.target.value }))}
                    className="w-full text-sm rounded-lg border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={onClose} className="px-4 py-2 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-100">Cancelar</button>
                <button type="submit" disabled={creating || saving} className="px-5 py-2 rounded-xl text-sm font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-md disabled:opacity-50 cursor-pointer inline-flex items-center gap-2">
                  {(creating || saving) && <Loader2 className="w-4 h-4 animate-spin" />}
                  {creating || saving ? 'Guardando...' : 'Crear y Vincular'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────

export function BeneficiaryDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { currentOrg, hasElectronicBilling, hasSessionNotes, hasSriCertificate } = useOrg();
  const canEmitInvoices = hasElectronicBilling && hasSriCertificate;
  const initialTab = (searchParams.get('tab') as Tab) || 'resumen';
  const [activeTab, setActiveTab] = useState<Tab>(initialTab);
  // Si llegan directo por URL a ?tab=progreso (ej. un enlace guardado de
  // antes de que el plan cambiara) sin tener el entitlement, no se queda
  // en una pestaña huérfana sin botón para volver — cae a Resumen.
  useEffect(() => {
    if (activeTab === 'progreso' && !hasSessionNotes) setActiveTab('resumen');
  }, [activeTab, hasSessionNotes]);
  const [loading, setLoading] = useState(true);
  const [noteFormPrefill, setNoteFormPrefill] = useState<{ date?: string; serviceId?: string }>({});
  const [generatingNextMonthFor, setGeneratingNextMonthFor] = useState<string | null>(null);

  const [beneficiary, setBeneficiary] = useState<Beneficiary | null>(null);
  const [representatives, setRepresentatives] = useState<Representative[]>([]);
  const [orgRepresentatives, setOrgRepresentatives] = useState<Representative[]>([]);
  const [showLinkRepModal, setShowLinkRepModal] = useState(false);
  const [savingRepLink, setSavingRepLink] = useState(false);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [sessionNotes, setSessionNotes] = useState<SessionNote[]>([]);
  const [charges, setCharges] = useState<Charge[]>([]);
  const [attendanceHistory, setAttendanceHistory] = useState<AttendanceHistoryRow[]>([]);
  const [invoicingEnrollmentId, setInvoicingEnrollmentId] = useState<string | null>(null);

  const [showNoteForm, setShowNoteForm] = useState(false);
  const [printingNoteId, setPrintingNoteId] = useState<string | null>(null);
  const [showProgressReportModal, setShowProgressReportModal] = useState(false);
  const [progressReportSummary, setProgressReportSummary] = useState('');
  const [downloadingProgressReport, setDownloadingProgressReport] = useState(false);
  const [paymentTarget, setPaymentTarget] = useState<Charge | null>(null);
  const [viewingCharge, setViewingCharge] = useState<Charge | null>(null);
  const [actaData, setActaData] = useState<CommitmentData | null>(null);
  const [isActaOpen, setIsActaOpen] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [photoDisplayUrl, setPhotoDisplayUrl] = useState<string | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editSubmitting, setEditSubmitting] = useState(false);

  // All enrollment services across all active enrollments
  // Solo inscripciones activas — no tiene sentido registrar una nota de
  // sesión nueva contra una inscripción ya completada/suspendida.
  const allEnrollmentServices = enrollments.filter(e => e.status === 'active').flatMap(e => e.services);

  // ─── Data Loading ────────────────────────────────────────────────────────────

  const loadAll = useCallback(async () => {
    if (!id || !currentOrg) return;
    setLoading(true);
    try {
      // Beneficiary
      const { data: ben } = await supabase
        .from('beneficiaries')
        .select('*')
        .eq('id', id)
        .single();
      if (!ben) { navigate('/app/beneficiarios'); return; }
      setBeneficiary(ben);

      // Representatives
      const { data: repLinks } = await supabase
        .from('beneficiary_representatives')
        .select('representatives(*)')
        .eq('beneficiary_id', id);
      setRepresentatives((repLinks || []).map((r: any) => r.representatives).filter(Boolean));

      // All active representatives in the org, for the "add another" picker
      const { data: allReps } = await supabase
        .from('representatives')
        .select('*')
        .eq('organization_id', currentOrg.id)
        .eq('is_active', true)
        .order('first_name', { ascending: true });
      setOrgRepresentatives((allReps as any) || []);

      // Enrollments with services and schedules
      const { data: enrData } = await (supabase as any)
        .from('enrollments')
        .select(`*, enrollment_services(*, services(name, price), enrollment_schedules(*))`)
        .eq('beneficiary_id', id)
        .eq('organization_id', currentOrg.id)
        .order('created_at', { ascending: false });

      setEnrollments((enrData || []).map((e: any) => ({
        id: e.id,
        status: e.status,
        start_date: e.start_date,
        notes: e.notes,
        created_at: e.created_at,
        services: (e.enrollment_services || []).map((s: any) => ({
          id: s.id,
          service_id: s.service_id,
          service_name: s.services?.name || '—',
          sessions_per_week: s.sessions_per_week,
          session_duration_min: s.session_duration_min,
          unit_price: s.unit_price,
          sessions_completed: s.sessions_completed,
          status: s.status,
          billing_mode: s.billing_mode,
          schedules: (s.enrollment_schedules || []).filter((sch: any) => sch.is_active).map((sch: any) => ({
            id: sch.id,
            day_of_week: sch.day_of_week,
            start_time: sch.start_time.substring(0, 5),
            end_time: sch.end_time.substring(0, 5),
          }))
        })),
      })));

      // Session Notes
      const { data: notes } = await (supabase as any)
        .from('session_notes')
        .select('*')
        .eq('beneficiary_id', id)
        .order('session_date', { ascending: false });
      setSessionNotes((notes as any) || []);

      // Charges with their full payment history
      const { data: chargesData } = await supabase
        .from('charges')
        .select('*, internal_payments(*, sri_documents ( status, pdf_url, cliente_email, email_sent_at, clave_acceso, total ))')
        .eq('beneficiary_id', id)
        .order('created_at', { ascending: false });

      setCharges((chargesData || []).map((c: any) => ({
        ...c,
        payments: c.internal_payments || [],
        paid_amount: (c.internal_payments || [])
          .filter((p: any) => !p.voided_at)
          .reduce((sum: number, p: any) => sum + (p.amount || 0), 0),
      })));

      // Attendance history — the audit trail behind this beneficiary's
      // presente/tarde/ausente/justificado record, used to resolve
      // representative disputes about a specific day.
      const { data: attData } = await (supabase as any)
        .from('attendance')
        .select('id, session_date, scheduled_time, status, actual_arrival_time, recorded_by, services ( name )')
        .eq('beneficiary_id', id)
        .order('session_date', { ascending: false })
        .order('scheduled_time', { ascending: true });

      const recordedByNames = await resolveRecordedByNames((attData ?? []).map((r: any) => r.recorded_by));

      setAttendanceHistory((attData ?? []).map((r: any) => ({
        id: r.id,
        session_date: r.session_date,
        scheduled_time: r.scheduled_time ?? '00:00:00',
        status: r.status,
        actual_arrival_time: r.actual_arrival_time,
        service_name: r.services?.name ?? '—',
        beneficiary_id: id,
        beneficiary_name: '',
        recorded_by_name: r.recorded_by ? recordedByNames[r.recorded_by] ?? '—' : null,
      })));

    } catch (err) {
      console.error(err);
      toast.error('Error al cargar datos del beneficiario.');
    } finally {
      setLoading(false);
    }
  }, [id, currentOrg, navigate]);

  useEffect(() => { loadAll(); }, [loadAll]);

  // Viniendo desde Asistencia (marcar Presente/Tarde → "Registrar Avance"):
  // resuelve el servicio del CATÁLOGO (attendance.service_id) contra la
  // inscripción activa real de este beneficiario (enrollment_services.id,
  // que es lo que NoteForm/session_notes realmente usan) y abre el
  // formulario ya con la fecha y el servicio correctos — sin que el
  // usuario tenga que volver a elegirlos a mano.
  useEffect(() => {
    if (searchParams.get('openNote') !== '1' || enrollments.length === 0) return;
    const catalogServiceId = searchParams.get('catalogServiceId');
    const noteDate = searchParams.get('noteDate') ?? undefined;
    const activeServices = enrollments.filter(e => e.status === 'active').flatMap(e => e.services);
    const matched = catalogServiceId ? activeServices.find(s => s.service_id === catalogServiceId) : undefined;
    setNoteFormPrefill({ date: noteDate, serviceId: matched?.id });
    setShowNoteForm(true);
    const next = new URLSearchParams(searchParams);
    next.delete('openNote');
    next.delete('catalogServiceId');
    next.delete('noteDate');
    setSearchParams(next, { replace: true });
  }, [enrollments, searchParams, setSearchParams]);

  // The beneficiary-photos bucket is private (RLS-gated by organization
  // membership); `photo_url` stores the storage path, not a public URL, so
  // it must be resolved to a short-lived signed URL before rendering.
  useEffect(() => {
    const path = beneficiary?.photo_url;
    if (!path) { setPhotoDisplayUrl(null); return; }
    let cancelled = false;
    supabase.storage.from('beneficiary-photos').createSignedUrl(path, 3600).then(({ data }) => {
      if (!cancelled) setPhotoDisplayUrl(data?.signedUrl ?? null);
    });
    return () => { cancelled = true; };
  }, [beneficiary?.photo_url]);

  // ─── Photo Upload ─────────────────────────────────────────────────────────────

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !id) return;
    setUploadingPhoto(true);
    try {
      const ext = file.name.split('.').pop();
      const path = `${id}/photo.${ext}`;
      const { error: uploadErr } = await supabase.storage.from('beneficiary-photos').upload(path, file, { upsert: true });
      if (uploadErr) throw uploadErr;
      await supabase.from('beneficiaries').update({ photo_url: path }).eq('id', id);
      toast.success('Foto actualizada correctamente.');
      await loadAll();
    } catch (err: any) {
      toast.error('Error al subir foto: ' + err.message);
    } finally {
      setUploadingPhoto(false);
    }
  };

  // ─── Editar beneficiario ────────────────────────────────────────────────────────

  const handleEditSubmit = async (form: BeneficiaryFormState, setActive?: boolean) => {
    if (!id) return;
    if (form.rep_mode === 'new' && form.rep_cedula.trim()) {
      const cedulaError = validateCedulaEcuador(form.rep_cedula);
      if (cedulaError) { toast.error(cedulaError); return; }
    }
    setEditSubmitting(true);
    try {
      let repId = form.selected_rep_id;

      if (form.rep_mode === 'new') {
        const { data: newRep, error: repErr } = await supabase
          .from('representatives')
          .insert({
            organization_id: currentOrg!.id,
            first_name: form.rep_first_name.trim(),
            last_name: form.rep_last_name.trim(),
            identification: form.rep_cedula.trim(),
            phone: form.rep_phone.trim(),
            email: form.rep_email.trim() || null,
            relationship: form.rep_relationship || 'Madre',
            is_active: true,
          })
          .select('id')
          .single();
        if (repErr) throw repErr;
        repId = newRep.id;
      }

      const { error: benErr } = await supabase
        .from('beneficiaries')
        .update({
          first_name: form.first_name.trim(),
          last_name: form.last_name.trim(),
          birth_date: form.birth_date || null,
          consultation_reason: form.consultation_reason.trim() || null,
          photo_consent: form.photo_consent,
          notes: form.notes.trim() || null,
          is_active: setActive ?? true,
        })
        .eq('id', id);
      if (benErr) throw benErr;

      // Only touch the primary representative link if the selection
      // actually changed; never wipe other representatives already linked.
      const currentPrimaryId = representatives[0]?.id;
      if (repId && repId !== currentPrimaryId) {
        await supabase.from('beneficiary_representatives').update({ is_primary: false }).eq('beneficiary_id', id);
        await supabase
          .from('beneficiary_representatives')
          .upsert({ beneficiary_id: id, representative_id: repId, is_primary: true }, { onConflict: 'beneficiary_id,representative_id' });
      }

      toast.success('Beneficiario actualizado exitosamente.');
      setShowEditModal(false);
      await loadAll();
    } catch (err: any) {
      toast.error('Error al actualizar beneficiario: ' + err.message);
    } finally {
      setEditSubmitting(false);
    }
  };

  // ─── Representantes vinculados ─────────────────────────────────────────────────

  const handleAddRepresentative = async (repId: string) => {
    if (!id || !repId) return;
    setSavingRepLink(true);
    try {
      const { error } = await supabase.from('beneficiary_representatives').insert({
        beneficiary_id: id,
        representative_id: repId,
        is_primary: representatives.length === 0,
      });
      if (error) throw error;
      toast.success('Representante vinculado.');
      setShowLinkRepModal(false);
      await loadAll();
    } catch (err: any) {
      toast.error('Error al vincular representante: ' + err.message);
    } finally {
      setSavingRepLink(false);
    }
  };

  const handleRemoveRepresentative = async (repId: string) => {
    if (!id || representatives.length <= 1) return;
    try {
      const { error } = await supabase
        .from('beneficiary_representatives')
        .delete()
        .eq('beneficiary_id', id)
        .eq('representative_id', repId);
      if (error) throw error;
      toast.success('Representante desvinculado.');
      await loadAll();
    } catch (err: any) {
      toast.error('Error al desvincular representante: ' + err.message);
    }
  };

  // ─── Acta ─────────────────────────────────────────────────────────────────────

  const openActa = async () => {
    if (!beneficiary || !currentOrg) return;
    const rep = representatives[0];
    if (!id) return;
    const { data: comData } = await supabase.from('commitments').select('*').eq('beneficiary_id', id).maybeSingle();
    setActaData({
      representativeName: rep ? `${rep.first_name} ${rep.last_name}` : 'Representante Legal',
      representativeId: rep?.identification || '—',
      representativeEmail: rep?.email || '—',
      beneficiaryName: `${beneficiary.first_name} ${beneficiary.last_name}`,
      sessionDuration: (comData as any)?.session_duration_minutes || 40,
      photoConsent: beneficiary.photo_consent ?? true,
      therapies: (comData as any)?.selected_therapies || {},
      paymentFrequency: (comData as any)?.payment_frequency || 'session',
      scheduleLabel: (comData as any)?.schedule_label || undefined,
      signedDate: (comData as any)?.signed_at ? formatDate((comData as any).signed_at) : undefined,
      orgName: currentOrg.name,
      city: currentOrg.city || 'La Troncal',
    });
    setIsActaOpen(true);
  };

  // ─── Servicio Mensual: renovación ───────────────────────────────────────────────
  // Continúa el mismo patrón de días/hora ya guardado en enrollment_schedules
  // (leído aquí como el registro de "qué patrón se eligió", no como una fuente
  // de recurrencia automática — la renovación es siempre una acción explícita).

  const handleGenerateNextMonth = async (enrollment: Enrollment, svc: EnrollmentServiceRow) => {
    if (!currentOrg || !id) return;
    if (svc.schedules.length === 0) {
      toast.error('Este servicio no tiene un horario guardado — genera fechas desde la Matrícula primero.');
      return;
    }

    setGeneratingNextMonthFor(svc.id);
    try {
      const { data: lastAttendance } = await (supabase as any)
        .from('attendance')
        .select('session_date')
        .eq('beneficiary_id', id)
        .eq('service_id', svc.service_id)
        .order('session_date', { ascending: false })
        .limit(1)
        .maybeSingle();

      const rangeStart = lastAttendance?.session_date ? nextDayLocal(lastAttendance.session_date) : enrollment.start_date;
      const daysOfWeek = [...new Set(svc.schedules.map(s => s.day_of_week))];
      const dates = generateMonthlyDates(rangeStart, daysOfWeek);

      if (dates.length === 0) {
        toast.error('No se generó ninguna fecha nueva — revisa el horario guardado de este servicio.');
        return;
      }

      const scheduleByDay = new Map(svc.schedules.map(s => [s.day_of_week, s]));
      const attendanceRows = dates.map(date => {
        const schedule = scheduleByDay.get(getDayOfWeekLocal(date));
        return {
          organization_id: currentOrg.id,
          beneficiary_id: id,
          session_date: date,
          status: 'scheduled',
          service_id: svc.service_id,
          enrollment_schedule_id: schedule?.id ?? null,
          scheduled_time: schedule ? `${schedule.start_time}:00` : null,
        };
      });

      const { error: attError } = await (supabase as any).from('attendance').insert(attendanceRows);
      if (attError) throw attError;

      // Continua ("Servicio Mensual"): unit_price ya es el monto fijo del
      // período, no se multiplica por la cantidad de fechas generadas.
      const amount = svc.billing_mode === 'continuous' ? svc.unit_price : svc.unit_price * dates.length;
      const { error: chargeError } = await (supabase as any).from('charges').insert({
        organization_id: currentOrg.id,
        beneficiary_id: id,
        enrollment_id: enrollment.id,
        description: `Renovación mensual: ${svc.service_name}`,
        amount,
        due_date: dates[0],
        status: 'pending',
        period_label: `${formatDate(dates[0])} - ${formatDate(dates[dates.length - 1])}`,
      });
      if (chargeError) throw chargeError;

      toast.success(`Se generaron ${dates.length} fechas nuevas y un cargo de $${amount.toFixed(2)}.`);
      await loadAll();
    } catch (err: any) {
      toast.error('Error generando el próximo mes: ' + err.message);
    } finally {
      setGeneratingNextMonthFor(null);
    }
  };

  // ─── Render ───────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="space-y-6 max-w-5xl mx-auto">
        <Skeleton className="h-4 w-40" />
        <div className="bg-white rounded-3xl p-6 border border-slate-200">
          <div className="flex items-center gap-6">
            <SkeletonCircle className="w-24 h-24 shrink-0" />
            <div className="flex-1 space-y-3">
              <Skeleton className="h-6 w-1/3" />
              <Skeleton className="h-3.5 w-1/4" />
            </div>
            <div className="hidden sm:flex flex-col gap-2">
              <Skeleton className="h-9 w-32 rounded-xl" />
              <Skeleton className="h-9 w-32 rounded-xl" />
            </div>
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <div className="flex gap-6 px-6 py-3 border-b border-slate-100">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-4 w-24" />
            ))}
          </div>
          <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-3">
              <Skeleton className="h-3 w-32" />
              <div className="rounded-2xl border border-slate-200 p-4 space-y-2">
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-3 w-1/3" />
              </div>
            </div>
            <div className="space-y-3">
              <Skeleton className="h-3 w-32" />
              <div className="grid grid-cols-2 gap-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-16 rounded-2xl" />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!beneficiary) return null;

  const age = calculateAge(beneficiary.birth_date);
  const initials = getInitials(beneficiary.first_name, beneficiary.last_name);
  const hasEnrollment = enrollments.length > 0;
  const beneficiaryFullName = `${beneficiary.first_name} ${beneficiary.last_name}`;

  const handlePrintNote = async (note: SessionNote) => {
    if (!currentOrg) return;
    setPrintingNoteId(note.id);
    try {
      await downloadSessionNotePdf({ organization: currentOrg, beneficiaryName: beneficiaryFullName, note });
    } catch (err: any) {
      toast.error('Error generando el PDF: ' + err.message);
    } finally {
      setPrintingNoteId(null);
    }
  };

  const handleDownloadProgressReport = async () => {
    if (!currentOrg) return;
    setDownloadingProgressReport(true);
    try {
      await downloadProgressReportPdf({
        organization: currentOrg,
        beneficiaryName: beneficiaryFullName,
        notes: sessionNotes,
        generalSummary: progressReportSummary,
      });
      setShowProgressReportModal(false);
    } catch (err: any) {
      toast.error('Error generando el PDF: ' + err.message);
    } finally {
      setDownloadingProgressReport(false);
    }
  };

  const tabs: { key: Tab; label: string; icon: any; count?: number }[] = [
    { key: 'resumen', label: 'Resumen', icon: Baby },
    { key: 'inscripciones', label: 'Inscripciones', icon: GraduationCap, count: enrollments.length },
    // Notas de Sesión es un feature de plan (has_session_notes) — pensado
    // para centros de terapia, no para guarderías. Oculta la pestaña
    // completa cuando el plan no lo incluye, mismo patrón que
    // buildNavItems(hasElectronicBilling) ya usa para ocultar "Facturas".
    ...(hasSessionNotes ? [{ key: 'progreso' as Tab, label: 'Progreso de Sesiones', icon: BookOpen, count: sessionNotes.length }] : []),
    { key: 'asistencia', label: 'Asistencia', icon: CalendarCheck, count: attendanceHistory.length },
    { key: 'cobros', label: 'Cobros', icon: DollarSign, count: charges.filter(c => c.status !== 'paid').length },
  ];

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Back button */}
      <button
        onClick={() => navigate('/app/beneficiarios')}
        className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-slate-900 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Volver a Beneficiarios
      </button>

      {/* Hero Profile Card */}
      <div className="bg-gradient-to-br from-indigo-600 to-violet-700 rounded-3xl p-6 text-white relative overflow-hidden">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmZmZmYiIGZpbGwtb3BhY2l0eT0iMC4wNSI+PGNpcmNsZSBjeD0iMzAiIGN5PSIzMCIgcj0iMzAiLz48L2c+PC9nPjwvc3ZnPg==')] opacity-30" />
        
        <div className="relative flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-6">
          {/* Avatar / Photo */}
          <div className="relative flex-shrink-0 self-center sm:self-auto">
            {photoDisplayUrl ? (
              <img
                src={photoDisplayUrl}
                alt={`${beneficiary.first_name} ${beneficiary.last_name}`}
                className="w-24 h-24 rounded-2xl object-cover border-4 border-white/30 shadow-xl"
              />
            ) : (
              <div className="w-24 h-24 rounded-2xl bg-white/20 flex items-center justify-center text-3xl font-extrabold border-4 border-white/30">
                {initials || <Baby className="w-10 h-10" />}
              </div>
            )}
            <label className="absolute -bottom-2 -right-2 w-8 h-8 bg-white rounded-full flex items-center justify-center cursor-pointer hover:bg-indigo-50 shadow-lg transition-colors" title="Cambiar foto">
              <Upload className="w-4 h-4 text-indigo-600" />
              <input type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} />
            </label>
            {uploadingPhoto && (
              <div className="absolute inset-0 bg-black/50 rounded-2xl flex items-center justify-center text-xs text-white font-bold">
                Subiendo...
              </div>
            )}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-extrabold truncate">
              {beneficiary.first_name} {beneficiary.last_name}
            </h1>
            <div className="flex flex-wrap items-center gap-3 mt-1.5">
              <span className="flex items-center gap-1 text-white/80 text-sm">
                <Calendar className="w-3.5 h-3.5" />
                {age}
                {beneficiary.birth_date && ` (${formatDate(beneficiary.birth_date)})`}
              </span>
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${beneficiary.is_active ? 'bg-emerald-400/30 text-white' : 'bg-white/20 text-white/70'}`}>
                {beneficiary.is_active ? '● Activo' : '○ Inactivo'}
              </span>
              {hasEnrollment && (
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-yellow-400/30 text-white">
                  {enrollments.filter(e => e.status === 'active').length} inscripción(es) activa(s)
                </span>
              )}
            </div>
            {beneficiary.consultation_reason && (
              <p className="text-white/70 text-xs mt-1.5 flex items-center gap-1">
                <Stethoscope className="w-3.5 h-3.5" />
                {beneficiary.consultation_reason}
              </p>
            )}
          </div>

          {/* Actions */}
          <div className="flex flex-col gap-2 sm:ml-auto">
            <button
              onClick={() => setShowEditModal(true)}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-white/15 hover:bg-white/25 rounded-xl text-sm font-bold transition-colors border border-white/20"
            >
              <Edit2 className="w-4 h-4" />
              Editar
            </button>
            {hasEnrollment && (
              <button
                onClick={openActa}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-white/15 hover:bg-white/25 rounded-xl text-sm font-bold transition-colors border border-white/20"
              >
                <FileText className="w-4 h-4" />
                Acta de Compromiso
              </button>
            )}
            <button
              onClick={() => navigate(`/app/matricula?beneficiaryId=${id}`)}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-white text-indigo-700 hover:bg-indigo-50 rounded-xl text-sm font-bold transition-colors shadow-md"
            >
              <Plus className="w-4 h-4" />
              Nueva Inscripción
            </button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="flex border-b border-slate-200 overflow-x-auto">
          {tabs.map(tab => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-2 px-5 py-4 text-sm font-bold whitespace-nowrap transition-all border-b-2 -mb-px ${
                  activeTab === tab.key
                    ? 'border-indigo-500 text-indigo-700 bg-indigo-50/50'
                    : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50'
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
                {tab.count !== undefined && tab.count > 0 && (
                  <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-extrabold ${
                    activeTab === tab.key ? 'bg-indigo-200 text-indigo-800' : 'bg-slate-200 text-slate-600'
                  }`}>
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <div className="p-6">
          
          {/* ─── TAB: Resumen ─────────────────────────────────────────────── */}
          {activeTab === 'resumen' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Representative Card */}
              <div className="space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-2">
                  <Users className="w-4 h-4" />
                  Representante(s) / Tutor(es)
                </h3>
                {representatives.length === 0 ? (
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-700 font-medium">
                    Sin representante vinculado. Edita el beneficiario para añadir uno.
                  </div>
                ) : (
                  representatives.map(rep => (
                    <div key={rep.id} className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-2">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center text-sm font-extrabold text-indigo-700">
                            {getInitials(rep.first_name, rep.last_name)}
                          </div>
                          <div>
                            <p className="font-bold text-slate-900 text-sm">{rep.first_name} {rep.last_name}</p>
                            <p className="text-xs text-slate-500">{rep.relationship || 'Tutor'}</p>
                          </div>
                        </div>
                        {representatives.length > 1 && (
                          <button
                            onClick={() => handleRemoveRepresentative(rep.id)}
                            className="text-xs font-semibold text-red-600 hover:text-red-800 hover:bg-red-50 px-2 py-1 rounded-lg transition-colors cursor-pointer shrink-0"
                            title="Quitar vínculo con este beneficiario"
                          >
                            Quitar
                          </button>
                        )}
                      </div>
                      {rep.identification && (
                        <p className="text-xs text-slate-600 font-mono flex items-center gap-1.5">
                          C.I.: {rep.identification}
                        </p>
                      )}
                      {rep.phone && (
                        <p className="text-xs text-slate-600 flex items-center gap-1.5">
                          <Phone className="w-3.5 h-3.5 text-slate-400" /> {rep.phone}
                        </p>
                      )}
                      {rep.email && (
                        <p className="text-xs text-slate-600 flex items-center gap-1.5">
                          <Mail className="w-3.5 h-3.5 text-slate-400" /> {rep.email}
                        </p>
                      )}
                    </div>
                  ))
                )}

                <button
                  onClick={() => setShowLinkRepModal(true)}
                  className="w-full flex items-center justify-center gap-1.5 text-xs font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 px-3 py-2.5 rounded-lg transition-colors cursor-pointer"
                >
                  <Users className="w-3.5 h-3.5" />
                  Vincular representante
                </button>
              </div>

              {/* Stats card */}
              <div className="space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-2">
                  <CheckCircle className="w-4 h-4" />
                  Resumen de Actividad
                </h3>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: 'Inscripciones Activas', value: enrollments.filter(e => e.status === 'active').length, color: 'text-indigo-700 bg-indigo-50 border-indigo-100' },
                    { label: 'Notas de Sesión', value: sessionNotes.length, color: 'text-violet-700 bg-violet-50 border-violet-100' },
                    { label: 'Cobros Pendientes', value: charges.filter(c => c.status !== 'paid').length, color: 'text-amber-700 bg-amber-50 border-amber-100' },
                    { label: 'Terapias Activas', value: allEnrollmentServices.filter(s => s.status === 'active').length, color: 'text-emerald-700 bg-emerald-50 border-emerald-100' },
                  ].map(stat => (
                    <div key={stat.label} className={`rounded-2xl border p-3 ${stat.color}`}>
                      <p className="text-2xl font-extrabold">{stat.value}</p>
                      <p className="text-xs font-semibold mt-0.5">{stat.label}</p>
                    </div>
                  ))}
                </div>

                {beneficiary.notes && (
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-600">
                    <p className="font-bold text-slate-700 mb-1">Notas / Diagnóstico Inicial:</p>
                    <p>{beneficiary.notes}</p>
                  </div>
                )}

                <div className="flex items-center gap-2 text-xs text-slate-500 bg-slate-50 rounded-xl p-3 border border-slate-100">
                  <Clock className="w-3.5 h-3.5" />
                  Registrado el {formatDate(beneficiary.created_at)}
                </div>
              </div>
            </div>
          )}

          {/* ─── TAB: Inscripciones ───────────────────────────────────────── */}
          {activeTab === 'inscripciones' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-slate-900 flex items-center gap-2">
                  <GraduationCap className="w-5 h-5 text-indigo-500" />
                  Historial de Inscripciones
                </h3>
                <button
                  onClick={() => navigate(`/app/matricula?beneficiaryId=${id}`)}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition"
                >
                  <Plus className="w-4 h-4" />
                  Nueva Inscripción
                </button>
              </div>

              {enrollments.length === 0 ? (
                <div className="py-16 text-center">
                  <GraduationCap className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                  <p className="font-semibold text-slate-600">Sin inscripciones formales aún.</p>
                  <p className="text-sm text-slate-400 mt-1">Las inscripciones se crean desde el módulo Nueva Matrícula.</p>
                  <button onClick={() => navigate(`/app/matricula?beneficiaryId=${id}`)} className="mt-4 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold rounded-xl transition">
                    Crear Inscripción
                  </button>
                </div>
              ) : (
                enrollments.map(enr => (
                  <div key={enr.id} className="border border-slate-200 rounded-2xl overflow-hidden">
                    <div className="flex items-center justify-between px-5 py-3 bg-slate-50 border-b border-slate-200">
                      <div className="flex items-center gap-3">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-bold border ${statusColor(enr.status)}`}>
                          {statusLabel(enr.status)}
                        </span>
                        <span className="text-sm font-bold text-slate-900">
                          Inscripción desde {formatDate(enr.start_date)}
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        {canEmitInvoices && (
                          <button onClick={() => setInvoicingEnrollmentId(enr.id)}
                            className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-700 hover:text-indigo-900 transition">
                            <DollarSign className="w-3.5 h-3.5" />
                            Facturar Inscripción
                          </button>
                        )}
                        {enr.status === 'active' && (
                          <button onClick={openActa}
                            className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-700 hover:text-indigo-900 transition">
                            <FileText className="w-3.5 h-3.5" />
                            Ver Acta
                          </button>
                        )}
                      </div>
                    </div>
                    {enr.services.length > 0 ? (
                      <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-white border-b border-slate-100 text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                          <tr>
                            <th className="px-5 py-2 text-left">Terapia / Servicio</th>
                            <th className="px-4 py-2 text-center">Ses./Semana</th>
                            <th className="px-4 py-2 text-center">Dur. (min)</th>
                            <th className="px-4 py-2 text-center">Precio</th>
                            <th className="px-4 py-2 text-center">Ses. Completadas</th>
                            <th className="px-4 py-2 text-center">Estado</th>
                            <th className="px-4 py-2 text-center"></th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                          {enr.services.map(svc => (
                            <tr key={svc.id} className="hover:bg-slate-50 group">
                              <td className="px-5 py-3 align-top">
                                <span className="font-semibold text-slate-800 block">{svc.service_name}</span>
                                {svc.schedules && svc.schedules.length > 0 ? (
                                  <div className="mt-1.5 space-y-1">
                                    {svc.schedules.map((sch, idx) => {
                                      const dayName = DAYS.find(d => d.value === sch.day_of_week)?.label || '';
                                      return (
                                        <div key={idx} className="text-[11px] font-medium text-slate-500 flex items-center gap-1.5">
                                          <div className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
                                          {dayName} de <span className="font-mono text-indigo-700">{sch.start_time}</span> a <span className="font-mono text-indigo-700">{sch.end_time}</span>
                                        </div>
                                      );
                                    })}
                                  </div>
                                ) : (
                                  <p className="mt-1 text-[11px] text-amber-600 bg-amber-50 px-2 py-0.5 rounded inline-block border border-amber-100">Sin horario asignado</p>
                                )}
                              </td>
                              <td className="px-4 py-3 text-center text-slate-600 align-top">{svc.sessions_per_week}x</td>
                              <td className="px-4 py-3 text-center text-slate-600 align-top">{svc.session_duration_min}'</td>
                              <td className="px-4 py-3 text-center font-mono font-bold text-indigo-800 align-top">
                                ${svc.unit_price.toFixed(2)}
                                <span className="text-[10px] font-normal text-slate-400">{svc.billing_mode === 'continuous' ? '/mes' : '/ses.'}</span>
                              </td>
                              <td className="px-4 py-3 text-center font-bold text-slate-900 align-top">{svc.sessions_completed}</td>
                              <td className="px-4 py-3 text-center align-top">
                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${statusColor(svc.status)}`}>
                                  {statusLabel(svc.status)}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-center align-top">
                                {svc.billing_mode === 'continuous' && enr.status === 'active' && svc.status === 'active' && (
                                  <button
                                    type="button"
                                    onClick={() => handleGenerateNextMonth(enr, svc)}
                                    disabled={generatingNextMonthFor === svc.id}
                                    title="Generar las fechas y el cargo del siguiente mes, continuando el mismo horario"
                                    className="inline-flex items-center gap-1 text-[11px] font-bold text-indigo-600 hover:text-indigo-800 disabled:opacity-50 whitespace-nowrap"
                                  >
                                    {generatingNextMonthFor === svc.id && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                                    Generar Próximo Mes
                                  </button>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      </div>
                    ) : (
                      <p className="px-5 py-3 text-sm text-slate-400 italic">Sin servicios registrados en esta inscripción.</p>
                    )}
                    {enr.notes && (
                      <p className="px-5 py-2 text-xs text-slate-500 bg-slate-50 border-t border-slate-100">Nota: {enr.notes}</p>
                    )}
                  </div>
                ))
              )}
            </div>
          )}

          {/* ─── TAB: Progreso de Sesiones ────────────────────────────────── */}
          {activeTab === 'progreso' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <h3 className="font-bold text-slate-900 flex items-center gap-2">
                  <BookOpen className="w-5 h-5 text-indigo-500" />
                  Registros de Avance por Sesión
                </h3>
                <div className="flex items-center gap-2">
                  {sessionNotes.length > 0 && (
                    <button
                      onClick={() => { setProgressReportSummary(''); setShowProgressReportModal(true); }}
                      className="inline-flex items-center gap-1.5 px-4 py-2 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-bold rounded-xl transition"
                    >
                      <Printer className="w-4 h-4" />
                      Imprimir Avance Completo
                    </button>
                  )}
                  {hasEnrollment && (
                    <button
                      onClick={() => setShowNoteForm(true)}
                      className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition"
                    >
                      <Plus className="w-4 h-4" />
                      Nueva Nota de Sesión
                    </button>
                  )}
                </div>
              </div>

              {!hasEnrollment && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800 font-medium flex items-center gap-3">
                  <AlertCircle className="w-5 h-5 flex-shrink-0" />
                  Se necesita una inscripción activa para registrar notas de sesión.
                </div>
              )}

              {sessionNotes.length === 0 ? (
                <div className="py-16 text-center">
                  <BookOpen className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                  <p className="font-semibold text-slate-600">Sin registros de avance todavía.</p>
                  <p className="text-sm text-slate-400 mt-1">Registra el progreso de cada sesión terapéutica del paciente.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {sessionNotes.map(note => (
                    <div key={note.id} className="border border-slate-200 rounded-2xl p-4 hover:border-indigo-200 transition-colors">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <span className="text-sm font-bold text-slate-900">
                              {formatDateWithWeekday(note.session_date)}
                            </span>
                            {note.therapist_name && (
                              <span className="text-xs bg-indigo-50 text-indigo-700 border border-indigo-100 px-2 py-0.5 rounded-full font-semibold">
                                {note.therapist_name}
                              </span>
                            )}
                          </div>
                          {note.observations && (
                            <div className="mb-2">
                              <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-0.5">Observaciones</p>
                              <p className="text-sm text-slate-700">{note.observations}</p>
                            </div>
                          )}
                          {note.goals_achieved && (
                            <div className="mb-2">
                              <p className="text-[11px] font-bold text-emerald-600 uppercase tracking-wider mb-0.5">✓ Logros</p>
                              <p className="text-sm text-slate-700">{note.goals_achieved}</p>
                            </div>
                          )}
                          {note.next_steps && (
                            <div>
                              <p className="text-[11px] font-bold text-indigo-600 uppercase tracking-wider mb-0.5">→ Próximos Pasos</p>
                              <p className="text-sm text-slate-700">{note.next_steps}</p>
                            </div>
                          )}
                        </div>
                        <div className="flex flex-col items-end gap-2 flex-shrink-0">
                          <button
                            onClick={() => handlePrintNote(note)}
                            disabled={printingNoteId === note.id}
                            title="Imprimir esta nota"
                            className="text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 p-1.5 rounded-lg transition-colors disabled:opacity-50 cursor-pointer"
                          >
                            {printingNoteId === note.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Printer className="w-4 h-4" />}
                          </button>
                          {note.rating && (
                            <div className="flex flex-col items-center bg-indigo-50 border border-indigo-100 rounded-xl px-3 py-2">
                              <span className="text-xl font-extrabold text-indigo-700">{note.rating}</span>
                              <div className="flex">
                                {[...Array(5)].map((_, i) => (
                                  <Star key={i} className={`w-3 h-3 ${i < note.rating! ? 'text-amber-400 fill-amber-400' : 'text-slate-300'}`} />
                                ))}
                              </div>
                              <span className="text-[10px] font-bold text-indigo-500 mt-0.5">Progreso</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ─── TAB: Asistencia ──────────────────────────────────────────── */}
          {activeTab === 'asistencia' && (
            <div className="space-y-4">
              <div>
                <h3 className="font-bold text-slate-900 flex items-center gap-2">
                  <CalendarCheck className="w-5 h-5 text-indigo-500" />
                  Historial de Asistencia
                </h3>
                <p className="text-sm text-slate-500 mt-1">
                  Registro completo de sesiones de {beneficiary.first_name} — quién marcó cada asistencia y cuándo.
                  Útil para verificar un día puntual ante una consulta del representante.
                </p>
              </div>

              {attendanceHistory.length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {([
                    { status: 'present', label: 'Presentes', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
                    { status: 'late', label: 'Tarde', cls: 'bg-amber-50 text-amber-700 border-amber-200' },
                    { status: 'absent', label: 'Ausentes', cls: 'bg-red-50 text-red-700 border-red-200' },
                    { status: 'justified', label: 'Justificados', cls: 'bg-blue-50 text-blue-700 border-blue-200' },
                  ] as const).map(({ status, label, cls }) => (
                    <div key={status} className={`rounded-xl border px-3 py-2 ${cls}`}>
                      <p className="text-lg font-bold leading-none">
                        {attendanceHistory.filter(a => a.status === status).length}
                      </p>
                      <p className="text-xs mt-0.5">{label}</p>
                    </div>
                  ))}
                </div>
              )}

              <AttendanceHistoryTable rows={attendanceHistory} showBeneficiary={false} />
            </div>
          )}

          {/* ─── TAB: Cobros ──────────────────────────────────────────────── */}
          {activeTab === 'cobros' && (
            <div className="space-y-4">
              <h3 className="font-bold text-slate-900 flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-indigo-500" />
                Historial de Cobros y Pagos
              </h3>

              {charges.length === 0 ? (
                <div className="py-16 text-center">
                  <DollarSign className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                  <p className="font-semibold text-slate-600">Sin cobros registrados.</p>
                  <p className="text-sm text-slate-400 mt-1">Los cobros se generan automáticamente al crear una inscripción.</p>
                </div>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-slate-200">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 text-[11px] uppercase font-bold text-slate-500 tracking-wider">
                      <tr>
                        <th className="px-4 py-3 text-left">Descripción</th>
                        <th className="px-4 py-3 text-center">Período</th>
                        <th className="px-4 py-3 text-center">Total</th>
                        <th className="px-4 py-3 text-center">Pagado</th>
                        <th className="px-4 py-3 text-center">Saldo</th>
                        <th className="px-4 py-3 text-center">Estado</th>
                        <th className="px-4 py-3 text-center">Acción</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {charges.map(charge => {
                        const remaining = charge.amount - (charge.paid_amount || 0);
                        return (
                          <tr key={charge.id} className="hover:bg-slate-50">
                            <td className="px-4 py-3 font-semibold text-slate-800 max-w-[180px]">
                              <span className="truncate block">{charge.description}</span>
                              {charge.due_date && (
                                <span className="text-[11px] text-slate-400 font-normal">
                                  Vence: {formatDate(charge.due_date)}
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-center text-xs text-slate-500">
                              {charge.period_label || '—'}
                            </td>
                            <td className="px-4 py-3 text-center font-mono font-bold text-slate-900">
                              ${charge.amount.toFixed(2)}
                            </td>
                            <td className="px-4 py-3 text-center font-mono font-bold text-emerald-700">
                              ${(charge.paid_amount || 0).toFixed(2)}
                            </td>
                            <td className="px-4 py-3 text-center font-mono font-bold text-red-700">
                              {remaining > 0 ? `$${remaining.toFixed(2)}` : '—'}
                            </td>
                            <td className="px-4 py-3 text-center">
                              <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold border ${chargeStatusColor(charge.status)}`}>
                                {chargeStatusLabel(charge.status)}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-center">
                              <div className="flex items-center justify-center gap-1.5">
                                <button
                                  onClick={() => setViewingCharge(charge)}
                                  className="px-2.5 py-1.5 text-xs font-bold text-slate-600 hover:text-indigo-700 hover:bg-indigo-50 rounded-lg transition"
                                >
                                  Ver historial
                                </button>
                                {charge.status !== 'paid' && (
                                  <button
                                    onClick={() => setPaymentTarget(charge)}
                                    className="px-3 py-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition"
                                  >
                                    Registrar Abono
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Modals */}
      {showNoteForm && beneficiary && currentOrg && (
        <NoteForm
          beneficiaryId={beneficiary.id}
          organizationId={currentOrg.id}
          enrollmentServices={allEnrollmentServices}
          initialDate={noteFormPrefill.date}
          initialServiceId={noteFormPrefill.serviceId}
          onClose={() => { setShowNoteForm(false); setNoteFormPrefill({}); }}
          onSuccess={loadAll}
        />
      )}

      {showProgressReportModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl p-6 w-full max-w-md">
            <h3 className="text-lg font-bold text-slate-900 mb-2 flex items-center gap-2">
              <Printer className="w-5 h-5 text-indigo-500" />
              Imprimir Avance Completo
            </h3>
            <p className="text-sm text-slate-500 mb-4">
              Se generará un PDF con las {sessionNotes.length} nota(s) de sesión de {beneficiaryFullName}, en orden cronológico.
            </p>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Resumen General (opcional)</label>
            <textarea
              value={progressReportSummary}
              onChange={(e) => setProgressReportSummary(e.target.value)}
              rows={3}
              placeholder="Escribe un resumen del avance general antes de imprimir — aparece destacado al inicio del documento."
              className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 mb-4"
            />
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowProgressReportModal(false)}
                disabled={downloadingProgressReport}
                className="px-4 py-2 text-sm font-semibold text-slate-600 hover:text-slate-900 disabled:opacity-50 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={handleDownloadProgressReport}
                disabled={downloadingProgressReport}
                className="inline-flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2 rounded-lg text-sm font-semibold shadow-sm transition-colors disabled:opacity-50 cursor-pointer"
              >
                {downloadingProgressReport && <Loader2 className="w-4 h-4 animate-spin" />}
                {downloadingProgressReport ? 'Generando...' : 'Descargar PDF'}
              </button>
            </div>
          </div>
        </div>
      )}

      {paymentTarget && (
        <RegisterPaymentModal
          charge={paymentTarget}
          paidSoFar={paymentTarget.paid_amount || 0}
          onClose={() => setPaymentTarget(null)}
          onSuccess={loadAll}
          hasElectronicBilling={canEmitInvoices}
          beneficiaryId={beneficiary?.id}
        />
      )}

      {invoicingEnrollmentId && currentOrg && beneficiary && (
        <InvoiceEnrollmentModal
          enrollmentId={invoicingEnrollmentId}
          organizationId={currentOrg.id}
          beneficiaryId={beneficiary.id}
          beneficiaryName={`${beneficiary.first_name} ${beneficiary.last_name}`}
          onClose={() => setInvoicingEnrollmentId(null)}
          onSuccess={loadAll}
        />
      )}

      {currentOrg && beneficiary && (
        <PaymentDetailModal
          isOpen={!!viewingCharge}
          onClose={() => setViewingCharge(null)}
          charge={viewingCharge}
          payments={viewingCharge?.payments || []}
          onPayRemaining={(c) => setPaymentTarget(c)}
          onInvoiceChanged={loadAll}
          organization={currentOrg}
          beneficiaryId={beneficiary.id}
          beneficiaryName={`${beneficiary.first_name} ${beneficiary.last_name}`}
        />
      )}

      {actaData && (
        <ActaCompromisoModal
          isOpen={isActaOpen}
          onClose={() => { setIsActaOpen(false); setActaData(null); }}
          data={actaData}
        />
      )}

      {showEditModal && (
        <BeneficiaryModal
          mode="edit"
          initial={{
            first_name: beneficiary.first_name,
            last_name: beneficiary.last_name,
            birth_date: beneficiary.birth_date || '',
            consultation_reason: beneficiary.consultation_reason || '',
            photo_consent: beneficiary.photo_consent ?? true,
            notes: beneficiary.notes || '',
            rep_mode: 'existing',
            selected_rep_id: representatives[0]?.id || '',
            rep_cedula: representatives[0]?.identification || '',
            rep_first_name: representatives[0]?.first_name || '',
            rep_last_name: representatives[0]?.last_name || '',
            rep_phone: representatives[0]?.phone || '',
            rep_email: representatives[0]?.email || '',
            rep_relationship: representatives[0]?.relationship || 'Madre',
          }}
          isActive={beneficiary.is_active}
          submitting={editSubmitting}
          existingReps={orgRepresentatives}
          onClose={() => setShowEditModal(false)}
          onSubmit={handleEditSubmit}
        />
      )}

      {showLinkRepModal && currentOrg && (
        <LinkRepresentativeModal
          organizationId={currentOrg.id}
          candidates={orgRepresentatives.filter(r => !representatives.some(rr => rr.id === r.id))}
          saving={savingRepLink}
          onClose={() => setShowLinkRepModal(false)}
          onSelectExisting={handleAddRepresentative}
          onCreated={handleAddRepresentative}
        />
      )}
    </div>
  );
}
