import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { brandAlpha, FONT_FAMILY, inkAlpha, TOKENS } from "./theme";

/**
 * Capa fija sobre los clips: marca, capítulo y bajada. Es lo único que
 * separa una grabación de pantalla de un video — y por eso no tapa el
 * producto: banda inferior, nada encima del contenido.
 */

export const Wordmark: React.FC<{ chapter: string }> = ({ chapter }) => {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [0, 10], [0, 1], { extrapolateRight: "clamp" });

  return (
    <div
      style={{
        position: "absolute",
        top: 44,
        left: 52,
        display: "flex",
        alignItems: "center",
        gap: 14,
        opacity,
        fontFamily: FONT_FAMILY,
      }}
    >
      <span
        style={{
          width: 34,
          height: 34,
          borderRadius: 9,
          background: TOKENS.brand,
          color: TOKENS.ink,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 20,
          fontWeight: 700,
          lineHeight: 1,
        }}
      >
        ✳
      </span>
      <span
        style={{
          padding: "7px 14px",
          borderRadius: 999,
          background: inkAlpha(0.92),
          color: TOKENS.brand,
          fontSize: 16,
          fontWeight: 600,
          letterSpacing: "0.04em",
          textTransform: "uppercase",
        }}
      >
        {chapter}
      </span>
    </div>
  );
};

export const Caption: React.FC<{ text: string }> = ({ text }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Entra con resorte para que la banda tenga peso; el texto la sigue.
  const rise = spring({ frame, fps, config: { damping: 200, mass: 0.6 } });
  const y = interpolate(rise, [0, 1], [70, 0]);

  return (
    <div
      style={{
        position: "absolute",
        left: 52,
        right: 52,
        bottom: 58,
        transform: `translateY(${y}px)`,
        opacity: rise,
        fontFamily: FONT_FAMILY,
      }}
    >
      <div
        style={{
          display: "inline-block",
          maxWidth: 1300,
          background: inkAlpha(0.94),
          borderLeft: `5px solid ${TOKENS.brand}`,
          borderRadius: "6px 14px 14px 6px",
          padding: "20px 30px 22px",
          color: TOKENS.surface,
          fontSize: 38,
          lineHeight: 1.22,
          fontWeight: 500,
          letterSpacing: "-0.015em",
        }}
      >
        {text}
      </div>
    </div>
  );
};

/** Barra de avance del video completo, no de la escena. */
export const Progress: React.FC<{ progress: number }> = ({ progress }) => (
  <AbsoluteFill style={{ pointerEvents: "none" }}>
    <div
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        bottom: 0,
        height: 6,
        background: brandAlpha(0.16),
      }}
    >
      <div
        style={{
          width: `${progress * 100}%`,
          height: "100%",
          background: TOKENS.brand,
        }}
      />
    </div>
  </AbsoluteFill>
);
