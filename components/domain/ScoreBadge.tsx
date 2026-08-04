import { GRADE_COLOR } from "@/lib/underwriting";
import type { Grade } from "@/lib/types";

export function ScoreBadge({
  score,
  grade,
  size = "md",
}: {
  score: number;
  grade: Grade;
  size?: "sm" | "md";
}) {
  const color = GRADE_COLOR[grade];
  const box = size === "sm" ? "h-6 w-6 text-[11.5px]" : "h-9 w-9 text-[15px]";

  return (
    <div className="flex items-center gap-2">
      <span
        className={`flex ${box} shrink-0 items-center justify-center rounded-[6px] font-bold text-white`}
        style={{ backgroundColor: color }}
      >
        {grade}
      </span>
      {size === "sm" ? (
        <span className="text-[12px] text-low">
          Riesgo <span className="num text-mid">{score}</span>
        </span>
      ) : (
        <div>
          <div className="label">Calificación</div>
          <div className="num text-[13.5px] font-semibold text-hi">
            {score}
            <span className="font-normal text-low"> / 1000</span>
          </div>
        </div>
      )}
    </div>
  );
}
