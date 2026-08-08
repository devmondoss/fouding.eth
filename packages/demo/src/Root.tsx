import { Composition } from "remotion";
import { FPS, OUTPUT, totalFrames } from "../scenes.mjs";
import manifest from "../public/clips/manifest.json";
import { Demo } from "./Demo";

// El tamaño manda desde lo que se grabó, no desde el default: si se
// capturó con DEMO_VIEWPORT, la composición lo sigue sola.
const SIZE = (manifest as { size?: { width: number; height: number } }).size ?? OUTPUT;

export const RemotionRoot: React.FC = () => {
  return (
    <Composition
      id="Demo"
      component={Demo}
      // La duración no se escribe acá: sale del guion. Alargar una escena
      // en scenes.mjs alarga el video sin tocar este archivo.
      durationInFrames={totalFrames()}
      fps={FPS}
      width={SIZE.width}
      height={SIZE.height}
    />
  );
};
