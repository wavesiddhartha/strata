import { NextRequest } from "next/server";
import { streamText } from "@/lib/ai";
import { rewriteSystemPrompt, rewriteUserPrompt, type RewriteInstruction } from "@/lib/prompts";
import { encodeEvent } from "@/lib/protocol";

export const runtime = "nodejs";
export const maxDuration = 60;

const VALID: RewriteInstruction[] = ["expand", "simplify", "formalize", "fix", "continue"];

export async function POST(req: NextRequest) {
  let body: { selectedText?: string; instruction?: string };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid request body" }), { status: 400 });
  }

  const selectedText = body.selectedText?.trim();
  const instruction = body.instruction as RewriteInstruction;
  if (!selectedText) {
    return new Response(JSON.stringify({ error: "selectedText is required" }), { status: 400 });
  }
  if (!VALID.includes(instruction)) {
    return new Response(JSON.stringify({ error: "invalid instruction" }), { status: 400 });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of streamText(
          rewriteSystemPrompt(instruction),
          rewriteUserPrompt(selectedText),
          { temperature: 0.5, maxTokens: 600 }
        )) {
          controller.enqueue(encoder.encode(encodeEvent({ type: "token", text: chunk })));
        }
      } catch {
        // On failure, stream back the original text unchanged so the
        // client's replace-in-place logic leaves the document intact.
        controller.enqueue(encoder.encode(encodeEvent({ type: "token", text: selectedText })));
      }
      controller.enqueue(encoder.encode(encodeEvent({ type: "done" })));
      controller.close();
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-cache" },
  });
}
