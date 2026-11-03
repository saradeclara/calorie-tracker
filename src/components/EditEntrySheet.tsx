"use client";

import { useState } from "react";
import { deleteEntry, relog, updateEntry } from "@/lib/db";
import { FoodEntry, MEALS, Meal } from "@/lib/types";
import { Button, Icon, Segmented, Sheet } from "./ui";
import { EntryForm } from "./EntryForm";
import { RefluxSection } from "./RefluxSection";
import { RecipeView } from "./RecipeView";

export function EditEntrySheet({
  entry,
  onClose,
  notify,
}: {
  entry: FoodEntry;
  onClose: () => void;
  notify: (msg: string) => void;
}) {
  const [meal, setMeal] = useState<Meal>(entry.meal);

  // Close the sheet straight away, then do the write. The UI never waits on
  // IndexedDB, and if a write fails you still get told about it.
  const closeThen = (work: () => Promise<unknown>, done: string) => {
    onClose();
    work()
      .then(() => notify(done))
      .catch((e) => {
        console.error(e);
        notify(`Couldn't update: ${(e as Error)?.message ?? e}`);
      });
  };

  return (
    <Sheet open onClose={onClose} title={entry.name}>
      <div className="space-y-4">
        <Segmented size="sm" value={meal} onChange={setMeal} options={MEALS.map((m) => ({ id: m.id, label: m.label }))} />
        <RefluxSection entry={entry} notify={notify} />
        {entry.brand && <p className="text-sm text-muted">{entry.brand}</p>}
        {entry.recipe && (
          <section aria-label="Recipe" className="rounded-2xl bg-soft p-4">
            {entry.recipe.partOf && (
              <p className="mb-3 text-sm">
                Part of <span className="font-semibold">{entry.recipe.partOf}</span>
              </p>
            )}
            <RecipeView recipe={entry.recipe} />
          </section>
        )}
        <EntryForm
          initial={entry}
          submitLabel="Save"
          onSubmit={async (v) => closeThen(() => updateEntry(entry, { ...v, meal }), "Saved")}
          extra={
            <div className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                variant="secondary"
                onClick={() => closeThen(() => relog(entry, entry.date, meal), "Added again")}
              >
                <Icon name="plus" className="h-4 w-4" /> Log again
              </Button>
              <Button
                type="button"
                variant="danger"
                onClick={() => closeThen(() => deleteEntry(entry.id!), "Deleted")}
              >
                <Icon name="trash" className="h-4 w-4" /> Delete
              </Button>
            </div>
          }
        />
      </div>
    </Sheet>
  );
}
