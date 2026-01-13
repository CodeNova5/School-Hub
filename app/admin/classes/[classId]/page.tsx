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

import { MoreHorizontal, Trash2, User, BarChart3 } from "lucide-react";
import { useRouter } from "next/navigation";


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

type Student = {
  id: string;
  first_name: string;
  last_name: string;
};

type Teacher = {
  id: string;
  first_name: string;
  last_name: string;
};

export default function ClassPage() {
  const router = useRouter();
  const params = useParams();
  const classId = params.classId as string;

  const [subjects, setSubjects] = useState<SubjectClass[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [classData, setClassData] = useState<ClassData | null>(null);

  const [loading, setLoading] = useState(true);
  const [subjectsLoading, setSubjectsLoading] = useState(false);
  const [studentsLoading, setStudentsLoading] = useState(false);

  const [isAssignTeacherOpen, setIsAssignTeacherOpen] = useState(false);
  const [selectedSubjectClass, setSelectedSubjectClass] = useState<SubjectClass | null>(null);
  const [selectedTeacherId, setSelectedTeacherId] = useState<string>("");

  // Filters
  const [search, setSearch] = useState("");
  const [filterOptional, setFilterOptional] = useState<"all" | "optional" | "compulsory">("all");
  const [filterReligion, setFilterReligion] = useState<"all" | "Christian" | "Muslim">("all");
  const [filterDepartment, setFilterDepartment] = useState<"all" | "Science" | "Arts" | "Commercial">("all");
  useEffect(() => {
    fetchClass();
    fetchTeachers();
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
    const { data } = await supabase.from("students").select("id, first_name, last_name").eq("class_id", classId);
    setStudents(data || []);
    setStudentsLoading(false);
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
                <CardTitle>Class Students</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="border rounded-md overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-muted">
                      <tr>
                        <th className="p-3 text-left w-12">#</th>
                        <th className="p-3 text-left">First Name</th>
                        <th className="p-3 text-left">Last Name</th>
                        <th className="p-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {students.map((student, i) => (
                        <tr key={student.id} className="border-t hover:bg-muted/50">
                          <td className="p-3">{i + 1}</td>
                          <td className="p-3 font-medium">{student.first_name}</td>
                          <td className="p-3">{student.last_name}</td>
                          <td className="p-3 text-right">
                            <Button size="sm" variant="outline">View</Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  {students.length === 0 && (
                    <div className="p-8 text-center text-muted-foreground">
                      No students in this class yet.
                    </div>
                  )}
                </div>
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
