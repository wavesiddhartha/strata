"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Loader2, X, Check, AlertCircle } from "lucide-react";
import type { AITask } from "@/lib/aiTaskQueue";

export default function ActivityIndicator({ tasks }: { tasks: AITask[] }) {
  const [expanded, setExpanded] = useState(false);
  if (tasks.length === 0) return null;

  const active = tasks.filter((t) => t.status === "queued" || t.status === "running");

  return (
    <div className="no-print fixed bottom-6 right-6 z-40">
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.97 }}
            transition={{ duration: 0.15 }}
            className="mb-2 w-64 overflow-hidden rounded-xl border border-line bg-white shadow-[0_12px_32px_rgba(26,26,26,0.12)]"
          >
            {tasks.map((t) => (
              <div key={t.id} className="flex items-center justify-between gap-2 border-b border-line/60 px-3 py-2 last:border-0">
                <span className="flex items-center gap-2 text-xs text-ink/70">
                  {(t.status === "queued" || t.status === "running") && (
                    <Loader2 size={12} className="animate-spin text-ink/40" />
                  )}
                  {t.status === "done" && <Check size={12} className="text-green-700/70" />}
                  {(t.status === "error" || t.status === "cancelled") && <AlertCircle size={12} className="text-rust/70" />}
                  <span className="truncate">{t.label}</span>
                </span>
                {(t.status === "queued" || t.status === "running") && (
                  <button onClick={() => t.cancel()} className="shrink-0 text-ink/30 transition-colors hover:text-ink" aria-label="Cancel">
                    <X size={12} />
                  </button>
                )}
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      <button
        onClick={() => setExpanded((v) => !v)}
        className="flex items-center gap-2 rounded-pill bg-ink px-3.5 py-2 text-xs font-medium text-cream shadow-lg transition-transform hover:scale-[1.02]"
      >
        {active.length > 0 ? (
          <>
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-cream" />
            Working on {active.length} {active.length === 1 ? "thing" : "things"}
          </>
        ) : (
          <>
            <Check size={12} />
            Done
          </>
        )}
      </button>
    </div>
  );
}
