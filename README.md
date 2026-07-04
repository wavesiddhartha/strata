# Strata

A document you write in, ask questions of, send out to research the web,
and edit — like Apple Pages with an AI collaborator built in. See
`STRATA_NOTEBOOK_PLAN.md` for the research this shape is grounded in
(NotebookLM, Notion AI, TipTap's AI tooling, Apple Pages' design
philosophy).

## First: rotate your API key

Any key pasted into a chat should be treated as compromised — rotate it in
your NVIDIA NIM dashboard before deploying. It only ever lives in a
server-side `.env.local`, never in client code.

## Run it

```bash
npm install
cp .env.example .env.local
# paste your (rotated) key into .env.local
npm run dev
```

`npm install` will **not** download Chromium automatically — I initially
shipped it that way, then actually ran the install and hit a real failure:
Puppeteer's postinstall script tries to download a ~200MB Chromium binary,
and if that download is blocked by *any* network policy (a sandboxed CI
runner, a locked-down corporate network — exactly what happened when I
tested this), the **entire** `npm install` fails, not just PDF export.
`.puppeteerrc.cjs` disables that automatic download, so install always
succeeds. To enable one-click PDF export, run once:

```bash
npx puppeteer browsers install chrome
```

Until you do that, "Download PDF" fails with a clear message pointing at
"Print / Save as PDF" — which works immediately, zero setup, same visual
result, just via the browser's print dialog instead of a direct download.

## Handling multiple things at once

This was the focus of this round: **the app previously blocked you from
starting a second AI action while one was still running.** Now it doesn't
— and here's exactly how that's made safe rather than just "removing the
block and hoping":

- **The real risk**: if two AI edits stream into the same document at
  once, each tracks "where do I insert next" as a plain number. The
  instant either one inserts text, every position after that point shifts
  — including the other stream's target and anything else waiting in a
  queue. Get this wrong and edits land in the wrong place or clobber each
  other silently.
- **The fix** (`lib/aiTaskQueue.ts`): you can request as many edits as you
  want — select text, ask for Expand, immediately select something else,
  ask for Simplify — every request queues instantly, nothing blocks you.
  Actual document mutations still happen one at a time (ProseMirror
  transactions genuinely aren't safely parallelizable), but every
  still-waiting task's position gets remapped through ProseMirror's
  `transaction.mapping` on *every* document change — including your own
  typing elsewhere — so a queued edit still lands correctly even if the
  document shifted underneath it while it waited. I simulated this exact
  scenario (two queued edits, the first inserting more text than it
  deleted) and confirmed the second one's range shifts to the
  mathematically correct position before trusting it.
- **Ask and Research now run genuinely in parallel** — send three
  questions back to back in the side panel and watch all three stream
  independently; I verified this against the live server with three
  concurrent real HTTP requests and confirmed no cross-contamination
  between them.
- **Everything is cancellable** — every in-flight edit and every panel
  message has a Stop button (an `AbortController` per task), and the
  floating activity indicator (bottom-right) shows everything currently
  running with its own cancel button, so "handles every request" includes
  handling the request to stop.

## New writing feature: Continue writing

Type `/` and choose "Continue writing," or use it from an empty line — it
takes the preceding ~1500 characters as context and streams a natural
continuation at the cursor, using the same safe task-queue mechanism as
every other edit (so you can trigger it and keep writing elsewhere while
it works).

## Keyboard shortcuts

`Cmd/Ctrl+K` opens Ask, `Cmd/Ctrl+Shift+K` opens Research, `Escape` closes
the panel.



**The streaming protocol** (`lib/protocol.ts`, `lib/eventStream.ts`) — every
AI route speaks newline-delimited JSON events (`{"type":"status"|"token"|"sources"|"error"|"done", ...}`)
instead of raw text with a magic marker string. This replaced an earlier,
hackier sentinel-string approach. The line-buffering logic (handling a
JSON line arriving split across two network chunks) is fuzz-tested — see
below.

**Ask** (`app/api/ask/route.ts`) — streams a conversational answer,
optionally grounded in the document's current text, into the side panel.

**Research** (`app/api/research/route.ts`, `lib/search.ts`) — real web
search, no API key required, via DuckDuckGo's HTML endpoint. You'll see
live progress in the panel as it works: *Searching the web…* -> *Reading N
sources…* -> *Writing a synthesis…* -> the cited paragraph streaming in,
with clickable source chips. If DuckDuckGo's HTML endpoint ever breaks
(it's unofficial), `lib/search.ts` isolates the fix to one file — swap in
Brave Search / Tavily / SerpAPI and nothing downstream changes.

**Edit** — manual formatting and AI actions live in one bubble menu
(`components/BubbleToolbar.tsx`): select text, get Bold/Italic/Strike/Code/
Heading/Quote/Link plus "Ask AI" -> Expand/Simplify/Fix/Ask about this. AI
rewrites stream directly into the document in place
(`lib/editorStream.ts`), not a spinner-then-swap. There's also a Notion-
style `/` slash command menu (`lib/slashCommand.ts`, `components/SlashMenu.tsx`)
for inserting headings, lists, quotes, code blocks, and dividers by typing
`/` — built on TipTap's `Suggestion` utility + `tippy.js` for popup
positioning.

**Autosave** (`lib/useAutosave.ts`) — debounced save to `localStorage` on
every edit, restored on load. (This is a real shipped app running in your
own browser, not the claude.ai Artifacts sandbox — that's the context
where browser storage is off-limits; here it's the right zero-backend way
to survive a refresh.) A small "Saved" indicator fades in/out in the
toolbar, no toast spam.

**Export** — three real paths:
- **Markdown**: pure client-side, `lib/markdown.ts` serializes the TipTap
  JSON doc.
- **DOCX**: `lib/docx.ts` + `app/api/export/docx/route.ts`, using the
  pure-JS `docx` library — an actual Office Open XML file (headings,
  bold/italic/strike, links, bullet/numbered lists, blockquotes, code
  blocks), no Pandoc binary required.
- **PDF**: `lib/exportHtml.ts` + `app/api/export/pdf/route.ts`, using
  Puppeteer to render the same canonical HTML to a real PDF file —
  one-click download, no print dialog. "Print / Save as PDF" (the
  browser's native print pipeline) is kept as a documented fallback.

## What I could verify here, and what I honestly couldn't

I tested everything I could without a real browser:
- **NDJSON line-buffering**: fuzz-tested by splitting a real event stream
  at every single byte offset (275 positions) and confirming correct,
  lossless parsing every time.
- **DuckDuckGo result parsing + redirect-URL decoding**: tested against
  realistic sample HTML — the `uddg=` redirect-unwrapping isn't obvious
  and was worth catching before trusting it.
- **DOCX generation**: built a real file, unzipped it, confirmed valid
  Office Open XML structure and correct text content.
- **The full server, live**: built, started, and hit the actual running
  app with real HTTP requests — confirmed the DOCX export route returns a
  valid file end-to-end, input validation returns clean 400s, and the
  research route fails *gracefully* (a real network failure came back as
  a clean `{"type":"error"}` event, not a crash) with the server staying
  healthy afterward.
- **Position remapping under concurrent edits**: simulated two queued
  rewrite tasks on different parts of a document, executed the first
  (which inserted more text than it deleted), and confirmed the second
  task's range remapped to the exact mathematically correct position
  before trusting the mechanism in the real editor.
- **Real concurrency, live server**: fired three simultaneous HTTP
  requests at `/api/ask` and confirmed each got back its own correctly
  isolated response — no cross-contamination between concurrent request
  handlers — and the server stayed healthy under that load.
- **The install itself**: I initially shipped Puppeteer as a normal
  dependency, then actually ran `npm install` in this sandbox's
  network-restricted environment and watched it fail completely — its
  postinstall Chromium download has no fallback. That's a real bug a
  network-restricted environment (not just mine) could hit, so I fixed it
  with `.puppeteerrc.cjs` (`skipDownload: true`) and re-ran the install to
  confirm it now succeeds regardless of network policy, with PDF export
  becoming an explicit opt-in step instead of a fragile hard dependency.

What I could not verify in this sandbox, specifically because its network
is restricted to a small allowlist that excludes both the Chromium
download host and duckduckgo.com:
- **Puppeteer's actual browser launch** — once you run
  `npx puppeteer browsers install chrome`, the route should work; the
  route itself type-checks and builds cleanly, but I couldn't execute a
  real headless-Chromium PDF render here since that install step is
  blocked by this environment's network policy. Test the "Download PDF"
  button after that setup step; "Print / Save as PDF" is the proven,
  zero-setup fallback either way.
- **DuckDuckGo's happy path** — my one live test hit a 403 (either
  DuckDuckGo itself or my own sandbox's network proxy blocking the
  request — I can't tell which from here), which is exactly what let me
  confirm the error-handling path works, but I haven't seen real search
  results flow through end-to-end.
- **The slash menu and bubble toolbar's on-screen feel** — positioning,
  keyboard nav, and the popup behavior are built on well-established
  TipTap/tippy.js patterns, but I can't visually confirm them without a
  browser. Worth a careful look after `npm run dev`.

## What's still ahead, on purpose

- Multi-document / notebook sidebar — deliberately single-page for now.
- Suggestion-mode diff review for AI edits (TipTap Pro has this built-in
  as a paid add-on; this app relies on `Cmd+Z` instead — revisit if that
  feels too blunt in practice).
- Real-time collaboration.
- Server-side persistence (autosave is local-only right now — it survives
  a refresh but not a new device/browser).
