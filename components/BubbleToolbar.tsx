"use client";

import { useEffect, useState } from "react";
import type { Editor } from "@tiptap/react";
import { motion, AnimatePresence } from "framer-motion";
import { Bold, Italic, Strikethrough, Heading2, Quote, Link as LinkIcon, Sparkles, Code } from "lucide-react";

export type AIAction = "expand" | "simplify" | "fix" | "ask";

type PillState = { x: number; y: number; text: string; from: number; to: number };

export default function BubbleToolbar({
  editor,
  onAIAction,
}: {
  editor: Editor | null;
  onAIAction: (action: AIAction, text: string, range: { from: number; to: number }) => void;
}) {
  const [state, setState] = useState<PillState | null>(null);
  const [showAI, setShowAI] = useState(false);

  useEffect(() => {
    if (!editor) return;

    function update() {
      const { from, to, empty } = editor!.state.selection;
      if (empty) {
        setState(null);
        setShowAI(false);
        return;
      }
      const text = editor!.state.doc.textBetween(from, to, " ");
      if (!text.trim()) {
        setState(null);
        return;
      }
      const start = editor!.view.coordsAtPos(from);
      const end = editor!.view.coordsAtPos(to);
      const containerRect = editor!.view.dom.getBoundingClientRect();
      setState({
        x: (start.left + end.left) / 2 - containerRect.left,
        y: Math.min(start.top, end.top) - containerRect.top,
        text,
        from,
        to,
      });
    }

    editor.on("selectionUpdate", update);
    return () => {
      editor.off("selectionUpdate", update);
    };
  }, [editor]);

  if (!editor) return null;

  const setLink = () => {
    const url = window.prompt("Link URL");
    if (url) editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
  };

  return (
    <AnimatePresence>
      {state && (
        <motion.div
          initial={{ opacity: 0, y: 6, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 4, scale: 0.97 }}
          transition={{ duration: 0.12, ease: [0.22, 1, 0.36, 1] }}
          className="absolute z-20 -translate-x-1/2"
          style={{ left: state.x, top: state.y - 50 }}
        >
          <div className="flex items-center gap-0.5 rounded-full bg-ink px-1.5 py-1.5 shadow-lg">
            {!showAI ? (
              <>
                <ToolButton active={editor.isActive("bold")} onClick={() => editor.chain().focus().toggleBold().run()}>
                  <Bold size={14} />
                </ToolButton>
                <ToolButton active={editor.isActive("italic")} onClick={() => editor.chain().focus().toggleItalic().run()}>
                  <Italic size={14} />
                </ToolButton>
                <ToolButton active={editor.isActive("strike")} onClick={() => editor.chain().focus().toggleStrike().run()}>
                  <Strikethrough size={14} />
                </ToolButton>
                <ToolButton active={editor.isActive("code")} onClick={() => editor.chain().focus().toggleCode().run()}>
                  <Code size={14} />
                </ToolButton>
                <ToolButton
                  active={editor.isActive("heading", { level: 2 })}
                  onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
                >
                  <Heading2 size={14} />
                </ToolButton>
                <ToolButton active={editor.isActive("blockquote")} onClick={() => editor.chain().focus().toggleBlockquote().run()}>
                  <Quote size={14} />
                </ToolButton>
                <ToolButton active={editor.isActive("link")} onClick={setLink}>
                  <LinkIcon size={14} />
                </ToolButton>

                <span className="mx-0.5 h-4 w-px bg-white/15" />

                <button
                  onMouseDown={(e) => {
                    e.preventDefault();
                    setShowAI(true);
                  }}
                  className="flex items-center gap-1 rounded-full px-2.5 py-1.5 text-xs font-medium text-cream/90 transition-colors hover:bg-white/10"
                >
                  <Sparkles size={13} />
                  Ask AI
                </button>
              </>
            ) : (
              <>
                {(
                  [
                    ["expand", "Expand"],
                    ["simplify", "Simplify"],
                    ["fix", "Fix"],
                    ["ask", "Ask about this"],
                  ] as [AIAction, string][]
                ).map(([action, label]) => (
                  <button
                    key={action}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      onAIAction(action, state.text, { from: state.from, to: state.to });
                      setShowAI(false);
                    }}
                    className="rounded-full px-3 py-1.5 text-xs font-medium text-cream/90 transition-colors hover:bg-white/10"
                  >
                    {label}
                  </button>
                ))}
              </>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function ToolButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onMouseDown={(e) => {
        e.preventDefault();
        onClick();
      }}
      className={`flex h-7 w-7 items-center justify-center rounded-full transition-colors ${
        active ? "bg-white/20 text-cream" : "text-cream/70 hover:bg-white/10 hover:text-cream"
      }`}
    >
      {children}
    </button>
  );
}
