import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { ShieldCheck, Upload, FileKey2 } from 'lucide-react';
import toast from 'react-hot-toast';

export function ElectronicBillingSettings({ orgId }: { orgId: string }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  const [config, setConfig] = useState({
    environment: 'pruebas',
    establecimiento: '001',
    punto_emision: '001',
    cert_password_hash: ''
  });
  
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  useEffect(() => {
    fetchConfig();
  }, [orgId]);

  const fetchConfig = async () => {
    try {
      // @ts-ignore - The table is not yet in database.types.ts
      const { data } = await supabase
        .from('sri_configurations' as any)
        .select('*')
        .eq('organization_id', orgId)
        .maybeSingle();

      if (data) {
        setConfig({
          environment: (data as any).environment,
          establecimiento: (data as any).establecimiento,
          punto_emision: (data as any).punto_emision,
          cert_password_hash: '' // No cargar la contraseña por seguridad
        });
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    
    try {
      // 1. Si hay archivo, subirlo al storage de manera simulada
      let certPath = null;
      if (selectedFile) {
        // Mock de subida
        certPath = `certs/${orgId}/${selectedFile.name}`;
      }

      // @ts-ignore - The table is not yet in database.types.ts
      const { error } = await supabase
        .from('sri_configurations' as any)
        .upsert({
          organization_id: orgId,
          environment: config.environment,
          establecimiento: config.establecimiento,
          punto_emision: config.punto_emision,
          cert_storage_path: certPath,
          cert_password_hash: config.cert_password_hash // TODO: Encriptar en la Edge Function real
        });

      if (error) throw error;
      toast.success('Configuración guardada exitosamente (Simulación Sprint 0)');
      
    } catch (err: any) {
      toast.error('Error al guardar: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const testEdgeFunction = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('electronic-billing', {
        body: {
          organization_id: orgId,
          payload: { total: 100, cliente_identificacion: '1234567890' }
        }
      });
      if (error) throw error;
      toast.success('Respuesta del Mock SRI recibida exitosamente');
      console.log('Mock SRI Response:', data);
    } catch (err: any) {
      toast.error('Error al probar Edge Function: ' + err.message);
    }
  };

  if (loading) return <div className="p-4 text-slate-500">Cargando configuración SRI...</div>;

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-lg bg-indigo-100 flex items-center justify-center text-indigo-600">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900">Configuración SRI (Facturación Electrónica)</h2>
            <p className="text-sm text-slate-500">Gestiona los parámetros para emitir comprobantes autorizados.</p>
          </div>
        </div>

        <form onSubmit={handleSave} className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Ambiente</label>
              <select
                value={config.environment}
                onChange={e => setConfig({ ...config, environment: e.target.value })}
                className="w-full bg-white border border-slate-300 rounded-lg px-4 py-2.5 text-sm text-slate-900 focus:ring-2 focus:ring-indigo-500"
              >
                <option value="pruebas">Pruebas</option>
                <option value="produccion">Producción</option>
              </select>
            </div>
            
            <div className="grid grid-cols-2 gap-3">
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
            </div>
          </div>

          <div className="border-t border-slate-200 pt-5">
            <h3 className="text-sm font-bold text-slate-900 mb-3 flex items-center gap-2">
              <FileKey2 className="w-4 h-4 text-slate-500" />
              Firma Electrónica (.p12)
            </h3>
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
                <input
                  type="password"
                  placeholder="Dejar en blanco para mantener actual"
                  value={config.cert_password_hash}
                  onChange={e => setConfig({ ...config, cert_password_hash: e.target.value })}
                  className="w-full bg-white border border-slate-300 rounded-lg px-4 py-2.5 text-sm text-slate-900 focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-5 border-t border-slate-100">
            <button
              type="button"
              onClick={testEdgeFunction}
              className="px-4 py-2 text-sm font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors flex items-center gap-2"
            >
              Probar Emisión (Mock)
            </button>
            <button
              type="submit"
              disabled={saving}
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2 rounded-lg text-sm font-semibold shadow-sm transition-colors flex items-center gap-2 disabled:opacity-50"
            >
              <Upload className="w-4 h-4" />
              {saving ? 'Guardando...' : 'Guardar Configuración'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
