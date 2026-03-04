"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { ArrowLeft, Users, BookOpen, UserCheck, BarChart3, Loader2, CalendarDays } from "lucide-react";
import { Student as StudentType, Session, Term } from "@/lib/types";
import { useSchoolContext } from "@/hooks/use-school-context";
import TeacherSubjectsTab from "./components/TeacherSubjectsTab";
import TeacherStudentsTab from "./components/TeacherStudentsTab";
import TeacherAttendanceTab from "./components/TeacherAttendanceTab";
import TeacherResultsTab from "./components/TeacherResultsTab";
import TeacherTimetableTab from "./components/TeacherTimetableTab";

type ClassData = {
  id: string;
  name: string;
  level: string;
  education_level: string;
  class_teacher_id: string | null;
  class_code: string | null;
};

type SubjectClass = {
  id: string;
  subject_code: string;
  subject: {
    id: string;
    name: string;
    is_optional: boolean;
    religion?: string | null;
    department?: string | null;
  };
  teacher: {
    id: string;
    first_name: string;
    last_name: string;
  } | null;
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
      const [classResult, sessionsResult, termsResult] = await Promise.all([
        supabase.from('classes').select('*').eq('id', classId).eq('school_id', schoolId).single(),
        supabase.from('sessions').select('*').eq('school_id', schoolId),
        supabase.from('terms').select('*').eq('school_id', schoolId)
      ]);

      if (classResult.data) setClassData(classResult.data);
      if (sessionsResult.data) setSessions(sessionsResult.data);
      if (termsResult.data) setTerms(termsResult.data);

      // Load subjects and students in parallel after class data
      if (classResult.data) {
        setSubjectsLoading(true);
        setStudentsLoading(true);

        const [subjectsResult, studentsResult] = await Promise.all([
          supabase
            .from('subject_classes')
            .select(`id, subject_code, subject:subjects(id, name, is_optional, religion, department), teacher:teachers(id, first_name, last_name)`)
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
          }));
          setSubjects(formatted);
        }

        if (studentsResult.data) {
          setStudents(studentsResult.data);
        }

        setSubjectsLoading(false);
        setStudentsLoading(false);
      }
    } catch (error) {
      console.error('Error loading data:', error);
      toast.error("Failed to load class data");
    } finally {
      setLoading(false);
    }
  }

  async function fetchClassSubjects() {
    if (!schoolId) return;
    setSubjectsLoading(true);
    try {
      const { data, error } = await supabase
        .from('subject_classes')
        .select(`id, subject_code, subject:subjects(id, name, is_optional, religion, department), teacher:teachers(id, first_name, last_name)`)
        .eq('class_id', classId)
        .eq('school_id', schoolId);
      const formatted: SubjectClass[] = (data || []).map((item: any) => ({
        id: item.id,
        subject_code: item.subject_code,
        subject: item.subject,
        teacher: item.teacher ?? null,
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
      <div className="space-y-3 sm:space-y-4 md:space-y-6 pb-4 sm:pb-6">
        {/* Header */}
        <div>
          <div className="flex items-center gap-2 sm:gap-4 mb-3 sm:mb-4">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 sm:h-10 sm:w-10"
              onClick={() => router.back()}
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="min-w-0">
              <h1 className="text-2xl sm:text-3xl font-bold truncate">{classData.name}</h1>
              <p className="text-xs sm:text-sm text-gray-600 mt-0.5 sm:mt-1">Class Management Portal</p>
            </div>
          </div>

          {/* Class Info */}
          <Card>
            <CardContent className="p-3 sm:p-4 md:p-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-3 md:gap-4">
                <div>
                  <p className="text-xs sm:text-sm text-gray-600">Level</p>
                  <p className="font-semibold text-sm sm:text-base">{classData.level}</p>
                </div>
                <div>
                  <p className="text-xs sm:text-sm text-gray-600">Education Level</p>
                  <Badge className="text-xs sm:text-sm mt-1">{classData.education_level}</Badge>
                </div>
                <div>
                  <p className="text-xs sm:text-sm text-gray-600">Class Code</p>
                  <code className="bg-gray-100 px-2 py-1 rounded text-xs sm:text-sm break-all">
                    {classData.class_code || "N/A"}
                  </code>
                </div>
                <div>
                  <p className="text-xs sm:text-sm text-gray-600">Students</p>
                  <p className="text-xl sm:text-2xl font-bold">{students.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <Card>
            <TabsList className="grid w-full grid-cols-5 p-1 sm:p-2 md:p-4 bg-muted rounded-none border-b h-auto">
              <TabsTrigger value="subjects" className="flex flex-col items-center gap-0.5 sm:gap-1 py-1.5 sm:py-2 px-1 sm:px-2 text-[10px] sm:text-xs">
                <BookOpen className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" />
                <span className="text-[9px] sm:text-xs leading-tight">Subjects</span>
              </TabsTrigger>
              <TabsTrigger value="students" className="flex flex-col items-center gap-0.5 sm:gap-1 py-1.5 sm:py-2 px-1 sm:px-2 text-[10px] sm:text-xs">
                <Users className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" />
                <span className="text-[9px] sm:text-xs leading-tight">Students</span>
              </TabsTrigger>
              <TabsTrigger value="timetable" className="flex flex-col items-center gap-0.5 sm:gap-1 py-1.5 sm:py-2 px-1 sm:px-2 text-[10px] sm:text-xs">
                <CalendarDays className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" />
                <span className="text-[9px] sm:text-xs leading-tight">Timetable</span>
              </TabsTrigger>
              <TabsTrigger value="attendance" className="flex flex-col items-center gap-0.5 sm:gap-1 py-1.5 sm:py-2 px-1 sm:px-2 text-[10px] sm:text-xs">
                <UserCheck className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" />
                <span className="text-[9px] sm:text-xs leading-tight">Attendance</span>
              </TabsTrigger>
              <TabsTrigger value="results" className="flex flex-col items-center gap-0.5 sm:gap-1 py-1.5 sm:py-2 px-1 sm:px-2 text-[10px] sm:text-xs">
                <BarChart3 className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" />
                <span className="text-[9px] sm:text-xs leading-tight">Results</span>
              </TabsTrigger>
            </TabsList>
          </Card>
            <TabsContent value="subjects" className="mt-2 sm:mt-3 md:mt-4 -mx-1 sm:mx-0">
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

            <TabsContent value="students" className="mt-2 sm:mt-3 md:mt-4 -mx-1 sm:mx-0">
              {studentsLoading ? (
                <Card>
                  <CardContent className="p-4 sm:pt-6">
                    <p className="text-sm text-gray-600">Students</p>
                    <p className="text-xl font-bold">{students.length}</p>
                    <SkeletonLoader />
                  </CardContent>
                </Card>
              ) : (
                <TeacherStudentsTab
                  classId={classId}
                  students={students}
                  sessions={sessions}
                  terms={terms}
                  schoolId={schoolId!}
                />
              )}
            </TabsContent>
            <TabsContent value="timetable" className="mt-2 sm:mt-3 md:mt-4 -mx-1 sm:mx-0">
            <TeacherTimetableTab
              classId={classId}
              className={classData.name}
              schoolId={schoolId!}
            />
          </TabsContent>

          <TabsContent value="attendance" className="mt-2 sm:mt-3 md:mt-4 -mx-1 sm:mx-0">
            <TeacherAttendanceTab
              classId={classId}
              className={classData.name}
              students={students}
              schoolId={schoolId!}
            />
          </TabsContent>

          <TabsContent value="results" className="mt-2 sm:mt-3 md:mt-4 -mx-1 sm:mx-0">
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