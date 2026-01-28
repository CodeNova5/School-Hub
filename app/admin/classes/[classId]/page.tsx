"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
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
  const classId = params.classId as string;

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
      const response = await fetch('/api/admin-read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          operation: 'select',
          table: 'classes',
          select: '*',
          filters: { id: classId },
        }),
      });
      const data = await response.json();
      if (response.ok && Array.isArray(data) && data.length > 0) {
        setClassData(data[0]);
      }
    } catch (error) {
      console.error('Error fetching class:', error);
    } finally {
      setLoading(false);
    }
  }
  async function fetchClassSubjects() {
    setSubjectsLoading(true);
    try {
      const response = await fetch('/api/admin-read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          operation: 'select',
          table: 'subject_classes',
          select: `id, subject_code, subject:subjects(id, name, is_optional, religion, department), teacher:teachers(id, first_name, last_name)`,
          filters: { class_id: classId },
          order: [{ column: 'subject_code', ascending: true }],
        }),
      });
      const data = await response.json();
      if (response.ok) {
        const formatted: SubjectClass[] = (data || []).map((item: any) => ({
          id: item.id,
          subject_code: item.subject_code,
          subject: item.subject,
          teacher: item.teacher ?? null,
        }));
        setSubjects(formatted);
      } else {
        toast.error("Failed to load subjects");
      }
    } catch (error) {
      console.error('Error fetching subjects:', error);
      toast.error("Failed to load subjects");
    } finally {
      setSubjectsLoading(false);
    }
  }

  async function fetchStudents() {
    setStudentsLoading(true);
    try {
      const response = await fetch('/api/admin-read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          operation: 'select',
          table: 'students',
          select: '*',
          filters: { class_id: classId },
          order: [{ column: 'first_name', ascending: true }],
        }),
      });
      const data = await response.json();
      if (response.ok) setStudents(data || []);
    } catch (error) {
      console.error('Error fetching students:', error);
    } finally {
      setStudentsLoading(false);
    }
  }

  async function fetchSessions() {
    try {
      const response = await fetch('/api/admin-read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          operation: 'select',
          table: 'sessions',
          select: '*',
          order: [{ column: 'start_date', ascending: false }],
        }),
      });
      const data = await response.json();
      if (response.ok) setSessions(data || []);
    } catch (error) {
      console.error('Error fetching sessions:', error);
    }
  }

  async function fetchTerms() {
    try {
      const response = await fetch('/api/admin-read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          operation: 'select',
          table: 'terms',
          select: '*',
          order: [{ column: 'start_date', ascending: true }],
        }),
      });
      const data = await response.json();
      if (response.ok) setTerms(data || []);
    } catch (error) {
      console.error('Error fetching terms:', error);
    }
  }

  async function fetchAllClasses() {
    try {
      const response = await fetch('/api/admin-read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          operation: 'select',
          table: 'classes',
          select: '*',
          order: [{ column: 'level', ascending: true }],
        }),
      });
      const data = await response.json();
      if (response.ok) setAllClasses(data || []);
    } catch (error) {
      console.error('Error fetching classes:', error);
    }
  }

  async function fetchAvailableStudents() {
    try {
      const response = await fetch('/api/admin-read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          operation: 'select',
          table: 'students',
          select: '*',
          filters: { class_id: null, status: 'active' },
          order: [{ column: 'first_name', ascending: true }],
        }),
      });
      const data = await response.json();
      if (response.ok) setAvailableStudents(data || []);
    } catch (error) {
      console.error('Error fetching available students:', error);
    }
  }

  async function fetchTeachers() {
    try {
      const response = await fetch('/api/admin-read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          operation: 'select',
          table: 'teachers',
          select: 'id, first_name, last_name',
          filters: { status: 'active' },
        }),
      });
      const data = await response.json();
      if (response.ok) setTeachers(data || []);
    } catch (error) {
      console.error('Error fetching teachers:', error);
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

    const updates = subjectsWithoutCode.map(sc => {
      const newCode = generateSubjectCode(sc.subject.name, classData.name);
      return supabase
        .from("subject_classes")
        .update({ subject_code: newCode })
        .eq("id", sc.id);
    });

    const results = await Promise.all(updates);
    const errors = results.filter(r => r.error);

    if (errors.length > 0) {
      toast.error("Failed to update some subject codes");
      console.error(errors);
    } else {
      toast.success(`Generated codes for ${subjectsWithoutCode.length} subject(s)`);
      fetchClassSubjects();
    }
  }

  async function handleAssignTeacher(subjectClassId: string, teacherId: string) {
    await supabase
      .from("subject_classes")
      .update({ teacher_id: teacherId })
      .eq("id", subjectClassId);

    toast.success("Teacher assigned");
    fetchClassSubjects();
  }

  async function deleteSubjectClass(subjectClassId: string) {
    const { error } = await supabase
      .from("subject_classes")
      .delete()
      .eq("id", subjectClassId);
    if (error) {
      toast.error("Failed to delete subject from class");
      console.error(error);
      return;
    }
    toast.success("Subject removed from class");
    fetchClassSubjects();
  }

  async function handleRemoveStudent(studentId: string) {
    if (!confirm("Remove this student from the class? They will become unassigned.")) return;
    
    const { error } = await supabase
      .from("students")
      .update({ class_id: null })
      .eq("id", studentId);
    
    if (error) {
      toast.error("Failed to remove student");
      return;
    }
    
    toast.success("Student removed from class");
    fetchStudents();
    fetchAvailableStudents();
  }

  async function handleBulkRemove(studentIds: string[]) {
    if (studentIds.length === 0) return;
    if (!confirm(`Remove ${studentIds.length} student(s) from this class?`)) return;

    const updates = studentIds.map(id =>
      supabase.from("students").update({ class_id: null }).eq("id", id)
    );

    const results = await Promise.all(updates);
    const errors = results.filter(r => r.error);

    if (errors.length > 0) {
      toast.error(`Failed to remove ${errors.length} student(s)`);
    } else {
      toast.success(`Removed ${studentIds.length} student(s)`);
    }

    fetchStudents();
    fetchAvailableStudents();
  }

  async function handleAddStudentsToClass(studentIds: string[]) {
    if (studentIds.length === 0) return;

    const updates = studentIds.map(id =>
      supabase.from("students").update({ class_id: classId }).eq("id", id)
    );

    const results = await Promise.all(updates);
    const errors = results.filter(r => r.error);

    if (errors.length > 0) {
      toast.error(`Failed to add ${errors.length} student(s)`);
    } else {
      toast.success(`Added ${studentIds.length} student(s) to class`);
    }

    fetchStudents();
    fetchAvailableStudents();
  }

  async function handleTransferStudents(studentIds: string[], targetClassId: string) {
    if (studentIds.length === 0 || !targetClassId) return;
    if (!confirm(`Transfer ${studentIds.length} student(s) to the selected class?`)) return;

    const updates = studentIds.map(id =>
      supabase.from("students").update({ class_id: targetClassId }).eq("id", id)
    );

    const results = await Promise.all(updates);
    const errors = results.filter(r => r.error);

    if (errors.length > 0) {
      toast.error(`Failed to transfer ${errors.length} student(s)`);
    } else {
      toast.success(`Transferred ${studentIds.length} student(s)`);
    }

    fetchStudents();
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
        <Tabs defaultValue="subjects">
          <TabsList>
            <TabsTrigger value="subjects"><BookOpen className="h-4 w-4 mr-1" /> Subjects</TabsTrigger>
            <TabsTrigger value="students"><Users className="h-4 w-4 mr-1" /> Students</TabsTrigger>
            <TabsTrigger value="timetable"><Clock className="h-4 w-4 mr-1" /> Timetable</TabsTrigger>
            <TabsTrigger value="attendance"><Calendar className="h-4 w-4 mr-1" /> Attendance</TabsTrigger>
            <TabsTrigger value="results">Results</TabsTrigger>
            <TabsTrigger value="settings">Settings</TabsTrigger>
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
