"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { ArrowLeft, Loader2, Save, BookOpen, CheckCircle2, Circle, GraduationCap, Edit3 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface Subject {
  id: string;
  name: string;
  subject_code: string;
  education_level: string;
  department: string | null;
  religion: string | null;
  is_optional: boolean;
}

interface SubjectClass {
  id: string;
  subject_id: string;
  class_id: string;
  teacher_id: string | null;
  subjects: Subject;
  teachers: {
    first_name: string;
    last_name: string;
  } | null;
}

interface StudentSubject {
  id: string;
  student_id: string;
  subject_class_id: string;
}

export default function StudentSubjectsPage() {
  const params = useParams();
  const router = useRouter();
  const studentId = params.studentId as string;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [studentName, setStudentName] = useState("");
  const [studentClass, setStudentClass] = useState<any>(null);
  const [availableSubjects, setAvailableSubjects] = useState<SubjectClass[]>([]);
  const [selectedSubjects, setSelectedSubjects] = useState<Set<string>>(new Set());
  const [studentDepartment, setStudentDepartment] = useState<string | null>(null);
  const [isDepartmentDialogOpen, setIsDepartmentDialogOpen] = useState(false);
  const [newDepartment, setNewDepartment] = useState<string>("");
  const [availableDepartments, setAvailableDepartments] = useState<string[]>([]);
  const [isChangingDepartment, setIsChangingDepartment] = useState(false);

  useEffect(() => {
    loadStudentData();
  }, [studentId]);

  async function loadStudentData() {
    setLoading(true);
    try {
      // Fetch student details
      const { data: studentData, error: studentError } = await supabase
        .from("students")
        .select(`
          id,
          first_name,
          last_name,
          class_id,
          department,
          religion,
          classes (
            id,
            name,
            level,
            education_level,
            department
          )
        `)
        .eq("id", studentId)
        .single();

      if (studentError || !studentData) {
        toast.error("Student not found");
        router.push("/admin/students");
        return;
      }

      setStudentName(`${studentData.first_name} ${studentData.last_name}`);
      setStudentClass(studentData.classes);
      setStudentDepartment(studentData.department);

      // Fetch available departments from all subjects for this class
      const { data: allSubjectClassesData } = await supabase
        .from("subject_classes")
        .select(`
          subjects (
            department
          )
        `)
        .eq("class_id", studentData.class_id);

      const departments = new Set<string>();
      (allSubjectClassesData || []).forEach((sc: any) => {
        if (sc.subjects?.department) {
          departments.add(sc.subjects.department);
        }
      });
      setAvailableDepartments(Array.from(departments).sort());

      // Fetch available subject_classes for the student's class
      const { data: subjectClassesData, error: subjectClassesError } = await supabase
        .from("subject_classes")
        .select(`
          id,
          subject_id,
          class_id,
          teacher_id,
          subjects (
            id,
            name,
            subject_code,
            education_level,
            department,
            religion,
            is_optional
          ),
          teachers (
            first_name,
            last_name
          )
        `)
        .eq("class_id", studentData.class_id);

      if (subjectClassesError) {
        console.error("Error fetching subject classes:", subjectClassesError);
        toast.error("Failed to load available subjects");
        return;
      }

      // Filter subjects based on student's department and religion
      const filteredSubjects = (subjectClassesData || []).filter((sc: any) => {
        const subject = sc.subjects;
        
        // Filter by department if applicable
        if (subject.department && studentData.department) {
          if (subject.department !== studentData.department) {
            return false;
          }
        }

        // Filter by religion if applicable
        if (subject.religion && studentData.religion) {
          if (subject.religion !== studentData.religion) {
            return false;
          }
        }

        return true;
      });
      
      const mappedSubjects = filteredSubjects.map((sc: any) => ({
        ...sc,
        subjects: Array.isArray(sc.subjects) ? sc.subjects[0] : sc.subjects,
        teachers: Array.isArray(sc.teachers) ? sc.teachers[0] : sc.teachers,
      }));
      
      setAvailableSubjects(mappedSubjects);

      // Fetch student's current subjects from student_subjects table
      const { data: studentSubjectsData, error: studentSubjectsError } = await supabase
        .from("student_subjects")
        .select("subject_class_id")
        .eq("student_id", studentId);

      if (studentSubjectsError) {
        console.error("Error fetching student subjects:", studentSubjectsError);
      } else {
        const subjectClassIds = new Set(
          studentSubjectsData?.map((ss) => ss.subject_class_id) || []
        );
        
        // Automatically select all compulsory subjects
        mappedSubjects.forEach((sc: any) => {
          if (!sc.subjects.is_optional) {
            subjectClassIds.add(sc.id);
          }
        });
        
        setSelectedSubjects(subjectClassIds);
      }
    } catch (error) {
      console.error("Error loading student data:", error);
      toast.error("Failed to load student data");
    } finally {
      setLoading(false);
    }
  }

  async function handleSaveSubjects() {
    setSaving(true);
    try {
      // Delete all existing student_subjects for this student
      const { error: deleteError } = await supabase
        .from("student_subjects")
        .delete()
        .eq("student_id", studentId);

      if (deleteError) {
        throw deleteError;
      }

      // Insert new student_subjects
      if (selectedSubjects.size > 0) {
        const studentSubjectsToInsert = Array.from(selectedSubjects).map(
          (subjectClassId) => ({
            student_id: studentId,
            subject_class_id: subjectClassId,
          })
        );

        const { error: insertError } = await supabase
          .from("student_subjects")
          .insert(studentSubjectsToInsert);

        if (insertError) {
          throw insertError;
        }
      }

      toast.success("Student subjects updated successfully");
    } catch (error) {
      console.error("Error saving subjects:", error);
      toast.error("Failed to save subjects");
    } finally {
      setSaving(false);
    }
  }

  function toggleSubject(subjectClassId: string, isOptional: boolean) {
    // Don't allow deselecting compulsory subjects
    if (!isOptional && selectedSubjects.has(subjectClassId)) {
      toast.info("Compulsory subjects cannot be deselected");
      return;
    }
    
    const newSelected = new Set(selectedSubjects);
    if (newSelected.has(subjectClassId)) {
      newSelected.delete(subjectClassId);
    } else {
      newSelected.add(subjectClassId);
    }
    setSelectedSubjects(newSelected);
  }

  async function handleChangeDepartment() {
    if (!newDepartment) {
      toast.error("Please select a department");
      return;
    }

    if (newDepartment === studentDepartment) {
      toast.info("Same department selected");
      setIsDepartmentDialogOpen(false);
      return;
    }

    setIsChangingDepartment(true);
    try {
      // Update student's department
      const { error: updateError } = await supabase
        .from("students")
        .update({ department: newDepartment })
        .eq("id", studentId);

      if (updateError) throw updateError;

      toast.success(studentDepartment ? "Department changed successfully" : "Department added successfully");
      setStudentDepartment(newDepartment);
      setIsDepartmentDialogOpen(false);

      // Remove old departmental subjects from selectedSubjects (only if there was a previous department)
      if (studentDepartment) {
        const newSelected = new Set(selectedSubjects);
        availableSubjects.forEach((sc) => {
          if (sc.subjects.department === studentDepartment) {
            newSelected.delete(sc.id);
          }
        });
        setSelectedSubjects(newSelected);
      }

      // Reload the page to get new available subjects and add compulsory departmental subjects
      await new Promise(resolve => setTimeout(resolve, 500));
      loadStudentData();
      setNewDepartment("");
    } catch (error: any) {
      console.error("Error updating department:", error);
      toast.error("Failed to update department: " + error.message);
    } finally {
      setIsChangingDepartment(false);
    }
  }

  if (loading) {
    return (
      <DashboardLayout role="admin">
        <div className="flex items-center justify-center h-96">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  const compulsorySubjects = availableSubjects.filter(
    (sc) => !sc.subjects.is_optional
  );
  const optionalSubjects = availableSubjects.filter(
    (sc) => sc.subjects.is_optional
  );

  return (
    <DashboardLayout role="admin">
      <div className="max-w-7xl mx-auto p-6 space-y-6">
        <div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.back()}
            className="mb-4 hover:bg-muted"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <GraduationCap className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <h1 className="text-3xl font-bold">Manage Student Subjects</h1>
                  <p className="text-muted-foreground mt-1">{studentName}</p>
                </div>
              </div>
              {studentClass && (
                <div className="flex flex-wrap items-center gap-2 ml-14">
                  <Badge variant="outline" className="text-sm">
                    {studentClass.name}
                  </Badge>
                  <Badge variant="outline" className="text-sm">
                    {studentClass.education_level}
                  </Badge>
                  {studentDepartment && (
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="text-sm">
                        {studentDepartment}
                      </Badge>
                      {availableDepartments.length > 1 && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setNewDepartment(studentDepartment || "");
                            setIsDepartmentDialogOpen(true);
                          }}
                          className="h-6 px-2"
                        >
                          <Edit3 className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  )}
                  {!studentDepartment && availableDepartments.length > 0 && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setNewDepartment("");
                        setIsDepartmentDialogOpen(true);
                      }}
                      className="text-xs"
                    >
                      Add Department
                    </Button>
                  )}
                </div>
              )}
            </div>
            <Button onClick={handleSaveSubjects} disabled={saving} size="lg" className="shadow-md">
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Save Changes
                </>
              )}
            </Button>
          </div>
        </div>

         {/* Summary */}
        <Card className="shadow-sm border-2">
          <CardHeader className="bg-gradient-to-r from-primary/5 to-blue-500/5">
            <CardTitle className="flex items-center gap-2">
              <BookOpen className="h-5 w-5" />
              Subject Selection Summary
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="grid md:grid-cols-3 gap-6">
              <div className="flex flex-col items-center p-4 bg-primary/5 rounded-lg">
                <div className="text-3xl font-bold text-primary mb-1">
                  {selectedSubjects.size}
                </div>
                <div className="text-sm text-muted-foreground font-medium">
                  Total Subjects
                </div>
              </div>
              <div className="flex flex-col items-center p-4 bg-green-500/10 rounded-lg">
                <div className="text-3xl font-bold text-green-600 mb-1">
                  {compulsorySubjects.filter((sc) => selectedSubjects.has(sc.id)).length}
                </div>
                <div className="text-sm text-muted-foreground font-medium">
                  Compulsory
                </div>
              </div>
              <div className="flex flex-col items-center p-4 bg-blue-500/10 rounded-lg">
                <div className="text-3xl font-bold text-blue-600 mb-1">
                  {optionalSubjects.filter((sc) => selectedSubjects.has(sc.id)).length}
                </div>
                <div className="text-sm text-muted-foreground font-medium">
                  Optional
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-6">
          {/* Compulsory Subjects */}
          <Card className="shadow-sm">
            <CardHeader className="bg-muted/30">
              <CardTitle className="flex items-center gap-2">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <CheckCircle2 className="h-5 w-5 text-primary" />
                </div>
                <span>Compulsory Subjects</span>
                <Badge variant="default" className="ml-auto">
                  {compulsorySubjects.filter((sc) => selectedSubjects.has(sc.id)).length}/
                  {compulsorySubjects.length}
                </Badge>
              </CardTitle>
              <p className="text-sm text-muted-foreground mt-2">
                These subjects are mandatory and automatically selected for all students
              </p>
            </CardHeader>
            <CardContent className="pt-6">
              {compulsorySubjects.length === 0 ? (
                <div className="text-center py-12">
                  <BookOpen className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
                  <p className="text-muted-foreground">
                    No compulsory subjects available for this class
                  </p>
                </div>
              ) : (
                <div className="grid gap-3">
                  {compulsorySubjects.map((subjectClass) => (
                    <div
                      key={subjectClass.id}
                      className="flex items-start space-x-3 p-4 border-2 border-primary/20 bg-primary/5 rounded-lg transition-all"
                    >
                      <CheckCircle2 className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          <span className="font-semibold text-base">
                            {subjectClass.subjects.name}
                          </span>
                          {subjectClass.subjects.subject_code && (
                            <Badge variant="outline" className="text-xs">
                              {subjectClass.subjects.subject_code}
                            </Badge>
                          )}
                          <Badge variant="default" className="text-xs">
                            Required
                          </Badge>
                          {subjectClass.subjects.department && (
                            <Badge variant="secondary" className="text-xs">
                              {subjectClass.subjects.department}
                            </Badge>
                          )}
                          {subjectClass.subjects.religion && (
                            <Badge variant="secondary" className="text-xs">
                              {subjectClass.subjects.religion}
                            </Badge>
                          )}
                        </div>
                        {subjectClass.teachers ? (
                          <p className="text-sm text-muted-foreground">
                            👨‍🏫 {subjectClass.teachers.first_name}{" "}
                            {subjectClass.teachers.last_name}
                          </p>
                        ) : (
                          <p className="text-sm text-muted-foreground italic">
                            No teacher assigned
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Optional Subjects */}
          {optionalSubjects.length > 0 && (
            <Card className="shadow-sm">
              <CardHeader className="bg-muted/30">
                <CardTitle className="flex items-center gap-2">
                  <div className="p-2 bg-blue-500/10 rounded-lg">
                    <Circle className="h-5 w-5 text-blue-500" />
                  </div>
                  <span>Optional Subjects</span>
                  <Badge variant="secondary" className="ml-auto">
                    {optionalSubjects.filter((sc) => selectedSubjects.has(sc.id)).length}/
                    {optionalSubjects.length} selected
                  </Badge>
                </CardTitle>
                <p className="text-sm text-muted-foreground mt-2">
                  Select additional subjects the student wants to take
                </p>
              </CardHeader>
              <CardContent className="pt-6">
                <div className="grid gap-3">
                  {optionalSubjects.map((subjectClass) => {
                    const isSelected = selectedSubjects.has(subjectClass.id);
                    return (
                      <div
                        key={subjectClass.id}
                        className={`flex items-start space-x-3 p-4 border-2 rounded-lg hover:border-primary/50 transition-all cursor-pointer ${
                          isSelected ? "border-blue-500/50 bg-blue-500/5" : "border-border hover:bg-muted/30"
                        }`}
                        onClick={() => toggleSubject(subjectClass.id, true)}
                      >
                        <Checkbox
                          id={subjectClass.id}
                          checked={isSelected}
                          onCheckedChange={() => toggleSubject(subjectClass.id, true)}
                          className="mt-0.5"
                        />
                        <label
                          htmlFor={subjectClass.id}
                          className="flex-1 cursor-pointer min-w-0"
                        >
                          <div className="flex flex-wrap items-center gap-2 mb-1">
                            <span className="font-semibold text-base">
                              {subjectClass.subjects.name}
                            </span>
                            {subjectClass.subjects.subject_code && (
                              <Badge variant="outline" className="text-xs">
                                {subjectClass.subjects.subject_code}
                              </Badge>
                            )}
                            <Badge variant="secondary" className="text-xs">
                              Optional
                            </Badge>
                            {subjectClass.subjects.department && (
                              <Badge variant="secondary" className="text-xs">
                                {subjectClass.subjects.department}
                              </Badge>
                            )}
                            {subjectClass.subjects.religion && (
                              <Badge variant="secondary" className="text-xs">
                                {subjectClass.subjects.religion}
                              </Badge>
                            )}
                          </div>
                          {subjectClass.teachers ? (
                            <p className="text-sm text-muted-foreground">
                              👨‍🏫 {subjectClass.teachers.first_name}{" "}
                              {subjectClass.teachers.last_name}
                            </p>
                          ) : (
                            <p className="text-sm text-muted-foreground italic">
                              No teacher assigned
                            </p>
                          )}
                        </label>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Change/Add Department Dialog */}
        <Dialog open={isDepartmentDialogOpen} onOpenChange={setIsDepartmentDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {studentDepartment ? "Change Student Department" : "Add Student Department"}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                {studentDepartment && (
                  <p className="text-sm text-muted-foreground mb-3">
                    Current Department: <span className="font-semibold text-foreground">{studentDepartment}</span>
                  </p>
                )}
                <label className="block text-sm font-medium mb-2">
                  {studentDepartment ? "Select New Department" : "Select Department"}
                </label>
                <select
                  value={newDepartment}
                  onChange={(e) => setNewDepartment(e.target.value)}
                  className="w-full px-3 py-2 border rounded-md bg-background"
                >
                  <option value="">-- Select Department --</option>
                  {availableDepartments.map((dept) => (
                    <option key={dept} value={dept}>
                      {dept}
                    </option>
                  ))}
                </select>
              </div>
              
              <div className="bg-amber-50 border border-amber-200 rounded-md p-3">
                <p className="text-sm text-amber-900">
                  <strong>Note:</strong> 
                  {studentDepartment 
                    ? " Subjects from the old department will be removed, and all compulsory subjects from the new department will be automatically added."
                    : " All compulsory subjects from the selected department will be automatically added."}
                </p>
              </div>

              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setIsDepartmentDialogOpen(false);
                    setNewDepartment("");
                  }}
                  disabled={isChangingDepartment}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleChangeDepartment}
                  disabled={isChangingDepartment || !newDepartment}
                >
                  {isChangingDepartment ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      {studentDepartment ? "Changing..." : "Adding..."}
                    </>
                  ) : (
                    studentDepartment ? "Change Department" : "Add Department"
                  )}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
