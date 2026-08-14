import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router';
import { useOrg } from './OrgContext';
import { supabase } from '../../lib/supabase';
import toast from 'react-hot-toast';
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
} from 'lucide-react';
import { ActaCompromisoModal } from './ActaCompromisoModal';
import type { CommitmentData } from './ActaCompromisoModal';

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

type Tab = 'resumen' | 'inscripciones' | 'progreso' | 'cobros';

type Beneficiary = {
  id: string;
  first_name: string;
  last_name: string;
  birth_date: string | null;
  consultation_reason: string | null;
  photo_consent: boolean;
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
  description: string;
  amount: number;
  due_date: string | null;
  status: string;
  period_label: string | null;
  paid_amount?: number;
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
  return status === 'paid' ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
    : status === 'partial' ? 'text-amber-700 bg-amber-50 border-amber-200'
    : 'text-red-700 bg-red-50 border-red-200';
}

function chargeStatusLabel(status: string) {
  return status === 'paid' ? 'Pagado' : status === 'partial' ? 'Parcial' : 'Pendiente';
}

// ─── Payment Modal ────────────────────────────────────────────────────────────

interface PaymentModalProps {
  charge: Charge;
  organizationId: string;
  onClose: () => void;
  onSuccess: () => void;
}

function PaymentModal({ charge, organizationId, onClose, onSuccess }: PaymentModalProps) {
  const [amount, setAmount] = useState<string>('');
  const [method, setMethod] = useState<'cash' | 'transfer' | 'card' | 'other'>('cash');
  const [reference, setReference] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const remaining = charge.amount - (charge.paid_amount || 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const val = Number(amount);
    if (!val || val <= 0) { toast.error('Ingresa un monto válido.'); return; }
    if (val > remaining) { toast.error(`El abono no puede superar el saldo pendiente de $${remaining.toFixed(2)}.`); return; }

    setSubmitting(true);
    try {
      await supabase.from('internal_payments').insert({
        organization_id: organizationId,
        charge_id: charge.id,
        amount: val,
        payment_date: new Date().toISOString().split('T')[0],
        method,
        reference: reference.trim() || null,
      });
      toast.success('Pago registrado exitosamente.');
      onSuccess();
      onClose();
    } catch (err: any) {
      toast.error('Error al registrar el pago: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-fadeIn">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-sm p-6 space-y-4 animate-popIn">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-slate-900">Registrar Abono / Pago</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
        </div>

        <div className="bg-slate-50 rounded-xl p-3 text-xs font-medium text-slate-600 space-y-1">
          <p>Cargo: <strong className="text-slate-900">{charge.description}</strong></p>
          <p>Total: <strong className="font-mono">${charge.amount.toFixed(2)}</strong></p>
          <p>Pagado: <strong className="font-mono text-emerald-700">${(charge.paid_amount || 0).toFixed(2)}</strong></p>
          <p>Saldo Pendiente: <strong className="font-mono text-red-700">${remaining.toFixed(2)}</strong></p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Monto del Abono ($) <span className="text-red-500">*</span></label>
            <input
              type="number" step="0.01" min="0.01" max={remaining}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder={`Máx. $${remaining.toFixed(2)}`}
              className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm font-mono focus:ring-2 focus:ring-indigo-500"
              autoFocus
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Método de Pago</label>
            <select value={method} onChange={(e) => setMethod(e.target.value as any)}
              className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500">
              <option value="cash">💵 Efectivo</option>
              <option value="transfer">🏦 Transferencia</option>
              <option value="card">💳 Tarjeta</option>
              <option value="other">🔄 Otro</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Referencia (opcional)</label>
            <input type="text" value={reference} onChange={(e) => setReference(e.target.value)}
              placeholder="Nº transferencia, comprobante..."
              className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500" />
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 py-2 text-sm font-bold text-slate-600 border border-slate-300 rounded-xl hover:bg-slate-50">Cancelar</button>
            <button type="submit" disabled={submitting}
              className="flex-1 py-2 text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition disabled:opacity-50">
              {submitting ? 'Guardando...' : 'Registrar Pago'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Session Note Form ─────────────────────────────────────────────────────────

interface NoteFormProps {
  beneficiaryId: string;
  organizationId: string;
  enrollmentServices: EnrollmentServiceRow[];
  onClose: () => void;
  onSuccess: () => void;
}

function NoteForm({ beneficiaryId, organizationId, enrollmentServices, onClose, onSuccess }: NoteFormProps) {
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [serviceId, setServiceId] = useState(enrollmentServices[0]?.id || '');
  const [therapistName, setTherapistName] = useState('');
  const [observations, setObservations] = useState('');
  const [goals, setGoals] = useState('');
  const [nextSteps, setNextSteps] = useState('');
  const [rating, setRating] = useState<number>(3);
  const [submitting, setSubmitting] = useState(false);

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
                  <option key={s.id} value={s.id}>{s.service_name}</option>
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
            <label className="block text-xs font-bold text-slate-700 mb-1">Observaciones de la Sesión <span className="text-red-500">*</span></label>
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
              className="flex-1 py-2.5 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition disabled:opacity-50">
              {submitting ? 'Guardando...' : 'Guardar Nota'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────

export function BeneficiaryDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { currentOrg } = useOrg();
  const [activeTab, setActiveTab] = useState<Tab>('resumen');
  const [loading, setLoading] = useState(true);

  const [beneficiary, setBeneficiary] = useState<Beneficiary | null>(null);
  const [representatives, setRepresentatives] = useState<Representative[]>([]);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [sessionNotes, setSessionNotes] = useState<SessionNote[]>([]);
  const [charges, setCharges] = useState<Charge[]>([]);

  const [showNoteForm, setShowNoteForm] = useState(false);
  const [paymentTarget, setPaymentTarget] = useState<Charge | null>(null);
  const [actaData, setActaData] = useState<CommitmentData | null>(null);
  const [isActaOpen, setIsActaOpen] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  // All enrollment services across all active enrollments
  const allEnrollmentServices = enrollments.flatMap(e => e.services);

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

      // Charges with paid amounts
      const { data: chargesData } = await supabase
        .from('charges')
        .select('*, internal_payments(amount)')
        .eq('beneficiary_id', id)
        .order('created_at', { ascending: false });

      setCharges((chargesData || []).map((c: any) => ({
        ...c,
        paid_amount: (c.internal_payments || []).reduce((sum: number, p: any) => sum + (p.amount || 0), 0),
      })));

    } catch (err) {
      console.error(err);
      toast.error('Error al cargar datos del beneficiario.');
    } finally {
      setLoading(false);
    }
  }, [id, currentOrg, navigate]);

  useEffect(() => { loadAll(); }, [loadAll]);

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
      const { data: urlData } = supabase.storage.from('beneficiary-photos').getPublicUrl(path);
      await supabase.from('beneficiaries').update({ photo_url: urlData.publicUrl }).eq('id', id);
      toast.success('Foto actualizada correctamente.');
      await loadAll();
    } catch (err: any) {
      toast.error('Error al subir foto: ' + err.message);
    } finally {
      setUploadingPhoto(false);
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
      photoConsent: beneficiary.photo_consent,
      therapies: (comData as any)?.selected_therapies || {},
      paymentFrequency: (comData as any)?.payment_frequency || 'session',
      signedDate: (comData as any)?.signed_at ? new Date((comData as any).signed_at).toLocaleDateString('es-EC') : undefined,
      orgName: currentOrg.name,
      city: currentOrg.city || 'La Troncal',
    });
    setIsActaOpen(true);
  };

  // ─── Render ───────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32 text-slate-400 animate-pulse text-sm">
        Cargando datos del beneficiario...
      </div>
    );
  }

  if (!beneficiary) return null;

  const age = calculateAge(beneficiary.birth_date);
  const initials = getInitials(beneficiary.first_name, beneficiary.last_name);
  const primaryRep = representatives[0];
  const hasEnrollment = enrollments.length > 0;

  const tabs: { key: Tab; label: string; icon: any; count?: number }[] = [
    { key: 'resumen', label: 'Resumen', icon: Baby },
    { key: 'inscripciones', label: 'Inscripciones', icon: GraduationCap, count: enrollments.length },
    { key: 'progreso', label: 'Progreso de Sesiones', icon: BookOpen, count: sessionNotes.length },
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
        
        <div className="relative flex items-center gap-6">
          {/* Avatar / Photo */}
          <div className="relative flex-shrink-0">
            {beneficiary.photo_url ? (
              <img
                src={beneficiary.photo_url}
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
                {beneficiary.birth_date && ` (${new Date(beneficiary.birth_date + 'T00:00:00').toLocaleDateString('es-EC')})`}
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
          <div className="flex flex-col gap-2 ml-auto">
            {hasEnrollment && (
              <button
                onClick={openActa}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-white/15 hover:bg-white/25 rounded-xl text-sm font-bold transition-colors border border-white/20"
              >
                <FileText className="w-4 h-4" />
                Acta de Compromiso
              </button>
            )}
            <button
              onClick={() => navigate('/app/matricula')}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-white text-indigo-700 hover:bg-indigo-50 rounded-xl text-sm font-bold transition-colors shadow-md"
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
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center text-sm font-extrabold text-indigo-700">
                          {getInitials(rep.first_name, rep.last_name)}
                        </div>
                        <div>
                          <p className="font-bold text-slate-900 text-sm">{rep.first_name} {rep.last_name}</p>
                          <p className="text-xs text-slate-500">{rep.relationship || 'Tutor'}</p>
                        </div>
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
                  Registrado el {new Date(beneficiary.created_at).toLocaleDateString('es-EC', { day: '2-digit', month: 'long', year: 'numeric' })}
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
                  onClick={() => navigate('/app/matricula')}
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
                  <button onClick={() => navigate('/app/matricula')} className="mt-4 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold rounded-xl transition">
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
                          Inscripción desde {new Date(enr.start_date + 'T00:00:00').toLocaleDateString('es-EC')}
                        </span>
                      </div>
                      {enr.status === 'active' && (
                        <button onClick={openActa}
                          className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-700 hover:text-indigo-900 transition">
                          <FileText className="w-3.5 h-3.5" />
                          Ver Acta
                        </button>
                      )}
                    </div>
                    {enr.services.length > 0 ? (
                      <table className="w-full text-sm">
                        <thead className="bg-white border-b border-slate-100 text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                          <tr>
                            <th className="px-5 py-2 text-left">Terapia / Servicio</th>
                            <th className="px-4 py-2 text-center">Ses./Semana</th>
                            <th className="px-4 py-2 text-center">Dur. (min)</th>
                            <th className="px-4 py-2 text-center">Precio/Sesión</th>
                            <th className="px-4 py-2 text-center">Ses. Completadas</th>
                            <th className="px-4 py-2 text-center">Estado</th>
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
                              <td className="px-4 py-3 text-center font-mono font-bold text-indigo-800 align-top">${svc.unit_price.toFixed(2)}</td>
                              <td className="px-4 py-3 text-center font-bold text-slate-900 align-top">{svc.sessions_completed}</td>
                              <td className="px-4 py-3 text-center align-top">
                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${statusColor(svc.status)}`}>
                                  {statusLabel(svc.status)}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
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
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-slate-900 flex items-center gap-2">
                  <BookOpen className="w-5 h-5 text-indigo-500" />
                  Registros de Avance por Sesión
                </h3>
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
                              {new Date(note.session_date + 'T00:00:00').toLocaleDateString('es-EC', { weekday: 'long', day: 'numeric', month: 'long' })}
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
                        {note.rating && (
                          <div className="flex-shrink-0 flex flex-col items-center bg-indigo-50 border border-indigo-100 rounded-xl px-3 py-2">
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
                  ))}
                </div>
              )}
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
                                  Vence: {new Date(charge.due_date + 'T00:00:00').toLocaleDateString('es-EC')}
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
                              {charge.status !== 'paid' && (
                                <button
                                  onClick={() => setPaymentTarget(charge)}
                                  className="px-3 py-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition"
                                >
                                  Registrar Abono
                                </button>
                              )}
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
          onClose={() => setShowNoteForm(false)}
          onSuccess={loadAll}
        />
      )}

      {paymentTarget && currentOrg && (
        <PaymentModal
          charge={paymentTarget}
          organizationId={currentOrg.id}
          onClose={() => setPaymentTarget(null)}
          onSuccess={loadAll}
        />
      )}

      {actaData && (
        <ActaCompromisoModal
          isOpen={isActaOpen}
          onClose={() => { setIsActaOpen(false); setActaData(null); }}
          data={actaData}
        />
      )}
    </div>
  );
}
