import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { brandAlpha, FONT_FAMILY, inkAlpha, TOKENS } from "./theme";

/**
 * Capa fija sobre los clips. Todo vive en UN bloque abajo a la izquierda,
 * y no repartido por la pantalla: la app ya trae su propio encabezado con
 * el logo arriba a la izquierda, así que una marca del video en esa
 * esquina se le montaba encima y se leía como dos productos. Un solo
 * lower-third también deja el resto del cuadro libre para lo que importa,
 * que es el producto.
 */
export const LowerThird: React.FC<{ chapter: string; caption: string }> = ({
  chapter,
  caption,
}) => {
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
      {/* El capítulo es un chip de RELLENO chartreuse con tinta encima, no
          una barra de acento al costado del bloque. Dos motivos: el borde
          lateral grueso es el tic visual más gastado que hay, y globals.css
          ya fija que el chartreuse se usa como superficie de relleno con
          --brand-ink encima. El chip ancla el bloque igual, y lo hace con
          la gramática que el producto ya tiene. */}
      {/* inline-block para que el bloque se ajuste al texto: a ancho fijo,
          un caption corto deja una banda vacía que parece un error. */}
      <div style={{ display: "inline-block", maxWidth: 1320 }}>
        <div
          style={{
            display: "inline-flex",
            background: TOKENS.brand,
            color: TOKENS.ink,
            borderRadius: "10px 10px 0 0",
            padding: "7px 16px 6px",
            fontSize: 17,
            fontWeight: 700,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
          }}
        >
          {chapter}
        </div>

        <div
          style={{
            background: inkAlpha(0.94),
            // Esquina superior izquierda a cero: el chip se apoya ahí y
            // los dos leen como una sola pieza, no como dos apilados.
            borderRadius: "0 14px 14px 14px",
            padding: "20px 28px 22px",
            color: TOKENS.surface,
            fontSize: 38,
            lineHeight: 1.22,
            fontWeight: 500,
            letterSpacing: "-0.015em",
          }}
        >
          {caption}
        </div>
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
