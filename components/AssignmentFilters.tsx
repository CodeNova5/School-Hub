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
    classId?: string;
  }) => void;
}

export function AssignmentFilters({ teacherId, onChange }: AssignmentFiltersProps) {
  const [classes, setClasses] = useState<Class[]>([]);
  const [classId, setClassId] = useState<string>();

  /* -------------------- Load classes -------------------- */
  useEffect(() => {
    loadClasses();
  }, [teacherId]);

  async function loadClasses() {
    if (!teacherId) return;

    const { data } = await supabase
      .from("subject_classes")
      .select("class_id, classes(id, name)")
      .eq("teacher_id", teacherId);

    if (!data) return;

    // Extract unique classes
    const uniqueClasses = new Map<string, Class>();
    data.forEach((item: any) => {
      if (item.classes) {
        uniqueClasses.set(item.classes.id, item.classes);
      }
    });

    setClasses(Array.from(uniqueClasses.values()));
  }

  /* -------------------- Notify parent -------------------- */
  useEffect(() => {
    onChange({ classId });
  }, [classId]);

  return (
    <Select value={classId} onValueChange={setClassId}>
      <SelectTrigger className="w-full">
        <SelectValue placeholder="All Classes" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">All Classes</SelectItem>
        {classes.map((c) => (
          <SelectItem key={c.id} value={c.id}>
            {c.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
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
