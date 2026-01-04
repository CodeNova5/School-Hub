"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
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
  admission_no: string;
};

export default function ClassPage() {
  const params = useParams();
  const classId = params.classId as string;

  const [subjects, setSubjects] = useState<SubjectClass[]>([]);
  const [subjectsLoading, setSubjectsLoading] = useState(false);


  const [students, setStudents] = useState<Student[]>([]);
  const [studentsLoading, setStudentsLoading] = useState(false);

  const [classData, setClassData] = useState<ClassData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!classId) return;
    fetchClass();
  }, [classId]);

  async function fetchClass() {
    setLoading(true);

    const { data, error } = await supabase
      .from("classes")
      .select("*")
      .eq("id", classId)
      .single();

    if (error) {
      toast.error("Failed to load class");
      console.error(error);
      return;
    }

    setClassData(data);
    setLoading(false);
  }

  function generateSubjectCode(subjectName: string, classCode: string) {
    const prefix = subjectName.slice(0, 3).toUpperCase();
    return `${prefix} ${classCode}`;
  }


  async function fetchClassSubjects() {
    setSubjectsLoading(true);

    const { data, error } = await supabase
      .from("subject_classes")
      .select(`
      id,
      subject_code,
      subject:subjects(id, name, is_optional),
      teacher:teachers(id, first_name, last_name)
    `)
      .eq("class_id", classId)
      .order("subject_code");

    if (error) {
      toast.error("Failed to load class subjects");
      console.error(error);
      return;
    }

    const transformedData = (data || []).map((item: any) => ({
      id: item.id,
      subject_code: item.subject_code,
      subject: item.subject[0],
      teacher: item.teacher[0] || null,
    }));
    setSubjects(transformedData);
    setSubjectsLoading(false);
  }
  useEffect(() => {
    if (classData?.id) {
      fetchClassSubjects();
    }
  }, [classData?.id]);

  async function generateMissingSubjectCodes() {
    if (!classData?.class_code) return;

    const updates = subjects
      .filter(s => !s.subject_code)
      .map(s => ({
        id: s.id,
        subject_code: generateSubjectCode(
          s.subject.name,
          classData.class_code!
        ),
      }));

    if (!updates.length) return;

    const { error } = await supabase
      .from("subject_classes")
      .upsert(updates, { onConflict: "id" });

    if (error) {
      toast.error("Failed to generate subject codes");
      console.error(error);
      return;
    }

    fetchClassSubjects();
  }

  useEffect(() => {
    if (subjects.length && classData?.class_code) {
      generateMissingSubjectCodes();
    }
  }, [subjects.length, classData?.class_code]);

  async function fetchStudents() {
    setStudentsLoading(true);

    const { data, error } = await supabase
      .from("students")
      .select("id, first_name, last_name, admission_no")
      .eq("class_id", classId)
      .order("last_name");

    if (error) {
      toast.error("Failed to load students");
      console.error(error);
      return;
    }

    setStudents(data || []);
    setStudentsLoading(false);
  }
  useEffect(() => {
    if (classData?.id) {
      fetchStudents();
    }
  }, [classData?.id]);

  if (loading) {
    return (
      <DashboardLayout role="admin">
        <div className="p-6">Loading class...</div>
      </DashboardLayout>
    );
  }

  if (!classData) {
    return (
      <DashboardLayout role="admin">
        <div className="p-6 text-red-600">Class not found</div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout role="admin">
      <div className="space-y-6">

        {/* ================= CLASS HEADER ================= */}
        <Card>
          <CardContent className="p-6 flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">{classData.name}</h1>
              <div className="flex gap-2 mt-2">
                <Badge>{classData.education_level}</Badge>
                <Badge variant="outline">{classData.level}</Badge>
                {classData.class_code && (
                  <Badge variant="secondary">
                    Code: {classData.class_code}
                  </Badge>
                )}
              </div>
            </div>

            {/* Future actions live here */}
            <div className="flex gap-2">
              {/* Edit / Lock / Archive buttons later */}
            </div>
          </CardContent>
        </Card>

        {/* ================= OVERVIEW ================= */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card><CardContent className="p-4">Students</CardContent></Card>
          <Card><CardContent className="p-4">Subjects</CardContent></Card>
          <Card><CardContent className="p-4">Teachers</CardContent></Card>
          <Card><CardContent className="p-4">Results</CardContent></Card>
        </div>

        {/* ================= TABS ================= */}
        <Tabs defaultValue="subjects" className="w-full">
          <TabsList>
            <TabsTrigger value="subjects">Subjects</TabsTrigger>
            <TabsTrigger value="students">Students</TabsTrigger>
            <TabsTrigger value="results">Results</TabsTrigger>
            <TabsTrigger value="settings">Settings</TabsTrigger>
          </TabsList>

          <TabsContent value="subjects">
            <Card>
              <CardContent className="p-6 space-y-4">

                <div className="flex justify-between items-center">
                  <h2 className="text-lg font-semibold">Class Subjects</h2>

                  <Button
                    variant="outline"
                    onClick={generateMissingSubjectCodes}
                  >
                    Generate Subject Codes
                  </Button>
                </div>

                {subjectsLoading ? (
                  <p>Loading subjects...</p>
                ) : (
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left p-2">Subject</th>
                        <th className="text-left p-2">Code</th>
                        <th className="text-left p-2">Teacher</th>
                        <th className="text-left p-2">Optional</th>
                      </tr>
                    </thead>
                    <tbody>
                      {subjects.map(sc => (
                        <tr key={sc.id} className="border-b">
                          <td className="p-2">{sc.subject.name}</td>
                          <td className="p-2 font-mono">{sc.subject_code}</td>
                          <td className="p-2">
                            {sc.teacher
                              ? `${sc.teacher.first_name} ${sc.teacher.last_name}`
                              : "—"}
                          </td>
                          <td className="p-2">
                            {sc.subject.is_optional ? "Yes" : "No"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </CardContent>
            </Card>
          </TabsContent>


          <TabsContent value="students">
            <Card>
              <CardContent className="p-6 space-y-4">

                <div className="flex justify-between items-center">
                  <h2 className="text-lg font-semibold">Students</h2>
                  <Button>Add Student</Button>
                </div>

                {studentsLoading ? (
                  <p>Loading students...</p>
                ) : (
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left p-2">Name</th>
                        <th className="text-left p-2">Admission No</th>
                      </tr>
                    </thead>
                    <tbody>
                      {students.map(s => (
                        <tr key={s.id} className="border-b">
                          <td className="p-2">
                            {s.first_name} {s.last_name}
                          </td>
                          <td className="p-2 font-mono">{s.admission_no}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </CardContent>
            </Card>
          </TabsContent>


          <TabsContent value="results">
            <Card>
              <CardContent className="p-6">
                Results tab coming later
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="settings">
            <Card>
              <CardContent className="p-6">
                Settings tab coming later
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
