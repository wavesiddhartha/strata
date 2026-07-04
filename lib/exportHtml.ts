type JSONNode = {
  type: string;
  attrs?: Record<string, unknown>;
  content?: JSONNode[];
  text?: string;
  marks?: { type: string; attrs?: Record<string, unknown> }[];
};

function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function inlineHtml(nodes: JSONNode[] = []): string {
  return nodes
    .map((n) => {
      if (n.type === "hardBreak") return "<br/>";
      if (n.type !== "text") return "";
      let text = escapeHtml(n.text ?? "");
      for (const mark of n.marks ?? []) {
        switch (mark.type) {
          case "bold":
            text = `<strong>${text}</strong>`;
            break;
          case "italic":
            text = `<em>${text}</em>`;
            break;
          case "strike":
            text = `<s>${text}</s>`;
            break;
          case "code":
            text = `<code>${text}</code>`;
            break;
          case "link":
            text = `<a href="${escapeHtml((mark.attrs?.href as string) ?? "#")}">${text}</a>`;
            break;
        }
      }
      return text;
    })
    .join("");
}

function blockHtml(node: JSONNode): string {
  switch (node.type) {
    case "paragraph":
      return `<p>${inlineHtml(node.content)}</p>`;
    case "heading": {
      const level = Math.min(6, Math.max(1, Number(node.attrs?.level ?? 1)));
      return `<h${level}>${inlineHtml(node.content)}</h${level}>`;
    }
    case "bulletList":
      return `<ul>${(node.content ?? []).map((li) => `<li>${(li.content ?? []).map(blockHtml).join("")}</li>`).join("")}</ul>`;
    case "orderedList":
      return `<ol>${(node.content ?? []).map((li) => `<li>${(li.content ?? []).map(blockHtml).join("")}</li>`).join("")}</ol>`;
    case "blockquote":
      return `<blockquote>${(node.content ?? []).map(blockHtml).join("")}</blockquote>`;
    case "codeBlock":
      return `<pre><code>${escapeHtml((node.content ?? []).map((n) => n.text ?? "").join(""))}</code></pre>`;
    case "horizontalRule":
      return "<hr/>";
    default:
      return "";
  }
}

/**
 * Renders a full standalone HTML document styled to match the on-screen
 * editor — this is what the PDF export feeds to the headless browser, so
 * what you see on screen is genuinely what downloads, not a separate
 * print template drifting out of sync.
 */
export function docToStandaloneHtml(doc: JSONNode, title?: string): string {
  const body = (doc.content ?? []).map(blockHtml).join("\n");
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<title>${escapeHtml(title || "Untitled document")}</title>
<style>
  @page { size: A4; margin: 28mm 24mm; }
  body {
    font-family: Georgia, "Times New Roman", serif;
    font-size: 12.5pt;
    line-height: 1.65;
    color: #1a1a1a;
    max-width: 680px;
    margin: 0 auto;
  }
  h1, h2, h3 { font-weight: 500; line-height: 1.3; margin: 1.4em 0 0.5em; }
  h1 { font-size: 1.9em; }
  h2 { font-size: 1.5em; }
  h3 { font-size: 1.2em; }
  p { margin: 0.9em 0; }
  ul, ol { margin: 0.9em 0; padding-left: 1.4em; }
  li { margin: 0.35em 0; }
  blockquote {
    border-left: 2px solid #d8d3c4;
    margin: 1em 0;
    padding-left: 1em;
    color: rgba(26,26,26,0.65);
    font-style: italic;
  }
  code {
    font-family: ui-monospace, "SF Mono", Menlo, monospace;
    font-size: 0.85em;
    background: #f0eee6;
    border-radius: 4px;
    padding: 0.1em 0.35em;
  }
  pre {
    background: #1a1a1a;
    color: #f0eee6;
    border-radius: 8px;
    padding: 1em;
    overflow-x: auto;
    font-size: 0.85em;
  }
  pre code { background: none; padding: 0; }
  hr { border: none; border-top: 1px solid #d8d3c4; margin: 2em 0; }
  .doc-title { font-size: 2.2em; font-weight: 500; margin-bottom: 0.8em; }
  h1, h2, h3 { break-after: avoid; }
  blockquote, pre, li { break-inside: avoid; }
  p { orphans: 3; widows: 3; }
</style>
</head>
<body>
${title ? `<div class="doc-title">${escapeHtml(title)}</div>` : ""}
${body}
</body>
</html>`;
}
