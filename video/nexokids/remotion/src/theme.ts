import { loadFont } from "@remotion/fonts";
import { staticFile } from "remotion";

// Inter variable (mismos archivos que el video original de NexoKids).
export const fontFamily = "Inter";
loadFont({
  family: fontFamily,
  url: staticFile("fonts/inter-latin-wght-normal.woff2"),
  weight: "100 900",
});
loadFont({
  family: fontFamily,
  url: staticFile("fonts/inter-latin-ext-wght-normal.woff2"),
  weight: "100 900",
});

// Colores reales de la app (Tailwind indigo/emerald/slate).
export const brand = {
  indigo: "#4f46e5",
  indigoDark: "#3730a3",
  violet: "#7c3aed",
  green: "#10b981",
  wa: "#25d366",
  slate900: "#0f172a",
  slate600: "#475569",
  amber: "#f59e0b",
};

export type SkyName =
  | "amanecer"
  | "manana"
  | "media-manana"
  | "mediodia"
  | "tarde"
  | "media-tarde"
  | "atardecer"
  | "noche"
  | "marca";

type Sky = {
  readonly stops: readonly string[];
  readonly dark: boolean;
  readonly accent: string;
  readonly body: "sol" | "luna" | null;
};

// Cielo según la hora del día: el fondo cuenta la historia del día.
export const skies: Record<SkyName, Sky> = {
  amanecer: { stops: ["#312e81", "#a78bfa", "#fda4af", "#fde68a"], dark: true, accent: "#fde68a", body: "sol" },
  manana: { stops: ["#7dd3fc", "#bae6fd", "#e0f2fe", "#fef9c3"], dark: false, accent: brand.indigo, body: "sol" },
  "media-manana": { stops: ["#60a5fa", "#93c5fd", "#dbeafe", "#f0f9ff"], dark: false, accent: brand.indigo, body: "sol" },
  mediodia: { stops: ["#3b82f6", "#60a5fa", "#bfdbfe", "#eff6ff"], dark: false, accent: brand.indigo, body: "sol" },
  tarde: { stops: ["#818cf8", "#a5b4fc", "#e0e7ff", "#fef3c7"], dark: false, accent: brand.indigoDark, body: "sol" },
  "media-tarde": { stops: ["#f59e0b", "#fcd34d", "#fde68a", "#fff7ed"], dark: false, accent: "#9a3412", body: "sol" },
  atardecer: { stops: ["#1e1b4b", "#7c3aed", "#ec4899", "#fb923c"], dark: true, accent: "#fde68a", body: "sol" },
  noche: { stops: ["#020617", "#0f172a", "#1e1b4b", "#312e81"], dark: true, accent: "#a5b4fc", body: "luna" },
  marca: { stops: ["#1e1b4b", "#3730a3", "#4f46e5", "#7c3aed"], dark: true, accent: "#fde68a", body: null },
};
