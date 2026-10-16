import { Audio } from "@remotion/media";
import type React from "react";
import { Interactive, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { Captions } from "../components/Captions";
import { Sky } from "../components/Sky";
import { captions } from "../data/captions";
import { brand, fontFamily } from "../theme";
import { Logo } from "./Logo";

// Papeles que se van volando: "menos papeles".
const PAPERS = Array.from({ length: 9 }, (_, i) => ({ x: 80 + ((i * 113) % 900), y: 1300 + ((i * 71) % 300), r: (i * 37) % 60 - 30, d: i * 2 }));

const WaIcon: React.FC<{ size: number }> = ({ size }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="#fff">
    <path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm5.1 13.9c-.2.6-1.2 1.2-1.7 1.2-.4.1-1 .1-1.6-.1-.4-.1-.9-.3-1.5-.6-2.6-1.1-4.3-3.8-4.4-4-.1-.2-1-1.4-1-2.6s.6-1.8.9-2.1c.2-.2.5-.3.6-.3h.5c.1 0 .3 0 .5.4l.7 1.7c.1.1.1.3 0 .4l-.2.4-.3.4c-.1.1-.2.3-.1.5.1.2.6 1 1.3 1.6.9.8 1.7 1.1 1.9 1.2.2.1.4.1.5-.1l.7-.9c.2-.2.3-.2.5-.1l1.6.8c.2.1.4.2.4.3.1.1.1.6-.1 1.2z" />
  </svg>
);

const CloseSceneInner: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const logo = spring({ frame: frame - 4, fps, config: { damping: 10, stiffness: 150 } });
  const cta = spring({ frame: frame - 4.9 * fps, fps, config: { damping: 11, stiffness: 170 } });
  const pulse = 1 + 0.035 * Math.max(0, Math.sin((frame - 5.4 * fps) / 6));
  return (
    <>
      <Sky sky="marca" arc={0.5} />
      {PAPERS.map((p, i) => {
        const fly = interpolate(frame, [0.8 * fps + p.d, 2.6 * fps + p.d], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: p.x + fly * (p.x > 540 ? 700 : -700),
              top: p.y - fly * 900,
              fontSize: 96,
              rotate: `${p.r + fly * 260}deg`,
              opacity: 1 - fly,
            }}
          >
            📄
          </div>
        );
      })}
      <div
        style={{
          position: "absolute",
          top: 230,
          left: 0,
          right: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 30,
          fontFamily,
          opacity: logo,
          scale: String(interpolate(logo, [0, 1], [0.4, 1])),
        }}
      >
        <Logo size={220} />
        <div style={{ fontSize: 128, fontWeight: 850, color: "#fff", letterSpacing: "-0.04em" }}>NexoKids</div>
        <div style={{ fontSize: 44, fontWeight: 600, color: "rgba(255,255,255,0.8)" }}>Para centros integrales y guarderías</div>
      </div>
      <Captions chunks={captions["09-cierre"]} audioAt={0.3} dark accent="#fde68a" top={830} size={84} />
      <div
        style={{
          position: "absolute",
          top: 1240,
          left: 0,
          right: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 34,
          fontFamily,
          opacity: cta,
          translate: `0px ${interpolate(cta, [0, 1], [120, 0])}px`,
        }}
      >
        <div
          style={{
            padding: "30px 64px",
            borderRadius: 999,
            background: "#ffffff",
            color: brand.indigo,
            fontSize: 58,
            fontWeight: 850,
            boxShadow: "0 24px 60px rgba(0,0,0,0.35)",
            scale: String(pulse),
          }}
        >
          Pide tu demostración
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 22, padding: "22px 44px", borderRadius: 999, background: brand.wa, boxShadow: "0 20px 50px rgba(37,211,102,0.45)" }}>
          <WaIcon size={64} />
          <span style={{ fontSize: 64, fontWeight: 850, color: "#fff", letterSpacing: "0.01em" }}>099 169 3863</span>
        </div>
      </div>
      <Audio name="Voz" src={staticFile("voz/09-cierre.mp3")} from={Math.round(0.3 * fps)} />
    </>
  );
};

export const CloseScene = Interactive.create({
  Component: CloseSceneInner,
  layout: "absolute-fill",
});
