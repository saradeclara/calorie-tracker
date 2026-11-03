"use client";

import { Icon, cx } from "./ui";

type Tab = "today" | "weight" | "plan" | "coach" | "reflux";

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: "today", label: "Today", icon: "today" },
  { id: "weight", label: "Weight", icon: "scale" },
  { id: "plan", label: "Plan", icon: "plan" },
  { id: "coach", label: "Coach", icon: "chat" },
  { id: "reflux", label: "Reflux", icon: "flame" },
];

export function TabBar({ value, onChange }: { value: Tab; onChange: (t: Tab) => void }) {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-bg/90 backdrop-blur-xl" aria-label="Sections">
      <div className="mx-auto flex max-w-lg pb-[env(safe-area-inset-bottom)]">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => {
              onChange(t.id);
              window.scrollTo({ top: 0 });
            }}
            aria-current={value === t.id ? "page" : undefined}
            className={cx(
              "flex h-16 flex-1 flex-col items-center justify-center gap-1 text-[11px] font-medium",
              value === t.id ? "text-ink" : "text-muted",
            )}
          >
            <span
              className={cx(
                "grid h-8 w-14 place-items-center rounded-full transition-colors",
                value === t.id && "bg-brand/15 text-brand",
              )}
            >
              <Icon name={t.icon} weight={value === t.id ? "fill" : "regular"} className="h-6 w-6" />
            </span>
            {t.label}
          </button>
        ))}
      </div>
    </nav>
  );
}
