"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import TextAlign from "@tiptap/extension-text-align";
import Highlight from "@tiptap/extension-highlight";
import Color from "@tiptap/extension-color";
import TextStyle from "@tiptap/extension-text-style";
import FontFamily from "@tiptap/extension-font-family";
// @ts-ignore
import FontSize from "@tiptap/extension-font-size";
import {
    Undo, Redo, Printer, Pilcrow, ChevronDown, Bold, Italic, Underline as UnderlineIcon, Strikethrough,
    Palette, AlignLeft, AlignCenter, AlignRight, AlignJustify, Baseline, List, ListOrdered, Minus,
    Eraser, MoreVertical
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
    DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Toggle } from "@/components/ui/toggle";
import { Input } from "@/components/ui/input";

interface GoogleDocsStyleEditorProps {
    content: string;
    onChange: (content: string) => void;
}

export default function GoogleDocsStyleEditor({ content, onChange }: GoogleDocsStyleEditorProps) {
    const editor = useEditor({
        extensions: [
            StarterKit,
            Underline,
            TextAlign.configure({
                types: ['heading', 'paragraph'],
            }),
            Highlight.configure({ multicolor: true }),
            Color,
            TextStyle,
            FontFamily,
            FontSize,
        ],
        content: content,
        onUpdate: ({ editor }) => {
            onChange(editor.getHTML());
        },
        editorProps: {
            attributes: {
                class:
                    "prose dark:prose-invert prose-sm sm:prose-base lg:prose-lg xl:prose-2xl m-5 focus:outline-none p-8",
            },
        },
    });

    if (!editor) {
        return null;
    }

    return (
        <div className="bg-gray-100 min-h-screen p-8">
            <div className="bg-white shadow-lg rounded-lg max-w-5xl mx-auto">
                {/* App Bar */}
                <div className="p-4 border-b">
                    <input
                        type="text"
                        defaultValue="Untitled document"
                        className="text-2xl font-bold w-full p-2 rounded hover:bg-gray-100 focus:bg-gray-100 focus:outline-none"
                    />
                </div>

                {/* Toolbar */}
                <div className="flex items-center p-2 border-b flex-wrap">
                    <Button variant="ghost" size="icon" onClick={() => editor.chain().focus().undo().run()} disabled={!editor.can().undo()}><Undo className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => editor.chain().focus().redo().run()} disabled={!editor.can().redo()}><Redo className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => window.print()}><Printer className="h-4 w-4" /></Button>
                    <Separator orientation="vertical" className="h-6 mx-2" />
                    <Select defaultValue="100%">
                        <SelectTrigger className="w-24">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="50%">50%</SelectItem>
                            <SelectItem value="75%">75%</SelectItem>
                            <SelectItem value="100%">100%</SelectItem>
                            <SelectItem value="125%">125%</SelectItem>
                            <SelectItem value="150%">150%</SelectItem>
                        </SelectContent>
                    </Select>
                    <Separator orientation="vertical" className="h-6 mx-2" />
                    <Select
                        value={editor.isActive('textStyle', { fontFamily: 'Arial' }) ? 'Arial' : editor.isActive('textStyle', { fontFamily: 'Georgia' }) ? 'Georgia' : editor.isActive('textStyle', { fontFamily: 'Times New Roman' }) ? 'Times New Roman' : 'Verdana'}
                        onValueChange={(value) => editor.chain().focus().setFontFamily(value).run()}
                    >
                        <SelectTrigger className="w-32">
                            <SelectValue placeholder="Font" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="Arial">Arial</SelectItem>
                            <SelectItem value="Georgia">Georgia</SelectItem>
                            <SelectItem value="Times New Roman">Times New Roman</SelectItem>
                            <SelectItem value="Verdana">Verdana</SelectItem>
                        </SelectContent>
                    </Select>
                    <Separator orientation="vertical" className="h-6 mx-2" />
                    <Select
                        onValueChange={(value) => editor.chain().focus().setFontSize(`${value}px`).run()}
                    >
                        <SelectTrigger className="w-16">
                            <SelectValue placeholder="Size" />
                        </SelectTrigger>
                        <SelectContent>
                            {[8, 9, 10, 11, 12, 14, 16, 18, 24, 30, 36, 48, 60, 72, 96].map(size => (
                                <SelectItem key={size} value={String(size)}>{size}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <Separator orientation="vertical" className="h-6 mx-2" />
                    <Toggle pressed={editor.isActive('bold')} onPressedChange={() => editor.chain().focus().toggleBold().run()}><Bold className="h-4 w-4" /></Toggle>
                    <Toggle pressed={editor.isActive('italic')} onPressedChange={() => editor.chain().focus().toggleItalic().run()}><Italic className="h-4 w-4" /></Toggle>
                    <Toggle pressed={editor.isActive('underline')} onPressedChange={() => editor.chain().focus().toggleUnderline().run()}><UnderlineIcon className="h-4 w-4" /></Toggle>
                    <Input type="color" className="w-10 h-10 p-1" onChange={(e) => editor.chain().focus().setColor(e.target.value).run()} value={editor.getAttributes('textStyle').color || '#000000'} />
                    <Button variant="ghost" size="icon" onClick={() => editor.chain().focus().toggleHighlight().run()}><Palette className="h-4 w-4" /></Button>
                    <Separator orientation="vertical" className="h-6 mx-2" />
                    <Toggle pressed={editor.isActive({ textAlign: 'left' })} onPressedChange={() => editor.chain().focus().setTextAlign('left').run()}><AlignLeft className="h-4 w-4" /></Toggle>
                    <Toggle pressed={editor.isActive({ textAlign: 'center' })} onPressedChange={() => editor.chain().focus().setTextAlign('center').run()}><AlignCenter className="h-4 w-4" /></Toggle>
                    <Toggle pressed={editor.isActive({ textAlign: 'right' })} onPressedChange={() => editor.chain().focus().setTextAlign('right').run()}><AlignRight className="h-4 w-4" /></Toggle>
                    <Toggle pressed={editor.isActive({ textAlign: 'justify' })} onPressedChange={() => editor.chain().focus().setTextAlign('justify').run()}><AlignJustify className="h-4 w-4" /></Toggle>
                    <Separator orientation="vertical" className="h-6 mx-2" />
                    <Toggle pressed={editor.isActive('bulletList')} onPressedChange={() => editor.chain().focus().toggleBulletList().run()}><List className="h-4 w-4" /></Toggle>
                    <Toggle pressed={editor.isActive('orderedList')} onPressedChange={() => editor.chain().focus().toggleOrderedList().run()}><ListOrdered className="h-4 w-4" /></Toggle>
                    <Separator orientation="vertical" className="h-6 mx-2" />
                    <Button variant="ghost" size="icon" onClick={() => editor.chain().focus().clearNodes().unsetAllMarks().run()}><Eraser className="h-4 w-4" /></Button>
                </div>
                {/* Editor Content */}
                <div className="p-8">
                    <div className="bg-white shadow-sm">
                        <EditorContent editor={editor} />
                    </div>
                </div>
            </div>
        </div>
    );
}
