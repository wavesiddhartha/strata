"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import Typography from "@tiptap/extension-typography";
import Link from "@tiptap/extension-link";
import CharacterCount from "@tiptap/extension-character-count";

import Nav from "@/components/Nav";
import Toolbar from "@/components/Toolbar";
import DocEditor from "@/components/Editor";
import BubbleToolbar, { type AIAction } from "@/components/BubbleToolbar";
import SidePanel, { type PanelMode } from "@/components/SidePanel";
import ActivityIndicator from "@/components/ActivityIndicator";
import { escapeHtml } from "@/lib/editorStream";
import { docToMarkdown } from "@/lib/markdown";
import { useAutosave, loadSavedDocument } from "@/lib/useAutosave";
import { useAITaskQueue } from "@/lib/aiTaskQueue";
import { SlashCommand } from "@/lib/slashCommand";
import { CONTINUE_WRITING_EVENT, type ContinueWritingDetail } from "@/lib/slashItems";

type Source = { id: string; title: string; url: string };

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function safeFilename(title: string, ext: string) {
  return `${(title || "untitled").trim().replace(/[^a-z0-9\-_ ]/gi, "").slice(0, 60) || "untitled"}.${ext}`;
}

const AI_ACTION_LABELS: Record<AIAction | "continue", string> = {
  expand: "Expanding a passage",
  simplify: "Simplifying a passage",
  fix: "Fixing a passage",
  ask: "Asking about a passage",
  continue: "Continuing writing",
};

export default function Home() {
  const [title, setTitle] = useState("");
  const [panelOpen, setPanelOpen] = useState(false);
  const [panelMode, setPanelMode] = useState<PanelMode>("ask");
  const [panelInput, setPanelInput] = useState("");
  const [focusMode, setFocusMode] = useState(false);
  const restored = useRef(false);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit,
      Typography,
      Link.configure({ openOnClick: false, autolink: true }),
      CharacterCount,
      SlashCommand,
      Placeholder.configure({
        placeholder: ({ editor: ed }) =>
          ed.isEmpty ? "Start writing, or press \u2018/\u2019 for a block, or ask Strata for help \u2014" : "",
      }),
    ],
    editorProps: {
      attributes: { class: "strata-prose focus:outline-none" },
    },
  });

  const { tasks, enqueueRewrite } = useAITaskQueue(editor);

  // Restore any autosaved document once, right after the editor mounts.
  useEffect(() => {
    if (!editor || restored.current) return;
    restored.current = true;
    const saved = loadSavedDocument();
    if (saved && saved.content) {
      try {
        editor.commands.setContent(saved.content as any);
        setTitle(saved.title ?? "");
      } catch {
        // Corrupt/incompatible saved content — start fresh rather than crash.
      }
    }
  }, [editor]);

  const justSaved = useAutosave(editor, title);

  const getDocText = useCallback(() => (editor ? editor.getText() : ""), [editor]);
  const wordCount = editor?.storage.characterCount?.words() ?? 0;

  function openPanel(mode: PanelMode) {
    if (panelOpen && panelMode === mode) {
      setPanelOpen(false);
      return;
    }
    setPanelMode(mode);
    setPanelOpen(true);
  }

  // Global keyboard shortcuts: Cmd/Ctrl+K -> Ask, Cmd/Ctrl+Shift+K -> Research, Escape -> close panel.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key.toLowerCase() === "k") {
        e.preventDefault();
        openPanel(e.shiftKey ? "research" : "ask");
      } else if (e.key === "Escape" && panelOpen) {
        setPanelOpen(false);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [panelOpen, panelMode]);

  // Bridge from the "Continue writing" slash command (a plain function with
  // no hook access) into the task queue this component owns.
  useEffect(() => {
    function onContinue(e: Event) {
      const { pos, context } = (e as CustomEvent<ContinueWritingDetail>).detail;
      enqueueRewrite(context, { from: pos, to: pos }, "continue", AI_ACTION_LABELS.continue);
    }
    window.addEventListener(CONTINUE_WRITING_EVENT, onContinue);
    return () => window.removeEventListener(CONTINUE_WRITING_EVENT, onContinue);
  }, [enqueueRewrite]);

  function handleAIAction(action: AIAction, text: string, range: { from: number; to: number }) {
    if (!editor) return;

    if (action === "ask") {
      setPanelMode("ask");
      setPanelOpen(true);
      setPanelInput(`About this passage \u2014 "${text.length > 80 ? text.slice(0, 80) + "\u2026" : text}" \u2014 `);
      return;
    }

    // Queued, not awaited — you can select more text and request another
    // edit immediately without waiting for this one to finish.
    enqueueRewrite(text, range, action, AI_ACTION_LABELS[action]);
  }

  function handleInsert(text: string, sources?: Source[]) {
    if (!editor || !text.trim()) return;
    const endPos = editor.state.doc.content.size;
    const paragraphs = text
      .split(/\n+/)
      .filter((p) => p.trim())
      .map((p) => `<p>${escapeHtml(p)}</p>`)
      .join("");
    editor.chain().focus().insertContentAt(endPos, paragraphs).run();

    if (sources && sources.length > 0) {
      const list = sources.map((s) => `<p>[${s.id}] ${escapeHtml(s.title)} \u2014 ${escapeHtml(s.url)}</p>`).join("");
      const newEnd = editor.state.doc.content.size;
      editor.chain().focus().insertContentAt(newEnd, `<p><strong>Sources</strong></p>${list}`).run();
    }
  }

  function handleExportMarkdown() {
    if (!editor) return;
    const markdown = docToMarkdown(editor.getJSON() as any, title || undefined);
    downloadBlob(new Blob([markdown], { type: "text/markdown;charset=utf-8" }), safeFilename(title, "md"));
  }

  async function handleExportDocx() {
    if (!editor) return;
    const res = await fetch("/api/export/docx", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ doc: editor.getJSON(), title }),
    });
    if (!res.ok) return;
    downloadBlob(await res.blob(), safeFilename(title, "docx"));
  }

  async function handleExportPdf() {
    if (!editor) return;
    const res = await fetch("/api/export/pdf", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ doc: editor.getJSON(), title }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      alert(err?.error ?? "PDF generation failed — try Print / Save as PDF instead.");
      return;
    }
    downloadBlob(await res.blob(), safeFilename(title, "pdf"));
  }

  function handlePrint() {
    if (title) document.title = title;
    window.print();
  }

  return (
    <main>
      {!focusMode && <Nav />}

      {focusMode && (
        <button
          onClick={() => setFocusMode(false)}
          className="no-print fixed left-6 top-6 z-40 text-xs text-ink/30 transition-colors hover:text-ink"
        >
          Exit focus
        </button>
      )}

      {!focusMode && (
        <div className="no-print">
          <Toolbar
            title={title}
            onTitleChange={setTitle}
            onAsk={() => openPanel("ask")}
            onResearch={() => openPanel("research")}
            onExportMarkdown={handleExportMarkdown}
            onExportDocx={handleExportDocx}
            onExportPdf={handleExportPdf}
            onPrint={handlePrint}
            onFocusMode={() => setFocusMode(true)}
            panelOpen={panelOpen}
            panelMode={panelMode}
            wordCount={wordCount}
            justSaved={justSaved}
          />
        </div>
      )}

      <div className="relative">
        <DocEditor editor={editor} />
        {!focusMode && <BubbleToolbar editor={editor} onAIAction={handleAIAction} />}
      </div>

      {!focusMode && (
        <div className="no-print">
          <SidePanel
            open={panelOpen}
            mode={panelMode}
            onModeChange={setPanelMode}
            onClose={() => setPanelOpen(false)}
            getDocText={getDocText}
            onInsert={handleInsert}
            input={panelInput}
            setInput={setPanelInput}
          />
          <ActivityIndicator tasks={tasks} />
        </div>
      )}
    </main>
  );
}
