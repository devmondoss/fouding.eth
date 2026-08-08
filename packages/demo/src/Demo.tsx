import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { linearTiming, TransitionSeries } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import {
  beatsDurationMs,
  END,
  msToFrames,
  SCENES,
  TITLE,
  TRANSITION_FRAMES,
} from "../scenes.mjs";
import manifest from "../public/clips/manifest.json";
import { EndCard, TitleCard } from "./Cards";
import { ClipScene, type Clip } from "./ClipScene";
import { Progress } from "./Chrome";
import { TOKENS } from "./theme";
import "./theme";

const CLIPS = new Map<string, Clip>((manifest.clips as Clip[]).map((c) => [c.id, c]));

/**
 * El montaje. No hay una lista de escenas acá: se deriva de scenes.mjs,
 * el mismo archivo que ejecutó el capturador. Un video y una grabación
 * que se pueden desincronizar es exactamente el bug que esto evita.
 *
 * Las transiciones se solapan, así que la duración total es la suma de
 * las partes MENOS el solape — la cuenta vive en `totalFrames()`.
 */
export const Demo: React.FC = () => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();

  // Arrays anidados: React los aplana, y TransitionSeries necesita sus
  // hijos planos y alternados (secuencia, transición, secuencia…). Un
  // <Fragment> acá rompe esa validación.
  const scenes = SCENES.flatMap((scene) => [
    <TransitionSeries.Transition
      key={`t-${scene.id}`}
      timing={linearTiming({ durationInFrames: TRANSITION_FRAMES })}
      presentation={fade()}
    />,
    <TransitionSeries.Sequence
      key={scene.id}
      durationInFrames={msToFrames(beatsDurationMs(scene))}
    >
      <ClipScene
        clip={CLIPS.get(scene.id)}
        sceneId={scene.id}
        chapter={scene.chapter}
        caption={scene.caption}
      />
    </TransitionSeries.Sequence>,
  ]);

  return (
    <AbsoluteFill style={{ backgroundColor: TOKENS.ink }}>
      <TransitionSeries>
        <TransitionSeries.Sequence durationInFrames={msToFrames(TITLE.durationMs)}>
          <TitleCard />
        </TransitionSeries.Sequence>

        {scenes}

        <TransitionSeries.Transition
          timing={linearTiming({ durationInFrames: TRANSITION_FRAMES })}
          presentation={fade()}
        />
        <TransitionSeries.Sequence durationInFrames={msToFrames(END.durationMs)}>
          <EndCard />
        </TransitionSeries.Sequence>
      </TransitionSeries>

      <Progress progress={frame / Math.max(1, durationInFrames - 1)} />
    </AbsoluteFill>
  );
};
