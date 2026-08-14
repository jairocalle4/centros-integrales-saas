import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router';
import { supabase } from '../../lib/supabase';
import { useOrg } from './OrgContext';
import {
  CheckCircle,
  Baby,
  Users,
  DollarSign,
  ArrowRight,
  ArrowLeft,
  Search,
  Save,
  Plus,
  Trash2,
  GraduationCap,
  FileText,
  UserPlus,
  Search as SearchIcon
} from 'lucide-react';
import toast from 'react-hot-toast';
import { ActaCompromisoModal } from './ActaCompromisoModal';
import { EntityAutocomplete } from '../../components/ui/EntityAutocomplete';

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
  day_of_week: number; // 0=Dom … 6=Sáb
  start_time: string;  // 'HH:MM'
};

type ServiceItem = {
  id: string;
  name: string;
  price: number;
};

type EnrollmentServiceLine = {
  service_id: string;
  service_name: string;
  sessions_per_week: number;
  session_duration_min: number;
  unit_price: number;
  schedules: ScheduleSlot[]; // one per sessions_per_week
  billing_mode: 'continuous' | 'finite';
  total_sessions: number | '';
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
  const [addingServiceId, setAddingServiceId] = useState('');
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);
  const [previousDeposit, setPreviousDeposit] = useState<number>(0);
  const [startDate, setStartDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [dueDate, setDueDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [chargeNotes, setChargeNotes] = useState('');
  const [createdEnrollmentId, setCreatedEnrollmentId] = useState<string | null>(null);

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

  // Total sum of all enrollment services
  const totalAmount = enrollmentServices.reduce(
    (sum, s) => sum + s.unit_price * s.sessions_per_week,
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

    let hasData = false;

    if (dep) setPreviousDeposit(Number(dep) || 0);

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
        sessions_per_week: 1,
        session_duration_min: 40,
        unit_price: svc.price,
        schedules: [{ day_of_week: 1, start_time: '09:00' }], // default: Lunes 9am
        billing_mode: 'continuous',
        total_sessions: '',
      }
    ]);
    setAddingServiceId('');
  };

  const removeServiceLine = (serviceId: string) => {
    setEnrollmentServices(prev => prev.filter(e => e.service_id !== serviceId));
  };

  const updateServiceLine = (serviceId: string, field: keyof Omit<EnrollmentServiceLine, 'schedules'>, value: number | string) => {
    setEnrollmentServices(prev =>
      prev.map(e => {
        if (e.service_id !== serviceId) return e;
        const updated = { ...e, [field]: value };
        // Sync schedules count to sessions_per_week
        if (field === 'sessions_per_week') {
          const newCount = Number(value);
          const currentSlots = [...e.schedules];
          if (newCount > currentSlots.length) {
            for (let i = currentSlots.length; i < newCount; i++) {
              currentSlots.push({ day_of_week: (currentSlots[i - 1]?.day_of_week ?? 1) % 6 + 1, start_time: '09:00' });
            }
          } else {
            currentSlots.splice(newCount);
          }
          updated.schedules = currentSlots;
        }
        return updated;
      })
    );
  };

  const updateScheduleSlot = (serviceId: string, slotIndex: number, field: keyof ScheduleSlot, value: number | string) => {
    setEnrollmentServices(prev =>
      prev.map(e => {
        if (e.service_id !== serviceId) return e;
        const newSchedules = e.schedules.map((s, i) =>
          i === slotIndex ? { ...s, [field]: field === 'day_of_week' ? Number(value) : value } : s
        );
        return { ...e, schedules: newSchedules };
      })
    );
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

      // Calculate end_date for finite packages
      let calculatedEndDate: string | null = null;
      const hasContinuous = enrollmentServices.some(s => s.billing_mode === 'continuous');
      if (!hasContinuous && enrollmentServices.length > 0) {
        let maxWeeks = 0;
        enrollmentServices.forEach(s => {
          const sessions = Number(s.total_sessions) || 0;
          const spw = Number(s.sessions_per_week) || 1;
          const weeks = Math.ceil(sessions / spw);
          if (weeks > maxWeeks) maxWeeks = weeks;
        });
        if (maxWeeks > 0) {
          const d = new Date(startDate);
          d.setDate(d.getDate() + (maxWeeks * 7));
          calculatedEndDate = d.toISOString().split('T')[0];
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
      setCreatedEnrollmentId(enrollmentId);

      // 5. Create Enrollment Services + their schedules
      if (enrollmentServices.length > 0) {
        for (const svc of enrollmentServices) {
          const serviceRow = {
            enrollment_id: enrollmentId,
            service_id: svc.service_id,
            sessions_per_week: svc.sessions_per_week,
            session_duration_min: svc.session_duration_min,
            unit_price: svc.unit_price,
            total_sessions: svc.billing_mode === 'finite' ? Number(svc.total_sessions) || null : null,
            status: 'active',
          };
          const { data: newSvc, error: svcErr } = await (supabase as any)
            .from('enrollment_services')
            .insert(serviceRow)
            .select('id')
            .single();
          if (svcErr) throw svcErr;

          // Save schedule slots for this service
          if (svc.schedules && svc.schedules.length > 0) {
            const scheduleRows = svc.schedules
              .filter(slot => slot.start_time)
              .map(slot => {
                const [h, m] = slot.start_time.split(':').map(Number);
                const endMin = h * 60 + m + svc.session_duration_min;
                const endH = Math.floor(endMin / 60) % 24;
                const endM = endMin % 60;
                const end_time = `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`;
                return {
                  organization_id: currentOrg!.id,
                  enrollment_service_id: newSvc.id,
                  day_of_week: slot.day_of_week,
                  start_time: slot.start_time + ':00',
                  end_time: end_time + ':00',
                  is_active: true,
                };
              });
            if (scheduleRows.length > 0) {
              const { data: insertedSchedules, error: schErr } = await (supabase as any)
                .from('enrollment_schedules')
                .insert(scheduleRows)
                .select();
              
              if (schErr) throw schErr;

              // Instantiate attendance sessions based on the schedules
              if (insertedSchedules && insertedSchedules.length > 0) {
                // Determine how many sessions to generate (finite = total_sessions, continuous = 24 default)
                const limit = svc.billing_mode === 'finite' && svc.total_sessions ? svc.total_sessions : 24;
                const attendanceRows = [];
                let generatedCount = 0;
                let currentLocal = new Date(startDate + 'T00:00:00'); // Use startDate at midnight local
                let sanityCheck = 0; // prevent infinite loops

                while (generatedCount < limit && sanityCheck < 365) {
                  const dow = currentLocal.getDay();
                  const matchingSchedule = (insertedSchedules as any[]).find(s => s.day_of_week === dow);
                  
                  if (matchingSchedule) {
                    attendanceRows.push({
                      organization_id: currentOrg!.id,
                      beneficiary_id: benId,
                      session_date: currentLocal.toISOString().split('T')[0],
                      status: 'scheduled',
                      service_id: svc.service_id,
                      enrollment_schedule_id: matchingSchedule.id,
                      scheduled_time: matchingSchedule.start_time
                    });
                    generatedCount++;
                  }
                  currentLocal.setDate(currentLocal.getDate() + 1);
                  sanityCheck++;
                }

                if (attendanceRows.length > 0) {
                  const { error: attErr } = await (supabase as any).from('attendance').insert(attendanceRows);
                  if (attErr) console.error('Error instantiating sessions:', attErr);
                }
              }
            }
          }
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
          onClick={() => navigate('/app')}
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
                      } else {
                        setBeneficiary({ first_name: '', last_name: '', birth_date: '', consultation_reason: '', photo_consent: true });
                      }
                    }}
                    renderItem={(b) => (
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-xs shrink-0">
                          {b.first_name[0]}{b.last_name[0]}
                        </div>
                        <div>
                          <p className="font-bold text-slate-900">{b.first_name} {b.last_name}</p>
                          {b.birth_date && <p className="text-[11px] text-slate-500">Nacimiento: {b.birth_date}</p>}
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
              <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-3.5">
                <p className="text-xs font-bold text-indigo-800 mb-2">Agregar Terapia / Servicio</p>
                <div className="flex gap-2">
                  {services.length === 0 ? (
                    <div className="flex-1 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-2.5">
                      ⚠️ No hay servicios configurados. Ve a <strong>Catálogo de Servicios</strong> para agregar terapias primero.
                    </div>
                  ) : (
                    <select
                      value={addingServiceId}
                      onChange={(e) => setAddingServiceId(e.target.value)}
                      className="flex-1 px-3 py-2 text-sm border border-indigo-300 rounded-lg focus:ring-2 focus:ring-indigo-500 bg-white"
                    >
                      <option value="">-- Seleccionar servicio del catálogo --</option>
                      {services.map(s => (
                        <option key={s.id} value={s.id}>{s.name} — ${s.price.toFixed(2)}/sesión</option>
                      ))}
                    </select>
                  )}
                  <button
                    type="button"
                    onClick={addServiceLine}
                    disabled={!addingServiceId}
                    className="px-4 py-2 text-xs font-bold bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-40 transition flex items-center gap-1"
                  >
                    <Plus className="w-4 h-4" />
                    Agregar
                  </button>
                </div>
              </div>

              {/* Services Table */}
              {enrollmentServices.length > 0 && (
                <div className="overflow-x-auto rounded-xl border border-slate-200">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 text-[11px] font-bold uppercase text-slate-500 tracking-wider">
                      <tr>
                        <th className="px-4 py-2.5 text-left">Terapia / Servicio</th>
                        <th className="px-4 py-2.5 text-center">Sesiones/Semana</th>
                        <th className="px-4 py-2.5 text-center">Min. por Sesión</th>
                        <th className="px-4 py-2.5 text-center">Precio/Sesión</th>
                        <th className="px-4 py-2.5 text-center">Subtotal/Semana</th>
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
                                    <span className="text-[11px] font-bold text-slate-500 uppercase">Sesiones/sem</span>
                                    <input
                                      type="number" min={1} max={7}
                                      className="w-14 text-center border border-slate-300 rounded-lg px-2 py-1 text-sm focus:ring-2 focus:ring-indigo-500"
                                      value={svc.sessions_per_week}
                                      onChange={(e) => updateServiceLine(svc.service_id, 'sessions_per_week', Number(e.target.value))}
                                    />
                                  </div>
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
                                  <span className="font-extrabold text-indigo-800 font-mono text-sm min-w-[70px] text-right">
                                    = ${(svc.unit_price * svc.sessions_per_week).toFixed(2)}/sem
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
                              <div className="mt-2 ml-2 mr-4 bg-slate-50 p-2 rounded border border-slate-200 flex items-center gap-4">
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
                                    <input
                                      type="number" min={1}
                                      placeholder="Ej: 4"
                                      className="w-16 border border-slate-300 rounded-lg px-2 py-1 text-sm focus:ring-2 focus:ring-indigo-500 bg-white"
                                      value={svc.total_sessions}
                                      onChange={(e) => updateServiceLine(svc.service_id, 'total_sessions', e.target.value)}
                                    />
                                  </div>
                                )}
                              </div>


                              {/* Schedule slots — one per sessions_per_week */}
                              <div className="mt-2.5 ml-2 space-y-1.5">
                                <p className="text-[11px] font-bold text-indigo-700 uppercase tracking-wider flex items-center gap-1">
                                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                  </svg>
                                  Horario semanal (opcional — puedes configurarlo después)
                                </p>
                                {svc.schedules.map((slot, idx) => (
                                  <div key={idx} className="flex items-center gap-2 bg-indigo-50/70 border border-indigo-100 rounded-lg px-3 py-1.5">
                                    <span className="text-[11px] font-bold text-indigo-600 w-16 shrink-0">
                                      Sesión {idx + 1}:
                                    </span>
                                    <select
                                      value={slot.day_of_week}
                                      onChange={(e) => updateScheduleSlot(svc.service_id, idx, 'day_of_week', Number(e.target.value))}
                                      className="text-xs border border-indigo-200 rounded-lg px-2 py-1 bg-white focus:ring-2 focus:ring-indigo-400 font-semibold text-slate-800"
                                    >
                                      {DAYS.map(d => (
                                        <option key={d.value} value={d.value}>{d.label}</option>
                                      ))}
                                    </select>
                                    <span className="text-[11px] text-slate-500 font-semibold">a las</span>
                                    <input
                                      type="time"
                                      value={slot.start_time}
                                      onChange={(e) => updateScheduleSlot(svc.service_id, idx, 'start_time', e.target.value)}
                                      className="text-xs border border-indigo-200 rounded-lg px-2 py-1 bg-white focus:ring-2 focus:ring-indigo-400 font-mono font-semibold text-slate-800"
                                    />
                                    <span className="text-[11px] text-slate-400 font-mono">
                                      → {(() => {
                                        const [h, m] = slot.start_time.split(':').map(Number);
                                        const totalMin = h * 60 + m + svc.session_duration_min;
                                        return `${String(Math.floor(totalMin / 60) % 24).padStart(2, '0')}:${String(totalMin % 60).padStart(2, '0')}`;
                                      })()}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-indigo-50">
                      <tr>
                        <td colSpan={4} className="px-4 py-3 text-right font-bold text-slate-700 text-sm">Total por Semana:</td>
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
                    <span className="text-slate-700">{s.service_name} ({s.sessions_per_week}x/sem)</span>
                    <span className="font-bold text-slate-900 font-mono">${(s.unit_price * s.sessions_per_week).toFixed(2)}/sem</span>
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
                <Save className="w-4 h-4" />
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
