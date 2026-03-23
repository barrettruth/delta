"use client";

import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import TaskItem from "@tiptap/extension-task-item";
import TaskList from "@tiptap/extension-task-list";
import type { JSONContent } from "@tiptap/react";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import {
  Bold,
  CheckSquare,
  Code,
  Heading1,
  Heading2,
  Heading3,
  Italic,
  Link2,
  List,
  ListOrdered,
  Quote,
} from "lucide-react";
import { useCallback, useEffect } from "react";
import CodeBlockShiki from "tiptap-extension-code-block-shiki";
import { Button } from "@/components/ui/button";
import "./tiptap-styles.css";

const midnight = {
  name: "midnight" as const,
  type: "dark" as const,
  colors: {
    "editor.background": "#222222",
    "editor.foreground": "#e0e0e0",
  },
  tokenColors: [
    {
      scope: [
        "storage.type",
        "storage.modifier",
        "keyword.control",
        "keyword.operator.new",
      ],
      settings: { foreground: "#7aa2f7" },
    },
    {
      scope: [
        "string.quoted",
        "constant.numeric",
        "constant.language",
        "constant.character",
        "number",
      ],
      settings: { foreground: "#98c379" },
    },
  ],
};

const daylight = {
  name: "daylight" as const,
  type: "light" as const,
  colors: {
    "editor.background": "#ebebeb",
    "editor.foreground": "#1a1a1a",
  },
  tokenColors: [
    {
      scope: [
        "storage.type",
        "storage.modifier",
        "keyword.control",
        "keyword.operator.new",
      ],
      settings: { foreground: "#3b5bdb" },
    },
    {
      scope: [
        "string.quoted",
        "constant.numeric",
        "constant.language",
        "constant.character",
        "number",
      ],
      settings: { foreground: "#2d7f3e" },
    },
  ],
};

function parseContent(content: string | null): JSONContent | undefined {
  if (!content) return undefined;
  try {
    const parsed = JSON.parse(content);
    if (parsed && typeof parsed === "object" && parsed.type === "doc") {
      return parsed;
    }
    return undefined;
  } catch {
    return {
      type: "doc",
      content: [
        { type: "paragraph", content: [{ type: "text", text: content }] },
      ],
    };
  }
}

export function TiptapEditor({
  content,
  onChange,
}: {
  content: string | null;
  onChange: (json: string) => void;
}) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({ codeBlock: false }),
      CodeBlockShiki.configure({
        themes: { light: "daylight", dark: "midnight" } as never,
        defaultLanguage: null,
        customThemes: [midnight, daylight],
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: { class: "" },
      }),
      TaskList,
      TaskItem.configure({ nested: true }),
      Placeholder.configure({ placeholder: "Add notes\u2026" }),
    ],
    content: parseContent(content),
    immediatelyRender: false,
    onUpdate: ({ editor: e }) => {
      onChange(JSON.stringify(e.getJSON()));
    },
    editorProps: {
      attributes: {
        class: "tiptap",
      },
    },
  });

  useEffect(() => {
    if (!editor) return;
    const parsed = parseContent(content);
    const current = JSON.stringify(editor.getJSON());
    const incoming = parsed ? JSON.stringify(parsed) : "";
    if (current !== incoming) {
      editor.commands.setContent(parsed ?? null);
    }
  }, [content, editor]);

  const setLink = useCallback(() => {
    if (!editor) return;
    const prev = editor.getAttributes("link").href;
    const url = window.prompt("URL", prev ?? "");
    if (url === null) return;
    if (url === "") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
    } else {
      editor
        .chain()
        .focus()
        .extendMarkRange("link")
        .setLink({ href: url })
        .run();
    }
  }, [editor]);

  if (!editor) return null;

  return (
    <div className="bg-transparent">
      <div className="flex flex-wrap gap-0.5 border-b border-border/40 px-1 py-1">
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          onClick={() => editor.chain().focus().toggleBold().run()}
          className={editor.isActive("bold") ? "bg-muted" : ""}
        >
          <Bold className="size-3.5" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          onClick={() => editor.chain().focus().toggleItalic().run()}
          className={editor.isActive("italic") ? "bg-muted" : ""}
        >
          <Italic className="size-3.5" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          onClick={() =>
            editor.chain().focus().toggleHeading({ level: 1 }).run()
          }
          className={editor.isActive("heading", { level: 1 }) ? "bg-muted" : ""}
        >
          <Heading1 className="size-3.5" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          onClick={() =>
            editor.chain().focus().toggleHeading({ level: 2 }).run()
          }
          className={editor.isActive("heading", { level: 2 }) ? "bg-muted" : ""}
        >
          <Heading2 className="size-3.5" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          onClick={() =>
            editor.chain().focus().toggleHeading({ level: 3 }).run()
          }
          className={editor.isActive("heading", { level: 3 }) ? "bg-muted" : ""}
        >
          <Heading3 className="size-3.5" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          className={editor.isActive("bulletList") ? "bg-muted" : ""}
        >
          <List className="size-3.5" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          className={editor.isActive("orderedList") ? "bg-muted" : ""}
        >
          <ListOrdered className="size-3.5" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          onClick={() => editor.chain().focus().toggleTaskList().run()}
          className={editor.isActive("taskList") ? "bg-muted" : ""}
        >
          <CheckSquare className="size-3.5" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          onClick={setLink}
          className={editor.isActive("link") ? "bg-muted" : ""}
        >
          <Link2 className="size-3.5" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          onClick={() => editor.chain().focus().toggleCodeBlock().run()}
          className={editor.isActive("codeBlock") ? "bg-muted" : ""}
        >
          <Code className="size-3.5" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          className={editor.isActive("blockquote") ? "bg-muted" : ""}
        >
          <Quote className="size-3.5" />
        </Button>
      </div>
      <EditorContent editor={editor} />
    </div>
  );
}
