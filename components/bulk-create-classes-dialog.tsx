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
import { Plus, Zap } from "lucide-react";
import { useState } from "react";
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

  // Get class levels for selected education level
  const classLevels =
    selectedEducationLevel && educationLevels[selectedEducationLevel]
      ? educationLevels[selectedEducationLevel]
      : [];

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

    setIsSubmitting(true);

    try {
      // Prepare class data for all levels
      const classesToCreate = classLevels.map((level) => ({
        school_id: schoolId,
        level,
        name: level,
        education_level: selectedEducationLevel,
        stream: null,
        class_teacher_id: classTeachers[level] || null,
      }));

      // Insert all classes
      const { error } = await supabase
        .from("classes")
        .insert(classesToCreate);

      if (error) {
        // Check if some classes already exist
        if (error.message.includes("duplicate")) {
          toast.error(
            "Some classes already exist. Only new classes will be created."
          );
          // Try to insert them one by one to skip duplicates
          let createdCount = 0;
          for (const classData of classesToCreate) {
            const { error: singleError } = await supabase
              .from("classes")
              .insert([classData]);

            if (!singleError) {
              createdCount++;
            }
          }

          if (createdCount > 0) {
            toast.success(`${createdCount} class${createdCount !== 1 ? "es" : ""} created`);
            handleClose();
            onSuccess();
          }
        } else {
          throw new Error(error.message);
        }
      } else {
        toast.success(
          `${classLevels.length} class${classLevels.length !== 1 ? "es" : ""} created successfully`
        );
        handleClose();
        onSuccess();
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
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm font-semibold text-blue-900">
                  {classLevels.length} class{classLevels.length !== 1 ? "es" : ""} to be created
                </p>
                <p className="text-xs text-blue-700 mt-1">
                  Assign a teacher to each class or leave blank for now
                </p>
              </div>

              <div className="space-y-3 max-h-96 overflow-y-auto">
                {classLevels.map((level) => (
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

          {/* EMPTY STATE */}
          {selectedEducationLevel && classLevels.length === 0 && (
            <div className="text-center py-8">
              <p className="text-gray-500">
                No classes found for this education level
              </p>
            </div>
          )}

          {/* ACTION BUTTONS */}
          <div className="flex gap-3 pt-4 border-t border-gray-200">
            <Button
              onClick={handleBulkCreate}
              disabled={!selectedEducationLevel || isSubmitting}
              className="flex-1 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white py-2 rounded-lg font-semibold transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? "Creating..." : `Create ${classLevels.length} Classes`}
            </Button>
            <Button
              variant="outline"
              type="button"
              onClick={handleClose}
              disabled={isSubmitting}
              className="flex-1 border-gray-300 hover:bg-gray-50"
            >
              Cancel
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
