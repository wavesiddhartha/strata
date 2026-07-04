"use client";

import { useRef, useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, Check } from "lucide-react";

export default function Toolbar({
  title,
  onTitleChange,
  onAsk,
  onResearch,
  onExportMarkdown,
  onExportDocx,
  onExportPdf,
  onPrint,
  onFocusMode,
  panelOpen,
  panelMode,
  wordCount,
  justSaved,
}: {
  title: string;
  onTitleChange: (v: string) => void;
  onAsk: () => void;
  onResearch: () => void;
  onExportMarkdown: () => void;
  onExportDocx: () => void;
  onExportPdf: () => void;
  onPrint: () => void;
  onFocusMode: () => void;
  panelOpen: boolean;
  panelMode: "ask" | "research";
  wordCount: number;
  justSaved: boolean;
}) {
  const [exportOpen, setExportOpen] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);
  const exportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (exportRef.current && !exportRef.current.contains(e.target as Node)) setExportOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  async function handlePdfClick() {
    setExportOpen(false);
    setPdfBusy(true);
    try {
      await onExportPdf();
    } finally {
      setPdfBusy(false);
    }
  }

  return (
    <div className="sticky top-0 z-10 flex items-center justify-between bg-cream/90 px-8 py-4 backdrop-blur-sm">
      <div className="flex items-center gap-3">
        <input
          value={title}
          onChange={(e) => onTitleChange(e.target.value)}
          placeholder="Untitled document"
          className="max-w-sm bg-transparent font-serif text-lg text-ink/80 outline-none placeholder:text-ink/30"
        />
        <span className="text-xs text-ink/30">
          {wordCount} {wordCount === 1 ? "word" : "words"}
        </span>
        <AnimatePresence>
          {justSaved && (
            <motion.span
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex items-center gap-1 text-xs text-ink/30"
            >
              <Check size={11} /> Saved
            </motion.span>
          )}
        </AnimatePresence>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={onAsk}
          className={`rounded-pill px-3.5 py-1.5 text-xs font-medium transition-colors ${
            panelOpen && panelMode === "ask" ? "bg-ink text-cream" : "text-ink/60 hover:text-ink"
          }`}
        >
          Ask
        </button>
        <button
          onClick={onResearch}
          className={`rounded-pill px-3.5 py-1.5 text-xs font-medium transition-colors ${
            panelOpen && panelMode === "research" ? "bg-ink text-cream" : "text-ink/60 hover:text-ink"
          }`}
        >
          Research
        </button>

        <div className="mx-1 h-4 w-px bg-line" />

        <button onClick={onFocusMode} className="rounded-pill px-3 py-1.5 text-xs text-ink/50 transition-colors hover:text-ink">
          Focus
        </button>

        <div className="relative" ref={exportRef}>
          <button
            onClick={() => setExportOpen((v) => !v)}
            disabled={pdfBusy}
            className="flex items-center gap-1 rounded-pill bg-ink px-3.5 py-1.5 text-xs font-medium text-cream transition-colors hover:bg-[#2b2b2b] disabled:opacity-60"
          >
            {pdfBusy ? "Preparing…" : "Export"}
            <motion.span animate={{ rotate: exportOpen ? 180 : 0 }} transition={{ duration: 0.15 }}>
              <ChevronDown size={12} />
            </motion.span>
          </button>
          {exportOpen && (
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.15 }}
              className="absolute right-0 top-full mt-2 w-56 rounded-xl border border-line bg-[#F7F5EE] py-1 shadow-[0_8px_24px_rgba(0,0,0,0.08)]"
            >
              <button onClick={handlePdfClick} className="block w-full px-4 py-2 text-left text-sm text-ink transition-colors hover:bg-card">
                Download PDF
              </button>
              <button
                onClick={() => {
                  onExportDocx();
                  setExportOpen(false);
                }}
                className="block w-full px-4 py-2 text-left text-sm text-ink transition-colors hover:bg-card"
              >
                Download Word (.docx)
              </button>
              <button
                onClick={() => {
                  onExportMarkdown();
                  setExportOpen(false);
                }}
                className="block w-full px-4 py-2 text-left text-sm text-ink transition-colors hover:bg-card"
              >
                Download Markdown (.md)
              </button>
              <div className="my-1 h-px bg-line/70" />
              <button
                onClick={() => {
                  onPrint();
                  setExportOpen(false);
                }}
                className="block w-full px-4 py-2 text-left text-sm text-ink/60 transition-colors hover:bg-card hover:text-ink"
              >
                Print (browser dialog)
              </button>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
}
