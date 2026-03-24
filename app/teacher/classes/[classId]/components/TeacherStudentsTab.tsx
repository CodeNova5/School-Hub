"use client";

import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search, User } from "lucide-react";
import { Student, Session, Term } from "@/lib/types";
import { StudentDetailsModal } from "@/components/student-details-modal";
import { supabase } from "@/lib/supabase";

type ClassData = {
  id: string;
  school_id: string;
  name: string;
  class_level_id: string;
  stream_id: string | null;
  department_id: string | null;
  room_number: string | null;
  class_teacher_id: string | null;
  session_id: string | null;
  academic_year: string | null;
  created_at: string;
  updated_at: string;
  school_class_levels: {
    id: string;
    name: string;
    code: string | null;
  } | null;
};

interface StudentsTabProps {
  students: Student[];
  classData: ClassData;
  sessions: Session[];
  terms: Term[];
}

export default function TeacherStudentsTab({
  students,
  classData,
  sessions,
  terms,
}: StudentsTabProps) {
  const [studentSearch, setStudentSearch] = useState("");
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [isStudentDetailsOpen, setIsStudentDetailsOpen] = useState(false);

  const filteredStudents = useMemo(() => {
    return students.filter((s) => {
      const fullName = `${s.first_name} ${s.last_name}`.toLowerCase();
      if (
        studentSearch &&
        !fullName.includes(studentSearch.toLowerCase()) &&
        !s.student_id.toLowerCase().includes(studentSearch.toLowerCase())
      )
        return false;
      return true;
    });
  }, [students, studentSearch]);

  async function handleViewStudentDetails(student: Student) {
    try {
      // Fetch attendance for this student
      const { data: attendance, error } = await supabase
        .from("attendance")
        .select("*")
        .eq("student_id", student.id);

      if (error) throw error;

      const total = attendance.length;
      const present = attendance.filter(
        (r: any) => r.status === "present" || r.status === "late" || r.status === "excused"
      ).length;

      const averageAttendance = total === 0 ? 0 : Math.round((present / total) * 100);

      const enrichedStudent = {
        ...student,
        average_attendance: averageAttendance,
        total_attendance: total,
      };

      setSelectedStudent(enrichedStudent);
    } catch (error) {
      console.error("Error fetching attendance:", error);
      setSelectedStudent(student);
    }
    setIsStudentDetailsOpen(true);
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Class Students ({students.length})</CardTitle>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Search */}
          <div className="relative">
            <Search className="h-4 w-4 absolute left-3 top-3 text-muted-foreground" />
            <Input
              placeholder="Search by name or student ID..."
              className="pl-9"
              value={studentSearch}
              onChange={(e) => setStudentSearch(e.target.value)}
            />
          </div>

          {/* Students Table */}
          <div className="border rounded-md overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted">
                <tr>
                  <th className="p-3 text-left w-12">#</th>
                  <th className="p-3 text-left">Student ID</th>
                  <th className="p-3 text-left">Name</th>
                  <th className="p-3 text-left">Gender</th>
                  <th className="p-3 text-left">Email</th>
                  <th className="p-3 text-left">Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredStudents.map((student, i) => (
                  <tr
                    key={student.id}
                    className="border-t hover:bg-muted/50 cursor-pointer"
                    onClick={() => handleViewStudentDetails(student)}
                  >
                    <td className="p-3">{i + 1}</td>
                    <td className="p-3 font-mono text-xs">{student.student_id}</td>
                    <td className="p-3 font-medium">
                      {student.first_name} {student.last_name}
                    </td>
                    <td className="p-3 capitalize">{student.gender}</td>
                    <td className="p-3 text-xs">{student.email}</td>
                    <td className="p-3">
                      <Badge variant={student.status === "active" ? "default" : "secondary"}>
                        {student.status}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {filteredStudents.length === 0 && (
              <div className="p-8 text-center text-muted-foreground">
                {studentSearch ? "No students match your search." : "No students in this class yet."}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Student Details Modal */}
      <StudentDetailsModal
        student={selectedStudent}
        sessions={sessions}
        terms={terms}
        isOpen={isStudentDetailsOpen}
        onClose={() => {
          setIsStudentDetailsOpen(false);
          setSelectedStudent(null);
        }}
      />
    </>
  );
}
