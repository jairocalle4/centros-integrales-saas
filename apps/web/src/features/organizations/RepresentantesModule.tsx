import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { useOrg } from './OrgContext';
import { supabase } from '../../lib/supabase';
import toast from 'react-hot-toast';
import {
  Plus,
  Search,
  X,
  Edit2,
  UserCheck,
  UserX,
  Phone,
  Mail,
  HeartHandshake,
} from 'lucide-react';
import { SkeletonTable } from '../../components/ui/Skeleton';

type Representative = {
  id: string;
  organization_id: string;
  first_name: string;
  last_name: string;
  identification: string | null;
  phone: string | null;
  email: string | null;
  relationship: string | null;
  notes: string | null;
  is_active: boolean;
  created_at: string;
};

export function RepresentantesModule() {
  const { currentOrg } = useOrg();
  const navigate = useNavigate();
  const [representatives, setRepresentatives] = useState<Representative[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showInactive, setShowInactive] = useState(false);
  const [handledEditParam, setHandledEditParam] = useState(false);

  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRep, setEditingRep] = useState<Representative | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form states
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [identification, setIdentification] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [relationship, setRelationship] = useState('Madre');
  const [notes, setNotes] = useState('');
  const [isActive, setIsActive] = useState(true);

  useEffect(() => {
    if (currentOrg) {
      loadRepresentatives();
    }
  }, [currentOrg, showInactive]);

  const loadRepresentatives = async () => {
    if (!currentOrg) return;
    setLoading(true);

    let query = supabase
      .from('representatives')
      .select('*')
      .eq('organization_id', currentOrg.id)
      .order('last_name', { ascending: true });

    if (!showInactive) {
      query = query.eq('is_active', true);
    }

    const { data, error } = await query;

    if (error) {
      toast.error('Error cargando representantes: ' + error.message);
    } else {
      setRepresentatives((data as Representative[]) || []);
    }
    setLoading(false);
  };

  const handleOpenCreateModal = () => {
    setEditingRep(null);
    setFirstName('');
    setLastName('');
    setIdentification('');
    setPhone('');
    setEmail('');
    setRelationship('Madre');
    setNotes('');
    setIsActive(true);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (rep: Representative) => {
    setEditingRep(rep);
    setFirstName(rep.first_name);
    setLastName(rep.last_name);
    setIdentification(rep.identification || '');
    setPhone(rep.phone || '');
    setEmail(rep.email || '');
    setRelationship(rep.relationship || 'Madre');
    setNotes(rep.notes || '');
    setIsActive(rep.is_active);
    setIsModalOpen(true);
  };

  // Deep link from the payment-receipt "Sin WhatsApp" fallback
  // (?edit=<representativeId>) — jump straight into the edit form instead
  // of a bare list, same query-param-prefill idea used in MatriculaWizard.
  useEffect(() => {
    if (loading || handledEditParam) return;
    setHandledEditParam(true);
    const editId = new URLSearchParams(window.location.search).get('edit');
    if (!editId) return;
    const rep = representatives.find(r => r.id === editId);
    if (rep) {
      handleOpenEditModal(rep);
    } else {
      toast.error('No se encontró el representante a editar.');
    }
    navigate('/app/representantes', { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, representatives, handledEditParam]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentOrg || !firstName.trim() || !lastName.trim()) {
      toast.error('Por favor ingresa nombres y apellidos del representante.');
      return;
    }

    if (identification.trim() && identification.trim().length !== 10) {
      toast.error('La cédula debe contener exactamente 10 dígitos.');
      return;
    }

    if (!phone.trim()) {
      toast.error('Por favor ingresa el teléfono del representante.');
      return;
    }

    if (phone.trim().length !== 10) {
      toast.error('El teléfono debe contener exactamente 10 dígitos.');
      return;
    }

    setIsSubmitting(true);
    try {
      if (editingRep) {
        // UPDATE
        const { error } = await supabase
          .from('representatives')
          .update({
            first_name: firstName.trim(),
            last_name: lastName.trim(),
            identification: identification.trim() || null,
            phone: phone.trim() || null,
            email: email.trim() || null,
            relationship,
            notes: notes.trim() || null,
            is_active: isActive,
            updated_at: new Date().toISOString(),
          })
          .eq('id', editingRep.id);

        if (error) throw error;
        toast.success('Representante actualizado correctamente.');
      } else {
        // INSERT
        const { error } = await supabase.from('representatives').insert({
          organization_id: currentOrg.id,
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          identification: identification.trim() || null,
          phone: phone.trim() || null,
          email: email.trim() || null,
          relationship,
          notes: notes.trim() || null,
          is_active: true,
        });

        if (error) throw error;
        toast.success('Representante registrado exitosamente.');
      }

      setIsModalOpen(false);
      loadRepresentatives();
    } catch (err: any) {
      toast.error('Error al guardar representante: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredReps = representatives.filter((rep) => {
    const fullName = `${rep.first_name} ${rep.last_name}`.toLowerCase();
    const ident = (rep.identification || '').toLowerCase();
    const search = searchTerm.toLowerCase();
    return fullName.includes(search) || ident.includes(search);
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Representantes</h1>
          <p className="text-sm text-slate-500 mt-1">
            Gestiona los padres, madres y tutores legales del centro integral.
          </p>
        </div>
        <button
          onClick={handleOpenCreateModal}
          className="inline-flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-lg text-sm font-semibold shadow-sm transition-colors"
        >
          <Plus className="w-4 h-4" />
          Nuevo Representante
        </button>
      </div>

      {/* Toolbar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col sm:flex-row justify-between items-center gap-4">
        <div className="relative w-full sm:w-80">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar por nombre o cédula..."
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all"
          />
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer self-start sm:self-auto">
          <input
            type="checkbox"
            checked={showInactive}
            onChange={(e) => setShowInactive(e.target.checked)}
            className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
          />
          Mostrar inactivos
        </label>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        {loading ? (
          <SkeletonTable rows={6} columns={4} />
        ) : filteredReps.length === 0 ? (
          <div className="p-12 text-center text-slate-500">
            <HeartHandshake className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="font-semibold text-slate-700">No se encontraron representantes</p>
            <p className="text-xs text-slate-400 mt-1">Registra al primer tutor para vincularlo con sus beneficiarios.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                <tr>
                  <th className="px-6 py-3.5">Representante</th>
                  <th className="px-6 py-3.5">Relación</th>
                  <th className="px-6 py-3.5">Cédula / Identificación</th>
                  <th className="px-6 py-3.5">Contacto</th>
                  <th className="px-6 py-3.5">Estado</th>
                  <th className="px-6 py-3.5 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredReps.map((rep) => (
                  <tr key={rep.id} className="hover:bg-slate-50 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="font-semibold text-slate-900">
                        {rep.first_name} {rep.last_name}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="bg-indigo-50 text-indigo-700 px-2.5 py-1 rounded-md text-xs font-semibold border border-indigo-100">
                        {rep.relationship || 'Tutor'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-xs font-mono text-slate-500">
                      {rep.identification || 'Sin cédula'}
                    </td>
                    <td className="px-6 py-4">
                      <div className="space-y-0.5 text-xs text-slate-500">
                        {rep.phone && (
                          <div className="flex items-center gap-1.5">
                            <Phone className="w-3.5 h-3.5 text-slate-400" />
                            {rep.phone}
                          </div>
                        )}
                        {rep.email && (
                          <div className="flex items-center gap-1.5">
                            <Mail className="w-3.5 h-3.5 text-slate-400" />
                            {rep.email}
                          </div>
                        )}
                        {!rep.phone && !rep.email && <span className="text-slate-400 italic">Sin datos</span>}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {rep.is_active ? (
                        <span className="inline-flex items-center gap-1 text-emerald-600 text-xs font-semibold bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
                          <UserCheck className="w-3.5 h-3.5" /> Activo
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-slate-500 text-xs font-semibold bg-slate-100 px-2.5 py-1 rounded-full border border-slate-200">
                          <UserX className="w-3.5 h-3.5" /> Inactivo
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => handleOpenEditModal(rep)}
                        className="text-slate-400 hover:text-indigo-600 p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
                        title="Editar Representante"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal Crear / Editar */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl p-6 w-full max-w-md">
            <div className="flex justify-between items-center mb-4 border-b border-slate-100 pb-3">
              <h3 className="text-lg font-bold text-slate-900">
                {editingRep ? 'Editar Representante' : 'Nuevo Representante'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Nombre *</label>
                  <input
                    type="text"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    required
                    placeholder="Ej. María"
                    className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Apellido *</label>
                  <input
                    type="text"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    required
                    placeholder="Ej. Pérez"
                    className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Relación / Parentesco</label>
                  <select
                    value={relationship}
                    onChange={(e) => setRelationship(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="Madre">Madre</option>
                    <option value="Padre">Padre</option>
                    <option value="Tutor Legal">Tutor Legal</option>
                    <option value="Abuelo/a">Abuelo/a</option>
                    <option value="Otro">Otro</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Cédula de Identidad (10 dígitos)
                  </label>
                  <input
                    type="text"
                    maxLength={10}
                    value={identification}
                    onChange={(e) => setIdentification(e.target.value.replace(/\D/g, ''))}
                    placeholder="Ej. 0955443882"
                    className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Teléfono / WhatsApp (10 dígitos) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    maxLength={10}
                    value={phone}
                    onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
                    placeholder="Ej. 0955443882"
                    className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Correo Electrónico</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="tutor@ejemplo.com"
                    className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Notas / Observaciones</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  placeholder="Información relevante..."
                  className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {editingRep && (
                <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
                  <input
                    type="checkbox"
                    id="isActive"
                    checked={isActive}
                    onChange={(e) => setIsActive(e.target.checked)}
                    className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <label htmlFor="isActive" className="text-sm font-medium text-slate-700">
                    Representante Activo
                  </label>
                </div>
              )}

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-sm font-semibold text-slate-600 hover:text-slate-900 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2 rounded-lg text-sm font-semibold shadow-sm transition-colors disabled:opacity-50"
                >
                  {isSubmitting ? 'Guardando...' : 'Guardar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
