import type React from "react";
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import type { Chunk } from "../data/captions";
import { fontFamily } from "../theme";

type Props = {
  readonly chunks: readonly Chunk[];
  // Segundo de la escena en que arranca el audio de esta línea.
  readonly audioAt: number;
  readonly dark: boolean;
  readonly accent: string;
  readonly top?: number;
  readonly size?: number;
};

// Subtítulos grandes: cada frase aparece palabra por palabra al ritmo de la voz.
export const Captions: React.FC<Props> = ({ chunks, audioAt, dark, accent, top = 1440, size = 72 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const ms = (frame / fps - audioAt) * 1000;
  if (ms < chunks[0][0].startMs - 120) {
    return null;
  }
  let idx = 0;
  for (let i = 0; i < chunks.length; i++) {
    if (ms >= chunks[i][0].startMs - 120) {
      idx = i;
    }
  }
  const chunk = chunks[idx];
  const ink = dark ? "#ffffff" : "#0f172a";

  return (
    <div
      style={{
        position: "absolute",
        top,
        left: 80,
        right: 80,
        display: "flex",
        flexWrap: "wrap",
        justifyContent: "center",
        columnGap: size * 0.28,
        rowGap: 4,
        fontFamily,
        fontSize: size,
        fontWeight: 850,
        letterSpacing: "-0.02em",
        lineHeight: 1.12,
        textAlign: "center",
      }}
    >
      {chunk.map((w, i) => {
        const startF = ((w.startMs - 60) / 1000 + audioAt) * fps;
        const p = spring({ frame: frame - startF, fps, config: { damping: 14, stiffness: 220 } });
        const speaking = ms >= w.startMs - 60 && ms <= w.endMs + 80;
        return (
          <span
            key={i}
            style={{
              display: "inline-block",
              color: w.emph ? accent : ink,
              opacity: interpolate(p, [0, 0.3], [0, 1], { extrapolateRight: "clamp" }),
              translate: `0px ${interpolate(p, [0, 1], [34, 0])}px`,
              scale: String(interpolate(p, [0, 1], [0.7, 1]) * (speaking && w.emph ? 1.08 : 1)),
              textShadow: dark ? "0 6px 24px rgba(0,0,0,0.45)" : "0 4px 18px rgba(255,255,255,0.9)",
            }}
          >
            {w.text}
          </span>
        );
      })}
    </div>
  );
};
