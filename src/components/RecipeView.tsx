import type { Recipe } from "@/lib/types";

/** Ingredients + numbered steps. */
export function RecipeView({ recipe }: { recipe: Recipe }) {
  return (
    <div className="space-y-3 text-sm">
      {recipe.ingredients.length > 0 && (
        <div>
          <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">Ingredients</h4>
          <ul className="list-disc space-y-0.5 pl-5">
            {recipe.ingredients.map((x, i) => (
              <li key={i}>{x}</li>
            ))}
          </ul>
        </div>
      )}
      {recipe.steps.length > 0 && (
        <div>
          <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">Method</h4>
          <ol className="list-decimal space-y-1 pl-5">
            {recipe.steps.map((x, i) => (
              <li key={i}>{x}</li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}

/** Collapsed "Recipe" toggle for cards. */
export function RecipeToggle({ recipe, open }: { recipe: Recipe; open?: boolean }) {
  return (
    <details className="group mt-1.5" open={open}>
      <summary className="cursor-pointer list-none text-xs font-semibold text-ink/80 [&::-webkit-details-marker]:hidden">
        <span className="group-open:hidden">Show recipe ▾</span>
        <span className="hidden group-open:inline">Hide recipe ▴</span>
      </summary>
      <div className="mt-2">
        <RecipeView recipe={recipe} />
      </div>
    </details>
  );
}
