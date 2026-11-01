"use client";

import { useState } from "react";
import { db, relog } from "@/lib/db";
import { FoodEntry, MEALS, Meal } from "@/lib/types";
import { Button, Icon, Segmented, Sheet } from "./ui";
import { EntryForm } from "./EntryForm";

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

  return (
    <Sheet open onClose={onClose} title="Edit entry">
      <div className="space-y-4">
        <Segmented size="sm" value={meal} onChange={setMeal} options={MEALS.map((m) => ({ id: m.id, label: m.label }))} />
        {entry.brand && <p className="text-sm text-muted">{entry.brand}</p>}
        <EntryForm
          initial={entry}
          submitLabel="Save"
          onSubmit={async (v) => {
            await db.entries.update(entry.id!, { ...v, meal });
            notify("Saved");
            onClose();
          }}
          extra={
            <div className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                variant="secondary"
                onClick={async () => {
                  await relog(entry, entry.date, meal);
                  notify("Added again");
                  onClose();
                }}
              >
                <Icon name="plus" className="h-4 w-4" /> Log again
              </Button>
              <Button
                type="button"
                variant="danger"
                onClick={async () => {
                  await db.entries.delete(entry.id!);
                  notify("Deleted");
                  onClose();
                }}
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
