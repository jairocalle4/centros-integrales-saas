import { linearTiming, TransitionSeries } from "@remotion/transitions";
import { clockWipe } from "@remotion/transitions/clock-wipe";
import type React from "react";
import { Sticker } from "./components/Sticker";
import { CloseScene } from "./scenes/CloseScene";
import { HookScene } from "./scenes/HookScene";
import { HourScene } from "./scenes/HourScene";
import { NightScene } from "./scenes/NightScene";

const W = 1080;
const H = 1920;
// Cambio de hora: barrido como la manecilla de un reloj.
const hora = clockWipe({ width: W, height: H });
const t14 = linearTiming({ durationInFrames: 14 });

// "Un día en tu centro": NexoKids de las 06:30 a las 21:00.
export const NexoKidsDia: React.FC = () => {
  return (
    <TransitionSeries name="Un día en tu centro">
      <TransitionSeries.Sequence name="06:30 Gancho" durationInFrames={150}>
        <HookScene />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={hora} timing={t14} />

      <TransitionSeries.Sequence name="07:30 Llegada" durationInFrames={219}>
        <HourScene
          line="02-llegada"
          tabletHeight={760}
          sky="manana"
          arc={0.15}
          fromMin={6 * 60 + 30}
          toMin={7 * 60 + 30}
          label="de la mañana"
          shots={[
            { src: "clips/agenda.mp4", at: 0, dur: 3.5, trim: 1.0, keys: [[0, 470, 190, 800], [3.5, 480, 200, 740]] },
            { src: "clips/agenda.mp4", at: 3.1, dur: 4.2, trim: 9.3, keys: [[0, 480, 300, 1000], [1.6, 480, 300, 1000], [2.8, 600, 210, 920]] },
          ]}
        >
          <Sticker at={1.3} x={70} y={1075} emoji="🎒" text="Llegan los niños" color="#38bdf8" tilt={-5} until={3.0} />
          <Sticker at={6.1} x={560} y={1085} emoji="✅" text="Presente" color="#10b981" tilt={4} />
        </HourScene>
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={hora} timing={t14} />

      <TransitionSeries.Sequence name="09:00 Terapia" durationInFrames={210}>
        <HourScene
          line="03-terapia"
          tabletHeight={760}
          sky="media-manana"
          arc={0.3}
          fromMin={7 * 60 + 30}
          toMin={9 * 60}
          label="de la mañana"
          shots={[
            { src: "clips/agenda.mp4", at: 0, dur: 3.7, trim: 4.5, keys: [[0, 1120, 180, 700], [2.6, 1150, 190, 600]] },
            { src: "clips/agenda.mp4", at: 3.3, dur: 3.7, trim: 9.9, keys: [[0, 480, 310, 760], [2.0, 520, 310, 640]] },
          ]}
        >
          <Sticker at={1.6} x={70} y={1075} emoji="🗣️" text="Terapia de lenguaje" color="#818cf8" tilt={-4} until={3.4} />
          <Sticker at={4.7} x={450} y={1085} emoji="📝" text="Registrar avance" color="#4f46e5" tilt={4} />
        </HourScene>
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={hora} timing={t14} />

      <TransitionSeries.Sequence name="12:30 Abono" durationInFrames={264}>
        <HourScene
          line="04-abono"
          sky="mediodia"
          arc={0.55}
          fromMin={9 * 60}
          toMin={12 * 60 + 30}
          label="del mediodía"
          shots={[
            { src: "clips/cobros.mp4", at: 0, dur: 4.4, trim: 1.0, keys: [[0, 480, 150, 960], [3.8, 860, 330, 760]] },
            { src: "clips/cobros.mp4", at: 4.0, dur: 4.8, trim: 7.2, keys: [[0, 700, 320, 580], [4.8, 715, 335, 540]] },
          ]}
        >
          <Sticker at={1.8} x={70} y={1270} emoji="💵" text="Abonó $30" color="#10b981" tilt={-5} until={4.4} />
          <Sticker at={4.9} x={560} y={370} emoji="⏳" text="Saldo: $50" color="#f59e0b" tilt={4} />
          <Sticker at={6.5} x={90} y={1280} emoji="📲" text="Recibo por WhatsApp" color="#25d366" tilt={-3} />
        </HourScene>
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={hora} timing={t14} />

      <TransitionSeries.Sequence name="15:00 Factura" durationInFrames={180}>
        <HourScene
          line="05-factura"
          sky="tarde"
          arc={0.7}
          fromMin={12 * 60 + 30}
          toMin={15 * 60}
          label="de la tarde"
          shots={[{ src: "clips/facturas.mp4", at: 0, dur: 6.0, trim: 0.5, keys: [[0, 480, 130, 1000], [2.6, 860, 140, 760], [5.4, 880, 150, 700]] }]}
        >
          <Sticker at={2.6} x={110} y={1280} emoji="🧾" text="Factura electrónica SRI" color="#10b981" tilt={-3} />
        </HourScene>
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={hora} timing={t14} />

      <TransitionSeries.Sequence name="16:00 Acta" durationInFrames={174}>
        <HourScene
          line="06-acta"
          sky="media-tarde"
          arc={0.78}
          fromMin={15 * 60}
          toMin={16 * 60}
          label="de la tarde"
          shots={[{ src: "clips/acta.mp4", at: 0, dur: 5.8, trim: 2.0, keys: [[0, 500, 60, 1000], [1.0, 500, 60, 1000], [1.8, 600, 50, 720], [5.7, 600, 330, 720]] }]}
        >
          <Sticker at={3.4} x={420} y={1280} emoji="🖨️" text="Imprimir o PDF" color="#4f46e5" tilt={4} />
        </HourScene>
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={hora} timing={t14} />

      <TransitionSeries.Sequence name="18:00 Cierre del día" durationInFrames={162}>
        <HourScene
          line="07-cierre-dia"
          sky="atardecer"
          arc={0.95}
          fromMin={16 * 60}
          toMin={18 * 60}
          label="de la tarde"
          shots={[{ src: "clips/reportes.mp4", at: 0, dur: 5.4, trim: 0.05, rate: 0.43, keys: [[0, 480, 40, 1160], [1.4, 480, 40, 1160], [2.2, 510, 500, 640], [3.3, 510, 500, 640], [4.1, 1070, 500, 640]] }]}
        >
          <Sticker at={2.2} x={70} y={1270} emoji="📉" text="Gastos $83,50" color="#f43f5e" tilt={-5} until={3.9} />
          <Sticker at={4.0} x={470} y={1280} emoji="📈" text="Utilidad $146,50" color="#10b981" tilt={4} />
        </HourScene>
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={hora} timing={t14} />

      <TransitionSeries.Sequence name="21:00 En casa" durationInFrames={156}>
        <NightScene />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={hora} timing={t14} />

      <TransitionSeries.Sequence name="Cierre" durationInFrames={270}>
        <CloseScene />
      </TransitionSeries.Sequence>
    </TransitionSeries>
  );
};
