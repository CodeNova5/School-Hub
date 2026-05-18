export const DEFAULT_JAMB_QUESTION_COUNT = 40;
export const ENGLISH_JAMB_QUESTION_COUNT = 60;
export const DEFAULT_JAMB_DURATION_MINUTES = 40;
export const ENGLISH_JAMB_DURATION_MINUTES = 60;

export type JambExamConfig = {
  questionCount: number;
  durationMinutes: number;
  isEnglish: boolean;
};

export function getJambExamConfig(subjectSlug: string): JambExamConfig {
  // Database-driven: check against the exact English subject slug
  const isEnglish = subjectSlug === "english-language";

  return {
    questionCount: isEnglish ? ENGLISH_JAMB_QUESTION_COUNT : DEFAULT_JAMB_QUESTION_COUNT,
    durationMinutes: isEnglish ? ENGLISH_JAMB_DURATION_MINUTES : DEFAULT_JAMB_DURATION_MINUTES,
    isEnglish,
  };
}

export function shuffleArray<T>(items: T[]): T[] {
  const shuffled = [...items];

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[randomIndex]] = [shuffled[randomIndex], shuffled[index]];
  }

  return shuffled;
}