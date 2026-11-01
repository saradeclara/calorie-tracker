"use client";

import { useState } from "react";
import { MEALS, Meal } from "@/lib/types";
import { Icon, Segmented, Sheet } from "./ui";
import { ScanTab } from "./ScanTab";
import { AiTab } from "./AiTab";
import { EntryForm } from "./EntryForm";
import { RecentTab } from "./RecentTab";
import { logEntry } from "@/lib/db";

type Tab = "scan" | "ai" | "manual" | "recent";

const TAB_KEY = "ct:lastTab";

function readTab(): Tab {
  try {
    const t = localStorage.getItem(TAB_KEY);
    if (t === "scan" || t === "ai" || t === "manual" || t === "recent") return t;
  } catch {}
  return "ai";
}

export function AddFoodSheet({
  date,
  initialMeal,
  onClose,
  notify,
}: {
  date: string;
  initialMeal: Meal;
  onClose: () => void;
  notify: (msg: string) => void;
}) {
  const [meal, setMeal] = useState<Meal>(initialMeal);
  // The sheet only ever renders client-side, so localStorage is safe here.
  const [tab, setTab] = useState<Tab>(readTab);
  const [prefill, setPrefill] = useState<{ barcode?: string; name?: string }>({});

  const changeTab = (t: Tab) => {
    setTab(t);
    try {
      localStorage.setItem(TAB_KEY, t);
    } catch {}
  };

  const done = (msg: string) => {
    notify(msg);
    onClose();
  };

  return (
    <Sheet open onClose={onClose} title="Add food">
      <div className="space-y-3">
        <Segmented
          size="sm"
          value={meal}
          onChange={setMeal}
          options={MEALS.map((m) => ({ id: m.id, label: m.label }))}
        />
        <Segmented
          value={tab}
          onChange={changeTab}
          options={[
            { id: "scan", label: <><Icon name="barcode" className="h-4 w-4" />Scan</> },
            { id: "ai", label: <><Icon name="sparkle" className="h-4 w-4" />AI</> },
            { id: "recent", label: <><Icon name="clock" className="h-4 w-4" />Recent</> },
            { id: "manual", label: <><Icon name="pencil" className="h-4 w-4" />Manual</> },
          ]}
        />
        <div className="pt-2">
          {tab === "scan" && (
            <ScanTab
              date={date}
              meal={meal}
              onAdded={done}
              onManual={(barcode) => {
                setPrefill({ barcode });
                changeTab("manual");
              }}
              onAi={() => changeTab("ai")}
            />
          )}
          {tab === "ai" && <AiTab date={date} meal={meal} onAdded={done} />}
          {tab === "recent" && <RecentTab date={date} meal={meal} onAdded={done} />}
          {tab === "manual" && (
            <EntryForm
              key={prefill.barcode ?? "manual"}
              initial={{ name: prefill.name ?? "" }}
              submitLabel="Add"
              onSubmit={async (values) => {
                await logEntry({
                  ...values,
                  date,
                  meal,
                  source: "manual",
                  barcode: prefill.barcode,
                });
                done(`Added ${values.name}`);
              }}
            />
          )}
        </div>
      </div>
    </Sheet>
  );
}
