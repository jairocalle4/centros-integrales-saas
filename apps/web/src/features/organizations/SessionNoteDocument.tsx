import { Document, Page, Text, View, StyleSheet, pdf } from '@react-pdf/renderer';
import type { ReceiptOrganization } from './ReceiptDocument';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PrintableSessionNote {
  session_date: string; // 'YYYY-MM-DD'
  therapist_name: string | null;
  observations: string | null;
  goals_achieved: string | null;
  next_steps: string | null;
  rating: number | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatNoteDate(dateStr: string): string {
  const [y, m, d] = dateStr.split('-');
  return `${d}/${m}/${y}`;
}

// ─── PDF styles (mismo lenguaje visual que ReceiptDocument.tsx) ───────────────

const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 10, fontFamily: 'Helvetica', color: '#1e293b' },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 24,
    paddingBottom: 12,
    borderBottomWidth: 2,
    borderBottomColor: '#4f46e5',
    borderBottomStyle: 'solid',
  },
  orgName: { fontSize: 16, fontWeight: 'bold', color: '#312e81' },
  orgDetail: { fontSize: 9, color: '#64748b', marginTop: 2 },
  titleBlock: { alignItems: 'flex-end' },
  title: { fontSize: 18, fontWeight: 'bold', color: '#4f46e5' },
  refText: { fontSize: 9, color: '#64748b', marginTop: 2 },
  section: { marginBottom: 16 },
  label: { fontSize: 8, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 },
  value: { fontSize: 11, color: '#0f172a', marginBottom: 10 },
  row: { flexDirection: 'row', gap: 32 },
  dotsRow: { flexDirection: 'row', gap: 4, alignItems: 'center' },
  dot: { width: 8, height: 8, borderRadius: 4 },
  dotFilled: { backgroundColor: '#f59e0b' },
  dotEmpty: { backgroundColor: '#e2e8f0' },
  ratingText: { fontSize: 9, color: '#64748b', marginLeft: 6 },
  footer: {
    position: 'absolute',
    bottom: 30,
    left: 40,
    right: 40,
    fontSize: 8,
    color: '#94a3b8',
    textAlign: 'center',
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    borderTopStyle: 'solid',
  },
  // ─ Avance completo ─
  summaryBar: { flexDirection: 'row', gap: 24, marginBottom: 20, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: '#e2e8f0', borderBottomStyle: 'solid' },
  summaryStat: { alignItems: 'flex-start' },
  summaryStatValue: { fontSize: 16, fontWeight: 'bold', color: '#312e81' },
  summaryStatLabel: { fontSize: 8, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 2 },
  generalSummaryBox: { backgroundColor: '#eef2ff', borderRadius: 6, padding: 12, marginBottom: 18 },
  generalSummaryLabel: { fontSize: 8, color: '#4338ca', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4, fontWeight: 'bold' },
  generalSummaryText: { fontSize: 10, color: '#312e81', lineHeight: 1.4 },
  entry: { marginBottom: 14, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: '#f1f5f9', borderBottomStyle: 'solid' },
  entryHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  entryDate: { fontSize: 11, fontWeight: 'bold', color: '#0f172a' },
  entryTherapist: { fontSize: 9, color: '#4f46e5' },
  entryLabel: { fontSize: 7.5, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 1, marginTop: 4 },
  entryValue: { fontSize: 9.5, color: '#334155', lineHeight: 1.35 },
});

function RatingDots({ rating }: { rating: number | null }) {
  if (!rating) return null;
  return (
    <View style={styles.dotsRow}>
      {[1, 2, 3, 4, 5].map((i) => (
        <View key={i} style={[styles.dot, i <= rating ? styles.dotFilled : styles.dotEmpty]} />
      ))}
      <Text style={styles.ratingText}>{rating}/5</Text>
    </View>
  );
}

function OrgHeader({ organization, title, refLine1, refLine2 }: { organization: ReceiptOrganization; title: string; refLine1: string; refLine2?: string }) {
  const locationLine = [organization.address, organization.city].filter(Boolean).join(', ');
  return (
    <View style={styles.headerRow}>
      <View>
        <Text style={styles.orgName}>{organization.name}</Text>
        {organization.ruc && <Text style={styles.orgDetail}>RUC: {organization.ruc}</Text>}
        {locationLine && <Text style={styles.orgDetail}>{locationLine}</Text>}
        {organization.phone && <Text style={styles.orgDetail}>Tel: {organization.phone}</Text>}
      </View>
      <View style={styles.titleBlock}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.refText}>{refLine1}</Text>
        {refLine2 && <Text style={styles.refText}>{refLine2}</Text>}
      </View>
    </View>
  );
}

const FOOTER_TEXT = 'Documento de seguimiento interno del centro — no constituye un expediente médico ni un documento con validez legal.';

// ─── Documento 1: una sola nota de sesión ──────────────────────────────────────

export interface SessionNoteData {
  organization: ReceiptOrganization;
  beneficiaryName: string;
  note: PrintableSessionNote;
}

export function SessionNotePDF({ organization, beneficiaryName, note }: SessionNoteData) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <OrgHeader organization={organization} title="NOTA DE PROGRESO" refLine1={formatNoteDate(note.session_date)} />

        <View style={styles.section}>
          <Text style={styles.label}>Beneficiario</Text>
          <Text style={styles.value}>{beneficiaryName}</Text>

          <View style={styles.row}>
            <View>
              <Text style={styles.label}>Fecha de sesión</Text>
              <Text style={styles.value}>{formatNoteDate(note.session_date)}</Text>
            </View>
            {note.therapist_name && (
              <View>
                <Text style={styles.label}>Profesional</Text>
                <Text style={styles.value}>{note.therapist_name}</Text>
              </View>
            )}
          </View>

          {note.observations && (
            <View>
              <Text style={styles.label}>Observaciones</Text>
              <Text style={styles.value}>{note.observations}</Text>
            </View>
          )}
          {note.goals_achieved && (
            <View>
              <Text style={styles.label}>Logros Alcanzados</Text>
              <Text style={styles.value}>{note.goals_achieved}</Text>
            </View>
          )}
          {note.next_steps && (
            <View>
              <Text style={styles.label}>Próximos Pasos</Text>
              <Text style={styles.value}>{note.next_steps}</Text>
            </View>
          )}

          {note.rating && (
            <View>
              <Text style={styles.label}>Progreso</Text>
              <RatingDots rating={note.rating} />
            </View>
          )}
        </View>

        <Text style={styles.footer}>{FOOTER_TEXT}</Text>
      </Page>
    </Document>
  );
}

// ─── Documento 2: avance completo (todas las notas del beneficiario) ──────────

export interface ProgressReportData {
  organization: ReceiptOrganization;
  beneficiaryName: string;
  notes: PrintableSessionNote[]; // cualquier orden — se ordenan aquí mismo
  generalSummary?: string;
}

export function ProgressReportPDF({ organization, beneficiaryName, notes, generalSummary }: ProgressReportData) {
  const sorted = [...notes].sort((a, b) => a.session_date.localeCompare(b.session_date));
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  const ratings = sorted.map((n) => n.rating).filter((r): r is number => Boolean(r));
  const avgRating = ratings.length > 0 ? (ratings.reduce((s, r) => s + r, 0) / ratings.length).toFixed(1) : null;

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <OrgHeader
          organization={organization}
          title="INFORME DE AVANCE"
          refLine1={beneficiaryName}
          refLine2={first && last ? `${formatNoteDate(first.session_date)} – ${formatNoteDate(last.session_date)}` : undefined}
        />

        <View style={styles.summaryBar}>
          <View style={styles.summaryStat}>
            <Text style={styles.summaryStatValue}>{sorted.length}</Text>
            <Text style={styles.summaryStatLabel}>Sesiones registradas</Text>
          </View>
          {avgRating && (
            <View style={styles.summaryStat}>
              <Text style={styles.summaryStatValue}>{avgRating}/5</Text>
              <Text style={styles.summaryStatLabel}>Progreso promedio</Text>
            </View>
          )}
        </View>

        {generalSummary && generalSummary.trim() && (
          <View style={styles.generalSummaryBox}>
            <Text style={styles.generalSummaryLabel}>Resumen General</Text>
            <Text style={styles.generalSummaryText}>{generalSummary.trim()}</Text>
          </View>
        )}

        {sorted.map((note, i) => (
          <View key={i} style={styles.entry} wrap={false}>
            <View style={styles.entryHeaderRow}>
              <Text style={styles.entryDate}>{formatNoteDate(note.session_date)}</Text>
              <RatingDots rating={note.rating} />
            </View>
            {note.therapist_name && <Text style={styles.entryTherapist}>{note.therapist_name}</Text>}
            {note.observations && (
              <>
                <Text style={styles.entryLabel}>Observaciones</Text>
                <Text style={styles.entryValue}>{note.observations}</Text>
              </>
            )}
            {note.goals_achieved && (
              <>
                <Text style={styles.entryLabel}>Logros Alcanzados</Text>
                <Text style={styles.entryValue}>{note.goals_achieved}</Text>
              </>
            )}
            {note.next_steps && (
              <>
                <Text style={styles.entryLabel}>Próximos Pasos</Text>
                <Text style={styles.entryValue}>{note.next_steps}</Text>
              </>
            )}
          </View>
        ))}

        <Text style={styles.footer} fixed>{FOOTER_TEXT}</Text>
      </Page>
    </Document>
  );
}

// ─── Descarga directa (mismo patrón que downloadReceiptPdf) ───────────────────

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export async function downloadSessionNotePdf(data: SessionNoteData): Promise<void> {
  const blob = await pdf(<SessionNotePDF {...data} />).toBlob();
  const safeName = data.beneficiaryName.trim().replace(/\s+/g, '-').toLowerCase() || 'beneficiario';
  triggerDownload(blob, `nota-progreso-${safeName}-${data.note.session_date}.pdf`);
}

export async function downloadProgressReportPdf(data: ProgressReportData): Promise<void> {
  const blob = await pdf(<ProgressReportPDF {...data} />).toBlob();
  const safeName = data.beneficiaryName.trim().replace(/\s+/g, '-').toLowerCase() || 'beneficiario';
  triggerDownload(blob, `informe-avance-${safeName}.pdf`);
}
