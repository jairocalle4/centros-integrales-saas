import { Audio } from "@remotion/media";
import type React from "react";
import { Interactive, staticFile, useVideoConfig } from "remotion";
import { Captions } from "../components/Captions";
import { Clock } from "../components/Clock";
import { Sky } from "../components/Sky";
import { Tablet, type Shot } from "../components/Tablet";
import { captions } from "../data/captions";
import { skies, type SkyName } from "../theme";

type Props = {
  readonly line: string;
  readonly sky: SkyName;
  readonly arc: number;
  readonly fromMin: number;
  readonly toMin: number;
  readonly label: string;
  readonly shots: readonly Shot[];
  readonly audioAt?: number;
  readonly tabletHeight?: number;
  readonly children?: React.ReactNode;
};

// Escena de una hora del día: cielo, reloj, la app en una tablet y la voz.
const HourSceneInner: React.FC<Props> = ({
  line,
  sky,
  arc,
  fromMin,
  toMin,
  label,
  shots,
  audioAt = 0.3,
  tabletHeight = 980,
  children,
}) => {
  const { fps } = useVideoConfig();
  const s = skies[sky];
  return (
    <>
      <Sky sky={sky} arc={arc} />
      <Clock fromMin={fromMin} toMin={toMin} label={label} dark={s.dark} />
      <Tablet shots={shots} height={tabletHeight} top={400} />
      {children}
      <Captions chunks={captions[line]} audioAt={audioAt} dark={s.dark} accent={s.accent} top={400 + tabletHeight + 60} />
      <Audio name="Voz" src={staticFile(`voz/${line}.mp3`)} from={Math.round(audioAt * fps)} />
    </>
  );
};

export const HourScene = Interactive.create({
  Component: HourSceneInner,
  layout: "absolute-fill",
});
