"use client";

import { useEffect, useMemo, useState } from "react";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Loader2, Radio, Video } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { getCurrentUser, getTeacherByUserId } from "@/lib/auth";
import { useSchoolContext } from "@/hooks/use-school-context";

type SubjectOption = {
  subjectClassId: string;
  classId: string;
  className: string;
  subjectName: string;
  teacherName: string;
};

type ClassOption = {
  classId: string;
  className: string;
};

type TimetableSlot = {
  day_of_week: string;
  start_time: string;
  end_time: string;
};

type LiveSession = {
  id: string;
  title: string;
  class_id: string;
  subject_class_id: string | null;
  status: "scheduled" | "live" | "ended" | "cancelled";
  scheduled_for: string | null;
  scheduled_end_at: string | null;
  started_at: string | null;
  ended_at: string | null;
  created_at: string;
};

const DAY_INDEX: Record<string, number> = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
};

function toDateInputValue(date: Date) {
  const copy = new Date(date);
  copy.setMinutes(copy.getMinutes() - copy.getTimezoneOffset());
  return copy.toISOString().slice(0, 16);
}

function parseTimeToHoursAndMinutes(timeValue: string) {
  const [h = "0", m = "0"] = timeValue.split(":");
  return {
    hour: Number(h),
    minute: Number(m),
  };
}

function nextDateForWeekday(dayName: string, timeValue: string) {
  const now = new Date();
  const dayKey = dayName.toLowerCase();
  const targetDay = DAY_INDEX[dayKey];

  if (targetDay === undefined) {
    return null;
  }

  const { hour, minute } = parseTimeToHoursAndMinutes(timeValue);
  const candidate = new Date(now);
  const daysAhead = (targetDay - now.getDay() + 7) % 7;
  candidate.setDate(now.getDate() + daysAhead);
  candidate.setHours(hour, minute, 0, 0);

  if (candidate.getTime() < now.getTime()) {
    candidate.setDate(candidate.getDate() + 7);
  }

  return candidate;
}

export default function TeacherLiveClassesPage() {
  const { schoolId, isLoading: schoolLoading } = useSchoolContext();
  const [loading, setLoading] = useState(true);
  const [subjectOptions, setSubjectOptions] = useState<SubjectOption[]>([]);
  const [classOptions, setClassOptions] = useState<ClassOption[]>([]);
  const [subjectTimetableSlots, setSubjectTimetableSlots] = useState<Record<string, TimetableSlot[]>>({});
  const [liveSessions, setLiveSessions] = useState<LiveSession[]>([]);
  const [useTimetableSubject, setUseTimetableSubject] = useState(true);
  const [selectedSubjectClassId, setSelectedSubjectClassId] = useState("");
  const [selectedClassId, setSelectedClassId] = useState("");
  const [title, setTitle] = useState("Live Class");
  const [zoomUrl, setZoomUrl] = useState("");
  const [scheduledStart, setScheduledStart] = useState("");
  const [scheduledEnd, setScheduledEnd] = useState("");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!schoolLoading && schoolId) {
      loadData();
    }
  }, [schoolId, schoolLoading]);

  async function loadData() {
    if (!schoolId) return;

    try {
      setLoading(true);

      const user = await getCurrentUser();
      if (!user) {
        toast.error("Please log in to continue");
        return;
      }

      const teacher = await getTeacherByUserId(user.id);
      if (!teacher) {
        toast.error("Teacher profile not found");
        return;
      }

      const { data: subjectAssigned } = await supabase
        .from("subject_classes")
        .select(`
          id,
          class_id,
          classes(id, name),
          subjects!subject_classes_subject_id_fkey(name),
          teachers(first_name, last_name)
        `)
        .eq("school_id", schoolId)
        .eq("teacher_id", teacher.id);

      const { data: classTeacherRows } = await supabase
        .from("classes")
        .select("id")
        .eq("school_id", schoolId)
        .eq("class_teacher_id", teacher.id);

      const classIds = (classTeacherRows ?? []).map((row: any) => row.id);

      let fallbackSubjectRows: any[] = [];
      if (classIds.length > 0) {
        const { data } = await supabase
          .from("subject_classes")
          .select(`
            id,
            class_id,
            classes(id, name),
            subjects!subject_classes_subject_id_fkey(name),
            teachers(first_name, last_name)
          `)
          .eq("school_id", schoolId)
          .in("class_id", classIds);
        fallbackSubjectRows = data ?? [];
      }

      const merged = [...(subjectAssigned ?? []), ...fallbackSubjectRows];
      const uniqueBySubjectClass = new Map<string, any>();
      merged.forEach((item: any) => {
        uniqueBySubjectClass.set(item.id, item);
      });

      const subjectClassIds = Array.from(uniqueBySubjectClass.keys());

      const { data: timetableRows } = subjectClassIds.length > 0
        ? await supabase
            .from("timetable_entries")
            .select("subject_class_id, period_slots(day_of_week, start_time, end_time)")
            .eq("school_id", schoolId)
            .in("subject_class_id", subjectClassIds)
        : { data: [] as any[] };

      const timetableSubjectIds = new Set((timetableRows ?? []).map((row: any) => row.subject_class_id));

      const slotMap: Record<string, TimetableSlot[]> = {};
      (timetableRows ?? []).forEach((row: any) => {
        const slot = Array.isArray(row.period_slots) ? row.period_slots[0] : row.period_slots;
        if (!row.subject_class_id || !slot) return;

        if (!slotMap[row.subject_class_id]) {
          slotMap[row.subject_class_id] = [];
        }

        slotMap[row.subject_class_id].push({
          day_of_week: slot.day_of_week,
          start_time: slot.start_time,
          end_time: slot.end_time,
        });
      });

      setSubjectTimetableSlots(slotMap);

      const options: SubjectOption[] = [];
      uniqueBySubjectClass.forEach((item: any) => {
        if (!timetableSubjectIds.has(item.id)) return;

        const classObj = Array.isArray(item.classes) ? item.classes[0] : item.classes;
        const subjectObj = Array.isArray(item.subjects) ? item.subjects[0] : item.subjects;
        const teacherObj = Array.isArray(item.teachers) ? item.teachers[0] : item.teachers;

        options.push({
          subjectClassId: item.id,
          classId: classObj?.id,
          className: classObj?.name || "Unknown Class",
          subjectName: subjectObj?.name || "Unknown Subject",
          teacherName: teacherObj ? `${teacherObj.first_name} ${teacherObj.last_name}` : "Unassigned",
        });
      });

      setSubjectOptions(options);
      if (!selectedSubjectClassId && options.length > 0) {
        setSelectedSubjectClassId(options[0].subjectClassId);
      }

      const classMap = new Map<string, ClassOption>();
      options.forEach((option) => {
        classMap.set(option.classId, { classId: option.classId, className: option.className });
      });

      if (classIds.length > 0) {
        const { data: classRows } = await supabase
          .from("classes")
          .select("id, name")
          .eq("school_id", schoolId)
          .in("id", classIds);

        (classRows ?? []).forEach((row: any) => {
          classMap.set(row.id, { classId: row.id, className: row.name });
        });
      }

      const classes = Array.from(classMap.values());
      setClassOptions(classes);
      if (!selectedClassId && classes.length > 0) {
        setSelectedClassId(classes[0].classId);
      }

      await loadLiveSessions();
    } catch (error: any) {
      toast.error(error.message || "Failed to load live classes data");
    } finally {
      setLoading(false);
    }
  }

  async function loadLiveSessions() {
    const response = await fetch("/api/teacher/live-sessions");
    const payload = await response.json();

    if (!response.ok) {
      throw new Error(payload.error || "Failed to load live sessions");
    }

    setLiveSessions(payload.data ?? []);
  }

  useEffect(() => {
    if (!isCreateOpen) {
      return;
    }

    if (useTimetableSubject && selectedSubjectClassId) {
      const slots = subjectTimetableSlots[selectedSubjectClassId] || [];
      let bestWindowStart: Date | null = null;
      let bestWindowEnd: Date | null = null;

      for (const slot of slots) {
        const start = nextDateForWeekday(slot.day_of_week, slot.start_time);
        const end = nextDateForWeekday(slot.day_of_week, slot.end_time);
        if (!start || !end) continue;

        if (!bestWindowStart || start.getTime() < bestWindowStart.getTime()) {
          bestWindowStart = start;
          bestWindowEnd = end;
        }
      }

      if (bestWindowStart && bestWindowEnd) {
        setScheduledStart(toDateInputValue(bestWindowStart));
        setScheduledEnd(toDateInputValue(bestWindowEnd));
      } else {
        const now = new Date();
        const end = new Date(now.getTime() + 40 * 60 * 1000);
        setScheduledStart(toDateInputValue(now));
        setScheduledEnd(toDateInputValue(end));
      }

      const selectedSubject = subjectOptions.find((item) => item.subjectClassId === selectedSubjectClassId);
      if (selectedSubject?.classId) {
        setSelectedClassId(selectedSubject.classId);
      }
      return;
    }

    const now = new Date();
    const end = new Date(now.getTime() + 40 * 60 * 1000);
    setScheduledStart(toDateInputValue(now));
    setScheduledEnd(toDateInputValue(end));
  }, [isCreateOpen, useTimetableSubject, selectedSubjectClassId, subjectTimetableSlots, subjectOptions]);

  async function createLiveSession() {
    if (!zoomUrl.trim()) {
      toast.error("Provide a Zoom link");
      return;
    }

    if (useTimetableSubject && !selectedSubjectClassId) {
      toast.error("Select a timetable subject");
      return;
    }

    if (!useTimetableSubject && !selectedClassId) {
      toast.error("Select a class");
      return;
    }

    if (!scheduledStart || !scheduledEnd) {
      toast.error("Set both start and end time");
      return;
    }

    const startDate = new Date(scheduledStart);
    const endDate = new Date(scheduledEnd);
    if (endDate.getTime() <= startDate.getTime()) {
      toast.error("End time must be after start time");
      return;
    }

    try {
      setSubmitting(true);

      const response = await fetch("/api/teacher/live-sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subjectClassId: useTimetableSubject ? selectedSubjectClassId : null,
          classId: useTimetableSubject ? null : selectedClassId,
          title,
          zoomUrl,
          scheduledFor: startDate.toISOString(),
          scheduledEndAt: endDate.toISOString(),
        }),
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || "Failed to create live class");
      }

      toast.success("Live class created");
      setIsCreateOpen(false);
      setZoomUrl("");
      setScheduledStart("");
      setScheduledEnd("");
      setTitle("Live Class");
      await loadLiveSessions();
    } catch (error: any) {
      toast.error(error.message || "Failed to create live class");
    } finally {
      setSubmitting(false);
    }
  }

  async function updateSession(sessionId: string, action: "start" | "end" | "cancel") {
    try {
      const response = await fetch(`/api/teacher/live-sessions/${sessionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || "Failed to update session");
      }

      toast.success("Session updated");
      await loadLiveSessions();
    } catch (error: any) {
      toast.error(error.message || "Failed to update session");
    }
  }

  const subjectLookup = useMemo(() => {
    const map = new Map<string, SubjectOption>();
    subjectOptions.forEach((option) => {
      map.set(option.subjectClassId, option);
    });
    return map;
  }, [subjectOptions]);

  function statusBadge(status: LiveSession["status"]) {
    if (status === "live") return <Badge className="bg-red-100 text-red-700 hover:bg-red-100">Live</Badge>;
    if (status === "scheduled") return <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100">Scheduled</Badge>;
    if (status === "ended") return <Badge className="bg-gray-100 text-gray-700 hover:bg-gray-100">Ended</Badge>;
    return <Badge className="bg-orange-100 text-orange-700 hover:bg-orange-100">Cancelled</Badge>;
  }

  if (schoolLoading || loading) {
    return (
      <DashboardLayout role="teacher">
        <div className="flex min-h-[50vh] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout role="teacher">
      <div className="space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Live Classes</h1>
            <p className="text-sm text-gray-600">Create and manage live classes per timetable subject.</p>
          </div>
          <Button className="gap-2" onClick={() => setIsCreateOpen(true)}>
            <Video className="h-4 w-4" />
            Create Live Class
          </Button>
        </div>

        <Card className="border-red-100 bg-red-50/40">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Radio className="h-5 w-5 text-red-600" />
              Active and Scheduled Sessions
            </CardTitle>
          </CardHeader>
          <CardContent>
            {liveSessions.length === 0 ? (
              <p className="text-sm text-gray-600">No sessions yet for your timetable subjects.</p>
            ) : (
              <div className="space-y-3">
                {liveSessions.map((session) => {
                  const subjectInfo = session.subject_class_id ? subjectLookup.get(session.subject_class_id) : null;
                  return (
                    <div key={session.id} className="rounded-lg border bg-white p-3">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <p className="font-semibold text-gray-900">{session.title}</p>
                          <p className="text-xs text-gray-600">
                            {subjectInfo ? `${subjectInfo.className} • ${subjectInfo.subjectName}` : "Class-level session"}
                          </p>
                          <p className="text-xs text-gray-500">
                            {session.scheduled_for
                              ? `Window: ${new Date(session.scheduled_for).toLocaleString()} - ${session.scheduled_end_at ? new Date(session.scheduled_end_at).toLocaleString() : "Open"}`
                              : `Created: ${new Date(session.created_at).toLocaleString()}`}
                          </p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          {statusBadge(session.status)}
                          {session.status === "scheduled" && (
                            <Button size="sm" variant="outline" onClick={() => updateSession(session.id, "start")}>Start</Button>
                          )}
                          {session.status === "live" && (
                            <Button size="sm" variant="outline" onClick={() => updateSession(session.id, "end")}>End</Button>
                          )}
                          {(session.status === "scheduled" || session.status === "live") && (
                            <Button size="sm" variant="ghost" onClick={() => updateSession(session.id, "cancel")}>Cancel</Button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Live Class</DialogTitle>
              <DialogDescription>
                Follow timetable windows when available, or create an unexpected custom class when needed.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="flex items-center justify-between rounded-md border p-3">
                <div>
                  <p className="text-sm font-medium text-gray-900">Use timetable subject</p>
                  <p className="text-xs text-gray-600">Turn off for weekend/holiday/free-period custom classes.</p>
                </div>
                <Switch
                  checked={useTimetableSubject}
                  onCheckedChange={setUseTimetableSubject}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="subjectClass">{useTimetableSubject ? "Timetable Subject" : "Class"}</Label>
                {useTimetableSubject ? (
                  <select
                    id="subjectClass"
                    className="w-full rounded-md border px-3 py-2 text-sm"
                    value={selectedSubjectClassId}
                    onChange={(event) => setSelectedSubjectClassId(event.target.value)}
                  >
                    {subjectOptions.length === 0 && <option value="">No timetable subjects available</option>}
                    {subjectOptions.map((option) => (
                      <option key={option.subjectClassId} value={option.subjectClassId}>
                        {option.className} - {option.subjectName}
                      </option>
                    ))}
                  </select>
                ) : (
                  <select
                    id="classId"
                    className="w-full rounded-md border px-3 py-2 text-sm"
                    value={selectedClassId}
                    onChange={(event) => setSelectedClassId(event.target.value)}
                  >
                    {classOptions.length === 0 && <option value="">No classes available</option>}
                    {classOptions.map((option) => (
                      <option key={option.classId} value={option.classId}>
                        {option.className}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="liveTitle">Title</Label>
                <Input id="liveTitle" value={title} onChange={(event) => setTitle(event.target.value)} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="liveZoomUrl">Zoom URL</Label>
                <Input
                  id="liveZoomUrl"
                  value={zoomUrl}
                  onChange={(event) => setZoomUrl(event.target.value)}
                  placeholder="https://zoom.us/j/1234567890?pwd=..."
                />
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="scheduledStart">Start time</Label>
                  <Input
                    id="scheduledStart"
                    type="datetime-local"
                    value={scheduledStart}
                    onChange={(event) => setScheduledStart(event.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="scheduledEnd">End time</Label>
                  <Input
                    id="scheduledEnd"
                    type="datetime-local"
                    value={scheduledEnd}
                    onChange={(event) => setScheduledEnd(event.target.value)}
                  />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsCreateOpen(false)} disabled={submitting}>Cancel</Button>
              <Button onClick={createLiveSession} disabled={submitting || (useTimetableSubject ? subjectOptions.length === 0 : classOptions.length === 0)}>
                {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Create
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
