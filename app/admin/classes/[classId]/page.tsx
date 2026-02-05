"use client";

import { useEffect, useState } from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Users, BookOpen, Settings, GraduationCap, Calendar, Clock, UserPlus } from "lucide-react";
import { Student as StudentType, Session, Term } from "@/lib/types";
import { SubjectsTab } from "./components/SubjectsTab";
import { StudentsTab } from "./components/StudentsTab";
import { AttendanceTab } from "./components/AttendanceTab";
import { TimetableTab } from "./components/TimetableTab";
import { ResultsTab } from "./components/ResultsTab";


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

type Student = StudentType;

type Teacher = {
  id: string;
  first_name: string;
  last_name: string;
};

export default function ClassPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const classId = params.classId as string;
  
  const activeTab = searchParams.get("tab") || "subjects";

  const [subjects, setSubjects] = useState<SubjectClass[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [classData, setClassData] = useState<ClassData | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [terms, setTerms] = useState<Term[]>([]);
  const [allClasses, setAllClasses] = useState<ClassData[]>([]);
  const [availableStudents, setAvailableStudents] = useState<Student[]>([]);

  const [loading, setLoading] = useState(true);
  const [subjectsLoading, setSubjectsLoading] = useState(false);
  const [studentsLoading, setStudentsLoading] = useState(false);

  const handleTabChange = (newTab: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", newTab);
    router.push(`?${params.toString()}`);
  };
  useEffect(() => {
    fetchClass();
    fetchTeachers();
    fetchSessions();
    fetchTerms();
    fetchAllClasses();
    fetchAvailableStudents();
  }, []);

  useEffect(() => {
    if (classData?.id) {
      fetchClassSubjects();
      fetchStudents();
    }
  }, [classData?.id]);

  async function fetchClass() {
    try {
      const { data, error } = await supabase
        .from("classes")
        .select("*")
        .eq("id", classId)
        .single();
      if (!error && data) {
        setClassData(data);
      }
    } catch (error) {
      toast.error("Error fetching class");
    } finally {
      setLoading(false);
    }
  }

  async function fetchClassSubjects() {
    setSubjectsLoading(true);
    try {
      const { data, error } = await supabase
        .from("subject_classes")
        .select(`id, subject_code, subjects:subject_id(id, name, is_optional, religion, department), teachers:teacher_id(id, first_name, last_name)`)
        .eq("class_id", classId);
      if (!error && data) {
        const formatted: SubjectClass[] = (data || []).map((item: any) => ({
          id: item.id,
          subject_code: item.subject_code,
          subject: item.subjects,
          teacher: item.teachers ?? null,
        }));
        setSubjects(formatted);
      }
    } catch (error) {
      toast.error("Failed to load subjects");
    } finally {
      setSubjectsLoading(false);
    }
  }

  async function fetchStudents() {
    setStudentsLoading(true);
    try {
      const { data, error } = await supabase
        .from("students")
        .select("*")
        .eq("class_id", classId);
      if (!error && data) setStudents(data || []);
    } catch (error) {
      toast.error("Error fetching students");
    } finally {
      setStudentsLoading(false);
    }
  }

  async function fetchSessions() {
    try {
      const { data, error } = await supabase
        .from("sessions")
        .select("*");
      if (!error && data) setSessions(data || []);
    } catch (error) {
      toast.error("Error fetching sessions");
    }
  }

  async function fetchTerms() {
    try {
      const { data, error } = await supabase
        .from("terms")
        .select("*");
      if (!error && data) setTerms(data || []);
    } catch (error) {
      toast.error("Error fetching terms");
    }
  }

  async function fetchAllClasses() {
    try {
      const { data, error } = await supabase
        .from("classes")
        .select("*")
        .order("level", { ascending: true });
      if (!error && data) setAllClasses(data || []);
    } catch (error) {
      toast.error("Error fetching classes");
    }
  }

  async function fetchAvailableStudents() {
    try {
      const { data, error } = await supabase
        .from("students")
        .select("*")
        .is("class_id", null)
        .eq("status", "active")
        .order("first_name", { ascending: true });
      if (!error && data) setAvailableStudents(data || []);
    } catch (error) {
      toast.error("Error fetching available students");
    }
  }

  async function fetchTeachers() {
    try {
      const { data, error } = await supabase
        .from("teachers")
        .select("id, first_name, last_name");
      if (!error && data) setTeachers(data || []);
    } catch (error) {
      toast.error("Error fetching teachers");
    }
  }

  // Generate subject code
  function generateSubjectCode(subjectName: string, className: string) {
    const clean = subjectName.replace(/\s+/g, "");
    const prefix = clean.slice(0, 3).toUpperCase();
    return `${prefix}-${className}`;
  }

  // Generate and assign subject codes for missing ones
  async function generateMissingSubjectCodes() {
    if (!classData) return;

    const subjectsWithoutCode = subjects.filter(sc => !sc.subject_code);

    if (subjectsWithoutCode.length === 0) {
      toast.info("All subjects already have codes");
      return;
    }

    const updates = subjectsWithoutCode.map(async sc => {
      const newCode = generateSubjectCode(sc.subject.name, classData.name);
      await supabase
        .from("subject_classes")
        .update({ subject_code: newCode })
        .eq("id", sc.id);
    });

    try {
      await Promise.all(updates);
      toast.success(`Generated codes for ${subjectsWithoutCode.length} subject(s)`);
      fetchClassSubjects();
    } catch (error) {
      toast.error("Failed to update some subject codes");
    }
  }

  async function handleAssignTeacher(subjectClassId: string, teacherId: string) {
    try {
      await supabase
        .from("subject_classes")
        .update({ teacher_id: teacherId })
        .eq("id", subjectClassId);
      toast.success("Teacher assigned");
      fetchClassSubjects();
    } catch (error) {
      toast.error("Failed to assign teacher");
    }
  }

  async function deleteSubjectClass(subjectClassId: string) {
    try {
      await supabase
        .from("subject_classes")
        .delete()
        .eq("id", subjectClassId);
      toast.success("Subject removed from class");
      fetchClassSubjects();
    } catch (error) {
      toast.error("Failed to delete subject from class");
    }
  }

  async function handleRemoveStudent(studentId: string) {
    if (!confirm("Remove this student from the class? They will become unassigned. Their results and subject assignments for this class will be deleted.")) return;
    try {
      // Delete results for this student
      await supabase
        .from("results")
        .delete()
        .eq("student_id", studentId);

      // Delete student subject assignments
      await supabase
        .from("student_subjects")
        .delete()
        .eq("student_id", studentId);

      // Delete optional subject selections
      await supabase
        .from("student_optional_subjects")
        .delete()
        .eq("student_id", studentId);

      // Remove from class
      await supabase
        .from("students")
        .update({ class_id: null })
        .eq("id", studentId);

      toast.success("Student removed from class");
      fetchStudents();
      fetchAvailableStudents();
    } catch (error) {
      console.error("Failed to remove student:", error);
      toast.error("Failed to remove student");
    }
  }

  async function handleBulkRemove(studentIds: string[]) {
    if (studentIds.length === 0) return;
    if (!confirm(`Remove ${studentIds.length} student(s) from this class? Their results and subject assignments for this class will be deleted.`)) return;

    try {
      // Delete results for these students
      await supabase
        .from("results")
        .delete()
        .in("student_id", studentIds);

      // Delete student subject assignments
      await supabase
        .from("student_subjects")
        .delete()
        .in("student_id", studentIds);

      // Delete optional subject selections
      await supabase
        .from("student_optional_subjects")
        .delete()
        .in("student_id", studentIds);

      // Remove from class
      const updates = studentIds.map(id =>
        supabase.from("students").update({ class_id: null }).eq("id", id)
      );
      await Promise.all(updates);

      toast.success(`Removed ${studentIds.length} student(s)`);
      fetchStudents();
      fetchAvailableStudents();
    } catch (error) {
      console.error("Failed to remove students:", error);
      toast.error(`Failed to remove some student(s)`);
    }
  }

  async function handleAddStudentsToClass(studentIds: string[]) {
    if (studentIds.length === 0) return;

    try {
      // Clean up old results and subject assignments before moving
      await supabase
        .from("results")
        .delete()
        .in("student_id", studentIds);

      await supabase
        .from("student_subjects")
        .delete()
        .in("student_id", studentIds);

      await supabase
        .from("student_optional_subjects")
        .delete()
        .in("student_id", studentIds);

      // Add to new class
      const updates = studentIds.map(id =>
        supabase.from("students").update({ class_id: classId }).eq("id", id)
      );
      await Promise.all(updates);

      toast.success(`Added ${studentIds.length} student(s) to class. Subject assignments will be set up automatically.`);
      fetchStudents();
      fetchAvailableStudents();
    } catch (error) {
      console.error("Failed to add students:", error);
      toast.error(`Failed to add some student(s)`);
    }
  }

  async function handleTransferStudents(studentIds: string[], targetClassId: string) {
    if (studentIds.length === 0 || !targetClassId) return;
    if (!confirm(`Transfer ${studentIds.length} student(s) to the selected class?`)) return;

    try {
      const response = await fetch("/api/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "transfer-students",
          studentIds,
          targetClassId,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        toast.error(result.error || "Failed to transfer students");
        return;
      }

      if (result.failed > 0) {
        toast.warning(`Transferred ${result.transferred} student(s), ${result.failed} failed`);
      } else {
        toast.success(`Successfully transferred ${result.transferred} student(s) with updated subjects`);
      }
      
      fetchStudents();
    } catch (error: any) {
      toast.error("Failed to transfer students: " + (error.message || error));
    }
  }

  if (loading || !classData) {
    return <DashboardLayout role="admin"><div className="p-6">Loading...</div></DashboardLayout>;
  }

  return (
    <DashboardLayout role="admin">
      <div className="space-y-6">

        {/* ================= HEADER ================= */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <GraduationCap className="h-7 w-7" />
              {classData.name}
            </h1>
            <div className="flex gap-2 mt-2">
              <Badge>{classData.education_level}</Badge>
              <Badge variant="outline">{classData.level}</Badge>
            </div>
          </div>

          <div className="flex gap-3">
            <Badge variant="secondary">{subjects.length} Subjects</Badge>
            <Badge variant="secondary">{students.length} Students</Badge>
          </div>
        </div>

        {/* ================= STATS ================= */}
        <div className="grid gap-4 md:grid-cols-4">
          <StatCard title="Students" value={students.length} icon={Users} />
          <StatCard title="Subjects" value={subjects.length} icon={BookOpen} />
          <StatCard title="Teachers" value={teachers.length} icon={UserPlus} />
          <StatCard title="Settings" value="Manage" icon={Settings} />
        </div>

        {/* ================= TABS ================= */}
        <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
          <TabsList className="grid w-full grid-cols-6 lg:w-auto">
            <TabsTrigger value="subjects" className="flex items-center gap-2">
              <BookOpen className="h-4 w-4" />
              <span className="hidden sm:inline">Subjects</span>
            </TabsTrigger>
            <TabsTrigger value="students" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              <span className="hidden sm:inline">Students</span>
            </TabsTrigger>
            <TabsTrigger value="timetable" className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              <span className="hidden sm:inline">Timetable</span>
            </TabsTrigger>
            <TabsTrigger value="attendance" className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              <span className="hidden sm:inline">Attendance</span>
            </TabsTrigger>
            <TabsTrigger value="results" className="flex items-center gap-2">
              <BookOpen className="h-4 w-4" />
              <span className="hidden sm:inline">Results</span>
            </TabsTrigger>
            <TabsTrigger value="settings" className="flex items-center gap-2">
              <Settings className="h-4 w-4" />
              <span className="hidden sm:inline">Settings</span>
            </TabsTrigger>
          </TabsList>

          {/* ================= SUBJECTS TAB ================= */}
          <TabsContent value="subjects">
            <SubjectsTab
              subjects={subjects}
              teachers={teachers}
              students={students}
              classId={classId}
              onGenerateCodes={generateMissingSubjectCodes}
              onAssignTeacher={handleAssignTeacher}
              onDeleteSubject={deleteSubjectClass}
              onRefresh={fetchClassSubjects}
            />
          </TabsContent>

          {/* ================= STUDENTS TAB ================= */}
          <TabsContent value="students">
            <StudentsTab
              students={students}
              classData={classData}
              sessions={sessions}
              terms={terms}
              availableStudents={availableStudents}
              allClasses={allClasses}
              onAddStudents={handleAddStudentsToClass}
              onRemoveStudent={handleRemoveStudent}
              onBulkRemove={handleBulkRemove}
              onTransferStudents={handleTransferStudents}
            />
          </TabsContent>

          {/* ================= TIMETABLE TAB ================= */}
          <TabsContent value="timetable">
            <TimetableTab classId={classId} className={classData?.name} />
          </TabsContent>

          {/* ================= ATTENDANCE TAB ================= */}
          <TabsContent value="attendance">
            <AttendanceTab classId={classId} className={classData?.name} />
          </TabsContent>

          {/* ================= RESULTS TAB ================= */}
          <TabsContent value="results">
            <ResultsTab classId={classId} className={classData?.name} students={students} />
          </TabsContent>

          {/* ================= SETTINGS TAB ================= */}
          <TabsContent value="settings">
            <Card><CardContent className="p-6">Settings coming soon</CardContent></Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}

/* ================= SMALL STAT CARD ================= */
function StatCard({ title, value, icon: Icon }: any) {
  return (
    <Card>
      <CardContent className="p-4 flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">{title}</p>
          <p className="text-2xl font-bold">{value}</p>
        </div>
        <Icon className="h-6 w-6 text-muted-foreground" />
      </CardContent>
    </Card>
  );
}
