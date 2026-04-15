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

  useEffect(() => {
    if (!schoolLoading && schoolId) {
      loadData();
    }
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

  async function loadLiveSessions() {
    const response = await fetch("/api/teacher/live-sessions");
    const payload = await response.json();

    if (!response.ok) {
      throw new Error(payload.error || "Failed to load live sessions");
    }

    setLiveSessions(payload.data ?? []);
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
      </div>
    </DashboardLayout>
  );
}
