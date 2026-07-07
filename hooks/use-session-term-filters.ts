"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

/* ── Types ── */

export interface SessionRecord {
  id: string;
  name: string;
  is_current: boolean;
  [key: string]: any;
}

export interface TermRecord {
  id: string;
  name: string;
  session_id: string;
  is_current: boolean;
  [key: string]: any;
}

export interface UseSessionTermFiltersReturn {
  sessions: SessionRecord[];
  terms: TermRecord[];
  selectedSession: string;
  selectedTerm: string;
  handleSessionChange: (value: string) => void;
  handleTermChange: (value: string) => void;
  filtersReady: boolean;
}

/**
 * Reactive hook that fetches sessions & terms from Supabase,
 * determines the initial selection (DB current → optional URL override),
 * syncs the URL, and provides filter-change handlers that update
 * both React state and the URL.
 */
export function useSessionTermFilters(
  schoolId: string,
): UseSessionTermFiltersReturn {
  const router = useRouter();

  const [sessions, setSessions] = useState<SessionRecord[]>([]);
  const [terms, setTerms] = useState<TermRecord[]>([]);
  const [selectedSession, setSelectedSession] = useState<string>("");
  const [selectedTerm, setSelectedTerm] = useState<string>("");
  const [filtersReady, setFiltersReady] = useState(false);

  /* ── Initial load ── */
  useEffect(() => {
    if (!schoolId) return;
    loadSessionTermData();
  }, [schoolId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function loadSessionTermData() {
    const [sessionRes, termRes] = await Promise.all([
      supabase.from("sessions").select("*").eq("school_id", schoolId).order("name"),
      supabase.from("terms").select("*").eq("school_id", schoolId).order("name"),
    ]);

    const sessionData = (sessionRes.data || []) as SessionRecord[];
    const termData = (termRes.data || []) as TermRecord[];

    setSessions(sessionData);
    setTerms(termData);

    // 1. Start with DB defaults (is_current)
    const currentSession = sessionData.find((s) => s.is_current);
    const currentTerm = termData.find((t) => t.is_current);

    let sessionId = currentSession?.id || sessionData[0]?.id || "";
    let termId = currentTerm?.id || termData[0]?.id || "";

    // 2. Override with URL params if they are non-empty and reference a valid record
    const urlParams =
      typeof window !== "undefined"
        ? new URLSearchParams(window.location.search)
        : null;
    const urlSession = urlParams?.get("session")?.trim();
    const urlTerm = urlParams?.get("term")?.trim();

    if (urlSession && sessionData.find((s) => s.id === urlSession)) {
      sessionId = urlSession;
    }
    if (urlTerm && termData.find((t) => t.id === urlTerm)) {
      termId = urlTerm;
    }

    setSelectedSession(sessionId);
    setSelectedTerm(termId);

    // 3. Sync URL to reflect final selection (for bookmarking / sharing)
    const params = new URLSearchParams();
    params.set("session", sessionId);
    params.set("term", termId);
    router.replace(`?${params.toString()}`, { scroll: false });

    setFiltersReady(true);
  }

  /* ── Filter change handlers (state + URL) ── */

  const handleSessionChange = useCallback(
    (value: string) => {
      setSelectedSession(value);
      const params = new URLSearchParams(window.location.search);
      params.set("session", value);
      router.replace(`?${params.toString()}`, { scroll: false });
    },
    [router],
  );

  const handleTermChange = useCallback(
    (value: string) => {
      setSelectedTerm(value);
      const params = new URLSearchParams(window.location.search);
      params.set("term", value);
      router.replace(`?${params.toString()}`, { scroll: false });
    },
    [router],
  );

  return {
    sessions,
    terms,
    selectedSession,
    selectedTerm,
    handleSessionChange,
    handleTermChange,
    filtersReady,
  };
}
