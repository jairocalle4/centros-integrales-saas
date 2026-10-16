import "./theme";
import { Composition, Folder } from "remotion";
import { NexoKidsDia } from "./NexoKidsDia";
import { CloseScene } from "./scenes/CloseScene";
import { HookScene } from "./scenes/HookScene";
import { NightScene } from "./scenes/NightScene";

// 9 escenas (150+219+210+264+180+174+162+156+270) menos 8 transiciones de 14 cuadros.
export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition id="NexoKidsDia" component={NexoKidsDia} durationInFrames={1673} fps={30} width={1080} height={1920} />
      <Folder name="Escenas">
        <Composition id="Gancho" component={HookScene} durationInFrames={150} fps={30} width={1080} height={1920} />
        <Composition id="EnCasa" component={NightScene} durationInFrames={156} fps={30} width={1080} height={1920} />
        <Composition id="Cierre" component={CloseScene} durationInFrames={270} fps={30} width={1080} height={1920} />
      </Folder>
    </>
  );
};
