import { Audio, Video } from "@remotion/media";
import type React from "react";
import { Interactive, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { Captions } from "../components/Captions";
import { Clock } from "../components/Clock";
import { Sky } from "../components/Sky";
import { Sticker } from "../components/Sticker";
import { captions } from "../data/captions";

// 21:00: ya en casa, la dueña revisa su centro desde el celular.
const NightSceneInner: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = spring({ frame: frame - 6, fps, config: { damping: 15, stiffness: 110 } });
  const phoneW = 500;
  const screenW = phoneW - 28;
  const screenH = 1010;
  return (
    <>
      <Sky sky="noche" arc={0.72} />
      <Clock fromMin={18 * 60} toMin={21 * 60} label="de la noche" dark />
      <div
        style={{
          position: "absolute",
          left: (1080 - phoneW) / 2,
          top: 400,
          width: phoneW,
          height: screenH + 28,
          borderRadius: 70,
          padding: 14,
          background: "linear-gradient(145deg, #334155, #0f172a)",
          boxShadow: "0 0 120px rgba(165,180,252,0.45), 0 40px 90px rgba(0,0,0,0.6)",
          transform: `perspective(1600px) rotateY(${interpolate(enter, [0, 1], [38, -6])}deg) rotateZ(${interpolate(enter, [0, 1], [8, 0])}deg) translateY(${interpolate(enter, [0, 1], [500, 0]) + Math.sin(frame / 20) * 6}px)`,
        }}
      >
        <div style={{ width: screenW, height: screenH, borderRadius: 56, overflow: "hidden", position: "relative", background: "#fff" }}>
          <Video
            src={staticFile("clips/movil.mp4")}
            trimBefore={Math.round(0.2 * fps)}
            muted
            objectFit="cover"
            style={{ position: "absolute", left: 0, top: 0, width: screenW, height: screenH, objectPosition: "top" }}
          />
        </div>
      </div>
      <Sticker at={1.4} x={60} y={600} emoji="🏠" text="Desde casa" color="#a5b4fc" tilt={-6} />
      <Sticker at={2.6} x={640} y={1130} emoji="⚡" text="Al momento" color="#fde68a" tilt={5} />
      <Captions chunks={captions["08-casa"]} audioAt={0.3} dark accent="#a5b4fc" top={1500} />
      <Audio name="Voz" src={staticFile("voz/08-casa.mp3")} from={Math.round(0.3 * fps)} />
    </>
  );
};

export const NightScene = Interactive.create({
  Component: NightSceneInner,
  layout: "absolute-fill",
});
