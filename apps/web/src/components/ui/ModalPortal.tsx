import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';

/**
 * Monta su contenido directamente en document.body en vez del punto del
 * árbol de React donde se declara. Un modal `fixed inset-0` normalmente
 * cubre todo el viewport — pero deja de hacerlo si CUALQUIER ancestro
 * tiene `transform`/`filter`/`perspective`/`contain` distinto de su valor
 * inicial (incluye una animación de entrada con `animation-fill-mode:
 * forwards`/`both` que termina en `transform: translateY(0)`, que sigue
 * contando como "transform" aunque sea 0 y ya haya terminado de animar).
 * En ese caso el modal queda atrapado dentro de la caja de ese ancestro
 * en vez de cubrir la pantalla. El portal evita el problema de raíz: sin
 * importar qué ancestro exista hoy o se agregue después, el nodo real en
 * el DOM siempre cuelga de <body>.
 */
export function ModalPortal({ children }: { children: ReactNode }) {
  return createPortal(children, document.body);
}
