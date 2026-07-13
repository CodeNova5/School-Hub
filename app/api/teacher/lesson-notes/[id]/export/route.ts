import { DOC_FOOTER_LESSON_NOTES_EXPORT } from "@/data";
import { NextRequest, NextResponse } from 'next/server';
import { getTeacherQuestionBankContext } from '@/lib/teacher-question-bank/server';
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  Table,
  TableRow,
  TableCell,
  WidthType,
  AlignmentType,
  BorderStyle,
  Header,
  Footer,
  PageNumber,
  UnderlineType,
  convertInchesToTwip,
} from 'docx';

export const dynamic = 'force-dynamic';

type RouteContext = {
  params: Promise<{ id: string }>;
};

/**
 * Parse markdown-like content into docx Paragraph elements.
 * Supports bold (**text**), headers (###), bullet lists, numbered lists,
 * and simple tables (| col1 | col2 |).
 */
function parseContentToParagraphs(content: string): (Paragraph | Table)[] {
  const elements: (Paragraph | Table)[] = [];
  const lines = content.split('\n');

  let inTable = false;
  let tableRows: string[][] = [];
  let tableColCount = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Detect table start
    if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
      // Skip separator rows like | --- | --- |
      if (/^\|[\s\-:]+\|$/.test(trimmed)) continue;

      const cells = trimmed
        .split('|')
        .filter((_, idx, arr) => idx > 0 && idx < arr.length - 1) // Remove empty first/last due to leading/trailing |
        .map((c) => c.trim());

      if (!inTable) {
        inTable = true;
        tableRows = [];
        tableColCount = cells.length;
      }
      tableRows.push(cells);
      continue;
    }

    // If we were in a table and the line doesn't look like a table row, flush it
    if (inTable && !(trimmed.startsWith('|') && trimmed.endsWith('|'))) {
      if (tableRows.length > 0) {
        elements.push(buildTable(tableRows, tableColCount));
      }
      inTable = false;
      tableRows = [];
      tableColCount = 0;
    }

    if (!trimmed) {
      elements.push(new Paragraph({ spacing: { after: 120 } }));
      continue;
    }

    // Headers (###)
    if (/^#{1,3}\s/.test(trimmed)) {
      const level = trimmed.match(/^#+/)![0].length;
      const text = trimmed.replace(/^#+\s*/, '');
      const headingLevel = level === 1 ? HeadingLevel.HEADING_1 : level === 2 ? HeadingLevel.HEADING_2 : HeadingLevel.HEADING_3;
      elements.push(
        new Paragraph({
          text,
          heading: headingLevel,
          spacing: { before: 240, after: 120 },
        })
      );
      continue;
    }

    // Numbered list
    if (/^\d+[\.\)]\s/.test(trimmed)) {
      const text = trimmed.replace(/^\d+[\.\)]\s*/, '');
      elements.push(
        new Paragraph({
          children: parseInlineFormatting(text),
          bullet: { level: 0 },
          // number formatting handled by the numbering property in the text content below
          spacing: { after: 60 },
        })
      );
      continue;
    }

    // Bullet list
    if (/^[-*]\s/.test(trimmed)) {
      const text = trimmed.replace(/^[-*]\s*/, '');
      elements.push(
        new Paragraph({
          children: parseInlineFormatting(text),
          bullet: { level: 0 },
          spacing: { after: 60 },
        })
      );
      continue;
    }

    // Regular paragraph
    elements.push(
      new Paragraph({
        children: parseInlineFormatting(trimmed),
        spacing: { after: 120 },
      })
    );
  }

  // Flush any remaining table
  if (inTable && tableRows.length > 0) {
    elements.push(buildTable(tableRows, tableColCount));
  }

  return elements;
}

function parseInlineFormatting(text: string): TextRun[] {
  // Split by **bold** markers
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part) => {
    if (!part) return null;
    if (part.startsWith('**') && part.endsWith('**')) {
      return new TextRun({ text: part.slice(2, -2), bold: true, size: 22 });
    }
    // Check for *italic* markers
    if (part.startsWith('*') && part.endsWith('*') && !part.startsWith('**')) {
      return new TextRun({ text: part.slice(1, -1), italics: true, size: 22 });
    }
    return new TextRun({ text: part, size: 22 });
  }).filter((t): t is TextRun => t !== null);
}

function buildTable(rows: string[][], colCount: number): Table {
  return new Table({
    rows: rows.map((row, rowIndex) =>
      new TableRow({
        tableHeader: rowIndex === 0,
        children: row.map((cell) =>
          new TableCell({
            children: [new Paragraph({ children: [new TextRun({ text: cell, size: 20, bold: rowIndex === 0 })], alignment: AlignmentType.LEFT })],
            width: { size: 100 / colCount, type: WidthType.PERCENTAGE },
            borders: {
              top: { style: BorderStyle.SINGLE, size: 1 },
              bottom: { style: BorderStyle.SINGLE, size: 1 },
              left: { style: BorderStyle.SINGLE, size: 1 },
              right: { style: BorderStyle.SINGLE, size: 1 },
            },
          })
        ),
      })
    ),
  });
}

export async function GET(
  _request: NextRequest,
  { params }: RouteContext
) {
  const { id } = await params;
  const ctxResult = await getTeacherQuestionBankContext();
  if (!ctxResult.ok) {
    return NextResponse.json({ error: ctxResult.error }, { status: ctxResult.status });
  }

  const { supabase, teacherId, schoolId } = ctxResult.context;

  const { data: lessonNote, error } = await supabase
    .from('teacher_lesson_notes')
    .select('*')
    .eq('id', id)
    .eq('school_id', schoolId)
    .eq('created_by_teacher_id', teacherId)
    .single();

  if (error || !lessonNote) {
    return NextResponse.json({ error: error?.message || 'Lesson note not found' }, { status: error ? 400 : 404 });
  }

  // Fetch subject/class info for the header
  const { data: subjectClass } = await supabase
    .from('subject_classes')
    .select('subjects!subject_classes_subject_id_fkey(name), classes(name)')
    .eq('id', lessonNote.subject_class_id)
    .maybeSingle();

  const subjectName = (subjectClass as any)?.subjects?.name || 'Subject';
  const className = (subjectClass as any)?.classes?.name || 'Class';

  // Build content from the stored JSON
  const contentData = lessonNote.content as Record<string, unknown> || {};
  const objectives = (lessonNote.objectives as string[]) || [];
  const summary = lessonNote.summary || '';

  const contentElements: (Paragraph | Table)[] = [];

  // Title
  contentElements.push(
    new Paragraph({
      text: lessonNote.title,
      heading: HeadingLevel.TITLE,
      alignment: AlignmentType.CENTER,
      spacing: { after: 200 },
    })
  );

  // Meta info
  contentElements.push(
    new Paragraph({
      children: [
        new TextRun({ text: `Subject: ${subjectName}`, bold: true, size: 22 }),
        new TextRun({ text: `    |    Class: ${className}`, size: 22 }),
        new TextRun({ text: `    |    Topic: ${lessonNote.topic}`, size: 22 }),
      ],
      spacing: { after: 200 },
      alignment: AlignmentType.CENTER,
    })
  );

  // Divider
  contentElements.push(
    new Paragraph({
      children: [new TextRun({ text: '─'.repeat(70), size: 16, color: '999999' })],
      alignment: AlignmentType.CENTER,
      spacing: { after: 200 },
    })
  );

  // Duration
  if (contentData.duration) {
    contentElements.push(
      new Paragraph({
        children: [
          new TextRun({ text: 'Duration: ', bold: true, size: 22 }),
          new TextRun({ text: String(contentData.duration), size: 22 }),
        ],
        spacing: { after: 120 },
      })
    );
  }

  // Previous Knowledge
  if (contentData.previous_knowledge) {
    contentElements.push(
      new Paragraph({
        children: [new TextRun({ text: 'Previous Knowledge: ', bold: true, size: 22, underline: { type: UnderlineType.SINGLE } })],
        spacing: { before: 200, after: 60 },
      })
    );
    contentElements.push(
      new Paragraph({
        children: [new TextRun({ text: String(contentData.previous_knowledge), size: 22 })],
        spacing: { after: 120 },
      })
    );
  }

  // Instructional Materials
  const materials = contentData.instructional_materials as string[];
  if (materials && materials.length > 0) {
    contentElements.push(
      new Paragraph({
        children: [new TextRun({ text: 'Instructional Materials:', bold: true, size: 22, underline: { type: UnderlineType.SINGLE } })],
        spacing: { before: 200, after: 60 },
      })
    );
    for (const material of materials) {
      contentElements.push(
        new Paragraph({
          children: [new TextRun({ text: `• ${material}`, size: 22 })],
          spacing: { after: 40 },
          indent: { left: convertInchesToTwip(0.3) },
        })
      );
    }
  }

  // Objectives
  if (objectives.length > 0) {
    contentElements.push(
      new Paragraph({
        children: [new TextRun({ text: 'Learning Objectives:', bold: true, size: 22, underline: { type: UnderlineType.SINGLE } })],
        spacing: { before: 200, after: 60 },
      })
    );
    for (const objective of objectives) {
      contentElements.push(
        new Paragraph({
          children: [new TextRun({ text: objective, size: 22 })],
          spacing: { after: 60 },
          // number formatting handled by text prefix
        })
      );
    }
  }

  // Introduction
  if (contentData.introduction) {
    contentElements.push(
      new Paragraph({
        children: [new TextRun({ text: 'Introduction', bold: true, size: 22, underline: { type: UnderlineType.SINGLE } })],
        spacing: { before: 200, after: 60 },
      })
    );
    contentElements.push(
      new Paragraph({
        children: [new TextRun({ text: String(contentData.introduction), size: 22 })],
        spacing: { after: 120 },
      })
    );
  }

  // Main Content
  if (contentData.content) {
    contentElements.push(
      new Paragraph({
        children: [new TextRun({ text: 'Lesson Content', bold: true, size: 24, underline: { type: UnderlineType.SINGLE } })],
        heading: HeadingLevel.HEADING_1,
        spacing: { before: 300, after: 120 },
      })
    );
    const parsedContent = parseContentToParagraphs(String(contentData.content));
    contentElements.push(...parsedContent);
  }

  // Evaluation
  const evaluation = contentData.evaluation as string[];
  if (evaluation && evaluation.length > 0) {
    contentElements.push(
      new Paragraph({
        children: [new TextRun({ text: 'Evaluation Questions', bold: true, size: 22, underline: { type: UnderlineType.SINGLE } })],
        spacing: { before: 200, after: 60 },
      })
    );
    evaluation.forEach((q, idx) => {
      contentElements.push(
        new Paragraph({
          children: [new TextRun({ text: `${idx + 1}. ${q}`, size: 22 })],
          spacing: { after: 60 },
        })
      );
    });
  }

  // Conclusion
  if (contentData.conclusion) {
    contentElements.push(
      new Paragraph({
        children: [new TextRun({ text: 'Conclusion', bold: true, size: 22, underline: { type: UnderlineType.SINGLE } })],
        spacing: { before: 200, after: 60 },
      })
    );
    contentElements.push(
      new Paragraph({
        children: [new TextRun({ text: String(contentData.conclusion), size: 22 })],
        spacing: { after: 120 },
      })
    );
  }

  // Assignment
  if (contentData.assignment) {
    contentElements.push(
      new Paragraph({
        children: [new TextRun({ text: 'Assignment / Homework', bold: true, size: 22, underline: { type: UnderlineType.SINGLE } })],
        spacing: { before: 200, after: 60 },
      })
    );
    contentElements.push(
      new Paragraph({
        children: [new TextRun({ text: String(contentData.assignment), size: 22 })],
        spacing: { after: 120 },
      })
    );
  }

  // Summary
  if (summary) {
    contentElements.push(
      new Paragraph({
        children: [new TextRun({ text: 'Summary', bold: true, size: 22, underline: { type: UnderlineType.SINGLE } })],
        spacing: { before: 200, after: 60 },
      })
    );
    contentElements.push(
      new Paragraph({
        children: [new TextRun({ text: summary, size: 22, italics: true })],
        spacing: { after: 120 },
      })
    );
  }

  // Footer
  contentElements.push(
    new Paragraph({
      children: [new TextRun({ text: '─'.repeat(70), size: 16, color: '999999' })],
      alignment: AlignmentType.CENTER,
      spacing: { before: 400, after: 80 },
    })
  );
  contentElements.push(
    new Paragraph({
      children: [new TextRun({ text: DOC_FOOTER_LESSON_NOTES_EXPORT, size: 18, color: '888888', italics: true })],
      alignment: AlignmentType.CENTER,
      spacing: { after: 40 },
    })
  );

  // Note: Numbering is not passed via Document constructor due to type constraints in docx v9.
  // Numbered items are instead formatted as plain text with the number prefix in the content.
  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: convertInchesToTwip(1),
              right: convertInchesToTwip(1),
              bottom: convertInchesToTwip(1),
              left: convertInchesToTwip(1),
            },
          },
        },
        headers: {
          default: new Header({
            children: [
              new Paragraph({
                children: [
                  new TextRun({ text: `${subjectName} - ${className}`, size: 16, color: '666666' }),
                  new TextRun({ text: '      |      ', size: 16, color: '999999' }),
                  new TextRun({ text: lessonNote.title, size: 16, color: '666666' }),
                ],
                alignment: AlignmentType.RIGHT,
              }),
            ],
          }),
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                children: [
                  new TextRun({ text: 'Page ', size: 16, color: '888888' }),
                  new TextRun({ children: [PageNumber.CURRENT], size: 16, color: '888888' }),
                ],
                alignment: AlignmentType.CENTER,
              }),
            ],
          }),
        },
        children: contentElements,
      },
    ],
  });

  const buffer = await Packer.toBuffer(doc);

  const filename = `${lessonNote.title.replace(/[^a-zA-Z0-9\s-]/g, '').replace(/\s+/g, '_').substring(0, 60)}_Lesson_Note.docx`;

  return new NextResponse(buffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
}
