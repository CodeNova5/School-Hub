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

  useEffect(() => {
    loadInitialData();
  }, [classId]);

  async function loadInitialData() {
    try {
      setLoading(true);
      const [classResult, sessionsResult, termsResult] = await Promise.all([
        supabase.from('classes').select('*').eq('id', classId).single(),
        supabase.from('sessions').select('*'),
        supabase.from('terms').select('*')
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
            .eq('class_id', classId),
          supabase
            .from('students')
            .select('*')
            .eq('class_id', classId)
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
    setSubjectsLoading(true);
    try {
      const { data, error } = await supabase
        .from('subject_classes')
        .select(`id, subject_code, subject:subjects(id, name, is_optional, religion, department), teacher:teachers(id, first_name, last_name)`)
        .eq('class_id', classId);
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

  if (loading) {
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
      <div className="space-y-4 sm:space-y-6 md:space-y-8 pb-4 sm:pb-6">
        {/* Header */}
        <div>
          <div className="flex items-center gap-4 mb-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => router.back()}
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-3xl font-bold">{classData.name}</h1>
              <p className="text-gray-600 mt-1">Class Management Portal</p>
            </div>
          </div>

          {/* Class Info */}
          <Card>
            <CardContent className="pt-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <p className="text-sm text-gray-600">Level</p>
                  <p className="font-semibold">{classData.level}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Education Level</p>
                  <Badge>{classData.education_level}</Badge>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Class Code</p>
                  <code className="bg-gray-100 px-2 py-1 rounded text-sm">
                    {classData.class_code || "N/A"}
                  </code>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Students</p>
                  <p className="text-2xl font-bold">{students.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <Card>
            <TabsList className="grid w-full grid-cols-5 p-2 sm:p-4 md:p-6 bg-muted rounded-none border-b h-auto">
              <TabsTrigger value="subjects" className="flex flex-col sm:flex-row items-center gap-1 sm:gap-2 py-2 sm:py-2.5 px-2 text-xs sm:text-sm">
                <BookOpen className="h-4 w-4 sm:h-4 sm:w-4 shrink-0" />
                <span className="text-[10px] sm:text-sm">Subjects</span>
              </TabsTrigger>
              <TabsTrigger value="students" className="flex flex-col sm:flex-row items-center gap-1 sm:gap-2 py-2 sm:py-2.5 px-2 text-xs sm:text-sm">
                <Users className="h-4 w-4 sm:h-4 sm:w-4 shrink-0" />
                <span className="text-[10px] sm:text-sm">Students</span>
              </TabsTrigger>
              <TabsTrigger value="timetable" className="flex flex-col sm:flex-row items-center gap-1 sm:gap-2 py-2 sm:py-2.5 px-2 text-xs sm:text-sm">
                <CalendarDays className="h-4 w-4 sm:h-4 sm:w-4 shrink-0" />
                <span className="text-[10px] sm:text-sm">Timetable</span>
              </TabsTrigger>
              <TabsTrigger value="attendance" className="flex flex-col sm:flex-row items-center gap-1 sm:gap-2 py-2 sm:py-2.5 px-2 text-xs sm:text-sm">
                <UserCheck className="h-4 w-4 sm:h-4 sm:w-4 shrink-0" />
                <span className="text-[10px] sm:text-sm">Attendance</span>
              </TabsTrigger>
              <TabsTrigger value="results" className="flex flex-col sm:flex-row items-center gap-1 sm:gap-2 py-2 sm:py-2.5 px-2 text-xs sm:text-sm">
                <BarChart3 className="h-4 w-4 sm:h-4 sm:w-4 shrink-0" />
                <span className="text-[10px] sm:text-sm">Results</span>
              </TabsTrigger>
            </TabsList>
          </Card>
            <TabsContent value="subjects" className="mt-2 sm:mt-3 md:mt-4">
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
                />
              )}
            </TabsContent>


            <TabsContent value="students" className="mt-2 sm:mt-3 md:mt-4">
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
                />
              )}
            </TabsContent>
            <TabsContent value="timetable" className="mt-2 sm:mt-3 md:mt-4">
            <TeacherTimetableTab
              classId={classId}
              className={classData.name}
            />
          </TabsContent>

          <TabsContent value="attendance" className="mt-2 sm:mt-3 md:mt-4">
            <TeacherAttendanceTab
              classId={classId}
              className={classData.name}
              students={students}
            />
          </TabsContent>

          <TabsContent value="results" className="mt-2 sm:mt-3 md:mt-4">
            <TeacherResultsTab
              classId={classId}
              className={classData.name}
              students={students}
            />
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}