/**
 * Representative/organization phone numbers are stored as plain 10-digit
 * local Ecuadorian numbers (e.g. "0955443882", leading 0, no country code —
 * see representative/organization forms). WhatsApp's `wa.me` links need the
 * full international number with no leading 0 (e.g. "593955443882").
 */
export function toWhatsAppNumber(local: string | null | undefined): string | null {
  if (!local) return null;
  const digits = local.replace(/\D/g, '');
  if (digits.length !== 10 || !digits.startsWith('0')) return null;
  return `593${digits.slice(1)}`;
}
