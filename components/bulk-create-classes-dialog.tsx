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
import { Teacher } from "@/lib/types";

interface BulkCreateClassesProps {
  schoolId: string;
  teachers: Teacher[];
  onSuccess: () => void;
  educationLevels: Record<string, string[]>;
}

export function BulkCreateClassesDialog({
  schoolId,
  teachers,
  onSuccess,
  educationLevels,
}: BulkCreateClassesProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedEducationLevel, setSelectedEducationLevel] = useState("");
  const [classTeachers, setClassTeachers] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [existingClasses, setExistingClasses] = useState<any[]>([]);
  const [isLoadingClasses, setIsLoadingClasses] = useState(false);

  // Get class levels for selected education level
  const classLevels =
    selectedEducationLevel && educationLevels[selectedEducationLevel]
      ? educationLevels[selectedEducationLevel]
      : [];

  // Fetch existing classes for selected education level
  useEffect(() => {
    if (selectedEducationLevel) {
      fetchExistingClasses();
    }
  }, [selectedEducationLevel]);

  async function fetchExistingClasses() {
    setIsLoadingClasses(true);
    try {
      const { data, error } = await supabase
        .from("classes")
        .select("*, teachers(first_name, last_name)")
        .eq("school_id", schoolId)
        .eq("education_level", selectedEducationLevel)
        .order("level", { ascending: true });

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

  const handleTeacherChange = (level: string, teacherId: string) => {
    setClassTeachers((prev) => ({
      ...prev,
      [level]: teacherId,
    }));
  };

  async function handleBulkCreate() {
    if (!selectedEducationLevel || classLevels.length === 0) {
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
      // Prepare class data for new levels only (exclude existing ones)
      const classesToCreate = classLevels
        .filter((level) => !existingClasses.some((cls) => cls.level === level))
        .map((level) => ({
          school_id: schoolId,
          level,
          name: level,
          education_level: selectedEducationLevel,
          stream: null,
          class_teacher_id: classTeachers[level] || null,
        }));

      // Insert classes one by one to avoid constraint conflicts
      let createdCount = 0;
      let failedClasses: string[] = [];

      for (const classData of classesToCreate) {
        try {
          // First check if it already exists
          const { data: existingClass, error: checkError } = await supabase
            .from("classes")
            .select("id")
            .eq("school_id", schoolId)
            .eq("level", classData.level)
            .eq("education_level", classData.education_level)
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
              console.error(`Error creating ${classData.level}:`, insertError);
              failedClasses.push(classData.level);
            } else {
              createdCount++;
            }
          } else {
            failedClasses.push(classData.level);
          }
        } catch (error: any) {
          console.error(`Error processing ${classData.level}:`, error);
          failedClasses.push(classData.level);
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
    setSelectedEducationLevel("");
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
              value={selectedEducationLevel}
              onChange={(e) => {
                setSelectedEducationLevel(e.target.value);
                setClassTeachers({});
              }}
              className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all"
            >
              <option value="">Choose an education level...</option>
              {Object.keys(educationLevels).map((level) => (
                <option key={level} value={level}>
                  {level} ({educationLevels[level].length} classes)
                </option>
              ))}
            </select>
          </div>

          {/* CLASS LIST WITH TEACHER ASSIGNMENT */}
          {selectedEducationLevel && classLevels.length > 0 && (
            <div className="space-y-4">
              {/* EXISTING CLASSES */}
              {existingClasses.length > 0 && (
                <div className="space-y-3">
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <p className="text-sm font-semibold text-green-900">
                      ✓ {existingClasses.length} existing class{existingClasses.length !== 1 ? "es" : ""}
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
                        {cls.stream && (
                          <span className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded flex-shrink-0">
                            {cls.stream}
                          </span>
                        )}
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
                      {classLevels.length - existingClasses.length} class{classLevels.length - existingClasses.length !== 1 ? "es" : ""} to be created
                    </p>
                    <p className="text-xs text-blue-700 mt-1">
                      Assign a teacher to each class or leave blank for now
                    </p>
                  </div>

                  <div className="space-y-3 max-h-96 overflow-y-auto">
                    {classLevels
                      .filter(
                        (level) =>
                          !existingClasses.some((cls) => cls.level === level)
                      )
                      .map((level) => (
                        <div
                          key={level}
                          className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-200 hover:border-gray-300 transition-all"
                        >
                          <div className="flex-1">
                            <p className="font-semibold text-gray-800">{level}</p>
                          </div>

                          <select
                            value={classTeachers[level] || ""}
                            onChange={(e) =>
                              handleTeacherChange(level, e.target.value)
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

          {/* EMPTY STATE */}
          {selectedEducationLevel && classLevels.length === 0 && (
            <div className="text-center py-8">
              <p className="text-gray-500">
                No classes found for this education level
              </p>
            </div>
          )}

          {/* LOADING STATE */}
          {isLoadingClasses && (
            <div className="text-center py-8">
              <p className="text-gray-500">Loading classes...</p>
            </div>
          )}

          {/* ACTION BUTTONS */}
          <div className="flex gap-3 pt-4 border-t border-gray-200">
            {classLevels.length > existingClasses.length && (
              <Button
                onClick={handleBulkCreate}
                disabled={!selectedEducationLevel || isSubmitting}
                className="flex-1 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white py-2 rounded-lg font-semibold transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? "Creating..." : `Create ${classLevels.length - existingClasses.length} Class${classLevels.length - existingClasses.length !== 1 ? "es" : ""}`}
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
