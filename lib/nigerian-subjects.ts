/**
 * Predefined subjects for Nigerian Educational Levels
 * Based on Nigerian National Curriculum Standards
 */

export interface PredefinedSubject {
  name: string;
  isOptional?: boolean;
  department?: string; // Department name if applicable
  religion?: string; // Religion-specific if applicable
}

// Core predefined subjects organized by standard Nigerian level types
const LEVEL_SUBJECTS = {
  prePrimary: [
    { name: "English Language" },
    { name: "Mathematics" },
    { name: "Creative & Cultural Development" },
    { name: "Social Studies" },
    { name: "Basic Science & Technology" },
    { name: "Physical Education" },
    { name: "Music" },
    { name: "Art & Craft" },
  ],

  primary: [
    { name: "English Language" },
    { name: "Mathematics" },
    { name: "Social Studies" },
    { name: "Basic Science" },
    { name: "Physical Education" },
    { name: "National Values Education" },
    { name: "Agricultural Science" },
    { name: "Computer Studies" },
    { name: "Music" },
    { name: "Visual Arts" },
    { name: "Religious Studies", isOptional: true, religion: "Christianity" },
    { name: "Religious Studies", isOptional: true, religion: "Islam" },
    { name: "Arabic Language", isOptional: true },
  ],

  jss: [
    { name: "English Language" },
    { name: "Mathematics" },
    { name: "Integrated Science" },
    { name: "Social Studies" },
    { name: "History" },
    { name: "Geography" },
    { name: "Civic Education" },
    { name: "Physical Education" },
    { name: "Music" },
    { name: "Visual Arts" },
    { name: "French Language", isOptional: true },
    { name: "Arabic Language", isOptional: true },
    { name: "Religious Studies", isOptional: true, religion: "Christianity" },
    { name: "Religious Studies", isOptional: true, religion: "Islam" },
    { name: "Computer Studies" },
    { name: "Agricultural Science" },
    { name: "Home Economics" },
    { name: "Business Studies" },
    { name: "Technical Drawing", isOptional: true },
  ],

  sss: [
    // Core Subjects
    { name: "English Language" },
    { name: "Mathematics" },
    { name: "Physical Education" },
    { name: "Civic Education" },

    // Science Subjects
    { name: "Physics", department: "Science" },
    { name: "Chemistry", department: "Science" },
    { name: "Biology", department: "Science" },
    { name: "Further Mathematics", isOptional: true, department: "Science" },

    // Social Sciences
    { name: "History", department: "Social Sciences" },
    { name: "Geography", department: "Social Sciences" },
    { name: "Economics", department: "Social Sciences" },
    { name: "Government", department: "Social Sciences" },

    // Arts & Humanities
    { name: "Literature in English", department: "Arts" },
    { name: "French Language", isOptional: true, department: "Arts" },
    { name: "Arabic Language", isOptional: true, department: "Arts" },
    { name: "Technical Drawing", isOptional: true, department: "Arts" },

    // Electives & Optional
    { name: "Computer Studies", isOptional: true },
    { name: "Agricultural Science", isOptional: true },
    { name: "Home Economics", isOptional: true },
    { name: "Music", isOptional: true },
    { name: "Visual Arts", isOptional: true },
    { name: "Business Studies", isOptional: true },

    // Religious Studies
    { name: "Religious Studies", isOptional: true, religion: "Christianity" },
    { name: "Religious Studies", isOptional: true, religion: "Islam" },
  ],
};

/**
 * Infer the education level type from the level name
 * Handles various naming conventions used in Nigerian schools
 */
function inferLevelType(
  levelName: string
): "prePrimary" | "primary" | "jss" | "sss" | null {
  const lower = levelName.toLowerCase().trim();

  // Pre-Primary detection
  if (
    lower.includes("pre-primary") ||
    lower.includes("preprimary") ||
    lower.includes("nursery") ||
    lower.includes("kindergarten") ||
    lower.includes("kg")
  ) {
    return "prePrimary";
  }

  // Primary detection
  if (
    lower.includes("primary") ||
    (lower.startsWith("form") &&
      ["1", "2", "3", "4", "5", "6"].some((n) => lower.includes(n))) ||
    lower.match(/^(form\s*[1-6]|class\s*[1-6])$/i)
  ) {
    // Check if it's Form 1-6 (which are primary)
    const primaryForms = lower.match(/form\s*([1-6])|class\s*([1-6])/i);
    if (primaryForms) {
      return "primary";
    }
    return "primary";
  }

  // JSS detection (Junior Secondary School / Form 1-3 in some regions)
  if (
    lower.includes("jss") ||
    lower.includes("junior secondary") ||
    lower.includes("form") && (lower.includes("1") || lower.includes("2") || lower.includes("3")) ||
    lower.match(/^(form\s*[1-3]|lower\s*(form|secondary))$/i)
  ) {
    return "jss";
  }

  // SSS detection (Senior Secondary School / Form 4-6 in some regions)
  if (
    lower.includes("sss") ||
    lower.includes("senior secondary") ||
    lower.includes("form") && (lower.includes("4") || lower.includes("5") || lower.includes("6")) ||
    lower.match(/^(form\s*[4-6]|upper\s*(form|secondary))$/i)
  ) {
    return "sss";
  }

  return null;
}

export const NIGERIAN_SUBJECTS: Record<string, PredefinedSubject[]> = {
  "Pre-Primary": LEVEL_SUBJECTS.prePrimary,
  "Primary": LEVEL_SUBJECTS.primary,
  "JSS": LEVEL_SUBJECTS.jss,
  "SSS": LEVEL_SUBJECTS.sss,
};

/**
 * Get subjects for a specific education level
 * Intelligently matches the level name to predefined subjects
 */
export function getSubjectsForLevel(levelName: string): PredefinedSubject[] {
  // First try exact match
  if (NIGERIAN_SUBJECTS[levelName]) {
    return NIGERIAN_SUBJECTS[levelName];
  }

  // Then try to infer the level type
  const levelType = inferLevelType(levelName);
  if (levelType) {
    return LEVEL_SUBJECTS[levelType];
  }

  return [];
}

/**
 * Get all available education levels with subject counts
 */
export function getLevelsWithSubjectCounts(): Array<{
  name: string;
  count: number;
}> {
  return Object.entries(NIGERIAN_SUBJECTS).map(([name, subjects]) => ({
    name,
    count: subjects.length,
  }));
}
