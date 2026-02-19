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
          "prose max-w-none focus:outline-none px-4 sm:px-10 py-6 sm:py-10 min-h-[600px] sm:min-h-[1100px] text-zinc-900 md:text-white pb-24 md:pb-10",
      },
    },
  });

  if (!editor) return null;

  return (
    <div className="w-full bg-white md:bg-[#f8f9fa]">
      {/* ===== Top App Bar - Mobile: Minimal, Desktop: Full ===== */}
      <div className="sticky top-0 z-50 bg-white md:bg-white border-b border-gray-200">
        {/* Mobile Top Bar - Minimal Icons Only */}
        <div className="md:hidden flex items-center justify-between px-3 py-3">
          <Button 
            variant="ghost" 
            size="icon" 
            className="text-white"
            onClick={() => editor.chain().focus().undo().run()}
          >
            <Undo className="h-5 w-5" />
          </Button>
          <Button 
            variant="ghost" 
            size="icon" 
            className="text-white"
            onClick={() => editor.chain().focus().redo().run()}
          >
            <Redo className="h-5 w-5" />
          </Button>
          
          <Select onValueChange={(v) => editor.chain().focus().setFontFamily(v).run()}>
            <SelectTrigger className="h-9 w-[50px] bg-transparent border-none text-white">
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
            className="text-white"
            onClick={() => editor.chain().focus().setTextAlign("center").run()}
          >
            <AlignCenter className="h-5 w-5" />
          </Button>
          <Button 
            variant="ghost" 
            size="icon" 
            className="text-white"
            onClick={() => window.print()}
          >
            <Printer className="h-5 w-5" />
          </Button>
        </div>

        {/* Desktop Title Row */}
        <div className="hidden md:flex items-center gap-2 sm:gap-4 px-3 sm:px-6 py-2 sm:py-3">
          <input
            defaultValue="Answer Document"
            className="text-base sm:text-xl font-semibold outline-none focus:bg-muted px-2 py-1 rounded w-full"
          />
        </div>

        {/* Desktop Toolbar – full features */}
        <div className="hidden md:flex items-center gap-1 px-2 sm:px-4 py-2 overflow-x-auto scrollbar-thin scrollbar-thumb-gray-300">
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
      <div className="flex justify-center py-0 md:py-4 sm:py-10 px-0 md:px-2 sm:px-4">
        <div className="bg-white md:bg-white shadow-sm w-full sm:w-[820px] min-h-[600px] sm:min-h-[1100px]">
          <EditorContent editor={editor} />
        </div>
      </div>

      {/* ===== Bottom Mobile Toolbar ===== */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-[#2d2d2d] border-t border-gray-700 px-3 py-3 flex items-center justify-around z-50">
        <Button 
          variant="ghost" 
          size="icon" 
          className={editor.isActive("bold") ? "text-blue-400" : "text-white"}
          onClick={() => editor.chain().focus().toggleBold().run()}
        >
          <Bold className="h-5 w-5" />
        </Button>
        
        <Button 
          variant="ghost" 
          size="icon"
          className={editor.isActive("italic") ? "text-blue-400" : "text-white"}
          onClick={() => editor.chain().focus().toggleItalic().run()}
        >
          <Italic className="h-5 w-5" />
        </Button>
        
        <Button 
          variant="ghost" 
          size="icon"
          className={editor.isActive("underline") ? "text-blue-400" : "text-white"}
          onClick={() => editor.chain().focus().toggleUnderline().run()}
        >
          <UnderlineIcon className="h-5 w-5" />
        </Button>
        
        <Select onValueChange={(v) => editor.chain().focus().setFontSize(`${v}px`).run()}>
          <SelectTrigger className="h-9 w-[45px] bg-transparent border-none text-white">
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
          className="h-9 w-9 p-1 bg-transparent border-none"
          value={editor.getAttributes("textStyle").color || "#ffffff"}
          onChange={(e) => editor.chain().focus().setColor(e.target.value).run()}
        />

        <Button 
          variant="ghost" 
          size="icon"
          className="text-white"
          onClick={() => {
            const currentAlign = editor.isActive({ textAlign: 'left' }) ? 'center' 
              : editor.isActive({ textAlign: 'center' }) ? 'right'
              : editor.isActive({ textAlign: 'right' }) ? 'justify'
              : 'left';
            editor.chain().focus().setTextAlign(currentAlign).run();
          }}
        >
          <AlignJustify className="h-5 w-5" />
        </Button>
        
        <Button 
          variant="ghost" 
          size="icon"
          className={editor.isActive("bulletList") ? "text-blue-400" : "text-white"}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
        >
          <List className="h-5 w-5" />
        </Button>
      </div>
    </div>
  );
}
