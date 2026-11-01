import { FoodEntry, Meal } from "@/lib/types";
import { round } from "@/lib/nutrition";
import { Icon } from "./ui";

const SOURCE_ICON = { barcode: "barcode", ai: "sparkle", manual: "pencil" } as const;

export function MealSection({
  label,
  entries,
  onAdd,
  onEdit,
}: {
  meal: Meal;
  label: string;
  entries: FoodEntry[];
  onAdd: () => void;
  onEdit: (e: FoodEntry) => void;
}) {
  const kcal = entries.reduce((a, e) => a + e.kcal, 0);
  return (
    <section className="rounded-3xl bg-card shadow-sm">
      <div className="flex items-center justify-between px-5 pt-4 pb-2">
        <h3 className="font-semibold">{label}</h3>
        <div className="flex items-center gap-3">
          {entries.length > 0 && <span className="tabular text-sm text-muted">{Math.round(kcal)} kcal</span>}
          <button
            onClick={onAdd}
            className="grid h-8 w-8 place-items-center rounded-full bg-soft text-ink active:scale-90"
            aria-label={`Add to ${label}`}
          >
            <Icon name="plus" className="h-4 w-4" />
          </button>
        </div>
      </div>
      {entries.length === 0 ? (
        <p className="px-5 pb-4 text-sm text-muted">Nothing logged yet</p>
      ) : (
        <ul className="pb-2">
          {entries.map((e) => (
            <li key={e.id}>
              <button
                onClick={() => onEdit(e)}
                className="flex w-full items-center gap-3 px-5 py-2.5 text-left active:bg-soft"
              >
                <Icon name={SOURCE_ICON[e.source]} className="h-4 w-4 shrink-0 text-muted" />
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">{e.name}</div>
                  <div className="tabular truncate text-xs text-muted">
                    {[e.brand, e.portion].filter(Boolean).join(" · ")}
                    {(e.brand || e.portion) && " · "}P {round(e.protein, 0)} · C {round(e.carbs, 0)} · F{" "}
                    {round(e.fat, 0)} · Fi {round(e.fibre, 0)}
                  </div>
                </div>
                <div className="tabular shrink-0 font-semibold">{Math.round(e.kcal)}</div>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
