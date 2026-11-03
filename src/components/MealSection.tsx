import { FoodEntry, Meal } from "@/lib/types";
import type { FoodIndex } from "@/lib/foods";
import { TriggerDot } from "./Reflux";
import { Icon, MacroLine } from "./ui";

const SOURCE_ICON = { barcode: "barcode", ai: "sparkle", manual: "pencil" } as const;

export function MealSection({
  meal,
  label,
  entries,
  onAdd,
  onEdit,
  foods,
}: {
  meal: Meal;
  foods: FoodIndex;
  label: string;
  entries: FoodEntry[];
  onAdd: () => void;
  onEdit: (e: FoodEntry) => void;
}) {
  const kcal = entries.reduce((a, e) => a + e.kcal, 0);
  return (
    <section aria-label={label} className="pt-3">
      <div className="flex items-center gap-2.5 px-1 pb-2">
        <Icon name={meal} weight="duotone" className="h-6 w-6 text-ink" />
        <h3 className="font-display flex-1 text-xl font-semibold">{label}</h3>
        {entries.length > 0 && <span className="tabular text-sm text-muted">{Math.round(kcal)} kcal</span>}
        <button
          onClick={onAdd}
          className="grid h-8 w-8 place-items-center rounded-full bg-card text-ink active:scale-90"
          aria-label={`Add to ${label}`}
        >
          <Icon name="plus" weight="bold" className="h-4 w-4" />
        </button>
      </div>
      {entries.length === 0 ? (
        <button
          onClick={onAdd}
          className="flex w-full items-center justify-center rounded-[1.375rem] border border-dashed border-line py-4 text-sm text-muted active:bg-card"
        >
          Nothing logged yet
        </button>
      ) : (
        <ul className="divide-y divide-line overflow-hidden rounded-[1.375rem] bg-card">
          {entries.map((e) => (
            <li key={e.id}>
              <button onClick={() => onEdit(e)} className="flex w-full items-center gap-3 px-4 py-3 text-left active:bg-soft">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-soft text-muted">
                  <Icon name={SOURCE_ICON[e.source]} className="h-[18px] w-[18px]" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="truncate font-medium">{e.name}</span>
                    {e.recipe && (
                      <span title="Has recipe" aria-label="Has recipe" role="img" className="shrink-0 text-muted">
                        <Icon name="book" className="h-4 w-4" />
                      </span>
                    )}
                    {(() => {
                      const f = e.foodId !== undefined ? foods.byId.get(e.foodId) : undefined;
                      return f?.trigger ? <TriggerDot food={f} /> : null;
                    })()}
                  </div>
                  <div className="mt-0.5 flex gap-2.5 overflow-hidden text-xs whitespace-nowrap text-muted">
                    {(e.brand || e.portion) && (
                      <span className="truncate">{[e.brand, e.portion].filter(Boolean).join(", ")}</span>
                    )}
                    <MacroLine n={e} className="shrink-0" />
                  </div>
                </div>
                <div className="font-display tabular shrink-0 text-lg font-semibold">{Math.round(e.kcal)}</div>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
