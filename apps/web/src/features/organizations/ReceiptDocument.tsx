import { Document, Page, Text, View, StyleSheet, pdf } from '@react-pdf/renderer';
import { supabase } from '../../lib/supabase';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ReceiptOrganization {
  name: string;
  ruc?: string | null;
  phone?: string | null;
  address?: string | null;
  city?: string | null;
  email?: string | null;
}

export interface ReceiptPayment {
  id: string;
  amount: number;
  payment_date: string; // 'YYYY-MM-DD'
  method: string;
  reference?: string | null;
  notes?: string | null;
}

export interface ReceiptData {
  organization: ReceiptOrganization;
  beneficiaryName: string;
  chargeDescription: string;
  payment: ReceiptPayment;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function methodLabel(method: string): string {
  switch (method) {
    case 'cash': return 'Efectivo';
    case 'transfer': return 'Transferencia';
    case 'card': return 'Tarjeta';
    default: return method || 'Otro';
  }
}

// Human-readable, deliberately non-fiscal — this is not an SRI sequence.
function receiptReference(payment: ReceiptPayment): string {
  const datePart = payment.payment_date.replace(/-/g, '');
  return `REC-${datePart}-${payment.id.slice(0, 6).toUpperCase()}`;
}

function formatReceiptDate(dateStr: string): string {
  const [y, m, d] = dateStr.split('-');
  return `${d}/${m}/${y}`;
}

// ─── PDF styles ───────────────────────────────────────────────────────────────

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
  amountBox: {
    marginTop: 24,
    alignItems: 'flex-end',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    borderTopStyle: 'solid',
  },
  amountLabel: { fontSize: 9, color: '#64748b' },
  amountValue: { fontSize: 22, fontWeight: 'bold', color: '#059669' },
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
});

// ─── Document ─────────────────────────────────────────────────────────────────

export function ReceiptPDF({ organization, beneficiaryName, chargeDescription, payment }: ReceiptData) {
  const locationLine = [organization.address, organization.city].filter(Boolean).join(', ');

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.orgName}>{organization.name}</Text>
            {organization.ruc && <Text style={styles.orgDetail}>RUC: {organization.ruc}</Text>}
            {locationLine && <Text style={styles.orgDetail}>{locationLine}</Text>}
            {organization.phone && <Text style={styles.orgDetail}>Tel: {organization.phone}</Text>}
            {organization.email && <Text style={styles.orgDetail}>{organization.email}</Text>}
          </View>
          <View style={styles.titleBlock}>
            <Text style={styles.title}>RECIBO</Text>
            <Text style={styles.refText}>{receiptReference(payment)}</Text>
            <Text style={styles.refText}>{formatReceiptDate(payment.payment_date)}</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Recibido de</Text>
          <Text style={styles.value}>{beneficiaryName}</Text>

          <Text style={styles.label}>Por concepto de</Text>
          <Text style={styles.value}>{chargeDescription}</Text>

          <View style={styles.row}>
            <View>
              <Text style={styles.label}>Método de pago</Text>
              <Text style={styles.value}>{methodLabel(payment.method)}</Text>
            </View>
            {payment.reference && (
              <View>
                <Text style={styles.label}>Referencia</Text>
                <Text style={styles.value}>{payment.reference}</Text>
              </View>
            )}
          </View>

          {payment.notes && (
            <View>
              <Text style={styles.label}>Notas</Text>
              <Text style={styles.value}>{payment.notes}</Text>
            </View>
          )}
        </View>

        <View style={styles.amountBox}>
          <Text style={styles.amountLabel}>Monto recibido</Text>
          <Text style={styles.amountValue}>${payment.amount.toFixed(2)}</Text>
        </View>

        <Text style={styles.footer}>
          Este recibo es un comprobante interno del centro y no constituye un documento tributario válido ante el SRI.
        </Text>
      </Page>
    </Document>
  );
}

// ─── Blob / download / upload ────────────────────────────────────────────────

export async function buildReceiptBlob(data: ReceiptData): Promise<Blob> {
  return pdf(<ReceiptPDF {...data} />).toBlob();
}

export async function downloadReceiptPdf(data: ReceiptData): Promise<void> {
  const blob = await buildReceiptBlob(data);
  const url = URL.createObjectURL(blob);
  const safeName = data.beneficiaryName.trim().replace(/\s+/g, '-').toLowerCase() || 'beneficiario';
  const a = document.createElement('a');
  a.href = url;
  a.download = `recibo-${safeName}-${data.payment.payment_date}.pdf`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

const RECEIPT_LINK_EXPIRY_SECONDS = 60 * 60 * 24 * 7; // 7 days

export async function uploadReceiptAndGetSignedUrl(data: ReceiptData, organizationId: string): Promise<string> {
  const blob = await buildReceiptBlob(data);
  const path = `${organizationId}/${data.payment.id}.pdf`;

  const { error: uploadError } = await supabase.storage
    .from('payment-receipts')
    .upload(path, blob, { upsert: true, contentType: 'application/pdf' });
  if (uploadError) throw uploadError;

  const { data: signed, error: signError } = await supabase.storage
    .from('payment-receipts')
    .createSignedUrl(path, RECEIPT_LINK_EXPIRY_SECONDS);
  if (signError) throw signError;
  if (!signed?.signedUrl) throw new Error('No se pudo generar el enlace del recibo.');

  return signed.signedUrl;
}
