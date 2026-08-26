import { useState, useEffect } from 'react';
import { Link } from 'react-router';
import { supabase } from '../../lib/supabase';
import { useOrg } from './OrgContext';
import { formatDate } from '../../lib/formatDate';
import { X, Search, Calendar, UserPlus } from 'lucide-react';

type Appointment = {
  id: string;
  patient_name: string;
  representative_name: string;
  phone: string | null;
  appointment_date: string;
  time_slot: string;
  therapy_type: string | null;
  deposit_amount: number;
  status: string;
  converted_beneficiary_id: string | null;
};

type Props = {
  isOpen: boolean;
  onClose: () => void;
};

const STATUS_LABEL: Record<string, { label: string; cls: string }> = {
  scheduled:  { label: 'Agendada',   cls: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
  confirmed:  { label: 'Confirmada', cls: 'bg-sky-50 text-sky-700 border-sky-200' },
  attended:   { label: 'Atendida',   cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  converted:  { label: 'Matriculada',cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  cancelled:  { label: 'Cancelada',  cls: 'bg-red-50 text-red-700 border-red-200' },
};

export function CitasHistorialModal({ isOpen, onClose }: Props) {
  const { currentOrg } = useOrg();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  useEffect(() => {
    if (isOpen && currentOrg) loadAppointments();
  }, [isOpen, currentOrg]);

  const loadAppointments = async () => {
    if (!currentOrg) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('appointments')
        .select('*')
        .eq('organization_id', currentOrg.id)
        .order('appointment_date', { ascending: false });
      if (error) throw error;
      setAppointments((data as any) || []);
    } catch (err) {
      console.error('Error cargando historial de citas:', err);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const filtered = appointments.filter(a => {
    const q = search.toLowerCase().trim();
    const matchesSearch = !q
      || a.patient_name.toLowerCase().includes(q)
      || a.representative_name.toLowerCase().includes(q);
    const matchesStatus = statusFilter === 'all' || a.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 overflow-y-auto animate-fadeIn">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-3xl my-8 overflow-hidden animate-popIn flex flex-col max-h-[85vh]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50 shrink-0">
          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-indigo-600" />
            <h3 className="text-lg font-bold text-slate-900">Historial de Citas / Evaluaciones</h3>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row gap-3 shrink-0">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por paciente o representante..."
              className="w-full text-sm pl-9 pr-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="all">Todos los estados</option>
            <option value="scheduled">Agendadas</option>
            <option value="confirmed">Confirmadas</option>
            <option value="attended">Atendidas</option>
            <option value="converted">Matriculadas</option>
            <option value="cancelled">Canceladas</option>
          </select>
        </div>

        <div className="overflow-y-auto overflow-x-auto flex-1">
          {loading ? (
            <div className="p-10 text-center text-slate-400 animate-pulse text-sm">Cargando historial...</div>
          ) : filtered.length === 0 ? (
            <div className="p-10 text-center text-slate-500 text-sm">No hay citas que coincidan con la búsqueda.</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-[11px] font-bold uppercase text-slate-500 tracking-wider sticky top-0">
                <tr>
                  <th className="px-4 py-2.5 text-left">Fecha</th>
                  <th className="px-4 py-2.5 text-left">Paciente</th>
                  <th className="px-4 py-2.5 text-left">Representante</th>
                  <th className="px-4 py-2.5 text-left">Terapia</th>
                  <th className="px-4 py-2.5 text-center">Depósito</th>
                  <th className="px-4 py-2.5 text-center">Estado</th>
                  <th className="px-4 py-2.5 text-center">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map(a => {
                  const st = STATUS_LABEL[a.status] || { label: a.status, cls: 'bg-slate-50 text-slate-600 border-slate-200' };
                  const canConvert = a.status !== 'converted' && a.status !== 'cancelled';
                  return (
                    <tr key={a.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 text-slate-700">
                        {formatDate(a.appointment_date)}
                        <div className="text-[11px] text-slate-400">{a.time_slot}</div>
                      </td>
                      <td className="px-4 py-3 font-semibold text-slate-900">{a.patient_name}</td>
                      <td className="px-4 py-3 text-slate-600">
                        {a.representative_name}
                        {a.phone && <div className="text-[11px] text-slate-400">{a.phone}</div>}
                      </td>
                      <td className="px-4 py-3 text-slate-600">{a.therapy_type || '—'}</td>
                      <td className="px-4 py-3 text-center font-mono text-slate-700">${a.deposit_amount.toFixed(2)}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold border ${st.cls}`}>{st.label}</span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        {a.converted_beneficiary_id ? (
                          <Link
                            to={`/app/beneficiarios/${a.converted_beneficiary_id}`}
                            onClick={onClose}
                            className="text-xs font-semibold text-indigo-600 hover:text-indigo-800"
                          >
                            Ver beneficiario
                          </Link>
                        ) : canConvert ? (
                          <Link
                            to={`/app/matricula?appointmentId=${a.id}&patientName=${encodeURIComponent(a.patient_name)}&repName=${encodeURIComponent(a.representative_name)}&phone=${encodeURIComponent(a.phone || '')}&depositAmount=${a.deposit_amount || 0}`}
                            onClick={onClose}
                            className="inline-flex items-center gap-1 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 px-2.5 py-1 rounded-lg"
                          >
                            <UserPlus className="w-3 h-3" />
                            Matricular
                          </Link>
                        ) : (
                          <span className="text-xs text-slate-400">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
