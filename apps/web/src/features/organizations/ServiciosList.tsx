import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useOrg } from './OrgContext';
import toast from 'react-hot-toast';
import { X, PackageOpen, Tag, Loader2 } from 'lucide-react';
import { SkeletonTable } from '../../components/ui/Skeleton';

type Service = {
  id: string;
  name: string;
  description: string | null;
  price: number;
  is_active: boolean;
};

export function ServiciosList({
  isModalOpen,
  setIsModalOpen
}: {
  isModalOpen: boolean;
  setIsModalOpen: (open: boolean) => void;
}) {
  const { currentOrg } = useOrg();
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);

  // Form
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState<number | ''>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingServiceId, setEditingServiceId] = useState<string | null>(null);

  // When modal is closed, clear editing state
  useEffect(() => {
    if (!isModalOpen) {
      setEditingServiceId(null);
      setName('');
      setDescription('');
      setPrice('');
    }
  }, [isModalOpen]);

  useEffect(() => {
    if (currentOrg) loadServices();
  }, [currentOrg]);

  const loadServices = async () => {
    if (!currentOrg) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('services')
        .select('*')
        .eq('organization_id', currentOrg.id)
        .order('name');
      
      if (error) throw error;
      setServices(data || []);
    } catch (err: any) {
      toast.error('Error cargando servicios: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentOrg || !name.trim() || price === '') return;

    setIsSubmitting(true);
    try {
      if (editingServiceId) {
        const { error } = await supabase
          .from('services')
          .update({
            name: name.trim(),
            description: description.trim() || null,
            price: Number(price),
          })
          .eq('id', editingServiceId);
        if (error) throw error;
        toast.success('Servicio actualizado con éxito.');
      } else {
        const { error } = await supabase.from('services').insert({
          organization_id: currentOrg.id,
          name: name.trim(),
          description: description.trim() || null,
          price: Number(price),
          is_active: true
        });
        if (error) throw error;
        toast.success('Servicio creado con éxito.');
      }

      setIsModalOpen(false);
      setName('');
      setDescription('');
      setPrice('');
      loadServices();
    } catch (err: any) {
      toast.error('Error al crear: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const openEditModal = (srv: Service) => {
    setEditingServiceId(srv.id);
    setName(srv.name);
    setDescription(srv.description || '');
    setPrice(srv.price);
    setIsModalOpen(true);
  };

  const toggleStatus = async (id: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from('services')
        .update({ is_active: !currentStatus })
        .eq('id', id);
      if (error) throw error;
      toast.success(currentStatus ? 'Servicio desactivado' : 'Servicio activado');
      loadServices();
    } catch (err: any) {
      toast.error('Error al cambiar estado: ' + err.message);
    }
  };

  return (
    <div className="space-y-4">
      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        {loading ? (
          <SkeletonTable rows={5} columns={3} />
        ) : services.length === 0 ? (
          <div className="p-12 text-center text-slate-500">
            <PackageOpen className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="font-semibold text-slate-700">No hay servicios registrados</p>
            <p className="text-xs text-slate-400 mt-1">Crea tu primer servicio para poder usarlo en las matrículas.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                <tr>
                  <th className="px-6 py-3.5">Nombre del Servicio</th>
                  <th className="px-6 py-3.5">Descripción</th>
                  <th className="px-6 py-3.5">Precio Base</th>
                  <th className="px-6 py-3.5">Estado</th>
                  <th className="px-6 py-3.5 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {services.map((srv) => (
                  <tr key={srv.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-semibold text-slate-900 flex items-center gap-2">
                        <Tag className="w-4 h-4 text-indigo-400" />
                        {srv.name}
                      </div>
                    </td>
                    <td className="px-6 py-4">{srv.description || <span className="text-slate-400 italic">Sin descripción</span>}</td>
                    <td className="px-6 py-4 font-bold text-slate-900">${srv.price.toFixed(2)}</td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${
                        srv.is_active ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-slate-100 text-slate-500 border border-slate-200'
                      }`}>
                        {srv.is_active ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right flex justify-end gap-2">
                      <button
                        onClick={() => openEditModal(srv)}
                        className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-indigo-200 text-indigo-600 hover:bg-indigo-50 transition-colors"
                      >
                        Editar
                      </button>
                      <button
                        onClick={() => toggleStatus(srv.id, srv.is_active)}
                        className={`text-xs font-semibold px-3 py-1.5 rounded-lg border transition-colors ${
                          srv.is_active 
                            ? 'border-red-200 text-red-600 hover:bg-red-50'
                            : 'border-emerald-200 text-emerald-600 hover:bg-emerald-50'
                        }`}
                      >
                        {srv.is_active ? 'Desactivar' : 'Activar'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl p-6 w-full max-w-md">
            <div className="flex justify-between items-center mb-4 border-b border-slate-100 pb-3">
              <h3 className="text-lg font-bold text-slate-900">
                {editingServiceId ? 'Editar Servicio' : 'Nuevo Servicio'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Nombre del Servicio *</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="Ej. Guardería Día Completo / Terapia de Lenguaje / Tareas Dirigidas"
                  className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Descripción</label>
                <input
                  type="text"
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder="Ej. Cuidado de 08:00 a 17:00 con alimentación / Paquete de 4 sesiones mensuales"
                  className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Precio Base ($) *</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={price}
                  onChange={e => setPrice(Number(e.target.value))}
                  placeholder="150.00"
                  className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-sm font-semibold text-slate-600 hover:text-slate-900"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2 rounded-lg text-sm font-semibold disabled:opacity-50"
                >
                  {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                  {isSubmitting ? 'Guardando...' : editingServiceId ? 'Actualizar Servicio' : 'Crear Servicio'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
