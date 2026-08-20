/**
 * Consistent dd/mm/aaaa date formatting across the app. `toLocaleDateString`
 * without an explicit, guaranteed locale renders differently depending on
 * the browser/OS default (mm/dd/yyyy on some setups) — this always renders
 * the Ecuador-standard dd/mm/aaaa regardless of the viewer's environment.
 */
export function formatDate(value: string | Date | null | undefined): string {
  if (!value) return '—';
  const date = typeof value === 'string'
    ? new Date(value.includes('T') ? value : `${value}T00:00:00`)
    : value;
  if (Number.isNaN(date.getTime())) return '—';
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
}

const WEEKDAYS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

/** "Lunes, 15/08/2026" — for headers that benefit from the day name. */
export function formatDateWithWeekday(value: string | Date | null | undefined): string {
  if (!value) return '—';
  const date = typeof value === 'string'
    ? new Date(value.includes('T') ? value : `${value}T00:00:00`)
    : value;
  if (Number.isNaN(date.getTime())) return '—';
  return `${WEEKDAYS[date.getDay()]}, ${formatDate(date)}`;
}
