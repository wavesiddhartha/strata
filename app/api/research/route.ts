import { NextRequest } from "next/server";
import { streamText } from "@/lib/ai";
import { webSearch, fetchPageText } from "@/lib/search";
import { researchSystemPrompt, researchUserPrompt } from "@/lib/prompts";
import { encodeEvent } from "@/lib/protocol";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  let body: { query?: string };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid request body" }), { status: 400 });
  }

  const query = body.query?.trim();
  if (!query) {
    return new Response(JSON.stringify({ error: "query is required" }), { status: 400 });
  }

  const encoder = new TextEncoder();
  const send = (controller: ReadableStreamDefaultController, event: Parameters<typeof encodeEvent>[0]) =>
    controller.enqueue(encoder.encode(encodeEvent(event)));

  const stream = new ReadableStream({
    async start(controller) {
      try {
        send(controller, { type: "status", label: "Searching the web…" });
        const results = await webSearch(query, 4);
        if (results.length === 0) {
          throw new Error("No search results came back for that.");
        }

        send(controller, { type: "status", label: `Reading ${results.length} sources…` });
        const withText = await Promise.all(
          results.map(async (r, i) => {
            const id = String(i + 1);
            try {
              const text = await fetchPageText(r.url);
              return { id, title: r.title, url: r.url, text: text || r.snippet };
            } catch {
              // Some sites block scraping — fall back to the search snippet
              // rather than dropping the source entirely.
              return { id, title: r.title, url: r.url, text: r.snippet };
            }
          })
        );

        send(controller, { type: "status", label: "Writing a synthesis…" });
        for await (const chunk of streamText(
          researchSystemPrompt(),
          researchUserPrompt(query, withText),
          { temperature: 0.4, maxTokens: 700 }
        )) {
          send(controller, { type: "token", text: chunk });
        }

        send(controller, {
          type: "sources",
          sources: withText.map(({ id, title, url }) => ({ id, title, url })),
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : "Research failed.";
        send(controller, { type: "error", message });
      }
      send(controller, { type: "done" });
      controller.close();
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-cache" },
  });
}
