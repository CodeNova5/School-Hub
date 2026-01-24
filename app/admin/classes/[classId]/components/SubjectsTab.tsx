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
import { Search, Copy, MoreVertical, BarChart3, User, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

type SubjectClass = {
  id: string;
  subject_code: string;
  subject: {
    id: string;
    name: string;
    is_optional: boolean;
    religion?: string | null;
    department?: string | null;
  };
  teacher: {
    id: string;
    first_name: string;
    last_name: string;
  } | null;
};

type Teacher = {
  id: string;
  first_name: string;
  last_name: string;
};

interface SubjectsTabProps {
  subjects: SubjectClass[];
  teachers: Teacher[];
  onGenerateCodes: () => void;
  onAssignTeacher: (subjectClassId: string, teacherId: string) => void;
  onDeleteSubject: (subjectClassId: string) => void;
}

export function SubjectsTab({
  subjects,
  teachers,
  onGenerateCodes,
  onAssignTeacher,
  onDeleteSubject,
}: SubjectsTabProps) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [filterOptional, setFilterOptional] = useState<"all" | "optional" | "compulsory">("all");
  const [filterReligion, setFilterReligion] = useState<"all" | "Christian" | "Muslim">("all");
  const [filterDepartment, setFilterDepartment] = useState<"all" | "Science" | "Arts" | "Commercial">("all");

  const [isAssignTeacherOpen, setIsAssignTeacherOpen] = useState(false);
  const [selectedSubjectClass, setSelectedSubjectClass] = useState<SubjectClass | null>(null);
  const [selectedTeacherId, setSelectedTeacherId] = useState<string>("");

  const filteredSubjects = useMemo(() => {
    return subjects.filter((s) => {
      if (!s.subject) return false;
      if (search && !s.subject.name.toLowerCase().includes(search.toLowerCase())) return false;
      if (filterOptional === "optional" && !s.subject.is_optional) return false;
      if (filterOptional === "compulsory" && s.subject.is_optional) return false;
      if (filterReligion !== "all" && s.subject.religion !== filterReligion) return false;
      if (filterDepartment !== "all" && s.subject.department !== filterDepartment) return false;
      return true;
    });
  }, [subjects, search, filterOptional, filterReligion, filterDepartment]);

  function openAssignTeacherDialog(sc: SubjectClass) {
    setSelectedSubjectClass(sc);
    setSelectedTeacherId(sc.teacher?.id || "");
    setIsAssignTeacherOpen(true);
  }

  function handleAssignTeacher() {
    if (!selectedSubjectClass || !selectedTeacherId) return;
    onAssignTeacher(selectedSubjectClass.id, selectedTeacherId);
    setIsAssignTeacherOpen(false);
  }

  function handleDeleteSubjectClass(sc: SubjectClass) {
    if (!confirm(`Remove ${sc.subject.name} from this class?`)) return;
    onDeleteSubject(sc.id);
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex justify-between items-center">
            <span>Class Subjects</span>
            <Button variant="outline" size="sm" onClick={onGenerateCodes}>
              Generate Missing Codes
            </Button>
          </CardTitle>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Filter Bar */}
          <div className="flex flex-col md:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="h-4 w-4 absolute left-3 top-3 text-muted-foreground" />
              <Input
                placeholder="Search subject..."
                className="pl-9"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            <select
              className="border rounded-md p-2"
              value={filterOptional}
              onChange={(e) => setFilterOptional(e.target.value as any)}
            >
              <option value="all">All</option>
              <option value="compulsory">Compulsory</option>
              <option value="optional">Optional</option>
            </select>

            <select
              className="border rounded-md p-2"
              value={filterDepartment}
              onChange={(e) => setFilterDepartment(e.target.value as any)}
            >
              <option value="all">All Departments</option>
              <option value="Science">Science</option>
              <option value="Arts">Arts</option>
              <option value="Commercial">Commercial</option>
            </select>
          </div>

          {/* Table */}
          <div className="border rounded-md overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted">
                <tr>
                  <th className="p-3 text-left w-12">#</th>
                  <th className="p-3 text-left">Subject</th>
                  <th className="p-3 text-left">Code</th>
                  <th className="p-3 text-left">Teacher</th>
                  <th className="p-3 text-left">Type</th>
                  <th className="p-3 text-right w-12"></th>
                </tr>
              </thead>
              <tbody>
                {filteredSubjects.map((sc, i) => (
                  <tr key={sc.id} className="border-t hover:bg-muted/50">
                    <td className="p-3">{i + 1}</td>
                    <td className="p-3 font-medium">
                      <span>{sc.subject.name}</span>
                    </td>
                    <td className="p-3 font-mono flex items-center gap-2">
                      {sc.subject_code}
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => {
                          navigator.clipboard.writeText(sc.subject_code);
                          toast.success("Copied");
                        }}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    </td>
                    <td className="p-3">
                      {sc.teacher ? `${sc.teacher.first_name} ${sc.teacher.last_name}` : "—"}
                    </td>
                    <td className="p-3">
                      {sc.subject?.is_optional ? (
                        <Badge variant="secondary">Optional</Badge>
                      ) : (
                        <Badge>Compulsory</Badge>
                      )}
                    </td>
                    <td className="p-3 text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>

                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() => router.push(`/admin/subject-classes/${sc.id}/analytics`)}
                          >
                            <BarChart3 className="mr-2 h-4 w-4" />
                            View Analysis
                          </DropdownMenuItem>

                          <DropdownMenuItem onClick={() => openAssignTeacherDialog(sc)}>
                            <User className="mr-2 h-4 w-4" />
                            Assign Teacher
                          </DropdownMenuItem>

                          <DropdownMenuItem
                            className="text-red-600 focus:text-red-600"
                            onClick={() => handleDeleteSubjectClass(sc)}
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {filteredSubjects.length === 0 && (
              <div className="p-8 text-center text-muted-foreground">
                No subjects match your filters.
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Assign Teacher Dialog */}
      <Dialog open={isAssignTeacherOpen} onOpenChange={setIsAssignTeacherOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign Teacher to {selectedSubjectClass?.subject.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <select
              className="w-full border rounded-md p-2"
              value={selectedTeacherId}
              onChange={(e) => setSelectedTeacherId(e.target.value)}
            >
              <option value="">Select teacher</option>
              {teachers.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.first_name} {t.last_name}
                </option>
              ))}
            </select>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setIsAssignTeacherOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleAssignTeacher}>Save</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
