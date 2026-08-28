import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { ShieldCheck, Upload, FileKey2, Lock, Eye, EyeOff, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      // reader.result is a data: URL ("data:application/x-pkcs12;base64,XXXX") — strip the prefix.
      const result = reader.result as string;
      resolve(result.substring(result.indexOf(',') + 1));
    };
    reader.onerror = () => reject(reader.error ?? new Error('Error leyendo el archivo.'));
    reader.readAsDataURL(file);
  });
}

export function ElectronicBillingSettings({ orgId, hasElectronicBilling }: { orgId: string; hasElectronicBilling: boolean }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  const [config, setConfig] = useState({
    environment: 'pruebas' as 'pruebas' | 'produccion',
    establecimiento: '001',
    punto_emision: '001',
    regimen_fiscal: 'rimpe_negocio_popular' as 'rimpe_negocio_popular' | 'rimpe_emprendedor' | 'general',
    cert_password_hash: ''
  });
  const [certUploaded, setCertUploaded] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    fetchConfig();
  }, [orgId]);

  const fetchConfig = async () => {
    try {
      const { data } = await supabase
        .from('sri_configurations')
        .select('*')
        .eq('organization_id', orgId)
        .maybeSingle();

      if (data) {
        setConfig({
          environment: (data.environment as 'pruebas' | 'produccion') || 'pruebas',
          establecimiento: data.establecimiento,
          punto_emision: data.punto_emision,
          regimen_fiscal: (data.regimen_fiscal as 'rimpe_negocio_popular' | 'rimpe_emprendedor' | 'general') || 'rimpe_negocio_popular',
          cert_password_hash: '' // No cargar la contraseña por seguridad
        });
        setCertUploaded(Boolean(data.cert_uploaded_at));
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();

    if (selectedFile && !config.cert_password_hash) {
      toast.error('Ingresa la contraseña del certificado para poder subirlo.');
      return;
    }

    setSaving(true);
    try {
      if (selectedFile) {
        // Uploading/replacing the certificate needs real symmetric
        // encryption — only the .NET service (which holds
        // MASTER_ENCRYPTION_KEY) ever touches the raw file, via the Edge
        // Function acting as a verifying proxy.
        const p12Base64 = await fileToBase64(selectedFile);
        const { data, error } = await supabase.functions.invoke('electronic-billing', {
          body: {
            action: 'upload_certificate',
            organization_id: orgId,
            environment: config.environment,
            establecimiento: config.establecimiento,
            punto_emision: config.punto_emision,
            regimen_fiscal: config.regimen_fiscal,
            p12_base64: p12Base64,
            p12_password: config.cert_password_hash,
          },
        });
        if (error || (data as any)?.error) {
          // supabase.functions.invoke() only fills `data` on a 2xx response —
          // on a non-2xx response `error.message` is a generic "Edge Function
          // returned a non-2xx status code" and the real { error: "..." } body
          // has to be read from error.context instead.
          let errorMsg = (data as any)?.error || error?.message || 'Error desconocido.';
          if (error?.context && typeof error.context === 'object') {
            try {
              const body = await (error.context as any).text();
              const parsed = JSON.parse(body);
              errorMsg = parsed.error || body;
            } catch { /* keep errorMsg as-is if the body isn't JSON */ }
          }
          throw new Error(errorMsg);
        }
        toast.success('Firma electrónica subida y cifrada correctamente.');
      } else {
        // No new file — just persist ambiente/establecimiento/punto de
        // emisión, leaving any already-uploaded certificate untouched.
        const { error } = await supabase
          .from('sri_configurations')
          .upsert(
            { organization_id: orgId, environment: config.environment, establecimiento: config.establecimiento, punto_emision: config.punto_emision, regimen_fiscal: config.regimen_fiscal },
            { onConflict: 'organization_id' }
          );
        if (error) throw error;
        toast.success('Configuración guardada.');
      }

      setSelectedFile(null);
      setConfig(c => ({ ...c, cert_password_hash: '' }));
      await fetchConfig();
    } catch (err: any) {
      toast.error('Error al guardar: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 p-4 text-sm text-slate-500">
        <Loader2 className="w-4 h-4 animate-spin" />
        Cargando configuración SRI...
      </div>
    );
  }

  if (!hasElectronicBilling) {
    return (
      <div className="bg-white p-8 rounded-xl border border-slate-200 shadow-sm text-center">
        <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mx-auto mb-4">
          <Lock className="w-6 h-6" />
        </div>
        <h2 className="text-lg font-bold text-slate-900">Facturación electrónica no incluida en tu plan</h2>
        <p className="text-sm text-slate-500 mt-2 max-w-md mx-auto">
          Este centro no tiene habilitado el módulo de facturación electrónica SRI en su plan de suscripción actual.
          Contacta al equipo de NexoKids para actualizar tu plan.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-11 h-11 rounded-xl bg-indigo-100 flex items-center justify-center text-indigo-600 shrink-0">
          <ShieldCheck className="w-5 h-5" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-slate-900">Configuración SRI (Facturación Electrónica)</h2>
          <p className="text-sm text-slate-500">Gestiona los parámetros para emitir comprobantes autorizados.</p>
        </div>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {/*
          TEMPORAL — mientras se hacen las pruebas reales con el SRI, el
          centro también puede fijar su ambiente aquí (además del panel de
          superadmin). Cuando las pruebas queden validadas, comentar/quitar
          este bloque y dejar el control únicamente en superadmin — ver
          PlatformOrganizationDetail.tsx.
        */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
          <h3 className="text-sm font-bold text-slate-900 mb-4">Ambiente y Numeración</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5">
            <div className="md:col-span-2 xl:col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1">Ambiente</label>
              <select
                value={config.environment}
                onChange={e => setConfig({ ...config, environment: e.target.value as 'pruebas' | 'produccion' })}
                className="w-full bg-white border border-slate-300 rounded-lg px-4 py-2.5 text-sm text-slate-900 focus:ring-2 focus:ring-indigo-500"
              >
                <option value="pruebas">Pruebas (celcer.sri.gob.ec)</option>
                <option value="produccion">Producción (cel.sri.gob.ec)</option>
              </select>
              <p className="text-xs text-slate-400 mt-1">
                Déjalo en "Pruebas" hasta que tus facturas de prueba queden autorizadas por el SRI.
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Establecimiento</label>
              <input
                type="text"
                maxLength={3}
                value={config.establecimiento}
                onChange={e => setConfig({ ...config, establecimiento: e.target.value })}
                className="w-full bg-white border border-slate-300 rounded-lg px-4 py-2.5 text-sm text-slate-900 focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Pto. Emisión</label>
              <input
                type="text"
                maxLength={3}
                value={config.punto_emision}
                onChange={e => setConfig({ ...config, punto_emision: e.target.value })}
                className="w-full bg-white border border-slate-300 rounded-lg px-4 py-2.5 text-sm text-slate-900 focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div className="md:col-span-2 xl:col-span-4">
              <label className="block text-sm font-medium text-slate-700 mb-1">Régimen Tributario</label>
              <select
                value={config.regimen_fiscal}
                onChange={e => setConfig({ ...config, regimen_fiscal: e.target.value as 'rimpe_negocio_popular' | 'rimpe_emprendedor' | 'general' })}
                className="w-full max-w-md bg-white border border-slate-300 rounded-lg px-4 py-2.5 text-sm text-slate-900 focus:ring-2 focus:ring-indigo-500"
              >
                <option value="rimpe_negocio_popular">RIMPE Negocio Popular (0% IVA)</option>
                <option value="rimpe_emprendedor">RIMPE Emprendedor (con IVA)</option>
                <option value="general">Régimen General (con IVA)</option>
              </select>
              <p className="text-xs text-slate-400 mt-1">
                Verifica tu régimen real en el portal del SRI antes de cambiar esta opción — determina si tus facturas cobran IVA o no.
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <FileKey2 className="w-4 h-4 text-slate-500" />
              Firma Electrónica (.p12)
            </h3>
            <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${
              certUploaded ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-700 border-amber-200'
            }`}>
              {certUploaded ? 'Firma subida' : 'Sin firma subida'}
            </span>
          </div>
          <p className="text-xs text-slate-500 mb-4">
            Debes subir la firma electrónica antes de poder emitir facturas — sin esto, los botones de facturar no aparecerán al registrar pagos.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Archivo de Certificado</label>
              <div className="flex items-center gap-2">
                <input
                  type="file"
                  accept=".p12"
                  onChange={e => setSelectedFile(e.target.files?.[0] || null)}
                  className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 border border-slate-200 rounded-lg"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Contraseña del Certificado</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder={selectedFile ? 'Requerida para subir el archivo' : 'Selecciona un archivo primero'}
                  disabled={!selectedFile}
                  value={config.cert_password_hash}
                  onChange={e => setConfig({ ...config, cert_password_hash: e.target.value })}
                  className="w-full bg-white border border-slate-300 rounded-lg px-4 py-2.5 pr-10 text-sm text-slate-900 focus:ring-2 focus:ring-indigo-500 disabled:bg-slate-50 disabled:text-slate-400"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(v => !v)}
                  disabled={!selectedFile}
                  tabIndex={-1}
                  className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-slate-600 disabled:text-slate-300 focus:outline-none"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3">
          <button
            type="submit"
            disabled={saving}
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2 rounded-lg text-sm font-semibold shadow-sm transition-colors flex items-center gap-2 disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
            {saving ? 'Guardando...' : 'Guardar Configuración'}
          </button>
        </div>
      </form>
    </div>
  );
}
