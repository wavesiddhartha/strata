// Server-only. Talks to Minimax (via NVIDIA NIM) — never import this from
// a client component, since apiKey() reads a secret from process.env.

const NIM_URL = "https://integrate.api.nvidia.com/v1/chat/completions";
const MODEL_ID = "minimaxai/minimax-m3";

function apiKey(): string {
  const key = process.env.NVIDIA_API_KEY_MINIMAX;
  if (!key) {
    throw new Error("Missing NVIDIA_API_KEY_MINIMAX in server environment");
  }
  return key;
}

/**
 * Streams raw token deltas as they're generated (SSE) — the one primitive
 * every AI-touching route in this app builds on: Ask, Research synthesis,
 * and inline Rewrite all just stream plain prose through this. There's no
 * structured-JSON generation anymore (the old outline schema is gone along
 * with the outline UI), so there's nothing here to parse or validate —
 * every response is just text a person would read.
 */
export async function* streamText(
  system: string,
  user: string,
  opts: { temperature?: number; maxTokens?: number } = {}
): AsyncGenerator<string> {
  const res = await fetch(NIM_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey()}`,
      "Content-Type": "application/json",
      Accept: "text/event-stream",
    },
    body: JSON.stringify({
      model: MODEL_ID,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      max_tokens: opts.maxTokens ?? 800,
      temperature: opts.temperature ?? 0.6,
      top_p: 0.95,
      stream: true,
    }),
    signal: AbortSignal.timeout(60_000),
  });

  if (!res.ok || !res.body) {
    const text = await res.text().catch(() => "");
    throw new Error(`Minimax HTTP ${res.status}: ${text.slice(0, 300)}`);
  }

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
      const trimmed = line.trim();
      if (!trimmed.startsWith("data:")) continue;
      const payload = trimmed.slice(5).trim();
      if (!payload || payload === "[DONE]") continue;
      try {
        const json = JSON.parse(payload);
        const delta = json?.choices?.[0]?.delta?.content;
        if (typeof delta === "string" && delta) yield delta;
      } catch {
        // Partial SSE line split across a chunk boundary — the rest of it
        // arrives in the next read, so just skip this fragment.
      }
    }
  }
}
