import { Composition } from "remotion";
import { FPS, OUTPUT, totalFrames } from "../scenes.mjs";
import { Demo } from "./Demo";

export const RemotionRoot: React.FC = () => {
  return (
    <Composition
      id="Demo"
      component={Demo}
      // La duración no se escribe acá: sale del guion. Alargar una escena
      // en scenes.mjs alarga el video sin tocar este archivo.
      durationInFrames={totalFrames()}
      fps={FPS}
      width={OUTPUT.width}
      height={OUTPUT.height}
    />
  );
};
