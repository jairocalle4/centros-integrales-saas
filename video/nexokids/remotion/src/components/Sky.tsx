import type React from "react";
import { AbsoluteFill, Easing, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { skies, type SkyName } from "../theme";

// Estrellas fijas (deterministas) para la noche.
const STARS = Array.from({ length: 46 }, (_, i) => ({
  x: (i * 197) % 1080,
  y: (i * 131) % 1100,
  r: 2 + (i % 3),
  phase: i * 0.7,
}));

const CLOUDS = [
  { y: 300, w: 300, speed: 0.55, x0: -120 },
  { y: 1240, w: 380, speed: 0.4, x0: 640 },
  { y: 760, w: 240, speed: 0.7, x0: 860 },
];

type Props = {
  readonly sky: SkyName;
  // Posición del sol/luna en su arco: 0 = horizonte izquierdo, 1 = horizonte derecho.
  readonly arc: number;
  readonly rise?: boolean;
};

export const Sky: React.FC<Props> = ({ sky, arc, rise = false }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = skies[sky];
  const t = frame / fps;

  const riseY = rise
    ? interpolate(frame, [0, 2.4 * fps], [520, 0], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
        easing: Easing.bezier(0.16, 1, 0.3, 1),
      })
    : 0;
  const angle = Math.PI * (1 - arc);
  const bodyX = 540 + Math.cos(angle) * 420;
  const bodyY = 760 - Math.sin(angle) * 520 + riseY;

  return (
    <AbsoluteFill
      style={{
        background: `linear-gradient(180deg, ${s.stops[0]} 0%, ${s.stops[1]} 32%, ${s.stops[2]} 68%, ${s.stops[3]} 100%)`,
        overflow: "hidden",
      }}
    >
      {s.body === "luna" &&
        STARS.map((st, i) => (
          <div
            key={i}
            style={{
              position: "absolute",
              left: st.x,
              top: st.y,
              width: st.r * 2,
              height: st.r * 2,
              borderRadius: "50%",
              background: "#fff",
              opacity: 0.35 + 0.45 * (0.5 + 0.5 * Math.sin(t * 2.2 + st.phase)),
            }}
          />
        ))}
      {s.body === "sol" && (
        <div
          style={{
            position: "absolute",
            left: bodyX - 170,
            top: bodyY - 170,
            width: 340,
            height: 340,
            borderRadius: "50%",
            background: "radial-gradient(circle, #fff7cc 0%, #fde047 38%, rgba(253,224,71,0.35) 60%, rgba(253,224,71,0) 72%)",
            scale: String(1 + 0.03 * Math.sin(t * 2)),
          }}
        />
      )}
      {s.body === "luna" && (
        <div
          style={{
            position: "absolute",
            left: bodyX - 80,
            top: bodyY - 80,
            width: 160,
            height: 160,
            borderRadius: "50%",
            background: "#f1f5f9",
            boxShadow: "0 0 90px 30px rgba(165,180,252,0.45), inset -28px -10px 0 0 #cbd5e1",
          }}
        />
      )}
      {!s.dark &&
        CLOUDS.map((c, i) => (
          <div
            key={i}
            style={{
              position: "absolute",
              top: c.y,
              left: ((c.x0 + t * 60 * c.speed) % 1500) - 300,
              width: c.w,
              height: c.w * 0.32,
              borderRadius: 999,
              background: "rgba(255,255,255,0.55)",
              filter: "blur(6px)",
            }}
          />
        ))}
    </AbsoluteFill>
  );
};
