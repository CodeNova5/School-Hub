"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Copy,
  Users,
  BookOpen,
  Settings,
  GraduationCap,
  Search,
  Filter,
  UserPlus,
  MoreVertical,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { Trash2, User, BarChart3, Download, Upload, UserMinus, ArrowRightLeft, CheckSquare, Calendar, Clock, Plus, FileDown } from "lucide-react";
import { useRouter } from "next/navigation";
import { StudentDetailsModal } from "@/components/student-details-modal";
import { Student as StudentType, Session, Term } from "@/lib/types";
import * as XLSX from "xlsx-js-style";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import { Label } from "@/components/ui/label";


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


type PeriodSlot = {
  id: string;
  day_of_week: string;
  period_number: number;
  start_time: string;
  end_time: string;
  is_break: boolean;
};

type TimetableEntry = {
  id: string;
  class_id: string;
  period_slot_id: string;
  day_of_week: string;
  classes?: { name: string; level: string };
  period_slots?: PeriodSlot;
  subject_classes?: {
    id: string;
    subject_code: string;
    subjects?: { name: string; department?: string; religion?: string };
    teachers?: { first_name: string; last_name: string };
  };
};

type AttendanceRecord = {
  id: string;
  student_id: string;
  class_id: string;
  date: string;
  status: 'present' | 'absent' | 'late' | 'excused';
};

interface StudentAttendance extends Student {
  attendanceStatus: 'present' | 'absent' | 'late' | 'excused' | 'not_marked';
  attendanceId?: string;
}

export default function ClassPage() {
  const router = useRouter();
  const params = useParams();
  const classId = params.classId as string;

  const [subjects, setSubjects] = useState<SubjectClass[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [classData, setClassData] = useState<ClassData | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [terms, setTerms] = useState<Term[]>([]);
  const [allClasses, setAllClasses] = useState<ClassData[]>([]);

  const [loading, setLoading] = useState(true);
  const [subjectsLoading, setSubjectsLoading] = useState(false);
  const [studentsLoading, setStudentsLoading] = useState(false);

  const [isAssignTeacherOpen, setIsAssignTeacherOpen] = useState(false);
  const [selectedSubjectClass, setSelectedSubjectClass] = useState<SubjectClass | null>(null);
  const [selectedTeacherId, setSelectedTeacherId] = useState<string>("");

  // Student Management States
  const [studentSearch, setStudentSearch] = useState("");
  const [studentGenderFilter, setStudentGenderFilter] = useState<"all" | "male" | "female">("all");
  const [studentStatusFilter, setStudentStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [selectedStudents, setSelectedStudents] = useState<Set<string>>(new Set());
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [isStudentDetailsOpen, setIsStudentDetailsOpen] = useState(false);
  const [isAddStudentOpen, setIsAddStudentOpen] = useState(false);
  const [isTransferStudentOpen, setIsTransferStudentOpen] = useState(false);
  const [transferTargetClassId, setTransferTargetClassId] = useState("");
  const [availableStudents, setAvailableStudents] = useState<Student[]>([]);

  // Timetable States
  const [timetableEntries, setTimetableEntries] = useState<TimetableEntry[]>([]);
  const [periodSlots, setPeriodSlots] = useState<PeriodSlot[]>([]);
  const [timetableLoading, setTimetableLoading] = useState(false);

  // Attendance States
  const [attendanceStudents, setAttendanceStudents] = useState<StudentAttendance[]>([]);
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [attendanceLoading, setAttendanceLoading] = useState(false);

  // Filters
  const [search, setSearch] = useState("");
  const [filterOptional, setFilterOptional] = useState<"all" | "optional" | "compulsory">("all");
  const [filterReligion, setFilterReligion] = useState<"all" | "Christian" | "Muslim">("all");
  const [filterDepartment, setFilterDepartment] = useState<"all" | "Science" | "Arts" | "Commercial">("all");
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
    const { data } = await supabase.from("classes").select("*").eq("id", classId).single();
    setClassData(data);
    setLoading(false);
  }
  async function fetchClassSubjects() {
    setSubjectsLoading(true);

    const { data, error } = await supabase
      .from("subject_classes")
      .select(`
      id,
      subject_code,
      subject:subjects (
        id,
        name,
        is_optional,
        religion,
        department
      ),
      teacher:teachers (
        id,
        first_name,
        last_name
      )
    `)
      .eq("class_id", classId)
      .order("subject_code");

    if (error) {
      console.error(error);
      toast.error("Failed to load subjects");
      setSubjectsLoading(false);
      return;
    }

    const formatted: SubjectClass[] = (data || []).map((item: any) => ({
      id: item.id,
      subject_code: item.subject_code,
      subject: item.subject,   // ✅ now correct
      teacher: item.teacher ?? null,
    }));
    setSubjects(formatted);
    setSubjectsLoading(false);
  }

  async function fetchStudents() {
    setStudentsLoading(true);
    const { data } = await supabase
      .from("students")
      .select("*")
      .eq("class_id", classId)
      .order("first_name");
    setStudents(data || []);
    setStudentsLoading(false);
  }

  async function fetchSessions() {
    const { data } = await supabase.from("sessions").select("*").order("start_date", { ascending: false });
    setSessions(data || []);
  }

  async function fetchTerms() {
    const { data } = await supabase.from("terms").select("*").order("start_date");
    setTerms(data || []);
  }

  async function fetchAllClasses() {
    const { data } = await supabase.from("classes").select("*").order("level");
    setAllClasses(data || []);
  }

  async function fetchAvailableStudents() {
    const { data } = await supabase
      .from("students")
      .select("*")
      .is("class_id", null)
      .eq("status", "active")
      .order("first_name");
    setAvailableStudents(data || []);
  }

  async function fetchTimetable() {
    setTimetableLoading(true);
    const { data: entries } = await supabase
      .from("timetable_entries")
      .select(`
        *,
        classes(name, level),
        period_slots(id, day_of_week, period_number, start_time, end_time, is_break),
        subject_classes (
          id,
          subject_code,
          subjects ( name, department, religion ),
          teachers ( first_name, last_name )
        )
      `)
      .eq("class_id", classId)
      .order("day_of_week")
      .order("period_slot_id");

    // Extract unique period slots from entries
    const slots: PeriodSlot[] = [];
    const slotMap = new Map();
    (entries || []).forEach((entry: any) => {
      if (entry.period_slots && !slotMap.has(entry.period_slots.id)) {
        slotMap.set(entry.period_slots.id, entry.period_slots);
      }
    });
    slotMap.forEach((v) => slots.push(v));
    slots.sort((a, b) => {
      if (a.day_of_week === b.day_of_week) return a.period_number - b.period_number;
      return a.day_of_week.localeCompare(b.day_of_week);
    });

    setTimetableEntries(entries || []);
    setPeriodSlots(slots);
    setTimetableLoading(false);
  }

  async function fetchAttendance(date: string) {
    setAttendanceLoading(true);
    const { data: studentsData } = await supabase
      .from("students")
      .select("*")
      .eq("class_id", classId)
      .eq("status", "active")
      .order("first_name");

    const { data: attendanceData } = await supabase
      .from("attendance")
      .select("*")
      .eq("class_id", classId)
      .eq("date", date);

    const studentsWithAttendance: StudentAttendance[] = (studentsData || []).map((student) => {
      const attendance = attendanceData?.find((a) => a.student_id === student.id);
      return {
        ...student,
        attendanceStatus: attendance ? (attendance.status as any) : 'not_marked',
        attendanceId: attendance?.id,
      };
    });

    setAttendanceStudents(studentsWithAttendance);
    setAttendanceLoading(false);
  }

  async function fetchTeachers() {
    const { data } = await supabase.from("teachers").select("id, first_name, last_name").eq("status", "active");
    setTeachers(data || []);
  }

  // 2️⃣ Generate subject code
  function generateSubjectCode(subjectName: string, className: string) {
    const clean = subjectName.replace(/\s+/g, "");
    const prefix = clean.slice(0, 3).toUpperCase();
    return `${prefix}-${className}`;
  }
  // if a subject doesnt have the subject code, generate and assign to all

  // 3️⃣ Generate and assign subject codes for missing ones
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
      fetchClassSubjects(); // Refresh the list
    }
  }

  function openAssignTeacherDialog(sc: SubjectClass) {
    setSelectedSubjectClass(sc);
    setSelectedTeacherId(sc.teacher?.id || "");
    setIsAssignTeacherOpen(true);
  }

  async function handleAssignTeacher() {
    if (!selectedSubjectClass || !selectedTeacherId) return;

    await supabase
      .from("subject_classes")
      .update({ teacher_id: selectedTeacherId })
      .eq("id", selectedSubjectClass.id);

    toast.success("Teacher assigned");
    setIsAssignTeacherOpen(false);
    fetchClassSubjects();
  }

  function handleDeleteSubjectClass(sc: any) {
  if (!confirm(`Remove ${sc.subject.name} from this class?`)) return;
  deleteSubjectClass(sc.id); // your existing function
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

  const filteredSubjects = useMemo(() => {
    return subjects.filter((s) => {
      if (!s.subject) return false;
      if (search && !s.subject.name.toLowerCase().includes(search.toLowerCase())) return false;
      if (filterOptional === "optional" && !s.subject.is_optional) return false;
      if (filterOptional === "compulsory" && s.subject.is_optional) return false;
      if (filterReligion !== "all" && s.subject.religion !== filterReligion) return false;
      if (filterDepartment !== "all" && s.subject.department !== filterDepartment) return false;
      return true;
    });
  }, [subjects, search, filterOptional, filterReligion, filterDepartment]);

  const filteredStudents = useMemo(() => {
    return students.filter((s) => {
      const fullName = `${s.first_name} ${s.last_name}`.toLowerCase();
      if (studentSearch && !fullName.includes(studentSearch.toLowerCase()) && !s.student_id.toLowerCase().includes(studentSearch.toLowerCase())) return false;
      if (studentGenderFilter !== "all" && s.gender !== studentGenderFilter) return false;
      if (studentStatusFilter !== "all" && s.status !== studentStatusFilter) return false;
      return true;
    });
  }, [students, studentSearch, studentGenderFilter, studentStatusFilter]);

  // Student Management Functions
  function handleSelectAllStudents() {
    if (selectedStudents.size === filteredStudents.length) {
      setSelectedStudents(new Set());
    } else {
      setSelectedStudents(new Set(filteredStudents.map(s => s.id)));
    }
  }

  function handleSelectStudent(studentId: string) {
    const newSelected = new Set(selectedStudents);
    if (newSelected.has(studentId)) {
      newSelected.delete(studentId);
    } else {
      newSelected.add(studentId);
    }
    setSelectedStudents(newSelected);
  }

  function handleViewStudent(student: Student) {
    setSelectedStudent(student);
    setIsStudentDetailsOpen(true);
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

  async function handleBulkRemove() {
    if (selectedStudents.size === 0) return;
    if (!confirm(`Remove ${selectedStudents.size} student(s) from this class?`)) return;

    const updates = Array.from(selectedStudents).map(id =>
      supabase.from("students").update({ class_id: null }).eq("id", id)
    );

    const results = await Promise.all(updates);
    const errors = results.filter(r => r.error);

    if (errors.length > 0) {
      toast.error(`Failed to remove ${errors.length} student(s)`);
    } else {
      toast.success(`Removed ${selectedStudents.size} student(s)`);
    }

    setSelectedStudents(new Set());
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

    setIsAddStudentOpen(false);
    fetchStudents();
    fetchAvailableStudents();
  }

  async function handleTransferStudents() {
    if (selectedStudents.size === 0 || !transferTargetClassId) return;
    if (!confirm(`Transfer ${selectedStudents.size} student(s) to the selected class?`)) return;

    const updates = Array.from(selectedStudents).map(id =>
      supabase.from("students").update({ class_id: transferTargetClassId }).eq("id", id)
    );

    const results = await Promise.all(updates);
    const errors = results.filter(r => r.error);

    if (errors.length > 0) {
      toast.error(`Failed to transfer ${errors.length} student(s)`);
    } else {
      toast.success(`Transferred ${selectedStudents.size} student(s)`);
    }

    setSelectedStudents(new Set());
    setIsTransferStudentOpen(false);
    setTransferTargetClassId("");
    fetchStudents();
  }

  function handleExportStudents() {
    const exportData = filteredStudents.map((s, i) => ({
      "#": i + 1,
      "Student ID": s.student_id,
      "First Name": s.first_name,
      "Last Name": s.last_name,
      "Gender": s.gender,
      "Email": s.email,
      "Phone": s.phone,
      "Date of Birth": s.date_of_birth || "",
      "Parent Name": s.parent_name,
      "Parent Email": s.parent_email,
      "Parent Phone": s.parent_phone,
      "Admission Date": s.admission_date,
      "Status": s.status,
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Students");
    XLSX.writeFile(wb, `${classData?.name || "class"}-students.xlsx`);
    toast.success("Students exported successfully");
  }

  function handleImportStudents(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: "array" });
        const worksheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData: any[] = XLSX.utils.sheet_to_json(worksheet);

        // Map imported data to student IDs (assuming Student ID column exists)
        const studentIds = jsonData
          .map(row => row["Student ID"])
          .filter(Boolean);

        if (studentIds.length === 0) {
          toast.error("No valid student IDs found in the file");
          return;
        }

        // Find students by ID and add them to class
        const { data: foundStudents } = await supabase
          .from("students")
          .select("id")
          .in("student_id", studentIds);

        if (!foundStudents || foundStudents.length === 0) {
          toast.error("No matching students found");
          return;
        }

        await handleAddStudentsToClass(foundStudents.map(s => s.id));
      } catch (error) {
        console.error(error);
        toast.error("Failed to import students");
      }
    };
    reader.readAsArrayBuffer(file);
  }

  // Timetable Functions
  async function handleExportTimetablePDF() {
    const element = document.getElementById("class-timetable");
    if (!element) return;

    const canvas = await html2canvas(element, { scale: 2 });
    const img = canvas.toDataURL("image/png");

    const pdf = new jsPDF("l", "mm", "a4");
    const width = pdf.internal.pageSize.getWidth();
    const height = (canvas.height * width) / canvas.width;

    pdf.addImage(img, "PNG", 0, 0, width, height);
    pdf.save(`${classData?.name || "class"}-timetable.pdf`);
    toast.success("Timetable exported as PDF");
  }

  function handleExportTimetableExcel() {
    const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
    const exportData: any[] = [];

    const periodsByDay: Record<string, PeriodSlot[]> = {};
    DAYS.forEach(day => {
      periodsByDay[day] = periodSlots.filter(p => p.day_of_week === day);
    });

    const maxPeriods = Math.max(...Object.values(periodsByDay).map(p => p.length));

    for (let i = 0; i < maxPeriods; i++) {
      const row: any = { Period: `Period ${i + 1}` };
      
      DAYS.forEach(day => {
        const period = periodsByDay[day]?.[i];
        if (!period) {
          row[day] = "";
          return;
        }

        if (period.is_break) {
          row[day] = `BREAK (${period.start_time}-${period.end_time})`;
          return;
        }

        const entry = timetableEntries.find(
          e => e.day_of_week === day && e.period_slot_id === period.id
        );

        if (entry) {
          const teacher = entry.subject_classes?.teachers ? `${entry.subject_classes.teachers.first_name} ${entry.subject_classes.teachers.last_name}` : "";
          row[day] = `${entry.subject_classes?.subjects?.name || ""} - ${teacher}`;
        } else {
          row[day] = "Free Period";
        }
      });

      exportData.push(row);
    }

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Timetable");
    XLSX.writeFile(wb, `${classData?.name || "class"}-timetable.xlsx`);
    toast.success("Timetable exported as Excel");
  }

  // Attendance Functions
  function handleDateChange(date: string) {
    setSelectedDate(date);
    fetchAttendance(date);
  }

  function setToday() {
    const today = new Date().toISOString().split('T')[0];
    setSelectedDate(today);
    fetchAttendance(today);
  }

  function markAllPresent() {
    setAttendanceStudents(prev =>
      prev.map(student => ({
        ...student,
        attendanceStatus: 'present',
      }))
    );
    toast.success('All students marked as present');
  }

  function updateStudentAttendanceStatus(
    studentId: string,
    status: StudentAttendance['attendanceStatus']
  ) {
    setAttendanceStudents(prev =>
      prev.map(student =>
        student.id === studentId ? { ...student, attendanceStatus: status } : student
      )
    );
  }

  async function submitAttendance() {
    setAttendanceLoading(true);
    const savingToast = toast.loading('Saving attendance...');

    try {
      const attendanceRecords = attendanceStudents
        .filter(s => s.attendanceStatus !== 'not_marked')
        .map(student => ({
          student_id: student.id,
          class_id: classId,
          date: selectedDate,
          status: student.attendanceStatus,
          marked_by: null,
        }));

      const existingRecords = attendanceStudents.filter(s => s.attendanceId);

      if (existingRecords.length > 0) {
        const deleteIds = existingRecords.map(s => s.attendanceId).filter(Boolean);
        if (deleteIds.length > 0) {
          await supabase.from('attendance').delete().in('id', deleteIds);
        }
      }

      if (attendanceRecords.length > 0) {
        const { error } = await supabase.from('attendance').insert(attendanceRecords);
        if (error) throw error;
      }

      toast.success('Attendance saved successfully!', { id: savingToast });
      await fetchAttendance(selectedDate);
    } catch (error) {
      toast.error('Failed to save attendance', { id: savingToast });
      console.error(error);
    } finally {
      setAttendanceLoading(false);
    }
  }

  function getFormattedDate(dateString: string) {
    const date = new Date(dateString + 'T00:00:00');
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  }

  async function handleExportAttendance() {
    const exportData = attendanceStudents.map((s, i) => ({
      "#": i + 1,
      "Student ID": s.student_id,
      "Name": `${s.first_name} ${s.last_name}`,
      "Gender": s.gender,
      "Status": s.attendanceStatus.replace('_', ' ').toUpperCase(),
      "Date": selectedDate,
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Attendance");
    XLSX.writeFile(wb, `${classData?.name || "class"}-attendance-${selectedDate}.xlsx`);
    toast.success("Attendance exported successfully");
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
        <Tabs defaultValue="subjects" onValueChange={(value) => {
          if (value === "timetable" && timetableEntries.length === 0) fetchTimetable();
          if (value === "attendance" && attendanceStudents.length === 0) fetchAttendance(selectedDate);
        }}>
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
            <Card>
              <CardHeader>
                <CardTitle className="flex justify-between items-center">
                  <span>Class Subjects</span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={generateMissingSubjectCodes}
                  >
                    Generate Missing Codes
                  </Button>
                </CardTitle>
              </CardHeader>

              <CardContent className="space-y-4">

                {/* ===== FILTER BAR ===== */}
                <div className="flex flex-col md:flex-row gap-3">
                  <div className="relative flex-1">
                    <Search className="h-4 w-4 absolute left-3 top-3 text-muted-foreground" />
                    <Input
                      placeholder="Search subject..."
                      className="pl-9"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                    />
                  </div>

                  <select className="border rounded-md p-2" value={filterOptional} onChange={(e) => setFilterOptional(e.target.value as any)}>
                    <option value="all">All</option>
                    <option value="compulsory">Compulsory</option>
                    <option value="optional">Optional</option>
                  </select>

                  <select className="border rounded-md p-2" value={filterDepartment} onChange={(e) => setFilterDepartment(e.target.value as any)}>
                    <option value="all">All Departments</option>
                    <option value="Science">Science</option>
                    <option value="Arts">Arts</option>
                    <option value="Commercial">Commercial</option>
                  </select>
                </div>

                {/* ===== TABLE ===== */}
                <div className="border rounded-md overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-muted">
                      <tr>
                        <th className="p-3 text-left w-12">#</th>
                        <th className="p-3 text-left">Subject</th>
                        <th className="p-3 text-left">Code</th>
                        <th className="p-3 text-left">Teacher</th>
                        <th className="p-3 text-left">Type</th>
                        <th className="p-3 text-right w-12"></th>

                      </tr>
                    </thead>
                    <tbody>
                      {filteredSubjects.map((sc, i) => (
                        <tr key={sc.id} className="border-t hover:bg-muted/50">
                          <td className="p-3">{i + 1}</td>
                          <td className="p-3 font-medium">
                            <span>{sc.subject.name}</span>
                          </td>
                          <td className="p-3 font-mono flex items-center gap-2">
                            {sc.subject_code}
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => {
                                navigator.clipboard.writeText(sc.subject_code);
                                toast.success("Copied");
                              }}
                            >
                              <Copy className="h-4 w-4" />
                            </Button>
                          </td>
                          <td className="p-3">
                            {sc.teacher ? `${sc.teacher.first_name} ${sc.teacher.last_name}` : "—"}
                          </td>
                          <td className="p-3">
                            {sc.subject?.is_optional ? (
                              <Badge variant="secondary">Optional</Badge>
                            ) : (
                              <Badge>Compulsory</Badge>
                            )}
                          </td>
                          <td className="p-3 text-right">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon">
                                  <MoreVertical className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>

                              <DropdownMenuContent align="end">

                                {/* 📊 View Analysis */}
                                <DropdownMenuItem
                                  onClick={() => router.push(`/admin/subject-classes/${sc.id}/analytics`)}
                                >
                                  <BarChart3 className="mr-2 h-4 w-4" />
                                  View Analysis
                                </DropdownMenuItem>

                                {/* 👨‍🏫 Assign Teacher */}
                                <DropdownMenuItem
                                  onClick={() => openAssignTeacherDialog(sc)}
                                >
                                  <User className="mr-2 h-4 w-4" />
                                  Assign Teacher
                                </DropdownMenuItem>

                                {/* 🗑️ Delete */}
                                <DropdownMenuItem
                                  className="text-red-600 focus:text-red-600"
                                  onClick={() => handleDeleteSubjectClass(sc)}
                                >
                                  <Trash2 className="mr-2 h-4 w-4" />
                                  Delete
                                </DropdownMenuItem>

                              </DropdownMenuContent>
                            </DropdownMenu>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  {filteredSubjects.length === 0 && (
                    <div className="p-8 text-center text-muted-foreground">
                      No subjects match your filters.
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ================= STUDENTS ================= */}
          <TabsContent value="students">
            <Card>
              <CardHeader>
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                  <CardTitle>Class Students ({students.length})</CardTitle>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleExportStudents}
                    >
                      <Download className="h-4 w-4 mr-1" />
                      Export
                    </Button>
                    <label>
                      <Button size="sm" variant="outline" asChild>
                        <span>
                          <Upload className="h-4 w-4 mr-1" />
                          Import
                        </span>
                      </Button>
                      <input
                        type="file"
                        accept=".xlsx,.xls"
                        className="hidden"
                        onChange={handleImportStudents}
                      />
                    </label>
                    <Button
                      size="sm"
                      onClick={() => setIsAddStudentOpen(true)}
                    >
                      <UserPlus className="h-4 w-4 mr-1" />
                      Add Students
                    </Button>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="space-y-4">
                {/* Search and Filters */}
                <div className="flex flex-col md:flex-row gap-3">
                  <div className="relative flex-1">
                    <Search className="h-4 w-4 absolute left-3 top-3 text-muted-foreground" />
                    <Input
                      placeholder="Search by name or student ID..."
                      className="pl-9"
                      value={studentSearch}
                      onChange={(e) => setStudentSearch(e.target.value)}
                    />
                  </div>
                  <select
                    className="border rounded-md p-2"
                    value={studentGenderFilter}
                    onChange={(e) => setStudentGenderFilter(e.target.value as any)}
                  >
                    <option value="all">All Genders</option>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                  </select>
                  <select
                    className="border rounded-md p-2"
                    value={studentStatusFilter}
                    onChange={(e) => setStudentStatusFilter(e.target.value as any)}
                  >
                    <option value="all">All Status</option>
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>

                {/* Bulk Actions */}
                {selectedStudents.size > 0 && (
                  <div className="flex items-center gap-2 p-3 bg-blue-50 rounded-md">
                    <span className="text-sm font-medium">
                      {selectedStudents.size} selected
                    </span>
                    <div className="flex gap-2 ml-auto">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setIsTransferStudentOpen(true)}
                      >
                        <ArrowRightLeft className="h-4 w-4 mr-1" />
                        Transfer
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={handleBulkRemove}
                      >
                        <UserMinus className="h-4 w-4 mr-1" />
                        Remove from Class
                      </Button>
                    </div>
                  </div>
                )}

                {/* Students Table */}
                <div className="border rounded-md overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-muted">
                      <tr>
                        <th className="p-3 w-12">
                          <input
                            type="checkbox"
                            checked={selectedStudents.size === filteredStudents.length && filteredStudents.length > 0}
                            onChange={handleSelectAllStudents}
                            className="cursor-pointer"
                          />
                        </th>
                        <th className="p-3 text-left w-12">#</th>
                        <th className="p-3 text-left">Student ID</th>
                        <th className="p-3 text-left">Name</th>
                        <th className="p-3 text-left">Gender</th>
                        <th className="p-3 text-left">Email</th>
                        <th className="p-3 text-left">Status</th>
                        <th className="p-3 text-right w-12"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredStudents.map((student, i) => (
                        <tr key={student.id} className="border-t hover:bg-muted/50">
                          <td className="p-3">
                            <input
                              type="checkbox"
                              checked={selectedStudents.has(student.id)}
                              onChange={() => handleSelectStudent(student.id)}
                              className="cursor-pointer"
                            />
                          </td>
                          <td className="p-3">{i + 1}</td>
                          <td className="p-3 font-mono text-xs">{student.student_id}</td>
                          <td className="p-3 font-medium">
                            {student.first_name} {student.last_name}
                          </td>
                          <td className="p-3 capitalize">{student.gender}</td>
                          <td className="p-3 text-xs">{student.email}</td>
                          <td className="p-3">
                            <Badge variant={student.status === "active" ? "default" : "secondary"}>
                              {student.status}
                            </Badge>
                          </td>
                          <td className="p-3 text-right">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon">
                                  <MoreVertical className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => handleViewStudent(student)}>
                                  <User className="mr-2 h-4 w-4" />
                                  View Details
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  className="text-red-600 focus:text-red-600"
                                  onClick={() => handleRemoveStudent(student.id)}
                                >
                                  <UserMinus className="mr-2 h-4 w-4" />
                                  Remove from Class
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  {filteredStudents.length === 0 && (
                    <div className="p-8 text-center text-muted-foreground">
                      {studentSearch || studentGenderFilter !== "all" || studentStatusFilter !== "all"
                        ? "No students match your filters."
                        : "No students in this class yet."}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ================= TIMETABLE TAB ================= */}
          <TabsContent value="timetable">
            <Card>
              <CardHeader>
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                  <CardTitle>Class Timetable</CardTitle>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleExportTimetablePDF}
                      disabled={timetableLoading}
                    >
                      <FileDown className="h-4 w-4 mr-1" />
                      Export PDF
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleExportTimetableExcel}
                      disabled={timetableLoading}
                    >
                      <Download className="h-4 w-4 mr-1" />
                      Export Excel
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {timetableLoading ? (
                  <div className="text-center py-8 text-gray-500">Loading timetable...</div>
                ) : (
                  <div className="overflow-x-auto border rounded-lg" id="class-timetable">
                    <table className="w-full border-collapse">
                      <thead>
                        <tr className="bg-gray-100">
                          <th className="border border-gray-300 p-3 font-semibold text-gray-700 min-w-[100px]">
                            Period
                          </th>
                          {["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"].map((day) => (
                            <th key={day} className="border border-gray-300 p-3 font-semibold text-gray-700 min-w-[180px]">
                              {day}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {(() => {
                          const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
                          // Group period slots by day
                          const periodsByDay: Record<string, PeriodSlot[]> = {};
                          DAYS.forEach(day => {
                            periodsByDay[day] = periodSlots.filter(p => p.day_of_week === day);
                          });
                          const maxPeriods = Math.max(...Object.values(periodsByDay).map(p => p.length), 0);

                          return Array.from({ length: maxPeriods }, (_, i) => (
                            <tr key={i}>
                              <td className="border border-gray-300 p-3 bg-gray-50 text-center font-medium">
                                Period {i + 1}
                              </td>
                              {DAYS.map((day) => {
                                const period = periodsByDay[day]?.[i];
                                if (!period) {
                                  return (
                                    <td key={day} className="border border-gray-300 p-3 text-center text-gray-400">
                                      —
                                    </td>
                                  );
                                }

                                if (period.is_break) {
                                  return (
                                    <td key={day} className="border border-gray-300 p-3 bg-yellow-50">
                                      <div className="text-center">
                                        <div className="font-semibold text-yellow-800">BREAK</div>
                                        <div className="text-xs text-gray-600 mt-1">
                                          {period.start_time} - {period.end_time}
                                        </div>
                                      </div>
                                    </td>
                                  );
                                }

                                // Find entry for this period slot
                                const entry = timetableEntries.find(
                                  e => e.period_slot_id === period.id
                                );

                                if (entry && entry.subject_classes) {
                                  const subj = entry.subject_classes.subjects;
                                  const teacher = entry.subject_classes.teachers;
                                  return (
                                    <td key={day} className="border border-gray-300 p-3">
                                      <div className="space-y-1">
                                        <div className="text-xs text-gray-600 text-center">
                                          {period.start_time} - {period.end_time}
                                        </div>
                                        <div className="font-semibold text-gray-800 text-center">
                                          {subj?.name || "—"}
                                        </div>
                                        <div className="text-xs text-gray-600 text-center">
                                          {teacher ? `${teacher.first_name} ${teacher.last_name}` : "No teacher"}
                                        </div>
                                      </div>
                                    </td>
                                  );
                                }

                                return (
                                  <td key={day} className="border border-gray-300 p-3">
                                    <div className="text-gray-400 text-center py-2">
                                      <span className="text-xs">Free Period</span>
                                    </div>
                                  </td>
                                );
                              })}
                            </tr>
                          ));
                        })()}
                      </tbody>
                    </table>
                    {periodSlots.length === 0 && (
                      <div className="p-8 text-center text-muted-foreground">
                        No timetable configured yet. Please set up period slots and entries in the Timetable Management page.
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ================= ATTENDANCE TAB ================= */}
          <TabsContent value="attendance">
            <Card>
              <CardHeader>
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                  <CardTitle>Class Attendance</CardTitle>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleExportAttendance}
                      disabled={attendanceLoading}
                    >
                      <Download className="h-4 w-4 mr-1" />
                      Export
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Date Selection and Quick Actions */}
                <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pb-4 border-b">
                  <div className="flex-1">
                    <Label className="block text-sm font-medium mb-2">Select Date</Label>
                    <div className="flex gap-2">
                      <Input
                        type="date"
                        value={selectedDate}
                        onChange={(e) => handleDateChange(e.target.value)}
                        className="flex-1"
                      />
                      <Button variant="outline" onClick={setToday}>
                        Today
                      </Button>
                    </div>
                    <p className="text-sm text-gray-600 mt-1">{getFormattedDate(selectedDate)}</p>
                  </div>

                  <div>
                    <Label className="block text-sm font-medium mb-2">Quick Actions</Label>
                    <Button onClick={markAllPresent} variant="outline" disabled={attendanceLoading}>
                      Mark All Present
                    </Button>
                  </div>
                </div>

                {/* Attendance List */}
                {attendanceLoading ? (
                  <div className="text-center py-8 text-gray-500">Loading attendance data...</div>
                ) : (
                  <div className="space-y-2">
                    <div className="grid grid-cols-12 gap-4 px-4 py-2 bg-gray-50 rounded-lg font-medium text-sm">
                      <div className="col-span-1">#</div>
                      <div className="col-span-4">Student Name</div>
                      <div className="col-span-2">Gender</div>
                      <div className="col-span-2">Status</div>
                      <div className="col-span-3">Action</div>
                    </div>

                    {attendanceStudents.map((student, index) => {
                      const statusColors = {
                        present: 'bg-green-100 text-green-800',
                        absent: 'bg-red-100 text-red-800',
                        late: 'bg-yellow-100 text-yellow-800',
                        excused: 'bg-blue-100 text-blue-800',
                        not_marked: 'bg-gray-100 text-gray-800',
                      };

                      return (
                        <div
                          key={student.id}
                          className="grid grid-cols-12 gap-4 px-4 py-3 border rounded-lg items-center hover:bg-gray-50"
                        >
                          <div className="col-span-1 text-gray-600">{index + 1}</div>
                          <div className="col-span-4">
                            <p className="font-medium">
                              {student.first_name} {student.last_name}
                            </p>
                            <p className="text-xs text-gray-500">{student.student_id}</p>
                          </div>
                          <div className="col-span-2 text-sm text-gray-600 capitalize">
                            {student.gender || 'N/A'}
                          </div>
                          <div className="col-span-2">
                            <span
                              className={`inline-block px-2 py-1 rounded text-xs font-medium ${
                                statusColors[student.attendanceStatus]
                              }`}
                            >
                              {student.attendanceStatus.replace('_', ' ').toUpperCase()}
                            </span>
                          </div>
                          <div className="col-span-3">
                            <select
                              value={student.attendanceStatus}
                              onChange={(e) =>
                                updateStudentAttendanceStatus(
                                  student.id,
                                  e.target.value as StudentAttendance['attendanceStatus']
                                )
                              }
                              className="w-full px-2 py-1.5 border rounded text-sm"
                            >
                              <option value="not_marked">Not Marked</option>
                              <option value="present">Present</option>
                              <option value="absent">Absent</option>
                              <option value="late">Late</option>
                              <option value="excused">Excused</option>
                            </select>
                          </div>
                        </div>
                      );
                    })}

                    {attendanceStudents.length === 0 && (
                      <div className="text-center py-8 text-gray-500">
                        No students found in this class
                      </div>
                    )}
                  </div>
                )}

                {/* Save Button */}
                {attendanceStudents.length > 0 && (
                  <div className="flex gap-2 pt-4 border-t">
                    <Button
                      onClick={submitAttendance}
                      disabled={attendanceLoading}
                      className="flex-1"
                    >
                      Save Attendance
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="results">
            <Card><CardContent className="p-6">Results coming soon</CardContent></Card>
          </TabsContent>

          <TabsContent value="settings">
            <Card><CardContent className="p-6">Settings coming soon</CardContent></Card>
          </TabsContent>

        </Tabs>
      </div>

      {/* ================= ASSIGN TEACHER DIALOG ================= */}
      <Dialog open={isAssignTeacherOpen} onOpenChange={setIsAssignTeacherOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign Teacher to {selectedSubjectClass?.subject.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <select
              className="w-full border rounded-md p-2"
              value={selectedTeacherId}
              onChange={(e) => setSelectedTeacherId(e.target.value)}
            >
              <option value="">Select teacher</option>
              {teachers.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.first_name} {t.last_name}
                </option>
              ))}
            </select>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setIsAssignTeacherOpen(false)}>Cancel</Button>
              <Button onClick={handleAssignTeacher}>Save</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ================= ADD STUDENTS DIALOG ================= */}
      <Dialog open={isAddStudentOpen} onOpenChange={setIsAddStudentOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add Students to {classData?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Select students from the unassigned list below:
            </p>
            
            {availableStudents.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">
                No unassigned students available.
              </div>
            ) : (
              <div className="border rounded-md">
                <div className="max-h-96 overflow-y-auto">
                  {availableStudents.map((student) => {
                    const isSelected = selectedStudents.has(student.id);
                    return (
                      <div
                        key={student.id}
                        className={`p-3 border-b hover:bg-muted/50 cursor-pointer flex items-center gap-3 ${
                          isSelected ? "bg-blue-50" : ""
                        }`}
                        onClick={() => handleSelectStudent(student.id)}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleSelectStudent(student.id)}
                          className="cursor-pointer"
                        />
                        <div className="flex-1">
                          <p className="font-medium">
                            {student.first_name} {student.last_name}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {student.student_id} • {student.email}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="flex justify-between items-center">
              <p className="text-sm text-muted-foreground">
                {selectedStudents.size} student(s) selected
              </p>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => {
                  setIsAddStudentOpen(false);
                  setSelectedStudents(new Set());
                }}>Cancel</Button>
                <Button
                  onClick={() => handleAddStudentsToClass(Array.from(selectedStudents))}
                  disabled={selectedStudents.size === 0}
                >
                  Add {selectedStudents.size > 0 && `(${selectedStudents.size})`}
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ================= TRANSFER STUDENTS DIALOG ================= */}
      <Dialog open={isTransferStudentOpen} onOpenChange={setIsTransferStudentOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Transfer Students</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Transfer {selectedStudents.size} student(s) to another class:
            </p>
            
            <select
              className="w-full border rounded-md p-2"
              value={transferTargetClassId}
              onChange={(e) => setTransferTargetClassId(e.target.value)}
            >
              <option value="">Select target class</option>
              {allClasses
                .filter(c => c.id !== classId)
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} - {c.level}
                  </option>
                ))}
            </select>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => {
                setIsTransferStudentOpen(false);
                setTransferTargetClassId("");
              }}>Cancel</Button>
              <Button
                onClick={handleTransferStudents}
                disabled={!transferTargetClassId}
              >
                Transfer
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ================= STUDENT DETAILS MODAL ================= */}
      <StudentDetailsModal
        student={selectedStudent}
        sessions={sessions}
        terms={terms}
        isOpen={isStudentDetailsOpen}
        onClose={() => {
          setIsStudentDetailsOpen(false);
          setSelectedStudent(null);
        }}
        onNext={() => {
          if (!selectedStudent) return;
          const currentIndex = filteredStudents.findIndex(s => s.id === selectedStudent.id);
          if (currentIndex < filteredStudents.length - 1) {
            setSelectedStudent(filteredStudents[currentIndex + 1]);
          }
        }}
        onPrevious={() => {
          if (!selectedStudent) return;
          const currentIndex = filteredStudents.findIndex(s => s.id === selectedStudent.id);
          if (currentIndex > 0) {
            setSelectedStudent(filteredStudents[currentIndex - 1]);
          }
        }}
      />
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
