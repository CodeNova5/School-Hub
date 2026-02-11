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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Search,
  Download,
  Upload,
  UserPlus,
  MoreVertical,
  User,
  UserMinus,
  ArrowRightLeft,
  Edit,
} from "lucide-react";
import { toast } from "sonner";
import { Student, Session, Term } from "@/lib/types";
import { StudentDetailsModal } from "@/components/student-details-modal";
import { EditStudentModal } from "@/components/edit-student-modal";
import * as XLSX from "xlsx-js-style";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase"; // Make sure this import exists
import { AlertTriangle } from "lucide-react";

type ClassData = {
  id: string;
  name: string;
  level: string;
  education_level: string;
};

interface StudentsTabProps {
  students: Student[];
  classData: ClassData;
  sessions: Session[];
  terms: Term[];
  availableStudents: Student[];
  allClasses: ClassData[];
  onAddStudents: (studentIds: string[]) => void;
  onRemoveStudent: (studentId: string) => void;
  onBulkRemove: (studentIds: string[]) => void;
  onTransferStudents: (studentIds: string[], targetClassId: string) => void;
}

export function StudentsTab({
  students,
  classData,
  sessions,
  terms,
  availableStudents,
  allClasses,
  onAddStudents,
  onRemoveStudent,
  onBulkRemove,
  onTransferStudents,
}: StudentsTabProps) {
  const [studentSearch, setStudentSearch] = useState("");
  const [studentGenderFilter, setStudentGenderFilter] = useState<"all" | "male" | "female">("all");
  const [studentStatusFilter, setStudentStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [selectedStudents, setSelectedStudents] = useState<Set<string>>(new Set());
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [isStudentDetailsOpen, setIsStudentDetailsOpen] = useState(false);
  const [isEditStudentOpen, setIsEditStudentOpen] = useState(false);
  const [isAddStudentOpen, setIsAddStudentOpen] = useState(false);
  const [isTransferStudentOpen, setIsTransferStudentOpen] = useState(false);
  const [transferTargetClassId, setTransferTargetClassId] = useState("");
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [studentToDelete, setStudentToDelete] = useState<Student | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const router = useRouter();
  const filteredStudents = useMemo(() => {
    return students.filter((s) => {
      const fullName = `${s.first_name} ${s.last_name}`.toLowerCase();
      if (
        studentSearch &&
        !fullName.includes(studentSearch.toLowerCase()) &&
        !s.student_id.toLowerCase().includes(studentSearch.toLowerCase())
      )
        return false;
      if (studentGenderFilter !== "all" && s.gender !== studentGenderFilter) return false;
      if (studentStatusFilter !== "all" && s.status !== studentStatusFilter) return false;
      return true;
    });
  }, [students, studentSearch, studentGenderFilter, studentStatusFilter]);

  function handleSelectAllStudents() {
    if (selectedStudents.size === filteredStudents.length) {
      setSelectedStudents(new Set());
    } else {
      setSelectedStudents(new Set(filteredStudents.map((s) => s.id)));
    }
  }

  function handleSelectStudent(studentId: string) {
    const newSelected = new Set(selectedStudents);
    if (newSelected.has(studentId)) {
      newSelected.delete(studentId);
    } else {
      newSelected.add(studentId);
    }
    setSelectedStudents(newSelected);
  }

  function handleStudentSubjects(student: Student) {
    // This would navigate to a page to manage subjects
    router.push(`/admin/students/${student.id}/subjects`);
  }

  async function handleViewStudentWithAttendance(student: Student) {
    try {
      // Fetch attendance for this student using supabase client
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
    setIsStudentDetailsOpen(true);
  }

  function handleEditStudent(student: Student) {
    setSelectedStudent(student);
    setIsEditStudentOpen(true);
  }

  function handleEditStudentSuccess(updatedStudent: Student) {
    // Update the student in the list
    router.refresh();
  }

  async function handleDeleteStudentCompletely() {
    if (!studentToDelete) return;
    setIsDeleting(true);
    try {
      const response = await fetch("/api/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "delete-student",
          studentId: studentToDelete.id,
          userId: studentToDelete.user_id,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        toast.error(result.error || "Failed to delete student");
        return;
      }

      toast.success("Student and all related data deleted.");
      setIsDeleteDialogOpen(false);
      setStudentToDelete(null);
      router.refresh();
    } catch (error: any) {
      toast.error("Failed to delete student: " + (error.message || error));
    } finally {
      setIsDeleting(false);
    }
  }


  function handleExportStudents() {
    const exportData = filteredStudents.map((s, i) => ({
      "#": i + 1,
      "Student ID": s.student_id,
      "First Name": s.first_name,
      "Last Name": s.last_name,
      Gender: s.gender,
      Email: s.email,
      Phone: s.phone,
      "Date of Birth": s.date_of_birth || "",
      "Parent Name": s.parent_name,
      "Parent Email": s.parent_email,
      "Parent Phone": s.parent_phone,
      "Admission Date": s.admission_date,
      Status: s.status,
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Students");
    XLSX.writeFile(wb, `${classData?.name || "class"}-students.xlsx`);
    toast.success("Students exported successfully");
  }

  function handleImportStudents(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: "array" });
        const worksheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData: any[] = XLSX.utils.sheet_to_json(worksheet);

        const studentIds = jsonData.map((row) => row["Student ID"]).filter(Boolean);

        if (studentIds.length === 0) {
          toast.error("No valid student IDs found in the file");
          return;
        }

        // This would need to be handled by parent component
        toast.info("Import functionality needs backend integration");
      } catch (error) {
        console.error(error);
        toast.error("Failed to import students");
      }
    };
    reader.readAsArrayBuffer(file);
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <CardTitle>Class Students ({students.length})</CardTitle>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={handleExportStudents}>
                <Download className="h-4 w-4 mr-1" />
                Export
              </Button>
              <label>
                <Button size="sm" variant="outline" asChild>
                  <span>
                    <Upload className="h-4 w-4 mr-1" />
                    Import
                  </span>
                </Button>
                <input
                  type="file"
                  accept=".xlsx,.xls"
                  className="hidden"
                  onChange={handleImportStudents}
                />
              </label>
              <Button size="sm" onClick={() => setIsAddStudentOpen(true)}>
                <UserPlus className="h-4 w-4 mr-1" />
                Add Students
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Search and Filters */}
          <div className="flex flex-col md:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="h-4 w-4 absolute left-3 top-3 text-muted-foreground" />
              <Input
                placeholder="Search by name or student ID..."
                className="pl-9"
                value={studentSearch}
                onChange={(e) => setStudentSearch(e.target.value)}
              />
            </div>
            <select
              className="border rounded-md p-2"
              value={studentGenderFilter}
              onChange={(e) => setStudentGenderFilter(e.target.value as any)}
            >
              <option value="all">All Genders</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
            </select>
            <select
              className="border rounded-md p-2"
              value={studentStatusFilter}
              onChange={(e) => setStudentStatusFilter(e.target.value as any)}
            >
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>

          {/* Bulk Actions */}
          {selectedStudents.size > 0 && (
            <div className="flex items-center gap-2 p-3 bg-blue-50 rounded-md">
              <span className="text-sm font-medium">{selectedStudents.size} selected</span>
              <div className="flex gap-2 ml-auto">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setIsTransferStudentOpen(true)}
                >
                  <ArrowRightLeft className="h-4 w-4 mr-1" />
                  Transfer
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => onBulkRemove(Array.from(selectedStudents))}
                >
                  <UserMinus className="h-4 w-4 mr-1" />
                  Remove from Class
                </Button>
              </div>
            </div>
          )}

          {/* Students Table */}
          <div className="border rounded-md overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted">
                <tr>
                  <th className="p-3 w-12">
                    <input
                      type="checkbox"
                      checked={
                        selectedStudents.size === filteredStudents.length &&
                        filteredStudents.length > 0
                      }
                      onChange={handleSelectAllStudents}
                      className="cursor-pointer"
                    />
                  </th>
                  <th className="p-3 text-left w-12">#</th>
                  <th className="p-3 text-left">Student ID</th>
                  <th className="p-3 text-left">Name</th>
                  <th className="p-3 text-left">Gender</th>
                  <th className="p-3 text-left">Email</th>
                  <th className="p-3 text-left">Status</th>
                  <th className="p-3 text-right w-12"></th>
                </tr>
              </thead>
              <tbody>
                {filteredStudents.map((student, i) => (
                  <tr key={student.id} className="border-t hover:bg-muted/50">
                    <td className="p-3">
                      <input
                        type="checkbox"
                        checked={selectedStudents.has(student.id)}
                        onChange={() => handleSelectStudent(student.id)}
                        className="cursor-pointer"
                      />
                    </td>
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
                    <td className="p-3 text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleViewStudentWithAttendance(student)}>
                            <User className="mr-2 h-4 w-4" />
                            View Details
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleEditStudent(student)}>
                            <Edit className="mr-2 h-4 w-4" />
                            Edit Details
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleStudentSubjects(student)}>
                            <User className="mr-2 h-4 w-4" />
                            Manage Subjects
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => {
                            setSelectedStudents(new Set([student.id]));
                            setIsTransferStudentOpen(true);
                          }}>
                            <ArrowRightLeft className="mr-2 h-4 w-4" />
                            Transfer Student
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-red-600 focus:text-red-600"
                            onClick={() => onRemoveStudent(student.id)}
                          >
                            <UserMinus className="mr-2 h-4 w-4" />
                            Remove from Class
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-red-700 focus:text-red-700"
                            onClick={() => {
                              setStudentToDelete(student);
                              setIsDeleteDialogOpen(true);
                            }}
                          >
                            <AlertTriangle className="mr-2 h-4 w-4 text-red-700" />
                            Delete Completely
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {filteredStudents.length === 0 && (
              <div className="p-8 text-center text-muted-foreground">
                {studentSearch || studentGenderFilter !== "all" || studentStatusFilter !== "all"
                  ? "No students match your filters."
                  : "No students in this class yet."}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Add Students Dialog */}
      <Dialog open={isAddStudentOpen} onOpenChange={setIsAddStudentOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add Students to {classData?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Select students from the unassigned list below:
            </p>

            {availableStudents.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">
                No unassigned students available.
              </div>
            ) : (
              <div className="border rounded-md">
                <div className="max-h-96 overflow-y-auto">
                  {availableStudents.map((student) => {
                    const isSelected = selectedStudents.has(student.id);
                    return (
                      <div
                        key={student.id}
                        className={`p-3 border-b hover:bg-muted/50 cursor-pointer flex items-center gap-3 ${isSelected ? "bg-blue-50" : ""
                          }`}
                        onClick={() => handleSelectStudent(student.id)}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleSelectStudent(student.id)}
                          className="cursor-pointer"
                        />
                        <div className="flex-1">
                          <p className="font-medium">
                            {student.first_name} {student.last_name}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {student.student_id} • {student.email}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="flex justify-between items-center">
              <p className="text-sm text-muted-foreground">
                {selectedStudents.size} student(s) selected
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setIsAddStudentOpen(false);
                    setSelectedStudents(new Set());
                  }}
                >
                  Cancel
                </Button>
                <Button
                  onClick={() => {
                    onAddStudents(Array.from(selectedStudents));
                    setSelectedStudents(new Set());
                  }}
                  disabled={selectedStudents.size === 0}
                >
                  Add {selectedStudents.size > 0 && `(${selectedStudents.size})`}
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Transfer Students Dialog */}
      <Dialog open={isTransferStudentOpen} onOpenChange={setIsTransferStudentOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Transfer Students</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Transfer {selectedStudents.size} student(s) to another class:
            </p>

            <select
              className="w-full border rounded-md p-2"
              value={transferTargetClassId}
              onChange={(e) => setTransferTargetClassId(e.target.value)}
            >
              <option value="">Select target class</option>
              {allClasses
                .filter((c) => c.id !== classData.id)
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} - {c.level}
                  </option>
                ))}
            </select>

            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setIsTransferStudentOpen(false);
                  setTransferTargetClassId("");
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={() => {
                  onTransferStudents(Array.from(selectedStudents), transferTargetClassId);
                  setSelectedStudents(new Set());
                  setIsTransferStudentOpen(false);
                  setTransferTargetClassId("");
                }}
                disabled={!transferTargetClassId}
              >
                Transfer
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Student Warning Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              <span className="flex items-center gap-2 text-red-700">
                <AlertTriangle className="h-5 w-5" />
                Delete Student Completely
              </span>
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-red-700 font-semibold">
              This will permanently delete <b>{studentToDelete?.first_name} {studentToDelete?.last_name}</b> and all related data:
            </p>
            <ul className="list-disc pl-6 text-sm text-red-600">
              <li>Student record</li>
              <li>Attendance, results, class assignments</li>
              <li>Session/term links</li>
              <li>Auth user account (cannot be undone)</li>
            </ul>
            <p className="text-sm text-muted-foreground">
              This action cannot be undone. Are you sure you want to proceed?
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="outline"
                onClick={() => setIsDeleteDialogOpen(false)}
                disabled={isDeleting}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={handleDeleteStudentCompletely}
                disabled={isDeleting}
              >
                {isDeleting ? "Deleting..." : "Delete Permanently"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

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

      {/* Edit Student Modal */}
      <EditStudentModal
        student={selectedStudent}
        isOpen={isEditStudentOpen}
        onClose={() => {
          setIsEditStudentOpen(false);
          setSelectedStudent(null);
        }}
        onSuccess={handleEditStudentSuccess}
      />
    </>
  );
}
