import type { StreamEvent } from "./protocol";

/**
 * Reads a fetch Response body as newline-delimited JSON events. Lines can
 * arrive split across chunk boundaries (a TCP/HTTP chunk has no obligation
 * to end on a line break), so this buffers any trailing partial line and
 * only parses complete ones — the same reason the old sentinel-splitting
 * code had to be careful, just done properly this time with a real
 * line-oriented protocol instead of a magic string.
 */
export async function* readEventStream(res: Response): AsyncGenerator<StreamEvent> {
  if (!res.body) throw new Error("Response has no body to stream");
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        yield JSON.parse(line) as StreamEvent;
      } catch {
        // A line that isn't valid JSON shouldn't be possible given the
        // server always writes one encodeEvent() per line, but skip
        // rather than crash if it ever happens (e.g. a proxy that
        // rebuffers oddly).
      }
    }
  }

  const tail = buffer.trim();
  if (tail) {
    try {
      yield JSON.parse(tail) as StreamEvent;
    } catch {
      // ignore trailing garbage
    }
  }
}
