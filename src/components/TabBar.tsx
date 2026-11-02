"use client";

import { Icon, cx } from "./ui";

type Tab = "today" | "weight" | "reflux";

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: "today", label: "Today", icon: "today" },
  { id: "weight", label: "Weight", icon: "scale" },
  { id: "reflux", label: "Reflux", icon: "flame" },
];

export function TabBar({ value, onChange }: { value: Tab; onChange: (t: Tab) => void }) {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-bg/95 backdrop-blur" aria-label="Sections">
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
              "flex h-16 flex-1 flex-col items-center justify-center gap-0.5 text-xs font-medium",
              value === t.id ? "text-ink" : "text-muted",
            )}
          >
            <Icon name={t.icon} className="h-6 w-6" />
            {t.label}
          </button>
        ))}
      </div>
    </nav>
  );
}
