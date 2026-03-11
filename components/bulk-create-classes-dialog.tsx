"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Plus, Zap, CheckCircle } from "lucide-react";
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { Teacher, EducationLevel, ClassLevel } from "@/lib/types";

interface BulkCreateClassesProps {
  schoolId: string;
  teachers: Teacher[];
  onSuccess: () => void;
  educationLevels: EducationLevel[];
}

export function BulkCreateClassesDialog({
  schoolId,
  teachers,
  onSuccess,
  educationLevels,
}: BulkCreateClassesProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedEducationLevelId, setSelectedEducationLevelId] = useState<string>("");
  const [classTeachers, setClassTeachers] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [existingClasses, setExistingClasses] = useState<any[]>([]);
  const [isLoadingClasses, setIsLoadingClasses] = useState(false);
  const [classLevels, setClassLevels] = useState<ClassLevel[]>([]);
  const [isLoadingClassLevels, setIsLoadingClassLevels] = useState(false);

  // Fetch class levels for selected education level
  useEffect(() => {
    if (selectedEducationLevelId) {
      fetchClassLevels();
      fetchExistingClasses();
    }
  }, [selectedEducationLevelId]);

  async function fetchClassLevels() {
    setIsLoadingClassLevels(true);
    try {
      const { data, error } = await supabase
        .from("school_class_levels")
        .select("*")
        .eq("school_id", schoolId)
        .eq("education_level_id", selectedEducationLevelId)
        .eq("is_active", true)
        .order("order_sequence", { ascending: true });

      if (error) {
        console.error("Error fetching class levels:", error);
        setClassLevels([]);
      } else {
        setClassLevels(data || []);
      }
    } catch (error) {
      console.error("Error:", error);
      setClassLevels([]);
    } finally {
      setIsLoadingClassLevels(false);
    }
  }

  async function fetchExistingClasses() {
    setIsLoadingClasses(true);
    try {
      // First get the class levels for this education level
      const { data: levels, error: levelsError } = await supabase
        .from("school_class_levels")
        .select("id")
        .eq("school_id", schoolId)
        .eq("education_level_id", selectedEducationLevelId);

      if (levelsError || !levels) {
        setExistingClasses([]);
        setIsLoadingClasses(false);
        return;
      }

      const levelIds = levels.map((l:any) => l.id);

      // Then fetch classes with those level IDs
      const { data, error } = await supabase
        .from("classes")
        .select("*, school_class_levels(name), teachers(first_name, last_name)")
        .eq("school_id", schoolId)
        .in("class_level_id", levelIds);

      if (error) {
        console.error("Error fetching existing classes:", error);
        setExistingClasses([]);
      } else {
        setExistingClasses(data || []);
      }
    } catch (error) {
      console.error("Error:", error);
      setExistingClasses([]);
    } finally {
      setIsLoadingClasses(false);
    }
  }

  const handleTeacherChange = (classLevelId: string, teacherId: string) => {
    setClassTeachers((prev) => ({
      ...prev,
      [classLevelId]: teacherId,
    }));
  };

  async function handleBulkCreate() {
    if (!selectedEducationLevelId || classLevels.length === 0) {
      toast.error("Please select an education level");
      return;
    }

    const classesToCreateCount = classLevels.length - existingClasses.length;
    if (classesToCreateCount === 0) {
      toast.error("All classes for this education level already exist");
      return;
    }

    setIsSubmitting(true);

    try {
      // Get class level IDs that don't already exist
      const existingLevelIds = existingClasses.map((c) => c.class_level_id);
      const classesToCreate = classLevels
        .filter((level) => !existingLevelIds.includes(level.id))
        .map((level) => ({
          school_id: schoolId,
          class_level_id: level.id,
          name: level.name,
          class_teacher_id: classTeachers[level.id] || null,
        }));

      // Insert classes one by one to avoid constraint conflicts
      let createdCount = 0;
      let failedClasses: string[] = [];

      for (const classData of classesToCreate) {
        try {
          // First check if it already exists (double check)
          const { data: existingClass, error: checkError } = await supabase
            .from("classes")
            .select("id")
            .eq("school_id", schoolId)
            .eq("class_level_id", classData.class_level_id)
            .maybeSingle();

          if (checkError && checkError.code !== "PGRST116") {
            throw checkError;
          }

          // If class doesn't exist, create it
          if (!existingClass) {
            const { error: insertError } = await supabase
              .from("classes")
              .insert([classData]);

            if (insertError) {
              console.error(`Error creating ${classData.name}:`, insertError);
              failedClasses.push(classData.name);
            } else {
              createdCount++;
            }
          } else {
            failedClasses.push(classData.name);
          }
        } catch (error: any) {
          console.error(`Error processing ${classData.name}:`, error);
          failedClasses.push(classData.name);
        }
      }

      if (createdCount > 0) {
        toast.success(
          `${createdCount} class${createdCount !== 1 ? "es" : ""} created successfully`
        );
        handleClose();
        onSuccess();
      }

      if (failedClasses.length > 0) {
        toast.error(
          `Could not create: ${failedClasses.join(", ")} (may already exist)`
        );
      }
    } catch (error: any) {
      console.error("Error:", error);
      toast.error(error.message || "Failed to create classes");
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleClose() {
    setIsOpen(false);
    setSelectedEducationLevelId("");
    setClassTeachers({});
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button className="bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white px-6 py-2 rounded-lg shadow-lg hover:shadow-xl transition-all duration-300">
          <Zap className="mr-2 h-5 w-5" />
          Bulk Create Classes
        </Button>
      </DialogTrigger>

      <DialogContent className="max-h-[90vh] overflow-y-auto border-0 shadow-2xl max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold bg-gradient-to-r from-amber-500 to-orange-600 bg-clip-text text-transparent">
            Bulk Create Classes
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* EDUCATION LEVEL SELECT */}
          <div>
            <Label className="text-sm font-semibold text-gray-700">
              Select Education Level
            </Label>
            <select
              value={selectedEducationLevelId}
              onChange={(e) => {
                setSelectedEducationLevelId(e.target.value);
                setClassTeachers({});
              }}
              className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all"
            >
              <option value="">Choose an education level...</option>
              {educationLevels.map((level) => (
                <option key={level.id} value={level.id}>
                  {level.name} ({classLevels.length} classes)
                </option>
              ))}
            </select>
          </div>

          {/* CLASS LIST WITH TEACHER ASSIGNMENT */}
          {selectedEducationLevelId && classLevels.length > 0 && (
            <div className="space-y-4">
              {/* EXISTING CLASSES */}
              {existingClasses.length > 0 && (
                <div className="space-y-3">
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <p className="text-sm font-semibold text-green-900">
                      ✓ {existingClasses.length} existing class
                      {existingClasses.length !== 1 ? "es" : ""}
                    </p>
                    <p className="text-xs text-green-700 mt-1">
                      Already created for this education level
                    </p>
                  </div>

                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {existingClasses.map((cls) => (
                      <div
                        key={cls.id}
                        className="flex items-center gap-3 p-3 bg-green-50 rounded-lg border border-green-200"
                      >
                        <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-gray-800 truncate">
                            {cls.name}
                          </p>
                          {cls.teachers && (
                            <p className="text-xs text-gray-600 truncate">
                              Teacher: {cls.teachers.first_name} {cls.teachers.last_name}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* NEW CLASSES TO CREATE */}
              {classLevels.length > existingClasses.length && (
                <div className="space-y-3">
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <p className="text-sm font-semibold text-blue-900">
                      {classLevels.length - existingClasses.length} class
                      {classLevels.length - existingClasses.length !== 1 ? "es" : ""} to be
                      created
                    </p>
                    <p className="text-xs text-blue-700 mt-1">
                      Assign a teacher to each class or leave blank for now
                    </p>
                  </div>

                  <div className="space-y-3 max-h-96 overflow-y-auto">
                    {classLevels
                      .filter(
                        (level) =>
                          !existingClasses.some(
                            (cls) => cls.class_level_id === level.id
                          )
                      )
                      .map((level) => (
                        <div
                          key={level.id}
                          className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-200 hover:border-gray-300 transition-all"
                        >
                          <div className="flex-1">
                            <p className="font-semibold text-gray-800">{level.name}</p>
                          </div>

                          <select
                            value={classTeachers[level.id] || ""}
                            onChange={(e) =>
                              handleTeacherChange(level.id, e.target.value)
                            }
                            className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all"
                          >
                            <option value="">No teacher</option>
                            {teachers.map((teacher) => (
                              <option key={teacher.id} value={teacher.id}>
                                {teacher.first_name} {teacher.last_name}
                              </option>
                            ))}
                          </select>
                        </div>
                      ))}
                  </div>
                </div>
              )}

              {/* ALL CLASSES CREATED */}
              {classLevels.length === existingClasses.length && (
                <div className="text-center py-8 bg-green-50 rounded-lg border border-green-200">
                  <CheckCircle className="h-12 w-12 text-green-600 mx-auto mb-2" />
                  <p className="text-green-900 font-semibold">
                    All classes for this education level have been created!
                  </p>
                </div>
              )}
            </div>
          )}

          {/* LOADING STATE */}
          {isLoadingClassLevels && (
            <div className="text-center py-8">
              <p className="text-gray-500">Loading class levels...</p>
            </div>
          )}

          {/* EMPTY STATE */}
          {selectedEducationLevelId && classLevels.length === 0 && !isLoadingClassLevels && (
            <div className="text-center py-8">
              <p className="text-gray-500">
                No class levels found for this education level
              </p>
            </div>
          )}

          {/* ACTION BUTTONS */}
          <div className="flex gap-3 pt-4 border-t border-gray-200">
            {classLevels.length > existingClasses.length && (
              <Button
                onClick={handleBulkCreate}
                disabled={!selectedEducationLevelId || isSubmitting}
                className="flex-1 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white py-2 rounded-lg font-semibold transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting
                  ? "Creating..."
                  : `Create ${classLevels.length - existingClasses.length} Class${
                      classLevels.length - existingClasses.length !== 1 ? "es" : ""
                    }`}
              </Button>
            )}
            <Button
              variant="outline"
              type="button"
              onClick={handleClose}
              disabled={isSubmitting}
              className="flex-1 border-gray-300 hover:bg-gray-50"
            >
              {classLevels.length > existingClasses.length ? "Cancel" : "Close"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
