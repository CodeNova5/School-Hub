"use client";

import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Search, MoreVertical, User } from "lucide-react";
import { toast } from "sonner";
import { Student, Session, Term } from "@/lib/types";
import { StudentDetailsModal } from "@/components/student-details-modal";
import { supabase } from "@/lib/supabase";

interface TeacherStudentsTabProps {
  classId: string;
  students: Student[];
  sessions: Session[];
  terms: Term[];
  schoolId?: string | null;
}

export default function TeacherStudentsTab({
  classId,
  students,
  sessions,
  terms,
  schoolId,
}: TeacherStudentsTabProps) {
  const [search, setSearch] = useState("");
  const [genderFilter, setGenderFilter] = useState<"all" | "male" | "female">("all");
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);

  const filteredStudents = useMemo(() => {
    return students.filter((s) => {
      const searchTerm = search.toLowerCase();
      const matchesSearch =
        `${s.first_name} ${s.last_name}`.toLowerCase().includes(searchTerm) ||
        s.student_id.toLowerCase().includes(searchTerm) ||
        s.email.toLowerCase().includes(searchTerm);

      const matchesGender = genderFilter === "all" || s.gender === genderFilter;

      return matchesSearch && matchesGender;
    });
  }, [students, search, genderFilter]);

  async function handleViewDetails(student: Student) {
    try {
      // Fetch attendance for this student
      let query = supabase
        .from("attendance")
        .select("*")
        .eq("student_id", student.id);

      if (schoolId) {
        query = query.eq("school_id", schoolId);
      }

      const { data: studentAttendance, error } = await query;

      if (error) {
        throw error;
      }

      const total = studentAttendance.length;
      const present = studentAttendance.filter(
        (r: any) => r.status === "present" || r.status === "late" || r.status === "excused"
      ).length;

      const averageAttendance = total === 0 ? 0 : Math.round((present / total) * 100);

      // Add attendance data to student object
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
    setIsDetailsOpen(true);
  }

  return (
    <>
      <Card>
        <CardHeader className="p-4 sm:p-6">
          <CardTitle className="text-lg sm:text-xl">Class Students ({students.length})</CardTitle>
        </CardHeader>

        <CardContent className="space-y-3 sm:space-y-4 p-4 sm:p-6">

          {/* Summary Stats */}
          {filteredStudents.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3 md:gap-4 mt-3 sm:mt-6">
              <div className="p-3 sm:p-4 bg-blue-50 rounded-lg">
                <p className="text-xs sm:text-sm text-blue-600 font-medium">Total</p>
                <p className="text-xl sm:text-2xl font-bold text-blue-900">{filteredStudents.length}</p>
              </div>
              <div className="p-3 sm:p-4 bg-purple-50 rounded-lg">
                <p className="text-xs sm:text-sm text-purple-600 font-medium">Male</p>
                <p className="text-xl sm:text-2xl font-bold text-purple-900">
                  {filteredStudents.filter(s => s.gender === "male").length}
                </p>
              </div>
              <div className="p-3 sm:p-4 bg-pink-50 rounded-lg">
                <p className="text-xs sm:text-sm text-pink-600 font-medium">Female</p>
                <p className="text-xl sm:text-2xl font-bold text-pink-900">
                  {filteredStudents.filter(s => s.gender === "female").length}
                </p>
              </div>
              <div className="p-3 sm:p-4 bg-green-50 rounded-lg">
                <p className="text-xs sm:text-sm text-green-600 font-medium">Active</p>
                <p className="text-xl sm:text-2xl font-bold text-green-900">
                  {filteredStudents.filter(s => s.status === "active").length}
                </p>
              </div>
            </div>
          )}

          {/* Search and Filter */}
          <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
            <div className="relative flex-1">
              <Search className="h-3 w-3 sm:h-4 sm:w-4 absolute left-2.5 sm:left-3 top-2.5 sm:top-3 text-muted-foreground" />
              <Input
                placeholder="Search by name, ID, email..."
                className="pl-8 sm:pl-9 h-9 sm:h-10 text-sm"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <select
              className="border rounded-md px-3 py-2 text-xs sm:text-sm h-9 sm:h-10"
              value={genderFilter}
              onChange={(e) => setGenderFilter(e.target.value as any)}
            >
              <option value="all">All Genders</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
            </select>
          </div>

          {/* Students Table */}
          <div className="border rounded-md overflow-hidden">
            {/* Desktop Table */}
            <div className="hidden lg:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted">
                <tr>
                  <th className="p-3 text-left w-12">#</th>
                  <th className="p-3 text-left">Student ID</th>
                  <th className="p-3 text-left">Name</th>
                  <th className="p-3 text-left">Email</th>
                  <th className="p-3 text-left">Gender</th>
                  <th className="p-3 text-right w-12"></th>
                </tr>
              </thead>
              <tbody>
                {filteredStudents.length === 0 && students.length > 0 ? (
                  <tr className="border-t">
                    <td colSpan={6} className="p-8 text-center text-muted-foreground">
                      No students match your search
                    </td>
                  </tr>
                ) : filteredStudents.length === 0 ? (
                  <tr className="border-t">
                    <td colSpan={6} className="p-8 text-center text-muted-foreground">
                      No students in this class
                    </td>
                  </tr>
                ) : (
                  filteredStudents.map((student, i) => (
                    <tr key={student.id} className="border-t hover:bg-muted/50">
                      <td className="p-3">{i + 1}</td>
                      <td className="p-3 font-mono text-xs font-semibold">
                        {student.student_id}
                      </td>
                      <td className="p-3 font-medium">
                        {student.first_name} {student.last_name}
                      </td>
                      <td className="p-3 text-xs text-muted-foreground">
                        {student.email}
                      </td>
                      <td className="p-3 capitalize">
                        <Badge variant="outline" className="text-xs">
                          {student.gender}
                        </Badge>
                      </td>
                      <td className="p-3 text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={() => handleViewDetails(student)}
                            >
                              <User className="mr-2 h-4 w-4" />
                              View Details
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
            </div>

            {/* Mobile Card Layout */}
            <div className="lg:hidden space-y-3 p-3">
              {filteredStudents.length === 0 && students.length > 0 ? (
                <div className="p-8 text-center text-sm text-muted-foreground">
                  No students match your search
                </div>
              ) : filteredStudents.length === 0 ? (
                <div className="p-8 text-center text-sm text-muted-foreground">
                  No students in this class
                </div>
              ) : (
                filteredStudents.map((student, i) => (
                  <div key={student.id} className="border rounded-lg p-4 space-y-3 bg-white shadow-sm">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-gray-100 text-gray-600 text-xs font-medium shrink-0">
                            {i + 1}
                          </span>
                          <Badge variant="outline" className="text-xs font-mono shrink-0">
                            {student.student_id}
                          </Badge>
                        </div>
                        <p className="font-medium text-sm sm:text-base truncate">
                          {student.first_name} {student.last_name}
                        </p>
                        <p className="text-xs text-muted-foreground truncate mt-0.5">
                          {student.email}
                        </p>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() => handleViewDetails(student)}
                          >
                            <User className="mr-2 h-4 w-4" />
                            View Details
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t">
                      <Badge variant="outline" className="text-xs capitalize">
                        {student.gender}
                      </Badge>
                      {student.status === "active" ? (
                        <Badge className="bg-green-100 text-green-800 border-green-300 text-xs">
                          Active
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-xs">
                          {student.status}
                        </Badge>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

        </CardContent>
      </Card>

      {/* Student Details Modal */}
      <StudentDetailsModal
        student={selectedStudent}
        sessions={sessions}
        terms={terms}
        isOpen={isDetailsOpen}
        onClose={() => {
          setIsDetailsOpen(false);
          setSelectedStudent(null);
        }}
      />
    </>
  );
}
