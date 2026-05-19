export type JambExamMode = "study" | "practice" | "exam";

export type JambExamSetup = {
  subjectSlug: string;
  subjectName: string;
  examYear: string;
  mode: JambExamMode;
  examSubjects: string[];
};

export type JambAttemptResult = {
  correctCount: number;
  totalQuestions: number;
  score: number;
  answeredCount?: number;
  unansweredCount?: number;
  missedCount?: number;
  unansweredQuestions?: number[];
  missedQuestions?: Array<{
    questionId: string;
    questionNumber: number;
    questionText: string;
    userAnswer: string;
    correctOption: string;
    explanation?: string;
  }>;
  previousAttempt?: { score: number; correctCount: number; totalQuestions: number } | null;
  attempt?: Record<string, any> | null;
};

export type CachedJambResult = JambAttemptResult & {
  attemptId?: string;
  subjectSlug?: string;
  subjectName?: string;
  examYear?: number;
  mode?: JambExamMode;
};

export const JAMB_EXAM_SETUP_KEY = "jamb_exam_setup_v1";
export const JAMB_EXAM_RESULT_KEY = "jamb_exam_result_v1";

export function saveJambExamSetup(setup: JambExamSetup) {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(JAMB_EXAM_SETUP_KEY, JSON.stringify(setup));
}

export function loadJambExamSetup(): JambExamSetup | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(JAMB_EXAM_SETUP_KEY);
    return raw ? (JSON.parse(raw) as JambExamSetup) : null;
  } catch {
    return null;
  }
}

export function clearJambExamSetup() {
  if (typeof window === "undefined") return;
  window.sessionStorage.removeItem(JAMB_EXAM_SETUP_KEY);
}

export function saveJambExamResult(result: CachedJambResult) {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(JAMB_EXAM_RESULT_KEY, JSON.stringify(result));
}

export function loadJambExamResult(): CachedJambResult | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(JAMB_EXAM_RESULT_KEY);
    return raw ? (JSON.parse(raw) as CachedJambResult) : null;
  } catch {
    return null;
  }
}

export function clearJambExamResult() {
  if (typeof window === "undefined") return;
  window.sessionStorage.removeItem(JAMB_EXAM_RESULT_KEY);
}