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
        </div>

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