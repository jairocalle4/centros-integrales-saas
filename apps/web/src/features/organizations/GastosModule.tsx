import { useEffect, useState, useCallback } from 'react';
import { Plus, Loader2, Search, Paperclip, Pencil, Ban, X, Wallet } from 'lucide-react';
import toast from 'react-hot-toast';
import { useOrg } from './OrgContext';
import { supabase } from '../../lib/supabase';
import { formatDate } from '../../lib/formatDate';
import { SkeletonTable } from '../../components/ui/Skeleton';

// Lista curada de sugerencias — texto libre en la base (columna
// `category`), no una tabla aparte. Genérica para guardería y centro
// integral por igual (docs/product/PRODUCT_VISION.md) — nada específico
// de un solo centro (regla 7 de la skill de dominio).
const EXPENSE_CATEGORIES = [
  'Nómina y Honorarios',
  'Arriendo',
  'Servicios Básicos',
  'Insumos y Materiales',
  'Mantenimiento',
  'Software y Licencias',
  'Marketing',
  'Impuestos y Tasas',
  'Seguros',
  'Transporte',
  'Capacitación',
  'Otro',
];

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  cash: 'Efectivo',
  transfer: 'Transferencia',
  card: 'Tarjeta',
  other: 'Otro',
};

const fmt = (n: number) =>
  new Intl.NumberFormat('es-EC', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }).format(n);

type ExpenseRow = {
  id: string;
  description: string;
  category: string;
  amount: number;
  expense_date: string;
  payment_method: string | null;
  vendor: string | null;
  notes: string | null;
  receipt_path: string | null;
  voided_at: string | null;
  voided_reason: string | null;
};

async function openReceipt(receiptPath: string) {
  const { data, error } = await supabase.storage.from('expense-receipts').createSignedUrl(receiptPath, 120);
  if (error || !data) {
    toast.error('No se pudo abrir el comprobante: ' + (error?.message || 'error desconocido'));
    return;
  }
  window.open(data.signedUrl, '_blank', 'noopener,noreferrer');
}

// ─── Alta / edición ──────────────────────────────────────────────────
function ExpenseFormModal({
  organizationId,
  expense,
  onClose,
  onSaved,
}: {
  organizationId: string;
  expense: ExpenseRow | null; // null = nuevo gasto
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = Boolean(expense);
  const [description, setDescription] = useState(expense?.description ?? '');
  const [category, setCategory] = useState(expense?.category ?? EXPENSE_CATEGORIES[0]);
  const [amount, setAmount] = useState<number | ''>(expense?.amount ?? '');
  const [expenseDate, setExpenseDate] = useState(expense?.expense_date ?? new Date().toISOString().split('T')[0]);
  const [paymentMethod, setPaymentMethod] = useState(expense?.payment_method ?? '');
  const [vendor, setVendor] = useState(expense?.vendor ?? '');
  const [notes, setNotes] = useState(expense?.notes ?? '');
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim()) { toast.error('La descripción es obligatoria.'); return; }
    if (!amount || Number(amount) <= 0) { toast.error('Ingresa un monto válido.'); return; }
    if (!expenseDate) { toast.error('La fecha es obligatoria.'); return; }

    setSubmitting(true);
    try {
      let receiptPath = expense?.receipt_path ?? null;
      if (receiptFile) {
        // Un archivo por gasto, sobrescribible — igual que el patrón ya
        // usado para RIDE/recibos (upload con upsert, path determinístico).
        const ext = receiptFile.name.split('.').pop() || 'jpg';
        const path = `${organizationId}/${expense?.id ?? crypto.randomUUID()}.${ext}`;
        const { error: uploadError } = await supabase.storage
          .from('expense-receipts')
          .upload(path, receiptFile, { upsert: true });
        if (uploadError) throw uploadError;
        receiptPath = path;
      }

      const payload = {
        organization_id: organizationId,
        description: description.trim(),
        category,
        amount: Number(amount),
        expense_date: expenseDate,
        payment_method: paymentMethod || null,
        vendor: vendor.trim() || null,
        notes: notes.trim() || null,
        receipt_path: receiptPath,
      };

      if (isEdit && expense) {
        const { error } = await supabase.from('expenses').update(payload).eq('id', expense.id);
        if (error) throw error;
        toast.success('Gasto actualizado.');
      } else {
        const { data: userData } = await supabase.auth.getUser();
        const { error } = await supabase.from('expenses').insert({ ...payload, created_by: userData.user?.id ?? null });
        if (error) throw error;
        toast.success('Gasto registrado.');
      }
      onSaved();
      onClose();
    } catch (err: any) {
      toast.error('Error guardando el gasto: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4 border-b border-slate-100 pb-3">
          <h3 className="text-lg font-bold text-slate-900">{isEdit ? 'Editar Gasto' : 'Nuevo Gasto'}</h3>
          <button onClick={onClose} disabled={submitting} className="text-slate-400 hover:text-slate-600 disabled:opacity-50 cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Descripción *</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Ej. Arriendo del local, septiembre"
              className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Categoría</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                {EXPENSE_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Monto (USD) *</label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value === '' ? '' : Number(e.target.value))}
                className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Fecha *</label>
              <input
                type="date"
                value={expenseDate}
                onChange={(e) => setExpenseDate(e.target.value)}
                max={new Date().toISOString().split('T')[0]}
                className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Método de Pago</label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">Sin especificar</option>
                <option value="cash">Efectivo</option>
                <option value="transfer">Transferencia</option>
                <option value="card">Tarjeta</option>
                <option value="other">Otro</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Proveedor / Pagado a</label>
            <input
              type="text"
              value={vendor}
              onChange={(e) => setVendor(e.target.value)}
              placeholder="Ej. Arrendador, EEQ, nombre del empleado..."
              className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Notas</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Comprobante (foto o PDF)</label>
            <input
              type="file"
              accept="image/*,application/pdf"
              onChange={(e) => setReceiptFile(e.target.files?.[0] ?? null)}
              className="w-full text-xs text-slate-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
            />
            {expense?.receipt_path && !receiptFile && (
              <p className="text-[11px] text-slate-400 mt-1">Ya tiene un comprobante — sube uno nuevo para reemplazarlo.</p>
            )}
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-4 py-2 text-sm font-semibold text-slate-600 hover:text-slate-900 transition-colors disabled:opacity-50 cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2 rounded-lg text-sm font-semibold shadow-sm transition-colors disabled:opacity-50 cursor-pointer"
            >
              {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
              {submitting ? 'Guardando...' : isEdit ? 'Guardar Cambios' : 'Registrar Gasto'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Anular ──────────────────────────────────────────────────────────
function VoidExpenseModal({ expense, onClose, onVoided }: { expense: ExpenseRow; onClose: () => void; onVoided: () => void }) {
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleVoid = async () => {
    setSubmitting(true);
    try {
      const { error } = await supabase
        .from('expenses')
        .update({ voided_at: new Date().toISOString(), voided_reason: reason.trim() || null })
        .eq('id', expense.id);
      if (error) throw error;
      toast.success('Gasto anulado.');
      onVoided();
      onClose();
    } catch (err: any) {
      toast.error('No se pudo anular: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xl p-6 w-full max-w-sm">
        <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2 mb-2">
          <Ban className="w-5 h-5 text-red-600" /> Anular Gasto
        </h3>
        <p className="text-sm text-slate-500 mb-4">
          "{expense.description}" — {fmt(Number(expense.amount))}. El gasto queda marcado como anulado, no se borra (conserva el historial).
        </p>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Motivo (opcional)"
          rows={2}
          className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-red-500 mb-4"
        />
        <div className="flex justify-end gap-3">
          <button onClick={onClose} disabled={submitting} className="px-4 py-2 text-sm font-semibold text-slate-600 hover:text-slate-900 disabled:opacity-50 cursor-pointer">
            Cancelar
          </button>
          <button
            onClick={handleVoid}
            disabled={submitting}
            className="inline-flex items-center gap-1.5 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm font-semibold shadow-sm transition-colors disabled:opacity-50 cursor-pointer"
          >
            {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
            {submitting ? 'Anulando...' : 'Anular Gasto'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Módulo principal ────────────────────────────────────────────────
export function GastosModule() {
  const { currentOrg, currentRole } = useOrg();
  // Ver es abierto a cualquier rol (igual que la RLS); registrar/editar/
  // anular queda para owner/admin/staff — professional no tiene control
  // financiero (docs/product/ROLES_PERMISSIONS.md), mismo criterio que
  // ya rige charges/internal_payments.
  const canManage = currentRole === 'owner' || currentRole === 'admin' || currentRole === 'staff';

  const [expenses, setExpenses] = useState<ExpenseRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [formTarget, setFormTarget] = useState<'new' | ExpenseRow | null>(null);
  const [voidTarget, setVoidTarget] = useState<ExpenseRow | null>(null);

  const loadExpenses = useCallback(async () => {
    if (!currentOrg) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('expenses')
        .select('id, description, category, amount, expense_date, payment_method, vendor, notes, receipt_path, voided_at, voided_reason')
        .eq('organization_id', currentOrg.id)
        .order('expense_date', { ascending: false });
      if (error) throw error;
      setExpenses((data as ExpenseRow[]) || []);
    } catch (err: any) {
      toast.error('Error cargando gastos: ' + err.message);
    } finally {
      setLoading(false);
    }
  }, [currentOrg]);

  useEffect(() => { loadExpenses(); }, [loadExpenses]);

  const filtered = expenses.filter((e) => {
    const matchesCategory = categoryFilter === 'all' || e.category === categoryFilter;
    const search = searchTerm.trim().toLowerCase();
    const matchesSearch = !search || e.description.toLowerCase().includes(search) || (e.vendor ?? '').toLowerCase().includes(search);
    const matchesFrom = !dateFrom || e.expense_date >= dateFrom;
    const matchesTo = !dateTo || e.expense_date <= dateTo;
    return matchesCategory && matchesSearch && matchesFrom && matchesTo;
  });

  const totalActive = filtered.filter((e) => !e.voided_at).reduce((sum, e) => sum + Number(e.amount), 0);

  return (
    <>
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Gastos</h1>
          <p className="text-sm text-slate-500 mt-0.5">Egresos registrados de {currentOrg?.name || 'tu centro'}.</p>
        </div>
        {canManage && (
          <button
            onClick={() => setFormTarget('new')}
            className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl text-sm font-semibold shadow-sm transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" /> Nuevo Gasto
          </button>
        )}
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 flex items-center gap-4">
        <div className="w-11 h-11 rounded-xl bg-red-50 text-red-600 flex items-center justify-center shrink-0">
          <Wallet className="w-5 h-5" />
        </div>
        <div>
          <p className="text-2xl font-bold text-slate-900 tracking-tight">{fmt(totalActive)}</p>
          <p className="text-xs text-slate-500">Total de gastos con los filtros aplicados</p>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row flex-wrap gap-3">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar por descripción o proveedor..."
            className="w-full bg-white border border-slate-300 rounded-lg pl-9 pr-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="all">Todas las categorías</option>
          {EXPENSE_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <div className="flex items-center gap-1.5">
          <label className="text-xs font-semibold text-slate-500">Desde</label>
          <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} max={dateTo || undefined}
            className="bg-white border border-slate-300 rounded-lg px-2.5 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
        </div>
        <div className="flex items-center gap-1.5">
          <label className="text-xs font-semibold text-slate-500">Hasta</label>
          <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} min={dateFrom || undefined}
            className="bg-white border border-slate-300 rounded-lg px-2.5 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
        </div>
        {(dateFrom || dateTo) && (
          <button type="button" onClick={() => { setDateFrom(''); setDateTo(''); }} className="text-xs font-semibold text-slate-500 hover:text-slate-800 px-2 cursor-pointer">
            Quitar fechas
          </button>
        )}
      </div>

      {loading ? (
        <SkeletonTable rows={6} columns={6} />
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border border-dashed border-slate-200">
          <Wallet className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="text-sm text-slate-500">
            {expenses.length === 0 ? 'Todavía no se ha registrado ningún gasto en este centro.' : 'Ningún gasto coincide con la búsqueda/filtro.'}
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left font-semibold text-slate-600 px-4 py-3">Fecha</th>
                <th className="text-left font-semibold text-slate-600 px-4 py-3">Descripción</th>
                <th className="text-left font-semibold text-slate-600 px-4 py-3">Categoría</th>
                <th className="text-left font-semibold text-slate-600 px-4 py-3">Proveedor</th>
                <th className="text-right font-semibold text-slate-600 px-4 py-3">Monto</th>
                <th className="text-right font-semibold text-slate-600 px-4 py-3">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((exp) => {
                const isVoided = Boolean(exp.voided_at);
                return (
                  <tr key={exp.id} className={`hover:bg-slate-50/50 ${isVoided ? 'opacity-50' : ''}`}>
                    <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{formatDate(exp.expense_date)}</td>
                    <td className={`px-4 py-3 text-slate-900 font-medium max-w-xs truncate ${isVoided ? 'line-through' : ''}`} title={exp.description}>
                      {exp.description}
                      {isVoided && <span className="ml-2 text-[10px] font-bold text-slate-400 uppercase">Anulado</span>}
                    </td>
                    <td className="px-4 py-3 text-slate-600">{exp.category}</td>
                    <td className="px-4 py-3 text-slate-500">{exp.vendor || '—'}</td>
                    <td className={`px-4 py-3 text-right font-semibold text-slate-900 ${isVoided ? 'line-through' : ''}`}>{fmt(Number(exp.amount))}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        {exp.receipt_path && (
                          <button onClick={() => openReceipt(exp.receipt_path!)} title="Ver comprobante"
                            className="text-slate-500 hover:text-indigo-700 hover:bg-indigo-50 p-1.5 rounded-lg transition-colors cursor-pointer">
                            <Paperclip className="w-4 h-4" />
                          </button>
                        )}
                        {canManage && !isVoided && (
                          <>
                            <button onClick={() => setFormTarget(exp)} title="Editar"
                              className="text-slate-500 hover:text-indigo-700 hover:bg-indigo-50 p-1.5 rounded-lg transition-colors cursor-pointer">
                              <Pencil className="w-4 h-4" />
                            </button>
                            <button onClick={() => setVoidTarget(exp)} title="Anular"
                              className="text-slate-500 hover:text-red-600 hover:bg-red-50 p-1.5 rounded-lg transition-colors cursor-pointer">
                              <Ban className="w-4 h-4" />
                            </button>
                          </>
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

    {formTarget && currentOrg && (
      <ExpenseFormModal
        organizationId={currentOrg.id}
        expense={formTarget === 'new' ? null : formTarget}
        onClose={() => setFormTarget(null)}
        onSaved={loadExpenses}
      />
    )}
    {voidTarget && (
      <VoidExpenseModal expense={voidTarget} onClose={() => setVoidTarget(null)} onVoided={loadExpenses} />
    )}
    </>
  );
}

export { EXPENSE_CATEGORIES, PAYMENT_METHOD_LABELS };
