import { useCallback, useEffect, useRef, useState } from "react";
import type { Editor } from "@tiptap/react";
import { streamPlainTextIntoEditor } from "./editorStream";
import type { RewriteInstruction } from "./prompts";

export type AITaskStatus = "queued" | "running" | "done" | "error" | "cancelled";
export type AITask = {
  id: string;
  label: string;
  status: AITaskStatus;
  cancel: () => void;
};

type PendingRewrite = {
  id: string;
  text: string;
  instruction: RewriteInstruction;
  from: number;
  to: number;
  controller: AbortController;
};

/**
 * Why this needs to exist: if two AI edits stream into the same document at
 * once, each one tracks "where am I inserting next" as a plain number. The
 * moment either stream inserts text, every position after that point shifts
 * — including the other stream's target, and anything still waiting in the
 * queue. Without correcting for that, a second edit either lands in the
 * wrong place or clobbers the first one silently.
 *
 * The fix: every queued-but-not-yet-running task's {from, to} range gets
 * remapped through ProseMirror's transaction.mapping on *every* document
 * change — not just from other AI tasks, but from the person's own typing
 * too, so you can keep writing while edits are queued and they'll still
 * land in the right place. Actual document mutations are still processed
 * one at a time (ProseMirror transactions aren't safely parallelizable),
 * but requesting them is never blocked — you can queue as many as you
 * want and watch them work through the list.
 */
export function useAITaskQueue(editor: Editor | null) {
  const [tasks, setTasks] = useState<AITask[]>([]);
  const queueRef = useRef<PendingRewrite[]>([]);
  const runningRef = useRef(false);

  useEffect(() => {
    if (!editor) return;
    function onTransaction({ transaction }: { transaction: { docChanged: boolean; mapping: { map: (pos: number) => number } } }) {
      if (!transaction.docChanged) return;
      for (const item of queueRef.current) {
        item.from = transaction.mapping.map(item.from);
        item.to = transaction.mapping.map(item.to);
      }
    }
    editor.on("transaction", onTransaction);
    return () => {
      editor.off("transaction", onTransaction);
    };
  }, [editor]);

  const updateTask = useCallback((id: string, patch: Partial<AITask>) => {
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)));
  }, []);

  const dropTaskSoon = useCallback((id: string) => {
    setTimeout(() => {
      setTasks((prev) => prev.filter((t) => t.id !== id));
    }, 1600);
  }, []);

  const processQueue = useCallback(async () => {
    if (runningRef.current) return;
    runningRef.current = true;

    while (queueRef.current.length > 0) {
      const item = queueRef.current.shift()!;
      updateTask(item.id, { status: "running" });

      try {
        if (!editor) throw new Error("Editor not ready");
        if (item.to > item.from) {
          editor.chain().focus().deleteRange({ from: item.from, to: item.to }).run();
        }
        await streamPlainTextIntoEditor(
          editor,
          "/api/rewrite",
          { selectedText: item.text, instruction: item.instruction },
          item.from,
          item.controller.signal
        );
        updateTask(item.id, { status: "done" });
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") {
          updateTask(item.id, { status: "cancelled" });
        } else {
          updateTask(item.id, { status: "error" });
          if (item.to > item.from) {
            // Best-effort restore of the original text on genuine failure.
            try {
              editor?.chain().focus().insertContentAt(item.from, item.text).run();
            } catch {
              // Editor state may have moved on — nothing more we can safely do.
            }
          }
        }
      }
      dropTaskSoon(item.id);
    }

    runningRef.current = false;
  }, [editor, updateTask, dropTaskSoon]);

  /** Queue a document-mutating edit. `to === from` means "insert only" (used by Continue writing). */
  const enqueueRewrite = useCallback(
    (text: string, range: { from: number; to: number }, instruction: RewriteInstruction, label: string) => {
      const controller = new AbortController();
      const id = crypto.randomUUID();
      queueRef.current.push({ id, text, instruction, from: range.from, to: range.to, controller });
      setTasks((prev) => [...prev, { id, label, status: "queued", cancel: () => controller.abort() }]);
      void processQueue();
    },
    [processQueue]
  );

  const cancelTask = useCallback(
    (id: string) => {
      const task = tasks.find((t) => t.id === id);
      task?.cancel();
    },
    [tasks]
  );

  return { tasks, enqueueRewrite, cancelTask };
}
