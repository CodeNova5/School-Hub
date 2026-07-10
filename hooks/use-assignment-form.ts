"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { Class as ClassType, Subject, SelectedQuizQuestion } from "@/lib/types";
import { getCurrentUser, getTeacherByUserId } from "@/lib/auth";
import { toast } from "sonner";

/* -------------------------------------------------------------------------- */
/* TYPES                                                                      */
/* -------------------------------------------------------------------------- */

export interface QuizConfig {
  shuffle_questions: boolean;
  time_limit_minutes: number | null;
  allow_retake: boolean;
  show_results_immediately: boolean;
}

export interface UseAssignmentFormOptions {
  schoolId: string | null;
  mode: "create" | "edit";
  assignmentId?: string;
  onSaved?: (assignmentId: string) => void;
}

export interface UseAssignmentFormReturn {
  // Loading states
  loadingAssignment: boolean;
  loadingExistingQuiz: boolean;
  isSaving: boolean;

  // Teacher & school data
  teacherId: string;
  classes: ClassType[];
  subjects: Subject[];
  subjectClassId: string | null;
  resolvingSubjectClass: boolean;

  // Form fields
  selectedClass: string;
  setSelectedClass: (v: string) => void;
  selectedSubject: string;
  setSelectedSubject: (v: string) => void;
  title: string;
  setTitle: (v: string) => void;
  description: string;
  setDescription: (v: string) => void;
  instructions: string;
  setInstructions: (v: string) => void;
  dueDate: string;
  setDueDate: (v: string) => void;
  submissionType: "text" | "file" | "both" | "objective";
  setSubmissionType: (v: "text" | "file" | "both" | "objective") => void;
  totalMarks: number;
  setTotalMarks: (v: number) => void;
  allowLate: boolean;
  setAllowLate: (v: boolean) => void;

  // File
  file: File | null;
  existingFileUrl: string | null;
  filePreview: string | null;
  removingFile: boolean;

  // Quiz
  quizQuestions: SelectedQuizQuestion[];
  setQuizQuestions: (q: SelectedQuizQuestion[]) => void;
  quizConfig: QuizConfig;
  setQuizConfig: (c: QuizConfig) => void;

  // Actions
  handleFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
  removeFile: () => void;
  removeExistingFile: () => Promise<void>;
  saveAssignment: () => Promise<void>;

  // Validation
  isStep1Complete: boolean;
  isStep2Complete: boolean;
}

/* -------------------------------------------------------------------------- */
/* DEFAULT QUIZ CONFIG                                                        */
/* -------------------------------------------------------------------------- */

const DEFAULT_QUIZ_CONFIG: QuizConfig = {
  shuffle_questions: true,
  time_limit_minutes: null,
  allow_retake: false,
  show_results_immediately: true,
};

/* -------------------------------------------------------------------------- */
/* HOOK                                                                       */
/* -------------------------------------------------------------------------- */

export function useAssignmentForm({
  schoolId,
  mode,
  assignmentId,
  onSaved,
}: UseAssignmentFormOptions): UseAssignmentFormReturn {
  const isEdit = mode === "edit";

  // Loading states
  const [loadingAssignment, setLoadingAssignment] = useState(isEdit);
  const [loadingExistingQuiz, setLoadingExistingQuiz] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Teacher & school data
  const [teacherId, setTeacherId] = useState("");
  const [classes, setClasses] = useState<ClassType[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [subjectClassId, setSubjectClassId] = useState<string | null>(null);
  const [resolvingSubjectClass, setResolvingSubjectClass] = useState(false);
  // Cache data from supabase to avoid re-fetching when subjectClassId is already resolved for edit mode
  const [editDataLoaded, setEditDataLoaded] = useState(false);

  // Form fields
  const [selectedClass, setSelectedClass] = useState("");
  const [selectedSubject, setSelectedSubject] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [instructions, setInstructions] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [submissionType, setSubmissionType] = useState<"text" | "file" | "both" | "objective">("text");
  const [totalMarks, setTotalMarks] = useState(20);
  const [allowLate, setAllowLate] = useState(false);

  // File
  const [file, setFile] = useState<File | null>(null);
  const [existingFileUrl, setExistingFileUrl] = useState<string | null>(null);
  const [removingFile, setRemovingFile] = useState(false);
  const [filePreview, setFilePreview] = useState<string | null>(null);

  // Quiz
  const [quizQuestions, setQuizQuestions] = useState<SelectedQuizQuestion[]>([]);
  const [quizConfig, setQuizConfig] = useState<QuizConfig>(DEFAULT_QUIZ_CONFIG);

  // Cleanup file preview URL on unmount
  useEffect(() => {
    return () => {
      if (filePreview) URL.revokeObjectURL(filePreview);
    };
  }, [filePreview]);

  /* ---------------------------------------------------------------------- */
  /* INITIALIZE TEACHER                                                      */
  /* ---------------------------------------------------------------------- */

  useEffect(() => {
    async function initTeacher() {
      const user = await getCurrentUser();
      if (user) {
        const teacher = await getTeacherByUserId(user.id);
        if (teacher) {
          setTeacherId(teacher.id);
        }
      }
    }
    initTeacher();
  }, []);

  /* ---------------------------------------------------------------------- */
  /* LOAD CLASSES                                                            */
  /* ---------------------------------------------------------------------- */

  useEffect(() => {
    if (!schoolId || !teacherId) return;
    loadClasses();
  }, [schoolId, teacherId]);

  const loadClasses = useCallback(async () => {
    if (!schoolId || !teacherId) {
      setClasses([]);
      return;
    }
    const { data } = await supabase
      .from("subject_classes")
      .select("class_id, classes(id, name)")
      .eq("teacher_id", teacherId)
      .eq("school_id", schoolId);
    if (!data) return;
    const uniqueClasses = new Map<string, ClassType>();
    data.forEach((item: any) => {
      if (item.classes) uniqueClasses.set(item.classes.id, item.classes);
    });
    setClasses(Array.from(uniqueClasses.values()));
  }, [schoolId, teacherId]);

  /* ---------------------------------------------------------------------- */
  /* LOAD SUBJECTS                                                           */
  /* ---------------------------------------------------------------------- */

  const loadSubjects = useCallback(
    async (classId: string) => {
      if (!classId || !schoolId || !teacherId) {
        setSubjects([]);
        return;
      }
      const { data } = await supabase
        .from("subject_classes")
        .select("subject_id, subjects!subject_classes_subject_id_fkey(id, name)")
        .eq("teacher_id", teacherId)
        .eq("class_id", classId)
        .eq("school_id", schoolId);
      if (!data) return;
      const subjectsData = data
        .map((item: any) => item.subjects)
        .filter((s: any): s is Subject => s !== null);
      setSubjects(subjectsData);
    },
    [schoolId, teacherId]
  );

  // Load subjects when class changes
  useEffect(() => {
    if (selectedClass && teacherId) {
      loadSubjects(selectedClass);
      // Don't reset selectedSubject for edit mode after initial load
      if (!isEdit || !editDataLoaded) {
        setSelectedSubject("");
      }
    }
  }, [selectedClass, teacherId]);

  /* ---------------------------------------------------------------------- */
  /* SUBJECT-CLASS RESOLUTION                                                */
  /* ---------------------------------------------------------------------- */

  useEffect(() => {
    if (!selectedClass || !selectedSubject || !schoolId) {
      setSubjectClassId(null);
      return;
    }
    async function resolveSubjectClass() {
      setResolvingSubjectClass(true);
      try {
        const { data, error } = await supabase
          .from("subject_classes")
          .select("id")
          .eq("school_id", schoolId)
          .eq("class_id", selectedClass)
          .eq("subject_id", selectedSubject)
          .maybeSingle();
        if (error) throw error;
        setSubjectClassId(data?.id || null);
      } catch {
        setSubjectClassId(null);
      } finally {
        setResolvingSubjectClass(false);
      }
    }
    resolveSubjectClass();
  }, [selectedClass, selectedSubject, schoolId]);

  /* ---------------------------------------------------------------------- */
  /* LOAD EXISTING ASSIGNMENT (edit mode only)                               */
  /* ---------------------------------------------------------------------- */

  useEffect(() => {
    if (!isEdit || !schoolId || !assignmentId || !teacherId) return;
    loadExistingAssignment();
  }, [isEdit, schoolId, assignmentId, teacherId]);

  async function loadExistingAssignment() {
    if (!schoolId || !teacherId || !assignmentId) return;
    try {
      const { data: assignment, error } = await supabase
        .from("assignments")
        .select("*")
        .eq("id", assignmentId)
        .eq("school_id", schoolId)
        .single();

      if (error) throw error;

      setSelectedClass(assignment.class_id || "");
      setSelectedSubject(assignment.subject_id || "");
      setTitle(assignment.title || "");
      setDescription(assignment.description || "");
      setInstructions(assignment.instructions || "");
      setDueDate(assignment.due_date?.split("T")[0] || "");
      setSubmissionType(assignment.submission_type || "text");
      setTotalMarks(assignment.total_marks || 20);
      setAllowLate(assignment.allow_late_submission || false);
      setExistingFileUrl(assignment.file_url || null);

      // Load subjects for the class
      if (assignment.class_id) {
        loadSubjects(assignment.class_id);
      }

      // Load quiz config if objective type
      if (assignment.submission_type === "objective") {
        await loadExistingQuizConfig();
      }

      // Mark data as loaded so we don't reset selectedSubject on class change
      setEditDataLoaded(true);
    } catch (err: any) {
      toast.error("Failed to load assignment");
    } finally {
      setLoadingAssignment(false);
    }
  }

  async function loadExistingQuizConfig() {
    if (!assignmentId) return;
    setLoadingExistingQuiz(true);
    try {
      const { data: config } = await supabase
        .from("assignment_quiz_config")
        .select("*")
        .eq("assignment_id", assignmentId)
        .maybeSingle();

      if (config) {
        setQuizConfig({
          shuffle_questions: config.shuffle_questions,
          time_limit_minutes: config.time_limit_minutes,
          allow_retake: config.allow_retake,
          show_results_immediately: config.show_results_immediately,
        });
      }

      const { data: questions } = await supabase
        .from("assignment_quiz_questions")
        .select("question_id, marks, display_order")
        .eq("assignment_id", assignmentId)
        .order("display_order", { ascending: true });

      if (questions && questions.length > 0) {
        const questionIds = questions.map((q: any) => q.question_id);
        const { data: teacherQuestions } = await supabase
          .from("teacher_questions")
          .select("id, question_text, topic, options")
          .in("id", questionIds);

        const questionDetails = new Map(
          (teacherQuestions || []).map((q: any) => [q.id, q as any])
        );

        setQuizQuestions(
          questions.map((q: any) => ({
            question_id: q.question_id,
            marks: q.marks,
            display_order: q.display_order,
            question_text:
              (questionDetails.get(q.question_id) as any)?.question_text || "",
            topic: (questionDetails.get(q.question_id) as any)?.topic || "",
            options: ((questionDetails.get(q.question_id) as any)
              ?.options as any[]) || [],
          }))
        );

        const quizTotal = (questions as any[]).reduce(
          (sum: number, q: any) => sum + q.marks,
          0
        );
        if (quizTotal > 0) setTotalMarks(quizTotal);
      }
    } catch {
      /* non-critical */
    } finally {
      setLoadingExistingQuiz(false);
    }
  }

  /* ---------------------------------------------------------------------- */
  /* FILE HANDLING                                                           */
  /* ---------------------------------------------------------------------- */

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;
    setFile(selectedFile);
    if (selectedFile.type.startsWith("image/")) {
      setFilePreview(URL.createObjectURL(selectedFile));
    } else {
      setFilePreview(null);
    }
    // Clear existing file when new one is selected
    setExistingFileUrl(null);
  }

  function removeFile() {
    if (filePreview) URL.revokeObjectURL(filePreview);
    setFile(null);
    setFilePreview(null);
  }

  async function removeExistingFile() {
    if (!assignmentId || !schoolId) return;
    setRemovingFile(true);
    try {
      const { error } = await supabase
        .from("assignments")
        .update({ file_url: null })
        .eq("id", assignmentId)
        .eq("school_id", schoolId);
      if (error) throw error;
      setExistingFileUrl(null);
      toast.success("File removed");
    } catch {
      toast.error("Failed to remove file");
    } finally {
      setRemovingFile(false);
    }
  }

  /* ---------------------------------------------------------------------- */
  /* SAVE                                                                    */
  /* ---------------------------------------------------------------------- */

  async function saveAssignment() {
    if (!selectedClass || !selectedSubject || !title || !dueDate || !schoolId) {
      toast.error("Please fill all required fields");
      return;
    }
    if (submissionType === "objective" && quizQuestions.length === 0) {
      toast.error("Please select at least one question for the quiz");
      return;
    }

    let effectiveTotalMarks = totalMarks;
    if (submissionType === "objective") {
      const quizTotal = quizQuestions.reduce((sum, q) => sum + q.marks, 0);
      effectiveTotalMarks = quizTotal > 0 ? quizTotal : totalMarks;
    }

    setIsSaving(true);
    try {
      let assignmentIdToUse: string;

      if (isEdit && assignmentId) {
        // ── UPDATE mode ──
        const { data, error: updateError } = await supabase
          .from("assignments")
          .update({
            class_id: selectedClass,
            subject_id: selectedSubject,
            title,
            description,
            instructions,
            due_date: dueDate,
            total_marks: effectiveTotalMarks,
            submission_type: submissionType,
            allow_late_submission: allowLate,
          })
          .eq("id", assignmentId)
          .eq("school_id", schoolId)
          .select("*, classes(name), subjects(name)")
          .single();

        if (updateError) throw updateError;
        assignmentIdToUse = assignmentId;
      } else {
        // ── CREATE mode ──
        const { data: currentSession } = await supabase
          .from("sessions")
          .select("id")
          .eq("is_current", true)
          .eq("school_id", schoolId)
          .maybeSingle();

        const { data: currentTerm } = await supabase
          .from("terms")
          .select("id")
          .eq("is_current", true)
          .eq("school_id", schoolId)
          .maybeSingle();

        if (!currentSession || !currentTerm) {
          toast.error("No active session or term found");
          setIsSaving(false);
          return;
        }

        const { data: assignmentData, error: insertError } = await supabase
          .from("assignments")
          .insert({
            teacher_id: teacherId,
            session_id: currentSession.id,
            term_id: currentTerm.id,
            class_id: selectedClass,
            subject_id: selectedSubject,
            title,
            description,
            instructions,
            due_date: dueDate,
            total_marks: effectiveTotalMarks,
            submission_type: submissionType,
            allow_late_submission: allowLate,
            school_id: schoolId,
          })
          .select("*, classes(name), subjects(name)")
          .single();

        if (insertError) throw insertError;
        assignmentIdToUse = assignmentData.id;
      }

      // ── Save quiz config and questions ──
      if (submissionType === "objective") {
        const { error: configError } = await supabase
          .from("assignment_quiz_config")
          .upsert(
            { assignment_id: assignmentIdToUse, school_id: schoolId, ...quizConfig },
            { onConflict: "assignment_id" }
          );
        if (configError) throw configError;

        // Delete existing questions and re-insert (handles both create and update)
        const { error: deleteError } = await supabase
          .from("assignment_quiz_questions")
          .delete()
          .eq("assignment_id", assignmentIdToUse)
          .eq("school_id", schoolId);
        if (deleteError) throw deleteError;

        if (quizQuestions.length > 0) {
          const questionRows = quizQuestions.map((q, idx) => ({
            assignment_id: assignmentIdToUse,
            school_id: schoolId,
            question_id: q.question_id,
            marks: q.marks,
            display_order: idx + 1,
          }));
          const { error: questionsError } = await supabase
            .from("assignment_quiz_questions")
            .insert(questionRows);
          if (questionsError) throw questionsError;
        }
      }

      // ── Upload file if any ──
      if (file) {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("type", "teacher_assignment_file");
        formData.append("assignment_id", assignmentIdToUse);
        const res = await fetch("/api/upload", { method: "POST", body: formData });
        if (!res.ok) {
          const errorData = await res.json();
          throw new Error(errorData.error || "File upload failed");
        }
        const { fileUrl } = await res.json();
        const { error: fileUpdateError } = await supabase
          .from("assignments")
          .update({ file_url: fileUrl })
          .eq("id", assignmentIdToUse);
        if (fileUpdateError) throw fileUpdateError;
      }

      toast.success(isEdit ? "Assignment updated successfully!" : "Assignment created successfully!");
      onSaved?.(assignmentIdToUse);
    } catch (error: any) {
      toast.error(error.message || `Failed to ${isEdit ? "update" : "create"} assignment`);
    } finally {
      setIsSaving(false);
    }
  }

  /* ---------------------------------------------------------------------- */
  /* VALIDATION                                                              */
  /* ---------------------------------------------------------------------- */

  const isStep1Complete = !!(selectedClass && selectedSubject && title && dueDate);
  const isStep2Complete = submissionType !== "objective" || quizQuestions.length > 0;

  /* ---------------------------------------------------------------------- */
  /* RETURN                                                                  */
  /* ---------------------------------------------------------------------- */

  return {
    loadingAssignment,
    loadingExistingQuiz,
    isSaving,

    teacherId,
    classes,
    subjects,
    subjectClassId,
    resolvingSubjectClass,

    selectedClass,
    setSelectedClass,
    selectedSubject,
    setSelectedSubject,
    title,
    setTitle,
    description,
    setDescription,
    instructions,
    setInstructions,
    dueDate,
    setDueDate,
    submissionType,
    setSubmissionType,
    totalMarks,
    setTotalMarks,
    allowLate,
    setAllowLate,

    file,
    existingFileUrl,
    filePreview,
    removingFile,

    quizQuestions,
    setQuizQuestions,
    quizConfig,
    setQuizConfig,

    handleFileSelect,
    removeFile,
    removeExistingFile,
    saveAssignment,

    isStep1Complete,
    isStep2Complete,
  };
}
