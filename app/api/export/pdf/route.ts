import { NextRequest, NextResponse } from "next/server";
import puppeteer from "puppeteer";
import { docToStandaloneHtml } from "@/lib/exportHtml";

export const runtime = "nodejs";
export const maxDuration = 60;

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

  const html = docToStandaloneHtml(body.doc as any, body.title);

  let browser;
  try {
    browser = await puppeteer.launch({ headless: true, args: ["--no-sandbox"] });
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "load" });
    const pdf = await page.pdf({ format: "A4", printBackground: true });

    const filename = `${(body.title || "untitled").replace(/[^a-z0-9\-_ ]/gi, "").slice(0, 60) || "untitled"}.pdf`;
    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (err) {
    console.error("pdf export failed:", err);
    const message = err instanceof Error ? err.message : "";
    const chromiumMissing = message.includes("Could not find") || message.includes("chrome") || message.includes("browser");
    return NextResponse.json(
      {
        error: chromiumMissing
          ? "PDF export needs a one-time setup step: run `npx puppeteer browsers install chrome` in the project folder, then try again. Use Print / Save as PDF in the meantime."
          : "PDF generation failed. Use Print / Save as PDF as a fallback.",
      },
      { status: 500 }
    );
  } finally {
    await browser?.close();
  }
}
