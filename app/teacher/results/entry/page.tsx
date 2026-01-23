"use client";

import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useEffect, useState, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { Student, Class as ClassType, Session, Term } from "@/lib/types";
import { toast } from "sonner";
import { getCurrentUser, getTeacherByUserId } from "@/lib/auth";
import { useSearchParams, useRouter } from "next/navigation";
import { Save, Printer, ArrowLeft, Loader2 } from "lucide-react";
import { set } from "date-fns";



interface SubjectScore {
  subject_class_id: string;
  subject_name: string;
  welcome_test: number;
  mid_term_test: number;
  vetting: number;
  exam: number;
  total: number;
  grade: string;
  remark: string;
}

export default function ResultEntryPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const printRef = useRef<HTMLDivElement>(null);

  const studentId = searchParams.get("studentId");

  const [student, setStudent] = useState<Student | null>(null);
  const [studentClass, setStudentClass] = useState<ClassType | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [term, setTerm] = useState<Term | null>(null);

  const [scores, setScores] = useState<SubjectScore[]>([]);
  const [attendance, setAttendance] = useState(0);
  const [nextTermDate, setNextTermDate] = useState("");
  const [classTeacherRemark, setClassTeacherRemark] = useState("");
  const [principalRemark, setPrincipalRemark] = useState("");

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (studentId) loadData();
  }, [studentId]);

  async function loadData() {
    if (!studentId) return;
    setIsLoading(true);

    try {
      // 1. Student
      const { data: studentData } = await supabase
        .from("students")
        .select("*")
        .eq("id", studentId)
        .single();

      if (!studentData) {
        toast.error("Student not found");
        router.push("/teacher/results");
        return;
      }

      setStudent(studentData);

      // 2. Class
      const { data: classData } = await supabase
        .from("classes")
        .select("*")
        .eq("id", studentData.class_id)
        .single();

      if (classData) setStudentClass(classData);

      // 3. Current session & term
      const { data: sessionData } = await supabase
        .from("sessions")
        .select("*")
        .eq("is_current", true)
        .single();

      const { data: termData } = await supabase
        .from("terms")
        .select("*")
        .eq("is_current", true)
        .single();

      if (!sessionData || !termData) {
        toast.error("No active session or term");
        return;
      }

      setSession(sessionData);
      setTerm(termData);

      // 4. Load subject_classes for this student's class
      const { data: subjectClasses, error: scError } = await supabase
        .from("subject_classes")
        .select(`
    id,
    subjects (
        id,
        name,
        is_optional,
        religion,
        department
      )
  `)
        .eq("class_id", studentData.class_id);

      if (scError || !subjectClasses || subjectClasses.length === 0) {
        toast.error("No subjects assigned to this class");
        return;
      }


      console.log('Student Data:', {
        name: `${studentData.first_name} ${studentData.last_name}`,
        religion: studentData.religion,
        department: studentData.department,
        classLevel: classData?.level
      });

      console.log('📚 All subjects before filtering:', subjectClasses.map((sc: any) => ({
        name: sc.subjects?.name,
        department: sc.subjects?.department
      })));

      const filteredSubjectClasses = subjectClasses.filter((sc: any) => {
        const subject = sc.subjects;
        if (!subject) return false;

        // Show if subject is GENERAL (department is null, undefined, or empty string)
        if (!subject.department || subject.department === '') return true;

        // Otherwise, show only if it matches student's department
        return subject.department === studentData.department;
      });


      console.log('✅ Filtered subject count:', filteredSubjectClasses.length);
      console.log('✅ Filtered subjects:', filteredSubjectClasses.map((sc: any) => sc.subjects?.name));


      if (filteredSubjectClasses.length === 0) {
        toast.error("No subjects match this student's category");
        return;
      }


      // 5. Build initial scores
      let initialScores: SubjectScore[] = filteredSubjectClasses.map((sc: any) => ({
        subject_class_id: sc.id,
        subject_name: sc.subjects?.name ?? "Unknown",
        welcome_test: 0,
        mid_term_test: 0,
        vetting: 0,
        exam: 0,
        total: 0,
        grade: "",
        remark: "",
      }));



      // 6. Determine next term logic
      let nextTermDateValue = "";
      try {
        // 1. Get all terms in the current session, ordered by position or id
        const { data: allTerms } = await supabase
          .from("terms")
          .select("*")
          .eq("session_id", sessionData.id)
          .order("id", { ascending: true });
        // Find the current term in the list
        const currentTermIdx = allTerms?.findIndex((t: any) => t.id === termData.id);
        if (allTerms && currentTermIdx !== undefined && currentTermIdx > -1) {
          // If not last term, next term is in this session
          if (currentTermIdx < allTerms.length - 1) {
            const nextTerm = allTerms[currentTermIdx + 1];
            nextTermDateValue = nextTerm?.start_date || "";
          } else {
            // Last term, get first term of next session
            // Find the next session
            const { data: nextSession } = await supabase
              .from("sessions")
              .select("*")
              .gt("id", sessionData.id)
              .order("id", { ascending: true })
              .limit(1)
              .single();
            if (nextSession) {
              const { data: nextSessionTerms } = await supabase
                .from("terms")
                .select("*")
                .eq("session_id", nextSession.id)
                .order("id", { ascending: true });
              if (nextSessionTerms && nextSessionTerms.length > 0) {
                nextTermDateValue = nextSessionTerms[0].start_date || "";
              }
            }
          }
        }
      } catch (e) {
      }

      setNextTermDate(nextTermDateValue || "");

      // 7. Load existing results
      const { data: existingResults } = await supabase
        .from("results")
        .select("*")
        .eq("student_id", studentId)
        .eq("session_id", sessionData.id)
        .eq("term_id", termData.id);


      if (existingResults && existingResults.length > 0) {
        const first = existingResults[0];
        setClassTeacherRemark(first.class_teacher_remark || "");
        setPrincipalRemark(first.principal_remark || "");

        for (const res of existingResults) {
          const idx = initialScores.findIndex(
            (s) => s.subject_class_id === res.subject_class_id
          );
          if (idx >= 0) {
            const total =
              (res.welcome_test || 0) +
              (res.mid_term_test || 0) +
              (res.vetting || 0) +
              (res.exam || 0);

            const { grade, remark } = calculateGrade(total);

            initialScores[idx] = {
              ...initialScores[idx],
              welcome_test: res.welcome_test || 0,
              mid_term_test: res.mid_term_test || 0,
              vetting: res.vetting || 0,
              exam: res.exam || 0,
              total,
              grade,
              remark: res.remark || remark,
            };
          }
        }
      }

      setScores(initialScores);

      // 7. Attendance
      const { count } = await supabase
        .from("attendance")
        .select("*", { count: "exact" })
        .eq("student_id", studentId)
        .eq("status", "present")
        .eq("session_id", sessionData.id)
        .eq("term_id", termData.id);


      setAttendance(count || 0);
    } catch (err: any) {
      toast.error(err.message || "Failed to load data");
    } finally {
      setIsLoading(false);
    }
  }

  function calculateGrade(total: number) {
    if (total >= 75) return { grade: "A1", remark: "Excellent" };
    if (total >= 70) return { grade: "B2", remark: "Very Good" };
    if (total >= 65) return { grade: "B3", remark: "Good" };
    if (total >= 60) return { grade: "C4", remark: "Credit" };
    if (total >= 55) return { grade: "C5", remark: "Credit" };
    if (total >= 50) return { grade: "C6", remark: "Credit" };
    if (total >= 45) return { grade: "D7", remark: "Pass" };
    if (total >= 40) return { grade: "E8", remark: "Pass" };
    return { grade: "F9", remark: "Fail" };
  }

  function updateScore(index: number, field: keyof SubjectScore, value: string) {
    const newScores = [...scores];
    let num = Math.max(0, Number(value) || 0);

    // Enforce score limits for each field
    const limits: Record<string, number> = {
      welcome_test: 10,
      mid_term_test: 20,
      vetting: 10,
      exam: 60,
    };

    if (limits[field]) {
      num = Math.min(num, limits[field]);
    }

    (newScores[index] as any)[field] = num;

    const total =
      newScores[index].welcome_test +
      newScores[index].mid_term_test +
      newScores[index].vetting +
      newScores[index].exam;

    const { grade, remark } = calculateGrade(total);

    newScores[index].total = total;
    newScores[index].grade = grade;
    newScores[index].remark = remark;

    setScores(newScores);
  }

  const totalScore = scores.reduce((sum, s) => sum + s.total, 0);
  const overallGrade = (() => {
    const avgScore = scores.length > 0 ? totalScore / scores.length : 0;
    return calculateGrade(avgScore).grade;
  })();
  const averagePercentage = scores.length > 0 ? (totalScore / (scores.length * 100)) * 100 : 0;

  function handlePrint() {
    window.print();
  }

  async function handleSave() {
    if (!student || !session || !term) return;

    setIsSaving(true);

    try {
      const user = await getCurrentUser();
      const teacher = user ? await getTeacherByUserId(user.id) : null;

      const records = scores.map((s) => ({
        student_id: student.id,
        subject_class_id: s.subject_class_id,
        session_id: session.id,
        term_id: term.id,
        welcome_test: s.welcome_test,
        mid_term_test: s.mid_term_test,
        vetting: s.vetting,
        exam: s.exam,
        total: s.total,
        grade: s.grade,
        remark: s.remark,
        class_teacher_remark: classTeacherRemark,
        class_teacher_name: teacher
          ? `${teacher.first_name} ${teacher.last_name}`
          : "",
        principal_remark: principalRemark,
        next_term_begins: nextTermDate || null,
        entered_by: teacher?.id,
      }));

      const { error } = await supabase.from("results").upsert(records, {
        onConflict: "student_id,subject_class_id,session_id,term_id",
      });

      if (error) throw error;

      toast.success("Results saved successfully");
      router.push("/teacher/results");
    } catch (err: any) {
      toast.error(err.message || "Failed to save results");
    } finally {
      setIsSaving(false);
    }
  }

  if (isLoading) {
    return (
      <DashboardLayout role="teacher">
        <div className="flex justify-center items-center h-96">
          <Loader2 className="animate-spin" />
        </div>
      </DashboardLayout>
    );
  }

  if (!student) return null;

  return (
    <DashboardLayout role="teacher">
      <div className="space-y-6 mb-12">
        <div className="flex items-center justify-between print:hidden">
          <Button variant="ghost" onClick={() => router.push('/teacher/results')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Results
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handlePrint}>
              <Printer className="h-4 w-4 mr-2" />
              Print
            </Button>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Save Results
                </>
              )}
            </Button>
          </div>
        </div>

        <Card className="print:shadow-none print:border-0">
          <CardContent id="printable-content" ref={printRef} className="p-8">
            <div className="space-y-6">
              <div className="flex items-start justify-between border-b pb-6">
                <div className="w-20 h-20 bg-gray-100 rounded flex items-center justify-center">
                  <span className="text-xs text-gray-400">LOGO</span>
                </div>

                <div className="text-center flex-1 mx-4">
                  <h1 className="text-2xl font-bold">SCHOOL NAME</h1>
                  <p className="text-sm text-gray-600 mt-1">School Address, City, State</p>
                  <p className="text-sm text-gray-600">Tel: +234 XXX XXX XXXX</p>
                  <p className="text-lg font-semibold mt-2 text-blue-600">STUDENT REPORT CARD</p>
                </div>

                <div className="w-20 h-20 bg-gray-100 rounded flex items-center justify-center">
                  <span className="text-xs text-gray-400">PHOTO</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-6 text-sm">
                <div>
                  <p><strong>Name:</strong> {student.first_name} {student.last_name}</p>
                  <p><strong>Class:</strong> {studentClass?.name}</p>
                  <p><strong>Session:</strong> {session?.name}</p>
                </div>
                <div>
                  <p><strong>Term:</strong> {term?.name}</p>
                  <p><strong>No. of Attendance:</strong> {attendance}</p>
                  <p>
                    <strong>Next Term Begins:</strong> {nextTermDate && !isNaN(new Date(nextTermDate).getTime()) ? new Date(nextTermDate).toLocaleDateString('en-GB') : 'N/A'}
                  </p>
                </div>
              </div>

              <div className="mt-6">
                <table className="w-full border-collapse border border-gray-300 text-sm">
                  <thead>
                    <tr className="bg-gray-100">
                      <th className="border border-gray-300 px-3 py-2 text-left">Subject</th>
                      <th className="border border-gray-300 px-3 py-2 text-center w-24">
                        Welcome Test (10)
                      </th>
                      <th className="border border-gray-300 px-3 py-2 text-center w-24">
                        Mid-Term (20)
                      </th>
                      <th className="border border-gray-300 px-3 py-2 text-center w-24">
                        Vetting (10)
                      </th>
                      <th className="border border-gray-300 px-3 py-2 text-center w-24">
                        Exam (60)
                      </th>
                      <th className="border border-gray-300 px-3 py-2 text-center w-20">
                        Total (100)
                      </th>
                      <th className="border border-gray-300 px-3 py-2 text-center w-16">Grade</th>
                      <th className="border border-gray-300 px-3 py-2 text-center">Remark</th>
                    </tr>
                  </thead>
                  <tbody>
                    {scores.map((score, index) => (
                      <tr key={score.subject_class_id}>
                        <td className="border border-gray-300 px-3 py-2 font-medium">
                          {score.subject_name}
                        </td>
                        <td className="border border-gray-300 px-1 py-1 text-center">
                          <input
                            type="number"
                            min="0"
                            max="10"
                            value={score.welcome_test || ''}
                            onChange={(e) => updateScore(index, 'welcome_test', e.target.value)}
                            className="w-full text-center border-0 focus:ring-1 focus:ring-blue-500 rounded print:border-0 print:focus:ring-0"
                          />
                        </td>
                        <td className="border border-gray-300 px-1 py-1 text-center">
                          <input
                            type="number"
                            min="0"
                            max="20"
                            value={score.mid_term_test || ''}
                            onChange={(e) => updateScore(index, 'mid_term_test', e.target.value)}
                            className="w-full text-center border-0 focus:ring-1 focus:ring-blue-500 rounded print:border-0 print:focus:ring-0"
                          />
                        </td>
                        <td className="border border-gray-300 px-1 py-1 text-center">
                          <input
                            type="number"
                            min="0"
                            max="10"
                            value={score.vetting || ''}
                            onChange={(e) => updateScore(index, 'vetting', e.target.value)}
                            className="w-full text-center border-0 focus:ring-1 focus:ring-blue-500 rounded print:border-0 print:focus:ring-0"
                          />
                        </td>
                        <td className="border border-gray-300 px-1 py-1 text-center">
                          <input
                            type="number"
                            min="0"
                            max="60"
                            value={score.exam || ''}
                            onChange={(e) => updateScore(index, 'exam', e.target.value)}
                            className="w-full text-center border-0 focus:ring-1 focus:ring-blue-500 rounded print:border-0 print:focus:ring-0"
                          />
                        </td>
                        <td className="border border-gray-300 px-3 py-2 text-center font-bold">
                          {score.total}
                        </td>
                        <td className="border border-gray-300 px-3 py-2 text-center font-bold">
                          {score.grade}
                        </td>
                        <td className="border border-gray-300 px-3 py-2 text-center">
                          {score.remark}
                        </td>
                      </tr>
                    ))}
                    <tr className="bg-blue-50 font-bold">
                      <td colSpan={5} className="border border-gray-300 px-3 py-2 text-right">
                        TOTAL SCORE:
                      </td>
                      <td className="border border-gray-300 px-3 py-2 text-center text-lg">
                        {totalScore}
                      </td>
                      <td className="border border-gray-300 px-3 py-2 text-center text-lg">
                        {overallGrade}
                      </td>
                      <td className="border border-gray-300 px-3 py-2"></td>
                    </tr>
                    <tr className="bg-green-50">
                      <td colSpan={5} className="border border-gray-300 px-3 py-2 text-right font-semibold">
                        AVERAGE PERCENTAGE:
                      </td>
                      <td colSpan={3} className="border border-gray-300 px-3 py-2 text-center font-bold text-lg">
                        {averagePercentage.toFixed(2)}%
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div className="grid grid-cols-1 gap-6 mt-8">
                <div>
                  <label className="block text-sm font-semibold mb-2">
                    Class Teacher's Remark:
                  </label>
                  <Textarea
                    value={classTeacherRemark}
                    onChange={(e) => setClassTeacherRemark(e.target.value)}
                    placeholder="Enter class teacher's remark..."
                    rows={3}
                    className="print:border-0 print:bg-transparent"
                  />
                  <div className="mt-4 flex justify-between items-center">
                    <div>
                      <p className="text-sm font-medium">Name: _________________________</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium">Signature: _________________________</p>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold mb-2">
                    Principal's Comment:
                  </label>
                  <Textarea
                    value={principalRemark}
                    onChange={(e) => setPrincipalRemark(e.target.value)}
                    placeholder="Enter principal's comment..."
                    rows={3}
                    className="print:border-0 print:bg-transparent"
                  />
                  <div className="mt-4 flex justify-between items-center">
                    <div>
                      <p className="text-sm font-medium">Signature: _________________________</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium">
                        Date: {new Date().toLocaleDateString('en-GB')}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <style jsx global>{`
        @media print {
        
          .print\\:hidden {
            display: none !important;
          }
          ${printRef.current ? `
            #printable-content,
            #printable-content * {
              visibility: visible;
            }
            #printable-content {
              position: absolute;
              left: 0;
              top: 0;
              width: 100%;
            }
          ` : ''}
        }
      `}</style>
    </DashboardLayout>
  );
}
