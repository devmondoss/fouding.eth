import {
  AbsoluteFill,
  interpolate,
  OffthreadVideo,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { Caption, Wordmark } from "./Chrome";
import { FONT_FAMILY, TOKENS } from "./theme";

export type Clip = {
  id: string;
  file: string;
  /** Andamiaje grabado antes de lo que se ve (navegar, abrir la ficha). */
  trimMs: number;
  visibleMs: number;
};

/**
 * Una escena = el clip real de la app + la capa de marca encima.
 *
 * El clip se recorta por `trimMs`, no por corte manual: el capturador
 * anota en qué milisegundo terminó el andamiaje y acá se traduce a
 * frames. Así el guion se puede reordenar sin volver a cortar nada.
 */
export const ClipScene: React.FC<{
  clip: Clip | undefined;
  sceneId: string;
  chapter: string;
  caption: string;
}> = ({ clip, sceneId, chapter, caption }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  // Deriva lentísima. Suficiente para que un panel quieto no se lea como
  // una captura de pantalla pegada; no tanto como para marear.
  const scale = interpolate(frame, [0, durationInFrames], [1, 1.022]);

  return (
    <AbsoluteFill style={{ backgroundColor: TOKENS.ink }}>
      {clip ? (
        <AbsoluteFill style={{ transform: `scale(${scale})` }}>
          <OffthreadVideo
            src={staticFile(clip.file)}
            trimBefore={Math.round((clip.trimMs / 1000) * fps)}
            muted
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        </AbsoluteFill>
      ) : (
        <MissingClip sceneId={sceneId} />
      )}

      <Wordmark chapter={chapter} />
      <Caption text={caption} />
    </AbsoluteFill>
  );
};

/**
 * Sin capturar todavía. Un hueco explícito deja abrir `yarn studio` y
 * trabajar el montaje antes de tener los clips, en vez de un error de
 * bundle por un archivo que no existe.
 */
const MissingClip: React.FC<{ sceneId: string }> = ({ sceneId }) => (
  <AbsoluteFill
    style={{
      alignItems: "center",
      justifyContent: "center",
      gap: 18,
      fontFamily: FONT_FAMILY,
      color: TOKENS.brand,
    }}
  >
    <div style={{ fontSize: 40, fontWeight: 600, letterSpacing: "-0.02em" }}>{sceneId}</div>
    <div style={{ fontSize: 22, opacity: 0.65 }}>sin capturar — corré `yarn capture`</div>
  </AbsoluteFill>
);
