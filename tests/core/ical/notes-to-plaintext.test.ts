import { describe, expect, it } from "vitest";
import { notesToPlaintext } from "@/core/ical/notes-to-plaintext";

describe("notesToPlaintext", () => {
  it("returns empty string for null", () => {
    expect(notesToPlaintext(null)).toBe("");
  });

  it("returns empty string for empty string", () => {
    expect(notesToPlaintext("")).toBe("");
  });

  it("returns empty string for invalid JSON", () => {
    expect(notesToPlaintext("not json")).toBe("");
  });

  it("returns empty string for doc with no content", () => {
    expect(notesToPlaintext(JSON.stringify({ type: "doc" }))).toBe("");
  });

  it("extracts text from a single paragraph", () => {
    const doc = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [{ type: "text", text: "Hello world" }],
        },
      ],
    };
    expect(notesToPlaintext(JSON.stringify(doc))).toBe("Hello world");
  });

  it("joins multiple paragraphs with newlines", () => {
    const doc = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [{ type: "text", text: "First" }],
        },
        {
          type: "paragraph",
          content: [{ type: "text", text: "Second" }],
        },
      ],
    };
    expect(notesToPlaintext(JSON.stringify(doc))).toBe("First\nSecond");
  });

  it("handles inline marks (bold, italic) by extracting text", () => {
    const doc = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            { type: "text", text: "normal " },
            {
              type: "text",
              text: "bold",
              marks: [{ type: "bold" }],
            },
            { type: "text", text: " text" },
          ],
        },
      ],
    };
    expect(notesToPlaintext(JSON.stringify(doc))).toBe("normal bold text");
  });

  it("extracts text from headings", () => {
    const doc = {
      type: "doc",
      content: [
        {
          type: "heading",
          attrs: { level: 2 },
          content: [{ type: "text", text: "Title" }],
        },
        {
          type: "paragraph",
          content: [{ type: "text", text: "Body" }],
        },
      ],
    };
    expect(notesToPlaintext(JSON.stringify(doc))).toBe("Title\nBody");
  });

  it("extracts text from code blocks", () => {
    const doc = {
      type: "doc",
      content: [
        {
          type: "codeBlock",
          content: [{ type: "text", text: "const x = 1;" }],
        },
      ],
    };
    expect(notesToPlaintext(JSON.stringify(doc))).toBe("const x = 1;");
  });

  it("extracts text from bullet lists", () => {
    const doc = {
      type: "doc",
      content: [
        {
          type: "bulletList",
          content: [
            {
              type: "listItem",
              content: [
                {
                  type: "paragraph",
                  content: [{ type: "text", text: "Item A" }],
                },
              ],
            },
            {
              type: "listItem",
              content: [
                {
                  type: "paragraph",
                  content: [{ type: "text", text: "Item B" }],
                },
              ],
            },
          ],
        },
      ],
    };
    expect(notesToPlaintext(JSON.stringify(doc))).toBe("Item A\nItem B");
  });

  it("extracts text from task lists", () => {
    const doc = {
      type: "doc",
      content: [
        {
          type: "taskList",
          content: [
            {
              type: "taskItem",
              attrs: { checked: true },
              content: [
                {
                  type: "paragraph",
                  content: [{ type: "text", text: "Done item" }],
                },
              ],
            },
            {
              type: "taskItem",
              attrs: { checked: false },
              content: [
                {
                  type: "paragraph",
                  content: [{ type: "text", text: "Todo item" }],
                },
              ],
            },
          ],
        },
      ],
    };
    expect(notesToPlaintext(JSON.stringify(doc))).toBe("Done item\nTodo item");
  });

  it("handles hardBreak nodes", () => {
    const doc = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            { type: "text", text: "line one" },
            { type: "hardBreak" },
            { type: "text", text: "line two" },
          ],
        },
      ],
    };
    expect(notesToPlaintext(JSON.stringify(doc))).toBe("line one\nline two");
  });

  it("handles blockquotes", () => {
    const doc = {
      type: "doc",
      content: [
        {
          type: "blockquote",
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text: "Quoted text" }],
            },
          ],
        },
      ],
    };
    expect(notesToPlaintext(JSON.stringify(doc))).toBe("Quoted text");
  });

  it("handles empty paragraphs", () => {
    const doc = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [{ type: "text", text: "Before" }],
        },
        { type: "paragraph" },
        {
          type: "paragraph",
          content: [{ type: "text", text: "After" }],
        },
      ],
    };
    expect(notesToPlaintext(JSON.stringify(doc))).toBe("Before\n\nAfter");
  });
});
