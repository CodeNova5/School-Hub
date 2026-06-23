"use client";

import { useEffect, useState, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import {
  BookOpen,
  Sparkles,
  FileText,
  Download,
  Trash2,
  Eye,
  Edit3,
  Plus,
  Calendar,
  ChevronDown,
  ChevronUp,
  Loader2,
  GraduationCap,
  ListTree,
  Bot,
  RefreshCw,
  Save,
  FileDown,
  Clock,
  Target,
  Lightbulb,
  BookMarked,
  UserCheck,
  CheckCircle2,
  ArrowLeft,
  X,
  Check,
  BarChart3,
  AlertCircle,
  NotebookPen,
  Search,
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { cn } from '@/lib/utils';

/* ────────────────────────────────────────────────────────────────────────── */
/*  Types                                                                      */
/* ────────────────────────────────────────────────────────────────────────── */

interface SubjectClass {
  id: string;
  subject_id: string;
  class_id: string;
  subjects: { id: string; name: string };
  classes: { id: string; name: string };
}

interface TopicGroup {
  id: string;
  title: string;
  topics: string[];
  term: number;
}

type LessonNoteRecord = {
  id: string;
  title: string;
  topic: string;
  subject_class_id: string;
  content: Record<string, unknown>;
  objectives: string[];
  summary: string;
  status: 'draft' | 'published' | 'archived';
  created_at: string;
  updated_at: string;
};

interface GeneratedLessonNote {
  title: string;
  topic: string;
  subject: string;
  class: string;
  duration: string;
  objectives: string[];
  instructional_materials: string[];
  previous_knowledge: string;
  introduction: string;
  content: string;
  evaluation: string[];
  conclusion: string;
  assignment: string;
  summary: string;
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  Sub-components                                                             */
/* ────────────────────────────────────────────────────────────────────────── */

function InlineEditor({ value, onSave, onCancel, large }: {
  value: string;
  onSave: (val: string) => void;
  onCancel: () => void;
  large?: boolean;
}) {
  const [editVal, setEditVal] = useState(value);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [editVal]);

  return (
    <div className="space-y-2">
      <textarea
        ref={textareaRef}
        value={editVal}
        onChange={(e) => setEditVal(e.target.value)}
        className={`w-full rounded-xl border border-stone-200 p-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-none transition-shadow ${large ? 'min-h-[200px]' : 'min-h-[80px]'}`}
      />
      <div className="flex items-center gap-2">
        <button onClick={() => onSave(editVal)} className="px-3 py-1.5 text-xs font-medium bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors">
          <Check className="h-3.5 w-3.5 inline mr-1" />
          Done
        </button>
        <button onClick={onCancel} className="px-3 py-1.5 text-xs font-medium text-stone-600 hover:text-stone-800 transition-colors">
          Cancel
        </button>
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  Skeleton Loader                                                            */
/* ────────────────────────────────────────────────────────────────────────── */

function Skeleton({ className }: { className?: string }) {
  return (
    <div className={cn('animate-pulse rounded-xl bg-stone-100', className)} />
  );
}

function NoteCardSkeleton() {
  return (
    <div className="rounded-xl border border-stone-200 bg-white overflow-hidden">
      <div className="h-1 w-full bg-stone-100" />
      <div className="p-5 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <Skeleton className="h-5 w-3/4" />
        </div>
        <Skeleton className="h-3 w-1/3" />
        <div className="flex gap-2">
          <Skeleton className="h-5 w-16 rounded-full" />
          <Skeleton className="h-5 w-20 rounded-full" />
        </div>
        <Skeleton className="h-8 w-full" />
        <div className="flex gap-2 pt-2 border-t border-stone-100">
          <Skeleton className="h-8 w-16" />
          <Skeleton className="h-8 w-16" />
          <Skeleton className="h-8 w-8 ml-auto" />
        </div>
      </div>
    </div>
  );
}

function EditableCard({ icon, label, color, initialValue, onSave, onCancel }: {
  icon: React.ReactNode;
  label: string;
  color: string;
  initialValue: string;
  onSave: (val: string) => void;
  onCancel: () => void;
}) {
  const [val, setVal] = useState(initialValue);
  const colorMap: Record<string, { bg: string; border: string; text: string; ring: string }> = {
    amber: { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-900', ring: 'ring-amber-400' },
    blue: { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-900', ring: 'ring-blue-400' },
  };
  const c = colorMap[color] || colorMap.amber;
  return (
    <div className={`${c.bg} border ${c.border} rounded-xl p-4`}>
      <div className="flex items-center gap-2 ${c.text} font-medium text-sm mb-1">
        {icon}
        {label}
      </div>
      <input value={val} onChange={(e) => setVal(e.target.value)}
        className={`w-full ${c.bg} ${c.text} text-sm rounded-lg px-2 py-1 focus:outline-none focus:ring-2 ${c.ring}`}
      />
      <div className="flex items-center gap-2 mt-2">
        <button onClick={() => onSave(val)} className="px-2.5 py-1 text-xs font-medium bg-indigo-600 text-white rounded-md hover:bg-indigo-700">
          <Check className="h-3 w-3 inline mr-0.5" />Done
        </button>
        <button onClick={onCancel} className="px-2.5 py-1 text-xs font-medium text-stone-500 hover:text-stone-700">Cancel</button>
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  Component                                                                  */
/* ────────────────────────────────────────────────────────────────────────── */

function inferTermFromTitle(title: string): number {
  const label = title.trim().toLowerCase();
  if (/\b(1st|first|term\s*1|term\s*one)\b/.test(label)) return 1;
  if (/\b(2nd|second|term\s*2|term\s*two)\b/.test(label)) return 2;
  if (/\b(3rd|third|term\s*3|term\s*three)\b/.test(label)) return 3;
  return 1; // default to term 1
}

export function TeacherLessonNotes() {
  const router = useRouter();

  // Data states
  const [subjectClasses, setSubjectClasses] = useState<SubjectClass[]>([]);
  const [topicGroups, setTopicGroups] = useState<TopicGroup[]>([]);
  const [savedNotes, setSavedNotes] = useState<LessonNoteRecord[]>([]);
  const [selectedSubjectClassId, setSelectedSubjectClassId] = useState<string>('');
  const [selectedTopic, setSelectedTopic] = useState<string>('');
  const [selectedTerm, setSelectedTerm] = useState<'1' | '2' | '3'>('1');

  // Loading states
  const [loadingSubjects, setLoadingSubjects] = useState(true);
  const [loadingTopics, setLoadingTopics] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loadingNotes, setLoadingNotes] = useState(false);
  const [exportingId, setExportingId] = useState<string | null>(null);

  // Generated lesson note state
  const [generatedNote, setGeneratedNote] = useState<GeneratedLessonNote | null>(null);

  // Editor state
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState<GeneratedLessonNote | null>(null);
  const [editField, setEditField] = useState<string | null>(null);

  // View state
  const [activeTab, setActiveTab] = useState('generate');
  const [viewNote, setViewNote] = useState<LessonNoteRecord | null>(null);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // Saved notes search & filters
  const [notesSearch, setNotesSearch] = useState('');
  const [notesStatusFilter, setNotesStatusFilter] = useState<'all' | 'draft' | 'published' | 'archived'>('all');
  const [notesSortBy, setNotesSortBy] = useState<'updated_at' | 'title' | 'created_at'>('updated_at');
  const [selectedNoteIds, setSelectedNoteIds] = useState<Set<string>>(new Set());
  const [isBulkMode, setIsBulkMode] = useState(false);

  // Collapsible preview sections
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());

  // Auto-save timer
  const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Planner state
  const [plannerGenerating, setPlannerGenerating] = useState<string | null>(null);

  /* ──────────────────────────────────────────────────────────────────────── */
  /*  Loaders                                                                  */
  /* ──────────────────────────────────────────────────────────────────────── */

  useEffect(() => {
    loadSubjectClasses();
  }, []);

  useEffect(() => {
    if (selectedSubjectClassId) {
      loadTopicGroups();
      loadSavedNotes();
    }
  }, [selectedSubjectClassId]);

  async function loadSubjectClasses() {
    setLoadingSubjects(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: teacher } = await supabase
        .from('teachers')
        .select('id')
        .eq('user_id', user.id)
        .single();

      if (!teacher) {
        toast.error('Teacher profile not found');
        return;
      }

      const { data } = await supabase
        .from('subject_classes')
        .select(`
          id,
          subject_id,
          class_id,
          subjects!subject_classes_subject_id_fkey(id, name),
          classes(id, name)
        `)
        .eq('teacher_id', teacher.id);

      if (data) {
        setSubjectClasses(data as unknown as SubjectClass[]);
        if (data.length > 0 && !selectedSubjectClassId) {
          setSelectedSubjectClassId(data[0].id);
        }
      }
    } catch (error) {
      console.error('Error loading subjects:', error);
      toast.error('Failed to load subjects');
    } finally {
      setLoadingSubjects(false);
    }
  }

  async function loadTopicGroups() {
    if (!selectedSubjectClassId) return;
    setLoadingTopics(true);
    try {
      const res = await fetch(`/api/teacher/question-bank/topics?subjectClassId=${selectedSubjectClassId}`, {
        cache: 'no-store',
      });
      const payload = await res.json();
      if (res.ok && payload.topicSets) {
        // The topics endpoint returns topic sets with name and topics fields
        const groups = (payload.topicSets as any[]).map((g: any) => ({
          id: g.id || '',
          title: g.name || g.title || '',
          topics: Array.isArray(g.topics) ? g.topics : [],
          term: inferTermFromTitle(g.name || g.title || ''),
        }));
        setTopicGroups(groups);
      } else {
        setTopicGroups([]);
      }
    } catch (error) {
      console.error('Error loading topics:', error);
      setTopicGroups([]);
    } finally {
      setLoadingTopics(false);
    }
  }

  async function loadSavedNotes() {
    if (!selectedSubjectClassId) return;
    setLoadingNotes(true);
    try {
      const res = await fetch(`/api/teacher/lesson-notes?subjectClassId=${selectedSubjectClassId}`, {
        cache: 'no-store',
      });
      const payload = await res.json();
      if (res.ok) {
        setSavedNotes(payload.lessonNotes || []);
      }
    } catch (error) {
      console.error('Error loading saved notes:', error);
    } finally {
      setLoadingNotes(false);
    }
  }

  /* ──────────────────────────────────────────────────────────────────────── */
  /*  Actions                                                                  */
  /* ──────────────────────────────────────────────────────────────────────── */

  async function handleGenerate() {
    if (!selectedTopic) {
      toast.error('Please select a topic first');
      return;
    }
    if (!selectedSubjectClassId) {
      toast.error('Please select a subject first');
      return;
    }

    setGenerating(true);
    setGeneratedNote(null);

    const sc = subjectClasses.find((s) => s.id === selectedSubjectClassId);
    const subjectName = sc?.subjects?.name || '';
    const className = sc?.classes?.name || '';

    try {
      const res = await fetch('/api/teacher/lesson-notes/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subjectClassId: selectedSubjectClassId,
          topic: selectedTopic,
          subjectName,
          className,
        }),
      });

      const payload = await res.json();
      if (!res.ok) {
        toast.error(payload?.error || 'Failed to generate lesson note');
        return;
      }

      if (payload?.lessonNote) {
        const note = payload.lessonNote as GeneratedLessonNote;
        setGeneratedNote(note);
        autoSaveDraft(note);
        toast.success('Lesson note generated successfully!');
        setActiveTab('preview');
      } else {
        toast.error('No content generated');
      }
    } catch (error) {
      console.error('Generation error:', error);
      toast.error('Failed to generate lesson note');
    } finally {
      setGenerating(false);
    }
  }

  async function handleSave() {
    if (!generatedNote || !selectedSubjectClassId) return;
    setSaving(true);

    try {
      const res = await fetch('/api/teacher/lesson-notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subjectClassId: selectedSubjectClassId,
          topic: selectedTopic,
          title: generatedNote.title || selectedTopic,
          content: generatedNote,
          objectives: generatedNote.objectives || [],
          summary: generatedNote.summary || '',
        }),
      });

      const payload = await res.json();
      if (!res.ok) {
        toast.error(payload?.error || 'Failed to save lesson note');
        return;
      }

      toast.success('Lesson note saved!');
      setGeneratedNote(null);
      setSelectedTopic('');
      setActiveTab('saved');
      await loadSavedNotes();
    } catch (error) {
      console.error('Save error:', error);
      toast.error('Failed to save lesson note');
    } finally {
      setSaving(false);
    }
  }

  async function handleUpdateStatus(id: string, status: 'draft' | 'published' | 'archived') {
    try {
      const res = await fetch(`/api/teacher/lesson-notes/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });

      if (!res.ok) {
        const payload = await res.json();
        toast.error(payload?.error || 'Failed to update status');
        return;
      }

      toast.success(status === 'published' ? 'Lesson note published!' : status === 'archived' ? 'Lesson note archived' : 'Status updated');
      await loadSavedNotes();
    } catch (error) {
      console.error('Update error:', error);
      toast.error('Failed to update status');
    }
  }

  async function handleDelete(id: string) {
    try {
      const res = await fetch(`/api/teacher/lesson-notes/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const payload = await res.json();
        toast.error(payload?.error || 'Failed to delete');
        return;
      }
      toast.success('Lesson note deleted');
      setConfirmDeleteId(null);
      await loadSavedNotes();
    } catch (error) {
      console.error('Delete error:', error);
      toast.error('Failed to delete lesson note');
    }
  }

  async function handleExport(id: string) {
    setExportingId(id);
    try {
      const res = await fetch(`/api/teacher/lesson-notes/${id}/export`);
      if (!res.ok) {
        toast.error('Failed to export lesson note');
        return;
      }

      const blob = await res.blob();
      const disposition = res.headers.get('Content-Disposition') || '';
      const match = disposition.match(/filename="?(.+?)"?$/);
      const filename = match?.[1] || 'lesson-note.docx';

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success('Lesson note exported as .docx');
    } catch (error) {
      console.error('Export error:', error);
      toast.error('Failed to export lesson note');
    } finally {
      setExportingId(null);
    }
  }

  function handleViewNote(note: LessonNoteRecord) {
    setViewNote(note);
    setIsViewModalOpen(true);
  }

  /* ──────────────────────────────────────────────────────────────────────── */
  /*  Editor Actions                                                           */
  /* ──────────────────────────────────────────────────────────────────────── */

  function handleStartEditing() {
    if (!generatedNote) return;
    setEditData(JSON.parse(JSON.stringify(generatedNote)));
    setIsEditing(true);
  }

  function handleCancelEditing() {
    setIsEditing(false);
    setEditData(null);
    setEditField(null);
  }

  function handleEditFieldChange(field: string, value: string | string[]) {
    if (!editData) return;
    setEditData((prev) => {
      if (!prev) return prev;
      return { ...prev, [field]: value };
    });
  }

  function handleAddListItem(field: 'objectives' | 'evaluation' | 'instructional_materials') {
    if (!editData) return;
    setEditData((prev) => {
      if (!prev) return prev;
      return { ...prev, [field]: [...(prev[field] || []), ''] };
    });
  }

  function handleUpdateListItem(field: 'objectives' | 'evaluation' | 'instructional_materials', index: number, value: string) {
    if (!editData) return;
    setEditData((prev) => {
      if (!prev) return prev;
      const updated = [...(prev[field] || [])];
      updated[index] = value;
      return { ...prev, [field]: updated };
    });
  }

  function handleRemoveListItem(field: 'objectives' | 'evaluation' | 'instructional_materials', index: number) {
    if (!editData) return;
    setEditData((prev) => {
      if (!prev) return prev;
      const updated = [...(prev[field] || [])];
      updated.splice(index, 1);
      return { ...prev, [field]: updated };
    });
  }

  function handleApplyEdits() {
    if (!editData) return;
    setGeneratedNote(editData);
    setIsEditing(false);
    setEditField(null);
    toast.success('Edits applied');
  }

  /* ──────────────────────────────────────────────────────────────────────── */
  /*  Planner Actions                                                           */
  /* ──────────────────────────────────────────────────────────────────────── */

  // Compute topic coverage: which topics have saved lesson notes?
  const savedTopicSet = new Set(savedNotes.map((n) => n.topic.toLowerCase().trim()));
  const plannedTopics = topicGroups.flatMap((g) =>
    g.topics.map((t) => ({
      topic: t,
      term: g.term,
      groupTitle: g.title,
      hasNote: savedTopicSet.has(t.toLowerCase().trim()),
      note: savedNotes.find((n) => n.topic.toLowerCase().trim() === t.toLowerCase().trim()) || null,
    }))
  );
  const filteredPlannedTopics = plannedTopics.filter((p) => String(p.term) === selectedTerm);
  const totalTopics = filteredPlannedTopics.length;
  const coveredTopics = filteredPlannedTopics.filter((p) => p.hasNote).length;
  const coveragePercent = totalTopics > 0 ? Math.round((coveredTopics / totalTopics) * 100) : 0;

  async function handlePlannerGenerate(topic: string) {
    setPlannerGenerating(topic);
    try {
      const sc = subjectClasses.find((s) => s.id === selectedSubjectClassId);
      const res = await fetch('/api/teacher/lesson-notes/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subjectClassId: selectedSubjectClassId,
          topic,
          subjectName: sc?.subjects?.name || '',
          className: sc?.classes?.name || '',
        }),
      });
      const payload = await res.json();
      if (!res.ok) {
        toast.error(payload?.error || 'Failed to generate');
        return;
      }
      if (payload?.lessonNote) {
        // Save directly without going through the preview tab
        const saveRes = await fetch('/api/teacher/lesson-notes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            subjectClassId: selectedSubjectClassId,
            topic,
            title: (payload.lessonNote as GeneratedLessonNote).title || topic,
            content: payload.lessonNote as GeneratedLessonNote,
            objectives: (payload.lessonNote as GeneratedLessonNote).objectives || [],
            summary: (payload.lessonNote as GeneratedLessonNote).summary || '',
          }),
        });
        if (saveRes.ok) {
          toast.success(`Lesson note saved for "${topic}"`);
        }
      }
    } catch (error) {
      toast.error(`Failed to generate for "${topic}"`);
    } finally {
      setPlannerGenerating(null);
      await loadSavedNotes();
    }
  }

  async function handleBatchGenerate() {
    const uncovered = filteredPlannedTopics.filter((p) => !p.hasNote);
    if (uncovered.length === 0) return;

    toast.info(`Generating ${uncovered.length} lesson notes...`);
    let success = 0;
    for (const item of uncovered) {
      const sc = subjectClasses.find((s) => s.id === selectedSubjectClassId);
      try {
        const res = await fetch('/api/teacher/lesson-notes/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            subjectClassId: selectedSubjectClassId,
            topic: item.topic,
            subjectName: sc?.subjects?.name || '',
            className: sc?.classes?.name || '',
          }),
        });
        const payload = await res.json();
        if (res.ok && payload?.lessonNote) {
          await fetch('/api/teacher/lesson-notes', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              subjectClassId: selectedSubjectClassId,
              topic: item.topic,
              title: (payload.lessonNote as GeneratedLessonNote).title || item.topic,
              content: payload.lessonNote as GeneratedLessonNote,
              objectives: (payload.lessonNote as GeneratedLessonNote).objectives || [],
              summary: (payload.lessonNote as GeneratedLessonNote).summary || '',
            }),
          });
          success++;
        }
      } catch {
        // Continue with next topic
      }
    }
    toast.success(`Generated and saved ${success} of ${uncovered.length} lesson notes!`);
    await loadSavedNotes();
  }

  // ── Filtered/sorted notes
  const filteredNotes = useMemo(() => {
    let result = [...savedNotes];

    // Status filter
    if (notesStatusFilter !== 'all') {
      result = result.filter((n) => n.status === notesStatusFilter);
    }

    // Search
    const query = notesSearch.trim().toLowerCase();
    if (query) {
      result = result.filter(
        (n) =>
          n.title.toLowerCase().includes(query) ||
          n.topic.toLowerCase().includes(query) ||
          n.summary?.toLowerCase().includes(query)
      );
    }

    // Sort
    result.sort((a, b) => {
      if (notesSortBy === 'title') {
        return a.title.localeCompare(b.title);
      }
      return new Date(b[notesSortBy]).getTime() - new Date(a[notesSortBy]).getTime();
    });

    return result;
  }, [savedNotes, notesStatusFilter, notesSearch, notesSortBy]);

  // ── Copy to clipboard
  function copyLessonNoteToClipboard() {
    if (!generatedNote) return;
    const text = [
      `# ${generatedNote.title}`,
      '',
      `**Subject:** ${selectedSubject?.subjects?.name} | **Class:** ${selectedSubject?.classes?.name}`,
      `**Topic:** ${generatedNote.topic}`,
      `**Duration:** ${generatedNote.duration}`,
      '',
      '---',
      '',
      '## Learning Objectives',
      ...generatedNote.objectives.map((o, i) => `${i + 1}. ${o}`),
      '',
      '---',
      '',
      `## Previous Knowledge\n${generatedNote.previous_knowledge}`,
      '',
      `## Introduction\n${generatedNote.introduction}`,
      '',
      `## Lesson Content\n${generatedNote.content}`,
      '',
      generatedNote.evaluation.length > 0
        ? `## Evaluation\n${generatedNote.evaluation.map((q, i) => `${i + 1}. ${q}`).join('\n')}`
        : '',
      '',
      `## Conclusion\n${generatedNote.conclusion}`,
      '',
      `## Assignment\n${generatedNote.assignment}`,
      '',
      `## Summary\n${generatedNote.summary}`,
    ]
      .filter(Boolean)
      .join('\n');

    navigator.clipboard.writeText(text).then(
      () => toast.success('Lesson note copied to clipboard'),
      () => toast.error('Failed to copy')
    );
  }

  // ── Print lesson note
  function handlePrintNote() {
    if (!generatedNote) return;
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast.error('Please allow pop-ups to print');
      return;
    }

    const content = [
      '<!DOCTYPE html><html><head>',
      '<meta charset="utf-8">',
      '<meta name="viewport" content="width=device-width, initial-scale=1">',
      '<title>Lesson Note - ' + generatedNote.title.replace(/[<>&"]/g, '') + '</title>',
      '<style>',
      'body { font-family: Georgia, serif; max-width: 800px; margin: 0 auto; padding: 40px; color: #1a1a1a; line-height: 1.6; }',
      'h1 { font-size: 22px; margin-bottom: 8px; color: #1a1a1a; }',
      'h2 { font-size: 17px; margin-top: 24px; margin-bottom: 8px; color: #333; border-bottom: 1px solid #ddd; padding-bottom: 4px; }',
      'h3 { font-size: 15px; margin-top: 20px; margin-bottom: 6px; color: #444; }',
      'p { margin: 6px 0; }',
      'ul, ol { margin: 6px 0 6px 20px; }',
      'li { margin: 2px 0; }',
      '.meta { color: #666; font-size: 14px; margin-bottom: 20px; }',
      '.summary { font-style: italic; color: #555; border-left: 3px solid #ccc; padding-left: 12px; margin-top: 24px; }',
      '.footer { margin-top: 32px; padding-top: 12px; border-top: 1px solid #ddd; font-size: 12px; color: #999; }',
      '@media print { body { padding: 20px; } }',
      '</style></head><body>',
      '<h1>' + generatedNote.title.replace(/[<>&"]/g, '') + '</h1>',
      '<div class="meta">',
      '<strong>Subject:</strong> ' + (selectedSubject?.subjects?.name || 'N/A') + ' | ',
      '<strong>Class:</strong> ' + (selectedSubject?.classes?.name || 'N/A') + ' | ',
      '<strong>Topic:</strong> ' + generatedNote.topic + ' | ',
      '<strong>Duration:</strong> ' + generatedNote.duration,
      '</div>',
    ];

    if (generatedNote.objectives.length > 0) {
      content.push('<h2>Learning Objectives</h2><ol>');
      generatedNote.objectives.forEach(o => content.push('<li>' + o.replace(/[<>&"]/g, '') + '</li>'));
      content.push('</ol>');
    }

    if (generatedNote.previous_knowledge) {
      content.push('<h2>Previous Knowledge</h2><p>' + generatedNote.previous_knowledge.replace(/[<>&"]/g, '') + '</p>');
    }

    if (generatedNote.introduction) {
      content.push('<h2>Introduction</h2><p>' + generatedNote.introduction.replace(/[<>&"]/g, '') + '</p>');
    }

    if (generatedNote.content) {
      content.push('<h2>Lesson Content</h2><div>' + generatedNote.content.replace(/[<>&"]/g, '') + '</div>');
    }

    if (generatedNote.evaluation.length > 0) {
      content.push('<h2>Evaluation Questions</h2><ol>');
      generatedNote.evaluation.forEach(q => content.push('<li>' + q.replace(/[<>&"]/g, '') + '</li>'));
      content.push('</ol>');
    }

    if (generatedNote.conclusion) {
      content.push('<h2>Conclusion</h2><p>' + generatedNote.conclusion.replace(/[<>&"]/g, '') + '</p>');
    }

    if (generatedNote.assignment) {
      content.push('<h2>Assignment</h2><p>' + generatedNote.assignment.replace(/[<>&"]/g, '') + '</p>');
    }

    if (generatedNote.summary) {
      content.push('<div class="summary"><strong>Summary:</strong> ' + generatedNote.summary.replace(/[<>&"]/g, '') + '</div>');
    }

    content.push('<div class="footer">Generated by School Hub AI Lesson Notes</div>');
    content.push('</body></html>');

    printWindow.document.write(content.join('\n'));
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => printWindow.print(), 500);
  }

  // ── Toggle preview section collapse
  function toggleSectionCollapse(section: string) {
    setCollapsedSections((prev) => {
      const next = new Set(prev);
      if (next.has(section)) next.delete(section);
      else next.add(section);
      return next;
    });
  }

  // ── Bulk selection
  function toggleNoteSelection(id: string) {
    setSelectedNoteIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleBulkDelete() {
    if (selectedNoteIds.size === 0) return;
    const count = selectedNoteIds.size;
    if (!confirm(`Delete ${count} selected lesson note${count !== 1 ? 's' : ''}? This cannot be undone.`)) return;

    try {
      await Promise.all(
        Array.from(selectedNoteIds).map((id) =>
          fetch(`/api/teacher/lesson-notes/${id}`, { method: 'DELETE' })
        )
      );

      toast.success(`Deleted ${count} lesson note${count !== 1 ? 's' : ''}`);
      setSelectedNoteIds(new Set());
      setIsBulkMode(false);
      await loadSavedNotes();
    } catch (error) {
      console.error('Bulk delete error:', error);
      toast.error('Failed to delete some lesson notes');
    }
  }

  // ── Draft auto-save
  function autoSaveDraft(note: GeneratedLessonNote) {
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    autoSaveTimerRef.current = setTimeout(() => {
      try {
        localStorage.setItem(
          `lesson-note-draft-${selectedSubjectClassId}-${selectedTopic}`,
          JSON.stringify({ note, savedAt: new Date().toISOString() })
        );
      } catch {
        // localStorage full or unavailable
      }
    }, 3000);
  }

  /* ──────────────────────────────────────────────────────────────────────── */
  /*  Helpers                                                                  */
  /* ──────────────────────────────────────────────────────────────────────── */

  function formatDate(value: string) {
    return new Intl.DateTimeFormat('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(value));
  }

  function getStatusBadge(status: string) {
    switch (status) {
      case 'published':
        return <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200">Published</Badge>;
      case 'archived':
        return <Badge className="bg-stone-100 text-stone-500 border-stone-200">Archived</Badge>;
      default:
        return <Badge className="bg-amber-100 text-amber-700 border-amber-200">Draft</Badge>;
    }
  }

  const filteredTopicGroups = topicGroups.filter((g) => String(g.term) === selectedTerm);
  const allTopics = filteredTopicGroups.flatMap((g) => g.topics);

  const selectedSubject = subjectClasses.find((s) => s.id === selectedSubjectClassId);

  /* ──────────────────────────────────────────────────────────────────────── */
  /*  Render                                                                   */
  /* ──────────────────────────────────────────────────────────────────────── */

  return (
    <div className="min-h-screen bg-stone-50">
      {/* Page Header */}
      <div className="bg-white border-b border-stone-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-5">
          <div className="flex items-center gap-3 mb-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.back()}
              className="text-stone-500 hover:text-stone-800 -ml-2 gap-1.5"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-indigo-100 flex items-center justify-center flex-shrink-0">
                <BookOpen className="h-5 w-5 text-indigo-600" />
              </div>
              <div>
                <h1 className="text-xl font-semibold text-stone-900 leading-tight">
                  AI Lesson Notes
                </h1>
                <p className="text-sm text-stone-500 mt-0.5">
                  Generate, manage, and export lesson notes with AI
                </p>
              </div>
            </div>
          </div>

          {/* Subject selector */}
          <div className="mt-5 grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-stone-500 uppercase tracking-wider">Subject & Class</Label>
              <select
                value={selectedSubjectClassId}
                onChange={(e) => {
                  setSelectedSubjectClassId(e.target.value);
                  setSelectedTopic('');
                  setGeneratedNote(null);
                }}
                className="w-full px-3 py-2 rounded-lg border border-stone-200 bg-white text-sm text-stone-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                disabled={loadingSubjects}
              >
                {loadingSubjects ? (
                  <option>Loading...</option>
                ) : subjectClasses.length === 0 ? (
                  <option>No subjects assigned</option>
                ) : (
                  subjectClasses.map((sc) => (
                    <option key={sc.id} value={sc.id}>
                      {sc.subjects?.name} - {sc.classes?.name}
                    </option>
                  ))
                )}
              </select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-stone-500 uppercase tracking-wider">Term</Label>
              <div className="flex gap-1 bg-stone-100 p-1 rounded-lg">
                {(['1', '2', '3'] as const).map((term) => (
                  <button
                    key={term}
                    onClick={() => setSelectedTerm(term)}
                    className={`flex-1 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                      selectedTerm === term
                        ? 'bg-white text-stone-900 shadow-sm'
                        : 'text-stone-500 hover:text-stone-700'
                    }`}
                  >
                    Term {term}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-stone-500 uppercase tracking-wider">Topic</Label>
              <select
                value={selectedTopic}
                onChange={(e) => {
                  setSelectedTopic(e.target.value);
                  setGeneratedNote(null);
                }}
                className="w-full px-3 py-2 rounded-lg border border-stone-200 bg-white text-sm text-stone-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                disabled={loadingTopics || !selectedSubjectClassId}
              >
                <option value="">Select a topic...</option>
                {allTopics.map((topic, i) => (
                  <option key={`${topic}-${i}`} value={topic}>
                    {topic}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Generate button */}
          <div className="mt-4 flex items-center gap-3">
            <Button
              onClick={handleGenerate}
              disabled={!selectedTopic || generating}
              className="bg-indigo-600 hover:bg-indigo-700 text-white gap-2"
            >
              {generating ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  Generate Lesson Note with AI
                </>
              )}
            </Button>
            {selectedSubject && (
              <span className="text-xs text-stone-400">
                <GraduationCap className="h-3 w-3 inline mr-1" />
                {selectedSubject.subjects?.name} &middot; {selectedSubject.classes?.name}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="bg-white border border-stone-200 rounded-xl p-1">
            <TabsTrigger
              value="preview"
              className="rounded-lg data-[state=active]:bg-indigo-600 data-[state=active]:text-white gap-2"
              disabled={!generatedNote}
            >
              <Eye className="h-4 w-4" />
              Preview
            </TabsTrigger>
            <TabsTrigger value="saved" className="rounded-lg data-[state=active]:bg-indigo-600 data-[state=active]:text-white gap-2">
              <FileText className="h-4 w-4" />
              Saved Notes
              {savedNotes.length > 0 && (
                <Badge variant="secondary" className="ml-1 bg-stone-200 text-stone-600 text-xs">
                  {savedNotes.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="topics" className="rounded-lg data-[state=active]:bg-indigo-600 data-[state=active]:text-white gap-2">
              <ListTree className="h-4 w-4" />
              Topic Groups
            </TabsTrigger>
            <TabsTrigger value="planner" className="rounded-lg data-[state=active]:bg-indigo-600 data-[state=active]:text-white gap-2" disabled={!selectedSubjectClassId}>
              <BarChart3 className="h-4 w-4" />
              Scheme Planner
            </TabsTrigger>
          </TabsList>

          {/* ── Preview Tab ── */}
          <TabsContent value="preview" className="mt-0">
            {generatedNote && (() => {
              const note = generatedNote!;
              const edit = editData!;
              const display = (isEditing ? edit : note);
              return (
              <div className="space-y-4">
                {/* Action bar */}
                <div className="bg-white rounded-xl border border-stone-200 p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-2 text-sm text-stone-600 flex-wrap">
                    <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                    <span>Generated for <strong>{note.topic}</strong></span>
                    {note.duration && (
                      <>
                        <span className="text-stone-300 hidden sm:inline">|</span>
                        <Clock className="h-3.5 w-3.5 shrink-0" />
                        <span>{note.duration}</span>
                      </>
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    {!isEditing && (
                      <>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={copyLessonNoteToClipboard}
                          className="gap-1.5 text-stone-500 hover:text-indigo-600 hover:bg-indigo-50"
                          title="Copy to clipboard"
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          <span className="hidden sm:inline">Copy</span>
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={handlePrintNote}
                          className="gap-1.5 text-stone-500 hover:text-amber-600 hover:bg-amber-50"
                          title="Print lesson note"
                        >
                          <FileText className="h-3.5 w-3.5" />
                          <span className="hidden sm:inline">Print</span>
                        </Button>
                      </>
                    )}
                    {isEditing ? (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleCancelEditing}
                          className="gap-1.5 border-stone-200"
                        >
                          <X className="h-3.5 w-3.5" />
                          Cancel
                        </Button>
                        <Button
                          onClick={handleApplyEdits}
                          size="sm"
                          className="bg-indigo-600 hover:bg-indigo-700 text-white gap-1.5"
                        >
                          <Check className="h-3.5 w-3.5" />
                          Apply Edits
                        </Button>
                        <Button
                          onClick={handleSave}
                          disabled={saving}
                          size="sm"
                          className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5"
                        >
                          {saving ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Save className="h-3.5 w-3.5" />
                          )}
                          Save
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setGeneratedNote(null);
                            setSelectedTopic('');
                          }}
                          className="gap-1.5 border-stone-200"
                        >
                          <RefreshCw className="h-3.5 w-3.5" />
                          New
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleStartEditing}
                          className="gap-1.5 border-stone-200 text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50"
                        >
                          <Edit3 className="h-3.5 w-3.5" />
                          Edit
                        </Button>
                        <Button
                          onClick={handleSave}
                          disabled={saving}
                          size="sm"
                          className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5"
                        >
                          {saving ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Save className="h-3.5 w-3.5" />
                          )}
                          Save
                        </Button>
                      </>
                    )}
                  </div>
                </div>

                {/* Lesson Note Content Card */}
                <Card className="border-stone-200 overflow-hidden">
                  {/* Lesson header - title editable when editing */}
                  <div className="bg-gradient-to-r from-indigo-600 to-purple-600 px-6 py-5 text-white">
                    {isEditing ? (
                      <input
                        value={editData?.title || ''}
                        onChange={(e) => handleEditFieldChange('title', e.target.value)}
                        className="w-full bg-white/10 text-white text-xl font-bold px-3 py-1.5 rounded-lg border border-white/20 focus:outline-none focus:bg-white/20 placeholder:text-white/50"
                      />
                    ) : (
                      <h2 className="text-xl font-bold">{note.title}</h2>
                    )}
                    <p className="text-indigo-100 text-sm mt-1">
                      {selectedSubject?.subjects?.name} &middot; {selectedSubject?.classes?.name} &middot; {note.topic}
                    </p>
                  </div>

                  <CardContent className="p-6 space-y-6">
                    {/* Duration & Materials Row */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {editField === 'duration' && isEditing ? (
                        <EditableCard icon={<Clock className="h-4 w-4" />} label="Duration" color="amber"
                          onSave={(val) => { handleEditFieldChange('duration', val); setEditField(null); }}
                          onCancel={() => setEditField(null)}
                          initialValue={editData?.duration || ''}
                        />
                      ) : (
                        <div
                          onClick={() => isEditing && setEditField('duration')}
                          className={`bg-amber-50 border border-amber-200 rounded-xl p-4 ${isEditing ? 'cursor-pointer hover:ring-2 hover:ring-amber-400 transition-all' : ''}`}
                        >
                          <div className="flex items-center gap-2 text-amber-700 font-medium text-sm mb-1">
                            <Clock className="h-4 w-4" />
                            Duration
                            {isEditing && <Edit3 className="h-3 w-3 ml-auto text-amber-400" />}
                          </div>
                          <p className="text-amber-900 text-sm">{display.duration}</p>
                        </div>
                      )}

                      {editField === 'previous_knowledge' && isEditing ? (
                        <EditableCard icon={<BookMarked className="h-4 w-4" />} label="Previous Knowledge" color="blue"
                          onSave={(val) => { handleEditFieldChange('previous_knowledge', val); setEditField(null); }}
                          onCancel={() => setEditField(null)}
                          initialValue={editData?.previous_knowledge || ''}
                        />
                      ) : (
                        <div
                          onClick={() => isEditing && setEditField('previous_knowledge')}
                          className={`bg-blue-50 border border-blue-200 rounded-xl p-4 ${isEditing ? 'cursor-pointer hover:ring-2 hover:ring-blue-400 transition-all' : ''}`}
                        >
                          <div className="flex items-center gap-2 text-blue-700 font-medium text-sm mb-1">
                            <BookMarked className="h-4 w-4" />
                            Previous Knowledge
                            {isEditing && <Edit3 className="h-3 w-3 ml-auto text-blue-400" />}
                          </div>
                          <p className="text-blue-900 text-sm">{display.previous_knowledge}</p>
                        </div>
                      )}
                    </div>

                    {/* Instructional Materials */}
{display.instructional_materials.length > 0 && (
                      <div className="bg-stone-50 rounded-xl p-4 border border-stone-200">
                        <div className="flex items-center gap-2 text-stone-700 font-medium text-sm mb-2">
                          <Lightbulb className="h-4 w-4 text-amber-500" />
                          Instructional Materials
                          {isEditing && (
                            <button onClick={() => handleAddListItem('instructional_materials')} className="ml-auto text-xs text-indigo-600 hover:text-indigo-800 font-medium">
                              + Add
                            </button>
                          )}
                        </div>
                        {isEditing ? (
                          <div className="space-y-2">
                            {display.instructional_materials.map((mat, i) => (
                              <div key={i} className="flex items-center gap-2">
                                <input
                                  value={mat}
                                  onChange={(e) => handleUpdateListItem('instructional_materials', i, e.target.value)}
                                  className="flex-1 px-3 py-1.5 text-sm rounded-lg border border-stone-200 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                                />
                                <button onClick={() => handleRemoveListItem('instructional_materials', i)} className="text-red-400 hover:text-red-600">
                                  <X className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="flex flex-wrap gap-2">
                            {display.instructional_materials.map((mat, i) => (
                              <Badge key={i} variant="secondary" className="bg-white border border-stone-200 text-stone-600">{mat}</Badge>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Learning Objectives */}
                    {display.objectives.length > 0 && (
                      <div>
                        <div className="flex items-center gap-2 text-base font-semibold text-stone-800 mb-3">
                          <Target className="h-4 w-4 text-emerald-500" />
                          Learning Objectives
                          {isEditing && (
                            <button onClick={() => handleAddListItem('objectives')} className="ml-auto text-xs text-indigo-600 hover:text-indigo-800 font-medium">
                              + Add
                            </button>
                          )}
                        </div>
                        {isEditing ? (
                          <div className="space-y-2">
                            {display.objectives.map((obj, i) => (
                              <div key={i} className="flex items-center gap-2">
                                <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-[11px] font-semibold text-emerald-600">
                                  {i + 1}
                                </span>
                                <input
                                  value={obj}
                                  onChange={(e) => handleUpdateListItem('objectives', i, e.target.value)}
                                  className="flex-1 px-3 py-1.5 text-sm rounded-lg border border-stone-200 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                                />
                                <button onClick={() => handleRemoveListItem('objectives', i)} className="text-red-400 hover:text-red-600">
                                  <X className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <ul className="space-y-2">
                            {display.objectives.map((obj, i) => (
                              <li key={i} className="flex items-start gap-2 text-sm text-stone-700">
                                <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-[11px] font-semibold text-emerald-600 mt-0.5">{i + 1}</span>
                                {obj}
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    )}

                    {/* Introduction */}
                    {display.introduction && (
                      <div className="transition-all duration-200">
                        <h3 className="flex items-center gap-2 text-base font-semibold text-stone-800 mb-3">
                          <button
                            onClick={() => toggleSectionCollapse('introduction')}
                            className="flex items-center gap-2 flex-1 text-left group"
                          >
                            <UserCheck className="h-4 w-4 text-blue-500" />
                            <span>Introduction</span>
                            <ChevronDown className={`h-3.5 w-3.5 text-stone-400 transition-transform duration-200 ${collapsedSections.has('introduction') ? '-rotate-90' : ''}`} />
                          </button>
                          {isEditing && <Edit3 onClick={() => setEditField('introduction')} className="h-3.5 w-3.5 text-blue-400 cursor-pointer hover:text-blue-600" />}
                        </h3>
                        {editField === 'introduction' && isEditing ? (
                          <InlineEditor
                            value={editData?.introduction || ''}
                            onSave={(val) => { handleEditFieldChange('introduction', val); setEditField(null); }}
                            onCancel={() => setEditField(null)}
                          />
                        ) : !collapsedSections.has('introduction') ? (
                          <div className={`prose prose-sm max-w-none text-stone-700 bg-blue-50/50 rounded-xl p-4 border border-blue-100 ${isEditing ? 'cursor-pointer hover:ring-2 hover:ring-blue-400' : ''}`}
                            onClick={() => isEditing && setEditField('introduction')}
                          >
                            <ReactMarkdown remarkPlugins={[remarkGfm]}>
                              {display.introduction}
                            </ReactMarkdown>
                          </div>
                        ) : null}
                      </div>
                    )}

                    {/* Main Content */}
                    {display.content && (
                      <div className="transition-all duration-200">
                        <h3 className="flex items-center gap-2 text-base font-semibold text-stone-800 mb-3">
                          <button
                            onClick={() => toggleSectionCollapse('content')}
                            className="flex items-center gap-2 flex-1 text-left group"
                          >
                            <BookOpen className="h-4 w-4 text-indigo-500" />
                            <span>Lesson Content</span>
                            <ChevronDown className={`h-3.5 w-3.5 text-stone-400 transition-transform duration-200 ${collapsedSections.has('content') ? '-rotate-90' : ''}`} />
                          </button>
                          {isEditing && <Edit3 onClick={() => setEditField('content')} className="h-3.5 w-3.5 ml-auto text-indigo-400 cursor-pointer hover:text-indigo-600" />}
                        </h3>
                        {editField === 'content' && isEditing ? (
                          <InlineEditor
                            value={editData?.content || ''}
                            onSave={(val) => { handleEditFieldChange('content', val); setEditField(null); }}
                            onCancel={() => setEditField(null)}
                            large
                          />
                        ) : !collapsedSections.has('content') ? (
                          <div className={`prose prose-sm max-w-none prose-headings:text-stone-800 prose-a:text-indigo-600 prose-pre:bg-stone-900 prose-pre:text-stone-100 prose-code:text-indigo-600 prose-code:bg-indigo-50 prose-code:px-1 prose-code:rounded prose-table:border-collapse prose-table:border prose-table:border-stone-200 prose-th:bg-stone-50 prose-th:px-3 prose-th:py-2 prose-td:px-3 prose-td:py-2 prose-td:border prose-td:border-stone-200 bg-white rounded-xl p-5 border border-stone-200 ${isEditing ? 'cursor-pointer hover:ring-2 hover:ring-indigo-400' : ''}`}
                            onClick={() => isEditing && setEditField('content')}
                          >
                            <ReactMarkdown remarkPlugins={[remarkGfm]}>
                              {display.content}
                            </ReactMarkdown>
                          </div>
                        ) : null}
                      </div>
                    )}

                    {/* Evaluation */}
                    {display.evaluation.length > 0 && (
                      <div className="transition-all duration-200">
                        <div className="flex items-center gap-2 text-base font-semibold text-stone-800 mb-3">
                          <button
                            onClick={() => toggleSectionCollapse('evaluation')}
                            className="flex items-center gap-2 flex-1 text-left group"
                          >
                            <CheckCircle2 className="h-4 w-4 text-amber-500" />
                            <span>Evaluation Questions</span>
                            <ChevronDown className={`h-3.5 w-3.5 text-stone-400 transition-transform duration-200 ${collapsedSections.has('evaluation') ? '-rotate-90' : ''}`} />
                          </button>
                          {isEditing && (
                            <button onClick={() => handleAddListItem('evaluation')} className="text-xs text-indigo-600 hover:text-indigo-800 font-medium">
                              + Add
                            </button>
                          )}
                        </div>
                        {isEditing ? (
                          <div className="space-y-2">
                            {(editData?.evaluation || []).map((q, i) => (
                              <div key={i} className="flex items-center gap-2">
                                <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber-100 text-[11px] font-semibold text-amber-600">{i + 1}</span>
                                <input
                                  value={q}
                                  onChange={(e) => handleUpdateListItem('evaluation', i, e.target.value)}
                                  className="flex-1 px-3 py-1.5 text-sm rounded-lg border border-stone-200 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                                />
                                <button onClick={() => handleRemoveListItem('evaluation', i)} className="text-red-400 hover:text-red-600">
                                  <X className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            ))}
                          </div>
                        ) : !collapsedSections.has('evaluation') ? (
                          <div className="bg-amber-50/50 rounded-xl p-4 border border-amber-100 space-y-2">
                            {note.evaluation.map((q, i) => (
                              <div key={i} className="flex items-start gap-2 text-sm text-stone-700">
                                <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber-100 text-[11px] font-semibold text-amber-600 mt-0.5">{i + 1}</span>
                                {q}
                              </div>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    )}

                    {/* Conclusion */}
                    {display.conclusion && (
                      <div className="transition-all duration-200">
                        <h3 className="flex items-center gap-2 text-base font-semibold text-stone-800 mb-3">
                          <button
                            onClick={() => toggleSectionCollapse('conclusion')}
                            className="flex items-center gap-2 flex-1 text-left group"
                          >
                            <CheckCircle2 className="h-4 w-4 text-purple-500" />
                            <span>Conclusion</span>
                            <ChevronDown className={`h-3.5 w-3.5 text-stone-400 transition-transform duration-200 ${collapsedSections.has('conclusion') ? '-rotate-90' : ''}`} />
                          </button>
                          {isEditing && <Edit3 onClick={() => setEditField('conclusion')} className="h-3.5 w-3.5 text-purple-400 cursor-pointer hover:text-purple-600" />}
                        </h3>
                        {editField === 'conclusion' && isEditing ? (
                          <InlineEditor
                            value={editData?.conclusion || ''}
                            onSave={(val) => { handleEditFieldChange('conclusion', val); setEditField(null); }}
                            onCancel={() => setEditField(null)}
                          />
                        ) : !collapsedSections.has('conclusion') ? (
                          <p className={`text-sm text-stone-700 bg-purple-50/50 rounded-xl p-4 border border-purple-100 ${isEditing ? 'cursor-pointer hover:ring-2 hover:ring-purple-400' : ''}`}
                            onClick={() => isEditing && setEditField('conclusion')}
                          >{display.conclusion}</p>
                        ) : null}
                      </div>
                    )}

                    {/* Assignment */}
                    {display.assignment && (
                      <div className="transition-all duration-200">
                        <h3 className="flex items-center gap-2 text-base font-semibold text-stone-800 mb-3">
                          <button
                            onClick={() => toggleSectionCollapse('assignment')}
                            className="flex items-center gap-2 flex-1 text-left group"
                          >
                            <FileText className="h-4 w-4 text-orange-500" />
                            <span>Assignment / Homework</span>
                            <ChevronDown className={`h-3.5 w-3.5 text-stone-400 transition-transform duration-200 ${collapsedSections.has('assignment') ? '-rotate-90' : ''}`} />
                          </button>
                          {isEditing && <Edit3 onClick={() => setEditField('assignment')} className="h-3.5 w-3.5 text-orange-400 cursor-pointer hover:text-orange-600" />}
                        </h3>
                        {editField === 'assignment' && isEditing ? (
                          <InlineEditor
                            value={editData?.assignment || ''}
                            onSave={(val) => { handleEditFieldChange('assignment', val); setEditField(null); }}
                            onCancel={() => setEditField(null)}
                          />
                        ) : !collapsedSections.has('assignment') ? (
                          <div className={`prose prose-sm max-w-none text-stone-700 bg-orange-50/50 rounded-xl p-4 border border-orange-100 ${isEditing ? 'cursor-pointer hover:ring-2 hover:ring-orange-400' : ''}`}
                            onClick={() => isEditing && setEditField('assignment')}
                          >
                            <ReactMarkdown remarkPlugins={[remarkGfm]}>
                              {display.assignment}
                            </ReactMarkdown>
                          </div>
                        ) : null}
                      </div>
                    )}

                    {/* Summary */}
                    {display.summary && (
                      <div className="transition-all duration-200">
                        <h3 className="flex items-center gap-2 text-base font-semibold text-stone-800 mb-3">
                          <button
                            onClick={() => toggleSectionCollapse('summary')}
                            className="flex items-center gap-2 flex-1 text-left group"
                          >
                            <NotebookPen className="h-4 w-4 text-stone-500" />
                            <span>Summary</span>
                            <ChevronDown className={`h-3.5 w-3.5 text-stone-400 transition-transform duration-200 ${collapsedSections.has('summary') ? '-rotate-90' : ''}`} />
                          </button>
                          {isEditing && <Edit3 onClick={() => setEditField('summary')} className="h-3.5 w-3.5 text-stone-400 cursor-pointer hover:text-stone-600" />}
                        </h3>
                        {editField === 'summary' && isEditing ? (
                          <InlineEditor
                            value={editData?.summary || ''}
                            onSave={(val) => { handleEditFieldChange('summary', val); setEditField(null); }}
                            onCancel={() => setEditField(null)}
                          />
                        ) : !collapsedSections.has('summary') ? (
                          <div className={`bg-stone-50 rounded-xl p-4 border border-stone-200 ${isEditing ? 'cursor-pointer hover:ring-2 hover:ring-stone-400' : ''}`}
                            onClick={() => isEditing && setEditField('summary')}
                          >
                            <p className="text-sm text-stone-600 italic">{display.summary}</p>
                          </div>
                        ) : null}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
              );
            })()}

            {!generatedNote && activeTab === 'preview' && (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <div className="h-16 w-16 rounded-2xl bg-stone-100 flex items-center justify-center mb-4">
                  <Bot className="h-7 w-7 text-stone-400" />
                </div>
                <h3 className="text-base font-semibold text-stone-700 mb-1">No lesson note yet</h3>
                <p className="text-sm text-stone-400 max-w-sm mb-6">
                  Select a subject, term, and topic above, then click "Generate Lesson Note with AI" to create one.
                </p>
              </div>
            )}
          </TabsContent>

          {/* ── Saved Notes Tab ── */}
          <TabsContent value="saved" className="mt-0 space-y-4">
            {loadingNotes ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {[1, 2, 3].map((i) => (
                  <NoteCardSkeleton key={i} />
                ))}
              </div>
            ) : savedNotes.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <div className="h-16 w-16 rounded-2xl bg-stone-100 flex items-center justify-center mb-4">
                  <FileText className="h-7 w-7 text-stone-400" />
                </div>
                <h3 className="text-base font-semibold text-stone-700 mb-1">No saved lesson notes</h3>
                <p className="text-sm text-stone-400 max-w-sm mb-6">
                  Generate a lesson note and save it — it will appear here for you to view, export, or manage.
                </p>
              </div>
            ) : (
              <>
                {/* Search, filter, sort bar */}
                <div className="bg-white rounded-xl border border-stone-200 p-3 flex flex-col sm:flex-row items-start sm:items-center gap-3">
                  <div className="relative flex-1 w-full sm:w-auto">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400 pointer-events-none" />
                    <Input
                      value={notesSearch}
                      onChange={(e) => setNotesSearch(e.target.value)}
                      placeholder="Search by title, topic, or summary..."
                      className="w-full pl-9 pr-9 text-sm"
                    />
                    {notesSearch && (
                      <button
                        onClick={() => setNotesSearch('')}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600 transition-colors"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                  <div className="flex items-center gap-2 w-full sm:w-auto">
                    <select
                      value={notesStatusFilter}
                      onChange={(e) => setNotesStatusFilter(e.target.value as any)}
                      className="px-3 py-2 text-sm rounded-lg border border-stone-200 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400 transition-shadow"
                    >
                      <option value="all">All status</option>
                      <option value="draft">Drafts</option>
                      <option value="published">Published</option>
                      <option value="archived">Archived</option>
                    </select>
                    <select
                      value={notesSortBy}
                      onChange={(e) => setNotesSortBy(e.target.value as any)}
                      className="px-3 py-2 text-sm rounded-lg border border-stone-200 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400 transition-shadow"
                    >
                      <option value="updated_at">Recent</option>
                      <option value="title">Title</option>
                      <option value="created_at">Created</option>
                    </select>
                    <Button
                      variant={isBulkMode ? 'secondary' : 'ghost'}
                      size="sm"
                      onClick={() => {
                        setIsBulkMode(!isBulkMode);
                        setSelectedNoteIds(new Set());
                      }}
                      className="h-9 text-xs gap-1.5 shrink-0"
                    >
                      {isBulkMode ? (
                        <>Cancel</>
                      ) : (
                        <><CheckCircle2 className="h-3.5 w-3.5" /> Select</>
                      )}
                    </Button>
                    {isBulkMode && selectedNoteIds.size > 0 && (
                      <Button
                        size="sm"
                        onClick={handleBulkDelete}
                        className="h-9 text-xs gap-1.5 bg-red-600 hover:bg-red-700 text-white shrink-0"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Delete ({selectedNoteIds.size})
                      </Button>
                    )}
                  </div>
                </div>

                {/* Results count */}
                {filteredNotes.length < savedNotes.length && (
                  <p className="text-xs text-stone-400 px-1">
                    Showing {filteredNotes.length} of {savedNotes.length} notes
                  </p>
                )}

                {/* Notes grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredNotes.length === 0 ? (
                    <div className="col-span-full flex flex-col items-center justify-center py-16 text-center">
                      <div className="h-12 w-12 rounded-2xl bg-stone-100 flex items-center justify-center mb-3">
                        <Search className="h-5 w-5 text-stone-400" />
                      </div>
                      <p className="text-sm font-medium text-stone-600">No notes match your search</p>
                      <p className="text-xs text-stone-400 mt-1">Try different keywords or filters</p>
                    </div>
                  ) : (
                    filteredNotes.map((note, idx) => (
                      <Card
                        key={note.id}
                        className={`group relative bg-white border transition-all duration-200 rounded-xl overflow-hidden animate-in fade-in slide-in-from-bottom-2 ${
                          isBulkMode && selectedNoteIds.has(note.id)
                            ? 'border-indigo-400 ring-2 ring-indigo-200 shadow-md'
                            : 'border-stone-200 hover:border-indigo-200 hover:shadow-md'
                        }`}
                        style={{ animationDelay: `${(idx % 6) * 60}ms`, animationFillMode: 'both' }}
                      >
                        <div className="h-1 w-full bg-gradient-to-r from-indigo-400 to-purple-400" />
                        {isBulkMode && (
                          <button
                            onClick={() => toggleNoteSelection(note.id)}
                            className={`absolute top-3 right-3 h-5 w-5 rounded border-2 flex items-center justify-center transition-all z-10 ${
                              selectedNoteIds.has(note.id)
                                ? 'bg-indigo-600 border-indigo-600 text-white'
                                : 'border-stone-300 bg-white hover:border-indigo-400'
                            }`}
                          >
                            {selectedNoteIds.has(note.id) && <Check className="h-3 w-3" />}
                          </button>
                        )}
                        <CardHeader className="pb-3 pt-4 px-5">
                          <div className="flex items-start justify-between gap-2">
                            <CardTitle className="text-sm font-semibold text-stone-800 leading-snug line-clamp-2">
                              {note.title}
                            </CardTitle>
                          </div>
                          <CardDescription className="flex items-center gap-1.5 text-xs text-stone-400 mt-1">
                            <Calendar className="h-3 w-3" />
                            {formatDate(note.updated_at)}
                          </CardDescription>
                        </CardHeader>
                        <CardContent className="px-5 pb-5 space-y-3">
                          <div className="flex items-center gap-2 flex-wrap">
                            {getStatusBadge(note.status)}
                            <Badge variant="outline" className="text-xs border-stone-200 text-stone-500">
                              {note.topic}
                            </Badge>
                          </div>

                          {note.summary && (
                            <p className="text-xs text-stone-500 line-clamp-2">{note.summary}</p>
                          )}

                          <div className="flex items-center gap-2 pt-2 border-t border-stone-100">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleViewNote(note)}
                              className="h-8 text-xs gap-1 text-stone-600 hover:text-indigo-600 hover:bg-indigo-50"
                            >
                              <Eye className="h-3.5 w-3.5" />
                              View
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleExport(note.id)}
                              disabled={exportingId === note.id}
                              className="h-8 text-xs gap-1 text-stone-600 hover:text-emerald-600 hover:bg-emerald-50"
                            >
                              {exportingId === note.id ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <FileDown className="h-3.5 w-3.5" />
                              )}
                              .docx
                            </Button>
                            {note.status === 'draft' && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleUpdateStatus(note.id, 'published')}
                                className="h-8 text-xs gap-1 text-stone-600 hover:text-emerald-600 hover:bg-emerald-50"
                              >
                                <CheckCircle2 className="h-3.5 w-3.5" />
                                Publish
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setConfirmDeleteId(note.id)}
                              className="h-8 text-xs gap-1 text-stone-600 hover:text-red-600 hover:bg-red-50 ml-auto"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))
                  )}
                </div>
              </>
            )}
          </TabsContent>

          {/* ── Topics Tab ── */}
          <TabsContent value="topics" className="mt-0">
            {loadingTopics ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="rounded-xl border border-stone-200 bg-white overflow-hidden">
                    <div className="h-1 w-full bg-stone-100" />
                    <div className="p-5 space-y-3">
                      <Skeleton className="h-5 w-2/3" />
                      <Skeleton className="h-3 w-1/4" />
                      <div className="space-y-2">
                        {[1, 2, 3].map((j) => (
                          <Skeleton key={j} className="h-7 w-full" />
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : filteredTopicGroups.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <div className="h-16 w-16 rounded-2xl bg-stone-100 flex items-center justify-center mb-4">
                  <ListTree className="h-7 w-7 text-stone-400" />
                </div>
                <h3 className="text-base font-semibold text-stone-700 mb-1">No topic groups found</h3>
                <p className="text-sm text-stone-400 max-w-sm mb-6">
                  Topic groups are created in the Question Bank. Head over to the Question Bank to create topic groups with topics.
                </p>
                <Button
                  variant="outline"
                  onClick={() => router.push('/teacher/question-bank')}
                  className="gap-2 border-stone-200 text-stone-700"
                >
                  <FileText className="h-4 w-4" />
                  Go to Question Bank
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredTopicGroups.map((group) => (
                  <Card
                    key={group.id}
                    className="bg-white border border-stone-200 hover:border-indigo-200 hover:shadow-md transition-all duration-200 rounded-xl overflow-hidden"
                  >
                    <div className="h-1 w-full bg-gradient-to-r from-indigo-400 to-purple-400" />
                    <CardHeader className="pb-2 pt-4 px-5">
                      <CardTitle className="text-sm font-semibold text-stone-800">
                        {group.title}
                      </CardTitle>
                      <CardDescription className="text-xs text-stone-400">
                        {group.topics.length} topics
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="px-5 pb-5">
                      <div className="space-y-1.5">
                        {group.topics.slice(0, 6).map((topic, i) => (
                          <button
                            key={i}
                            onClick={() => {
                              setSelectedTopic(topic);
                              setActiveTab('generate');
                              toast.success(`Selected topic: ${topic}`);
                            }}
                            className="w-full text-left flex items-start gap-2 rounded-lg px-3 py-1.5 text-xs text-stone-600 hover:bg-indigo-50 hover:text-indigo-700 transition-colors group/topic"
                          >
                            <span className="mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded bg-stone-100 text-[10px] font-medium text-stone-400 group-hover/topic:bg-indigo-100 group-hover/topic:text-indigo-600 transition-colors">
                              {i + 1}
                            </span>
                            <span className="line-clamp-1">{topic}</span>
                          </button>
                        ))}
                        {group.topics.length > 6 && (
                          <p className="text-xs text-stone-400 text-center pt-1">
                            +{group.topics.length - 6} more topics
                          </p>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* ── Planner Tab ── */}
          <TabsContent value="planner" className="mt-0">
            {loadingTopics || loadingNotes ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="h-6 w-6 text-indigo-500 animate-spin" />
              </div>
            ) : totalTopics === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <div className="h-16 w-16 rounded-2xl bg-stone-100 flex items-center justify-center mb-4">
                  <BarChart3 className="h-7 w-7 text-stone-400" />
                </div>
                <h3 className="text-base font-semibold text-stone-700 mb-1">No topics to plan</h3>
                <p className="text-sm text-stone-400 max-w-sm mb-6">
                  Create topic groups in the Question Bank first, then come here to track your lesson note coverage.
                </p>
                <Button variant="outline" onClick={() => router.push('/teacher/question-bank')} className="gap-2 border-stone-200 text-stone-700">
                  <FileText className="h-4 w-4" />
                  Go to Question Bank
                </Button>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Coverage stats card */}
                <Card className="border-stone-200 overflow-hidden transition-shadow duration-200 hover:shadow-md">
                  <CardContent className="p-6">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                      <div>
                        <h3 className="text-base font-semibold text-stone-800">
                          Term {selectedTerm} Coverage
                        </h3>
                        <p className="text-sm text-stone-500 mt-0.5">
                          {coveredTopics} of {totalTopics} topics have lesson notes
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <span className={`text-2xl font-bold tabular-nums transition-colors duration-300 ${
                            coveragePercent >= 80 ? 'text-emerald-600' :
                            coveragePercent >= 50 ? 'text-amber-600' :
                            coveragePercent >= 25 ? 'text-orange-600' : 'text-red-600'
                          }`}>
                            {coveragePercent}%
                          </span>
                          <p className="text-xs text-stone-400">complete</p>
                        </div>
                        {totalTopics - coveredTopics > 0 && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={handleBatchGenerate}
                            className="gap-1.5 border-stone-200 hover:bg-indigo-50 hover:text-indigo-700 hover:border-indigo-300 transition-all"
                          >
                            <Sparkles className="h-3.5 w-3.5" />
                            Generate All ({totalTopics - coveredTopics})
                          </Button>
                        )}
                      </div>
                    </div>

                    {/* Progress bar */}
                    <div className="mt-4 h-3 bg-stone-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-700 ease-out ${
                          coveragePercent >= 80 ? 'bg-emerald-500' :
                          coveragePercent >= 50 ? 'bg-amber-500' :
                          coveragePercent >= 25 ? 'bg-orange-500' : 'bg-red-500'
                        }`}
                        style={{ width: `${coveragePercent}%` }}
                      />
                    </div>

                    {/* Mini legend */}
                    <div className="flex items-center gap-4 mt-3 text-xs text-stone-500">
                      <span className="flex items-center gap-1.5">
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                        {coveredTopics} done
                      </span>
                      <span className="flex items-center gap-1.5">
                        <AlertCircle className="h-3.5 w-3.5 text-stone-300" />
                        {totalTopics - coveredTopics} remaining
                      </span>
                    </div>
                  </CardContent>
                </Card>

                {/* Per-group progress cards */}
                {filteredTopicGroups.length > 0 && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {filteredTopicGroups.map((group) => {
                      const groupTopics = group.topics || [];
                      const groupCovered = groupTopics.filter((t) =>
                        savedTopicSet.has(t.toLowerCase().trim())
                      ).length;
                      const groupPercent = groupTopics.length > 0
                        ? Math.round((groupCovered / groupTopics.length) * 100)
                        : 0;

                      return (
                        <div
                          key={group.id}
                          className="bg-white rounded-xl border border-stone-200 p-4 hover:border-indigo-200 hover:shadow-sm transition-all duration-200"
                        >
                          <div className="flex items-center justify-between mb-2">
                            <p className="text-sm font-medium text-stone-700 truncate">{group.title}</p>
                            <span className={`text-xs font-semibold tabular-nums ${
                              groupPercent >= 80 ? 'text-emerald-600' :
                              groupPercent >= 50 ? 'text-amber-600' : 'text-red-500'
                            }`}>
                              {groupCovered}/{groupTopics.length}
                            </span>
                          </div>
                          <div className="h-1.5 bg-stone-100 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all duration-500 ease-out ${
                                groupPercent >= 80 ? 'bg-emerald-500' :
                                groupPercent >= 50 ? 'bg-amber-500' : 'bg-red-400'
                              }`}
                              style={{ width: `${groupPercent}%` }}
                            />
                          </div>
                          <p className="text-xs text-stone-400 mt-1.5">
                            {groupCovered === 0 ? 'No notes yet' :
                             groupCovered === groupTopics.length ? 'All done!' :
                             `${groupTopics.length - groupCovered} remaining`}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Topic list */}
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wider text-stone-400 px-1">
                    Topics ({coveredTopics}/{totalTopics})
                  </p>
                  {filteredPlannedTopics.map((item, i) => (
                    <div
                      key={i}
                      className={`rounded-xl border p-4 transition-all duration-200 animate-in fade-in slide-in-from-bottom-1 ${
                        item.hasNote
                          ? 'bg-white border-emerald-200 hover:border-emerald-300 hover:shadow-sm'
                          : 'bg-white border-stone-200 hover:border-indigo-300 hover:shadow-sm'
                      }`}
                      style={{ animationDelay: `${(i % 10) * 40}ms`, animationFillMode: 'both' }}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex items-start gap-3 min-w-0">
                          {item.hasNote ? (
                            <div className="h-8 w-8 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0 transition-transform duration-200 group-hover:scale-110">
                              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                            </div>
                          ) : (
                            <div className="h-8 w-8 rounded-full bg-stone-100 flex items-center justify-center flex-shrink-0">
                              <AlertCircle className="h-4 w-4 text-stone-400" />
                            </div>
                          )}
                          <div className="min-w-0">
                            <p className={`text-sm font-medium ${item.hasNote ? 'text-emerald-800' : 'text-stone-700'}`}>
                              {item.topic}
                            </p>
                            <p className="text-xs text-stone-400 mt-0.5">
                              {item.groupTitle}
                              {item.note && (
                                <> &middot; Saved {formatDate(item.note.updated_at)}</>
                              )}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 flex-shrink-0">
                          {item.hasNote && item.note && (
                            <>
                              <Button variant="ghost" size="sm" onClick={() => handleViewNote(item.note!)} className="h-8 text-xs gap-1 text-stone-600 hover:text-indigo-600 hover:bg-indigo-50 transition-all">
                                <Eye className="h-3.5 w-3.5" />
                                View
                              </Button>
                              <Button variant="ghost" size="sm" onClick={() => handleExport(item.note!.id)} className="h-8 text-xs gap-1 text-stone-600 hover:text-emerald-600 hover:bg-emerald-50 transition-all">
                                <FileDown className="h-3.5 w-3.5" />
                                .docx
                              </Button>
                            </>
                          )}
                          {!item.hasNote && (
                            <Button
                              size="sm"
                              onClick={() => handlePlannerGenerate(item.topic)}
                              disabled={plannerGenerating === item.topic}
                              className="h-8 text-xs gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white transition-all"
                            >
                              {plannerGenerating === item.topic ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <Sparkles className="h-3.5 w-3.5" />
                              )}
                              Generate
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* ── View Lesson Note Modal ── */}
      <Dialog open={isViewModalOpen} onOpenChange={setIsViewModalOpen}>
        <DialogContent className="sm:max-w-[700px] max-h-[85vh] overflow-y-auto rounded-2xl p-0 gap-0">
          {viewNote && (
            <>
              <DialogHeader className="px-6 pt-6 pb-4 border-b border-stone-100 sticky top-0 bg-white z-10">
                <div className="flex items-center justify-between">
                  <div>
                    <DialogTitle className="text-lg font-semibold text-stone-900">
                      {viewNote.title}
                    </DialogTitle>
                    <DialogDescription className="text-sm text-stone-500 mt-0.5">
                      Topic: {viewNote.topic}
                    </DialogDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleExport(viewNote.id)}
                      disabled={exportingId === viewNote.id}
                      className="gap-1.5 border-stone-200"
                    >
                      {exportingId === viewNote.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Download className="h-3.5 w-3.5" />
                      )}
                      .docx
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setIsViewModalOpen(false)}
                      className="text-stone-400 hover:text-stone-600"
                    >
                      ✕
                    </Button>
                  </div>
                </div>
              </DialogHeader>

              <div className="px-6 py-5 space-y-5">
                {/* Content preview */}
                {viewNote.objectives?.length > 0 && (
                  <div>
                    <h4 className="text-sm font-semibold text-stone-700 mb-2">Learning Objectives</h4>
                    <ul className="space-y-1">
                      {viewNote.objectives.map((obj, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-stone-600">
                          <span className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-[10px] font-semibold text-emerald-600 mt-0.5">
                            {i + 1}
                          </span>
                          {obj}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {(viewNote.content as Record<string, unknown>)?.content ? (
                  <div>
                    <h4 className="text-sm font-semibold text-stone-700 mb-2">Content</h4>
                    <div className="prose prose-sm max-w-none text-stone-600 bg-stone-50 rounded-xl p-4 border border-stone-200 max-h-60 overflow-y-auto">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {String(((viewNote.content as Record<string, unknown>)?.content as string) || '')}
                    </ReactMarkdown>
                    </div>
                  </div>
                ) : null}

                {viewNote.summary && (
                  <div className="bg-stone-50 rounded-xl p-4 border border-stone-200">
                    <h4 className="text-sm font-semibold text-stone-700 mb-1">Summary</h4>
                    <p className="text-sm text-stone-600 italic">{viewNote.summary}</p>
                  </div>
                )}

                <div className="flex items-center justify-between pt-3 border-t border-stone-100 text-xs text-stone-400">
                  <span>Created: {formatDate(viewNote.created_at)}</span>
                  {getStatusBadge(viewNote.status)}
                </div>
              </div>

              <DialogFooter className="px-6 py-4 border-t border-stone-100 gap-2">
                <Button
                  variant="outline"
                  onClick={() => setIsViewModalOpen(false)}
                  className="border-stone-200 text-stone-600"
                >
                  Close
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Delete Confirmation ── */}
      <Dialog open={!!confirmDeleteId} onOpenChange={() => setConfirmDeleteId(null)}>
        <DialogContent className="sm:max-w-[400px] rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-stone-900">Delete Lesson Note?</DialogTitle>
            <DialogDescription className="text-stone-500">
              This action cannot be undone. The lesson note will be permanently deleted.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setConfirmDeleteId(null)}
              className="border-stone-200 text-stone-600"
            >
              Cancel
            </Button>
            <Button
              onClick={() => confirmDeleteId && handleDelete(confirmDeleteId)}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
