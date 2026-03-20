import { useCallback, useEffect, useState } from "react";
import {
  ResultComponentTemplate,
  ResultGradeScale,
  ResultSchoolSettings,
} from "@/lib/types";
import { ResultSettingsPayload } from "@/lib/result-settings";

interface ResultSettingsData {
  settings: ResultSchoolSettings | null;
  components: ResultComponentTemplate[];
  gradeScales: ResultGradeScale[];
}

interface UseResultSettingsResult {
  data: ResultSettingsData;
  isLoading: boolean;
  isSaving: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  save: (payload: ResultSettingsPayload, activate?: boolean) => Promise<{ ok: boolean; error?: string }>;
}

const EMPTY_DATA: ResultSettingsData = {
  settings: null,
  components: [],
  gradeScales: [],
};

export function useResultSettings(enabled = true): UseResultSettingsResult {
  const [data, setData] = useState<ResultSettingsData>(EMPTY_DATA);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    if (!enabled) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await globalThis.fetch("/api/school/result-settings");
      const json = await response.json();

      if (!response.ok) {
        throw new Error(json?.error || "Failed to load result settings");
      }

      setData({
        settings: json?.data?.settings || null,
        components: json?.data?.components || [],
        gradeScales: json?.data?.gradeScales || [],
      });
    } catch (err: any) {
      setError(err?.message || "Failed to load result settings");
    } finally {
      setIsLoading(false);
    }
  }, [enabled]);

  const save = useCallback(
    async (payload: ResultSettingsPayload, activate = false) => {
      setIsSaving(true);
      setError(null);

      try {
        const response = await globalThis.fetch("/api/school/result-settings", {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ ...payload, activate }),
        });

        const json = await response.json();

        if (!response.ok) {
          throw new Error(json?.error || "Failed to save result settings");
        }

        await refetch();
        return { ok: true };
      } catch (err: any) {
        const message = err?.message || "Failed to save result settings";
        setError(message);
        return { ok: false, error: message };
      } finally {
        setIsSaving(false);
      }
    },
    [refetch]
  );

  useEffect(() => {
    refetch();
  }, [refetch]);

  return {
    data,
    isLoading,
    isSaving,
    error,
    refetch,
    save,
  };
}
