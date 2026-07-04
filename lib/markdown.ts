// A small, dependency-free serializer from TipTap's JSON document shape to
// Markdown. Covers exactly what StarterKit produces (paragraphs, headings,
// bold/italic/code/strike marks, links, bullet/ordered lists, blockquotes,
// code blocks, horizontal rules) — enough for everything this editor can
// currently produce. Not a general-purpose ProseMirror-to-Markdown library.

type JSONNode = {
  type: string;
  attrs?: Record<string, unknown>;
  content?: JSONNode[];
  text?: string;
  marks?: { type: string; attrs?: Record<string, unknown> }[];
};

function serializeText(node: JSONNode): string {
  let text = node.text ?? "";
  for (const mark of node.marks ?? []) {
    switch (mark.type) {
      case "bold":
        text = `**${text}**`;
        break;
      case "italic":
        text = `*${text}*`;
        break;
      case "strike":
        text = `~~${text}~~`;
        break;
      case "code":
        text = `\`${text}\``;
        break;
      case "link":
        text = `[${text}](${(mark.attrs?.href as string) ?? ""})`;
        break;
    }
  }
  return text;
}

function serializeInline(nodes: JSONNode[] = []): string {
  return nodes
    .map((n) => (n.type === "text" ? serializeText(n) : n.type === "hardBreak" ? "  \n" : ""))
    .join("");
}

function serializeList(node: JSONNode, ordered: boolean, depth: number): string {
  const indent = "  ".repeat(depth);
  return (node.content ?? [])
    .map((item, i) => {
      const marker = ordered ? `${i + 1}.` : "-";
      const inner = (item.content ?? [])
        .map((child) => serializeBlock(child, depth + 1))
        .join("\n")
        .trim();
      return `${indent}${marker} ${inner}`;
    })
    .join("\n");
}

function serializeBlock(node: JSONNode, depth = 0): string {
  switch (node.type) {
    case "paragraph":
      return serializeInline(node.content);
    case "heading": {
      const level = Math.min(6, Math.max(1, Number(node.attrs?.level ?? 1)));
      return `${"#".repeat(level)} ${serializeInline(node.content)}`;
    }
    case "bulletList":
      return serializeList(node, false, depth);
    case "orderedList":
      return serializeList(node, true, depth);
    case "blockquote":
      return (node.content ?? [])
        .map((child) => serializeBlock(child, depth))
        .join("\n")
        .split("\n")
        .map((line) => `> ${line}`)
        .join("\n");
    case "codeBlock":
      return "```\n" + (node.content ?? []).map((n) => n.text ?? "").join("") + "\n```";
    case "horizontalRule":
      return "---";
    default:
      return node.content ? serializeInline(node.content) : "";
  }
}

export function docToMarkdown(doc: JSONNode, title?: string): string {
  const blocks = (doc.content ?? []).map((node) => serializeBlock(node)).filter((b) => b.trim());
  const body = blocks.join("\n\n");
  return title ? `# ${title}\n\n${body}` : body;
}
