import { useState, useEffect, useCallback } from 'react';
import { useOrg } from './OrgContext';
import { supabase } from '../../lib/supabase';
import { useNavigate } from 'react-router';
import toast from 'react-hot-toast';
import { EntityAutocomplete } from '../../components/ui/EntityAutocomplete';
import { SkeletonTable } from '../../components/ui/Skeleton';
import { formatDate } from '../../lib/formatDate';
import {
  Users,
  Plus,
  Search,
  X,
  Edit2,
  UserCheck,
  UserX,
  Baby,
  Calendar,
  Phone,
  FileText,
} from 'lucide-react';
import { ActaCompromisoModal } from './ActaCompromisoModal';
import type { CommitmentData } from './ActaCompromisoModal';

// ─── Types ────────────────────────────────────────────────────────────────────

type Representative = {
  id: string;
  first_name: string;
  last_name: string;
  identification: string | null;
  phone: string | null;
  email: string | null;
  relationship: string | null;
};

type Beneficiary = {
  id: string;
  organization_id: string;
  first_name: string;
  last_name: string;
  birth_date: string | null;
  consultation_reason?: string | null;
  photo_consent?: boolean;
  photo_url?: string | null;
  notes: string | null;
  is_active: boolean;
  created_at: string;
  representative?: Representative | null;
  has_enrollment?: boolean;
};

export type BeneficiaryFormState = {
  first_name: string;
  last_name: string;
  birth_date: string;
  consultation_reason: string;
  photo_consent: boolean;
  notes: string;
  // Representative fields
  rep_mode: 'existing' | 'new';
  selected_rep_id: string;
  rep_cedula: string;
  rep_first_name: string;
  rep_last_name: string;
  rep_phone: string;
  rep_email: string;
  rep_relationship: string;
};

const EMPTY_FORM: BeneficiaryFormState = {
  first_name: '',
  last_name: '',
  birth_date: '',
  consultation_reason: '',
  photo_consent: true,
  notes: '',
  rep_mode: 'existing',
  selected_rep_id: '',
  rep_cedula: '',
  rep_first_name: '',
  rep_last_name: '',
  rep_phone: '',
  rep_email: '',
  rep_relationship: 'Madre',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function calculateAge(birthDate: string | null): string {
  if (!birthDate) return '—';
  const today = new Date();
  const dob = new Date(birthDate);
  let years = today.getFullYear() - dob.getFullYear();
  let months = today.getMonth() - dob.getMonth();
  if (months < 0 || (months === 0 && today.getDate() < dob.getDate())) {
    years--;
    months += 12;
  }
  if (years < 0) return '—';
  if (years === 0) return `${months} mes${months !== 1 ? 'es' : ''}`;
  if (years < 2) return `${years} año, ${months} mes${months !== 1 ? 'es' : ''}`;
  return `${years} año${years !== 1 ? 's' : ''}`;
}

function getInitials(firstName: string, lastName: string): string {
  const f = firstName.trim()[0] ?? '';
  const l = lastName.trim()[0] ?? '';
  return (f + l).toUpperCase();
}

function avatarColor(name: string): string {
  const palette = [
    'bg-indigo-100 text-indigo-700',
    'bg-violet-100 text-violet-700',
    'bg-sky-100 text-sky-700',
    'bg-emerald-100 text-emerald-700',
    'bg-amber-100 text-amber-700',
    'bg-rose-100 text-rose-700',
    'bg-pink-100 text-pink-700',
    'bg-teal-100 text-teal-700',
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return palette[Math.abs(hash) % palette.length];
}

// ─── Sub-components ───────────────────────────────────────────────────────────

interface StatusBadgeProps {
  isActive: boolean;
}

function StatusBadge({ isActive }: StatusBadgeProps) {
  return isActive ? (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
      <UserCheck size={11} />
      Activo
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-500 border border-slate-200">
      <UserX size={11} />
      Inactivo
    </span>
  );
}

// ─── Modal ────────────────────────────────────────────────────────────────────

interface BeneficiaryModalProps {
  mode: 'create' | 'edit';
  initial: BeneficiaryFormState;
  isActive?: boolean;
  submitting: boolean;
  existingReps: Representative[];
  onClose: () => void;
  onSubmit: (form: BeneficiaryFormState, setActive?: boolean) => void;
}

export function BeneficiaryModal({
  mode,
  initial,
  isActive,
  submitting,
  existingReps,
  onClose,
  onSubmit,
}: BeneficiaryModalProps) {
  const [form, setForm] = useState<BeneficiaryFormState>(initial);
  const [toggleActive, setToggleActive] = useState<boolean>(isActive ?? true);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const clean = e.target.value.replace(/\D/g, '');
    setForm((prev) => ({ ...prev, rep_phone: clean }));
  };

  const handleCedulaChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const clean = e.target.value.replace(/\D/g, '');
    setForm((prev) => ({ ...prev, rep_cedula: clean }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.first_name.trim()) {
      toast.error('El nombre del paciente es obligatorio.');
      return;
    }
    if (!form.last_name.trim()) {
      toast.error('El apellido del paciente es obligatorio.');
      return;
    }

    // Strict Representative Validation
    if (form.rep_mode === 'new') {
      if (!form.rep_cedula.trim()) {
        toast.error('Por favor ingresa la cédula del representante.');
        return;
      }
      if (form.rep_cedula.trim().length !== 10) {
        toast.error('La cédula del representante debe contener exactamente 10 dígitos.');
        return;
      }
      if (!form.rep_first_name.trim() || !form.rep_last_name.trim()) {
        toast.error('Ingresa nombres y apellidos del representante.');
        return;
      }
      if (!form.rep_phone.trim()) {
        toast.error('Por favor ingresa el teléfono del representante.');
        return;
      }
      if (form.rep_phone.trim().length !== 10) {
        toast.error('El teléfono del representante debe contener exactamente 10 dígitos.');
        return;
      }
    }

    onSubmit(form, mode === 'edit' ? toggleActive : undefined);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto animate-fadeIn"
      style={{ background: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(4px)' }}
    >
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden my-8 animate-popIn">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center">
              <Baby size={18} className="text-indigo-600" />
            </div>
            <h2 className="text-base font-bold text-slate-900">
              {mode === 'create' ? 'Nuevo Beneficiario / Paciente' : 'Editar Beneficiario'}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 transition-colors rounded-lg p-1"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-5 max-h-[80vh] overflow-y-auto">
          
          {/* SECTION 1: Paciente */}
          <div className="space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-indigo-700 flex items-center gap-1.5 border-b border-indigo-100 pb-1">
              <Baby size={14} />
              1. Datos del Paciente / Niño
            </h3>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Nombres <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="first_name"
                  value={form.first_name}
                  onChange={handleChange}
                  placeholder="Ej: Thiago"
                  className="w-full text-sm rounded-lg border border-slate-300 px-3 py-2 text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Apellidos <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="last_name"
                  value={form.last_name}
                  onChange={handleChange}
                  placeholder="Ej: Bermeo"
                  className="w-full text-sm rounded-lg border border-slate-300 px-3 py-2 text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Fecha de Nacimiento
              </label>
              <input
                type="date"
                name="birth_date"
                value={form.birth_date}
                onChange={handleChange}
                max={new Date().toISOString().split('T')[0]}
                className="w-full text-sm rounded-lg border border-slate-300 px-3 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          {/* SECTION 2: Representante / Tutor Legal */}
          <div className="space-y-3 pt-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-indigo-700 flex items-center gap-1.5 border-b border-indigo-100 pb-1">
              <Users size={14} />
              2. Representante / Tutor Legal
            </h3>

            {/* Toggle Mode */}
            <div className="flex rounded-lg bg-slate-100 p-1 text-xs font-semibold">
              <button
                type="button"
                onClick={() => setForm(prev => ({ ...prev, rep_mode: 'existing' }))}
                className={`flex-1 py-1.5 text-center rounded-md transition-all cursor-pointer ${
                  form.rep_mode === 'existing'
                    ? 'bg-white text-indigo-700 shadow-xs font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Seleccionar Existente ({existingReps.length})
              </button>
              <button
                type="button"
                onClick={() => setForm(prev => ({ ...prev, rep_mode: 'new' }))}
                className={`flex-1 py-1.5 text-center rounded-md transition-all cursor-pointer ${
                  form.rep_mode === 'new'
                    ? 'bg-white text-indigo-700 shadow-xs font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                + Crear Nuevo Tutor
              </button>
            </div>

            {/* Mode A: Existing Rep Select */}
            {form.rep_mode === 'existing' && (
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Buscar / Seleccionar Representante Registrado
                </label>
                {existingReps.length === 0 ? (
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-900 text-xs">
                    No hay representantes guardados todavía. Selecciona la opción <strong>"+ Crear Nuevo Tutor"</strong> arriba para registrarlo.
                  </div>
                ) : (
                  <EntityAutocomplete<Representative>
                    placeholder="Escribe cédula o nombre del tutor..."
                    fetchResults={async (query) => {
                      const q = query.toLowerCase();
                      return existingReps.filter(r => 
                        (r.identification || '').includes(q) || 
                        `${r.first_name} ${r.last_name}`.toLowerCase().includes(q)
                      ).slice(0, 5);
                    }}
                    selectedItem={existingReps.find(r => r.id === form.selected_rep_id) || null}
                    onSelect={(item) => setForm(prev => ({ ...prev, selected_rep_id: item ? item.id : '' }))}
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
                )}
              </div>
            )}

            {/* Mode B: New Representative Form */}
            {form.rep_mode === 'new' && (
              <div className="space-y-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Cédula del Tutor (10 dígitos) <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      maxLength={10}
                      name="rep_cedula"
                      value={form.rep_cedula}
                      onChange={handleCedulaChange}
                      placeholder="Ej: 0955443882"
                      className="w-full text-sm rounded-lg border border-slate-300 px-3 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Parentesco
                    </label>
                    <select
                      name="rep_relationship"
                      value={form.rep_relationship}
                      onChange={handleChange}
                      className="w-full text-sm rounded-lg border border-slate-300 px-3 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    >
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
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Nombres del Tutor <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      name="rep_first_name"
                      value={form.rep_first_name}
                      onChange={handleChange}
                      placeholder="Ej: Lincy Belén"
                      className="w-full text-sm rounded-lg border border-slate-300 px-3 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Apellidos del Tutor <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      name="rep_last_name"
                      value={form.rep_last_name}
                      onChange={handleChange}
                      placeholder="Ej: Pando"
                      className="w-full text-sm rounded-lg border border-slate-300 px-3 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Teléfono (WhatsApp 10 dígitos) <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      maxLength={10}
                      name="rep_phone"
                      value={form.rep_phone}
                      onChange={handlePhoneChange}
                      placeholder="Ej: 0955443882"
                      className="w-full text-sm rounded-lg border border-slate-300 px-3 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Correo Electrónico
                    </label>
                    <input
                      type="email"
                      name="rep_email"
                      value={form.rep_email}
                      onChange={handleChange}
                      placeholder="tutor@gmail.com"
                      className="w-full text-sm rounded-lg border border-slate-300 px-3 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* SECTION 3: Observaciones */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Observaciones / Diagnóstico Inicial
            </label>
            <textarea
              name="notes"
              value={form.notes}
              onChange={handleChange}
              placeholder="Notas médicas, condiciones especiales, etc."
              rows={2}
              className="w-full text-sm rounded-lg border border-slate-300 px-3 py-2 text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
            />
          </div>

          {mode === 'edit' && (
            <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
              <div>
                <p className="text-sm font-semibold text-slate-800">Estado del beneficiario</p>
                <p className="text-xs text-slate-500 mt-0.5">
                  {toggleActive
                    ? 'Activo — visible en asistencia y cobros'
                    : 'Inactivo — oculto del sistema'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setToggleActive((v) => !v)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                  toggleActive ? 'bg-emerald-500' : 'bg-slate-300'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    toggleActive ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-100 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 rounded-xl text-sm font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-md transition-colors disabled:opacity-50 flex items-center gap-2 cursor-pointer"
            >
              {submitting ? 'Guardando...' : mode === 'create' ? 'Guardar y Vincular' : 'Guardar Cambios'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Empty State ───────────────────────────────────────────────────────────────

interface EmptyStateProps {
  filtered: boolean;
  onCreateClick: () => void;
}

function EmptyState({ filtered, onCreateClick }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="w-16 h-16 rounded-2xl bg-indigo-50 flex items-center justify-center mb-4">
        <Users size={28} className="text-indigo-400" />
      </div>
      <h3 className="text-base font-semibold text-slate-700 mb-1">
        {filtered ? 'Sin resultados' : 'No hay beneficiarios'}
      </h3>
      <p className="text-sm text-slate-500 mb-6 max-w-xs">
        {filtered
          ? 'Tu búsqueda no encontró coincidencias. Intenta con otro nombre o revisa los filtros.'
          : 'Registra el primer beneficiario de tu centro para comenzar a gestionar asistencia y cobros.'}
      </p>
      {!filtered && (
        <button
          onClick={onCreateClick}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-xl transition shadow-md cursor-pointer"
        >
          <Plus size={16} />
          Agregar primer beneficiario
        </button>
      )}
    </div>
  );
}

// ─── Table Row ─────────────────────────────────────────────────────────────────

interface BeneficiaryRowProps {
  beneficiary: Beneficiary;
  onEdit: (b: Beneficiary) => void;
  onViewActa: (b: Beneficiary) => void;
  onDetail: (b: Beneficiary) => void;
}

function BeneficiaryRow({ beneficiary, onEdit, onViewActa, onDetail }: BeneficiaryRowProps) {
  const initials = getInitials(beneficiary.first_name, beneficiary.last_name);
  const color = avatarColor(beneficiary.first_name + beneficiary.last_name);
  const age = calculateAge(beneficiary.birth_date);
  const rep = beneficiary.representative;

  return (
    <tr className="border-b border-slate-100 hover:bg-slate-50 transition-colors group">
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <div
            className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${color}`}
          >
            {initials || <Baby size={14} />}
          </div>
          <div>
            <p className="text-sm font-bold text-slate-900 leading-tight">
              {beneficiary.first_name} {beneficiary.last_name}
            </p>
            {beneficiary.notes && (
              <p className="text-xs text-slate-400 mt-0.5 truncate max-w-[200px]">
                {beneficiary.notes}
              </p>
            )}
          </div>
        </div>
      </td>
      <td className="px-4 py-3">
        {rep ? (
          <div>
            <p className="text-xs font-bold text-slate-800 flex items-center gap-1">
              {rep.first_name} {rep.last_name}
              <span className="text-[10px] font-semibold bg-indigo-50 text-indigo-700 px-1.5 py-0.2 rounded border border-indigo-100">
                {rep.relationship || 'Tutor'}
              </span>
            </p>
            {rep.phone && (
              <p className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
                <Phone size={10} className="text-slate-400" />
                {rep.phone}
              </p>
            )}
          </div>
        ) : (
          <span className="text-xs text-amber-600 font-medium italic">Sin vincular</span>
        )}
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-1.5 text-xs text-slate-600 font-medium">
          {beneficiary.birth_date ? (
            <>
              <Calendar size={13} className="text-slate-400" />
              {age}
            </>
          ) : (
            <span className="text-slate-400 italic text-xs">Sin fecha</span>
          )}
        </div>
      </td>
      <td className="px-4 py-3">
        <StatusBadge isActive={beneficiary.is_active} />
      </td>
      <td className="px-4 py-3 text-right flex justify-end gap-2">
        <button
          onClick={() => onDetail(beneficiary)}
          className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-lg border border-indigo-200 transition cursor-pointer"
          title="Ver Detalle del Beneficiario"
        >
          <Baby size={12} />
          Ver Detalle
        </button>
        {beneficiary.has_enrollment && (
          <button
            onClick={() => onViewActa(beneficiary)}
            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-violet-700 bg-violet-50 hover:bg-violet-100 rounded-lg border border-violet-200 transition cursor-pointer"
            title="Ver / Imprimir Acta de Compromiso"
          >
            <FileText size={12} />
            Acta
          </button>
        )}
        <button
          onClick={() => onEdit(beneficiary)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-lg transition cursor-pointer"
          title="Editar"
        >
          <Edit2 size={12} />
          Editar
        </button>
      </td>
    </tr>
  );
}

// ─── Main Module ───────────────────────────────────────────────────────────────

export function BeneficiariosModule() {
  const { currentOrg } = useOrg();
  const navigate = useNavigate();

  const [beneficiaries, setBeneficiaries] = useState<Beneficiary[]>([]);
  const [existingReps, setExistingReps] = useState<Representative[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showInactive, setShowInactive] = useState(false);

  // Acta de compromiso state
  const [selectedCommitment, setSelectedCommitment] = useState<CommitmentData | null>(null);
  const [isActaOpen, setIsActaOpen] = useState(false);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editTarget, setEditTarget] = useState<Beneficiary | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const loadData = useCallback(async () => {
    if (!currentOrg) return;
    setLoading(true);
    try {
      // 1. Fetch Beneficiaries with linked Representative
      const { data: benData, error: benErr } = await (supabase as any)
        .from('beneficiaries')
        .select(`
          *,
          beneficiary_representatives (
            is_primary,
            representatives (*)
          )
        `)
        .eq('organization_id', currentOrg.id)
        .order('created_at', { ascending: false });

      if (benErr) throw benErr;

      const formatted: Beneficiary[] = (benData || []).map((b: any) => {
        const primaryLink = b.beneficiary_representatives?.[0];
        return {
          ...b,
          representative: primaryLink?.representatives || null,
          has_enrollment: false, // filled below
        };
      });

      // Load enrollment counts
      const benIds = formatted.map(b => b.id);
      if (benIds.length > 0) {
        const { data: enrData } = await (supabase as any)
          .from('enrollments')
          .select('beneficiary_id')
          .in('beneficiary_id', benIds)
          .eq('status', 'active');

        const enrSet = new Set((enrData || []).map((e: any) => e.beneficiary_id));
        formatted.forEach(b => { b.has_enrollment = enrSet.has(b.id); });
      }

      setBeneficiaries(formatted);

      // 2. Fetch existing Representatives for selection
      const { data: repData, error: repErr } = await supabase
        .from('representatives')
        .select('*')
        .eq('organization_id', currentOrg.id)
        .order('first_name', { ascending: true });

      if (!repErr && repData) {
        setExistingReps(repData as Representative[]);
      }
    } catch (err: any) {
      console.error('Error loading beneficiaries:', err);
      toast.error('Error al cargar la lista de beneficiarios');
    } finally {
      setLoading(false);
    }
  }, [currentOrg]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const openActaForBeneficiary = async (b: Beneficiary) => {
    try {
      const rep = b.representative;
      const { data: comData } = await supabase
        .from('commitments')
        .select('*')
        .eq('beneficiary_id', b.id)
        .maybeSingle();

      setSelectedCommitment({
        representativeName: rep ? `${rep.first_name} ${rep.last_name}` : 'Representante Legal',
        representativeId: rep?.identification || '—',
        representativeEmail: rep?.email || '—',
        beneficiaryName: `${b.first_name} ${b.last_name}`,
        sessionDuration: (comData as any)?.session_duration_minutes || 40,
        photoConsent: b.photo_consent ?? true,
        therapies: (comData as any)?.selected_therapies || { lenguaje: true },
        paymentFrequency: (comData as any)?.payment_frequency || 'session',
        signedDate: (comData as any)?.signed_at ? formatDate((comData as any).signed_at) : undefined,
        orgName: currentOrg?.name,
        city: currentOrg?.city || 'La Troncal'
      });
      setIsActaOpen(true);
    } catch (err: any) {
      toast.error('Error al abrir Acta: ' + err.message);
    }
  };

  const handleCreateSubmit = async (form: BeneficiaryFormState) => {
    if (!currentOrg) return;
    setSubmitting(true);
    try {
      let repId = form.selected_rep_id;

      // 1. Create new representative if mode === 'new'
      if (form.rep_mode === 'new') {
        const { data: newRep, error: repErr } = await supabase
          .from('representatives')
          .insert({
            organization_id: currentOrg.id,
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

      // 2. Insert Beneficiary
      const { data: newBen, error: benErr } = await supabase
        .from('beneficiaries')
        .insert({
          organization_id: currentOrg.id,
          first_name: form.first_name.trim(),
          last_name: form.last_name.trim(),
          birth_date: form.birth_date || null,
          consultation_reason: form.consultation_reason.trim() || null,
          photo_consent: form.photo_consent,
          notes: form.notes.trim() || null,
          is_active: true,
        })
        .select('id')
        .single();

      if (benErr) throw benErr;

      // 3. Link Beneficiary and Representative
      if (repId && newBen?.id) {
        await supabase
          .from('beneficiary_representatives')
          .insert({
            beneficiary_id: newBen.id,
            representative_id: repId,
            is_primary: true,
          });
      }

      toast.success('Beneficiario creado y vinculado exitosamente.');
      setShowCreateModal(false);
      await loadData();
    } catch (err: any) {
      console.error(err);
      toast.error('Error al guardar beneficiario: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditSubmit = async (form: BeneficiaryFormState, setActive?: boolean) => {
    if (!currentOrg || !editTarget) return;
    setSubmitting(true);
    try {
      let repId = form.selected_rep_id;

      // 1. Create new representative if mode === 'new'
      if (form.rep_mode === 'new') {
        const { data: newRep, error: repErr } = await supabase
          .from('representatives')
          .insert({
            organization_id: currentOrg.id,
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

      // 2. Update Beneficiary
      const { error: benErr } = await supabase
        .from('beneficiaries')
        .update({
          first_name: form.first_name.trim(),
          last_name: form.last_name.trim(),
          birth_date: form.birth_date || null,
          notes: form.notes.trim() || null,
          is_active: setActive ?? true,
        })
        .eq('id', editTarget.id);

      if (benErr) throw benErr;

      // 3. Update primary representative link — only touch it if the
      // selection actually changed, and never wipe other representatives
      // linked to this beneficiary (managed from the beneficiary detail page).
      if (repId && repId !== editTarget.representative?.id) {
        await supabase
          .from('beneficiary_representatives')
          .update({ is_primary: false })
          .eq('beneficiary_id', editTarget.id);

        await supabase
          .from('beneficiary_representatives')
          .upsert(
            { beneficiary_id: editTarget.id, representative_id: repId, is_primary: true },
            { onConflict: 'beneficiary_id,representative_id' }
          );
      }

      toast.success('Beneficiario actualizado exitosamente.');
      setEditTarget(null);
      await loadData();
    } catch (err: any) {
      console.error(err);
      toast.error('Error al actualizar beneficiario: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  // Filter
  const filtered = beneficiaries.filter((b) => {
    const query = searchQuery.toLowerCase().trim();
    const fullName = `${b.first_name} ${b.last_name}`.toLowerCase();
    const repName = b.representative ? `${b.representative.first_name} ${b.representative.last_name}`.toLowerCase() : '';
    const repCedula = b.representative?.identification || '';
    
    const matchesSearch = fullName.includes(query) || repName.includes(query) || repCedula.includes(query);
    const matchesStatus = showInactive ? true : b.is_active;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 flex items-center gap-2.5">
            <Baby className="w-7 h-7 text-indigo-600" />
            Beneficiarios / Pacientes
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Gestión completa de los niños y pacientes registrados en {currentOrg?.name}.
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm rounded-xl transition shadow-md cursor-pointer self-start sm:self-auto"
        >
          <Plus size={18} />
          Nuevo Beneficiario
        </button>
      </div>

      {/* Controls Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white p-4 rounded-xl border border-slate-200">
        <div className="relative w-full sm:w-80">
          <Search size={16} className="absolute left-3 top-3 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar por paciente o tutor..."
            className="w-full text-sm pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <label className="flex items-center gap-2 text-xs font-semibold text-slate-600 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={showInactive}
            onChange={(e) => setShowInactive(e.target.checked)}
            className="rounded text-indigo-600 focus:ring-indigo-500"
          />
          Mostrar beneficiarios inactivos
        </label>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        {loading ? (
          <SkeletonTable rows={6} columns={5} />
        ) : filtered.length === 0 ? (
          <EmptyState
            filtered={searchQuery.length > 0}
            onCreateClick={() => setShowCreateModal(true)}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/50 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  <th className="px-4 py-3">Paciente / Niño</th>
                  <th className="px-4 py-3">Representante Legal (Tutor)</th>
                  <th className="px-4 py-3">Edad</th>
                  <th className="px-4 py-3">Estado</th>
                  <th className="px-4 py-3 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((b) => (
                  <BeneficiaryRow
                    key={b.id}
                    beneficiary={b}
                    onEdit={setEditTarget}
                    onViewActa={openActaForBeneficiary}
                    onDetail={(ben) => navigate(`/app/beneficiarios/${ben.id}`)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <BeneficiaryModal
          mode="create"
          initial={EMPTY_FORM}
          submitting={submitting}
          existingReps={existingReps}
          onClose={() => setShowCreateModal(false)}
          onSubmit={handleCreateSubmit}
        />
      )}

      {/* Edit Modal */}
      {editTarget && (
        <BeneficiaryModal
          mode="edit"
          initial={{
            first_name: editTarget.first_name,
            last_name: editTarget.last_name,
            birth_date: editTarget.birth_date || '',
            consultation_reason: editTarget.consultation_reason || '',
            photo_consent: editTarget.photo_consent ?? true,
            notes: editTarget.notes || '',
            rep_mode: editTarget.representative ? 'existing' : 'existing',
            selected_rep_id: editTarget.representative?.id || '',
            rep_cedula: editTarget.representative?.identification || '',
            rep_first_name: editTarget.representative?.first_name || '',
            rep_last_name: editTarget.representative?.last_name || '',
            rep_phone: editTarget.representative?.phone || '',
            rep_email: editTarget.representative?.email || '',
            rep_relationship: editTarget.representative?.relationship || 'Madre',
          }}
          isActive={editTarget.is_active}
          submitting={submitting}
          existingReps={existingReps}
          onClose={() => setEditTarget(null)}
          onSubmit={handleEditSubmit}
        />
      )}

      {/* Printable Acta Modal */}
      {selectedCommitment && (
        <ActaCompromisoModal
          isOpen={isActaOpen}
          onClose={() => {
            setIsActaOpen(false);
            setSelectedCommitment(null);
          }}
          data={selectedCommitment}
        />
      )}
    </div>
  );
}
