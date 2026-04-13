"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { ArrowLeft, Users, BookOpen, UserCheck, BarChart3, Loader2, CalendarDays, Video, Radio } from "lucide-react";
import { Student as StudentType, Session, Term } from "@/lib/types";
import { useSchoolContext } from "@/hooks/use-school-context";
import TeacherSubjectsTab from "./components/TeacherSubjectsTab";
import TeacherStudentsTab from "./components/TeacherStudentsTab";
import TeacherAttendanceTab from "./components/TeacherAttendanceTab";
import TeacherResultsTab from "./components/TeacherResultsTab";
import TeacherTimetableTab from "./components/TeacherTimetableTab";

type ClassData = {
  id: string;
  school_id: string;
  name: string;
  class_level_id: string;
  stream_id: string | null;
  department_id: string | null;
  room_number: string | null;
  class_teacher_id: string | null;
  session_id: string | null;
  academic_year: string | null;
  created_at: string;
  updated_at: string;
  school_class_levels: {
    id: string;
    name: string;
    code: string | null;
  } | null;
};

type SubjectClass = {
  id: string;
  subject_code: string;
  subject: {
    id: string;
    name: string;
  };
  teacher: {
    id: string;
    first_name: string;
    last_name: string;
  } | null;
  is_optional: boolean;
};

type LiveSession = {
  id: string;
  title: string;
  class_id: string;
  status: "scheduled" | "live" | "ended" | "cancelled";
  scheduled_for: string | null;
  started_at: string | null;
  ended_at: string | null;
  created_at: string;
};

// Skeleton loader component
function SkeletonLoader() {
  return (
    <div className="space-y-4">
      <div className="h-20 bg-gray-200 rounded-lg animate-pulse"></div>
      <div className="grid grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-24 bg-gray-200 rounded-lg animate-pulse"></div>
        ))}
      </div>
      <div className="h-96 bg-gray-200 rounded-lg animate-pulse"></div>
    </div>
  );
}

interface PageProps {
  params: {
    classId: string;
  };
}

export default function TeacherClassManagement({ params }: PageProps) {
  const router = useRouter();
  const { classId } = params;

  const [classData, setClassData] = useState<ClassData | null>(null);
  const [subjects, setSubjects] = useState<SubjectClass[]>([]);
  const [students, setStudents] = useState<StudentType[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [terms, setTerms] = useState<Term[]>([]);
  const [liveSessions, setLiveSessions] = useState<LiveSession[]>([]);
  const [liveSessionsLoading, setLiveSessionsLoading] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [creatingLiveSession, setCreatingLiveSession] = useState(false);
  const [liveClassTitle, setLiveClassTitle] = useState("Live Class");
  const [zoomUrl, setZoomUrl] = useState("");
  const [scheduledFor, setScheduledFor] = useState("");

  const [loading, setLoading] = useState(true);
  const [subjectsLoading, setSubjectsLoading] = useState(false);
  const [studentsLoading, setStudentsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("subjects");
  const { schoolId, isLoading: schoolLoading } = useSchoolContext();

  useEffect(() => {
    loadInitialData();
  }, [classId, schoolId]);

  async function loadInitialData() {
    if (!schoolId) return;
    try {
      setLoading(true);
      
      // Get current user's teacher ID
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("User not authenticated");
        return;
      }

      const [classResult, sessionsResult, termsResult, teacherResult] = await Promise.all([
        supabase.from('classes').select('*, school_class_levels(id, name, code)').eq('id', classId).eq('school_id', schoolId).single(),
        supabase.from('sessions').select('*').eq('school_id', schoolId),
        supabase.from('terms').select('*').eq('school_id', schoolId),
        supabase.from('teachers').select('id').eq('user_id', user.id).eq('school_id', schoolId).single()
      ]);

      if (classResult.data) setClassData(classResult.data);
      if (sessionsResult.data) setSessions(sessionsResult.data);
      if (termsResult.data) setTerms(termsResult.data);

      // Load subjects and students in parallel after class data
      if (classResult.data && teacherResult.data) {
        setSubjectsLoading(true);
        setStudentsLoading(true);

        const [subjectsResult, studentsResult] = await Promise.all([
          supabase
            .from('subject_classes')
            .select(`id, subject_code, is_optional, subject:subjects!subject_classes_subject_id_fkey(id, name), teacher:teachers(id, first_name, last_name)`)
            .eq('class_id', classId)
            .eq('school_id', schoolId),
          supabase
            .from('students')
            .select('*')
            .eq('class_id', classId)
            .eq('school_id', schoolId)
        ]);

        if (subjectsResult.data) {
          const formatted: SubjectClass[] = subjectsResult.data.map((item: any) => ({
            id: item.id,
            subject_code: item.subject_code,
            subject: item.subject,
            teacher: item.teacher ?? null,
            is_optional: item.is_optional,
          }));
          setSubjects(formatted);
        }

        if (studentsResult.data) {
          setStudents(studentsResult.data);
        }

        setSubjectsLoading(false);
        setStudentsLoading(false);

        await fetchLiveSessions();
      }
    } catch (error) {
      console.error('Error loading data:', error);
      toast.error("Failed to load class data");
    } finally {
      setLoading(false);
    }
  }

  async function fetchLiveSessions() {
    try {
      setLiveSessionsLoading(true);
      const response = await fetch(`/api/teacher/live-sessions?classId=${classId}`);
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error || "Failed to load live sessions");
      }

      setLiveSessions(payload.data || []);
    } catch (error: any) {
      toast.error(error.message || "Failed to load live sessions");
    } finally {
      setLiveSessionsLoading(false);
    }
  }

  async function createLiveSession() {
    if (!zoomUrl.trim()) {
      toast.error("Please paste a Zoom link");
      return;
    }

    try {
      setCreatingLiveSession(true);

      const response = await fetch("/api/teacher/live-sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          classId,
          title: liveClassTitle,
          zoomUrl,
          scheduledFor: scheduledFor || null,
        }),
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || "Failed to create live class");
      }

      toast.success("Live class created");
      setCreateDialogOpen(false);
      setZoomUrl("");
      setScheduledFor("");
      setLiveClassTitle("Live Class");
      await fetchLiveSessions();
    } catch (error: any) {
      toast.error(error.message || "Failed to create live class");
    } finally {
      setCreatingLiveSession(false);
    }
  }

  async function updateLiveSession(sessionId: string, action: "start" | "end" | "cancel") {
    try {
      const response = await fetch(`/api/teacher/live-sessions/${sessionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || "Failed to update live session");
      }

      toast.success("Live class updated");
      await fetchLiveSessions();
    } catch (error: any) {
      toast.error(error.message || "Failed to update live class");
    }
  }

  function getStatusBadge(status: LiveSession["status"]) {
    if (status === "live") {
      return <Badge className="bg-red-100 text-red-700 hover:bg-red-100">Live</Badge>;
    }

    if (status === "scheduled") {
      return <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100">Scheduled</Badge>;
    }

    if (status === "ended") {
      return <Badge className="bg-gray-100 text-gray-700 hover:bg-gray-100">Ended</Badge>;
    }

    return <Badge className="bg-orange-100 text-orange-700 hover:bg-orange-100">Cancelled</Badge>;
  }

  async function fetchClassSubjects() {
    if (!schoolId) return;
    setSubjectsLoading(true);
    try {
      const { data, error } = await supabase
        .from('subject_classes')
        .select(`id, subject_code, is_optional, subject:subjects!subject_classes_subject_id_fkey(id, name), teacher:teachers(id, first_name, last_name)`)
        .eq('class_id', classId)
        .eq('school_id', schoolId);

      const formatted: SubjectClass[] = (data || []).map((item: any) => ({
        id: item.id,
        subject_code: item.subject_code,
        subject: item.subject,
        teacher: item.teacher ?? null,
        is_optional: item.is_optional,
      }));
      setSubjects(formatted);
    } catch (error) {
      console.error('Error fetching subjects:', error);
    } finally {
      setSubjectsLoading(false);
    }
  }

  if (schoolLoading || loading) {
    return (
      <DashboardLayout role="teacher">
        <div className="space-y-8">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => router.back()}
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <div className="h-8 bg-gray-200 rounded-md w-64 animate-pulse"></div>
              <div className="h-4 bg-gray-200 rounded-md w-40 animate-pulse mt-2"></div>
            </div>
          </div>
          <SkeletonLoader />
        </div>
      </DashboardLayout>
    );
  }

  if (!classData) {
    return (
      <DashboardLayout role="teacher">
        <div className="space-y-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.back()}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <Card className="border-red-200 bg-red-50">
            <CardContent className="pt-6">
              <p className="text-red-900">Failed to load class information.</p>
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout role="teacher">
      <div className="space-y-6 pb-8">
        {/* Header */}
        <div>
          <div className="flex items-center gap-2 sm:gap-4 mb-6">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 sm:h-10 sm:w-10 hover:bg-gray-100"
              onClick={() => router.back()}
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="min-w-0 flex-1">
              <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 truncate">{classData.name}</h1>
              <p className="text-sm text-gray-500 mt-1">Class Management Dashboard</p>
            </div>
            <Button onClick={() => setCreateDialogOpen(true)} className="gap-2">
              <Video className="h-4 w-4" />
              Create Live Class
            </Button>
          </div>

          {/* Class Info */}
          <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
            <CardContent className="p-6">
              <div className="grid grid-cols-2 gap-8">
                <div className="space-y-2">
                  <p className="text-sm font-medium text-gray-600">Class Level</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {classData.school_class_levels?.name || "N/A"}
                  </p>
                </div>
                <div className="space-y-2">
                  <p className="text-sm font-medium text-gray-600">Total Students</p>
                  <p className="text-2xl font-bold text-blue-600">{students.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-red-100 bg-red-50/40 mt-4">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Radio className="h-5 w-5 text-red-600" />
                Live Sessions
              </CardTitle>
            </CardHeader>
            <CardContent>
              {liveSessionsLoading ? (
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading live sessions...
                </div>
              ) : liveSessions.length === 0 ? (
                <p className="text-sm text-gray-600">No live classes yet. Create one using the button above.</p>
              ) : (
                <div className="space-y-3">
                  {liveSessions.slice(0, 4).map((session) => (
                    <div key={session.id} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-lg border bg-white p-3">
                      <div>
                        <p className="font-semibold text-gray-900">{session.title}</p>
                        <p className="text-xs text-gray-600">
                          {session.scheduled_for
                            ? `Scheduled: ${new Date(session.scheduled_for).toLocaleString()}`
                            : `Created: ${new Date(session.created_at).toLocaleString()}`}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        {getStatusBadge(session.status)}
                        {session.status === "scheduled" && (
                          <Button size="sm" variant="outline" onClick={() => updateLiveSession(session.id, "start")}>Start</Button>
                        )}
                        {session.status === "live" && (
                          <Button size="sm" variant="outline" onClick={() => updateLiveSession(session.id, "end")}>End</Button>
                        )}
                        {(session.status === "scheduled" || session.status === "live") && (
                          <Button size="sm" variant="ghost" onClick={() => updateLiveSession(session.id, "cancel")}>Cancel</Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Live Class</DialogTitle>
              <DialogDescription>
                Paste a Zoom join link. Students in this class will get a secure Join button.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="live-class-title">Title</Label>
                <Input
                  id="live-class-title"
                  value={liveClassTitle}
                  onChange={(event) => setLiveClassTitle(event.target.value)}
                  placeholder="Live Class"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="zoom-url">Zoom Link</Label>
                <Input
                  id="zoom-url"
                  value={zoomUrl}
                  onChange={(event) => setZoomUrl(event.target.value)}
                  placeholder="https://zoom.us/j/1234567890?pwd=..."
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="scheduled-for">Schedule (optional)</Label>
                <Input
                  id="scheduled-for"
                  type="datetime-local"
                  value={scheduledFor}
                  onChange={(event) => setScheduledFor(event.target.value)}
                />
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setCreateDialogOpen(false)} disabled={creatingLiveSession}>Cancel</Button>
              <Button onClick={createLiveSession} disabled={creatingLiveSession}>
                {creatingLiveSession ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Create
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <Card className="border-b-0 rounded-b-none">
            <TabsList className="grid w-full grid-cols-5 p-2 bg-white rounded-none h-auto gap-1">
              <TabsTrigger 
                value="subjects" 
                className="flex flex-col items-center gap-1 py-3 px-2 text-xs data-[state=active]:bg-blue-50 data-[state=active]:text-blue-700 hover:bg-gray-50 rounded-lg transition-colors"
              >
                <BookOpen className="h-4 w-4" />
                <span className="text-[10px] leading-tight font-medium">Subjects</span>
              </TabsTrigger>
              <TabsTrigger 
                value="students" 
                className="flex flex-col items-center gap-1 py-3 px-2 text-xs data-[state=active]:bg-blue-50 data-[state=active]:text-blue-700 hover:bg-gray-50 rounded-lg transition-colors"
              >
                <Users className="h-4 w-4" />
                <span className="text-[10px] leading-tight font-medium">Students</span>
              </TabsTrigger>
              <TabsTrigger 
                value="timetable" 
                className="flex flex-col items-center gap-1 py-3 px-2 text-xs data-[state=active]:bg-blue-50 data-[state=active]:text-blue-700 hover:bg-gray-50 rounded-lg transition-colors"
              >
                <CalendarDays className="h-4 w-4" />
                <span className="text-[10px] leading-tight font-medium">Timetable</span>
              </TabsTrigger>
              <TabsTrigger 
                value="attendance" 
                className="flex flex-col items-center gap-1 py-3 px-2 text-xs data-[state=active]:bg-blue-50 data-[state=active]:text-blue-700 hover:bg-gray-50 rounded-lg transition-colors"
              >
                <UserCheck className="h-4 w-4" />
                <span className="text-[10px] leading-tight font-medium">Attendance</span>
              </TabsTrigger>
              <TabsTrigger 
                value="results" 
                className="flex flex-col items-center gap-1 py-3 px-2 text-xs data-[state=active]:bg-blue-50 data-[state=active]:text-blue-700 hover:bg-gray-50 rounded-lg transition-colors"
              >
                <BarChart3 className="h-4 w-4" />
                <span className="text-[10px] leading-tight font-medium">Results</span>
              </TabsTrigger>
            </TabsList>
          </Card>
          <TabsContent value="subjects" className="mt-0 -mx-1 sm:mx-0">
            {subjectsLoading ? (
              <Card>
                <CardContent className="p-4 sm:pt-6">
                  <SkeletonLoader />
                </CardContent>
              </Card>
            ) : (
              <TeacherSubjectsTab
                classId={classId}
                subjects={subjects}
                onRefresh={fetchClassSubjects}
                schoolId={schoolId}
              />
            )}
          </TabsContent>

          <TabsContent value="students" className="mt-0 -mx-1 sm:mx-0">
            {studentsLoading ? (
              <Card>
                <CardContent className="p-4 sm:pt-6">
                  <SkeletonLoader />
                </CardContent>
              </Card>
            ) : (
              <TeacherStudentsTab
                students={students}
                classData={classData}
                sessions={sessions}
                terms={terms}
              />
            )}
          </TabsContent>
          <TabsContent value="timetable" className="mt-0 -mx-1 sm:mx-0">
            <TeacherTimetableTab
              classId={classId}
              className={classData.name}
              schoolId={schoolId!}
            />
          </TabsContent>

          <TabsContent value="attendance" className="mt-0 -mx-1 sm:mx-0">
            <TeacherAttendanceTab
              classId={classId}
              className={classData.name}
              students={students}
              schoolId={schoolId!}
            />
          </TabsContent>

          <TabsContent value="results" className="mt-0 -mx-1 sm:mx-0">
            <TeacherResultsTab
              classId={classId}
              className={classData.name}
              students={students}
              schoolId={schoolId!}
            />
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}