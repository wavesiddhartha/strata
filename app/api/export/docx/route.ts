import { NextRequest, NextResponse } from "next/server";
import { docToDocxBuffer } from "@/lib/docx";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(req: NextRequest) {
  let body: { doc?: unknown; title?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
  if (!body.doc) {
    return NextResponse.json({ error: "doc is required" }, { status: 400 });
  }

  try {
    const buffer = await docToDocxBuffer(body.doc as any, body.title);
    const filename = `${(body.title || "untitled").replace(/[^a-z0-9\-_ ]/gi, "").slice(0, 60) || "untitled"}.docx`;
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (err) {
    console.error("docx export failed:", err);
    return NextResponse.json({ error: "Failed to generate the document." }, { status: 500 });
  }
}
