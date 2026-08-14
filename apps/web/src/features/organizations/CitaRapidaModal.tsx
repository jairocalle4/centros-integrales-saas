import React, { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useOrg } from './OrgContext';
import toast from 'react-hot-toast';
import { X, Calendar } from 'lucide-react';

type Props = {
  isOpen: boolean;
  onClose: () => void;
  defaultDate?: string;
  onSuccess?: () => void;
};

export function CitaRapidaModal({ isOpen, onClose, defaultDate, onSuccess }: Props) {
  const { currentOrg } = useOrg();
  const [patientName, setPatientName] = useState('');
  const [representativeName, setRepresentativeName] = useState('');
  const [cedula, setCedula] = useState('');
  const [phone, setPhone] = useState('');
  const [appointmentDate, setAppointmentDate] = useState(defaultDate || new Date().toISOString().split('T')[0]);
  const [timeSlot, setTimeSlot] = useState('10:00 AM');
  const [services, setServices] = useState<{ id: string; name: string; price: number }[]>([]);
  const [therapyType, setTherapyType] = useState('');
  const [assignedProfessional] = useState('Lcda. Elizabeth Balcázar');
  const [depositAmount, setDepositAmount] = useState<number | ''>(15.0);
  const [consultationReason, setConsultationReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  React.useEffect(() => {
    if (defaultDate) {
      setAppointmentDate(defaultDate);
    }
  }, [defaultDate]);

  React.useEffect(() => {
    if (currentOrg && isOpen) {
      supabase
        .from('services')
        .select('id, name, price')
        .eq('organization_id', currentOrg.id)
        .eq('is_active', true)
        .then(({ data }) => {
          if (data && data.length > 0) {
            setServices(data);
          }
        });
    }
  }, [currentOrg, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentOrg || !patientName.trim() || !representativeName.trim()) {
      toast.error('Ingresa el nombre del paciente y del tutor.');
      return;
    }

    if (cedula.trim() && cedula.trim().length !== 10) {
      toast.error('La cédula debe contener exactamente 10 dígitos.');
      return;
    }

    if (phone.trim() && phone.trim().length !== 10) {
      toast.error('El teléfono debe contener exactamente 10 dígitos.');
      return;
    }

    setSubmitting(true);
    try {
      // 1. Insert appointment
      const { data: appData, error: appErr } = await supabase.from('appointments').insert({
        organization_id: currentOrg.id,
        patient_name: patientName.trim(),
        representative_name: representativeName.trim(),
        representative_identification: cedula.trim() || null,
        phone: phone.trim() || null,
        appointment_date: appointmentDate,
        time_slot: timeSlot,
        therapy_type: therapyType || 'Evaluación Inicial',
        assigned_professional: assignedProfessional,
        deposit_amount: Number(depositAmount) || 0,
        consultation_reason: consultationReason.trim() || null,
        status: 'scheduled',
      }).select().single();

      if (appErr) throw appErr;

      // 2. If there's a deposit, automatically create a charge and payment receipt for it!
      if (depositAmount && Number(depositAmount) > 0 && appData) {
        const { data: chargeData } = await supabase.from('charges').insert({
          organization_id: currentOrg.id,
          description: `Anticipo Reserva Cita / Evaluación: ${patientName.trim()}`,
          amount: Number(depositAmount),
          due_date: appointmentDate,
          status: 'paid',
          period_label: 'Anticipo Reserva'
        }).select().single();

        if (chargeData) {
          await supabase.from('internal_payments').insert({
            organization_id: currentOrg.id,
            charge_id: chargeData.id,
            amount: Number(depositAmount),
            payment_date: new Date().toISOString().split('T')[0],
            method: 'cash',
            reference: `Cita #${appData.id.slice(0, 6)}`
          });
        }
      }

      toast.success('¡Cita agendada y anticipo registrado con éxito!');
      if (onSuccess) onSuccess();
      onClose();
    } catch (err: any) {
      toast.error('Error al agendar cita: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 overflow-y-auto animate-fadeIn">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-lg overflow-hidden my-8 animate-popIn">
        {/* Header */}
        <div className="flex justify-between items-center px-6 py-4 border-b border-slate-100 bg-slate-50">
          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-indigo-600" />
            <h3 className="text-lg font-bold text-slate-900">Agendar Cita / Evaluación Rápida</h3>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-sm text-slate-700">
          <div className="bg-indigo-50 border border-indigo-100 p-3 rounded-xl text-xs text-indigo-900">
            <p className="font-semibold">Reserva de Cupo de Evaluación Previa</p>
            <p className="text-indigo-700 mt-0.5">
              Registra los datos del paciente y el abono inicial para bloquear el horario en la agenda.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Nombre del Paciente *</label>
              <input
                type="text"
                required
                value={patientName}
                onChange={(e) => setPatientName(e.target.value)}
                placeholder="Ej. Thiago Bermeo"
                className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Representante / Tutor *</label>
              <input
                type="text"
                required
                value={representativeName}
                onChange={(e) => setRepresentativeName(e.target.value)}
                placeholder="Ej. Lincy Belén Pando"
                className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Cédula del Tutor</label>
              <input
                type="text"
                maxLength={10}
                value={cedula}
                onChange={(e) => setCedula(e.target.value.replace(/\D/g, ''))}
                placeholder="10 dígitos"
                className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Teléfono (WhatsApp)</label>
              <input
                type="tel"
                maxLength={10}
                value={phone}
                onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
                placeholder="Ej. 0955443882"
                className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Fecha de la Cita *</label>
              <input
                type="date"
                required
                value={appointmentDate}
                onChange={(e) => setAppointmentDate(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Hora de la Cita *</label>
              <select
                value={timeSlot}
                onChange={(e) => setTimeSlot(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500"
              >
                <option value="09:00 AM">09:00 AM</option>
                <option value="10:00 AM">10:00 AM</option>
                <option value="11:00 AM">11:00 AM</option>
                <option value="02:00 PM">02:00 PM</option>
                <option value="03:00 PM">03:00 PM</option>
                <option value="04:00 PM">04:00 PM</option>
                <option value="05:00 PM">05:00 PM</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Servicio / Terapia (Opcional)</label>
              <select
                value={therapyType}
                onChange={(e) => {
                  setTherapyType(e.target.value);
                  const selected = services.find(s => s.name === e.target.value);
                  if (selected) setDepositAmount(selected.price);
                }}
                className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500 font-medium"
              >
                <option value="">-- Consulta General / Evaluación Inicial --</option>
                {services.map(s => (
                  <option key={s.id} value={s.name}>
                    {s.name} (${s.price.toFixed(2)})
                  </option>
                ))}
              </select>
              <p className="text-[11px] text-slate-400 mt-1">
                Si no seleccionas un servicio específico, se registrará como Evaluación Inicial.
              </p>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Abono / Anticipo Reserva ($)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={depositAmount}
                onChange={(e) => setDepositAmount(parseFloat(e.target.value) || 0)}
                placeholder="15.00"
                className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500 font-bold text-slate-900"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Motivo de Consulta / Observaciones</label>
            <input
              type="text"
              value={consultationReason}
              onChange={(e) => setConsultationReason(e.target.value)}
              placeholder="Ej. Problemas de pronunciación y articulación"
              className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-semibold text-slate-600 hover:text-slate-900 transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2 rounded-lg text-sm font-semibold shadow-sm transition-colors disabled:opacity-50 cursor-pointer"
            >
              {submitting ? 'Agendando...' : 'Confirmar Cita'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
