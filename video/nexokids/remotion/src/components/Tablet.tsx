import { Video } from "@remotion/media";
import type React from "react";
import { Easing, interpolate, Sequence, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";

// Una toma: un tramo de una grabación de 1920x1080, con encuadres [t, x, y, ancho]
// en coordenadas de la grabación. El alto del encuadre sale del formato de la tablet.
export type Shot = {
  readonly src: string;
  readonly at: number;
  readonly dur: number;
  readonly trim: number;
  readonly rate?: number;
  readonly keys: readonly (readonly [number, number, number, number])[];
};

const BEZEL = 22;

const ShotView: React.FC<{ shot: Shot; innerW: number; slideIn: boolean }> = ({
  shot,
  innerW,
  slideIn,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const times = shot.keys.map((k) => k[0]);
  const pick = (i: 1 | 2 | 3) =>
    times.length === 1
      ? shot.keys[0][i]
      : interpolate(t, times, shot.keys.map((k) => k[i]), {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
          easing: Easing.bezier(0.65, 0, 0.35, 1),
        });
  const x = pick(1);
  const y = pick(2);
  const s = innerW / pick(3);

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        overflow: "hidden",
        background: "#f8fafc",
        translate: slideIn
          ? interpolate(frame, [0, 10], [`${innerW}px 0px`, "0px 0px"], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
              easing: Easing.bezier(0.16, 1, 0.3, 1),
            })
          : undefined,
        boxShadow: slideIn ? "-30px 0 60px rgba(15,23,42,0.25)" : undefined,
      }}
    >
      <Video
        src={staticFile(shot.src)}
        trimBefore={Math.round(shot.trim * fps)}
        playbackRate={shot.rate ?? 1}
        muted
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          width: 1920,
          height: 1080,
          maxWidth: "none",
          transformOrigin: "0 0",
          transform: `translate(${-x * s}px, ${-y * s}px) scale(${s})`,
        }}
      />
    </div>
  );
};

type Props = {
  readonly shots: readonly Shot[];
  readonly width?: number;
  readonly height?: number;
  readonly top?: number;
  readonly tiltFrom?: number;
};

export const Tablet: React.FC<Props> = ({ shots, width = 960, height = 860, top = 420, tiltFrom = -32 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = spring({ frame: frame - 6, fps, config: { damping: 16, stiffness: 120, mass: 0.9 } });
  const innerW = width - BEZEL * 2;
  const innerH = height - BEZEL * 2;

  return (
    <div
      style={{
        position: "absolute",
        left: (1080 - width) / 2,
        top,
        width,
        height,
        transform: `perspective(1800px) rotateY(${interpolate(enter, [0, 1], [tiltFrom, 0])}deg) rotateX(${interpolate(enter, [0, 1], [14, 0])}deg) translateY(${interpolate(enter, [0, 1], [260, 0]) + Math.sin(frame / 22) * 6}px) scale(${interpolate(enter, [0, 1], [0.82, 1])})`,
        opacity: interpolate(enter, [0, 0.25], [0, 1], { extrapolateRight: "clamp" }),
        borderRadius: 56,
        background: "linear-gradient(145deg, #1e293b, #0f172a)",
        boxShadow: "0 50px 110px rgba(15,23,42,0.45), inset 0 0 0 3px rgba(255,255,255,0.08)",
        padding: BEZEL,
      }}
    >
      <div style={{ position: "relative", width: innerW, height: innerH, borderRadius: 36, overflow: "hidden", background: "#f8fafc" }}>
        {shots.map((shot, i) => (
          <Sequence
            key={`${shot.src}-${shot.at}`}
            name={`Toma ${i + 1}`}
            from={Math.round(shot.at * fps)}
            durationInFrames={Math.round(shot.dur * fps)}
            layout="none"
          >
            <ShotView shot={shot} innerW={innerW} slideIn={i > 0} />
          </Sequence>
        ))}
      </div>
    </div>
  );
};
