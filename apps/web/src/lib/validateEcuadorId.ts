// Validación de cédula ecuatoriana (algoritmo oficial Módulo 10) — la
// misma regla que aplica el servicio externo de facturación electrónica
// al validar la identificación del comprador. Validar aquí, al momento de
// guardar un representante, evita que una cédula mal tipeada llegue hasta
// el intento de facturación (donde el error es más confuso y, si ocurre
// dentro de "Guardar y Facturar", hace que se revierta el pago).

export function validateCedulaEcuador(raw: string): string | null {
  const cedula = raw.trim();
  if (!/^\d{10}$/.test(cedula)) {
    return 'La cédula debe tener exactamente 10 dígitos.';
  }

  const province = Number(cedula.slice(0, 2));
  if (province < 1 || province > 24) {
    return 'Los dos primeros dígitos (código de provincia) deben estar entre 01 y 24.';
  }

  const thirdDigit = Number(cedula[2]);
  if (thirdDigit > 6) {
    return 'El tercer dígito debe ser menor a 7 en una cédula de persona natural.';
  }

  const coefficients = [2, 1, 2, 1, 2, 1, 2, 1, 2];
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    let value = Number(cedula[i]) * coefficients[i];
    if (value >= 10) value -= 9;
    sum += value;
  }
  const expected = (Math.ceil(sum / 10) * 10 - sum) % 10;
  const received = Number(cedula[9]);
  if (expected !== received) {
    return `Cédula inválida: dígito verificador incorrecto (esperado ${expected}, tiene ${received}). Revisa el número.`;
  }

  return null;
}
