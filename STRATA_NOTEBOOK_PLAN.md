# Strata Notebook — Research & Architecture Plan

*From "hierarchical outline learner" to "living document you write, research, and edit with AI, and download when it's yours."*

---

## 1. What you're actually asking for

Reading between the lines of "like Apple Pages, where user can ask, research, edit and download" — this isn't a small UI tweak on top of the current outline app. It's a different *object*. Right now Strata produces a **card tree** (chapter → point → sub-point) that you click through. What you're describing is a **document** — one continuous page, the way Pages or a Google Doc feels — that:

- starts blank or from a prompt,
- lets you **ask** questions that get answered *into* the page, not off to the side,
- can go **research** a topic (pull in real information, not just what the model already "knows"),
- is **directly editable** like any word processor — you can type into it, delete a paragraph, rewrite a sentence yourself,
- and **downloads** as a real file (PDF/DOCX) that looks exactly like what you saw on screen.

That's a genuinely different product shape. Before touching code again, I wanted to actually look at how the three products that already do pieces of this well have solved it, so the plan below is grounded in what's proven to work rather than my guessing.

---

## 2. What I looked at, and what's actually worth stealing

### NotebookLM — the "starts with content, not a blank box" insight

The single most useful idea here: traditional AI interfaces present users with an empty chat box — an intimidating blank canvas, while NotebookLM instead starts with your content, making the experience immediately relevant and personal. That reframes what "Ask" should mean for Strata — the page itself *is* the content the AI is grounded in, not a separate chat thread floating next to an empty document.

NotebookLM's actual 2026 shape is a three-panel layout: sources on the left, chat/Q&A in the middle, and a "Studio" of generated outputs (audio, slides, mind maps) on the right, with sources on one side and a notes-and-chat panel on the other. Its answers are also strictly source-grounded — it operates only within the boundaries of the sources uploaded by the user and does not generate answers from general training data. It also has a real, autonomous **web research** mode now: the Deep Research feature lets NotebookLM autonomously search the web, build a bibliography, and compile a cited report.

**What to take:** the three-panel instinct (content / conversation / outputs), and — more specifically — the idea that "Research" should be a distinct, visible mode from "Ask," because they're different trust levels: asking about what's already on the page vs. going out and finding new information. What I'd deliberately *not* copy: the multi-modal sprawl (podcasts, videos, mind maps) — that's Google's breadth play, not what a focused learning notebook needs.

### Notion AI — proof that "inline AI writing" is the hard part, not the flashy part

Notion's inline writer is the most direct precedent for "AI edits a document you're looking at" — triggered by a slash command or a highlighted selection, letting you fix grammar, generate summaries, and draft new content in seconds. But the honest review verdict matters here: reviewers consistently report that the slash-command writer feels a generation behind dedicated assistants like ChatGPT and Claude direct, while Notion's real 2026 investment has moved to agents that operate on databases, not the in-document writing experience itself.

**What to take:** the *interaction pattern* — select text, get a small contextual menu, ask for a rewrite/expansion/simpler version inline — is exactly right and exactly what "edit" should feel like in Strata. **What to watch out for:** don't treat inline AI editing as an afterthought bolted onto a static editor. It's apparently easy to get the mechanics working and hard to make the writing itself feel as good as talking to Claude directly — which is precisely why the plan below keeps generation quality (the actual model calls) as the thing we protect, even as the surrounding UI gets more ambitious.

### TipTap's AI Toolkit — the honest technical reality check

This is the part that actually changes the build plan. The editor primitive you'd want for "AI writes into a document live, and you can accept/reject the change" — streaming, inline diffs, accept/reject suggestions — exists, and it's good: cursor-like inline edits that respect your document structure, streamed token-by-token with the first token appearing immediately. But it's a **paid add-on** (`@tiptap-pro/extension-ai-suggestion`, `@tiptap-pro/extension-ai`), not part of free TipTap core.

**What this means practically:** we have two honest paths, not one:
- **Path A (free, more work, ships now):** TipTap **core** (MIT-licensed, free) + we hand-roll the streaming-into-document logic ourselves — insert content at the cursor position via editor transactions as tokens arrive, no fancy accept/reject diff UI at first, just "AI writes, you can immediately edit or undo (Cmd+Z) whatever it wrote." This is genuinely buildable without a subscription.
- **Path B (paid, less work, nicer diffing):** TipTap Pro's AI Toolkit gets you real accept/reject diff suggestions (green/red inline, like Google Docs suggestion mode) out of the box.

Given the project's stack so far has deliberately stayed on free/open-source tooling, **I'd default to Path A** and treat proper suggestion-mode diffing as a Phase 2/3 upgrade if it turns out `Cmd+Z` isn't a satisfying enough undo model in practice.

### Apple Pages — what "premium and minimal" actually means, concretely

Pages is a minimalist notebook; Word is a fully stocked stationery cupboard — it does the essentials beautifully rather than offering every feature under the sun. Two concrete, non-vibes takeaways: it renders as an actual **page** — a defined, bounded canvas with margins, sitting on a neutral surface — rather than an edge-to-edge web app; and there's a real focused-writing precedent (Pages' historic Full Screen mode hid the menubar and toolbars, letting users focus on a single document without other windows as distraction) — i.e., the chrome should be able to get *out of the way* entirely when someone's just writing.

**What to take:** the page-on-a-surface layout (a white/cream "sheet" centered on a slightly darker background, with real margins) rather than a full-bleed app — and a toggleable "focus mode" that hides the nav/toolbar/side panel.

---

## 3. The actual architecture I'd build

### 3.1 Layout — three zones, but quiet about it

```
┌─────────────────────────────────────────────────────────┐
│  Strata            [ Ask ]  [ Research ]        ⌄ Export │  ← quiet top bar, not a toolbar
├───────────────────────┬───────────────────────────────────┤
│                       │                                   │
│      the page          │        AI side panel              │
│   (cream sheet on      │   (collapsed by default —          │
│    darker surface,     │    slides in for Ask/Research,     │
│    serif body text,    │    slides away when you just       │
│    real margins)       │    want to write)                  │
│                       │                                   │
└───────────────────────┴───────────────────────────────────┘
```

- **The page** is the primary object — like Pages, a bounded sheet (~700px reading width, generous margins, serif body text at 17–18px, 1.5 line-height) sitting on a slightly darker cream background so it reads as a "document," not a webpage.
- **The side panel** is where Ask and Research live — collapsed by default, so the default state is "blank page, cursor blinking" (Pages' actual opening state), not "AI chat box staring at you." This directly answers the NotebookLM lesson: don't lead with an empty chat box.
- **Selection-triggered inline menu** (Notion's pattern, done better): highlight any text in the page → a small floating pill appears above the selection with `Ask about this` / `Expand` / `Simplify` / `Cite a source` — this is "edit," and it's the interaction people will use most, so it needs to be the fastest one, not buried in a menu.

### 3.2 The three verbs, mapped to real mechanics

**Ask** — a question about the page's existing content, or a general question. Answered in the side panel as a normal streamed chat reply (reusing the live-token-streaming work already built). The person can then click **"Insert into document"** on any AI reply to drop it into the page at the cursor — this is the bridge between "chat" and "document" that neither pure-chat nor pure-outline apps have.

**Research** — the harder, more valuable one. This requires actual web search, not just the model's training data — otherwise it's not research, it's the same model guessing with extra steps. Concretely: a research query triggers real web search + fetch, the results get synthesized into a cited paragraph (small numbered footnote markers, like NotebookLM's traceable citations), and that paragraph streams directly into the page at the cursor, live-typed. Every claim that came from a source carries a citation the person can click to see where it came from — this is the single feature that would make Strata trustworthy for actual schoolwork/application-prep use, versus being "just another AI chat wearing a document costume."

**Edit** — two tiers:
1. *Manual* — it's a real TipTap editor. Click, type, delete, format. No AI involved. This has to feel instant and unremarkable, the way typing in Pages does.
2. *AI-assisted* — select text → floating pill → pick an action → the model rewrites just that selection and it's swapped in live (Path A: streamed replacement + `Cmd+Z` to undo if you don't like it).

**Download** — this one doesn't need new thinking, the original Part 3 spec already got this right: one canonical HTML representation of the page (content + citations + math + any highlights) drives both the on-screen render and the export, via Puppeteer for pixel-exact PDF and Pandoc for DOCX, so what you see is what you download instead of three renderers drifting apart.

### 3.3 Data model (what actually needs to persist)

```ts
type Notebook = {
  id: string;
  title: string;
  content: JSONContent;       // TipTap/ProseMirror doc — single source of truth
  sources: Source[];          // every citation, deduped, with URL + retrieved date
  createdAt, updatedAt: Date;
};

type Source = {
  id: string;
  url: string;
  title: string;
  retrievedAt: Date;
  usedInParagraphs: string[]; // node ids in content that cite this source
};
```

This is intentionally small. The previous outline app's schema (`main_points[].sub_points[]` recursion) goes away entirely — a document doesn't have that shape, it's just... a document. That's actually a simplification, not added complexity.

### 3.4 Streaming into a real document (the genuinely new technical piece)

The intro-line streaming built last round proved the SSE plumbing works. The new piece: instead of streaming into a `<p>` of raw text, the same token stream needs to land *inside* the TipTap editor, at the cursor, live. Mechanically:

```ts
// On each SSE chunk:
editor.commands.insertContent(chunk, {
  updateSelection: true, // cursor stays at the end, so it visually "types forward"
});
```

Plus a blinking-caret decoration at the insertion point while streaming (the TipTap ecosystem calls this pattern an "AI caret" — worth replicating even without the paid extension, since it's just a small ProseMirror decoration, not a licensed feature).

### 3.5 Visual system — carries over almost entirely

Everything already built (cream/#F0EEE6, Newsreader serif headlines, Inter body, black pill buttons, soft focus-lift instead of hard outlines) stays. What changes is the *shape*: instead of an accordion of cards, it's one continuous page. The derivation panels, KaTeX rendering, and highlight-toolbar work from the outline version all still apply — they just become things that can appear *inside* a page's flow instead of inside an outline node.

---

## 4. What I'd explicitly NOT build yet

Being honest about scope, the same way the last two rounds flagged what was stubbed:

- **Multi-notebook / sidebar of documents** — real product need eventually, but the first version should be "one page, one session" so we're not building a database/auth layer before proving the core writing-and-researching loop feels good.
- **Real-time multiplayer collaboration** — out of scope; NotebookLM/Notion's collab layers took real teams months.
- **TipTap Pro's diff/suggestion UI** — starting with Path A (stream + undo). If plain `Cmd+Z` feels too blunt once we're using it for real, that's the signal to revisit paying for the Pro suggestion extension, not a guess made up front.
- **Audio/video/slide "Studio" outputs** — that's NotebookLM's breadth play, not this product's job.

---

## 5. Suggested build order

1. **The page itself** — TipTap core wired into the existing Anthropic-style shell, replacing the outline UI. Gets you a real, typeable document that looks right, with zero AI yet.
2. **Ask panel** — side panel, streams replies like the current intro-line does, with "insert into document" on any reply.
3. **Selection → inline edit pill** — the Notion-style contextual menu for rewrite/expand/simplify on a highlighted selection.
4. **Research mode** — the one genuinely new backend piece: wire up real web search, synthesize with citations, stream into the page.
5. **Export** — PDF via Puppeteer, DOCX via Pandoc, from the same canonical HTML.

I'd build in that order because each step is independently useful and testable — you'd have a working, honest product after step 1, not a pile of half-wired pieces.
