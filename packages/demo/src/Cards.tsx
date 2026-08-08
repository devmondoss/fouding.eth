import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { END, TITLE } from "../scenes.mjs";
import { brandAlpha, FONT_FAMILY, textAlpha, TOKENS } from "./theme";

/** Cada línea entra por su cuenta, un pelo después de la anterior. */
const useStagger = (index: number) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({
    frame: frame - index * 4,
    fps,
    config: { damping: 200, mass: 0.7 },
  });
  return { opacity: s, transform: `translateY(${interpolate(s, [0, 1], [26, 0])}px)` };
};

export const TitleCard: React.FC = () => {
  const kicker = useStagger(0);
  const title = useStagger(1);
  const subtitle = useStagger(3);

  return (
    <AbsoluteFill
      style={{
        backgroundColor: TOKENS.ink,
        justifyContent: "center",
        padding: "0 120px",
        fontFamily: FONT_FAMILY,
      }}
    >
      <Grain />

      <div style={{ ...kicker, display: "flex", alignItems: "center", gap: 16 }}>
        <span
          style={{
            width: 44,
            height: 44,
            borderRadius: 11,
            background: TOKENS.brand,
            color: TOKENS.ink,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 26,
            fontWeight: 700,
          }}
        >
          ✳
        </span>
        <span
          style={{
            color: TOKENS.brand,
            fontSize: 20,
            fontWeight: 600,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
          }}
        >
          Founding · {TITLE.kicker}
        </span>
      </div>

      <h1
        style={{
          ...title,
          margin: "38px 0 0",
          color: TOKENS.surface,
          fontSize: 92,
          lineHeight: 1.04,
          fontWeight: 600,
          letterSpacing: "-0.035em",
          whiteSpace: "pre-line",
        }}
      >
        {TITLE.title}
      </h1>

      <p
        style={{
          ...subtitle,
          margin: "34px 0 0",
          color: textAlpha(0.78),
          fontSize: 30,
          fontWeight: 400,
          letterSpacing: "-0.01em",
        }}
      >
        {TITLE.subtitle}
      </p>
    </AbsoluteFill>
  );
};

export const EndCard: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const mark = spring({ frame, fps, config: { damping: 200, mass: 0.8 } });
  const first = useStagger(3);
  const second = useStagger(5);

  return (
    <AbsoluteFill
      style={{
        backgroundColor: TOKENS.ink,
        alignItems: "center",
        justifyContent: "center",
        gap: 26,
        fontFamily: FONT_FAMILY,
      }}
    >
      <Grain />

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 22,
          opacity: mark,
          transform: `scale(${interpolate(mark, [0, 1], [0.94, 1])})`,
        }}
      >
        <span
          style={{
            width: 62,
            height: 62,
            borderRadius: 15,
            background: TOKENS.brand,
            color: TOKENS.ink,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 36,
            fontWeight: 700,
          }}
        >
          ✳
        </span>
        <span
          style={{
            color: TOKENS.surface,
            fontSize: 76,
            fontWeight: 600,
            letterSpacing: "-0.035em",
          }}
        >
          {END.title}
        </span>
      </div>

      <p style={{ ...first, margin: 0, color: TOKENS.brand, fontSize: 27, fontWeight: 500 }}>
        {END.lines[0]}
      </p>
      <p style={{ ...second, margin: 0, color: textAlpha(0.62), fontSize: 23 }}>
        {END.lines[1]}
      </p>
    </AbsoluteFill>
  );
};

/**
 * La tinta plana a 1080p produce bandas al comprimir a h264. Un degradado
 * radial muy tenue le da al codec algo que hacer y las elimina.
 */
const Grain: React.FC = () => (
  <AbsoluteFill
    style={{
      background: `radial-gradient(120% 90% at 78% 8%, ${brandAlpha(0.09)} 0%, transparent 62%)`,
    }}
  />
);
