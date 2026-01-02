"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";

interface Session {
  id: string;
  name: string;
  is_current: boolean;
}

interface Term {
  id: string;
  name: string;
  session_id: string;
  is_current: boolean;
}

interface Class {
  id: string;
  name: string;
}

interface AssignmentFiltersProps {
  teacherId: string;
  onChange: (filters: {
    sessionId?: string;
    termId?: string;
    classId?: string;
  }) => void;
}

export function AssignmentFilters({ teacherId, onChange }: AssignmentFiltersProps) {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [terms, setTerms] = useState<Term[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);

  const [sessionId, setSessionId] = useState<string>();
  const [termId, setTermId] = useState<string>();
  const [classId, setClassId] = useState<string>();

  /* -------------------- Load sessions -------------------- */
  useEffect(() => {
    loadSessions();
  }, []);

  async function loadSessions() {
    const { data } = await supabase
      .from("sessions")
      .select("*")
      .order("start_date", { ascending: false });

    if (!data) return;

    setSessions(data);

    const current = data.find((s) => s.is_current);
    if (current) {
      setSessionId(current.id);
      onChange({ sessionId: current.id });
    }
  }

  /* -------------------- Load terms when session changes -------------------- */
  useEffect(() => {
    if (!sessionId) return;

    loadTerms(sessionId);
    setTermId(undefined);
  }, [sessionId]);

  async function loadTerms(sessionId: string) {
    const { data } = await supabase
      .from("terms")
      .select("*")
      .eq("session_id", sessionId)
      .order("start_date");

    if (!data) return;

    setTerms(data);

    const current = data.find((t) => t.is_current);
    if (current) {
      setTermId(current.id);
      onChange({ sessionId, termId: current.id });
    }
  }

  /* -------------------- Load classes -------------------- */
  useEffect(() => {
    loadClasses();
  }, []);

  async function loadClasses() {
    const { data: tc } = await supabase
      .from("teacher_classes")
      .select("class_id")
      .eq("teacher_id", teacherId);

    if (!tc) return;

    const classIds = tc.map((c) => c.class_id);

    const { data } = await supabase
      .from("classes")
      .select("*")
      .in("id", classIds);

    setClasses(data || []);
  }

  /* -------------------- Notify parent -------------------- */
  useEffect(() => {
    onChange({ sessionId, termId, classId });
  }, [sessionId, termId, classId]);

  return (
    <div className="flex flex-wrap gap-3">
      {/* Session */}
      <Select value={sessionId} onValueChange={setSessionId}>
        <SelectTrigger className="w-[180px]">
          <SelectValue placeholder="Session" />
        </SelectTrigger>
        <SelectContent>
          {sessions.map((s) => (
            <SelectItem key={s.id} value={s.id}>
              {s.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Term */}
      <Select
        value={termId}
        onValueChange={setTermId}
        disabled={!sessionId}
      >
        <SelectTrigger className="w-[180px]">
          <SelectValue placeholder="Term" />
        </SelectTrigger>
        <SelectContent>
          {terms.map((t) => (
            <SelectItem key={t.id} value={t.id}>
              {t.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Class */}
      <Select value={classId} onValueChange={setClassId}>
        <SelectTrigger className="w-[180px]">
          <SelectValue placeholder="Class" />
        </SelectTrigger>
        <SelectContent>
          {classes.map((c) => (
            <SelectItem key={c.id} value={c.id}>
              {c.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
