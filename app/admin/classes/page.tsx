"use client";

import { DashboardLayout } from "@/components/dashboard-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Plus, Search, Edit, Trash2, Users, BookOpen, User } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useSchoolContext } from "@/hooks/use-school-context";
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
  const { schoolId, isLoading: schoolLoading, error: schoolError } = useSchoolContext();
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
    if (schoolId) {
      fetchClasses();
      fetchTeachers();
    }
  }, [schoolId]);


  async function fetchClasses() {
    if (!schoolId) return;
    try {
      const { data, error } = await supabase
        .from("classes")
        .select("*")
        .eq("school_id", schoolId)
        .order("level", { ascending: true });

      if (error) {
        console.error("Error fetching classes:", error);
        toast.error("Failed to fetch classes");
        return;
      }

      const classesWithStats = await Promise.all(
        (data || []).map(async (cls: any) => {
          let teacherName: string | undefined = undefined;

          if (cls.class_teacher_id) {
            const { data: teacher } = await supabase
              .from("teachers")
              .select("first_name, last_name")
              .eq("school_id", schoolId)
              .eq("id", cls.class_teacher_id)
              .single();

            if (teacher) {
              teacherName = `${teacher.first_name} ${teacher.last_name}`;
            }
          }

          const [studentsRes, subjectsRes] = await Promise.all([
            supabase.from("students").select("id", { count: "exact" }).eq("school_id", schoolId).eq("class_id", cls.id),
            supabase.from("subject_classes").select("id", { count: "exact" }).eq("school_id", schoolId).eq("class_id", cls.id),
          ]);

          return {
            ...cls,
            studentCount: studentsRes.count || 0,
            subjectCount: subjectsRes.count || 0,
            teacherName,
          };
        })
      );
      setClasses(classesWithStats);
    } catch (error) {
      console.error("Error fetching classes:", error);
      toast.error("Failed to fetch classes");
    }
  }

  async function fetchTeachers() {
    if (!schoolId) return;
    try {
      const { data, error } = await supabase
        .from("teachers")
        .select("*")
        .eq("school_id", schoolId)
        .eq("status", "active")
        .order("first_name", { ascending: true });

      if (error) {
        console.error("Error fetching teachers:", error);
        toast.error("Failed to fetch teachers");
        return;
      }

      setTeachers(data || []);
    } catch (error) {
      console.error("Error fetching teachers:", error);
      toast.error("Failed to fetch teachers");
    }
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

    const normalizedStream = stream.trim() || ""; // Normalize stream to an empty string if not provided

    const className = normalizedStream
      ? `${selectedLevel} ${normalizedStream}`
      : selectedLevel;

    const classData: any = {
      school_id: schoolId,
      level: selectedLevel,
      name: className,
      education_level: selectedEducationLevel,
      stream: normalizedStream || null,
      class_teacher_id: (formData.get("class_teacher_id") as string) || null,
    };

      try {
        if (editingClass) {
          const { error } = await supabase
            .from("classes")
            .update(classData)
            .eq("school_id", schoolId)
            .eq("id", editingClass.id);

          if (error) throw new Error(error.message);

          toast.success("Class updated");
          closeDialog();
          fetchClasses();
        } else {
          // Check if class already exists
          const exists = classes.some(
            c =>
              c.education_level === selectedEducationLevel &&
              c.level === selectedLevel &&
              c.stream === normalizedStream
          );
          if (exists) {
            toast.error("This class already exists");
            return;
          }

          const { error } = await supabase
            .from("classes")
            .insert(classData);

          if (error) throw new Error(error.message);

          toast.success("Class created");
          closeDialog();
          fetchClasses();
        }
      } catch (error: any) {
      console.error("Error:", error);
      toast.error(error.message || "Failed to save class");
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Are you sure you want to delete this class?")) return;

    try {
      const { error } = await supabase
        .from("classes")
        .delete()
        .eq("school_id", schoolId)
        .eq("id", id);

      if (error) throw new Error(error.message);

      toast.success("Class deleted");
      fetchClasses();
    } catch (error: any) {
      console.error("Error:", error);
      toast.error(error.message || "Failed to delete class");
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
      {schoolLoading && (
        <div className="flex items-center justify-center h-96">
          <p className="text-gray-500">Loading classes...</p>
        </div>
      )}

      {schoolError || !schoolId ? (
        <div className="flex items-center justify-center h-96">
          <div className="text-center">
            <p className="text-red-600 font-semibold">{schoolError || 'Unable to determine your school'}</p>
            <p className="text-gray-600 text-sm mt-2">Please contact your administrator or try logging in again.</p>
          </div>
        </div>
      ) : (
      <div className="space-y-8">
        {/* HEADER */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">Classes</h1>
            <p className="text-gray-500 mt-2">Manage and organize all classes efficiently</p>
          </div>

          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => setEditingClass(null)} className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white px-6 py-2 rounded-lg shadow-lg hover:shadow-xl transition-all duration-300">
                <Plus className="mr-2 h-5 w-5" />
                Add Class
              </Button>
            </DialogTrigger>

            <DialogContent className="max-h-[90vh] overflow-y-auto border-0 shadow-2xl">
              <DialogHeader>
                <DialogTitle className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">{editingClass ? "Edit Class" : "Create New Class"}</DialogTitle>
              </DialogHeader>

              <form onSubmit={handleSubmit} className="space-y-6">
                {/* EDUCATION LEVEL */}
                <div>
                  <Label className="text-sm font-semibold text-gray-700">Education Level</Label>
                  <select
                    value={selectedEducationLevel}
                    onChange={(e) => {
                      setSelectedEducationLevel(e.target.value);
                      setSelectedLevel("");
                    }}
                    className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                    required
                  >
                    <option value="">Select an education level</option>
                    {Object.keys(EDUCATION_LEVELS).map((lvl) => (
                      <option key={lvl}>{lvl}</option>
                    ))}
                  </select>
                </div>

                {/* CLASS LEVEL */}
                {selectedEducationLevel && (
                  <div>
                    <Label className="text-sm font-semibold text-gray-700">Class Level</Label>
                    <select
                      value={selectedLevel}
                      onChange={(e) => setSelectedLevel(e.target.value)}
                      className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                      required
                    >
                      <option value="">Select a level</option>
                      {EDUCATION_LEVELS[
                        selectedEducationLevel as keyof typeof EDUCATION_LEVELS
                      ].map((level) => (
                        <option key={level}>{level}</option>
                      ))}
                    </select>
                  </div>
                )}

                <div>
                  <Label className="text-sm font-semibold text-gray-700">Stream (Optional)</Label>
                  <Input
                    placeholder="e.g., A, B, C"
                    value={stream}
                    onChange={(e) => setStream(e.target.value.toUpperCase())}
                    className="px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  />
                </div>

                {/* CLASS TEACHER */}
                <div>
                  <Label className="text-sm font-semibold text-gray-700">Class Teacher</Label>
                  <select
                    name="class_teacher_id"
                    className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                    defaultValue={editingClass?.class_teacher_id || ""}
                  >
                    <option value="">Select a teacher</option>
                    {teachers.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.first_name} {t.last_name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex gap-3 pt-4">
                  <Button type="submit" className="flex-1 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white py-2 rounded-lg font-semibold transition-all duration-300">
                    {editingClass ? "Update Class" : "Create Class"}
                  </Button>
                  <Button variant="outline" type="button" onClick={closeDialog} className="flex-1 border-gray-300 hover:bg-gray-50">
                    Cancel
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* SEARCH & FILTER */}
        <Card className="border-0 shadow-md bg-white">
          <CardHeader className="pb-4 border-b border-gray-100">
            <CardTitle className="text-lg font-semibold text-gray-800">Search & Filter</CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="relative">
                <Search className="absolute left-4 top-3.5 h-5 w-5 text-blue-400" />
                <Input
                  placeholder="Search by class name or level..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-12 border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <select
                value={filterLevel}
                onChange={(e) => setFilterLevel(e.target.value)}
                className="px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
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
        {Object.keys(groupedClasses).length > 0 ? (
          Object.keys(groupedClasses).map((group) => (
            <div key={group}>
              <div className="mb-6">
                <div className="flex items-center gap-3">
                  <div className="h-1 w-1 rounded-full bg-gradient-to-r from-blue-600 to-indigo-600"></div>
                  <h2 className="text-2xl font-bold text-gray-800">{group}</h2>
                  <Badge className="bg-blue-100 text-blue-700 font-semibold">
                    {groupedClasses[group].length} class{groupedClasses[group].length !== 1 ? 'es' : ''}
                  </Badge>
                </div>
              </div>

              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {groupedClasses[group].map((cls) => (
                  <div key={cls.id} className="group relative bg-white rounded-2xl shadow-md hover:shadow-2xl transition-all duration-500 overflow-hidden border border-gray-100">
                    {/* Gradient Background */}
                    <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-blue-50 to-indigo-50 rounded-full -mr-8 -mt-8 group-hover:scale-150 transition-transform duration-500"></div>
                    
                    <div className="relative p-6 z-10">
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold text-sm">
                              {cls.level.split(' ')[1]?.[0] || cls.level[0]}
                            </div>
                            <h3 className="font-bold text-lg text-gray-800">{cls.name}</h3>
                          </div>

                          <div className="flex gap-2 mt-3 flex-wrap">
                            <Badge className="bg-gradient-to-r from-blue-100 to-indigo-100 text-blue-700 font-semibold">{cls.level}</Badge>
                            {cls.stream && <Badge className="bg-purple-100 text-purple-700 font-semibold">{cls.stream}</Badge>}
                          </div>
                        </div>

                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                          <Button variant="ghost" size="icon" onClick={() => openEditDialog(cls)} className="hover:bg-blue-50">
                            <Edit className="h-4 w-4 text-blue-600" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => handleDelete(cls.id)} className="hover:bg-red-50">
                            <Trash2 className="h-4 w-4 text-red-600" />
                          </Button>
                        </div>
                      </div>

                      <div className="space-y-3 mb-4 pt-4 border-t border-gray-100">
                        {cls.teacherName && (
                          <div className="flex items-center gap-3 text-gray-700">
                            <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center">
                              <User className="h-4 w-4 text-blue-600" />
                            </div>
                            <span className="text-sm font-medium">{cls.teacherName}</span>
                          </div>
                        )}

                        <div className="flex items-center gap-3 text-gray-700">
                          <div className="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center">
                            <Users className="h-4 w-4 text-indigo-600" />
                          </div>
                          <span className="text-sm font-medium">{cls.studentCount} student{cls.studentCount !== 1 ? 's' : ''}</span>
                        </div>

                        <div className="flex items-center gap-3 text-gray-700">
                          <div className="w-8 h-8 rounded-lg bg-purple-100 flex items-center justify-center">
                            <BookOpen className="h-4 w-4 text-purple-600" />
                          </div>
                          <span className="text-sm font-medium">{cls.subjectCount} subject{cls.subjectCount !== 1 ? 's' : ''}</span>
                        </div>
                      </div>

                      <Link href={`/admin/classes/${cls.id}`} className="w-full block">
                        <Button className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold py-2 rounded-lg transition-all duration-300">
                          Manage Class
                        </Button>
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))
        ) : (
          <div className="text-center py-12">
            <BookOpen className="h-12 w-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500 text-lg">No classes found</p>
          </div>
        )}
        </div>
      )}
    </DashboardLayout>
  );
}
