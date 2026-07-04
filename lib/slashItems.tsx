import type { Editor, Range } from "@tiptap/core";
import type { LucideIcon } from "lucide-react";
import { Heading1, Heading2, Heading3, List, ListOrdered, Quote, Code2, Minus, Pilcrow, PenLine } from "lucide-react";

export type SlashItem = {
  title: string;
  description: string;
  icon: LucideIcon;
  command: (args: { editor: Editor; range: Range }) => void;
};

/** Dispatched by the "Continue writing" item; page.tsx listens and hands it to the AI task queue. */
export const CONTINUE_WRITING_EVENT = "strata:continue-writing";
export type ContinueWritingDetail = { pos: number; context: string };

export const slashItems: SlashItem[] = [
  {
    title: "Continue writing",
    description: "Let Strata continue from here",
    icon: PenLine,
    command: ({ editor, range }) => {
      const pos = range.from;
      const context = editor.state.doc.textBetween(Math.max(0, pos - 1500), pos, "\n");
      editor.chain().focus().deleteRange(range).run();
      window.dispatchEvent(new CustomEvent(CONTINUE_WRITING_EVENT, { detail: { pos: range.from, context } }));
    },
  },
  {
    title: "Text",
    description: "Plain paragraph",
    icon: Pilcrow,
    command: ({ editor, range }) => editor.chain().focus().deleteRange(range).setParagraph().run(),
  },
  {
    title: "Heading 1",
    description: "Big section heading",
    icon: Heading1,
    command: ({ editor, range }) =>
      editor.chain().focus().deleteRange(range).setNode("heading", { level: 1 }).run(),
  },
  {
    title: "Heading 2",
    description: "Medium section heading",
    icon: Heading2,
    command: ({ editor, range }) =>
      editor.chain().focus().deleteRange(range).setNode("heading", { level: 2 }).run(),
  },
  {
    title: "Heading 3",
    description: "Small section heading",
    icon: Heading3,
    command: ({ editor, range }) =>
      editor.chain().focus().deleteRange(range).setNode("heading", { level: 3 }).run(),
  },
  {
    title: "Bullet list",
    description: "A simple unordered list",
    icon: List,
    command: ({ editor, range }) => editor.chain().focus().deleteRange(range).toggleBulletList().run(),
  },
  {
    title: "Numbered list",
    description: "A list with numbering",
    icon: ListOrdered,
    command: ({ editor, range }) => editor.chain().focus().deleteRange(range).toggleOrderedList().run(),
  },
  {
    title: "Quote",
    description: "A blockquote",
    icon: Quote,
    command: ({ editor, range }) => editor.chain().focus().deleteRange(range).toggleBlockquote().run(),
  },
  {
    title: "Code block",
    description: "A block of code",
    icon: Code2,
    command: ({ editor, range }) => editor.chain().focus().deleteRange(range).toggleCodeBlock().run(),
  },
  {
    title: "Divider",
    description: "A horizontal rule",
    icon: Minus,
    command: ({ editor, range }) => editor.chain().focus().deleteRange(range).setHorizontalRule().run(),
  },
];
