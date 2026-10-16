import type React from "react";
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { fontFamily } from "../theme";

type Props = {
  readonly at: number;
  readonly x: number;
  readonly y: number;
  readonly emoji: string;
  readonly text: string;
  readonly color?: string;
  readonly tilt?: number;
  readonly until?: number;
};

// Etiqueta que "salta" sobre la tablet para remarcar lo que pasa en pantalla.
export const Sticker: React.FC<Props> = ({ at, x, y, emoji, text, color = "#10b981", tilt = -4, until }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = spring({ frame: frame - at * fps, fps, config: { damping: 10, stiffness: 200 } });
  const out = until === undefined ? 0 : interpolate(frame, [until * fps, until * fps + 8], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  if (p <= 0.001) {
    return null;
  }
  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        display: "flex",
        alignItems: "center",
        gap: 16,
        padding: "20px 30px",
        borderRadius: 28,
        background: "#ffffff",
        boxShadow: `0 24px 50px rgba(15,23,42,0.28), 0 0 0 4px ${color}`,
        fontFamily,
        fontSize: 46,
        fontWeight: 800,
        color: "#0f172a",
        whiteSpace: "nowrap",
        rotate: `${tilt * p}deg`,
        scale: String(interpolate(p, [0, 1], [0.3, 1]) * (1 - out * 0.4)),
        opacity: Math.min(1, p * 2) * (1 - out),
      }}
    >
      <span style={{ fontSize: 54 }}>{emoji}</span>
      {text}
    </div>
  );
};
