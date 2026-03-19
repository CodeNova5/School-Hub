"use client";

import { DashboardLayout } from "@/components/dashboard-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Plus, Search, Edit, Trash2, Users, BookOpen, User, Loader2, AlertCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useSchoolContext } from "@/hooks/use-school-context";
import { Class, Teacher, EducationLevel, ClassLevel, Stream } from "@/lib/types";
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
import { BulkCreateClassesDialog } from "@/components/bulk-create-classes-dialog";
import { useSchoolConfig } from "@/hooks/use-school-config";
import { ClassesSkeleton } from "@/components/skeletons";

interface ClassWithRelations extends Class {
  school_class_levels?: {
    id: string;
    name: string;
    education_level_id: string;
    school_education_levels?: {
      id: string;
      name: string;
    };
  };
  school_streams?: {
    id: string;
    name: string;
  };
  studentCount?: number;
  subjectCount?: number;
  teacherName?: string;
}

export default function ClassesPage() {
  const { schoolId, isLoading: schoolLoading, error: schoolError } = useSchoolContext();
  const [classes, setClasses] = useState<ClassWithRelations[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingClass, setEditingClass] = useState<ClassWithRelations | null>(null);
  const [streamInput, setStreamInput] = useState("");

  // Configuration state
  const [selectedEducationLevelId, setSelectedEducationLevelId] = useState<string>("");
  const [selectedClassLevelId, setSelectedClassLevelId] = useState<string>("");
  const [selectedStreamId, setSelectedStreamId] = useState<string>("");
  const [filterClassLevelId, setFilterClassLevelId] = useState<string>("");

  // Fetch configs from API
  const { data: educationLevels, isLoading: isLoadingEduLevels } = useSchoolConfig({
    type: "education_levels",
  });

  const { data: classLevels, isLoading: isLoadingClassLevels } = useSchoolConfig({
    type: "class_levels",
    educationLevelId: selectedEducationLevelId,
    enabled: !!selectedEducationLevelId,
  });

  const { data: streams, isLoading: isLoadingStreams } = useSchoolConfig({
    type: "streams",
  });

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
        .select(`
          *,
          school_class_levels(id, name, education_level_id, school_education_levels(id, name)),
          school_streams(id, name)
        `)
        .eq("school_id", schoolId)
        .order("created_at", { ascending: false });

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
            supabase
              .from("students")
              .select("id", { count: "exact" })
              .eq("school_id", schoolId)
              .eq("class_id", cls.id),
            supabase
              .from("subject_classes")
              .select("id", { count: "exact" })
              .eq("school_id", schoolId)
              .eq("class_id", cls.id),
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

    if (!selectedClassLevelId) {
      toast.error("Please select a class level");
      return;
    }

    const formData = new FormData(e.currentTarget);
    const classTeacherId = formData.get("class_teacher_id") as string;

    // Generate class name from stream (if provided)
    const selectedClassLevel = classLevels.find((cl) => cl.id === selectedClassLevelId);
    if (!selectedClassLevel) {
      toast.error("Invalid class level selected");
      return;
    }

    const className = streamInput.trim()
      ? `${selectedClassLevel.name} ${streamInput.toUpperCase()}`
      : selectedClassLevel.name;

    const classData = {
      school_id: schoolId,
      name: className,
      class_level_id: selectedClassLevelId,
      stream_id: selectedStreamId || null,
      class_teacher_id: classTeacherId || null,
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
          (c) =>
            c.class_level_id === selectedClassLevelId &&
            (c.stream_id === (selectedStreamId || null) ||
              (!c.stream_id && !selectedStreamId))
        );
        if (exists) {
          toast.error("This class already exists");
          return;
        }

        const { error } = await supabase
          .from("classes")
          .insert([classData]);

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

  function openEditDialog(cls: ClassWithRelations) {
    setEditingClass(cls);
    setSelectedEducationLevelId(
      cls.school_class_levels?.school_education_levels?.id || ""
    );
    setSelectedClassLevelId(cls.class_level_id);
    setSelectedStreamId(cls.stream_id || "");
    setStreamInput(
      streams.find((s) => s.id === cls.stream_id)?.name || ""
    );
    setIsDialogOpen(true);
  }

  function closeDialog() {
    setIsDialogOpen(false);
    setEditingClass(null);
    setSelectedEducationLevelId("");
    setSelectedClassLevelId("");
    setSelectedStreamId("");
    setStreamInput("");
  }

  const filteredClasses = classes.filter((cls) => {
    const matchesSearch = cls.name
      .toLowerCase()
      .includes(searchTerm.toLowerCase());
    const matchesFilter =
      !filterClassLevelId || cls.class_level_id === filterClassLevelId;
    return matchesSearch && matchesFilter;
  });

  // Group by education level
  const groupedClasses = filteredClasses.reduce(
    (acc, cls) => {
      const educationLevelName =
        cls.school_class_levels?.school_education_levels?.name || "Other";

      if (!acc[educationLevelName]) acc[educationLevelName] = [];
      acc[educationLevelName].push(cls);
      return acc;
    },
    {} as Record<string, ClassWithRelations[]>
  );

  if (schoolLoading || !schoolId) {
    return (
      <DashboardLayout role="admin">
       <ClassesSkeleton />
      </DashboardLayout>
    );
  }

  const hasNoConfig =
    educationLevels.length === 0 ||
    (selectedEducationLevelId && classLevels.length === 0);

  return (
    <DashboardLayout role="admin">
      <div className="space-y-8">
        {/* HEADER */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
              Classes
            </h1>
            <p className="text-gray-500 mt-2">Manage and organize all classes efficiently</p>
          </div>

          <div className="flex gap-3">
            {educationLevels.length > 0 && (
              <BulkCreateClassesDialog
                schoolId={schoolId}
                teachers={teachers}
                onSuccess={fetchClasses}
                educationLevels={educationLevels}
              />
            )}

            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button
                  onClick={() => setEditingClass(null)}
                  disabled={educationLevels.length === 0}
                  className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white px-6 py-2 rounded-lg shadow-lg hover:shadow-xl transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Plus className="mr-2 h-5 w-5" />
                  Add Class
                </Button>
              </DialogTrigger>

              <DialogContent className="max-h-[90vh] overflow-y-auto border-0 shadow-2xl">
                <DialogHeader>
                  <DialogTitle className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                    {editingClass ? "Edit Class" : "Create New Class"}
                  </DialogTitle>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-6">
                  {/* EDUCATION LEVEL */}
                  <div>
                    <Label className="text-sm font-semibold text-gray-700">
                      Education Level
                    </Label>
                    <select
                      value={selectedEducationLevelId}
                      onChange={(e) => {
                        setSelectedEducationLevelId(e.target.value);
                        setSelectedClassLevelId("");
                      }}
                      className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                      required
                    >
                      <option value="">Select an education level</option>
                      {isLoadingEduLevels ? (
                        <option disabled>Loading...</option>
                      ) : educationLevels.length === 0 ? (
                        <option disabled>No education levels configured</option>
                      ) : (
                        educationLevels.map((level) => (
                          <option key={level.id} value={level.id}>
                            {level.name}
                          </option>
                        ))
                      )}
                    </select>
                  </div>

                  {/* CLASS LEVEL */}
                  {selectedEducationLevelId && (
                    <div>
                      <Label className="text-sm font-semibold text-gray-700">
                        Class Level
                      </Label>
                      <select
                        value={selectedClassLevelId}
                        onChange={(e) => setSelectedClassLevelId(e.target.value)}
                        className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                        required
                      >
                        <option value="">Select a level</option>
                        {isLoadingClassLevels ? (
                          <option disabled>Loading...</option>
                        ) : classLevels.length === 0 ? (
                          <option disabled>No class levels configured</option>
                        ) : (
                          classLevels.map((level) => (
                            <option key={level.id} value={level.id}>
                              {level.name}
                            </option>
                          ))
                        )}
                      </select>
                    </div>
                  )}

                  {/* STREAM - SELECT EXISTING OR CREATE NEW */}
                  {selectedClassLevelId && (
                    <div>
                      <Label className="text-sm font-semibold text-gray-700">
                        Stream (Optional)
                      </Label>
                      <div className="flex gap-2">
                        <select
                          value={selectedStreamId}
                          onChange={(e) => {
                            setSelectedStreamId(e.target.value);
                            if (e.target.value) {
                              const stream = streams.find(
                                (s) => s.id === e.target.value
                              );
                              setStreamInput(stream?.name || "");
                            } else {
                              setStreamInput("");
                            }
                          }}
                          className="flex-1 px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                        >
                          <option value="">Select stream...</option>
                          {streams.map((stream) => (
                            <option key={stream.id} value={stream.id}>
                              {stream.name}
                            </option>
                          ))}
                        </select>
                        <Input
                          placeholder="Or enter custom"
                          value={streamInput}
                          onChange={(e) => {
                            setStreamInput(e.target.value.toUpperCase());
                            setSelectedStreamId(""); // Clear selection if entering custom
                          }}
                          className="flex-1 px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                      </div>
                    </div>
                  )}

                  {/* CLASS TEACHER */}
                  <div>
                    <Label className="text-sm font-semibold text-gray-700">
                      Class Teacher
                    </Label>
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
                    <Button
                      type="submit"
                      className="flex-1 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white py-2 rounded-lg font-semibold transition-all duration-300"
                    >
                      {editingClass ? "Update Class" : "Create Class"}
                    </Button>
                    <Button
                      variant="outline"
                      type="button"
                      onClick={closeDialog}
                      className="flex-1 border-gray-300 hover:bg-gray-50"
                    >
                      Cancel
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* CONFIG WARNING */}
        {hasNoConfig && (
          <Card className="border-l-4 border-l-amber-500 bg-amber-50">
            <CardContent className="pt-6">
              <div className="flex gap-3">
                <AlertCircle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-amber-900">
                    No education levels configured
                  </p>
                  <p className="text-sm text-amber-800 mt-1">
                    Go to School Setup to configure education levels and class levels before creating classes.
                  </p>
                  <Link href="/admin/school-setup">
                    <Button variant="outline" size="sm" className="mt-2">
                      Go to School Setup
                    </Button>
                  </Link>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* SEARCH & FILTER */}
        <Card className="border-0 shadow-md bg-white">
          <CardHeader className="pb-4 border-b border-gray-100">
            <CardTitle className="text-lg font-semibold text-gray-800">
              Search & Filter
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="relative">
                <Search className="absolute left-4 top-3.5 h-5 w-5 text-blue-400" />
                <Input
                  placeholder="Search by class name..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-12 border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <select
                value={filterClassLevelId}
                onChange={(e) => setFilterClassLevelId(e.target.value)}
                className="px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              >
                <option value="">All Class Levels</option>
                {educationLevels.map((eduLevel) => (
                  <optgroup key={eduLevel.id} label={eduLevel.name}>
                    {classLevels
                      .filter((cl) => cl.education_level_id === eduLevel.id)
                      .map((classLevel) => (
                        <option key={classLevel.id} value={classLevel.id}>
                          {classLevel.name}
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
                    {groupedClasses[group].length} class
                    {groupedClasses[group].length !== 1 ? "es" : ""}
                  </Badge>
                </div>
              </div>

              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {groupedClasses[group].map((cls: ClassWithRelations) => (
                  <div
                    key={cls.id}
                    className="group relative bg-white rounded-2xl shadow-md hover:shadow-2xl transition-all duration-500 overflow-hidden border border-gray-100"
                  >
                    {/* Gradient Background */}
                    <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-blue-50 to-indigo-50 rounded-full -mr-8 -mt-8 group-hover:scale-150 transition-transform duration-500"></div>

                    <div className="relative p-6 z-10">
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold text-sm">
                              {cls.name.charAt(0)}
                            </div>
                            <h3 className="font-bold text-lg text-gray-800">
                              {cls.name}
                            </h3>
                          </div>

                          <div className="flex gap-2 mt-3 flex-wrap">
                            <Badge className="bg-gradient-to-r from-blue-100 to-indigo-100 text-blue-700 font-semibold">
                              {cls.school_class_levels?.name}
                            </Badge>
                            {cls.school_streams && (
                              <Badge className="bg-purple-100 text-purple-700 font-semibold">
                                {cls.school_streams.name}
                              </Badge>
                            )}
                          </div>
                        </div>

                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openEditDialog(cls)}
                            className="hover:bg-blue-50"
                          >
                            <Edit className="h-4 w-4 text-blue-600" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDelete(cls.id)}
                            className="hover:bg-red-50"
                          >
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
                            <span className="text-sm font-medium">
                              {cls.teacherName}
                            </span>
                          </div>
                        )}

                        <div className="flex items-center gap-3 text-gray-700">
                          <div className="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center">
                            <Users className="h-4 w-4 text-indigo-600" />
                          </div>
                          <span className="text-sm font-medium">
                            {cls.studentCount} student
                            {cls.studentCount !== 1 ? "s" : ""}
                          </span>
                        </div>

                        <div className="flex items-center gap-3 text-gray-700">
                          <div className="w-8 h-8 rounded-lg bg-purple-100 flex items-center justify-center">
                            <BookOpen className="h-4 w-4 text-purple-600" />
                          </div>
                          <span className="text-sm font-medium">
                            {cls.subjectCount} subject
                            {cls.subjectCount !== 1 ? "s" : ""}
                          </span>
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
    </DashboardLayout>
  );
}
