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
import { PaymentDetailModal, RegisterPaymentModal, type Payment } from './PaymentDetailModal';
import { SkeletonTable } from '../../components/ui/Skeleton';

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

// "Pendiente" y "Parcial" son el mismo concepto visto desde el cargo: algo
// todavía se debe. La distinción solo importa a nivel de pago individual
// (cuánto de ese cargo ya se cubrió), no como dos estados separados de
// filtro/badge — por eso se muestran y filtran juntos aquí.
function isPendingLike(status: string): boolean {
  return status === 'pending' || status === 'partial';
}

export function CobrosModule() {
  const { currentOrg, hasElectronicBilling, hasSriCertificate } = useOrg();
  const canEmitInvoices = hasElectronicBilling && hasSriCertificate;
  const [charges, setCharges] = useState<Charge[]>([]);
  const [beneficiaries, setBeneficiaries] = useState<Beneficiary[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [beneficiaryFilter, setBeneficiaryFilter] = useState<string>('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [activeTab, setActiveTab] = useState<'cobros' | 'servicios'>('cobros');

  // Modal Registrar Pago
  const [payingCharge, setPayingCharge] = useState<Charge | null>(null);

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
        .select('*, sri_documents ( status, pdf_url, cliente_email, email_sent_at, clave_acceso, total )')
        .eq('organization_id', currentOrg.id)
        .order('payment_date', { ascending: false });

      if (pmtsData) {
        setInternalPayments(pmtsData as Payment[]);
        const pMap: Record<string, number> = {};
        pmtsData.forEach((p: any) => {
          if (p.voided_at) return; // pago anulado — no cuenta para el saldo
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

  const openPaymentModal = (charge: Charge) => {
    setPayingCharge(charge);
  };

  const filteredCharges = charges.filter((c) => {
    const benName = c.beneficiaries
      ? `${c.beneficiaries.first_name} ${c.beneficiaries.last_name}`.toLowerCase()
      : '';
    const desc = c.description.toLowerCase();
    const search = searchTerm.toLowerCase();
    const matchesSearch = benName.includes(search) || desc.includes(search);
    const matchesStatus =
      statusFilter === 'all' || (statusFilter === 'pending' ? isPendingLike(c.status) : c.status === statusFilter);
    const matchesBeneficiary = beneficiaryFilter === 'all' || c.beneficiary_id === beneficiaryFilter;
    const chargeDate = c.created_at.slice(0, 10);
    const matchesFrom = !dateFrom || chargeDate >= dateFrom;
    const matchesTo = !dateTo || chargeDate <= dateTo;
    return matchesSearch && matchesStatus && matchesBeneficiary && matchesFrom && matchesTo;
  });

  // Calculate totals
  const totalPending = charges
    .filter((c) => isPendingLike(c.status))
    .reduce((acc, c) => {
      const paid = paymentsMap[c.id] || 0;
      return acc + (c.amount - paid);
    }, 0);

  const totalCollected = Object.values(paymentsMap).reduce((acc, val) => acc + val, 0);

  const statusBadge = (status: string) => {
    if (isPendingLike(status))
      return (
        <span className="inline-flex items-center gap-1 text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-0.5 rounded-full text-xs font-semibold">
          <Clock className="w-3 h-3" /> Pendiente
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
        {activeTab === 'servicios' && (
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
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col sm:flex-row flex-wrap justify-between items-center gap-3">
        <div className="relative w-full sm:w-64">
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
          value={beneficiaryFilter}
          onChange={(e) => setBeneficiaryFilter(e.target.value)}
          className="w-full sm:w-auto bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="all">Todos los beneficiarios</option>
          {beneficiaries.map((b) => (
            <option key={b.id} value={b.id}>{b.first_name} {b.last_name}</option>
          ))}
        </select>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="w-full sm:w-auto bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="all">Todos los estados</option>
          <option value="pending">Pendientes</option>
          <option value="paid">Pagados</option>
          <option value="void">Anulados</option>
        </select>

        <div className="flex items-center gap-1.5">
          <label className="text-xs font-semibold text-slate-500">Desde</label>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            max={dateTo || undefined}
            className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        <div className="flex items-center gap-1.5">
          <label className="text-xs font-semibold text-slate-500">Hasta</label>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            min={dateFrom || undefined}
            className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        {(dateFrom || dateTo) && (
          <button
            type="button"
            onClick={() => { setDateFrom(''); setDateTo(''); }}
            className="text-xs font-semibold text-slate-500 hover:text-slate-800"
          >
            Quitar fechas
          </button>
        )}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        {loading ? (
          <SkeletonTable rows={6} columns={6} />
        ) : filteredCharges.length === 0 ? (
          <div className="p-12 text-center text-slate-500">
            <Receipt className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="font-semibold text-slate-700">No hay cargos que coincidan</p>
            <p className="text-xs text-slate-400 mt-1">Los cargos se generan automáticamente desde Matrícula.</p>
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
                          <button
                            onClick={() => setSelectedChargeDetails(charge)}
                            className="text-slate-500 hover:text-indigo-700 hover:bg-indigo-50 p-1.5 rounded-lg transition-colors"
                            title="Ver detalle e historial de pagos"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          {(charge.status === 'pending' || charge.status === 'partial') && (
                            <button
                              onClick={() => openPaymentModal(charge)}
                              className="bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors"
                            >
                              Registrar Pago
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

      {/* Modal Registrar Pago */}
      {payingCharge && (
        <RegisterPaymentModal
          charge={payingCharge}
          paidSoFar={paymentsMap[payingCharge.id] || 0}
          onClose={() => setPayingCharge(null)}
          onSuccess={loadData}
          hasElectronicBilling={canEmitInvoices}
          beneficiaryId={payingCharge.beneficiary_id || undefined}
        />
      )}

      {/* PAYMENT DETAIL MODAL */}
      {currentOrg && (
        <PaymentDetailModal
          isOpen={!!selectedChargeDetails}
          onClose={() => setSelectedChargeDetails(null)}
          charge={selectedChargeDetails}
          payments={selectedChargeDetails ? internalPayments.filter(p => p.charge_id === selectedChargeDetails.id) : []}
          onPayRemaining={openPaymentModal}
          onInvoiceChanged={loadData}
          organization={currentOrg}
          beneficiaryId={selectedChargeDetails?.beneficiary_id || ''}
          beneficiaryName={
            selectedChargeDetails?.beneficiaries
              ? `${selectedChargeDetails.beneficiaries.first_name} ${selectedChargeDetails.beneficiaries.last_name}`
              : 'Cobro general'
          }
        />
      )}
    </div>
  );
}
