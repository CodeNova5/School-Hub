"use client";

import { useEffect, useState } from 'react';
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
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

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
  const [editingNote, setEditingNote] = useState<LessonNoteRecord | null>(null);

  // View state
  const [activeTab, setActiveTab] = useState('generate');
  const [viewNote, setViewNote] = useState<LessonNoteRecord | null>(null);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

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
        setGeneratedNote(payload.lessonNote as GeneratedLessonNote);
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
          </TabsList>

          {/* ── Preview Tab ── */}
          <TabsContent value="preview" className="mt-0">
            {generatedNote && (
              <div className="space-y-4">
                {/* Action bar */}
                <div className="bg-white rounded-xl border border-stone-200 p-4 flex items-center justify-between flex-wrap gap-3">
                  <div className="flex items-center gap-2 text-sm text-stone-600">
                    <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                    <span>Generated for <strong>{generatedNote.topic}</strong></span>
                    {generatedNote.duration && (
                      <>
                        <span className="text-stone-300">|</span>
                        <Clock className="h-3.5 w-3.5" />
                        <span>{generatedNote.duration}</span>
                      </>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
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
                  </div>
                </div>

                {/* Lesson Note Content Card */}
                <Card className="border-stone-200 overflow-hidden">
                  {/* Lesson header */}
                  <div className="bg-gradient-to-r from-indigo-600 to-purple-600 px-6 py-5 text-white">
                    <h2 className="text-xl font-bold">{generatedNote.title}</h2>
                    <p className="text-indigo-100 text-sm mt-1">
                      {selectedSubject?.subjects?.name} &middot; {selectedSubject?.classes?.name} &middot; {generatedNote.topic}
                    </p>
                  </div>

                  <CardContent className="p-6 space-y-6">
                    {/* Duration & Materials Row */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {generatedNote.duration && (
                        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                          <div className="flex items-center gap-2 text-amber-700 font-medium text-sm mb-1">
                            <Clock className="h-4 w-4" />
                            Duration
                          </div>
                          <p className="text-amber-900 text-sm">{generatedNote.duration}</p>
                        </div>
                      )}
                      {generatedNote.previous_knowledge && (
                        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                          <div className="flex items-center gap-2 text-blue-700 font-medium text-sm mb-1">
                            <BookMarked className="h-4 w-4" />
                            Previous Knowledge
                          </div>
                          <p className="text-blue-900 text-sm">{generatedNote.previous_knowledge}</p>
                        </div>
                      )}
                    </div>

                    {/* Instructional Materials */}
                    {generatedNote.instructional_materials?.length > 0 && (
                      <div className="bg-stone-50 rounded-xl p-4 border border-stone-200">
                        <div className="flex items-center gap-2 text-stone-700 font-medium text-sm mb-2">
                          <Lightbulb className="h-4 w-4 text-amber-500" />
                          Instructional Materials
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {generatedNote.instructional_materials.map((mat, i) => (
                            <Badge key={i} variant="secondary" className="bg-white border border-stone-200 text-stone-600">
                              {mat}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Learning Objectives */}
                    {generatedNote.objectives?.length > 0 && (
                      <div>
                        <h3 className="flex items-center gap-2 text-base font-semibold text-stone-800 mb-3">
                          <Target className="h-4 w-4 text-emerald-500" />
                          Learning Objectives
                        </h3>
                        <ul className="space-y-2">
                          {generatedNote.objectives.map((obj, i) => (
                            <li key={i} className="flex items-start gap-2 text-sm text-stone-700">
                              <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-[11px] font-semibold text-emerald-600 mt-0.5">
                                {i + 1}
                              </span>
                              {obj}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Introduction */}
                    {generatedNote.introduction && (
                      <div>
                        <h3 className="flex items-center gap-2 text-base font-semibold text-stone-800 mb-3">
                          <UserCheck className="h-4 w-4 text-blue-500" />
                          Introduction
                        </h3>
                        <div className="prose prose-sm max-w-none text-stone-700 bg-blue-50/50 rounded-xl p-4 border border-blue-100">
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>
                            {generatedNote.introduction}
                          </ReactMarkdown>
                        </div>
                      </div>
                    )}

                    {/* Main Content */}
                    {generatedNote.content && (
                      <div>
                        <h3 className="flex items-center gap-2 text-base font-semibold text-stone-800 mb-3">
                          <BookOpen className="h-4 w-4 text-indigo-500" />
                          Lesson Content
                        </h3>
                        <div className="prose prose-sm max-w-none prose-headings:text-stone-800 prose-a:text-indigo-600 prose-pre:bg-stone-900 prose-pre:text-stone-100 prose-code:text-indigo-600 prose-code:bg-indigo-50 prose-code:px-1 prose-code:rounded prose-table:border-collapse prose-table:border prose-table:border-stone-200 prose-th:bg-stone-50 prose-th:px-3 prose-th:py-2 prose-td:px-3 prose-td:py-2 prose-td:border prose-td:border-stone-200 bg-white rounded-xl p-5 border border-stone-200">
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>
                            {generatedNote.content}
                          </ReactMarkdown>
                        </div>
                      </div>
                    )}

                    {/* Evaluation */}
                    {generatedNote.evaluation?.length > 0 && (
                      <div>
                        <h3 className="flex items-center gap-2 text-base font-semibold text-stone-800 mb-3">
                          <CheckCircle2 className="h-4 w-4 text-amber-500" />
                          Evaluation Questions
                        </h3>
                        <div className="bg-amber-50/50 rounded-xl p-4 border border-amber-100 space-y-2">
                          {generatedNote.evaluation.map((q, i) => (
                            <div key={i} className="flex items-start gap-2 text-sm text-stone-700">
                              <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber-100 text-[11px] font-semibold text-amber-600 mt-0.5">
                                {i + 1}
                              </span>
                              {q}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Conclusion */}
                    {generatedNote.conclusion && (
                      <div>
                        <h3 className="flex items-center gap-2 text-base font-semibold text-stone-800 mb-3">
                          <CheckCircle2 className="h-4 w-4 text-purple-500" />
                          Conclusion
                        </h3>
                        <p className="text-sm text-stone-700 bg-purple-50/50 rounded-xl p-4 border border-purple-100">
                          {generatedNote.conclusion}
                        </p>
                      </div>
                    )}

                    {/* Assignment */}
                    {generatedNote.assignment && (
                      <div>
                        <h3 className="flex items-center gap-2 text-base font-semibold text-stone-800 mb-3">
                          <FileText className="h-4 w-4 text-orange-500" />
                          Assignment / Homework
                        </h3>
                        <div className="prose prose-sm max-w-none text-stone-700 bg-orange-50/50 rounded-xl p-4 border border-orange-100">
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>
                            {generatedNote.assignment}
                          </ReactMarkdown>
                        </div>
                      </div>
                    )}

                    {/* Summary */}
                    {generatedNote.summary && (
                      <div className="bg-stone-50 rounded-xl p-4 border border-stone-200">
                        <h3 className="text-sm font-semibold text-stone-700 mb-1">Summary</h3>
                        <p className="text-sm text-stone-600 italic">{generatedNote.summary}</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            )}

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
          <TabsContent value="saved" className="mt-0">
            {loadingNotes ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="h-6 w-6 text-indigo-500 animate-spin" />
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
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {savedNotes.map((note) => (
                  <Card
                    key={note.id}
                    className="group relative bg-white border border-stone-200 hover:border-indigo-200 hover:shadow-md transition-all duration-200 rounded-xl overflow-hidden"
                  >
                    <div className="h-1 w-full bg-gradient-to-r from-indigo-400 to-purple-400" />
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
                ))}
              </div>
            )}
          </TabsContent>

          {/* ── Topics Tab ── */}
          <TabsContent value="topics" className="mt-0">
            {loadingTopics ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="h-6 w-6 text-indigo-500 animate-spin" />
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
