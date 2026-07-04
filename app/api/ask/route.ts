import { NextRequest } from "next/server";
import { streamText } from "@/lib/ai";
import { askSystemPrompt, askUserPrompt } from "@/lib/prompts";
import { encodeEvent } from "@/lib/protocol";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  let body: { question?: string; docText?: string };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid request body" }), { status: 400 });
  }

  const question = body.question?.trim();
  if (!question) {
    return new Response(JSON.stringify({ error: "question is required" }), { status: 400 });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      controller.enqueue(encoder.encode(encodeEvent({ type: "status", label: "Thinking…" })));
      try {
        for await (const chunk of streamText(
          askSystemPrompt(),
          askUserPrompt(question, body.docText ?? ""),
          { temperature: 0.6, maxTokens: 500 }
        )) {
          controller.enqueue(encoder.encode(encodeEvent({ type: "token", text: chunk })));
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : "Something went wrong.";
        controller.enqueue(encoder.encode(encodeEvent({ type: "error", message })));
      }
      controller.enqueue(encoder.encode(encodeEvent({ type: "done" })));
      controller.close();
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-cache" },
  });
}
