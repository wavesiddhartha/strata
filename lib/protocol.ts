// Every streaming route (Ask, Rewrite, Research) speaks the same protocol:
// one JSON object per line (newline-delimited JSON / NDJSON). This replaces
// the earlier version's raw-text-plus-magic-sentinel-string approach —
// that worked, but "does this buffer contain a null-byte marker" is a hack;
// "parse this line as JSON and switch on .type" is the actual correct way
// to multiplex status updates, tokens, citations, and errors over one
// stream.

export type StreamEvent =
  | { type: "status"; label: string }
  | { type: "token"; text: string }
  | { type: "sources"; sources: { id: string; title: string; url: string }[] }
  | { type: "error"; message: string }
  | { type: "done" };

/** Server-side: encode one event as a line to enqueue into the response stream. */
export function encodeEvent(event: StreamEvent): string {
  return JSON.stringify(event) + "\n";
}
