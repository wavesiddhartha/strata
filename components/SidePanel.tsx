"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useState } from "react";
import { X } from "lucide-react";
import { readEventStream } from "@/lib/eventStream";

export type PanelMode = "ask" | "research";
type Source = { id: string; title: string; url: string };
type Msg = {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources?: Source[];
  streaming?: boolean;
  status?: string;
  failed?: boolean;
  controller?: AbortController;
};

export default function SidePanel({
  open,
  mode,
  onModeChange,
  onClose,
  getDocText,
  onInsert,
  input,
  setInput,
}: {
  open: boolean;
  mode: PanelMode;
  onModeChange: (m: PanelMode) => void;
  onClose: () => void;
  getDocText: () => string;
  onInsert: (text: string, sources?: Source[]) => void;
  input: string;
  setInput: (v: string) => void;
}) {
  const [messages, setMessages] = useState<Msg[]>([]);

  function updateMsg(id: string, patch: Partial<Msg>) {
    setMessages((m) => m.map((msg) => (msg.id === id ? { ...msg, ...patch } : msg)));
  }

  // Sends fire independently — nothing here blocks a second question from
  // going out while an earlier one is still streaming. Each request tracks
  // its own message by id, so concurrent replies update only themselves.
  async function send() {
    const question = input.trim();
    if (!question) return;
    setInput("");

    const requestMode = mode; // captured at send-time, stays correct even if the tab is switched mid-flight
    const userId = crypto.randomUUID();
    const assistantId = crypto.randomUUID();
    const controller = new AbortController();

    setMessages((m) => [
      ...m,
      { id: userId, role: "user", content: question },
      { id: assistantId, role: "assistant", content: "", streaming: true, status: "Thinking…", controller },
    ]);

    try {
      const url = requestMode === "ask" ? "/api/ask" : "/api/research";
      const payload = requestMode === "ask" ? { question, docText: getDocText() } : { query: question };

      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      if (!res.ok) throw new Error("Request failed");

      let content = "";
      let sources: Source[] | undefined;

      for await (const event of readEventStream(res)) {
        if (event.type === "status") {
          updateMsg(assistantId, { status: event.label });
        } else if (event.type === "token") {
          content += event.text;
          updateMsg(assistantId, { content, status: undefined, streaming: true });
        } else if (event.type === "sources") {
          sources = event.sources;
        } else if (event.type === "error") {
          updateMsg(assistantId, { content: event.message, streaming: false, failed: true, status: undefined });
        } else if (event.type === "done") {
          updateMsg(assistantId, { content, sources, streaming: false, status: undefined });
        }
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        updateMsg(assistantId, { content: "Stopped.", streaming: false, status: undefined });
      } else {
        updateMsg(assistantId, {
          content: "Something went wrong reaching Strata. Try again.",
          streaming: false,
          failed: true,
          status: undefined,
        });
      }
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.aside
          initial={{ x: 380, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: 380, opacity: 0 }}
          transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
          className="fixed right-0 top-0 z-30 flex h-full w-[380px] flex-col border-l border-line bg-[#F7F5EE]"
        >
          <div className="flex items-center justify-between border-b border-line/70 px-4 py-4">
            <div className="flex gap-1">
              {(["ask", "research"] as PanelMode[]).map((m) => (
                <button
                  key={m}
                  onClick={() => onModeChange(m)}
                  className={`rounded-full px-3 py-1 text-xs font-medium capitalize transition-colors ${
                    mode === m ? "bg-ink text-cream" : "text-ink/50 hover:text-ink"
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
            <button onClick={onClose} className="text-sm text-ink/40 transition-colors hover:text-ink" aria-label="Close">
              ✕
            </button>
          </div>

          <div className="flex-1 space-y-5 overflow-y-auto px-4 py-4">
            {messages.length === 0 && (
              <p className="font-serif text-[15px] italic leading-relaxed text-ink/40">
                {mode === "ask"
                  ? "Ask anything about your document, or anything at all. You can send more than one question at a time — each answer streams independently."
                  : "Give Strata something to research — it searches the web for real and brings back cited findings."}
              </p>
            )}
            {messages.map((m) => (
              <div key={m.id}>
                {m.role === "user" ? (
                  <p className="text-sm font-medium text-ink">{m.content}</p>
                ) : (
                  <div className="text-[13.5px] leading-relaxed text-ink/80">
                    {m.status && (
                      <span className="inline-flex items-center gap-1.5 italic text-ink/45">
                        <span className="h-1 w-1 animate-pulse rounded-full bg-ink/40" />
                        {m.status}
                      </span>
                    )}
                    {!m.status && <span>{m.content}</span>}
                    {m.streaming && !m.status && (
                      <span className="ml-0.5 inline-block h-[1em] w-[2px] animate-pulse bg-ink/50 align-text-bottom" />
                    )}
                    {m.streaming && (
                      <button
                        onClick={() => m.controller?.abort()}
                        className="ml-2 inline-flex items-center gap-0.5 text-[11px] text-ink/30 transition-colors hover:text-ink"
                      >
                        <X size={10} /> Stop
                      </button>
                    )}
                    {m.sources && m.sources.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {m.sources.map((s) => (
                          <a
                            key={s.id}
                            href={s.url}
                            target="_blank"
                            rel="noreferrer"
                            className="rounded-full border border-line px-2 py-0.5 text-[11px] text-ink/50 transition-colors hover:border-ink/30 hover:text-ink"
                            title={s.url}
                          >
                            [{s.id}] {s.title.length > 28 ? s.title.slice(0, 28) + "…" : s.title}
                          </a>
                        ))}
                      </div>
                    )}
                    {!m.streaming && !m.status && !m.failed && m.content && (
                      <button
                        onClick={() => onInsert(m.content, m.sources)}
                        className="mt-2 block text-xs text-ink/35 transition-colors hover:text-ink"
                      >
                        + Insert into document
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="border-t border-line/70 p-3">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
              placeholder={mode === "ask" ? "Ask a question…" : "What should Strata research?"}
              rows={2}
              className="w-full resize-none rounded-xl border border-line bg-white px-3 py-2 text-sm text-ink outline-none transition-colors focus:border-[#CFC8B4]"
            />
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}
