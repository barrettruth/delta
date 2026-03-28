interface ProseMirrorNode {
  type: string;
  text?: string;
  content?: ProseMirrorNode[];
}

const BLOCK_TYPES = new Set([
  "paragraph",
  "heading",
  "codeBlock",
  "blockquote",
]);

function extractText(node: ProseMirrorNode): string {
  if (node.type === "text") {
    return node.text ?? "";
  }

  if (node.type === "hardBreak") return "\n";

  if (!node.content) {
    if (BLOCK_TYPES.has(node.type)) return "\n";
    return "";
  }

  const parts: string[] = [];
  for (const child of node.content) {
    parts.push(extractText(child));
  }

  const inner = parts.join("");

  if (BLOCK_TYPES.has(node.type)) {
    return `${inner}\n`;
  }

  return inner;
}

export function notesToPlaintext(json: string | null): string {
  if (!json) return "";

  let parsed: ProseMirrorNode;
  try {
    parsed = JSON.parse(json);
  } catch {
    return "";
  }

  if (!parsed.content) return "";

  return extractText(parsed).replace(/\n+$/, "");
}
