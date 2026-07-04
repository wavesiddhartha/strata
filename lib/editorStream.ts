import type { Editor } from "@tiptap/react";
import { readEventStream } from "./eventStream";

/**
 * Fetches an NDJSON event stream and inserts each `token` event's text
 * into the editor at an advancing position — this is what makes a rewrite
 * feel like watching the AI actually type the replacement in place, rather
 * than a spinner-then-swap. Accepts an AbortSignal so a caller can cancel
 * an in-flight edit (used by the task queue's per-task Stop button).
 * Throws if the server reports an `error` event, or if aborted.
 * Returns the end position once the stream closes.
 */
export async function streamPlainTextIntoEditor(
  editor: Editor,
  url: string,
  body: unknown,
  insertAt: number,
  signal?: AbortSignal
): Promise<number> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error ?? "Request failed");
  }

  let pos = insertAt;
  for await (const event of readEventStream(res)) {
    if (signal?.aborted) {
      throw new DOMException("Aborted", "AbortError");
    }
    if (event.type === "token" && event.text) {
      editor.chain().focus().insertContentAt(pos, event.text).run();
      pos += event.text.length;
    } else if (event.type === "error") {
      throw new Error(event.message);
    }
  }

  return pos;
}

/** Escapes plain text for safe insertion as TipTap HTML content. */
export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
