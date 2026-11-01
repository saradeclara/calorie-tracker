import { Nutrients } from "@/lib/types";
import { round } from "@/lib/nutrition";

export function NutrientPreview({ values }: { values: Nutrients }) {
  const cells = [
    { label: "kcal", value: Math.round(values.kcal), color: "var(--accent)" },
    { label: "Protein", value: round(values.protein, 1), color: "var(--protein)" },
    { label: "Carbs", value: round(values.carbs, 1), color: "var(--carbs)" },
    { label: "Fat", value: round(values.fat, 1), color: "var(--fat)" },
    { label: "Fibre", value: round(values.fibre, 1), color: "var(--fibre)" },
  ];
  return (
    <div className="grid grid-cols-5 gap-1 rounded-2xl bg-card p-3 text-center">
      {cells.map((c) => (
        <div key={c.label}>
          <div className="tabular text-lg font-semibold" style={{ color: c.color }}>
            {c.value}
          </div>
          <div className="text-[11px] text-muted">{c.label}</div>
        </div>
      ))}
    </div>
  );
}
