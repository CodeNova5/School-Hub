"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent } from "@/components/ui/card";
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
import {
  Loader2, Pencil, Radio, Video, Zap, CalendarClock, History,
  ChevronDown, ChevronRight, CalendarDays, List, ChevronLeft,
} from "lucide-react";
import { createSupabaseClient, supabase } from "@/lib/supabase";
import { getCurrentUser, getTeacherByUserId } from "@/lib/auth";
import { useSchoolContext } from "@/hooks/use-school-context";

type SubjectOption = {
  subjectClassId: string;
  classId: string;
  className: string;
  subjectName: string;
  teacherName: string;
  inTimetable: boolean;
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
  const [pastExpanded, setPastExpanded] = useState(false);
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list');
  const [calendarDate, setCalendarDate] = useState(new Date());
  const [selectedCalendarDay, setSelectedCalendarDay] = useState<string | null>(null);
  const [useTimetableSubject, setUseTimetableSubject] = useState(true);
  const [selectedSubjectClassId, setSelectedSubjectClassId] = useState("");
  const [selectedClassId, setSelectedClassId] = useState("");
  const [title, setTitle] = useState("Live Class");
  const [zoomUrl, setZoomUrl] = useState("");
  const [scheduledStart, setScheduledStart] = useState("");
  const [scheduledEnd, setScheduledEnd] = useState("");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [wizardStep, setWizardStep] = useState(1);
  const [selectedSlot, setSelectedSlot] = useState<TimetableSlot | null>(null);

  const timetableSubjectOptions = useMemo(
    () => subjectOptions.filter((item) => item.inTimetable),
    [subjectOptions]
  );

  const classFilteredSubjectOptions = useMemo(
    () => subjectOptions.filter((item) => item.classId === selectedClassId),
    [subjectOptions, selectedClassId]
  );

  function setSubjectAndDefaultTitle(subjectClassId: string) {
    setSelectedSubjectClassId(subjectClassId);
    const option = subjectOptions.find((item) => item.subjectClassId === subjectClassId);
    if (option) {
      setTitle(`${option.subjectName} Class`);
    }
  }

  // Set up realtime subscription for live session changes
  useEffect(() => {
    if (schoolLoading || !schoolId) return;

    const client = createSupabaseClient();
    let channel: any;
    let unsubscribed = false;

    async function setup() {
      try {
        // Get teacher's school_id from the school context
        if (client) {
          channel = client
            .channel("teacher-live-sessions")
            .on(
              "postgres_changes",
              {
                event: "*",
                schema: "public",
                table: "live_sessions",
                filter: `school_id=eq.${schoolId}`,
              },
              () => {
                loadLiveSessionsRef.current?.().catch(() => {});
              }
            )
            .subscribe();
        }
      } catch {
        // Realtime unavailable — fall back to manual refresh
      } finally {
        if (!unsubscribed) await loadData();
      }
    }

    setup();

    return () => {
      unsubscribed = true;
      if (channel) {
        client?.removeChannel(channel);
      }
    };
  }, [schoolId, schoolLoading]);

  useEffect(() => {
    if (isCreateOpen) {
      setWizardStep(1);
      setSelectedSlot(null);
    }
  }, [isCreateOpen]);

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

      const merged = [...(subjectAssigned ?? [])];
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
        const classObj = Array.isArray(item.classes) ? item.classes[0] : item.classes;
        const subjectObj = Array.isArray(item.subjects) ? item.subjects[0] : item.subjects;
        const teacherObj = Array.isArray(item.teachers) ? item.teachers[0] : item.teachers;

        options.push({
          subjectClassId: item.id,
          classId: classObj?.id,
          className: classObj?.name || "Unknown Class",
          subjectName: subjectObj?.name || "Unknown Subject",
          teacherName: teacherObj ? `${teacherObj.first_name} ${teacherObj.last_name}` : "Unassigned",
          inTimetable: timetableSubjectIds.has(item.id),
        });
      });

      setSubjectOptions(options);
      if (!selectedSubjectClassId && options.length > 0) {
        setSubjectAndDefaultTitle(options[0].subjectClassId);
      }

      const classMap = new Map<string, ClassOption>();
      options.forEach((option) => {
        classMap.set(option.classId, { classId: option.classId, className: option.className });
      });

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

  const loadLiveSessionsRef = useRef<() => Promise<void> | null>(null);

  loadLiveSessionsRef.current = useCallback(async () => {
    const response = await fetch("/api/teacher/live-sessions");
    const payload = await response.json();

    if (!response.ok) {
      throw new Error(payload.error || "Failed to load live sessions");
    }

    setLiveSessions(payload.data ?? []);
  }, []);

  async function loadLiveSessions() {
    await loadLiveSessionsRef.current?.();
  }

  async function createLiveSession() {
    if (!zoomUrl.trim()) {
      toast.error("Provide a Zoom link");
      return;
    }

    if (!selectedSubjectClassId) {
      toast.error("Select a subject");
      return;
    }

    let startDate: Date;
    let endDate: Date;

    if (useTimetableSubject && selectedSlot) {
      // Calculate dates from timetable slot
      const startWindow = nextDateForWeekday(selectedSlot.day_of_week, selectedSlot.start_time);
      const endWindow = nextDateForWeekday(selectedSlot.day_of_week, selectedSlot.end_time);
      
      if (!startWindow || !endWindow) {
        toast.error("Failed to calculate session time from timetable");
        return;
      }

      startDate = startWindow;
      endDate = endWindow;
    } else {
      // Use manually entered times
      if (!scheduledStart || !scheduledEnd) {
        toast.error("Set both start and end time");
        return;
      }

      startDate = new Date(scheduledStart);
      endDate = new Date(scheduledEnd);

      if (endDate.getTime() <= startDate.getTime()) {
        toast.error("End time must be after start time");
        return;
      }
    }

    try {
      setSubmitting(true);

      const response = await fetch("/api/teacher/live-sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subjectClassId: selectedSubjectClassId,
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
      setSelectedSlot(null);
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

  // ── Edit session state ──
  const [editingSession, setEditingSession] = useState<LiveSession | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editZoomUrl, setEditZoomUrl] = useState("");
  const [editScheduledStart, setEditScheduledStart] = useState("");
  const [editScheduledEnd, setEditScheduledEnd] = useState("");
  const [isEditing, setIsEditing] = useState(false);

  function openEditDialog(session: LiveSession) {
    setEditingSession(session);
    setEditTitle(session.title);
    setEditZoomUrl(""); // Don't pre-fill for security (encrypted password)
    if (session.scheduled_for) {
      setEditScheduledStart(toDateInputValue(new Date(session.scheduled_for)));
    } else {
      setEditScheduledStart("");
    }
    if (session.scheduled_end_at) {
      setEditScheduledEnd(toDateInputValue(new Date(session.scheduled_end_at)));
    } else {
      setEditScheduledEnd("");
    }
    setIsEditing(true);
  }

  async function saveEditSession() {
    if (!editingSession) return;

    if (!editTitle.trim()) {
      toast.error("Title is required");
      return;
    }

    if (editScheduledStart && editScheduledEnd) {
      const start = new Date(editScheduledStart);
      const end = new Date(editScheduledEnd);
      if (end.getTime() <= start.getTime()) {
        toast.error("End time must be after start time");
        return;
      }
    }

    try {
      setIsEditing(false);

      const payload: Record<string, any> = {
        action: "update",
        title: editTitle.trim(),
      };

      if (editZoomUrl.trim()) {
        payload.zoomUrl = editZoomUrl.trim();
      }

      if (editScheduledStart) {
        payload.scheduledFor = new Date(editScheduledStart).toISOString();
      }

      if (editScheduledEnd) {
        payload.scheduledEndAt = new Date(editScheduledEnd).toISOString();
      }

      const response = await fetch(`/api/teacher/live-sessions/${editingSession.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to update session");
      }

      toast.success("Session updated");
      setEditingSession(null);
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

  const { liveSessionsList, upcomingSessions, pastSessions } = useMemo(() => {
    const live: LiveSession[] = [];
    const upcoming: LiveSession[] = [];
    const past: LiveSession[] = [];

    for (const session of liveSessions) {
      if (session.status === "live") {
        live.push(session);
      } else if (session.status === "scheduled") {
        upcoming.push(session);
      } else {
        past.push(session);
      }
    }

    upcoming.sort(
      (a, b) =>
        new Date(a.scheduled_for || a.created_at).getTime() -
        new Date(b.scheduled_for || b.created_at).getTime()
    );
    past.sort(
      (a, b) =>
        new Date(b.started_at || b.created_at).getTime() -
        new Date(a.started_at || a.created_at).getTime()
    );

    return { liveSessionsList: live, upcomingSessions: upcoming, pastSessions: past };
  }, [liveSessions]);

  const totalCount = liveSessions.length;

  // ── Calendar grid computation ──
  const calendarGrid = useMemo(() => {
    const year = calendarDate.getFullYear();
    const month = calendarDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startDayOfWeek = firstDay.getDay(); // 0=Sun
    const daysInMonth = lastDay.getDate();

    const grid: (number | null)[][] = [];
    let week: (number | null)[] = [];

    // Fill leading empty cells
    for (let i = 0; i < startDayOfWeek; i++) {
      week.push(null);
    }

    for (let day = 1; day <= daysInMonth; day++) {
      week.push(day);
      if (week.length === 7) {
        grid.push(week);
        week = [];
      }
    }

    // Fill trailing empty cells
    if (week.length > 0) {
      while (week.length < 7) week.push(null);
      grid.push(week);
    }

    return grid;
  }, [calendarDate]);

  // Group sessions by date key (YYYY-MM-DD) for calendar lookup
  const sessionsByDate = useMemo(() => {
    const map = new Map<string, LiveSession[]>();
    for (const session of liveSessions) {
      const dateKey = session.scheduled_for
        ? new Date(session.scheduled_for).toISOString().slice(0, 10)
        : null;
      if (!dateKey) continue;
      if (!map.has(dateKey)) map.set(dateKey, []);
      map.get(dateKey)!.push(session);
    }
    return map;
  }, [liveSessions]);

  const monthLabel = new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(calendarDate);

  function getSessionsForDay(day: number): LiveSession[] {
    const dateKey = new Date(calendarDate.getFullYear(), calendarDate.getMonth(), day)
      .toISOString().slice(0, 10);
    return sessionsByDate.get(dateKey) || [];
  }

  const selectedDaySessions = selectedCalendarDay ? (sessionsByDate.get(selectedCalendarDay) || []) : [];

  function goToPrevMonth() {
    setCalendarDate(new Date(calendarDate.getFullYear(), calendarDate.getMonth() - 1, 1));
    setSelectedCalendarDay(null);
  }

  function goToNextMonth() {
    setCalendarDate(new Date(calendarDate.getFullYear(), calendarDate.getMonth() + 1, 1));
    setSelectedCalendarDay(null);
  }

  function goToToday() {
    setCalendarDate(new Date());
    const todayKey = new Date().toISOString().slice(0, 10);
    setSelectedCalendarDay(todayKey);
  }

  const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  function formatRelativeTime(dateStr: string): string {
    const now = Date.now();
    const date = new Date(dateStr).getTime();
    const diffMs = date - now;
    if (diffMs < 0) {
      const past = Math.abs(diffMs);
      const mins = Math.floor(past / 60000);
      if (mins < 60) return `${mins}m ago`;
      const hours = Math.floor(mins / 60);
      return `${hours}h ago`;
    }
    const mins = Math.floor(diffMs / 60000);
    if (mins < 60) return `in ${mins}m`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `in ${hours}h`;
    const days = Math.floor(hours / 24);
    return `in ${days}d`;
  }

  function renderSessionActions(session: LiveSession) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        {statusBadge(session.status)}
        <Button size="sm" variant="outline" onClick={() => openEditDialog(session)} title="Edit session details">
          <Pencil className="w-3.5 h-3.5" />
        </Button>
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
    );
  }

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
          <div className="flex items-center gap-2">
            <div className="flex items-center border border-slate-200 rounded-lg overflow-hidden mr-2">
              <button
                onClick={() => setViewMode('list')}
                className={`p-2 transition-colors ${viewMode === 'list' ? 'bg-blue-600 text-white' : 'bg-white text-slate-500 hover:bg-slate-50'}`}
                title="List view"
              >
                <List className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode('calendar')}
                className={`p-2 transition-colors ${viewMode === 'calendar' ? 'bg-blue-600 text-white' : 'bg-white text-slate-500 hover:bg-slate-50'}`}
                title="Calendar view"
              >
                <CalendarDays className="w-4 h-4" />
              </button>
            </div>
            <Button className="gap-2" onClick={() => setIsCreateOpen(true)}>
              <Video className="h-4 w-4" />
              Create Live Class
            </Button>
          </div>
        </div>

        <div className="flex items-center gap-2 text-sm text-gray-500 mb-4">
          <Radio className="w-4 h-4" />
          {totalCount > 0
            ? `${liveSessionsList.length} live · ${upcomingSessions.length} upcoming · ${pastSessions.length} past`
            : "No sessions yet. Create one using the button above."}
        </div>

        {/* ═══ CALENDAR VIEW ═══ */}
        {viewMode === 'calendar' && (
          <section>
            {/* Month navigation */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={goToPrevMonth} className="p-2">
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <h2 className="text-lg font-bold text-slate-800 min-w-[180px] text-center">{monthLabel}</h2>
                <Button variant="outline" size="sm" onClick={goToNextMonth} className="p-2">
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
              <Button variant="outline" size="sm" onClick={goToToday}>
                <CalendarDays className="w-4 h-4 mr-1.5" />
                Today
              </Button>
            </div>

            {/* Calendar grid */}
            <Card className="border-slate-200 overflow-hidden">
              <CardContent className="p-0">
                <div className="grid grid-cols-7 border-b border-slate-200">
                  {WEEKDAYS.map((d) => (
                    <div key={d} className="text-center text-xs font-semibold text-slate-500 py-2 bg-slate-50 border-r border-slate-200 last:border-r-0">
                      {d}
                    </div>
                  ))}
                </div>
                <div className="divide-y divide-slate-100">
                  {calendarGrid.map((week, wi) => (
                    <div key={wi} className="grid grid-cols-7">
                      {week.map((day, di) => {
                        if (day === null) {
                          return <div key={`e-${di}`} className="min-h-[90px] bg-slate-50/50" />;
                        }

                        const daySessions = getSessionsForDay(day);
                        const dateObj = new Date(calendarDate.getFullYear(), calendarDate.getMonth(), day);
                        const dateKey = dateObj.toISOString().slice(0, 10);
                        const isToday = dateKey === new Date().toISOString().slice(0, 10);
                        const isSelected = selectedCalendarDay === dateKey;
                        const liveCount = daySessions.filter(s => s.status === 'live').length;
                        const scheduledCount = daySessions.filter(s => s.status === 'scheduled').length;
                        const endedCount = daySessions.filter(s => s.status !== 'live' && s.status !== 'scheduled').length;

                        return (
                          <button
                            key={day}
                            onClick={() => setSelectedCalendarDay(selectedCalendarDay === dateKey ? null : dateKey)}
                            className={`
                              min-h-[90px] p-1.5 border-r border-b border-slate-100 text-left transition-colors
                              hover:bg-blue-50/50 relative
                              ${isSelected ? 'bg-blue-50 ring-1 ring-inset ring-blue-400' : ''}
                              ${isToday && !isSelected ? 'bg-amber-50/50' : ''}
                            `}
                          >
                            <span
                              className={`
                                inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-semibold
                                ${isToday ? 'bg-blue-600 text-white' : 'text-slate-700'}
                              `}
                            >
                              {day}
                            </span>

                            {daySessions.length > 0 && (
                              <div className="mt-1 space-y-0.5">
                                {liveCount > 0 && (
                                  <div className="flex items-center gap-1">
                                    <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse shrink-0" />
                                    <span className="text-[10px] font-medium text-red-600 truncate">{liveCount} live</span>
                                  </div>
                                )}
                                {scheduledCount > 0 && (
                                  <div className="flex items-center gap-1">
                                    <div className="w-1.5 h-1.5 rounded-full bg-blue-400 shrink-0" />
                                    <span className="text-[10px] font-medium text-blue-600 truncate">{scheduledCount}</span>
                                  </div>
                                )}
                                {endedCount > 0 && (
                                  <div className="flex items-center gap-1">
                                    <div className="w-1.5 h-1.5 rounded-full bg-slate-300 shrink-0" />
                                    <span className="text-[10px] text-slate-400 truncate">{endedCount}</span>
                                  </div>
                                )}
                              </div>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Selected day sessions */}
            {selectedDaySessions.length > 0 && (
              <div className="mt-6">
                <h3 className="text-sm font-bold text-slate-700 mb-3">
                  Sessions for {new Date(selectedCalendarDay! + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                </h3>
                <div className="space-y-2">
                  {selectedDaySessions.map((session) => {
                    const subjectInfo = session.subject_class_id ? subjectLookup.get(session.subject_class_id) : null;
                    return (
                      <div key={session.id} className="rounded-lg border border-slate-200 bg-white p-3">
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap mb-0.5">
                              {statusBadge(session.status)}
                              <span className="text-xs text-slate-500">
                                {session.scheduled_for
                                  ? new Date(session.scheduled_for).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                                  : ''}
                              </span>
                            </div>
                            <p className="font-semibold text-gray-900 text-sm">{session.title}</p>
                            <p className="text-xs text-gray-600">
                              {subjectInfo ? `${subjectInfo.className} • ${subjectInfo.subjectName}` : "Class-level session"}
                            </p>
                          </div>
                          {renderSessionActions(session)}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </section>
        )}

        {/* ═══ LIST VIEW ═══ */}
        {viewMode === 'list' && (
          <>
        {/* ═══ LIVE NOW ═══ */}
        {liveSessionsList.length > 0 && (
          <section>
            <div className="flex items-center gap-3 mb-4">
              <div className="relative">
                <div className="w-3 h-3 rounded-full bg-red-500" />
                <div className="absolute inset-0 w-3 h-3 rounded-full bg-red-500 animate-ping opacity-75" />
              </div>
              <h2 className="text-lg font-bold text-red-700 flex items-center gap-2">
                <Zap className="w-5 h-5" />
                Live Now
              </h2>
              <Badge className="bg-red-100 text-red-700 border-red-200">
                {liveSessionsList.length} session{liveSessionsList.length !== 1 ? "s" : ""}
              </Badge>
            </div>

            <div className="space-y-3">
              {liveSessionsList.map((session) => {
                const subjectInfo = session.subject_class_id ? subjectLookup.get(session.subject_class_id) : null;
                return (
                  <div
                    key={session.id}
                    className="rounded-xl border-2 border-red-300 bg-red-50 shadow-md shadow-red-100/50 p-4 transition-all hover:shadow-lg hover:border-red-400"
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <Badge className="bg-red-500 text-white border-red-500 animate-pulse text-[10px]">
                            <Radio className="w-3 h-3 mr-1" />
                            LIVE
                          </Badge>
                          <span className="text-xs text-red-600 font-medium">
                            Started {session.started_at ? formatRelativeTime(session.started_at) : "just now"}
                          </span>
                        </div>
                        <p className="font-bold text-gray-900 text-lg truncate">{session.title}</p>
                        <p className="text-sm text-gray-600">
                          {subjectInfo ? `${subjectInfo.className} • ${subjectInfo.subjectName}` : "Class-level session"}
                        </p>
                        {session.scheduled_end_at && (
                          <p className="text-xs text-red-500 mt-0.5">Ends {formatRelativeTime(session.scheduled_end_at)}</p>
                        )}
                      </div>
                      {renderSessionActions(session)}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* ═══ UPCOMING ═══ */}
        {upcomingSessions.length > 0 && (
          <section>
            <div className="flex items-center gap-3 mb-4">
              <CalendarClock className="w-5 h-5 text-blue-600" />
              <h2 className="text-lg font-bold text-blue-700">Upcoming</h2>
              <Badge className="bg-blue-100 text-blue-700 border-blue-200">
                {upcomingSessions.length} session{upcomingSessions.length !== 1 ? "s" : ""}
              </Badge>
            </div>

            <div className="space-y-3">
              {upcomingSessions.map((session) => {
                const subjectInfo = session.subject_class_id ? subjectLookup.get(session.subject_class_id) : null;
                return (
                  <div
                    key={session.id}
                    className="rounded-xl border border-blue-200 bg-white hover:bg-blue-50/40 hover:border-blue-300 transition-all p-4 shadow-sm"
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <Badge className="bg-blue-100 text-blue-700 border-blue-200 text-[10px]">
                            <CalendarClock className="w-3 h-3 mr-1" />
                            Scheduled
                          </Badge>
                          {session.scheduled_for && (
                            <span className="text-xs font-semibold text-blue-600">
                              {formatRelativeTime(session.scheduled_for)}
                            </span>
                          )}
                        </div>
                        <p className="font-semibold text-gray-900">{session.title}</p>
                        <p className="text-xs text-gray-600">
                          {subjectInfo ? `${subjectInfo.className} • ${subjectInfo.subjectName}` : "Class-level session"}
                        </p>
                        <p className="text-xs text-gray-500 mt-0.5">
                          {session.scheduled_for
                            ? `Window: ${new Date(session.scheduled_for).toLocaleString()} - ${session.scheduled_end_at ? new Date(session.scheduled_end_at).toLocaleString() : "Open"}`
                            : `Created: ${new Date(session.created_at).toLocaleString()}`}
                        </p>
                      </div>
                      {renderSessionActions(session)}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

          </>
        )}

        {/* ═══ EMPTY STATE ═══ */}
        {liveSessionsList.length === 0 && upcomingSessions.length === 0 && pastSessions.length === 0 && (
          <Card className="border-slate-200">
            <CardContent className="py-16 text-center">
              <Radio className="w-12 h-12 text-slate-200 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-slate-700 mb-1">No Live Classes Yet</h3>
              <p className="text-sm text-slate-500 max-w-sm mx-auto">
                Create your first live class using the button above. Sessions will appear here grouped by status.
              </p>
            </CardContent>
          </Card>
        )}

        {/* ═══ PAST ═══ */}
        {pastSessions.length > 0 && (
          <section>
            <button
              onClick={() => setPastExpanded(!pastExpanded)}
              className="flex items-center gap-3 w-full text-left group"
            >
              <History className="w-5 h-5 text-slate-500" />
              <h2 className="text-lg font-bold text-slate-600 group-hover:text-slate-800 transition-colors">
                Past Sessions
              </h2>
              <Badge variant="outline" className="text-xs text-slate-500 border-slate-300">
                {pastSessions.length}
              </Badge>
              <div className="ml-auto">
                {pastExpanded ? (
                  <ChevronDown className="w-4 h-4 text-slate-400" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-slate-400" />
                )}
              </div>
            </button>

            {pastExpanded && (
              <div className="mt-4 space-y-2">
                {pastSessions.map((session) => {
                  const subjectInfo = session.subject_class_id ? subjectLookup.get(session.subject_class_id) : null;
                  const isCancelled = session.status === "cancelled";
                  return (
                    <div
                      key={session.id}
                      className="rounded-lg border border-slate-200 bg-white p-3 opacity-70 hover:opacity-100 transition-opacity"
                    >
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-0.5">
                            <Badge
                              variant="outline"
                              className={`text-[10px] ${
                                isCancelled
                                  ? "bg-orange-50 text-orange-600 border-orange-200"
                                  : "bg-slate-100 text-slate-600 border-slate-200"
                              }`}
                            >
                              {isCancelled ? "Cancelled" : "Ended"}
                            </Badge>
                            {session.ended_at && (
                              <span className="text-xs text-slate-400">
                                Ended {formatRelativeTime(session.ended_at)}
                              </span>
                            )}
                          </div>
                          <p className="font-medium text-slate-800 text-sm truncate">{session.title}</p>
                          <p className="text-xs text-slate-500">
                            {subjectInfo ? `${subjectInfo.className} • ${subjectInfo.subjectName}` : "Class-level session"}
                          </p>
                          {session.scheduled_for && (
                            <p className="text-xs text-slate-400 mt-0.5">
                              {new Date(session.scheduled_for).toLocaleString()}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        )}

        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Create Live Class</DialogTitle>
              <DialogDescription>
                {wizardStep === 1 && "Step 1 of 3: Select subject"}
                {wizardStep === 2 && (useTimetableSubject ? "Step 2 of 3: Choose a time slot" : "Step 2 of 3: Set class and time")}
                {wizardStep === 3 && "Step 3 of 3: Add session details"}
              </DialogDescription>
            </DialogHeader>

            {/* STEP 1: Subject Selection */}
            {wizardStep === 1 && (
              <div className="space-y-4">
                <div className="flex items-center justify-between rounded-md border p-3">
                  <div>
                    <p className="text-sm font-medium text-gray-900">Use timetable subject</p>
                    <p className="text-xs text-gray-600">Turn off for custom classes (weekends, holidays, free periods).</p>
                  </div>
                  <Switch
                    checked={useTimetableSubject}
                    onCheckedChange={setUseTimetableSubject}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="step1-subject">
                    {useTimetableSubject ? "Timetable Subject" : "Class"}
                  </Label>
                  {useTimetableSubject ? (
                    <select
                      id="step1-subject"
                      className="w-full rounded-md border px-3 py-2 text-sm"
                      value={selectedSubjectClassId}
                      onChange={(event) => setSubjectAndDefaultTitle(event.target.value)}
                    >
                      {timetableSubjectOptions.length === 0 && (
                        <option value="">No timetable subjects available</option>
                      )}
                      {timetableSubjectOptions.map((option) => (
                        <option key={option.subjectClassId} value={option.subjectClassId}>
                          {option.className} - {option.subjectName}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <select
                      id="step1-subject"
                      className="w-full rounded-md border px-3 py-2 text-sm"
                      value={selectedClassId}
                      onChange={(event) => {
                        const nextClassId = event.target.value;
                        setSelectedClassId(nextClassId);
                        const firstSubject = subjectOptions.find((item) => item.classId === nextClassId);
                        if (firstSubject) {
                          setSubjectAndDefaultTitle(firstSubject.subjectClassId);
                        } else {
                          setSelectedSubjectClassId("");
                        }
                      }}
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

                {!useTimetableSubject && (
                  <div className="space-y-2">
                    <Label htmlFor="step1-customSubject">Subject (from selected class)</Label>
                    <select
                      id="step1-customSubject"
                      className="w-full rounded-md border px-3 py-2 text-sm"
                      value={selectedSubjectClassId}
                      onChange={(event) => setSubjectAndDefaultTitle(event.target.value)}
                    >
                      {classFilteredSubjectOptions.length === 0 && (
                        <option value="">No taught subjects in this class</option>
                      )}
                      {classFilteredSubjectOptions.map((option) => (
                        <option key={option.subjectClassId} value={option.subjectClassId}>
                          {option.subjectName}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            )}

            {/* STEP 2: Slot Selection (Timetable Mode) or Time Selection (Custom Mode) */}
            {wizardStep === 2 && useTimetableSubject && (
              <div className="space-y-4">
                <div>
                  <p className="text-sm font-medium text-gray-900 mb-3">Available time slots for this subject</p>
                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    {(subjectTimetableSlots[selectedSubjectClassId] || []).length === 0 ? (
                      <p className="text-sm text-gray-600 py-8 text-center">No timetable slots found for this subject.</p>
                    ) : (
                      (subjectTimetableSlots[selectedSubjectClassId] || []).map((slot, idx) => {
                        const isSelected =
                          selectedSlot &&
                          selectedSlot.day_of_week === slot.day_of_week &&
                          selectedSlot.start_time === slot.start_time;

                        return (
                          <button
                            key={idx}
                            onClick={() => setSelectedSlot(slot)}
                            className={`w-full text-left p-3 rounded-lg border-2 transition ${
                              isSelected
                                ? "border-blue-500 bg-blue-50"
                                : "border-gray-200 bg-white hover:border-blue-300"
                            }`}
                          >
                            <p className="font-medium text-gray-900">
                              {slot.day_of_week.charAt(0).toUpperCase() + slot.day_of_week.slice(1)}
                            </p>
                            <p className="text-sm text-gray-600">
                              {slot.start_time} - {slot.end_time}
                            </p>
                          </button>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* STEP 2: Manual Time Selection (Custom Mode) */}
            {wizardStep === 2 && !useTimetableSubject && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="step2-start">Start time</Label>
                    <Input
                      id="step2-start"
                      type="datetime-local"
                      value={scheduledStart}
                      onChange={(event) => setScheduledStart(event.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="step2-end">End time</Label>
                    <Input
                      id="step2-end"
                      type="datetime-local"
                      value={scheduledEnd}
                      onChange={(event) => setScheduledEnd(event.target.value)}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* STEP 3: Session Details */}
            {wizardStep === 3 && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="step3-title">Title</Label>
                  <Input 
                    id="step3-title" 
                    value={title} 
                    onChange={(event) => setTitle(event.target.value)} 
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="step3-zoom">Zoom URL</Label>
                  <Input
                    id="step3-zoom"
                    value={zoomUrl}
                    onChange={(event) => setZoomUrl(event.target.value)}
                    placeholder="https://zoom.us/j/1234567890?pwd=..."
                  />
                </div>

                {useTimetableSubject && selectedSlot && (
                  <div className="rounded-md bg-blue-50 p-3 border border-blue-200">
                    <p className="text-xs font-medium text-blue-900">Scheduled for:</p>
                    <p className="text-sm text-blue-800 mt-1">
                      {selectedSlot.day_of_week.charAt(0).toUpperCase() + selectedSlot.day_of_week.slice(1)} {selectedSlot.start_time} - {selectedSlot.end_time}
                    </p>
                  </div>
                )}

                {!useTimetableSubject && (
                  <div className="rounded-md bg-blue-50 p-3 border border-blue-200">
                    <p className="text-xs font-medium text-blue-900">Scheduled for:</p>
                    <p className="text-sm text-blue-800 mt-1">
                      {scheduledStart && scheduledEnd && (
                        <>
                          {new Date(scheduledStart).toLocaleString()} - {new Date(scheduledEnd).toLocaleString()}
                        </>
                      )}
                    </p>
                  </div>
                )}
              </div>
            )}

            <DialogFooter className="flex items-center justify-between gap-2">
              <Button 
                variant="outline" 
                onClick={() => {
                  if (wizardStep > 1) {
                    setWizardStep(wizardStep - 1);
                  } else {
                    setIsCreateOpen(false);
                  }
                }}
              >
                {wizardStep === 1 ? "Cancel" : "Back"}
              </Button>

              <div className="flex gap-2">
                {wizardStep < 3 && (
                  <Button
                    onClick={() => {
                      if (wizardStep === 1) {
                        if (!selectedSubjectClassId) {
                          toast.error("Select a subject");
                          return;
                        }
                        setWizardStep(2);
                      } else if (wizardStep === 2) {
                        if (useTimetableSubject && !selectedSlot) {
                          toast.error("Select a time slot");
                          return;
                        }
                        if (!useTimetableSubject && (!scheduledStart || !scheduledEnd)) {
                          toast.error("Set both start and end time");
                          return;
                        }
                        if (!useTimetableSubject) {
                          const startDate = new Date(scheduledStart);
                          const endDate = new Date(scheduledEnd);
                          if (endDate.getTime() <= startDate.getTime()) {
                            toast.error("End time must be after start time");
                            return;
                          }
                        }
                        setWizardStep(3);
                      }
                    }}
                  >
                    Next
                  </Button>
                )}

                {wizardStep === 3 && (
                  <Button
                    onClick={createLiveSession}
                    disabled={submitting || !zoomUrl.trim()}
                  >
                    {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    Create
                  </Button>
                )}
              </div>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* ── Edit Session Dialog ── */}
        <Dialog open={isEditing && editingSession !== null} onOpenChange={(open) => { if (!open) setEditingSession(null); }}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Pencil className="w-4 h-4 text-blue-600" />
                Edit Session
              </DialogTitle>
              <DialogDescription>
                Update the title, Zoom link, or scheduled time for this live session.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label htmlFor="edit-title">Title</Label>
                <Input
                  id="edit-title"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-zoom">
                  Zoom URL
                  <span className="text-xs text-slate-400 ml-2 font-normal">(leave blank to keep current)</span>
                </Label>
                <Input
                  id="edit-zoom"
                  value={editZoomUrl}
                  onChange={(e) => setEditZoomUrl(e.target.value)}
                  placeholder="https://zoom.us/j/..."
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-start">Start time</Label>
                  <Input
                    id="edit-start"
                    type="datetime-local"
                    value={editScheduledStart}
                    onChange={(e) => setEditScheduledStart(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-end">End time</Label>
                  <Input
                    id="edit-end"
                    type="datetime-local"
                    value={editScheduledEnd}
                    onChange={(e) => setEditScheduledEnd(e.target.value)}
                  />
                </div>
              </div>

              {editingSession && (
                <div className="rounded-md bg-blue-50 border border-blue-200 p-3 text-xs text-blue-800">
                  <p className="font-medium mb-1">Current session info:</p>
                  <p>Status: <span className="font-semibold">{editingSession.status}</span></p>
                  {editingSession.scheduled_for && (
                    <p>Scheduled: {new Date(editingSession.scheduled_for).toLocaleString()}</p>
                  )}
                  {editingSession.scheduled_end_at && (
                    <p>Ends: {new Date(editingSession.scheduled_end_at).toLocaleString()}</p>
                  )}
                </div>
              )}
            </div>

            <DialogFooter className="flex gap-2">
              <Button variant="outline" onClick={() => setEditingSession(null)}>
                Cancel
              </Button>
              <Button onClick={saveEditSession} className="bg-blue-600 hover:bg-blue-700 text-white gap-2">
                <Pencil className="w-4 h-4" />
                Save Changes
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
