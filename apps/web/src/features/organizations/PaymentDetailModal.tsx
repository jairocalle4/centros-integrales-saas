import { X, Receipt, Plus, Calendar, DollarSign, CreditCard } from 'lucide-react';

export type Payment = {
  id: string;
  charge_id: string;
  amount: number;
  payment_date: string;
  method: string;
  reference: string | null;
};

type Props = {
  isOpen: boolean;
  onClose: () => void;
  charge: any; // Using any for simplicity or you can pass Charge type
  payments: Payment[];
  onPayRemaining: (charge: any) => void;
};

export function PaymentDetailModal({ isOpen, onClose, charge, payments, onPayRemaining }: Props) {
  if (!isOpen || !charge) return null;

  const totalPaid = payments.reduce((sum, p) => sum + Number(p.amount), 0);
  const remaining = Math.max(0, charge.amount - totalPaid);

  const getMethodLabel = (method: string) => {
    switch (method) {
      case 'cash': return 'Efectivo';
      case 'transfer': return 'Transferencia';
      case 'card': return 'Tarjeta';
      default: return method;
    }
  };

  const statusBadge = (status: string) => {
    if (status === 'pending')
      return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200">Pendiente</span>;
    if (status === 'partial')
      return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold text-blue-700 bg-blue-50 border border-blue-200">Parcial</span>;
    if (status === 'paid')
      return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200">Pagado</span>;
    if (status === 'void')
      return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold text-slate-700 bg-slate-100 border border-slate-200">Anulado</span>;
    return null;
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-600 flex items-center justify-center">
              <Receipt className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-900">Detalle del Cobro</h3>
              <p className="text-sm text-slate-500 flex items-center gap-2">
                {charge.description} {statusBadge(charge.status)}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:bg-slate-100 hover:text-slate-600 p-2 rounded-xl transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-6">
          
          {/* Summary Cards */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
              <p className="text-xs text-slate-500 font-medium mb-1">Monto Total</p>
              <p className="text-lg font-bold text-slate-900">${Number(charge.amount).toFixed(2)}</p>
            </div>
            <div className="bg-emerald-50 rounded-xl p-3 border border-emerald-100">
              <p className="text-xs text-emerald-600 font-medium mb-1">Pagado</p>
              <p className="text-lg font-bold text-emerald-700">${totalPaid.toFixed(2)}</p>
            </div>
            <div className={`rounded-xl p-3 border ${remaining > 0 ? 'bg-amber-50 border-amber-100' : 'bg-slate-50 border-slate-100'}`}>
              <p className={`text-xs font-medium mb-1 ${remaining > 0 ? 'text-amber-700' : 'text-slate-500'}`}>Saldo Pendiente</p>
              <p className={`text-lg font-bold ${remaining > 0 ? 'text-amber-700' : 'text-slate-900'}`}>${remaining.toFixed(2)}</p>
            </div>
          </div>

          {/* Payment History */}
          <div>
            <h4 className="text-sm font-semibold text-slate-900 mb-3">Historial de Pagos</h4>
            {payments.length === 0 ? (
              <div className="text-center py-6 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                <p className="text-sm text-slate-500">No hay pagos registrados para este cobro.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {payments.map((payment) => (
                  <div key={payment.id} className="flex items-center justify-between p-3 rounded-xl bg-white border border-slate-100 shadow-sm hover:border-slate-200 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center">
                        <DollarSign className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-slate-900">
                          Abono en {getMethodLabel(payment.method)}
                        </p>
                        <div className="flex items-center gap-2 text-xs text-slate-500">
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(payment.payment_date))}
                          </span>
                          {payment.reference && (
                            <span className="flex items-center gap-1">
                              <CreditCard className="w-3 h-3" /> Ref: {payment.reference}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <span className="font-semibold text-slate-900">
                      ${Number(payment.amount).toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
          <p className="text-xs text-slate-500">
            {charge.beneficiaries ? `Beneficiario: ${charge.beneficiaries.first_name} ${charge.beneficiaries.last_name}` : 'Cobro general'}
          </p>
          <div className="flex gap-2">
            {remaining > 0 && charge.status !== 'void' && (
              <button
                onClick={() => {
                  onClose();
                  onPayRemaining(charge);
                }}
                className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-xl hover:bg-indigo-700 shadow-sm transition-all cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                Registrar Pago
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
