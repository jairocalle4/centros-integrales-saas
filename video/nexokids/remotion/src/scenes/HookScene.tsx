import { Audio } from "@remotion/media";
import type React from "react";
import { Interactive, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { Captions } from "../components/Captions";
import { Clock } from "../components/Clock";
import { Sky } from "../components/Sky";
import { captions } from "../data/captions";
import { fontFamily } from "../theme";
import { Logo } from "./Logo";

const TOYS = [
  { e: "🎒", x: 120, y: 1180, d: 0 },
  { e: "🧸", x: 820, y: 1260, d: 4 },
  { e: "🖍️", x: 190, y: 1500, d: 8 },
  { e: "📚", x: 760, y: 1560, d: 12 },
  { e: "🧩", x: 470, y: 1680, d: 16 },
];

// Gancho: amanece en el centro y el día empieza "en orden".
const HookSceneInner: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const logo = spring({ frame: frame - 3.2 * fps, fps, config: { damping: 11, stiffness: 160 } });
  return (
    <>
      <Sky sky="amanecer" arc={0.18} rise />
      <Clock fromMin={6 * 60} toMin={6 * 60 + 30} label="de la mañana" dark top={160} />
      {TOYS.map((t, i) => {
        const p = spring({ frame: frame - 10 - t.d, fps, config: { damping: 12, stiffness: 120 } });
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: t.x,
              top: t.y + interpolate(p, [0, 1], [260, 0]) + Math.sin((frame + i * 20) / 14) * 10,
              fontSize: 120,
              opacity: p * 0.95,
              rotate: `${Math.sin((frame + i * 9) / 18) * 8}deg`,
            }}
          >
            {t.e}
          </div>
        );
      })}
      <Captions chunks={captions["01-gancho"]} audioAt={0.3} dark accent="#fde68a" top={560} size={104} />
      <div
        style={{
          position: "absolute",
          top: 930,
          left: 0,
          right: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 26,
          opacity: logo,
          scale: String(interpolate(logo, [0, 1], [0.5, 1])),
          fontFamily,
        }}
      >
        <Logo size={120} />
        <span style={{ fontSize: 92, fontWeight: 850, color: "#fff", letterSpacing: "-0.03em" }}>NexoKids</span>
      </div>
      <Audio name="Voz" src={staticFile("voz/01-gancho.mp3")} from={Math.round(0.3 * fps)} />
    </>
  );
};

export const HookScene = Interactive.create({
  Component: HookSceneInner,
  layout: "absolute-fill",
});
