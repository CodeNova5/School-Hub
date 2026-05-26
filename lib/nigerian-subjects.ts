/**
 * Predefined subjects for Nigerian Educational Levels
 * Based on Nigerian National Curriculum Standards
 * 
 * NOTE: Subjects are defined WITHOUT hardcoded department/religion references.
 * They are mapped dynamically to school configuration using smart categorization.
 */

import { Department, Religion } from "./types";

export interface PredefinedSubject {
  name: string;
  isOptional?: boolean;
}

function normalizeSubjectName(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function subjectMatches(subjectName: string, candidates: string[]): boolean {
  const normalizedSubjectName = normalizeSubjectName(subjectName);
  return candidates.some(
    (candidate) => normalizeSubjectName(candidate) === normalizedSubjectName
  );
}

// Subject categories for intelligent department/category mapping
export const SUBJECT_CATEGORIES = {
  science: [
    "Physics",
    "Chemistry",
    "Biology",
    "Integrated Science",
    "Basic Science",
    "Further Mathematics",
    "Agricultural Science",
    "Health Education",
    "Foods & Nutrition",
  ],
  arts: [
    "Literature in English",
    "French Language",
    "Arabic Language",
    "Technical Drawing",
    "Visual Arts",
    "Music",
    "Home Management",
    "Catering Craft",
  ],
  commercial: ["Accounting", "Commerce", "Marketing", "Business Studies"],
  religion: ["Christian Religious Studies", "Islamic Religious Studies"],
};

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
    { name: "Chess" },
    { name: "Art & Craft" },
  ],

  primary: [
    { name: "English Studies" },
    { name: "Mathematics" },
    { name: "Yoruba" },
    { name: "Social and Citizenship Studies" },
    { name: "Basic Science" },
    { name: "Physical & Health Education" },
    { name: "Pre-vocational Studies" },
    { name: "Nigerian History" },
    { name: "Basic Digital Literacy" },
    { name: "Cultural & Creative Arts" },
    { name: "Christian Religious Studies" },
    { name: "Islamic Religious Studies" },
    { name: "French Language", isOptional: true },
    { name: "Arabic Language", isOptional: true },
  ],

  jss: [
    { name: "English Language" },
    { name: "Mathematics" },
    { name: "Yoruba" },
    { name: "Intermediate Science" },
    { name: "Physical & Health Education" },
    { name: "Digital Technologies" },
    { name: "Christian Religious Studies" },
    { name: "Islamic Religious Studies" },
    { name: "Social and Citizenship Studies" },
    { name: "Nigerian History" },
    { name: "Cultural & Creative Arts" },
    { name: "Trade subjects" },
     { name: "Business Studies" },
    { name: "French Language", isOptional: true },
    { name: "Arabic Language", isOptional: true }
  ],

  sss: [
    // Core Subjects
    { name: "English Language" },
    { name: "General Mathematics" },
    { name: "Citizenship and Heritage Studies" },
    { name: "Digital Technologies" },


    // Science Subjects
    { name: "Physics" },
    { name: "Chemistry" },
    { name: "Biology" },
    { name: "Further Mathematics" },
    { name: "Agricultural Science" },
    { name: "Health Education" },
    { name: "Foods & Nutrition" },
    { name: "Technical Drawing" },


    // Arts & Humanities
    { name: "Literature in English" },
    { name: "French Language" },
    { name: "Arabic Language" },
    { name: "Visual Arts" },
    { name: "Music" },
    { name: "Home Economics" },
    { name: "Home Management" },
    { name: "Catering Craft" },
    { name: "One Nigerian Language", isOptional: true },

    // Business Subjects
    { name: "Accounting" },
    { name: "Commerce" },
    { name: "Marketing" },

    // Religious Studies
    { name: "Christian Religious Studies" },
    { name: "Islamic Religious Studies" },
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

  if (
    lower.includes("pre-primary") ||
    lower.includes("preprimary") ||
    lower.includes("nursery") ||
    lower.includes("kindergarten") ||
    lower.includes("kg")
  ) {
    return "prePrimary";
  }

  if (
    lower.includes("primary") ||
    (lower.startsWith("form") &&
      ["1", "2", "3", "4", "5", "6"].some((n) => lower.includes(n))) ||
    lower.match(/^(form\s*[1-6]|class\s*[1-6])$/i)
  ) {
    return "primary";
  }

  if (
    lower.includes("jss") ||
    lower.includes("junior secondary") ||
    (lower.includes("form") &&
      (lower.includes("1") || lower.includes("2") || lower.includes("3"))) ||
    lower.match(/^(form\s*[1-3]|lower\s*(form|secondary))$/i)
  ) {
    return "jss";
  }

  if (
    lower.includes("sss") ||
    lower.includes("senior secondary") ||
    (lower.includes("form") &&
      (lower.includes("4") || lower.includes("5") || lower.includes("6"))) ||
    lower.match(/^(form\s*[4-6]|upper\s*(form|secondary))$/i)
  ) {
    return "sss";
  }

  return null;
}

export const NIGERIAN_SUBJECTS: Record<string, PredefinedSubject[]> = {
  "Pre-Primary": LEVEL_SUBJECTS.prePrimary as PredefinedSubject[],
  "Primary": LEVEL_SUBJECTS.primary as PredefinedSubject[],
  "JSS": LEVEL_SUBJECTS.jss as PredefinedSubject[],
  "SSS": LEVEL_SUBJECTS.sss as PredefinedSubject[],
};

/**
 * Intelligent religion detection - identifies which religion a subject belongs to
 * @param subjectName - The name of the subject
 * @returns "christian" | "islamic" | null
 */
function detectReligionType(subjectName: string): "christian" | "islamic" | null {
  const lower = subjectName.toLowerCase();
  if (lower.includes("christian") || lower.includes("crs")) {
    return "christian";
  }
  if (
    lower.includes("islamic") ||
    lower.includes("irs") ||
    lower.includes("muslim") ||
    lower.includes("islam")
  ) {
    return "islamic";
  }
  return null;
}

/**
 * Smart department mapping - matches subject to school's departments by category
 * Uses keyword matching and category-based assignment
 * @param subjectName - The name of the subject
 * @param departments - Available departments in the school
 * @returns Department ID if match found, empty string otherwise
 */
export function getSmartDepartmentId(
  subjectName: string,
  departments: Department[]
): string {
  if (departments.length === 0) return "";

  // Find category for this subject
  let subjectCategory: string | null = null;
  for (const [category, subjects] of Object.entries(SUBJECT_CATEGORIES)) {
    if (subjectMatches(subjectName, subjects)) {
      subjectCategory = category;
      break;
    }
  }

  if (!subjectCategory) return ""; // No department mapping

  // Keywords to match department names with categories
  const categoryKeywords: Record<string, string[]> = {
    science: ["science", "stem", "stem education", "pure science"],
    arts: ["arts", "humanities", "literature", "english", "language", "social arts"],
    business: ["business", "commercial", "accounting", "commerce", "marketing", "economics"],
    practical: ["technical", "vocational", "practical", "trade", "stem", "technology"],
  };

  const keywords = categoryKeywords[subjectCategory] || [];

  // Try exact category match first
  let matchedDept = departments.find((d) =>
    keywords.some((kw) => d.name.toLowerCase() === kw.toLowerCase())
  );

  // If no exact match, try partial match
  if (!matchedDept) {
    matchedDept = departments.find((d) =>
      keywords.some((kw) => d.name.toLowerCase().includes(kw.toLowerCase()))
    );
  }

  return matchedDept?.id || "";
}

/**
 * Intelligent religion mapping - matches religion subjects to school's configured religions
 * Detects Christian vs Islamic and finds matching religion in school config
 * @param subjectName - The name of the subject
 * @param religions - Available religions in the school
 * @returns Religion ID if match found, empty string otherwise
 */
export function getSmartReligionId(
  subjectName: string,
  religions: Religion[]
): string {
  // Check if this is a religion subject
  if (!isReligionSubject(subjectName)) {
    return "";
  }

  if (religions.length === 0) return "";

  // Detect which religion this subject is for
  const religionType = detectReligionType(subjectName);
  if (!religionType) return "";

  // Look for matching religion in school's configured religions
  const matchedReligion = religions.find((r) => {
    const rLower = r.name.toLowerCase();
    if (religionType === "christian") {
      return (
        rLower.includes("christian") ||
        rLower.includes("crs") ||
        rLower.includes("christ") ||
        rLower === "christianity"
      );
    } else if (religionType === "islamic") {
      return (
        rLower.includes("islamic") ||
        rLower.includes("islam") ||
        rLower.includes("irs") ||
        rLower.includes("muslim") ||
        rLower === "muslims"
      );
    }
    return false;
  });

  return matchedReligion?.id || "";
}

/**
 * Validates if a religion subject can be loaded based on school config
 * @param subjectName - The name of the subject
 * @param religions - Available religions in the school
 * @returns { canLoad: boolean, warning?: string }
 */
export function validateReligionSubject(
  subjectName: string,
  religions: Religion[]
): { canLoad: boolean; warning?: string } {
  if (!isReligionSubject(subjectName)) {
    return { canLoad: true };
  }

  if (religions.length === 0) {
    return {
      canLoad: false,
      warning: `Cannot load "${subjectName}" - no religions configured in school`,
    };
  }

  const religionType = detectReligionType(subjectName);
  if (!religionType) {
    return {
      canLoad: false,
      warning: `Cannot determine religion type for "${subjectName}"`,
    };
  }

  const hasMatchingReligion = getSmartReligionId(subjectName, religions) !== "";

  if (!hasMatchingReligion) {
    const needsReligion = religionType === "christian" ? "Christian" : "Islamic";
    return {
      canLoad: false,
      warning: `School doesn't have "${needsReligion}" configured. Configure it in School Settings or skip "${subjectName}"`,
    };
  }

  return { canLoad: true };
}

/**
 * Identifies if a subject is religion-specific
 */
export function isReligionSubject(subjectName: string): boolean {
  const lower = subjectName.toLowerCase();
  return (
    lower.includes("christian") ||
    lower.includes("islamic") ||
    lower.includes("crs") ||
    lower.includes("irs") ||
    lower.includes("religious studies")
  );
}

/**
 * Validates and filters predefined subjects based on school configuration
 * Returns loadable subjects and any warnings about skipped subjects
 * @param subjects - Predefined subjects to validate
 * @param religions - School's configured religions
 * @returns { loadable: PredefinedSubject[], warnings: string[] }
 */
export function validatePredefinedSubjectsForSchool(
  subjects: PredefinedSubject[],
  religions: Religion[]
): { loadable: PredefinedSubject[]; warnings: string[] } {
  const loadable: PredefinedSubject[] = [];
  const warnings: string[] = [];

  for (const subject of subjects) {
    const validation = validateReligionSubject(subject.name, religions);
    if (validation.canLoad) {
      loadable.push(subject);
    } else if (validation.warning) {
      warnings.push(validation.warning);
    }
  }

  return { loadable, warnings };
}


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
    return LEVEL_SUBJECTS[levelType] as PredefinedSubject[];
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
