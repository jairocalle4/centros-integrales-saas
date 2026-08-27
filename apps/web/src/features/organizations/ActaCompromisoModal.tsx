import { X, Printer, FileText } from 'lucide-react';

export type CommitmentData = {
  representativeName: string;
  representativeId: string;
  representativeEmail: string;
  beneficiaryName: string;
  sessionDuration: number;
  photoConsent: boolean;
  therapies: Record<string, boolean>;
  paymentFrequency: 'session' | 'weekly' | 'monthly';
  signedDate?: string;
  orgName?: string;
  city?: string;
};

type Props = {
  isOpen: boolean;
  onClose: () => void;
  data: CommitmentData;
  onSign?: () => void;
};

export function ActaCompromisoModal({ isOpen, onClose, data, onSign }: Props) {
  if (!isOpen) return null;

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPDF = () => {
    const element = document.getElementById('printable-acta');
    if (!element) return;

    const opt = {
      margin:       [10, 10, 10, 10],
      filename:     `Acta_Compromiso_${(data.beneficiaryName || 'Paciente').replace(/\s+/g, '_')}.pdf`,
      image:        { type: 'jpeg', quality: 0.98 },
      html2canvas:  { scale: 2, useCORS: true },
      jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };

    const runDownload = () => {
      if ((window as any).html2pdf) {
        (window as any).html2pdf().set(opt).from(element).save();
      }
    };

    if ((window as any).html2pdf) {
      runDownload();
    } else {
      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js';
      script.onload = () => runDownload();
      document.head.appendChild(script);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 overflow-y-auto">
      {/* Container */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-3xl my-8 overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50 print:hidden">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-indigo-600" />
            <h3 className="font-bold text-slate-900 text-lg">Acta de Compromiso Digital</h3>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleDownloadPDF}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer"
            >
              <FileText className="w-4 h-4" />
              Descargar PDF
            </button>
            <button
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-semibold shadow-xs transition-colors cursor-pointer"
            >
              <Printer className="w-4 h-4 text-slate-500" />
              Imprimir
            </button>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-slate-600 p-1 rounded-lg transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Print Styles for Legal Document */}
        <style>{`
          @page {
            size: A4 portrait;
            margin: 12mm 15mm;
          }
          @media print {
            body {
              background: white !important;
            }
            body * {
              visibility: hidden !important;
            }
            #printable-acta, #printable-acta * {
              visibility: visible !important;
            }
            #printable-acta {
              position: fixed !important;
              left: 0 !important;
              top: 0 !important;
              width: 100% !important;
              margin: 0 !important;
              padding: 0 !important;
              box-shadow: none !important;
              border: none !important;
              background: white !important;
              color: black !important;
              font-family: 'Times New Roman', Times, Georgia, serif !important;
            }
            .print\\:hidden {
              display: none !important;
            }
          }
        `}</style>

        {/* Legal Word-Style Document Container */}
        <div className="p-8 sm:p-12 overflow-y-auto font-serif text-slate-900 text-sm space-y-6 leading-relaxed print:p-0 print:overflow-visible" id="printable-acta">
          
          {/* Header Title */}
          <div className="text-center space-y-1.5 border-b-2 border-slate-900 pb-4">
            <h1 className="text-2xl font-bold uppercase tracking-wide text-slate-900 font-serif">
              {data.orgName || 'CENTRO INTEGRAL CRECIENDO JUNTOS'}
            </h1>
            <h2 className="text-base font-bold uppercase tracking-widest text-slate-800 font-serif">
              ACTA DE COMPROMISO Y CONSENTIMIENTO INFORMADO
            </h2>
          </div>

          {/* Body Paragraphs */}
          <div className="space-y-4 text-justify font-serif text-[15px]">
            <p>
              Por medio del presente documento, yo <strong>{data.representativeName || '__________________________________'}</strong>, portador(a) de la cédula de ciudadanía / RUC N° <strong>{data.representativeId || '__________________'}</strong> y correo electrónico <strong>{data.representativeEmail || '____________________'}</strong>, en mi calidad de representante legal del paciente <strong>{data.beneficiaryName || '__________________________________'}</strong>, declaro mi compromiso formal de{' '}
              {data.paymentFrequency === 'monthly' ? (
                <>cumplir puntualmente con el horario mensual establecido para el servicio contratado, cuya jornada diaria tiene una duración de <strong>{data.sessionDuration || 40} minutos</strong>, de acuerdo con el horario acordado con la institución</>
              ) : (
                <>acudir con puntualidad al horario establecido para las sesiones terapéuticas, las cuales tienen una duración reglamentaria de <strong>{data.sessionDuration || 40} minutos</strong></>
              )}.
            </p>
            <p>
              Asimismo, me responsabilizo de notificar a la institución o al terapeuta a cargo con al menos <strong>24 horas de anticipación</strong> en caso de no poder asistir a una sesión agendada. Se establece un límite máximo de <strong>DOS (2) FALTAS JUSTIFICADAS AL AÑO</strong>.
            </p>
            <p className="font-bold uppercase tracking-tight border-l-4 border-slate-900 pl-3 py-1 bg-slate-50 print:bg-transparent">
              CLÁUSULA DE TOLERANCIA Y HORARIOS: En caso de no acudir a la hora exacta convenida, el servicio se brindará únicamente durante el tiempo restante disponible de la sesión programada.
            </p>
          </div>

          {/* Autorización Publicitaria */}
          <div className="space-y-2 pt-2 border-t border-slate-200">
            <h3 className="font-bold uppercase text-xs tracking-wider text-slate-800 font-serif">
              I. AUTORIZACIÓN DE USO DE IMAGEN Y MATERIAL PUBLICITARIO
            </h3>
            <p className="text-sm font-serif">
              Para fines estrictamente pedagógicos, registro institucional y difusión publicitaria:
            </p>
            <div className="flex gap-8 text-sm font-serif font-bold pl-4">
              <span>[{data.photoConsent ? ' X ' : '   '}] SÍ AUTORIZO</span>
              <span>[{!data.photoConsent ? ' X ' : '   '}] NO AUTORIZO</span>
            </div>
          </div>

          {/* Especificación de Terapias */}
          <div className="space-y-2 pt-2 border-t border-slate-200">
            <h3 className="font-bold uppercase text-xs tracking-wider text-slate-800 font-serif">
              II. ESPECIFICACIÓN DEL TIPO DE ATENCIÓN A RECIBIR
            </h3>
            <div className="grid grid-cols-2 gap-2 text-sm font-serif pl-4">
              {Object.keys(data.therapies).length > 0 ? (
                Object.keys(data.therapies).map((therapyName, idx) => (
                  <div key={idx}>[ X ] {therapyName}</div>
                ))
              ) : (
                <div className="col-span-2 italic text-slate-500">Ningún servicio especificado.</div>
              )}
            </div>
          </div>

          {/* Especificación de Pago */}
          <div className="space-y-2 pt-2 border-t border-slate-200">
            <h3 className="font-bold uppercase text-xs tracking-wider text-slate-800 font-serif">
              III. MODALIDAD DE PAGO ACORDADA
            </h3>
            <div className="flex flex-wrap gap-8 text-sm font-serif pl-4">
              <div>[{data.paymentFrequency === 'session' ? ' X ' : '   '}] Por Sesión Terapéutica</div>
              <div>[{data.paymentFrequency === 'weekly' ? ' X ' : '   '}] Semanal</div>
              <div>[{data.paymentFrequency === 'monthly' ? ' X ' : '   '}] Mensual / Quincenal</div>
            </div>
          </div>

          {/* Legal Closing Statement & Date */}
          <div className="pt-6 border-t border-slate-300 font-serif text-sm">
            <p className="text-right italic">
              Dado y suscrito en {data.city || 'la ciudad del centro integral'}, a los {new Date().getDate()} días del mes de {new Date().toLocaleDateString('es-ES', { month: 'long' })} de {new Date().getFullYear()}.
            </p>
          </div>

          {/* Clean Legal Signatures Block */}
          <div className="pt-12 grid grid-cols-2 gap-12 text-center font-serif text-xs">
            <div className="space-y-2">
              <div className="border-b border-slate-900 w-4/5 mx-auto h-12"></div>
              <p className="font-bold text-sm text-slate-900 uppercase">{data.representativeName || '_______________________'}</p>
              <p className="text-slate-700">C.I. / RUC: {data.representativeId || '________________'}</p>
              <p className="font-bold text-slate-800 uppercase tracking-widest pt-1">REPRESENTANTE LEGAL</p>
            </div>

            <div className="space-y-2">
              <div className="border-b border-slate-900 w-4/5 mx-auto h-12"></div>
              <p className="font-bold text-sm text-slate-900 uppercase">{data.orgName || 'CENTRO INTEGRAL CRECIENDO JUNTOS'}</p>
              <p className="text-slate-700">RUC Institucional</p>
              <p className="font-bold text-slate-800 uppercase tracking-widest pt-1">DIRECCIÓN / ADMINISTRACIÓN</p>
            </div>
          </div>

        </div>

        {/* Modal Footer Actions */}
        <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between print:hidden">
          <p className="text-xs text-slate-500">Documento redactado con formato legal oficial A4.</p>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-sm font-semibold text-slate-600 hover:text-slate-900 transition-colors cursor-pointer"
            >
              Cerrar
            </button>
            {onSign && !data.signedDate && (
              <button
                onClick={onSign}
                className="px-5 py-2 rounded-lg text-sm font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm transition-colors cursor-pointer"
              >
                Marcar como Firmado
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
