import { useEffect, useRef, useState } from "react";
import type { Editor } from "@tiptap/react";

const STORAGE_KEY = "strata:document";

type SavedDoc = { title: string; content: unknown; savedAt: number };

/** Reads any previously autosaved document, once, on mount. */
export function loadSavedDocument(): SavedDoc | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as SavedDoc) : null;
  } catch {
    return null;
  }
}

/**
 * Debounced autosave to localStorage. Every edit is a real, deliberate
 * decision here — this isn't the Claude Artifacts sandbox, which forbids
 * browser storage because the code runs inside claude.ai's iframe; this is
 * a real Next.js app running in the person's own browser, so localStorage
 * is exactly the right, zero-backend way to survive a refresh.
 */
export function useAutosave(editor: Editor | null, title: string) {
  const [justSaved, setJustSaved] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!editor) return;

    function save() {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        try {
          const payload: SavedDoc = { title, content: editor!.getJSON(), savedAt: Date.now() };
          window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
          setJustSaved(true);
          setTimeout(() => setJustSaved(false), 1200);
        } catch {
          // Storage full or disabled — fail silently, don't interrupt writing.
        }
      }, 800);
    }

    editor.on("update", save);
    return () => {
      editor.off("update", save);
      if (timer.current) clearTimeout(timer.current);
    };
  }, [editor, title]);

  return justSaved;
}
