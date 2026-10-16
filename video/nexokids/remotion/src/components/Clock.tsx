import type React from "react";
import { Easing, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { fontFamily } from "../theme";

type Props = {
  // Minutos desde la medianoche: el reloj corre de `fromMin` a `toMin` al entrar.
  readonly fromMin: number;
  readonly toMin: number;
  readonly label: string;
  readonly dark: boolean;
  readonly top?: number;
};

const pad = (n: number) => String(n).padStart(2, "0");

export const Clock: React.FC<Props> = ({ fromMin, toMin, label, dark, top = 120 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const minutes = interpolate(frame, [4, 0.85 * fps], [fromMin, toMin], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.65, 0, 0.35, 1),
  });
  const shown = Math.round(minutes / 5) * 5;
  const h24 = Math.floor(shown / 60) % 24;
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  const pop = spring({ frame, fps, config: { damping: 12, stiffness: 180 } });
  // "Tic" al llegar a la hora final.
  const tick = spring({ frame: frame - Math.round(0.85 * fps), fps, config: { damping: 9, stiffness: 260 } });
  const ink = dark ? "#ffffff" : "#0f172a";
  const sub = dark ? "rgba(255,255,255,0.75)" : "rgba(15,23,42,0.6)";

  return (
    <div
      style={{
        position: "absolute",
        top,
        left: 0,
        right: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 34,
        fontFamily,
        scale: String(interpolate(pop, [0, 1], [0.6, 1]) * (1 + 0.06 * Math.sin(tick * Math.PI))),
        opacity: pop,
      }}
    >
      <svg width={176} height={176} viewBox="-100 -100 200 200">
        <circle r={94} fill={dark ? "rgba(255,255,255,0.14)" : "rgba(255,255,255,0.85)"} stroke={dark ? "rgba(255,255,255,0.65)" : "#4f46e5"} strokeWidth={8} />
        {Array.from({ length: 12 }, (_, i) => (
          <line
            key={i}
            x1={0}
            y1={-78}
            x2={0}
            y2={i % 3 === 0 ? -64 : -70}
            stroke={ink}
            strokeWidth={i % 3 === 0 ? 7 : 4}
            strokeLinecap="round"
            transform={`rotate(${i * 30})`}
          />
        ))}
        <line x1={0} y1={8} x2={0} y2={-44} stroke={ink} strokeWidth={11} strokeLinecap="round" transform={`rotate(${(minutes / 60) * 30})`} />
        <line x1={0} y1={10} x2={0} y2={-66} stroke="#f59e0b" strokeWidth={7} strokeLinecap="round" transform={`rotate(${(minutes % 60) * 6})`} />
        <circle r={9} fill={ink} />
      </svg>
      <div style={{ display: "flex", flexDirection: "column", lineHeight: 1 }}>
        <div style={{ fontSize: 132, fontWeight: 850, color: ink, letterSpacing: "-0.04em", fontVariantNumeric: "tabular-nums" }}>
          {h12}:{pad(shown % 60)}
        </div>
        <div style={{ fontSize: 40, fontWeight: 650, color: sub, marginTop: 10 }}>{label}</div>
      </div>
    </div>
  );
};
