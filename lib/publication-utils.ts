import type { SupabaseClient } from "@supabase/supabase-js";

/* ── Term Publication Status ───────────────────────────────────────────── */

export interface ClassPublicationStatus {
  classId: string;
  className: string;
  studentCount: number;
  is_published: boolean;
  is_published_to_parents: boolean;
  published_at: string | null;
  has_results: boolean;
}

export interface TermPublicationSummary {
  totalClasses: number;
  publishedClasses: number;
  pendingClasses: number;
  totalStudents: number;
  classes: ClassPublicationStatus[];
  isFullyPublished: boolean;
}

/**
 * Fetch publication status for ALL classes that have students enrolled
 * during the given session + term combination.
 *
 * Only returns classes that have at least one student in this term.
 */
export async function getTermPublicationStatus(
  supabase: SupabaseClient,
  params: {
    schoolId: string;
    sessionId: string;
    termId: string;
  },
): Promise<TermPublicationSummary> {
  const { schoolId, sessionId, termId } = params;

  // 1. Get all classes that have students
  const { data: classes } = await supabase
    .from("classes")
    .select("id, name")
    .eq("school_id", schoolId)
    .order("name", { ascending: true });

  if (!classes || classes.length === 0) {
    return {
      totalClasses: 0,
      publishedClasses: 0,
      pendingClasses: 0,
      totalStudents: 0,
      classes: [],
      isFullyPublished: true,
    };
  }

  // 2. Get student counts per class
  const { data: studentCounts } = await supabase
    .from("students")
    .select("class_id")
    .eq("school_id", schoolId)
    .in(
      "class_id",
      classes.map((c: any) => c.id),
    );

  const classStudentCount = new Map<string, number>();
  (studentCounts || []).forEach((s: any) => {
    const current = classStudentCount.get(s.class_id) || 0;
    classStudentCount.set(s.class_id, current + 1);
  });

  // 3. Get publication records for ALL classes in this term
  const { data: publications } = await supabase
    .from("results_publication")
    .select("*")
    .eq("school_id", schoolId)
    .eq("session_id", sessionId)
    .eq("term_id", termId);

  const pubMap = new Map<string, any>();
  (publications || []).forEach((p: any) => {
    pubMap.set(p.class_id, p);
  });

  // 4. Check if any results exist for this term across all classes
  const { data: resultClasses } = await supabase
    .from("results")
    .select("subject_class:subject_classes!inner(class_id)")
    .eq("school_id", schoolId)
    .eq("session_id", sessionId)
    .eq("term_id", termId);

  const classesWithResults = new Set<string>();
  (resultClasses || []).forEach((r: any) => {
    if (r.subject_class?.class_id) {
      classesWithResults.add(r.subject_class.class_id);
    }
  });

  // 5. Build status list — only classes with students enrolled
  let publishedCount = 0;
  const classStatuses: ClassPublicationStatus[] = [];

  classes.forEach((cls: any) => {
    const studentCount = classStudentCount.get(cls.id) || 0;
    if (studentCount === 0) return; // Skip classes with no students

    const pub = pubMap.get(cls.id);
    const isPublished = pub?.is_published === true;

    classStatuses.push({
      classId: cls.id,
      className: cls.name,
      studentCount,
      is_published: isPublished,
      is_published_to_parents: pub?.is_published_to_parents === true,
      published_at: pub?.published_at || null,
      has_results: classesWithResults.has(cls.id),
    });

    if (isPublished) publishedCount++;
  });

  return {
    totalClasses: classStatuses.length,
    publishedClasses: publishedCount,
    pendingClasses: classStatuses.length - publishedCount,
    totalStudents: classStatuses.reduce((sum, c) => sum + c.studentCount, 0),
    classes: classStatuses,
    isFullyPublished: publishedCount === classStatuses.length && classStatuses.length > 0,
  };
}

/* ── Promotion Completion Status ───────────────────────────────────────── */

export interface PromotionProgress {
  classId: string;
  className: string;
  status: "pending" | "in_progress" | "completed";
  totalStudents: number;
  processedStudents: number;
}

export interface SessionPromotionSummary {
  totalClasses: number;
  completedClasses: number;
  pendingClasses: number;
  classes: PromotionProgress[];
  isFullyPromoted: boolean;
}

/**
 * Fetch promotion completion status for ALL classes for a given session.
 */
export async function getSessionPromotionStatus(
  supabase: SupabaseClient,
  params: {
    schoolId: string;
    sessionId: string;
  },
): Promise<SessionPromotionSummary> {
  const { schoolId, sessionId } = params;

  // 1. Get all classes that have students
  const { data: classes } = await supabase
    .from("classes")
    .select("id, name")
    .eq("school_id", schoolId)
    .order("name", { ascending: true });

  if (!classes || classes.length === 0) {
    return {
      totalClasses: 0,
      completedClasses: 0,
      pendingClasses: 0,
      classes: [],
      isFullyPromoted: true,
    };
  }

  // 2. Get promotion progress records
  const { data: progress } = await supabase
    .from("promotion_class_progress")
    .select("*")
    .eq("school_id", schoolId)
    .eq("session_id", sessionId);

  const progressMap = new Map<string, any>();
  (progress || []).forEach((p: any) => {
    progressMap.set(p.class_id, p);
  });

  // 3. Get student counts per class
  const { data: studentCounts } = await supabase
    .from("students")
    .select("class_id")
    .eq("school_id", schoolId)
    .in(
      "class_id",
      classes.map((c: any) => c.id),
    );

  const classStudentCount = new Map<string, number>();
  (studentCounts || []).forEach((s: any) => {
    const current = classStudentCount.get(s.class_id) || 0;
    classStudentCount.set(s.class_id, current + 1);
  });

  // 4. Build status list
  let completedCount = 0;
  const classStatuses: PromotionProgress[] = [];

  classes.forEach((cls: any) => {
    const studentCount = classStudentCount.get(cls.id) || 0;
    if (studentCount === 0) return;

    const prog = progressMap.get(cls.id);
    const status: "pending" | "in_progress" | "completed" = prog?.status || "pending";

    classStatuses.push({
      classId: cls.id,
      className: cls.name,
      status,
      totalStudents: studentCount,
      processedStudents: prog?.processed_students || 0,
    });

    if (status === "completed") completedCount++;
  });

  return {
    totalClasses: classStatuses.length,
    completedClasses: completedCount,
    pendingClasses: classStatuses.length - completedCount,
    classes: classStatuses,
    isFullyPromoted: completedCount === classStatuses.length && classStatuses.length > 0,
  };
}

/* ── Can-change helpers ─────────────────────────────────────────────────── */

export interface ChangeGateResult {
  allowed: boolean;
  reason?: string;
  details?: string[];
}

/**
 * Check whether a term can be set as the current term.
 * Blocks if any class with enrolled students has unpublished results.
 */
export async function canChangeTerm(
  supabase: SupabaseClient,
  params: {
    schoolId: string;
    sessionId: string;
    termId: string;
    termName: string;
  },
): Promise<ChangeGateResult> {
  const status = await getTermPublicationStatus(supabase, {
    schoolId: params.schoolId,
    sessionId: params.sessionId,
    termId: params.termId,
  });

  if (status.classes.length === 0) {
    return { allowed: true };
  }

  if (status.isFullyPublished) {
    return { allowed: true };
  }

  const pending = status.classes.filter((c) => !c.is_published);
  const details = pending.map(
    (c) => `${c.className} (${c.studentCount} students — results not published)`,
  );

  return {
    allowed: false,
    reason: `Cannot set "${params.termName}" as the active term. ${status.pendingClasses} class(es) still have unpublished results.`,
    details,
  };
}

/**
 * Check whether a session can be set as the current session.
 * Blocks if any class has incomplete promotions.
 */
export async function canChangeSession(
  supabase: SupabaseClient,
  params: {
    schoolId: string;
    sessionId: string;
    sessionName: string;
  },
): Promise<ChangeGateResult> {
  const status = await getSessionPromotionStatus(supabase, {
    schoolId: params.schoolId,
    sessionId: params.sessionId,
  });

  if (status.classes.length === 0) {
    return { allowed: true };
  }

  if (status.isFullyPromoted) {
    return { allowed: true };
  }

  const pending = status.classes.filter((c) => c.status !== "completed");
  const details = pending.map(
    (c) =>
      `${c.className} (${c.totalStudents} students — status: ${c.status === "in_progress" ? "in progress" : "not started"})`,
  );

  return {
    allowed: false,
    reason: `Cannot set "${params.sessionName}" as the active session. ${status.pendingClasses} class(es) still have incomplete promotions.`,
    details,
  };
}
