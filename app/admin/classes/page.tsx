"use client";

import { DashboardLayout } from "@/components/dashboard-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Plus, Search, Edit, Trash2, Users, BookOpen, User } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Class, Teacher } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import Link from "next/link";

const EDUCATION_LEVELS = {
  "Pre-Primary": ["Nursery 1", "Nursery 2", "KG 1", "KG 2"],
  Primary: ["Primary 1", "Primary 2", "Primary 3", "Primary 4", "Primary 5", "Primary 6"],
  JSS: ["JSS 1", "JSS 2", "JSS 3"],
  SSS: ["SSS 1", "SSS 2", "SSS 3"],
};

export default function ClassesPage() {
  const [classes, setClasses] = useState<Class[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingClass, setEditingClass] = useState<Class | null>(null);
  const [stream, setStream] = useState("");

  const [selectedEducationLevel, setSelectedEducationLevel] = useState("");
  const [selectedLevel, setSelectedLevel] = useState("");
  const [filterLevel, setFilterLevel] = useState("");

  useEffect(() => {
    fetchClasses();
    fetchTeachers();
  }, []);

  async function fetchClasses() {
    const { data } = await supabase
      .from("classes")
      .select(`
    *,
    teacher:teachers(first_name, last_name)
  `)
      .order("level");

    if (data) {
      const classesWithStats = await Promise.all(
        data.map(async (cls) => {
          const [studentsRes, subjectsRes] = await Promise.all([
            supabase.from("students").select("id", { count: "exact" }).eq("class_id", cls.id),
            supabase.from("subject_classes").select("id", { count: "exact" }).eq("class_id", cls.id),
          ]);


          const teacher = cls.teacher;


          return {
            ...cls,
            studentCount: studentsRes.count || 0,
            subjectCount: subjectsRes.count || 0,
            teacherName: teacher ? `${teacher.first_name} ${teacher.last_name}` : undefined,
          };
        })
      );
      setClasses(classesWithStats);
    }
  }

  async function fetchTeachers() {
    const { data } = await supabase
      .from("teachers")
      .select("*")
      .eq("status", "active")
      .order("first_name");

    if (data) setTeachers(data);
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (!selectedLevel) {
      toast.error("Please select a class level");
      return;
    }

    if (!selectedEducationLevel) {
      toast.error("Please select an education level");
      return;
    }

    const formData = new FormData(e.currentTarget);

    const normalizedStream = stream.trim() || null;

    const className = normalizedStream
      ? `${selectedLevel} ${normalizedStream}`
      : selectedLevel;

    const classData: any = {
      level: selectedLevel,
      name: className,
      education_level: selectedEducationLevel,
      class_teacher_id: formData.get("class_teacher_id") as string || null,
    };

    if (editingClass) {
      const { error } = await supabase
        .from("classes")
        .update(classData)
        .eq("id", editingClass.id);

      if (error) toast.error("Failed to update class");
      else {
        toast.success("Class updated");
        closeDialog();
        fetchClasses();
      }
    } else {
      const exists = classes.some(
        c =>
          c.education_level === selectedEducationLevel &&
          c.level === selectedLevel
      );
      if (exists) {
        toast.error("This class already exists");
        return;
      }

      const { error } = await supabase.from("classes").insert(classData);

      if (error) toast.error("Failed to create class");
      else {
        toast.success("Class created");
        closeDialog();
        fetchClasses();
      }
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Are you sure you want to delete this class?")) return;

    const { error } = await supabase.from("classes").delete().eq("id", id);

    if (error) toast.error("Failed to delete class");
    else {
      toast.success("Class deleted");
      fetchClasses();
    }
  }
  function openEditDialog(cls: Class) {
    setEditingClass(cls);
    setSelectedEducationLevel(cls.education_level);
    setSelectedLevel(cls.level);
    setStream(cls.stream || "");
    setIsDialogOpen(true);
  }

  function closeDialog() {
    setIsDialogOpen(false);
    setEditingClass(null);
    setSelectedEducationLevel("");
    setSelectedLevel("");
    setStream("");
  }

  const filteredClasses = classes.filter((cls) => {
    const matchesSearch =
      cls.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      cls.level.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFilter = !filterLevel || cls.level === filterLevel;
    return matchesSearch && matchesFilter;
  });

  const groupedClasses = filteredClasses.reduce((acc, cls) => {
    const educationLevel =
      Object.keys(EDUCATION_LEVELS).find((key) =>
        EDUCATION_LEVELS[key as keyof typeof EDUCATION_LEVELS].includes(cls.level)
      ) || "Other";

    if (!acc[educationLevel]) acc[educationLevel] = [];
    acc[educationLevel].push(cls);
    return acc;
  }, {} as Record<string, Class[]>);

  return (
    <DashboardLayout role="admin">
      <div className="space-y-8">
        {/* HEADER */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Classes</h1>
            <p className="text-gray-600">Manage all classes in the school</p>
          </div>

          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => setEditingClass(null)}>
                <Plus className="mr-2 h-4 w-4" />
                Add Class
              </Button>
            </DialogTrigger>

            <DialogContent className="max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editingClass ? "Edit Class" : "Add Class"}</DialogTitle>
              </DialogHeader>

              <form onSubmit={handleSubmit} className="space-y-4">
                {/* EDUCATION LEVEL */}
                <div>
                  <Label>Education Level</Label>
                  <select
                    value={selectedEducationLevel}
                    onChange={(e) => {
                      setSelectedEducationLevel(e.target.value);
                      setSelectedLevel("");
                    }}
                    className="w-full px-3 py-2 border rounded-md"
                    required
                  >
                    <option value="">Select</option>
                    {Object.keys(EDUCATION_LEVELS).map((lvl) => (
                      <option key={lvl}>{lvl}</option>
                    ))}
                  </select>
                </div>

                {/* CLASS LEVEL */}
                {selectedEducationLevel && (
                  <div>
                    <Label>Class Level</Label>
                    <select
                      value={selectedLevel}
                      onChange={(e) => setSelectedLevel(e.target.value)}
                      className="w-full px-3 py-2 border rounded-md"
                      required
                    >
                      <option value="">Select Level</option>
                      {EDUCATION_LEVELS[
                        selectedEducationLevel as keyof typeof EDUCATION_LEVELS
                      ].map((level) => (
                        <option key={level}>{level}</option>
                      ))}
                    </select>
                  </div>
                )}

                <div>
                  <Label>Stream (optional)</Label>
                  <Input
                    placeholder="A, B, C"
                    value={stream}
                    onChange={(e) => setStream(e.target.value.toUpperCase())}
                  />
                </div>


                {/* CLASS TEACHER */}
                <div>
                  <Label>Class Teacher</Label>
                  <select
                    name="class_teacher_id"
                    className="w-full px-3 py-2 border rounded-md"
                    defaultValue={editingClass?.class_teacher_id || ""}
                  >
                    <option value="">None</option>
                    {teachers.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.first_name} {t.last_name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex gap-2">
                  <Button type="submit" className="flex-1">
                    {editingClass ? "Update" : "Create"}
                  </Button>
                  <Button variant="outline" type="button" onClick={closeDialog}>
                    Cancel
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* SEARCH & FILTER */}
        <Card>
          <CardHeader>
            <CardTitle>Search & Filters</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search classes..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>

              <select
                value={filterLevel}
                onChange={(e) => setFilterLevel(e.target.value)}
                className="px-3 py-2 border rounded-md"
              >
                <option value="">All Levels</option>
                {Object.entries(EDUCATION_LEVELS).map(([group, levels]) => (
                  <optgroup key={group} label={group}>
                    {levels.map((level) => (
                      <option key={level} value={level}>
                        {level}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </div>
          </CardContent>
        </Card>

        {/* CLASS LIST */}
        {Object.keys(groupedClasses).map((group) => (
          <Card key={group}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                {group}
                <Badge variant="outline">
                  {groupedClasses[group].length} classes
                </Badge>
              </CardTitle>
            </CardHeader>

            <CardContent>
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {groupedClasses[group].map((cls) => (
                  <Card key={cls.id} className="hover:shadow-lg transition">
                    <CardContent className="p-6">
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex-1">
                          <h3 className="font-semibold text-lg">{cls.name}</h3>

                          <div className="flex gap-2 mt-2">
                            <Badge>{cls.level}</Badge>
                            {cls.stream && <Badge variant="secondary">{cls.stream}</Badge>}
                          </div>

                          <div className="text-sm mt-3 space-y-1 text-gray-600">
                            {cls.teacherName && (
                              <div className="flex items-center gap-2">
                                <User className="h-4 w-4" />
                                {cls.teacherName}
                              </div>
                            )}

                            <div className="flex items-center gap-2">
                              <Users className="h-4 w-4" />
                              {cls.studentCount}/{cls.capacity} students
                            </div>

                            <div className="flex items-center gap-2">
                              <BookOpen className="h-4 w-4" />
                              {cls.subjectCount} subjects
                            </div>
                          </div>
                        </div>
                        <Link href={`/admin/classes/${cls.id}/subjects`}>
                          <Button size="sm" variant="outline">
                            Subjects
                          </Button>
                        </Link>

                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" onClick={() => openEditDialog(cls)}>
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDelete(cls.id)}
                          >
                            <Trash2 className="h-4 w-4 text-red-600" />
                          </Button>
                        </div>
                      </div>

                      {/* Progress Bar */}
                      <div className="w-full bg-gray-200 rounded-full h-2 mt-4">
                        <div
                          className="bg-blue-600 h-2 rounded-full"
                          style={{
                            width: `${Math.min(
                              ((cls.studentCount ?? 0) / (cls.capacity ?? 30)) * 100,
                              100
                            )}%`,
                          }}
                        />
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </DashboardLayout>
  );
}
