import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  ExternalHyperlink,
} from "docx";

type JSONNode = {
  type: string;
  attrs?: Record<string, unknown>;
  content?: JSONNode[];
  text?: string;
  marks?: { type: string; attrs?: Record<string, unknown> }[];
};

const HEADING_MAP: Record<number, (typeof HeadingLevel)[keyof typeof HeadingLevel]> = {
  1: HeadingLevel.HEADING_1,
  2: HeadingLevel.HEADING_2,
  3: HeadingLevel.HEADING_3,
  4: HeadingLevel.HEADING_4,
  5: HeadingLevel.HEADING_5,
  6: HeadingLevel.HEADING_6,
};

function runsFromInline(nodes: JSONNode[] = []): (TextRun | ExternalHyperlink)[] {
  const runs: (TextRun | ExternalHyperlink)[] = [];
  for (const node of nodes) {
    if (node.type === "hardBreak") {
      runs.push(new TextRun({ text: "", break: 1 }));
      continue;
    }
    if (node.type !== "text") continue;
    const marks = node.marks ?? [];
    const linkMark = marks.find((m) => m.type === "link");
    const options = {
      text: node.text ?? "",
      bold: marks.some((m) => m.type === "bold"),
      italics: marks.some((m) => m.type === "italic"),
      strike: marks.some((m) => m.type === "strike"),
      font: marks.some((m) => m.type === "code") ? "Courier New" : undefined,
    };
    if (linkMark) {
      runs.push(
        new ExternalHyperlink({
          link: (linkMark.attrs?.href as string) ?? "#",
          children: [new TextRun({ ...options, style: "Hyperlink" })],
        })
      );
    } else {
      runs.push(new TextRun(options));
    }
  }
  return runs;
}

function listParagraphs(node: JSONNode, ordered: boolean, depth: number): Paragraph[] {
  const paragraphs: Paragraph[] = [];
  for (const item of node.content ?? []) {
    for (const child of item.content ?? []) {
      if (child.type === "paragraph") {
        paragraphs.push(
          new Paragraph({
            children: runsFromInline(child.content),
            bullet: ordered ? undefined : { level: depth },
            numbering: ordered ? { reference: "numbered-list", level: depth } : undefined,
          })
        );
      } else if (child.type === "bulletList" || child.type === "orderedList") {
        paragraphs.push(...listParagraphs(child, child.type === "orderedList", depth + 1));
      }
    }
  }
  return paragraphs;
}

function blocksFromNode(node: JSONNode): Paragraph[] {
  switch (node.type) {
    case "paragraph":
      return [new Paragraph({ children: runsFromInline(node.content) })];

    case "heading": {
      const level = Math.min(6, Math.max(1, Number(node.attrs?.level ?? 1)));
      return [new Paragraph({ heading: HEADING_MAP[level], children: runsFromInline(node.content) })];
    }

    case "bulletList":
      return listParagraphs(node, false, 0);
    case "orderedList":
      return listParagraphs(node, true, 0);

    case "blockquote":
      return (node.content ?? []).map(
        (child) =>
          new Paragraph({
            children: runsFromInline(child.content),
            indent: { left: 480 },
            border: { left: { color: "D8D3C4", space: 8, style: "single", size: 12 } },
          })
      );

    case "codeBlock":
      return [
        new Paragraph({
          children: [
            new TextRun({ text: (node.content ?? []).map((n) => n.text ?? "").join(""), font: "Courier New" }),
          ],
          shading: { fill: "F0EEE6", type: "clear", color: "auto" },
        }),
      ];

    case "horizontalRule":
      return [
        new Paragraph({
          border: { bottom: { color: "D8D3C4", space: 1, style: "single", size: 6 } },
          children: [],
        }),
      ];

    default:
      return [];
  }
}

export async function docToDocxBuffer(doc: JSONNode, title?: string): Promise<Buffer> {
  const children: Paragraph[] = [];
  if (title) {
    children.push(new Paragraph({ heading: HeadingLevel.TITLE, alignment: AlignmentType.LEFT, children: [new TextRun({ text: title })] }));
  }
  for (const node of doc.content ?? []) {
    children.push(...blocksFromNode(node));
  }

  const document = new Document({
    numbering: {
      config: [
        {
          reference: "numbered-list",
          levels: [{ level: 0, format: "decimal", text: "%1.", alignment: AlignmentType.START }],
        },
      ],
    },
    sections: [{ properties: {}, children }],
  });

  return Packer.toBuffer(document);
}
