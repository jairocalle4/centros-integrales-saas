// Genera fechas exactas ('YYYY-MM-DD') para un servicio "mensual" —
// reutilizado tanto al crear una inscripción (MatriculaWizard) como al
// renovar el mes siguiente (BeneficiaryDetailPage). El resultado siempre
// es un arreglo concreto de fechas exactas, igual que si se hubieran
// agregado a mano una por una — nunca una fuente de recurrencia "en
// vivo" (ver AGENTS.md / historial: un sistema así se abandonó antes
// porque desacoplaba el cobro de las fechas realmente generadas).

export function getDayOfWeekLocal(dateStr: string): number {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d).getDay();
}

function addMonthsLocal(dateStr: string, months: number): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(y, m - 1 + months, d);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
}

function addDaysLocal(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(y, m - 1, d + days);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
}

/**
 * daysOfWeek: 0=Domingo … 6=Sábado.
 * Devuelve fechas 'YYYY-MM-DD' entre startDate (inclusive) y un mes
 * calendario después (exclusive), filtradas a los días marcados.
 */
export function generateMonthlyDates(startDate: string, daysOfWeek: number[]): string[] {
  if (daysOfWeek.length === 0) return [];
  const days = new Set(daysOfWeek);
  const endExclusive = addMonthsLocal(startDate, 1);
  const dates: string[] = [];
  let cursor = startDate;
  while (cursor < endExclusive) {
    if (days.has(getDayOfWeekLocal(cursor))) dates.push(cursor);
    cursor = addDaysLocal(cursor, 1);
  }
  return dates;
}

/** Un día después de la fecha dada — usado para continuar un rango ya generado. */
export function nextDayLocal(dateStr: string): string {
  return addDaysLocal(dateStr, 1);
}
