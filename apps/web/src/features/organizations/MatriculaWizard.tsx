import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router';
import { supabase } from '../../lib/supabase';
import { useOrg } from './OrgContext';
import {
  CheckCircle,
  Baby,
  Users,
  ArrowRight,
  ArrowLeft,
  Save,
  Plus,
  Trash2,
  GraduationCap,
  FileText,
  Loader2,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { ActaCompromisoModal } from './ActaCompromisoModal';
import { EntityAutocomplete } from '../../components/ui/EntityAutocomplete';
import { formatDate } from '../../lib/formatDate';
import { generateMonthlyDates } from '../../lib/monthlySchedule';

const WEEKDAY_TOGGLES = [
  { day: 1, label: 'Lun' },
  { day: 2, label: 'Mar' },
  { day: 3, label: 'Mié' },
  { day: 4, label: 'Jue' },
  { day: 5, label: 'Vie' },
  { day: 6, label: 'Sáb' },
  { day: 0, label: 'Dom' },
];
const DEFAULT_MONTHLY_DAYS = [1, 2, 3, 4, 5];
type MonthlyDraft = { days: number[]; startTime: string; endTime: string };

// ─── Types ────────────────────────────────────────────────────────────────────

const DAY_LABELS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

function offsetDateStr(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(y, m - 1, d + days);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
}

function weekdayLabel(dateStr: string): string {
  return DAY_LABELS[getDayOfWeekLocal(dateStr)];
}

function getDayOfWeekLocal(dateStr: string): number {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d).getDay();
}

// Informational only (shown as "1x/sem" etc. elsewhere) — never used for
// pricing anymore. Distinct weekdays among the exact dates picked.
function distinctWeekdayCount(dates: ExactSession[]): number {
  return new Set(dates.map(d => getDayOfWeekLocal(d.date))).size || 1;
}

type ServiceItem = {
  id: string;
  name: string;
  price: number;
};

type ExactSession = { date: string; time: string };

type EnrollmentServiceLine = {
  service_id: string;
  service_name: string;
  session_duration_min: number;
  unit_price: number;
  sessionDates: ExactSession[]; // exact calendar dates picked by hand — the actual source of truth for attendance
  billing_mode: 'continuous' | 'finite';
};

type BeneficiaryForm = {
  id?: string;
  first_name: string;
  last_name: string;
  birth_date: string;
  consultation_reason: string;
  photo_consent: boolean;
};

type RepresentativeForm = {
  id?: string;
  cedula: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  relationship: string;
};

// ─── Component ────────────────────────────────────────────────────────────────

export function MatriculaWizard() {
  const { currentOrg } = useOrg();
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [benMode, setBenMode] = useState<'search' | 'create'>('search');
  const [repMode, setRepMode] = useState<'search' | 'create'>('search');

  const [services, setServices] = useState<ServiceItem[]>([]);
  const [enrollmentServices, setEnrollmentServices] = useState<EnrollmentServiceLine[]>([]);
  const [showQuickService, setShowQuickService] = useState(false);
  const [quickServiceName, setQuickServiceName] = useState('');
  const [quickServicePrice, setQuickServicePrice] = useState<number | ''>('');
  const [creatingQuickService, setCreatingQuickService] = useState(false);
  const [addingServiceId, setAddingServiceId] = useState('');
  const [dateDraft, setDateDraft] = useState<Record<string, { date: string; time: string }>>({});
  const [monthlyDraft, setMonthlyDraft] = useState<Record<string, MonthlyDraft>>({});
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);
  const [previousDeposit, setPreviousDeposit] = useState<number>(0);
  const [startDate, setStartDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [dueDate, setDueDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [chargeNotes, setChargeNotes] = useState('');
  const [sourceAppointmentId, setSourceAppointmentId] = useState<string | null>(null);
  const [additionalPayment, setAdditionalPayment] = useState<number | ''>('');
  const [additionalPaymentMethod, setAdditionalPaymentMethod] = useState('cash');
  const [additionalPaymentDate, setAdditionalPaymentDate] = useState(new Date().toISOString().split('T')[0]);

  const [beneficiary, setBeneficiary] = useState<BeneficiaryForm>({
    first_name: '',
    last_name: '',
    birth_date: '',
    consultation_reason: '',
    photo_consent: true,
  });

  const [representative, setRepresentative] = useState<RepresentativeForm>({
    cedula: '',
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    relationship: 'Madre',
  });

  // Total = precio/sesión × cantidad real de fechas agregadas. No usa
  // "sesiones/semana" — ese campo quedó desconectado del conteo real y
  // generaba cargos que no correspondían a las fechas efectivamente creadas.
  const totalAmount = enrollmentServices.reduce(
    (sum, s) => sum + s.unit_price * s.sessionDates.length,
    0
  );

  // ─── Effects ────────────────────────────────────────────────────────────────

  const initialized = useRef(false);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    const params = new URLSearchParams(window.location.search);
    const pName = params.get('patientName');
    const rName = params.get('repName');
    const ph = params.get('phone');
    const dep = params.get('depositAmount');
    const apptId = params.get('appointmentId');
    const benId = params.get('beneficiaryId');

    let hasData = false;

    if (apptId) setSourceAppointmentId(apptId);

    if (dep) setPreviousDeposit(Number(dep) || 0);

    // Coming from "Nueva Inscripción" on an existing beneficiary's detail
    // page: load the beneficiary and their primary representative and skip
    // straight to step 3 — both are already resolved, nothing to search.
    if (benId) {
      (async () => {
        const { data: ben } = await supabase.from('beneficiaries').select('*').eq('id', benId).single();
        if (ben) {
          setBeneficiary({
            id: ben.id,
            first_name: ben.first_name,
            last_name: ben.last_name,
            birth_date: ben.birth_date || '',
            consultation_reason: ben.consultation_reason || '',
            photo_consent: ben.photo_consent ?? true,
          });
          setBenMode('search');
        }

        const hasRep = await prefillRepresentativeFor(benId);

        if (ben) {
          toast.success(`Matriculando a ${ben.first_name} ${ben.last_name}.`);
          setCurrentStep(hasRep ? 3 : 2);
        }
      })();
      return;
    }

    if (pName) {
      const parts = pName.trim().split(' ');
      setBeneficiary(prev => ({ ...prev, first_name: parts[0] || '', last_name: parts.slice(1).join(' ') || '' }));
      setBenMode('create');
      hasData = true;
    }
    
    if (rName || ph) {
      const rParts = (rName || '').trim().split(' ');
      setRepresentative(prev => ({
        ...prev,
        first_name: rParts[0] || '',
        last_name: rParts.slice(1).join(' ') || '',
        phone: ph || prev.phone,
      }));
      setRepMode('create');
      hasData = true;
    }

    if (hasData) {
      toast.success('Datos de la cita cargados automáticamente.');
    }
  }, []);

  useEffect(() => {
    if (currentOrg && currentStep === 3) loadServices();
  }, [currentOrg, currentStep]);

  // ─── Data Loaders ────────────────────────────────────────────────────────────

  const loadServices = async () => {
    if (!currentOrg) return;
    try {
      const { data, error } = await supabase
        .from('services')
        .select('id, name, price')
        .eq('organization_id', currentOrg.id)
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      setServices(data || []);
    } catch (err) {
      console.error('Error loading services', err);
    }
  };

  const fetchBeneficiaries = async (query: string) => {
    if (!currentOrg) return [];
    const { data } = await supabase
      .from('beneficiaries')
      .select('*')
      .eq('organization_id', currentOrg.id)
      .or(`first_name.ilike.%${query}%,last_name.ilike.%${query}%`)
      .limit(5);
    return data || [];
  };

  const fetchRepresentatives = async (query: string) => {
    if (!currentOrg) return [];
    const isDigits = /^\d+$/.test(query);
    let q = supabase.from('representatives').select('*').eq('organization_id', currentOrg.id);
    if (isDigits) {
      q = q.ilike('identification', `%${query}%`);
    } else {
      q = q.or(`first_name.ilike.%${query}%,last_name.ilike.%${query}%`);
    }
    const { data } = await q.limit(5);
    return data || [];
  };

  // Un beneficiario existente casi siempre ya tiene representante(s)
  // vinculados — precargar el principal evita que el usuario tenga que
  // volver a buscarlo manualmente en el Paso 2. El campo queda editable:
  // esto solo fija un valor por defecto, nunca bloquea el paso.
  const prefillRepresentativeFor = async (benId: string): Promise<boolean> => {
    const { data: repLink } = await supabase
      .from('beneficiary_representatives')
      .select('representatives(*)')
      .eq('beneficiary_id', benId)
      .order('is_primary', { ascending: false })
      .limit(1)
      .maybeSingle();
    const rep: any = (repLink as any)?.representatives;
    if (rep) {
      setRepresentative({
        id: rep.id,
        cedula: rep.identification || '',
        first_name: rep.first_name,
        last_name: rep.last_name,
        email: rep.email || '',
        phone: rep.phone || '',
        relationship: rep.relationship || 'Madre',
      });
      setRepMode('search');
      return true;
    }
    setRepresentative({ cedula: '', first_name: '', last_name: '', email: '', phone: '', relationship: 'Madre' });
    setRepMode('search');
    return false;
  };

  // Create a catalog service on the spot, without leaving the wizard — for
  // when staff realize mid-matrícula that the therapy isn't in the catalog
  // yet and don't want to lose everything already filled in.
  const handleCreateQuickService = async () => {
    if (!currentOrg) return;
    if (!quickServiceName.trim()) { toast.error('Ponle un nombre al servicio.'); return; }
    if (!quickServicePrice || Number(quickServicePrice) < 0) { toast.error('Ingresa un precio válido.'); return; }

    setCreatingQuickService(true);
    try {
      const { data, error } = await supabase
        .from('services')
        .insert({
          organization_id: currentOrg.id,
          name: quickServiceName.trim(),
          price: Number(quickServicePrice),
          is_active: true,
        })
        .select('id, name, price')
        .single();
      if (error) throw error;

      setServices(prev => [...prev, data as ServiceItem]);
      setAddingServiceId(data.id);
      setQuickServiceName('');
      setQuickServicePrice('');
      setShowQuickService(false);
      toast.success(`Servicio "${data.name}" creado y agregado al catálogo.`);
    } catch (err: any) {
      toast.error('Error creando servicio: ' + err.message);
    } finally {
      setCreatingQuickService(false);
    }
  };

  // ─── Service Lines ────────────────────────────────────────────────────────────

  const addServiceLine = () => {
    if (!addingServiceId) { toast.error('Selecciona un servicio primero.'); return; }
    const svc = services.find(s => s.id === addingServiceId);
    if (!svc) return;
    if (enrollmentServices.some(e => e.service_id === svc.id)) {
      toast.error('Este servicio ya está en la lista.'); return;
    }
    setEnrollmentServices(prev => [
      ...prev,
      {
        service_id: svc.id,
        service_name: svc.name,
        session_duration_min: 40,
        unit_price: svc.price,
        sessionDates: [],
        billing_mode: 'continuous',
      }
    ]);
    setAddingServiceId('');
  };

  const removeServiceLine = (serviceId: string) => {
    setEnrollmentServices(prev => prev.filter(e => e.service_id !== serviceId));
  };

  const updateServiceLine = (serviceId: string, field: keyof Omit<EnrollmentServiceLine, 'sessionDates'>, value: number | string) => {
    setEnrollmentServices(prev =>
      prev.map(e => (e.service_id === serviceId ? { ...e, [field]: value } : e))
    );
  };

  // ─── Exact session dates (no day-of-week recurrence math) ───────────────────

  const addSessionDate = (serviceId: string, date: string, time: string) => {
    if (!date || !time) { toast.error('Elige fecha y hora de la sesión.'); return; }
    setEnrollmentServices(prev =>
      prev.map(e => {
        if (e.service_id !== serviceId) return e;
        if (e.sessionDates.some(s => s.date === date && s.time === time)) {
          toast.error('Esa fecha y hora ya está en la lista.');
          return e;
        }
        const next = [...e.sessionDates, { date, time }].sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
        return { ...e, sessionDates: next };
      })
    );
  };

  const removeSessionDate = (serviceId: string, index: number) => {
    setEnrollmentServices(prev =>
      prev.map(e => (e.service_id === serviceId ? { ...e, sessionDates: e.sessionDates.filter((_, i) => i !== index) } : e))
    );
  };

  // Explicit, one-click convenience — not automatic recurrence: duplicates
  // one existing date exactly 7 days later, same time.
  const addWeekAfter = (serviceId: string, sourceDate: string, time: string) => {
    addSessionDate(serviceId, offsetDateStr(sourceDate, 7), time);
  };

  // ─── Servicio Mensual: relleno automático de un mes de fechas exactas ───────
  // Sigue siendo el mismo sessionDates de siempre — esto solo ahorra escribir
  // 20-30 fechas a mano. El cobro nunca cambia de fórmula (unit_price × cantidad
  // real de fechas), nunca se calcula aparte por una tarifa semanal.

  const getMonthlyDraft = (serviceId: string): MonthlyDraft =>
    monthlyDraft[serviceId] || { days: DEFAULT_MONTHLY_DAYS, startTime: '08:00', endTime: '13:00' };

  const toggleMonthlyDay = (serviceId: string, day: number) => {
    setMonthlyDraft(prev => {
      const current = prev[serviceId] || { days: DEFAULT_MONTHLY_DAYS, startTime: '08:00', endTime: '13:00' };
      const days = current.days.includes(day) ? current.days.filter(d => d !== day) : [...current.days, day];
      return { ...prev, [serviceId]: { ...current, days } };
    });
  };

  const updateMonthlyTime = (serviceId: string, field: 'startTime' | 'endTime', value: string) => {
    setMonthlyDraft(prev => {
      const current = prev[serviceId] || { days: DEFAULT_MONTHLY_DAYS, startTime: '08:00', endTime: '13:00' };
      return { ...prev, [serviceId]: { ...current, [field]: value } };
    });
  };

  const bulkAddSessionDates = (serviceId: string, dates: string[], time: string) => {
    setEnrollmentServices(prev =>
      prev.map(e => {
        if (e.service_id !== serviceId) return e;
        const existing = new Set(e.sessionDates.map(s => `${s.date}|${s.time}`));
        const additions = dates.filter(date => !existing.has(`${date}|${time}`)).map(date => ({ date, time }));
        if (additions.length === 0) return e;
        const next = [...e.sessionDates, ...additions].sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
        return { ...e, sessionDates: next };
      })
    );
  };

  const handleGenerateMonthlyDates = (serviceId: string) => {
    if (!startDate) { toast.error('Define primero la Fecha de Inicio de Clases.'); return; }
    const draft = getMonthlyDraft(serviceId);
    if (draft.days.length === 0) { toast.error('Selecciona al menos un día de la semana.'); return; }
    if (draft.endTime <= draft.startTime) { toast.error('La hora de fin debe ser posterior a la hora de inicio.'); return; }

    const dates = generateMonthlyDates(startDate, draft.days);
    if (dates.length === 0) { toast.error('No se generó ninguna fecha con esos días.'); return; }

    const [sh, sm] = draft.startTime.split(':').map(Number);
    const [eh, em] = draft.endTime.split(':').map(Number);
    const durationMin = (eh * 60 + em) - (sh * 60 + sm);

    bulkAddSessionDates(serviceId, dates, draft.startTime);
    updateServiceLine(serviceId, 'session_duration_min', durationMin);
    toast.success(`Se generaron ${dates.length} fechas, del ${formatDate(dates[0])} al ${formatDate(dates[dates.length - 1])}.`);
  };

  // ─── Validation ────────────────────────────────────────────────────────────────

  const handleNext = () => {
    if (currentStep === 1) {
      if (benMode === 'create') {
        if (!beneficiary.first_name.trim() || !beneficiary.last_name.trim()) {
          toast.error('Por favor ingresa nombres y apellidos del paciente.');
          return;
        }
      } else if (!beneficiary.id) {
        toast.error('Por favor busca y selecciona un paciente, o cambia a Crear Nuevo.');
        return;
      }
    }
    if (currentStep === 2) {
      if (repMode === 'create') {
        if (!representative.first_name.trim() || !representative.last_name.trim()) {
          toast.error('Ingresa nombres y apellidos del representante.');
          return;
        }
        if (representative.cedula.trim() && representative.cedula.trim().length !== 10) {
          toast.error('La cédula debe contener exactamente 10 dígitos.');
          return;
        }
        if (representative.phone.trim() && representative.phone.trim().length !== 10) {
          toast.error('El teléfono debe contener exactamente 10 dígitos.');
          return;
        }
      } else if (!representative.id) {
        toast.error('Por favor busca y selecciona un tutor, o cambia a Crear Nuevo.');
        return;
      }
    }
    if (currentStep === 3) {
      if (enrollmentServices.length === 0) {
        toast.error('Debes agregar al menos un servicio/terapia.');
        return;
      }
    }
    setCurrentStep(prev => prev + 1);
  };

  const handleBack = () => setCurrentStep(prev => prev - 1);

  // ─── Submit ────────────────────────────────────────────────────────────────

  const handleSubmit = async () => {
    if (!currentOrg) return;

    // Aviso (no bloqueo) si el beneficiario ya tiene una inscripción
    // ACTIVA con alguno de los mismos servicios — evita el caso real de
    // crear sin querer una segunda inscripción duplicada del mismo
    // servicio en vez de, por ejemplo, editar la existente.
    if (beneficiary.id && enrollmentServices.length > 0) {
      const { data: activeRows } = await (supabase as any)
        .from('enrollment_services')
        .select('service_id, services ( name ), enrollments!inner ( status, beneficiary_id )')
        .eq('enrollments.beneficiary_id', beneficiary.id)
        .eq('enrollments.status', 'active')
        .eq('status', 'active');
      const activeServiceIds = new Set((activeRows ?? []).map((r: any) => r.service_id));
      const duplicates = enrollmentServices
        .filter(s => activeServiceIds.has(s.service_id))
        .map(s => s.service_name);
      if (duplicates.length > 0) {
        const proceed = window.confirm(
          `${beneficiary.first_name || 'Este beneficiario'} ya tiene una inscripción ACTIVA con: ${[...new Set(duplicates)].join(', ')}.\n\n` +
          `Si continúas, quedarán dos inscripciones activas del mismo servicio (por ejemplo, con horarios distintos). ¿Deseas continuar de todas formas?`
        );
        if (!proceed) return;
      }
    }

    setLoading(true);

    try {
      // 1. Create or find beneficiary
      let benId = beneficiary.id;
      if (!benId) {
        const { data: newBen, error: benErr } = await supabase
          .from('beneficiaries')
          .insert({
            organization_id: currentOrg.id,
            first_name: beneficiary.first_name.trim(),
            last_name: beneficiary.last_name.trim(),
            birth_date: beneficiary.birth_date || null,
            consultation_reason: beneficiary.consultation_reason || null,
            photo_consent: beneficiary.photo_consent,
            is_active: true,
          })
          .select('id')
          .single();
        if (benErr) throw benErr;
        benId = newBen.id;
      }

      // 2. Create or find representative
      let repId = representative.id;
      if (!repId) {
        const { data: newRep, error: repErr } = await supabase
          .from('representatives')
          .insert({
            organization_id: currentOrg.id,
            identification: representative.cedula.trim() || null,
            first_name: representative.first_name.trim(),
            last_name: representative.last_name.trim(),
            email: representative.email.trim() || null,
            phone: representative.phone.trim() || null,
            relationship: representative.relationship || 'Madre',
            is_active: true,
          })
          .select('id')
          .single();
        if (repErr) throw repErr;
        repId = newRep.id;
      }

      // 3. Link Beneficiary ↔ Representative (if not already linked)
      if (benId && repId) {
        const { data: existingLink } = await supabase
          .from('beneficiary_representatives')
          .select('beneficiary_id')
          .eq('beneficiary_id', benId)
          .eq('representative_id', repId)
          .maybeSingle();

        if (!existingLink) {
          await supabase.from('beneficiary_representatives').insert({
            beneficiary_id: benId,
            representative_id: repId,
            is_primary: true,
          });
        }
      }

      // end_date = the latest exact session date picked, for finite packages
      // only (mixing in a continuous/subscription service means no fixed end).
      let calculatedEndDate: string | null = null;
      const hasContinuous = enrollmentServices.some(s => s.billing_mode === 'continuous');
      if (!hasContinuous) {
        const allDates = enrollmentServices.flatMap(s => s.sessionDates.map(sd => sd.date));
        if (allDates.length > 0) {
          calculatedEndDate = allDates.reduce((max, d) => (d > max ? d : max), allDates[0]);
        }
      }

      // 4. Create Enrollment (inscripción formal)
      const { data: newEnrollment, error: enrollErr } = await (supabase as any)
        .from('enrollments')
        .insert({
          organization_id: currentOrg.id,
          beneficiary_id: benId,
          status: 'active',
          start_date: startDate,
          end_date: calculatedEndDate,
          notes: chargeNotes || null,
        })
        .select('id')
        .single();
      if (enrollErr) throw enrollErr;
      const enrollmentId = newEnrollment.id;

      // 5. Create Enrollment Services + one attendance row per exact date
      // picked by hand — no day-of-week recurrence is computed. A lightweight
      // enrollment_schedules row per distinct (weekday, time) is still kept
      // so the "horario" summary shown elsewhere (ej. detalle del
      // beneficiario) has something to display, but it is a derived label,
      // never the source used to generate sessions.
      if (enrollmentServices.length > 0) {
        for (const svc of enrollmentServices) {
          const serviceRow = {
            enrollment_id: enrollmentId,
            service_id: svc.service_id,
            sessions_per_week: distinctWeekdayCount(svc.sessionDates), // informational only
            session_duration_min: svc.session_duration_min,
            unit_price: svc.unit_price,
            total_sessions: svc.billing_mode === 'finite' ? svc.sessionDates.length || null : null,
            status: 'active',
          };
          const { data: newSvc, error: svcErr } = await (supabase as any)
            .from('enrollment_services')
            .insert(serviceRow)
            .select('id')
            .single();
          if (svcErr) throw svcErr;

          if (svc.sessionDates.length === 0) continue;

          const endTimeFor = (time: string) => {
            const [h, m] = time.split(':').map(Number);
            const endMin = h * 60 + m + svc.session_duration_min;
            const endH = Math.floor(endMin / 60) % 24;
            const endM = endMin % 60;
            return `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}:00`;
          };

          // One enrollment_schedules bucket per distinct (day_of_week, time)
          // among the exact dates chosen — display summary only.
          const scheduleByKey = new Map<string, { id: string }>();
          for (const sd of svc.sessionDates) {
            const dow = getDayOfWeekLocal(sd.date);
            const key = `${dow}-${sd.time}`;
            if (scheduleByKey.has(key)) continue;
            const { data: newSchedule, error: schErr } = await (supabase as any)
              .from('enrollment_schedules')
              .insert({
                organization_id: currentOrg!.id,
                enrollment_service_id: newSvc.id,
                day_of_week: dow,
                start_time: sd.time + ':00',
                end_time: endTimeFor(sd.time),
                is_active: true,
              })
              .select('id')
              .single();
            if (schErr) throw schErr;
            scheduleByKey.set(key, newSchedule);
          }

          const attendanceRows = svc.sessionDates.map(sd => ({
            organization_id: currentOrg!.id,
            beneficiary_id: benId,
            session_date: sd.date,
            status: 'scheduled',
            service_id: svc.service_id,
            enrollment_schedule_id: scheduleByKey.get(`${getDayOfWeekLocal(sd.date)}-${sd.time}`)?.id ?? null,
            scheduled_time: sd.time + ':00',
          }));

          const { error: attErr } = await (supabase as any).from('attendance').insert(attendanceRows);
          if (attErr) throw attErr;
        }
      }

      // 6. Create Initial Charge (single charge = sum of all services)
      const chargeDesc = enrollmentServices.length > 0
        ? `Matrícula: ${enrollmentServices.map(s => s.service_name).join(', ')}`
        : 'Matrícula Inicial';

      const chargeStatus = previousDeposit >= totalAmount ? 'paid'
        : previousDeposit > 0 ? 'partial'
        : 'pending';

      const { data: newCharge, error: chargeErr } = await (supabase as any)
        .from('charges')
        .insert({
          organization_id: currentOrg.id,
          beneficiary_id: benId,
          enrollment_id: enrollmentId,
          description: chargeDesc,
          amount: totalAmount,
          due_date: dueDate,
          status: chargeStatus,
          period_label: 'Matrícula Inicial',
          notes: chargeNotes || null,
        })
        .select('id')
        .single();
      if (chargeErr) throw chargeErr;

      // 7. Credit previous deposit if applicable
      if (newCharge && previousDeposit > 0) {
        await supabase.from('internal_payments').insert({
          organization_id: currentOrg.id,
          charge_id: newCharge.id,
          amount: Math.min(previousDeposit, totalAmount),
          payment_date: new Date().toISOString().split('T')[0],
          method: 'other',
          reference: 'Abono Acreditado de Cita/Evaluación Previa',
        });
      }

      // 7b. Register any additional payment collected at enrollment time,
      // on top of the deposit (e.g. 50% or full payment up front).
      if (newCharge && additionalPayment && Number(additionalPayment) > 0) {
        const alreadyCredited = Math.min(previousDeposit, totalAmount);
        const cappedExtra = Math.min(Number(additionalPayment), totalAmount - alreadyCredited);
        if (cappedExtra > 0) {
          await supabase.from('internal_payments').insert({
            organization_id: currentOrg.id,
            charge_id: newCharge.id,
            amount: cappedExtra,
            payment_date: additionalPaymentDate,
            method: additionalPaymentMethod,
            reference: 'Pago registrado al momento de la matrícula',
          });
        }
      }

      // 8. Create Commitment record (for Acta de Compromiso)
      await supabase.from('commitments').insert({
        organization_id: currentOrg.id,
        beneficiary_id: benId,
        representative_id: repId || null,
        session_duration_minutes: enrollmentServices[0]?.session_duration_min || 40,
        selected_therapies: enrollmentServices.reduce((acc, s) => ({ ...acc, [s.service_name]: true }), {}),
        payment_frequency: 'session',
        photo_consent: beneficiary.photo_consent,
        status: 'signed',
      });

      // 9. Close the loop with the appointment this matrícula came from, if any
      if (sourceAppointmentId) {
        await supabase
          .from('appointments')
          .update({ status: 'converted', converted_beneficiary_id: benId })
          .eq('id', sourceAppointmentId);
      }

      toast.success('¡Matrícula e inscripción completadas exitosamente!');

      // Go to step 4 (confirmation/acta)
      setCurrentStep(4);

    } catch (error: any) {
      console.error('Error en matrícula:', error);
      toast.error('Error al guardar: ' + (error.message || 'Error desconocido'));
    } finally {
      setLoading(false);
    }
  };

  // ─── Steps Definition ────────────────────────────────────────────────────────

  const steps = [
    { num: 1, title: 'Paciente', icon: Baby },
    { num: 2, title: 'Representante', icon: Users },
    { num: 3, title: 'Terapias', icon: GraduationCap },
    { num: 4, title: 'Confirmación', icon: FileText },
  ];

  const inputClass = 'w-full px-3 py-2.5 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white font-medium text-slate-800 placeholder-slate-400 transition';
  const labelClass = 'block text-xs font-bold text-slate-700 mb-1.5';

  return (
    <div className="max-w-3xl mx-auto py-6 space-y-6">
      {/* Page Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate(-1)}
          className="p-2 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-500 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900">Nueva Matrícula / Inscripción</h1>
          <p className="text-sm text-slate-500 mt-0.5">Registra formalmente al paciente con sus terapias, tutor y cobro inicial.</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        {/* Stepper */}
        <div className="px-6 pt-6 pb-4 bg-gradient-to-r from-indigo-50 to-white border-b border-slate-100">
          <div className="flex items-center relative">
            <div className="absolute left-0 right-0 top-5 h-0.5 bg-slate-200 z-0" />
            <div
              className="absolute left-0 top-5 h-0.5 bg-indigo-500 z-0 transition-all duration-500"
              style={{ width: `${((currentStep - 1) / (steps.length - 1)) * 100}%` }}
            />
            {steps.map((step) => {
              const isCompleted = currentStep > step.num;
              const isCurrent = currentStep === step.num;
              const Icon = step.icon;
              return (
                <div key={step.num} className="flex flex-col items-center gap-1.5 flex-1 relative z-10">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm transition-all duration-300 ${
                    isCompleted ? 'bg-emerald-500 text-white shadow-md scale-105'
                    : isCurrent ? 'bg-indigo-600 text-white shadow-lg ring-4 ring-indigo-100 scale-110'
                    : 'bg-white text-slate-400 border-2 border-slate-200'
                  }`}>
                    {isCompleted ? <CheckCircle className="w-5 h-5" /> : <Icon className="w-5 h-5" />}
                  </div>
                  <span className={`text-[11px] font-bold tracking-wide ${isCurrent ? 'text-indigo-700' : isCompleted ? 'text-emerald-600' : 'text-slate-400'}`}>
                    {step.title}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Form Content */}
        <div className="p-6 min-h-[380px]">
          
          {/* ─── STEP 1: Beneficiary ─────────────────────────────────────────── */}
          {currentStep === 1 && (
            <div className="space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Baby className="w-5 h-5 text-indigo-500" />
                  Datos del Paciente / Niño
                </h2>
                <div className="flex bg-slate-100 p-1 rounded-xl w-full sm:w-auto">
                  <button
                    onClick={() => { setBenMode('search'); }}
                    className={`flex-1 sm:flex-none px-4 py-1.5 text-xs font-bold rounded-lg transition-colors ${benMode === 'search' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                  >
                    Buscar Existente
                  </button>
                  <button
                    onClick={() => { 
                      setBenMode('create'); 
                      setBeneficiary({ first_name: '', last_name: '', birth_date: '', consultation_reason: '', photo_consent: true }); 
                    }}
                    className={`flex-1 sm:flex-none px-4 py-1.5 text-xs font-bold rounded-lg transition-colors ${benMode === 'create' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                  >
                    Crear Nuevo
                  </button>
                </div>
              </div>

              {benMode === 'search' ? (
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-5">
                  <label className="block text-sm font-bold text-slate-700 mb-3">Buscar paciente en la base de datos</label>
                  <EntityAutocomplete<any>
                    placeholder="Escribe el nombre del paciente..."
                    fetchResults={fetchBeneficiaries}
                    selectedItem={beneficiary.id ? beneficiary : null}
                    onSelect={(item) => {
                      if (item) {
                        setBeneficiary({
                          id: item.id,
                          first_name: item.first_name,
                          last_name: item.last_name,
                          birth_date: item.birth_date || '',
                          consultation_reason: item.consultation_reason || '',
                          photo_consent: item.photo_consent ?? true,
                        });
                        // Precarga el representante ya vinculado a este beneficiario
                        // en el Paso 2 — el usuario sigue libre de buscar otro o
                        // crear uno nuevo, esto solo evita repetir la búsqueda.
                        void prefillRepresentativeFor(item.id);
                      } else {
                        setBeneficiary({ first_name: '', last_name: '', birth_date: '', consultation_reason: '', photo_consent: true });
                        setRepresentative({ cedula: '', first_name: '', last_name: '', email: '', phone: '', relationship: 'Madre' });
                      }
                    }}
                    renderItem={(b) => (
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-xs shrink-0">
                          {b.first_name[0]}{b.last_name[0]}
                        </div>
                        <div>
                          <p className="font-bold text-slate-900">{b.first_name} {b.last_name}</p>
                          {b.birth_date && <p className="text-[11px] text-slate-500">Nacimiento: {formatDate(b.birth_date)}</p>}
                        </div>
                      </div>
                    )}
                    renderSelected={(b) => <p>{b.first_name} {b.last_name}</p>}
                  />
                </div>
              ) : (
                <div className="animate-fadeIn">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>Nombres <span className="text-red-500">*</span></label>
                  <input type="text" className={inputClass} placeholder="Ej. Thiago" value={beneficiary.first_name}
                    onChange={(e) => setBeneficiary({ ...beneficiary, first_name: e.target.value })} />
                </div>
                <div>
                  <label className={labelClass}>Apellidos <span className="text-red-500">*</span></label>
                  <input type="text" className={inputClass} placeholder="Ej. Bermeo Pando" value={beneficiary.last_name}
                    onChange={(e) => setBeneficiary({ ...beneficiary, last_name: e.target.value })} />
                </div>
                <div>
                  <label className={labelClass}>Fecha de Nacimiento</label>
                  <input type="date" className={inputClass} max={new Date().toISOString().split('T')[0]}
                    value={beneficiary.birth_date}
                    onChange={(e) => setBeneficiary({ ...beneficiary, birth_date: e.target.value })} />
                </div>
                <div>
                  <label className={labelClass}>Motivo / Diagnóstico de Consulta</label>
                  <input type="text" className={inputClass} placeholder="Ej. Dificultad de lenguaje"
                    value={beneficiary.consultation_reason}
                    onChange={(e) => setBeneficiary({ ...beneficiary, consultation_reason: e.target.value })} />
                </div>
              </div>

              <div className="bg-slate-50 rounded-xl border border-slate-200 px-4 py-3 flex items-center justify-between">
                <div>
                  <p className="text-sm font-bold text-slate-800">Autorización de Fotografías</p>
                  <p className="text-xs text-slate-500">¿El representante autoriza fotos pedagógicas/publicidad?</p>
                </div>
                <button
                  type="button"
                  onClick={() => setBeneficiary(prev => ({ ...prev, photo_consent: !prev.photo_consent }))}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${beneficiary.photo_consent ? 'bg-emerald-500' : 'bg-slate-300'}`}
                >
                  <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${beneficiary.photo_consent ? 'translate-x-6' : 'translate-x-1'}`} />
                </button>
              </div>
                </div>
              )}
            </div>
          )}

          {/* ─── STEP 2: Representative ──────────────────────────────────────── */}
          {currentStep === 2 && (
            <div className="space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Users className="w-5 h-5 text-indigo-500" />
                  Representante / Tutor Legal
                </h2>
                <div className="flex bg-slate-100 p-1 rounded-xl w-full sm:w-auto">
                  <button
                    onClick={() => { setRepMode('search'); }}
                    className={`flex-1 sm:flex-none px-4 py-1.5 text-xs font-bold rounded-lg transition-colors ${repMode === 'search' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                  >
                    Buscar Existente
                  </button>
                  <button
                    onClick={() => { 
                      setRepMode('create'); 
                      setRepresentative({ cedula: '', first_name: '', last_name: '', email: '', phone: '', relationship: 'Madre' }); 
                    }}
                    className={`flex-1 sm:flex-none px-4 py-1.5 text-xs font-bold rounded-lg transition-colors ${repMode === 'create' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                  >
                    Crear Nuevo
                  </button>
                </div>
              </div>

              {repMode === 'search' ? (
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-5">
                  <label className="block text-sm font-bold text-slate-700 mb-3">Buscar tutor en la base de datos</label>
                  <EntityAutocomplete<any>
                    placeholder="Busca por cédula o nombre..."
                    fetchResults={fetchRepresentatives}
                    selectedItem={representative.id ? representative : null}
                    onSelect={(item) => {
                      if (item) {
                        setRepresentative({
                          id: item.id,
                          cedula: item.identification || '',
                          first_name: item.first_name,
                          last_name: item.last_name,
                          email: item.email || '',
                          phone: item.phone || '',
                          relationship: item.relationship || 'Madre',
                        });
                      } else {
                        setRepresentative({ cedula: '', first_name: '', last_name: '', email: '', phone: '', relationship: 'Madre' });
                      }
                    }}
                    renderItem={(r) => (
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-xs shrink-0">
                          {r.first_name[0]}{r.last_name[0]}
                        </div>
                        <div>
                          <p className="font-bold text-slate-900">{r.first_name} {r.last_name}</p>
                          {r.identification && <p className="text-[11px] text-slate-500 font-mono">CI: {r.identification}</p>}
                        </div>
                      </div>
                    )}
                    renderSelected={(r) => <p>{r.first_name} {r.last_name} {r.cedula ? `(CI: ${r.cedula})` : ''}</p>}
                  />
                </div>
              ) : (
                <div className="animate-fadeIn">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>Nombres <span className="text-red-500">*</span></label>
                  <input type="text" className={inputClass} placeholder="Ej. Lincy Belén"
                    value={representative.first_name}
                    onChange={(e) => setRepresentative({ ...representative, first_name: e.target.value })} />
                </div>
                <div>
                  <label className={labelClass}>Apellidos <span className="text-red-500">*</span></label>
                  <input type="text" className={inputClass} placeholder="Ej. Pando Ortiz"
                    value={representative.last_name}
                    onChange={(e) => setRepresentative({ ...representative, last_name: e.target.value })} />
                </div>
                <div>
                  <label className={labelClass}>Cédula de Identidad (10 dígitos)</label>
                  <input type="text" maxLength={10} className={`${inputClass} font-mono`}
                    placeholder="Ej. 0955443882"
                    value={representative.cedula}
                    onChange={(e) => setRepresentative({ ...representative, cedula: e.target.value.replace(/\D/g, '') })} />
                </div>
                <div>
                  <label className={labelClass}>Teléfono WhatsApp (10 dígitos)</label>
                  <input type="text" maxLength={10} className={`${inputClass} font-mono`}
                    placeholder="Ej. 0955443882"
                    value={representative.phone}
                    onChange={(e) => setRepresentative({ ...representative, phone: e.target.value.replace(/\D/g, '') })} />
                </div>
                <div>
                  <label className={labelClass}>Correo Electrónico</label>
                  <input type="email" className={inputClass} placeholder="tutor@gmail.com"
                    value={representative.email}
                    onChange={(e) => setRepresentative({ ...representative, email: e.target.value })} />
                </div>
                <div>
                  <label className={labelClass}>Parentesco / Relación</label>
                  <select className={inputClass} value={representative.relationship}
                    onChange={(e) => setRepresentative({ ...representative, relationship: e.target.value })}>
                    <option value="Madre">Madre</option>
                    <option value="Padre">Padre</option>
                    <option value="Tutor Legal">Tutor Legal</option>
                    <option value="Abuelo/a">Abuelo/a</option>
                    <option value="Otro">Otro</option>
                  </select>
                </div>
                </div>
                </div>
              )}
            </div>
          )}

          {/* ─── STEP 3: Services / Therapies ──────────────────────────────── */}
          {currentStep === 3 && (
            <div className="space-y-5">
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <GraduationCap className="w-5 h-5 text-indigo-500" />
                Terapias / Servicios de la Inscripción
              </h2>

              {/* Add service line */}
              <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-3.5 space-y-2.5">
                <p className="text-xs font-bold text-indigo-800">Agregar Terapia / Servicio</p>
                <div className="flex flex-col sm:flex-row gap-2">
                  {services.length === 0 && !showQuickService ? (
                    <div className="flex-1 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-2.5">
                      ⚠️ No hay servicios configurados todavía. Usa "Crear servicio rápido" abajo.
                    </div>
                  ) : !showQuickService && (
                    <>
                      <select
                        value={addingServiceId}
                        onChange={(e) => setAddingServiceId(e.target.value)}
                        className="flex-1 min-w-0 px-3 py-2 text-sm border border-indigo-300 rounded-lg focus:ring-2 focus:ring-indigo-500 bg-white"
                      >
                        <option value="">-- Seleccionar servicio del catálogo --</option>
                        {services.map(s => (
                          <option key={s.id} value={s.id}>{s.name} — ${s.price.toFixed(2)}/sesión</option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={addServiceLine}
                        disabled={!addingServiceId}
                        className="w-full sm:w-auto px-4 py-2 text-xs font-bold bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-40 transition flex items-center justify-center gap-1"
                      >
                        <Plus className="w-4 h-4" />
                        Agregar
                      </button>
                    </>
                  )}
                </div>

                {showQuickService ? (
                  <div className="bg-white border border-indigo-200 rounded-lg p-3 space-y-2">
                    <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Nuevo servicio en el catálogo</p>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="Ej. Terapia de Lenguaje"
                        value={quickServiceName}
                        onChange={(e) => setQuickServiceName(e.target.value)}
                        className="flex-1 px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                      />
                      <div className="relative w-28">
                        <span className="absolute left-2.5 top-2 text-xs text-slate-400 font-bold">$</span>
                        <input
                          type="number" step="0.01" min="0"
                          placeholder="0.00"
                          value={quickServicePrice}
                          onChange={(e) => setQuickServicePrice(e.target.value === '' ? '' : Number(e.target.value))}
                          className="w-full pl-5 pr-2 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 font-mono"
                        />
                      </div>
                    </div>
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => { setShowQuickService(false); setQuickServiceName(''); setQuickServicePrice(''); }}
                        className="px-3 py-1.5 text-xs font-semibold text-slate-500 hover:text-slate-700"
                      >
                        Cancelar
                      </button>
                      <button
                        type="button"
                        onClick={handleCreateQuickService}
                        disabled={creatingQuickService}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50"
                      >
                        {creatingQuickService && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                        {creatingQuickService ? 'Creando...' : 'Crear y usar'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setShowQuickService(true)}
                    className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Crear servicio rápido (si no está en el catálogo)
                  </button>
                )}
              </div>

              {/* Services Table */}
              {enrollmentServices.length > 0 && (
                <div className="overflow-x-auto rounded-xl border border-slate-200">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 text-[11px] font-bold uppercase text-slate-500 tracking-wider">
                      <tr>
                        <th className="px-4 py-2.5 text-left">Terapia / Servicio</th>
                        <th className="px-4 py-2.5 text-center">Min. por Sesión</th>
                        <th className="px-4 py-2.5 text-center">Precio/Sesión</th>
                        <th className="px-4 py-2.5 text-center">Subtotal</th>
                        <th className="px-4 py-2.5 text-center"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {enrollmentServices.map((svc) => (
                        <tr key={svc.service_id} className="align-top border-b border-slate-100">
                          <td colSpan={6} className="px-0 py-0">
                            <div className="px-4 pt-3 pb-2 bg-white">
                              <div className="flex items-center gap-3 flex-wrap">
                                <span className="font-bold text-slate-900 text-sm flex-1 min-w-[120px]">
                                  {svc.service_name}
                                </span>
                                <div className="flex items-center gap-2 flex-wrap">
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-[11px] font-bold text-slate-500 uppercase">Duración</span>
                                    <select
                                      className="border border-slate-300 rounded-lg px-2 py-1 text-sm focus:ring-2 focus:ring-indigo-500"
                                      value={svc.session_duration_min}
                                      onChange={(e) => updateServiceLine(svc.service_id, 'session_duration_min', Number(e.target.value))}
                                    >
                                      <option value={30}>30 min</option>
                                      <option value={40}>40 min</option>
                                      <option value={45}>45 min</option>
                                      <option value={60}>60 min</option>
                                      <option value={90}>90 min</option>
                                    </select>
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <span className="text-[11px] font-bold text-slate-500 uppercase">Precio/ses.</span>
                                    <span className="text-slate-400 text-xs font-bold">$</span>
                                    <input
                                      type="number" min={0} step={0.01}
                                      className="w-20 text-center border border-slate-300 rounded-lg px-2 py-1 text-sm focus:ring-2 focus:ring-indigo-500 font-mono"
                                      value={svc.unit_price}
                                      onChange={(e) => updateServiceLine(svc.service_id, 'unit_price', Number(e.target.value))}
                                    />
                                  </div>
                                  <span className="font-extrabold text-indigo-800 font-mono text-sm min-w-[90px] text-right">
                                    = ${(svc.unit_price * svc.sessionDates.length).toFixed(2)} ({svc.sessionDates.length} ses.)
                                  </span>
                                  <button
                                    onClick={() => removeServiceLine(svc.service_id)}
                                    className="text-red-400 hover:text-red-600 p-1 rounded hover:bg-red-50 transition"
                                    title="Quitar servicio"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </div>
                              </div>

                              {/* Modalidad: Continua vs Paquete */}
                              <div className="mt-2 ml-2 mr-4 bg-slate-50 p-2 rounded border border-slate-200 flex flex-wrap items-center gap-4">
                                <div className="flex items-center gap-2">
                                  <span className="text-[11px] font-bold text-slate-500 uppercase">Modalidad:</span>
                                  <select
                                    className="border border-slate-300 rounded-lg px-2 py-1 text-sm focus:ring-2 focus:ring-indigo-500 bg-white"
                                    value={svc.billing_mode}
                                    onChange={(e) => updateServiceLine(svc.service_id, 'billing_mode', e.target.value)}
                                  >
                                    <option value="continuous">Suscripción (Continua)</option>
                                    <option value="finite">Paquete (Finito)</option>
                                  </select>
                                </div>
                                {svc.billing_mode === 'finite' && (
                                  <div className="flex items-center gap-2">
                                    <span className="text-[11px] font-bold text-slate-500 uppercase">Total sesiones:</span>
                                    <span className="text-sm font-mono font-bold text-slate-800">{svc.sessionDates.length}</span>
                                    <span className="text-[10px] text-slate-400">(según fechas agregadas abajo)</span>
                                  </div>
                                )}
                              </div>

                              {/* Servicio Mensual: relleno automático de un mes de fechas, solo para modo Continua */}
                              {svc.billing_mode === 'continuous' && (
                                <div className="mt-2 ml-2 mr-4 bg-indigo-50/60 border border-indigo-200 rounded-lg p-3 space-y-2.5">
                                  <p className="text-[11px] font-bold text-indigo-800 uppercase tracking-wider">
                                    Servicio Mensual — relleno automático
                                  </p>
                                  <div className="flex flex-wrap items-center gap-1.5">
                                    {WEEKDAY_TOGGLES.map(({ day, label }) => {
                                      const active = getMonthlyDraft(svc.service_id).days.includes(day);
                                      return (
                                        <button
                                          key={day}
                                          type="button"
                                          onClick={() => toggleMonthlyDay(svc.service_id, day)}
                                          className={`w-9 h-8 rounded-lg text-xs font-bold border transition-colors ${
                                            active ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-500 border-slate-300 hover:border-indigo-300'
                                          }`}
                                        >
                                          {label}
                                        </button>
                                      );
                                    })}
                                  </div>
                                  <div className="flex flex-wrap items-end gap-2">
                                    <div>
                                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-0.5">Hora Inicio</label>
                                      <input
                                        type="time"
                                        value={getMonthlyDraft(svc.service_id).startTime}
                                        onChange={(e) => updateMonthlyTime(svc.service_id, 'startTime', e.target.value)}
                                        className="text-xs border border-slate-300 rounded-lg px-2 py-1.5 bg-white focus:ring-2 focus:ring-indigo-400 font-mono"
                                      />
                                    </div>
                                    <div>
                                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-0.5">Hora Fin</label>
                                      <input
                                        type="time"
                                        value={getMonthlyDraft(svc.service_id).endTime}
                                        onChange={(e) => updateMonthlyTime(svc.service_id, 'endTime', e.target.value)}
                                        className="text-xs border border-slate-300 rounded-lg px-2 py-1.5 bg-white focus:ring-2 focus:ring-indigo-400 font-mono"
                                      />
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() => handleGenerateMonthlyDates(svc.service_id)}
                                      className="px-3 py-1.5 text-xs font-bold bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition flex items-center gap-1"
                                    >
                                      <Plus className="w-3.5 h-3.5" />
                                      Generar Fechas del Mes
                                    </button>
                                  </div>
                                  <p className="text-[10px] text-indigo-700/70">
                                    Genera las fechas desde la Fecha de Inicio de Clases hasta un mes después, en los días marcados. Puedes revisar y ajustar la lista de abajo después de generar.
                                  </p>
                                </div>
                              )}

                              {/* Exact session dates — picked one by one, no weekday recurrence */}
                              <div className="mt-2.5 ml-2 space-y-1.5">
                                <p className="text-[11px] font-bold text-indigo-700 uppercase tracking-wider flex items-center gap-1">
                                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                  </svg>
                                  Fechas exactas de sesión
                                </p>

                                {svc.sessionDates.length === 0 && (
                                  <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-1.5">
                                    Todavía no agregaste ninguna fecha. Sin fechas, no se generará asistencia para esta terapia.
                                  </p>
                                )}

                                {svc.sessionDates.map((sd, idx) => (
                                  <div key={`${sd.date}-${sd.time}`} className="flex items-center gap-2 bg-indigo-50/70 border border-indigo-100 rounded-lg px-3 py-1.5">
                                    <span className="text-[11px] font-bold text-indigo-700 min-w-[90px]">
                                      {weekdayLabel(sd.date)}
                                    </span>
                                    <span className="text-xs font-mono font-semibold text-slate-800">{formatDate(sd.date)}</span>
                                    <span className="text-[11px] text-slate-500">a las</span>
                                    <span className="text-xs font-mono font-semibold text-slate-800">{sd.time}</span>
                                    <button
                                      type="button"
                                      onClick={() => addWeekAfter(svc.service_id, sd.date, sd.time)}
                                      className="ml-auto text-[10px] font-bold text-indigo-600 hover:text-indigo-800 bg-white border border-indigo-200 rounded px-2 py-0.5"
                                      title="Agregar otra fecha, 7 días después, misma hora"
                                    >
                                      +7 días
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => removeSessionDate(svc.service_id, idx)}
                                      className="text-red-400 hover:text-red-600 p-1 rounded hover:bg-red-50"
                                      title="Quitar esta fecha"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                ))}

                                <div className="flex items-center gap-2 pt-1">
                                  <input
                                    type="date"
                                    value={dateDraft[svc.service_id]?.date || ''}
                                    onChange={(e) => setDateDraft(prev => ({ ...prev, [svc.service_id]: { date: e.target.value, time: prev[svc.service_id]?.time || '09:00' } }))}
                                    className="text-xs border border-slate-300 rounded-lg px-2 py-1.5 bg-white focus:ring-2 focus:ring-indigo-400"
                                  />
                                  <input
                                    type="time"
                                    value={dateDraft[svc.service_id]?.time || '09:00'}
                                    onChange={(e) => setDateDraft(prev => ({ ...prev, [svc.service_id]: { date: prev[svc.service_id]?.date || '', time: e.target.value } }))}
                                    className="text-xs border border-slate-300 rounded-lg px-2 py-1.5 bg-white focus:ring-2 focus:ring-indigo-400 font-mono"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const draft = dateDraft[svc.service_id];
                                      if (draft?.date) addSessionDate(svc.service_id, draft.date, draft.time || '09:00');
                                    }}
                                    className="px-3 py-1.5 text-xs font-bold bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition flex items-center gap-1"
                                  >
                                    <Plus className="w-3.5 h-3.5" />
                                    Agregar Fecha
                                  </button>
                                </div>
                              </div>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-indigo-50">
                      <tr>
                        <td colSpan={3} className="px-4 py-3 text-right font-bold text-slate-700 text-sm">Total de la Matrícula:</td>
                        <td className="px-4 py-3 text-center font-extrabold text-indigo-800 text-base font-mono">
                          ${totalAmount.toFixed(2)}
                        </td>
                        <td />
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}

              {/* Charge/payment & Dates config */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                <div>
                  <label className={labelClass}>Fecha de Inicio de Clases</label>
                  <input type="date" className={inputClass} value={startDate}
                    onChange={(e) => setStartDate(e.target.value)} />
                </div>
                <div>
                  <label className={labelClass}>Fecha del Primer Pago</label>
                  <input type="date" className={inputClass} value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)} />
                </div>
                <div className="sm:col-span-2">
                  <label className={labelClass}>Notas del Cobro</label>
                  <input type="text" className={inputClass} placeholder="Ej. Descuento especial, etc."
                    value={chargeNotes} onChange={(e) => setChargeNotes(e.target.value)} />
                </div>
              </div>

              {previousDeposit > 0 && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 flex items-center gap-3">
                  <CheckCircle className="w-5 h-5 text-emerald-600 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-bold text-emerald-800">Abono de Cita Previa: ${previousDeposit.toFixed(2)}</p>
                    <p className="text-xs text-emerald-600">Este monto será descontado automáticamente del cobro total.</p>
                  </div>
                </div>
              )}

              {/* Optional payment collected right now — wording depends on
                  whether there's already a deposit credited (from a cita
                  previa) or this is a brand-new enrollment with nothing paid yet */}
              <div className="border border-slate-200 rounded-xl p-4 bg-slate-50 space-y-3">
                <div>
                  <p className="text-sm font-bold text-slate-800">
                    {previousDeposit > 0 ? '¿Va a pagar algo más ahora? (opcional)' : 'Registrar Pago (opcional)'}
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {previousDeposit > 0
                      ? 'Si el representante ya va a abonar el 50%, el total, o cualquier otro monto además del depósito de la cita previa, regístralo aquí.'
                      : 'Si el representante va a pagar ahora mismo (50%, el total, o cualquier abono), regístralo aquí.'}
                  </p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className={labelClass}>Monto (USD)</label>
                    <input
                      type="number" step="0.01" min="0"
                      max={Math.max(0, totalAmount - previousDeposit)}
                      className={inputClass}
                      placeholder="0.00"
                      value={additionalPayment}
                      onChange={(e) => setAdditionalPayment(e.target.value === '' ? '' : Number(e.target.value))}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Método de Pago</label>
                    <select className={inputClass} value={additionalPaymentMethod} onChange={(e) => setAdditionalPaymentMethod(e.target.value)}>
                      <option value="cash">Efectivo</option>
                      <option value="transfer">Transferencia</option>
                      <option value="card">Tarjeta</option>
                      <option value="other">Otro</option>
                    </select>
                  </div>
                  <div>
                    <label className={labelClass}>Fecha del Pago</label>
                    <input
                      type="date"
                      className={inputClass}
                      value={additionalPaymentDate}
                      max={new Date().toISOString().split('T')[0]}
                      onChange={(e) => setAdditionalPaymentDate(e.target.value)}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ─── STEP 4: Confirmation ──────────────────────────────────────── */}
          {currentStep === 4 && (
            <div className="space-y-6 text-center py-6">
              <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto">
                <CheckCircle className="w-10 h-10 text-emerald-600" />
              </div>
              <div>
                <h2 className="text-xl font-extrabold text-slate-900">¡Matrícula Completada!</h2>
                <p className="text-slate-500 text-sm mt-2">
                  <strong>{beneficiary.first_name} {beneficiary.last_name}</strong> ha sido inscrito con {enrollmentServices.length} servicio(s).
                </p>
              </div>

              <div className="bg-slate-50 rounded-2xl border border-slate-200 p-4 text-left space-y-2 max-w-sm mx-auto">
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Resumen</p>
                {enrollmentServices.map(s => (
                  <div key={s.service_id} className="flex justify-between text-sm">
                    <span className="text-slate-700">{s.service_name} ({s.sessionDates.length} ses.)</span>
                    <span className="font-bold text-slate-900 font-mono">${(s.unit_price * s.sessionDates.length).toFixed(2)}</span>
                  </div>
                ))}
                <div className="border-t border-slate-200 pt-2 flex justify-between font-bold">
                  <span className="text-slate-700">Total Semanal</span>
                  <span className="text-indigo-700 font-mono">${totalAmount.toFixed(2)}</span>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <button
                  onClick={() => setIsPreviewModalOpen(true)}
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm rounded-xl transition shadow-md"
                >
                  <FileText className="w-4 h-4" />
                  Ver Acta de Compromiso
                </button>
                <button
                  onClick={() => navigate('/app/beneficiarios')}
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-sm rounded-xl transition"
                >
                  Ver Beneficiarios
                </button>
                <button
                  onClick={() => navigate('/app')}
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 font-bold text-sm rounded-xl transition"
                >
                  Ir al Dashboard
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Navigation Footer */}
        {currentStep < 4 && (
          <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
            <button
              onClick={handleBack}
              disabled={currentStep === 1}
              className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-bold text-slate-600 hover:text-slate-900 hover:bg-slate-200 rounded-xl transition disabled:opacity-40"
            >
              <ArrowLeft className="w-4 h-4" />
              Anterior
            </button>

            <span className="text-xs font-semibold text-slate-400">
              Paso {currentStep} de {steps.length}
            </span>

            {currentStep < 3 ? (
              <button
                onClick={handleNext}
                className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl transition shadow-md"
              >
                Siguiente
                <ArrowRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                onClick={handleSubmit}
                disabled={loading || enrollmentServices.length === 0}
                className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl transition shadow-md disabled:opacity-50"
              >
                {loading ? 'Guardando...' : 'Completar Matrícula'}
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              </button>
            )}
          </div>
        )}
      </div>

      {/* Acta Modal */}
      {isPreviewModalOpen && (
        <ActaCompromisoModal
          isOpen={isPreviewModalOpen}
          onClose={() => setIsPreviewModalOpen(false)}
          data={{
            representativeName: `${representative.first_name} ${representative.last_name}`,
            representativeId: representative.cedula || '—',
            representativeEmail: representative.email || '—',
            beneficiaryName: `${beneficiary.first_name} ${beneficiary.last_name}`,
            sessionDuration: enrollmentServices[0]?.session_duration_min || 40,
            photoConsent: beneficiary.photo_consent,
            therapies: enrollmentServices.reduce((acc, s) => ({ ...acc, [s.service_name]: true }), {}),
            paymentFrequency: 'session',
            orgName: currentOrg?.name,
            city: currentOrg?.city || 'La Troncal',
          }}
        />
      )}
    </div>
  );
}
