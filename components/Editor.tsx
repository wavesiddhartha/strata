"use client";

import { EditorContent, type Editor } from "@tiptap/react";

export default function DocEditor({ editor }: { editor: Editor | null }) {
  return (
    <div className="mx-auto max-w-[760px] px-6 pb-40">
      <div className="rounded-sm bg-white px-12 py-16 sm:px-20 sm:py-20 shadow-[0_1px_2px_rgba(26,26,26,0.04),0_20px_50px_-24px_rgba(26,26,26,0.16)] min-h-[60vh]">
        {editor ? <EditorContent editor={editor} /> : null}
      </div>
    </div>
  );
}
