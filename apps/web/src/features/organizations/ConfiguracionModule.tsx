import { useState, useEffect } from 'react';
import { useOrg } from './OrgContext';
import { useAuth } from '../auth/AuthProvider';
import { supabase } from '../../lib/supabase';
import toast from 'react-hot-toast';
import { ElectronicBillingSettings } from '../billing/ElectronicBillingSettings';
import { Building2, Save, MapPin, Phone, Mail, FileText, ShieldCheck, Loader2, KeyRound, Pencil, X, User as UserIcon } from 'lucide-react';

const PASSWORD_RULES = [
  { test: (v: string) => v.length >= 8, label: 'Al menos 8 caracteres' },
  { test: (v: string) => /[A-Z]/.test(v), label: 'Una letra mayúscula' },
  { test: (v: string) => /[a-z]/.test(v), label: 'Una letra minúscula' },
  { test: (v: string) => /[^A-Za-z0-9]/.test(v), label: 'Un símbolo o carácter especial' },
];

export function ConfiguracionModule() {
  const { currentOrg, refreshOrgs, hasElectronicBilling } = useOrg();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'general' | 'sri' | 'cuenta'>('general');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);
  const [isEditingPassword, setIsEditingPassword] = useState(false);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [firstNameDraft, setFirstNameDraft] = useState('');
  const [lastNameDraft, setLastNameDraft] = useState('');

  useEffect(() => {
    if (!user) return;
    setLoadingProfile(true);
    supabase
      .from('profiles')
      .select('first_name, last_name')
      .eq('id', user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setFirstName((data as any).first_name || '');
          setLastName((data as any).last_name || '');
        }
        setLoadingProfile(false);
      });
  }, [user]);

  const startEditingProfile = () => {
    setFirstNameDraft(firstName);
    setLastNameDraft(lastName);
    setIsEditingProfile(true);
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!firstNameDraft.trim() || !lastNameDraft.trim()) {
      toast.error('El nombre y el apellido no pueden estar vacíos.');
      return;
    }
    setSavingProfile(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ first_name: firstNameDraft.trim(), last_name: lastNameDraft.trim(), updated_at: new Date().toISOString() })
        .eq('id', user.id);
      if (error) throw error;
      setFirstName(firstNameDraft.trim());
      setLastName(lastNameDraft.trim());
      setIsEditingProfile(false);
      toast.success('Datos actualizados.');
    } catch (err: any) {
      toast.error('Error al guardar: ' + err.message);
    } finally {
      setSavingProfile(false);
    }
  };

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

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.email) return;

    const failedRule = PASSWORD_RULES.find((r) => !r.test(newPassword));
    if (failedRule) {
      toast.error('La nueva contraseña necesita: ' + failedRule.label.toLowerCase());
      return;
    }
    if (newPassword !== confirmNewPassword) {
      toast.error('Las contraseñas nuevas no coinciden.');
      return;
    }

    setChangingPassword(true);
    try {
      // Verifica la contraseña actual antes de cambiarla — sin esto,
      // cualquiera que encuentre una sesión abierta y sin cerrar podría
      // cambiarle la contraseña a otra persona sin saber la actual.
      const { error: verifyError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: currentPassword,
      });
      if (verifyError) {
        toast.error('La contraseña actual no es correcta.');
        return;
      }

      const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
      if (updateError) throw updateError;

      toast.success('Contraseña actualizada exitosamente.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmNewPassword('');
      setIsEditingPassword(false);
    } catch (err: any) {
      toast.error('Error al cambiar la contraseña: ' + err.message);
    } finally {
      setChangingPassword(false);
    }
  };

  const cancelChangePassword = () => {
    setCurrentPassword('');
    setNewPassword('');
    setConfirmNewPassword('');
    setIsEditingPassword(false);
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
        <button
          onClick={() => setActiveTab('cuenta')}
          className={`py-3.5 px-6 font-semibold text-sm border-b-2 transition-colors cursor-pointer flex items-center gap-2 ${
            activeTab === 'cuenta'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <KeyRound className="w-4 h-4" />
          Mi Cuenta
        </button>
      </div>

      {/* TAB 1: General Settings */}
      {activeTab === 'general' && (
        <div className="bg-white rounded-b-2xl rounded-tr-2xl border border-slate-200 p-6 sm:p-8 shadow-xs">
          <form onSubmit={handleSaveGeneral} className="space-y-6 max-w-5xl">
            <h3 className="text-sm font-bold text-slate-900">Información del Centro</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">

              {/* Nombre del Centro */}
              <div className="sm:col-span-2 xl:col-span-3">
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
              <div className="sm:col-span-2 xl:col-span-2">
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
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                {saving ? 'Guardando...' : 'Guardar Cambios'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* TAB 2: SRI Electronic Billing Settings */}
      {activeTab === 'sri' && (
        <div className="bg-white rounded-b-2xl rounded-tr-2xl border border-slate-200 p-6 sm:p-8 shadow-xs">
          <ElectronicBillingSettings orgId={currentOrg.id} hasElectronicBilling={hasElectronicBilling} />
        </div>
      )}

      {/* TAB 3: Cambiar Contraseña */}
      {activeTab === 'cuenta' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
          {/* Tarjeta: Mis Datos */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-7 shadow-xs">
            <div className="flex items-center justify-between gap-4 mb-6">
              <div className="flex items-center gap-4 min-w-0">
                <div className="w-14 h-14 rounded-full bg-gradient-to-br from-indigo-500 to-indigo-700 text-white flex items-center justify-center font-bold text-lg shadow-sm shrink-0">
                  {firstName || lastName
                    ? `${firstName[0] || ''}${lastName[0] || ''}`.toUpperCase()
                    : <UserIcon className="w-6 h-6" />}
                </div>
                <div className="min-w-0">
                  <h3 className="text-base font-bold text-slate-900 truncate">
                    {firstName || lastName ? `${firstName} ${lastName}` : 'Mis Datos'}
                  </h3>
                  <p className="text-xs text-slate-500 truncate">{user?.email}</p>
                </div>
              </div>
              {!isEditingProfile && !loadingProfile && (
                <button
                  onClick={startEditingProfile}
                  className="inline-flex items-center gap-1.5 text-sm font-semibold text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 px-3.5 py-2 rounded-lg transition-colors cursor-pointer shrink-0"
                >
                  <Pencil className="w-4 h-4" />
                  Editar
                </button>
              )}
            </div>

            {loadingProfile ? (
              <p className="text-sm text-slate-400">Cargando...</p>
            ) : isEditingProfile ? (
              <form onSubmit={handleSaveProfile} className="space-y-5 bg-slate-50 border border-slate-200 rounded-2xl p-5">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Nombre</label>
                    <input
                      type="text"
                      required
                      autoFocus
                      value={firstNameDraft}
                      onChange={(e) => setFirstNameDraft(e.target.value)}
                      className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-xl text-slate-900 text-sm font-semibold focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Apellido</label>
                    <input
                      type="text"
                      required
                      value={lastNameDraft}
                      onChange={(e) => setLastNameDraft(e.target.value)}
                      className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-xl text-slate-900 text-sm font-semibold focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    />
                  </div>
                </div>
                <div className="flex items-center gap-3 pt-1">
                  <button
                    type="submit"
                    disabled={savingProfile}
                    className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-lg text-sm font-semibold shadow-xs disabled:opacity-50 transition-colors"
                  >
                    {savingProfile ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    {savingProfile ? 'Guardando...' : 'Guardar'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsEditingProfile(false)}
                    disabled={savingProfile}
                    className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-600 hover:text-slate-900 px-3.5 py-2.5 rounded-lg transition-colors disabled:opacity-50 cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                    Cancelar
                  </button>
                </div>
              </form>
            ) : (
              <div className="bg-slate-50 border border-slate-200 rounded-2xl divide-y divide-slate-200">
                <div className="flex items-center justify-between gap-4 px-5 py-3.5">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Nombre completo</span>
                  <span className="text-sm font-semibold text-slate-900 truncate">{firstName} {lastName}</span>
                </div>
                <div className="flex items-center justify-between gap-4 px-5 py-3.5">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Correo electrónico</span>
                  <span className="text-sm font-semibold text-slate-900 truncate">{user?.email}</span>
                </div>
              </div>
            )}
          </div>

          {/* Tarjeta: Contraseña */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-7 shadow-xs">
            <div className="flex items-center justify-between gap-4 mb-6">
              <div className="flex items-center gap-4 min-w-0">
                <div className="w-14 h-14 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center shadow-sm shrink-0">
                  <KeyRound className="w-6 h-6" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-base font-bold text-slate-900">Contraseña</h3>
                  <p className="text-xs text-slate-500 truncate">Protege el acceso a tu cuenta</p>
                </div>
              </div>
              {!isEditingPassword && (
                <button
                  onClick={() => setIsEditingPassword(true)}
                  className="inline-flex items-center gap-1.5 text-sm font-semibold text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 px-3.5 py-2 rounded-lg transition-colors cursor-pointer shrink-0"
                >
                  <Pencil className="w-4 h-4" />
                  Cambiar
                </button>
              )}
            </div>

            {isEditingPassword ? (
              <form onSubmit={handleChangePassword} className="space-y-5 bg-slate-50 border border-slate-200 rounded-2xl p-5">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Contraseña actual</label>
                  <input
                    type="password"
                    required
                    autoFocus
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-xl text-slate-900 text-sm font-semibold focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Nueva contraseña</label>
                  <input
                    type="password"
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-xl text-slate-900 text-sm font-semibold focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                  <ul className="mt-2.5 grid grid-cols-2 gap-x-3 gap-y-0.5">
                    {PASSWORD_RULES.map((rule) => (
                      <li key={rule.label} className={`text-xs flex items-center gap-1.5 ${rule.test(newPassword) ? 'text-emerald-600' : 'text-slate-400'}`}>
                        <span>{rule.test(newPassword) ? '✓' : '·'}</span>
                        {rule.label}
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Confirmar nueva contraseña</label>
                  <input
                    type="password"
                    required
                    value={confirmNewPassword}
                    onChange={(e) => setConfirmNewPassword(e.target.value)}
                    className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-xl text-slate-900 text-sm font-semibold focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>
                <div className="flex items-center gap-3 pt-1">
                  <button
                    type="submit"
                    disabled={changingPassword}
                    className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-lg text-sm font-semibold shadow-xs disabled:opacity-50 transition-colors"
                  >
                    {changingPassword ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    {changingPassword ? 'Guardando...' : 'Guardar'}
                  </button>
                  <button
                    type="button"
                    onClick={cancelChangePassword}
                    disabled={changingPassword}
                    className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-600 hover:text-slate-900 px-3.5 py-2.5 rounded-lg transition-colors disabled:opacity-50 cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                    Cancelar
                  </button>
                </div>
              </form>
            ) : (
              <div className="bg-slate-50 border border-slate-200 rounded-2xl px-5 py-3.5 flex items-center justify-between gap-4">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Contraseña</span>
                <span className="text-sm font-semibold text-slate-900 tracking-widest">••••••••</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
