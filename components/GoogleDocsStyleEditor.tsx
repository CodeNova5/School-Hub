"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import TextAlign from "@tiptap/extension-text-align";
import Highlight from "@tiptap/extension-highlight";
import Color from "@tiptap/extension-color";
import { TextStyle } from "@tiptap/extension-text-style";
import FontFamily from "@tiptap/extension-font-family";
// @ts-ignore
import { FontSize } from "@/lib/tiptap/font-size";

import {
  Undo,
  Redo,
  Printer,
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Strikethrough,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  List,
  ListOrdered,
  Eraser,
  ChevronDown,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Toggle } from "@/components/ui/toggle";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";

interface GoogleDocsStyleEditorProps {
  content: string;
  onChange: (content: string) => void;
}

export default function GoogleDocsStyleEditor({
  content,
  onChange,
}: GoogleDocsStyleEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      Highlight.configure({ multicolor: true }),
      Color,
      TextStyle,
      FontFamily,
      FontSize,
    ],
    content,
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
    editorProps: {
      attributes: {
        class:
          "prose max-w-none focus:outline-none px-4 sm:px-10 py-6 sm:py-10 min-h-[600px] sm:min-h-[1100px]",
      },
    },
  });

  if (!editor) return null;

  return (
    <div className="w-full bg-[#f8f9fa]">
      {/* ===== Top App Bar (like Google Docs) ===== */}
      <div className="sticky top-0 z-50 bg-white border-b">
        {/* Title Row */}
        <div className="flex items-center gap-2 sm:gap-4 px-3 sm:px-6 py-2 sm:py-3">
          <input
            defaultValue="Answer Document"
            className="text-base sm:text-xl font-semibold outline-none focus:bg-muted px-2 py-1 rounded w-full"
          />
        </div>

        {/* Toolbar – single line */}
        <div className="flex items-center gap-1 px-2 sm:px-4 py-2 overflow-x-auto scrollbar-thin scrollbar-thumb-gray-300">
          <Button variant="ghost" size="icon" onClick={() => editor.chain().focus().undo().run()}>
            <Undo className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => editor.chain().focus().redo().run()}>
            <Redo className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => window.print()}>
            <Printer className="h-4 w-4" />
          </Button>

          <Separator orientation="vertical" className="h-6 mx-2" />

          {/* Font family */}
          <Select onValueChange={(v) => editor.chain().focus().setFontFamily(v).run()}>
            <SelectTrigger className="h-8 w-[100px] sm:w-[140px] text-xs sm:text-sm">
              <SelectValue placeholder="Arial" />
            </SelectTrigger>
            <SelectContent>
              {["Arial", "Georgia", "Times New Roman", "Verdana", "Courier New", "Comic Sans MS", "Cursive", "Sans Serif"].map((f) => (
                <SelectItem key={f} value={f}>
                  {f}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Font size */}
          <Select onValueChange={(v) => editor.chain().focus().setFontSize(`${v}px`).run()}>
            <SelectTrigger className="h-8 w-[60px] sm:w-[70px] text-xs sm:text-sm">
              <SelectValue placeholder="14" />
            </SelectTrigger>
            <SelectContent>
              {[8, 9, 10, 11, 12, 14, 16, 18, 24, 30, 36].map((s) => (
                <SelectItem key={s} value={String(s)}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Separator orientation="vertical" className="h-6 mx-2" />

          <Toggle pressed={editor.isActive("bold")} onPressedChange={() => editor.chain().focus().toggleBold().run()}>
            <Bold className="h-4 w-4" />
          </Toggle>
          <Toggle pressed={editor.isActive("italic")} onPressedChange={() => editor.chain().focus().toggleItalic().run()}>
            <Italic className="h-4 w-4" />
          </Toggle>
          <Toggle pressed={editor.isActive("underline")} onPressedChange={() => editor.chain().focus().toggleUnderline().run()}>
            <UnderlineIcon className="h-4 w-4" />
          </Toggle>
          <Toggle pressed={editor.isActive("strike")} onPressedChange={() => editor.chain().focus().toggleStrike().run()}>
            <Strikethrough className="h-4 w-4" />
          </Toggle>

          <Input
            type="color"
            className="h-8 w-8 p-1"
            value={editor.getAttributes("textStyle").color || "#000000"}
            onChange={(e) => editor.chain().focus().setColor(e.target.value).run()}
          />

          <Separator orientation="vertical" className="h-6 mx-2" />

          <Toggle onPressedChange={() => editor.chain().focus().setTextAlign("left").run()}>
            <AlignLeft className="h-4 w-4" />
          </Toggle>
          <Toggle onPressedChange={() => editor.chain().focus().setTextAlign("center").run()}>
            <AlignCenter className="h-4 w-4" />
          </Toggle>
          <Toggle onPressedChange={() => editor.chain().focus().setTextAlign("right").run()}>
            <AlignRight className="h-4 w-4" />
          </Toggle>
          <Toggle onPressedChange={() => editor.chain().focus().setTextAlign("justify").run()}>
            <AlignJustify className="h-4 w-4" />
          </Toggle>

          <Separator orientation="vertical" className="h-6 mx-2" />

          <Toggle onPressedChange={() => editor.chain().focus().toggleBulletList().run()}>
            <List className="h-4 w-4" />
          </Toggle>
          <Toggle onPressedChange={() => editor.chain().focus().toggleOrderedList().run()}>
            <ListOrdered className="h-4 w-4" />
          </Toggle>

          <Separator orientation="vertical" className="h-6 mx-2" />

          <Button variant="ghost" size="icon" onClick={() => editor.chain().focus().clearNodes().unsetAllMarks().run()}>
            <Eraser className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* ===== Page Canvas ===== */}
      <div className="flex justify-center py-4 sm:py-10 px-2 sm:px-4">
        <div className="bg-white shadow-sm w-full sm:w-[820px] min-h-[600px] sm:min-h-[1100px]">
          <EditorContent editor={editor} />
        </div>
      </div>
    </div>
  );
}
