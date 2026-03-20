import {
  ResultComponentTemplate,
  ResultGradeScale,
  ResultSchoolSettings,
} from "@/lib/types";

export interface ResultSettingsPayload {
  pass_percentage: number;
  components: Array<{
    component_key: string;
    component_name: string;
    max_score: number;
    display_order?: number;
    is_active?: boolean;
  }>;
  grade_scales: Array<{
    grade_label: string;
    min_percentage: number;
    remark?: string;
    display_order?: number;
  }>;
}

export interface NormalizedResultSettingsPayload {
  passPercentage: number;
  components: ResultComponentTemplate[];
  gradeScales: ResultGradeScale[];
}

export interface ResultSettingsValidation {
  ok: boolean;
  error?: string;
  normalized?: NormalizedResultSettingsPayload;
}

export interface ResultSettingsBundle {
  settings: ResultSchoolSettings | null;
  components: ResultComponentTemplate[];
  gradeScales: ResultGradeScale[];
}

export function normalizeComponentKey(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 50);
}

export function validateResultSettingsPayload(payload: any): ResultSettingsValidation {
  const passPercentage = Number(payload?.pass_percentage);
  if (!Number.isFinite(passPercentage) || passPercentage < 0 || passPercentage > 100) {
    return { ok: false, error: "Pass percentage must be between 0 and 100" };
  }

  const componentsInput = Array.isArray(payload?.components) ? payload.components : [];
  if (componentsInput.length === 0) {
    return { ok: false, error: "At least one result component is required" };
  }

  const normalizedComponents = componentsInput.map((row: any, index: number) => {
    const keyFromPayload = typeof row?.component_key === "string" ? row.component_key : "";
    const name = typeof row?.component_name === "string" ? row.component_name.trim() : "";
    const componentKey = normalizeComponentKey(keyFromPayload || name);

    return {
      id: row?.id || "",
      school_id: row?.school_id || "",
      component_key: componentKey,
      component_name: name,
      max_score: Number(row?.max_score),
      display_order: Number.isFinite(Number(row?.display_order))
        ? Number(row.display_order)
        : index + 1,
      is_active: row?.is_active !== false,
      created_at: row?.created_at || "",
      updated_at: row?.updated_at || "",
    } as ResultComponentTemplate;
  });

  for (const component of normalizedComponents) {
    if (!component.component_name) {
      return { ok: false, error: "Each component must have a name" };
    }
    if (!component.component_key) {
      return { ok: false, error: "Each component must have a valid key" };
    }
    if (!Number.isFinite(component.max_score) || component.max_score <= 0) {
      return { ok: false, error: `Invalid max score for component ${component.component_name}` };
    }
  }

  const componentKeys = normalizedComponents.map((c: ResultComponentTemplate) => c.component_key);
  if (new Set(componentKeys).size !== componentKeys.length) {
    return { ok: false, error: "Component keys must be unique" };
  }

  const activeTotal = normalizedComponents
    .filter((c: ResultComponentTemplate) => c.is_active)
    .reduce((sum: number, c: ResultComponentTemplate) => sum + c.max_score, 0);

  if (activeTotal <= 0) {
    return { ok: false, error: "Active components must have a total score greater than zero" };
  }

  const gradeInput = Array.isArray(payload?.grade_scales) ? payload.grade_scales : [];
  if (gradeInput.length === 0) {
    return { ok: false, error: "At least one grade scale row is required" };
  }

  const normalizedGradeScales = gradeInput.map((row: any, index: number) => ({
    id: row?.id || "",
    school_id: row?.school_id || "",
    grade_label: typeof row?.grade_label === "string" ? row.grade_label.trim().toUpperCase() : "",
    min_percentage: Number(row?.min_percentage),
    remark: typeof row?.remark === "string" ? row.remark.trim() : "",
    display_order: Number.isFinite(Number(row?.display_order)) ? Number(row.display_order) : index + 1,
    created_at: row?.created_at || "",
    updated_at: row?.updated_at || "",
  })) as ResultGradeScale[];

  for (const grade of normalizedGradeScales) {
    if (!grade.grade_label) {
      return { ok: false, error: "Each grade row must include a label" };
    }
    if (!Number.isFinite(grade.min_percentage) || grade.min_percentage < 0 || grade.min_percentage > 100) {
      return { ok: false, error: `Invalid minimum percentage for grade ${grade.grade_label}` };
    }
  }

  const labels = normalizedGradeScales.map((g) => g.grade_label);
  if (new Set(labels).size !== labels.length) {
    return { ok: false, error: "Grade labels must be unique" };
  }

  const hasZeroFloor = normalizedGradeScales.some((g) => g.min_percentage === 0);
  if (!hasZeroFloor) {
    return { ok: false, error: "Grade scale must include a floor row with 0%" };
  }

  return {
    ok: true,
    normalized: {
      passPercentage,
      components: normalizedComponents,
      gradeScales: normalizedGradeScales,
    },
  };
}
