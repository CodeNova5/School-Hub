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
  Type,
  Palette,
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
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class:
          "prose max-w-none focus:outline-none px-4 sm:px-10 py-4 sm:py-6 min-h-[300px] sm:min-h-[500px] text-zinc-900 pb-24 md:pb-10",
      },
    },
  });

  if (!editor) return null;

  return (
    <div className="w-full bg-white md:bg-gradient-to-br md:from-slate-50 md:to-blue-50">
      {/* ===== Top App Bar - Mobile: Minimal, Desktop: Full ===== */}
      <div className="sticky top-0 z-50 bg-white md:bg-white md:shadow-md border-b border-gray-200 md:border-gray-300">
        {/* Mobile Top Bar - Minimal Icons Only */}
        <div className="md:hidden flex items-center justify-between px-3 py-3 bg-gradient-to-r from-gray-50 to-blue-50">
          <Button
            variant="ghost"
            size="icon"
            className="hover:bg-gray-200 rounded-full transition-colors text-gray-700"
            onClick={() => editor.chain().focus().undo().run()}
            title="Undo"
          >
            <Undo className="h-5 w-5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="hover:bg-gray-200 rounded-full transition-colors text-gray-700"
            onClick={() => editor.chain().focus().redo().run()}
            title="Redo"
          >
            <Redo className="h-5 w-5" />
          </Button>

          <Select onValueChange={(v) => editor.chain().focus().setFontFamily(v).run()}>
            <SelectTrigger className="h-9 w-[50px] bg-transparent border-none text-gray-700 hover:bg-gray-100 rounded transition-colors">
              <SelectValue placeholder="A≡" />
            </SelectTrigger>
            <SelectContent>
              {["Arial", "Georgia", "Times New Roman", "Verdana", "Courier New"].map((f) => (
                <SelectItem key={f} value={f}>{f}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button
            variant="ghost"
            size="icon"
            className="hover:bg-gray-200 rounded-full transition-colors text-gray-700"
            onClick={() => editor.chain().focus().setTextAlign("center").run()}
            title="Center align"
          >
            <AlignCenter className="h-5 w-5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="hover:bg-gray-200 rounded-full transition-colors text-gray-700"
            onClick={() => window.print()}
            title="Print"
          >
            <Printer className="h-5 w-5" />
          </Button>
        </div>

        {/* Desktop Title Row */}
        <div className="hidden md:flex items-center gap-2 sm:gap-4 px-3 sm:px-6 py-3 sm:py-4 bg-white border-b border-gray-100">
          <input
            defaultValue="Answer Document"
            className="text-lg sm:text-2xl font-bold outline-none focus:bg-blue-50 px-3 py-2 rounded-lg w-full transition-colors text-gray-900 placeholder-gray-400"
          />
        </div>

        {/* Desktop Toolbar – full features */}
        <div className="hidden md:flex items-center gap-2 px-3 sm:px-6 py-3 overflow-x-auto scrollbar-thin scrollbar-thumb-gray-300 bg-white flex-wrap">
          <Button variant="ghost" size="icon" className="hover:bg-blue-50 rounded transition-colors" onClick={() => editor.chain().focus().undo().run()} title="Undo">
            <Undo className="h-4 w-4 text-gray-700" />
          </Button>
          <Button variant="ghost" size="icon" className="hover:bg-blue-50 rounded transition-colors" onClick={() => editor.chain().focus().redo().run()} title="Redo">
            <Redo className="h-4 w-4 text-gray-700" />
          </Button>
          <Button variant="ghost" size="icon" className="hover:bg-blue-50 rounded transition-colors" onClick={() => window.print()} title="Print">
            <Printer className="h-4 w-4 text-gray-700" />
          </Button>

          <Separator orientation="vertical" className="h-6 mx-2 bg-gray-300" />

          {/* Font family */}
          <Select onValueChange={(v) => editor.chain().focus().setFontFamily(v).run()}>
            <SelectTrigger className="h-8 w-[100px] sm:w-[140px] text-xs sm:text-sm hover:bg-blue-50 rounded transition-colors">
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
            <SelectTrigger className="h-8 w-[60px] sm:w-[70px] text-xs sm:text-sm hover:bg-blue-50 rounded transition-colors">
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

          <Separator orientation="vertical" className="h-6 mx-2 bg-gray-300" />

          <Toggle pressed={editor.isActive("bold")} onPressedChange={() => editor.chain().focus().toggleBold().run()} className={editor.isActive("bold") ? "bg-blue-100 text-blue-700" : "hover:bg-gray-100"} title="Bold (Ctrl+B)">
            <Bold className="h-4 w-4" />
          </Toggle>
          <Toggle pressed={editor.isActive("italic")} onPressedChange={() => editor.chain().focus().toggleItalic().run()} className={editor.isActive("italic") ? "bg-blue-100 text-blue-700" : "hover:bg-gray-100"} title="Italic (Ctrl+I)">
            <Italic className="h-4 w-4" />
          </Toggle>
          <Toggle pressed={editor.isActive("underline")} onPressedChange={() => editor.chain().focus().toggleUnderline().run()} className={editor.isActive("underline") ? "bg-blue-100 text-blue-700" : "hover:bg-gray-100"} title="Underline (Ctrl+U)">
            <UnderlineIcon className="h-4 w-4" />
          </Toggle>
          <Toggle pressed={editor.isActive("strike")} onPressedChange={() => editor.chain().focus().toggleStrike().run()} className={editor.isActive("strike") ? "bg-blue-100 text-blue-700" : "hover:bg-gray-100"} title="Strikethrough">
            <Strikethrough className="h-4 w-4" />
          </Toggle>

          <div className="flex items-center gap-1 px-1">
            <Palette className="h-4 w-4 text-gray-600" />
            <Input
              type="color"
              className="h-8 w-8 p-1 cursor-pointer border border-gray-300 rounded hover:border-blue-400 transition-colors"
              value={editor.getAttributes("textStyle").color || "#000000"}
              onChange={(e) => editor.chain().focus().setColor(e.target.value).run()}
              title="Text color"
            />
          </div>

          <Separator orientation="vertical" className="h-6 mx-2 bg-gray-300" />

          <div className="flex items-center gap-1">
            <Toggle pressed={editor.isActive({ textAlign: "left" })} onPressedChange={() => editor.chain().focus().setTextAlign("left").run()} className={editor.isActive({ textAlign: "left" }) || !editor.isActive("textAlign") ? "bg-blue-100 text-blue-700" : "hover:bg-gray-100"} title="Align left">
              <AlignLeft className="h-4 w-4" />
            </Toggle>
            <Toggle pressed={editor.isActive({ textAlign: "center" })} onPressedChange={() => editor.chain().focus().setTextAlign("center").run()} className={editor.isActive({ textAlign: "center" }) ? "bg-blue-100 text-blue-700" : "hover:bg-gray-100"} title="Align center">
              <AlignCenter className="h-4 w-4" />
            </Toggle>
            <Toggle pressed={editor.isActive({ textAlign: "right" })} onPressedChange={() => editor.chain().focus().setTextAlign("right").run()} className={editor.isActive({ textAlign: "right" }) ? "bg-blue-100 text-blue-700" : "hover:bg-gray-100"} title="Align right">
              <AlignRight className="h-4 w-4" />
            </Toggle>
            <Toggle pressed={editor.isActive({ textAlign: "justify" })} onPressedChange={() => editor.chain().focus().setTextAlign("justify").run()} className={editor.isActive({ textAlign: "justify" }) ? "bg-blue-100 text-blue-700" : "hover:bg-gray-100"} title="Justify">
              <AlignJustify className="h-4 w-4" />
            </Toggle>
          </div>

          <Separator orientation="vertical" className="h-6 mx-2 bg-gray-300" />

          <Toggle pressed={editor.isActive("bulletList")} onPressedChange={() => editor.chain().focus().toggleBulletList().run()} className={editor.isActive("bulletList") ? "bg-blue-100 text-blue-700" : "hover:bg-gray-100"} title="Bullet list">
            <List className="h-4 w-4" />
          </Toggle>
          <Toggle pressed={editor.isActive("orderedList")} onPressedChange={() => editor.chain().focus().toggleOrderedList().run()} className={editor.isActive("orderedList") ? "bg-blue-100 text-blue-700" : "hover:bg-gray-100"} title="Numbered list">
            <ListOrdered className="h-4 w-4" />
          </Toggle>

          <Separator orientation="vertical" className="h-6 mx-2 bg-gray-300" />

          <Button variant="ghost" size="icon" className="hover:bg-red-50 text-gray-700 hover:text-red-700 rounded transition-colors" onClick={() => editor.chain().focus().clearNodes().unsetAllMarks().run()} title="Clear formatting">
            <Eraser className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* ===== Page Canvas ===== */}
      <div className="flex justify-center py-4 md:py-6 px-0 md:px-4 bg-gradient-to-br from-slate-50 to-blue-50">
        <div className="bg-white shadow-xl md:shadow-2xl rounded-lg md:rounded-xl w-full sm:w-[820px] min-h-[300px] sm:min-h-[500px] border border-gray-200">
          <EditorContent editor={editor} />
        </div>
      </div>

      {/* ===== Bottom Mobile Toolbar ===== */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-gradient-to-r from-gray-800 to-gray-900 border-t border-gray-700 px-2 py-3 flex items-center justify-around z-50 shadow-2xl">
        <Button
          variant="ghost"
          size="icon"
          className={`rounded transition-colors ${editor.isActive("bold") ? "bg-blue-500 text-white" : "text-gray-300 hover:text-white hover:bg-gray-700"}`}
          onClick={() => editor.chain().focus().toggleBold().run()}
          title="Bold"
        >
          <Bold className="h-5 w-5" />
        </Button>

        <Button
          variant="ghost"
          size="icon"
          className={`rounded transition-colors ${editor.isActive("italic") ? "bg-blue-500 text-white" : "text-gray-300 hover:text-white hover:bg-gray-700"}`}
          onClick={() => editor.chain().focus().toggleItalic().run()}
          title="Italic"
        >
          <Italic className="h-5 w-5" />
        </Button>

        <Button
          variant="ghost"
          size="icon"
          className={`rounded transition-colors ${editor.isActive("underline") ? "bg-blue-500 text-white" : "text-gray-300 hover:text-white hover:bg-gray-700"}`}
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          title="Underline"
        >
          <UnderlineIcon className="h-5 w-5" />
        </Button>

        <Select onValueChange={(v) => editor.chain().focus().setFontSize(`${v}px`).run()}>
          <SelectTrigger className="h-9 w-[45px] bg-transparent border-none text-gray-300 hover:text-white rounded transition-colors">
            <SelectValue placeholder="A" />
          </SelectTrigger>
          <SelectContent>
            {[8, 10, 12, 14, 16, 18, 24, 30].map((s) => (
              <SelectItem key={s} value={String(s)}>{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Input
          type="color"
          className="h-9 w-9 p-1 cursor-pointer rounded border border-gray-600 hover:border-white transition-colors"
          value={editor.getAttributes("textStyle").color || "#ffffff"}
          onChange={(e) => editor.chain().focus().setColor(e.target.value).run()}
          title="Text color"
        />

        <Button
          variant="ghost"
          size="icon"
          className="rounded transition-colors text-gray-300 hover:text-white hover:bg-gray-700"
          onClick={() => {
            const currentAlign = editor.isActive({ textAlign: 'left' }) ? 'center'
              : editor.isActive({ textAlign: 'center' }) ? 'right'
                : editor.isActive({ textAlign: 'right' }) ? 'justify'
                  : 'left';
            editor.chain().focus().setTextAlign(currentAlign).run();
          }}
          title="Cycle text alignment"
        >
          <AlignJustify className="h-5 w-5" />
        </Button>

        <Button
          variant="ghost"
          size="icon"
          className={`rounded transition-colors ${editor.isActive("bulletList") ? "bg-blue-500 text-white" : "text-gray-300 hover:text-white hover:bg-gray-700"}`}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          title="Bullet list"
        >
          <List className="h-5 w-5" />
        </Button>
      </div>
    </div>
  );
}
