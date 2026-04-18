"use client";

import { useState, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Search, RotateCcw, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

interface Student {
  id: string;
  student_id: string;
  first_name: string;
  last_name: string;
  gender: string;
  attendanceStatus: "present" | "absent" | "late" | "excused" | "not_marked";
}

interface AttendanceMarkingModalProps {
  open: boolean;
  className: string;
  students: Student[];
  onUpdateAttendance: (studentId: string, status: Student["attendanceStatus"]) => void;
  onMarkAllPresent: () => void;
  onReset: () => void;
  onClose: () => void;
}

const statusColors = {
  present: "bg-emerald-100 text-emerald-800",
  absent: "bg-red-100 text-red-800",
  late: "bg-amber-100 text-amber-800",
  excused: "bg-blue-100 text-blue-800",
  not_marked: "bg-slate-100 text-slate-800",
};

const statusOptions = [
  { value: "not_marked", label: "Not Marked" },
  { value: "present", label: "Present" },
  { value: "absent", label: "Absent" },
  { value: "late", label: "Late" },
  { value: "excused", label: "Excused" },
] as const;

export function AttendanceMarkingModal({
  open,
  className,
  students,
  onUpdateAttendance,
  onMarkAllPresent,
  onReset,
  onClose,
}: AttendanceMarkingModalProps) {
  const [searchTerm, setSearchTerm] = useState("");

  const filteredStudents = useMemo(() => {
    if (!searchTerm.trim()) return students;
    const term = searchTerm.toLowerCase();
    return students.filter(
      (s) =>
        s.first_name.toLowerCase().includes(term) ||
        s.last_name.toLowerCase().includes(term) ||
        s.student_id.toLowerCase().includes(term)
    );
  }, [students, searchTerm]);

  const markedCount = filteredStudents.filter(
    (s) => s.attendanceStatus !== "not_marked"
  ).length;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-xl">{className}</DialogTitle>
          <p className="text-sm text-gray-500 mt-1">
            {markedCount}/{filteredStudents.length} marked
          </p>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto">
          <div className="space-y-4 px-6">
            {/* Search Bar */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search by name or student ID..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>

            {/* Quick Actions */}
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  onMarkAllPresent();
                  toast.success(`All students marked as present`);
                }}
                className="flex items-center gap-2"
              >
                <CheckCircle2 className="h-4 w-4" />
                Mark All Present
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  onReset();
                  setSearchTerm("");
                }}
                className="flex items-center gap-2"
              >
                <RotateCcw className="h-4 w-4" />
                Reset
              </Button>
            </div>

            {/* Students Table */}
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader className="bg-gray-50">
                  <TableRow>
                    <TableHead className="w-12">#</TableHead>
                    <TableHead>Student ID</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead className="w-20">Gender</TableHead>
                    <TableHead className="w-32">Status</TableHead>
                    <TableHead className="w-48">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredStudents.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-gray-500">
                        {searchTerm ? "No students found matching your search" : "No students in this class"}
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredStudents.map((student, index) => (
                      <TableRow key={student.id} className="hover:bg-gray-50">
                        <TableCell className="text-xs text-gray-600">{index + 1}</TableCell>
                        <TableCell className="text-sm font-medium">{student.student_id}</TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium text-sm">
                              {student.first_name} {student.last_name}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell className="text-xs text-gray-600 capitalize">
                          {student.gender || "N/A"}
                        </TableCell>
                        <TableCell>
                          <span
                            className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                              statusColors[student.attendanceStatus]
                            }`}
                          >
                            {student.attendanceStatus.replace("_", " ").toUpperCase()}
                          </span>
                        </TableCell>
                        <TableCell>
                          <select
                            value={student.attendanceStatus}
                            onChange={(e) =>
                              onUpdateAttendance(
                                student.id,
                                e.target.value as Student["attendanceStatus"]
                              )
                            }
                            className="px-3 py-1.5 border rounded-md text-xs font-medium bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                          >
                            {statusOptions.map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </div>

        <DialogFooter className="px-6 py-4 border-t">
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
