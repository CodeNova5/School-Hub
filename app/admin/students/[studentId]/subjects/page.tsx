"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { ArrowLeft, Loader2, Save, BookOpen } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";

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
      
      setAvailableSubjects(
        filteredSubjects.map((sc: any) => ({
          ...sc,
          subjects: Array.isArray(sc.subjects) ? sc.subjects[0] : sc.subjects,
          teachers: Array.isArray(sc.teachers) ? sc.teachers[0] : sc.teachers,
        }))
      );

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

  function toggleSubject(subjectClassId: string) {
    const newSelected = new Set(selectedSubjects);
    if (newSelected.has(subjectClassId)) {
      newSelected.delete(subjectClassId);
    } else {
      newSelected.add(subjectClassId);
    }
    setSelectedSubjects(newSelected);
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
      <div className="max-w-7xl mx-auto p-6">
        <div className="mb-6">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.back()}
            className="mb-4"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold">Manage Student Subjects</h1>
              <p className="text-muted-foreground mt-1">{studentName}</p>
              {studentClass && (
                <p className="text-sm text-muted-foreground">
                  Class: {studentClass.name} ({studentClass.education_level})
                  {studentClass.department && ` - ${studentClass.department}`}
                </p>
              )}
            </div>
            <Button onClick={handleSaveSubjects} disabled={saving}>
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

        <div className="grid gap-6">
          {/* Compulsory Subjects */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BookOpen className="h-5 w-5" />
                Compulsory Subjects
                <Badge variant="secondary">
                  {compulsorySubjects.filter((sc) => selectedSubjects.has(sc.id)).length}/
                  {compulsorySubjects.length}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {compulsorySubjects.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">
                  No compulsory subjects available for this class
                </p>
              ) : (
                <div className="grid gap-3">
                  {compulsorySubjects.map((subjectClass) => (
                    <div
                      key={subjectClass.id}
                      className="flex items-center space-x-3 p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                    >
                      <Checkbox
                        id={subjectClass.id}
                        checked={selectedSubjects.has(subjectClass.id)}
                        onCheckedChange={() => toggleSubject(subjectClass.id)}
                      />
                      <label
                        htmlFor={subjectClass.id}
                        className="flex-1 cursor-pointer"
                      >
                        <div className="flex items-center gap-2">
                          <span className="font-medium">
                            {subjectClass.subjects.name}
                          </span>
                          {subjectClass.subjects.subject_code && (
                            <Badge variant="outline" className="text-xs">
                              {subjectClass.subjects.subject_code}
                            </Badge>
                          )}
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
                        {subjectClass.teachers && (
                          <p className="text-sm text-muted-foreground">
                            Teacher: {subjectClass.teachers.first_name}{" "}
                            {subjectClass.teachers.last_name}
                          </p>
                        )}
                      </label>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Optional Subjects */}
          {optionalSubjects.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BookOpen className="h-5 w-5" />
                  Optional Subjects
                  <Badge variant="secondary">
                    {optionalSubjects.filter((sc) => selectedSubjects.has(sc.id)).length}/
                    {optionalSubjects.length}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3">
                  {optionalSubjects.map((subjectClass) => (
                    <div
                      key={subjectClass.id}
                      className="flex items-center space-x-3 p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                    >
                      <Checkbox
                        id={subjectClass.id}
                        checked={selectedSubjects.has(subjectClass.id)}
                        onCheckedChange={() => toggleSubject(subjectClass.id)}
                      />
                      <label
                        htmlFor={subjectClass.id}
                        className="flex-1 cursor-pointer"
                      >
                        <div className="flex items-center gap-2">
                          <span className="font-medium">
                            {subjectClass.subjects.name}
                          </span>
                          {subjectClass.subjects.subject_code && (
                            <Badge variant="outline" className="text-xs">
                              {subjectClass.subjects.subject_code}
                            </Badge>
                          )}
                          <Badge variant="default" className="text-xs">
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
                        {subjectClass.teachers && (
                          <p className="text-sm text-muted-foreground">
                            Teacher: {subjectClass.teachers.first_name}{" "}
                            {subjectClass.teachers.last_name}
                          </p>
                        )}
                      </label>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Summary */}
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total Selected:</span>
                <span className="font-medium">{selectedSubjects.size} subjects</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Compulsory:</span>
                <span className="font-medium">
                  {compulsorySubjects.filter((sc) => selectedSubjects.has(sc.id)).length}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Optional:</span>
                <span className="font-medium">
                  {optionalSubjects.filter((sc) => selectedSubjects.has(sc.id)).length}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
