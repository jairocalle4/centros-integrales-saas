import { useState, useEffect } from 'react';
import { useOrg } from './OrgContext';
import { supabase } from '../../lib/supabase';
import toast from 'react-hot-toast';
import {
  Plus,
  Search,
  DollarSign,
  CheckCircle,
  AlertCircle,
  Clock,
  X,
  Receipt,
  Eye,
} from 'lucide-react';

import { ServiciosList } from './ServiciosList';
import { PaymentDetailModal, type Payment } from './PaymentDetailModal';

type Charge = {
  id: string;
  organization_id: string;
  beneficiary_id: string | null;
  description: string;
  amount: number;
  due_date: string | null;
  status: 'pending' | 'partial' | 'paid' | 'void';
  period_label: string | null;
  notes: string | null;
  created_at: string;
  beneficiaries?: {
    first_name: string;
    last_name: string;
  } | null;
};

type Beneficiary = {
  id: string;
  first_name: string;
  last_name: string;
};

export function CobrosModule() {
  const { currentOrg } = useOrg();
  const [charges, setCharges] = useState<Charge[]>([]);
  const [beneficiaries, setBeneficiaries] = useState<Beneficiary[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [activeTab, setActiveTab] = useState<'cobros' | 'servicios'>('cobros');

  // Modal Crear Cargo
  const [isChargeModalOpen, setIsChargeModalOpen] = useState(false);
  const [selectedBenId, setSelectedBenId] = useState('');
  const [chargeDescription, setChargeDescription] = useState('');
  const [chargeAmount, setChargeAmount] = useState<number | ''>('');
  const [chargeDueDate, setChargeDueDate] = useState('');
  const [periodLabel, setPeriodLabel] = useState('');
  const [chargeNotes, setChargeNotes] = useState('');
  const [isSubmittingCharge, setIsSubmittingCharge] = useState(false);

  // Modal Registrar Pago
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [payingCharge, setPayingCharge] = useState<Charge | null>(null);
  const [paymentAmount, setPaymentAmount] = useState<number | ''>('');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
  const [paymentReference, setPaymentReference] = useState('');
  const [isSubmittingPayment, setIsSubmittingPayment] = useState(false);

  // Modal Servicio
  const [isServiceModalOpen, setIsServiceModalOpen] = useState(false);

  // Partial payments lookup
  const [paymentsMap, setPaymentsMap] = useState<Record<string, number>>({});
  const [internalPayments, setInternalPayments] = useState<Payment[]>([]);
  const [selectedChargeDetails, setSelectedChargeDetails] = useState<Charge | null>(null);

  useEffect(() => {
    if (currentOrg) {
      loadData();
    }
  }, [currentOrg]);

  const loadData = async () => {
    if (!currentOrg) return;
    setLoading(true);

    try {
      // Load charges
      const { data: chargesData, error: chargesError } = await supabase
        .from('charges')
        .select(`
          *,
          beneficiaries (
            first_name,
            last_name
          )
        `)
        .eq('organization_id', currentOrg.id)
        .order('created_at', { ascending: false });

      if (chargesError) throw chargesError;
      setCharges((chargesData as any as Charge[]) || []);

      // Load active beneficiaries
      const { data: bensData } = await supabase
        .from('beneficiaries')
        .select('id, first_name, last_name')
        .eq('organization_id', currentOrg.id)
        .eq('is_active', true)
        .order('last_name', { ascending: true });

      setBeneficiaries((bensData as Beneficiary[]) || []);

      // Load internal payments to sum paid amounts per charge
      const { data: pmtsData } = await supabase
        .from('internal_payments')
        .select('*')
        .eq('organization_id', currentOrg.id)
        .order('payment_date', { ascending: false });

      if (pmtsData) {
        setInternalPayments(pmtsData as Payment[]);
        const pMap: Record<string, number> = {};
        pmtsData.forEach((p: any) => {
          pMap[p.charge_id] = (pMap[p.charge_id] || 0) + Number(p.amount);
        });
        setPaymentsMap(pMap);
      }
    } catch (err: any) {
      toast.error('Error cargando datos: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateCharge = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentOrg || !chargeDescription.trim() || !chargeAmount) return;

    setIsSubmittingCharge(true);
    try {
      const { error } = await supabase.from('charges').insert({
        organization_id: currentOrg.id,
        beneficiary_id: selectedBenId || null,
        description: chargeDescription.trim(),
        amount: Number(chargeAmount),
        due_date: chargeDueDate || null,
        period_label: periodLabel.trim() || null,
        notes: chargeNotes.trim() || null,
        status: 'pending',
      });

      if (error) throw error;
      toast.success('Cargo creado exitosamente.');
      setIsChargeModalOpen(false);
      resetChargeForm();
      loadData();
    } catch (err: any) {
      toast.error('Error creando cargo: ' + err.message);
    } finally {
      setIsSubmittingCharge(false);
    }
  };

  const handleRegisterPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentOrg || !payingCharge || !paymentAmount) return;

    setIsSubmittingPayment(true);
    try {
      const { error } = await supabase.from('internal_payments').insert({
        organization_id: currentOrg.id,
        charge_id: payingCharge.id,
        amount: Number(paymentAmount),
        payment_date: paymentDate,
        method: paymentMethod,
        reference: paymentReference.trim() || null,
      });

      if (error) throw error;
      toast.success('Pago registrado correctamente.');
      setIsPaymentModalOpen(false);
      setPayingCharge(null);
      loadData();
    } catch (err: any) {
      toast.error('Error registrando pago: ' + err.message);
    } finally {
      setIsSubmittingPayment(false);
    }
  };

  const handleVoidCharge = async (chargeId: string) => {
    try {
      const { error } = await supabase
        .from('charges')
        .update({ status: 'void' })
        .eq('id', chargeId);

      if (error) throw error;
      toast.success('Cargo anulado.');
      loadData();
    } catch (err: any) {
      toast.error('Error al anular cargo: ' + err.message);
    }
  };

  const resetChargeForm = () => {
    setSelectedBenId('');
    setChargeDescription('');
    setChargeAmount('');
    setChargeDueDate('');
    setPeriodLabel('');
    setChargeNotes('');
  };

  const openPaymentModal = (charge: Charge) => {
    setPayingCharge(charge);
    const paidSoFar = paymentsMap[charge.id] || 0;
    const remaining = Math.max(0, charge.amount - paidSoFar);
    setPaymentAmount(remaining);
    setPaymentMethod('cash');
    setPaymentDate(new Date().toISOString().split('T')[0]);
    setPaymentReference('');
    setIsPaymentModalOpen(true);
  };

  const filteredCharges = charges.filter((c) => {
    const benName = c.beneficiaries
      ? `${c.beneficiaries.first_name} ${c.beneficiaries.last_name}`.toLowerCase()
      : '';
    const desc = c.description.toLowerCase();
    const search = searchTerm.toLowerCase();
    const matchesSearch = benName.includes(search) || desc.includes(search);
    const matchesStatus = statusFilter === 'all' || c.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  // Calculate totals
  const totalPending = charges
    .filter((c) => c.status === 'pending' || c.status === 'partial')
    .reduce((acc, c) => {
      const paid = paymentsMap[c.id] || 0;
      return acc + (c.amount - paid);
    }, 0);

  const totalCollected = Object.values(paymentsMap).reduce((acc, val) => acc + val, 0);

  const statusBadge = (status: string) => {
    if (status === 'pending')
      return (
        <span className="inline-flex items-center gap-1 text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-0.5 rounded-full text-xs font-semibold">
          <Clock className="w-3 h-3" /> Pendiente
        </span>
      );
    if (status === 'partial')
      return (
        <span className="inline-flex items-center gap-1 text-indigo-700 bg-indigo-50 border border-indigo-200 px-2.5 py-0.5 rounded-full text-xs font-semibold">
          <Clock className="w-3 h-3" /> Parcial
        </span>
      );
    if (status === 'paid')
      return (
        <span className="inline-flex items-center gap-1 text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full text-xs font-semibold">
          <CheckCircle className="w-3 h-3" /> Pagado
        </span>
      );
    return (
      <span className="inline-flex items-center gap-1 text-red-700 bg-red-50 border border-red-200 px-2.5 py-0.5 rounded-full text-xs font-semibold">
        <X className="w-3 h-3" /> Anulado
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Cobros y Servicios</h1>
          <p className="text-sm text-slate-500 mt-1">
            Gestiona la facturación, registro de pagos y el catálogo de servicios.
          </p>
        </div>
        {activeTab === 'cobros' ? (
          <button
            onClick={() => {
              resetChargeForm();
              setIsChargeModalOpen(true);
            }}
            className="inline-flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-lg text-sm font-semibold shadow-sm transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Nuevo Cargo
          </button>
        ) : (
          <button
            onClick={() => setIsServiceModalOpen(true)}
            className="inline-flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-lg text-sm font-semibold shadow-sm transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Nuevo Servicio
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 gap-6">
        <button
          onClick={() => setActiveTab('cobros')}
          className={`py-3 text-sm font-semibold border-b-2 transition-colors cursor-pointer ${
            activeTab === 'cobros'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
          }`}
        >
          Cargos y Pagos
        </button>
        <button
          onClick={() => setActiveTab('servicios')}
          className={`py-3 text-sm font-semibold border-b-2 transition-colors cursor-pointer ${
            activeTab === 'servicios'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
          }`}
        >
          Catálogo de Servicios
        </button>
      </div>

      {activeTab === 'cobros' && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
          {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
            <AlertCircle className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total por Cobrar</p>
            <p className="text-2xl font-bold text-slate-900">${totalPending.toFixed(2)} USD</p>
          </div>
        </div>
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
            <DollarSign className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Cobrado (Histórico)</p>
            <p className="text-2xl font-bold text-slate-900">${totalCollected.toFixed(2)} USD</p>
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col sm:flex-row justify-between items-center gap-4">
        <div className="relative w-full sm:w-80">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar por beneficiario o concepto..."
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all"
          />
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
        </div>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="w-full sm:w-auto bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="all">Todos los estados</option>
          <option value="pending">Pendientes</option>
          <option value="partial">Parciales</option>
          <option value="paid">Pagados</option>
          <option value="void">Anulados</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-slate-400 animate-pulse">Cargando cobros...</div>
        ) : filteredCharges.length === 0 ? (
          <div className="p-12 text-center text-slate-500">
            <Receipt className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="font-semibold text-slate-700">No hay cargos registrados</p>
            <p className="text-xs text-slate-400 mt-1">Crea un nuevo cargo para registrar pensiones o servicios.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                <tr>
                  <th className="px-6 py-3.5">Beneficiario</th>
                  <th className="px-6 py-3.5">Concepto</th>
                  <th className="px-6 py-3.5">Monto Total</th>
                  <th className="px-6 py-3.5">Saldo Pendiente</th>
                  <th className="px-6 py-3.5">Estado</th>
                  <th className="px-6 py-3.5 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredCharges.map((charge) => {
                  const paidSoFar = paymentsMap[charge.id] || 0;
                  const remaining = Math.max(0, charge.amount - paidSoFar);

                  return (
                    <tr key={charge.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="font-semibold text-slate-900">
                          {charge.beneficiaries
                            ? `${charge.beneficiaries.first_name} ${charge.beneficiaries.last_name}`
                            : 'Cobro General'}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-medium text-slate-800">{charge.description}</div>
                        {charge.period_label && (
                          <div className="text-xs text-slate-400">{charge.period_label}</div>
                        )}
                      </td>
                      <td className="px-6 py-4 font-bold text-slate-900">${charge.amount.toFixed(2)}</td>
                      <td className="px-6 py-4 font-semibold text-amber-700">
                        ${remaining.toFixed(2)}
                      </td>
                      <td className="px-6 py-4">{statusBadge(charge.status)}</td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex justify-end gap-2">
                          {(charge.status === 'pending' || charge.status === 'partial') && (
                            <button
                              onClick={() => openPaymentModal(charge)}
                              className="bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors"
                            >
                              Registrar Pago
                            </button>
                          )}
                          {charge.status !== 'void' && charge.status !== 'paid' && (
                            <button
                              onClick={() => handleVoidCharge(charge.id)}
                              className="text-slate-400 hover:text-red-600 px-2 py-1.5 rounded-lg hover:bg-slate-100 text-xs transition-colors"
                              title="Anular cargo"
                            >
                              Anular
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
      </div>
      )}

      {activeTab === 'servicios' && (
        <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
          <ServiciosList isModalOpen={isServiceModalOpen} setIsModalOpen={setIsServiceModalOpen} />
        </div>
      )}

      {/* Modal Crear Cargo */}
      {isChargeModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl p-6 w-full max-w-md">
            <div className="flex justify-between items-center mb-4 border-b border-slate-100 pb-3">
              <h3 className="text-lg font-bold text-slate-900">Nuevo Cargo</h3>
              <button onClick={() => setIsChargeModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateCharge} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Beneficiario</label>
                <select
                  value={selectedBenId}
                  onChange={(e) => setSelectedBenId(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">Selecciona beneficiario (opcional)</option>
                  {beneficiaries.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.first_name} {b.last_name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Concepto / Descripción *</label>
                <input
                  type="text"
                  value={chargeDescription}
                  onChange={(e) => setChargeDescription(e.target.value)}
                  required
                  placeholder="Ej. Mensualidad Guardería Agosto 2026 / Paquete Tareas Dirigidas"
                  className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Monto (USD) *</label>
                  <input
                    type="number"
                    step="0.01"
                    value={chargeAmount}
                    onChange={(e) => setChargeAmount(Number(e.target.value))}
                    required
                    placeholder="150.00"
                    className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Vencimiento</label>
                  <input
                    type="date"
                    value={chargeDueDate}
                    onChange={(e) => setChargeDueDate(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Etiqueta de Periodo</label>
                <input
                  type="text"
                  value={periodLabel}
                  onChange={(e) => setPeriodLabel(e.target.value)}
                  placeholder="Ej. Agosto 2026"
                  className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsChargeModalOpen(false)}
                  className="px-4 py-2 text-sm font-semibold text-slate-600 hover:text-slate-900 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingCharge}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2 rounded-lg text-sm font-semibold shadow-sm transition-colors disabled:opacity-50"
                >
                  {isSubmittingCharge ? 'Creando...' : 'Crear Cargo'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Registrar Pago */}
      {isPaymentModalOpen && payingCharge && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl p-6 w-full max-w-md">
            <div className="flex justify-between items-center mb-4 border-b border-slate-100 pb-3">
              <h3 className="text-lg font-bold text-slate-900">Registrar Pago Interno</h3>
              <button onClick={() => setIsPaymentModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mb-4 bg-slate-50 p-3 rounded-lg border border-slate-200">
              <p className="text-xs text-slate-500 font-semibold uppercase">Concepto</p>
              <p className="text-sm font-bold text-slate-900">{payingCharge.description}</p>
              <div className="flex justify-between mt-2 text-xs">
                <span className="text-slate-500">Monto total: ${payingCharge.amount.toFixed(2)}</span>
                <span className="text-amber-700 font-semibold">
                  Pendiente: ${(payingCharge.amount - (paymentsMap[payingCharge.id] || 0)).toFixed(2)}
                </span>
              </div>
            </div>

            <form onSubmit={handleRegisterPayment} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Monto a Pagar (USD) *</label>
                <input
                  type="number"
                  step="0.01"
                  max={payingCharge.amount - (paymentsMap[payingCharge.id] || 0)}
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(Number(e.target.value))}
                  required
                  className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Método de Pago</label>
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="cash">Efectivo</option>
                    <option value="transfer">Transferencia</option>
                    <option value="card">Tarjeta</option>
                    <option value="other">Otro</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Fecha de Pago</label>
                  <input
                    type="date"
                    value={paymentDate}
                    onChange={(e) => setPaymentDate(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Referencia / Comprobante</label>
                <input
                  type="text"
                  value={paymentReference}
                  onChange={(e) => setPaymentReference(e.target.value)}
                  placeholder="Ej. Transf #12345"
                  className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsPaymentModalOpen(false)}
                  className="px-4 py-2 text-sm font-semibold text-slate-600 hover:text-slate-900 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingPayment}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2 rounded-lg text-sm font-semibold shadow-sm transition-colors disabled:opacity-50"
                >
                  {isSubmittingPayment ? 'Registrando...' : 'Confirmar Pago'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* PAYMENT DETAIL MODAL */}
      <PaymentDetailModal
        isOpen={!!selectedChargeDetails}
        onClose={() => setSelectedChargeDetails(null)}
        charge={selectedChargeDetails}
        payments={selectedChargeDetails ? internalPayments.filter(p => p.charge_id === selectedChargeDetails.id) : []}
        onPayRemaining={openPaymentModal}
      />
    </div>
  );
}
