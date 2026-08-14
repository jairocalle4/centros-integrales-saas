import { useState, useEffect } from 'react';
import { useOrg } from './OrgContext';
import { supabase } from '../../lib/supabase';
import toast from 'react-hot-toast';
import { ElectronicBillingSettings } from '../billing/ElectronicBillingSettings';
import { Building2, Save, MapPin, Phone, Mail, FileText, ShieldCheck } from 'lucide-react';

export function ConfiguracionModule() {
  const { currentOrg, refreshOrgs } = useOrg();
  const [activeTab, setActiveTab] = useState<'general' | 'sri'>('general');

  const [name, setName] = useState('');
  const [ruc, setRuc] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('La Troncal');
  const [email, setEmail] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (currentOrg) {
      setName(currentOrg.name || '');
      setRuc(currentOrg.ruc || '');
      setPhone(currentOrg.phone || '');
      setAddress(currentOrg.address || '');
      setCity(currentOrg.city || 'La Troncal');
      setEmail(currentOrg.email || '');
    }
  }, [currentOrg]);

  const handleSaveGeneral = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentOrg) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from('organizations')
        .update({
          name: name.trim(),
          ruc: ruc.trim() || null,
          phone: phone.trim() || null,
          address: address.trim() || null,
          city: city.trim() || 'La Troncal',
          email: email.trim() || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', currentOrg.id);

      if (error) throw error;

      await refreshOrgs();
      toast.success('Configuración del centro actualizada exitosamente.');
    } catch (err: any) {
      console.error('Error guardando configuración:', err);
      toast.error('Error al guardar datos: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  if (!currentOrg) return null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 flex items-center gap-2.5">
            <Building2 className="w-7 h-7 text-indigo-600" />
            Configuración del Centro
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Administra los datos institucionales del centro integral y los parámetros para la facturación electrónica SRI.
          </p>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex border-b border-slate-200 bg-white px-4 rounded-t-xl border">
        <button
          onClick={() => setActiveTab('general')}
          className={`py-3.5 px-6 font-semibold text-sm border-b-2 transition-colors cursor-pointer flex items-center gap-2 ${
            activeTab === 'general'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <Building2 className="w-4 h-4" />
          Datos del Centro
        </button>
        <button
          onClick={() => setActiveTab('sri')}
          className={`py-3.5 px-6 font-semibold text-sm border-b-2 transition-colors cursor-pointer flex items-center gap-2 ${
            activeTab === 'sri'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <ShieldCheck className="w-4 h-4" />
          Facturación Electrónica SRI
        </button>
      </div>

      {/* TAB 1: General Settings */}
      {activeTab === 'general' && (
        <div className="bg-white rounded-b-2xl rounded-tr-2xl border border-slate-200 p-6 sm:p-8 shadow-xs">
          <form onSubmit={handleSaveGeneral} className="space-y-6 max-w-3xl">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              
              {/* Nombre del Centro */}
              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  Nombre Oficial del Centro Integral *
                </label>
                <div className="relative">
                  <Building2 className="w-5 h-5 text-slate-400 absolute left-3.5 top-3" />
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Ej. Centro Integral Creciendo Juntos"
                    className="w-full pl-11 pr-4 py-2.5 bg-white border border-slate-300 rounded-xl text-slate-900 text-sm font-semibold focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              {/* RUC */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  RUC Institucional (13 dígitos)
                </label>
                <div className="relative">
                  <FileText className="w-5 h-5 text-slate-400 absolute left-3.5 top-3" />
                  <input
                    type="text"
                    maxLength={13}
                    value={ruc}
                    onChange={(e) => setRuc(e.target.value.replace(/\D/g, ''))}
                    placeholder="Ej. 0955443882001"
                    className="w-full pl-11 pr-4 py-2.5 bg-white border border-slate-300 rounded-xl text-slate-900 text-sm font-medium focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              {/* Teléfono */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  Teléfono de Contacto / WhatsApp
                </label>
                <div className="relative">
                  <Phone className="w-5 h-5 text-slate-400 absolute left-3.5 top-3" />
                  <input
                    type="text"
                    maxLength={10}
                    value={phone}
                    onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
                    placeholder="Ej. 0995443882"
                    className="w-full pl-11 pr-4 py-2.5 bg-white border border-slate-300 rounded-xl text-slate-900 text-sm font-medium focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              {/* Ciudad / Cantón */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  Ciudad / Cantón de la Sede *
                </label>
                <div className="relative">
                  <MapPin className="w-5 h-5 text-slate-400 absolute left-3.5 top-3" />
                  <input
                    type="text"
                    required
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder="Ej. La Troncal, Guayaquil, Quito, etc."
                    className="w-full pl-11 pr-4 py-2.5 bg-white border border-slate-300 rounded-xl text-slate-900 text-sm font-semibold focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <p className="text-[11px] text-slate-400 mt-1">
                  Esta ciudad se imprimirá automáticamente en el Acta de Compromiso legal.
                </p>
              </div>

              {/* Correo Electrónico Institucional */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  Correo Electrónico del Centro
                </label>
                <div className="relative">
                  <Mail className="w-5 h-5 text-slate-400 absolute left-3.5 top-3" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="contacto@creciendojuntos.com"
                    className="w-full pl-11 pr-4 py-2.5 bg-white border border-slate-300 rounded-xl text-slate-900 text-sm font-medium focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              {/* Dirección Física */}
              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  Dirección Completa de la Sede
                </label>
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Ej. Av. Homero Castanier y 10 de Agosto, Frente al parque central"
                  className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-xl text-slate-900 text-sm font-medium focus:ring-2 focus:ring-indigo-500"
                />
              </div>

            </div>

            <div className="pt-4 flex items-center justify-end border-t border-slate-200">
              <button
                type="submit"
                disabled={saving}
                className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2.5 rounded-xl font-bold text-sm shadow-md transition-colors flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                {saving ? 'Guardando...' : 'Guardar Cambios'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* TAB 2: SRI Electronic Billing Settings */}
      {activeTab === 'sri' && (
        <div className="bg-white rounded-b-2xl rounded-tr-2xl border border-slate-200 p-6 sm:p-8 shadow-xs">
          <ElectronicBillingSettings orgId={currentOrg.id} />
        </div>
      )}
    </div>
  );
}
