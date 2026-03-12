import { useState, useEffect, useCallback } from "react";
import { EducationLevel, ClassLevel, Stream, Department, Religion } from "@/lib/types";

interface UseSchoolConfigOptions {
  type: "education_levels" | "class_levels" | "streams" | "departments" | "religions" | "subjects";
  educationLevelId?: string;
  enabled?: boolean;
}

interface UseSchoolConfigResult<T> {
  data: T[];
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

/**
 * Hook to fetch school configuration data
 * 
 * Usage:
 * ```
 * const { data: educationLevels, isLoading, error } = useSchoolConfig({
 *   type: "education_levels"
 * });
 * ```
 */
export function useSchoolConfig<T = any>(
  options: UseSchoolConfigOptions
): UseSchoolConfigResult<T> {
  const [data, setData] = useState<T[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { type, educationLevelId, enabled = true } = options;

  const fetchConfig = useCallback(async () => {
    if (!enabled) return;

    setIsLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        type,
        ...(educationLevelId && { education_level_id: educationLevelId }),
      });

      const response = await globalThis.fetch(`/api/school/config?${params.toString()}`);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to fetch school config");
      }

      const result = await response.json();
      setData(result.data || []);
    } catch (err: any) {
      setError(err.message || "An error occurred");
      console.error("Error fetching school config:", err);
    } finally {
      setIsLoading(false);
    }
  }, [type, educationLevelId, enabled]);

  useEffect(() => {
    fetchConfig();
  }, [fetchConfig]);

  return {
    data,
    isLoading,
    error,
    refetch: fetchConfig,
  };
}

/**
 * Utility function to fetch a specific config type
 * Use when you need to fetch config outside of a component
 */
export async function fetchSchoolConfig<T = any>(
  type: "education_levels" | "class_levels" | "streams" | "departments" | "religions" | "subjects",
  educationLevelId?: string
): Promise<{ data: T[]; error: string | null }> {
  try {
    const params = new URLSearchParams({
      type,
      ...(educationLevelId && { education_level_id: educationLevelId }),
    });

    const response = await globalThis.fetch(`/api/school/config?${params.toString()}`);

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || "Failed to fetch school config");
    }

    const result = await response.json();
    return { data: result.data || [], error: null };
  } catch (err: any) {
    console.error("Error fetching school config:", err);
    return { data: [], error: err.message };
  }
}
