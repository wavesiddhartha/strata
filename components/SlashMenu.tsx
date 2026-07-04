"use client";

import { forwardRef, useEffect, useImperativeHandle, useState } from "react";
import type { SlashItem } from "@/lib/slashItems";

export type SlashMenuHandle = {
  onKeyDown: (args: { event: KeyboardEvent }) => boolean;
};

const SlashMenu = forwardRef<
  SlashMenuHandle,
  { items: SlashItem[]; command: (item: SlashItem) => void }
>(({ items, command }, ref) => {
  const [selected, setSelected] = useState(0);

  useEffect(() => setSelected(0), [items]);

  useImperativeHandle(ref, () => ({
    onKeyDown: ({ event }) => {
      if (event.key === "ArrowDown") {
        setSelected((s) => (s + 1) % items.length);
        return true;
      }
      if (event.key === "ArrowUp") {
        setSelected((s) => (s - 1 + items.length) % items.length);
        return true;
      }
      if (event.key === "Enter") {
        if (items[selected]) command(items[selected]);
        return true;
      }
      return false;
    },
  }));

  if (items.length === 0) {
    return (
      <div className="w-64 rounded-xl border border-line bg-white px-3 py-2 text-sm text-ink/40 shadow-lg">
        No matches
      </div>
    );
  }

  return (
    <div className="w-64 overflow-hidden rounded-xl border border-line bg-white py-1 shadow-[0_12px_32px_rgba(26,26,26,0.12)]">
      {items.map((item, i) => {
        const Icon = item.icon;
        return (
          <button
            key={item.title}
            onMouseDown={(e) => {
              e.preventDefault();
              command(item);
            }}
            onMouseEnter={() => setSelected(i)}
            className={`flex w-full items-center gap-3 px-3 py-2 text-left transition-colors ${
              i === selected ? "bg-card" : ""
            }`}
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-md border border-line bg-cream text-ink/60">
              <Icon size={15} />
            </span>
            <span>
              <span className="block text-sm text-ink">{item.title}</span>
              <span className="block text-xs text-ink/40">{item.description}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
});

SlashMenu.displayName = "SlashMenu";
export default SlashMenu;
