"use client";

import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Button } from "@/components/ui/button";
import { Search, MoreVertical, Eye, BarChart3 } from "lucide-react";
import { toast } from "sonner";

type Subject = {
  id: string;
  name: string;
  is_optional: boolean;
  religion?: string | null;
  department?: string | null;
};

type SubjectClass = {
  id: string;
  subject_code: string;
  subject: Subject;
  teacher: {
    id: string;
    first_name: string;
    last_name: string;
  } | null;
};

interface TeacherSubjectsTabProps {
  classId: string;
  subjects: SubjectClass[];
  onRefresh: () => void;
}

// Skeleton loader
function SubjectSkeleton() {
  return (
    <tr className="border-t">
      <td className="p-3"><div className="h-4 bg-gray-200 rounded w-24 animate-pulse"></div></td>
      <td className="p-3"><div className="h-4 bg-gray-200 rounded w-32 animate-pulse"></div></td>
      <td className="p-3"><div className="h-4 bg-gray-200 rounded w-28 animate-pulse"></div></td>
      <td className="p-3"><div className="h-4 bg-gray-200 rounded w-32 animate-pulse"></div></td>
      <td className="p-3"><div className="h-4 bg-gray-200 rounded w-16 animate-pulse"></div></td>
      <td className="p-3 text-right"><div className="h-8 bg-gray-200 rounded w-10 float-right animate-pulse"></div></td>
    </tr>
  );
}

export default function TeacherSubjectsTab({
  classId,
  subjects,
  onRefresh,
}: TeacherSubjectsTabProps) {
  const [search, setSearch] = useState("");
  const [selectedSubject, setSelectedSubject] = useState<SubjectClass | null>(null);
  const [isAnalysisOpen, setIsAnalysisOpen] = useState(false);

  const filteredSubjects = useMemo(() => {
    return subjects.filter((s) => {
      const searchTerm = search.toLowerCase();
      return (
        s.subject.name.toLowerCase().includes(searchTerm) ||
        s.subject_code.toLowerCase().includes(searchTerm)
      );
    });
  }, [subjects, search]);

  function handleViewAnalysis(subject: SubjectClass) {
    setSelectedSubject(subject);
    setIsAnalysisOpen(true);
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <CardTitle>Class Subjects ({subjects.length})</CardTitle>
            <Button size="sm" variant="outline" onClick={onRefresh}>
              Refresh
            </Button>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Search */}
          <div className="relative">
            <Search className="h-4 w-4 absolute left-3 top-3 text-muted-foreground" />
            <Input
              placeholder="Search subjects..."
              className="pl-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          {/* Subjects Table */}
          <div className="border rounded-md overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted">
                <tr>
                  <th className="p-3 text-left">Subject Code</th>
                  <th className="p-3 text-left">Subject Name</th>
                  <th className="p-3 text-left">Type</th>
                  <th className="p-3 text-left">Teacher</th>
                  <th className="p-3 text-center">Status</th>
                  <th className="p-3 text-right w-12"></th>
                </tr>
              </thead>
              <tbody>
                {filteredSubjects.length === 0 && subjects.length > 0 ? (
                  <tr className="border-t hover:bg-muted/50">
                    <td colSpan={6} className="p-8 text-center text-muted-foreground">
                      No subjects match your search
                    </td>
                  </tr>
                ) : filteredSubjects.length === 0 ? (
                  <tr className="border-t hover:bg-muted/50">
                    <td colSpan={6} className="p-8 text-center text-muted-foreground">
                      No subjects assigned to this class
                    </td>
                  </tr>
                ) : (
                  filteredSubjects.map((subject) => (
                    <tr key={subject.id} className="border-t hover:bg-muted/50">
                      <td className="p-3 font-mono text-xs font-semibold">
                        {subject.subject_code}
                      </td>
                      <td className="p-3 font-medium">{subject.subject.name}</td>
                      <td className="p-3">
                        <Badge variant={subject.subject.is_optional ? "secondary" : "default"}>
                          {subject.subject.is_optional ? "Optional" : "Compulsory"}
                        </Badge>
                      </td>
                      <td className="p-3 text-sm">
                        {subject.teacher ? (
                          <span>
                            {subject.teacher.first_name} {subject.teacher.last_name}
                          </span>
                        ) : (
                          <span className="text-muted-foreground italic">Unassigned</span>
                        )}
                      </td>
                      <td className="p-3 text-center">
                        <Badge variant="outline" className="text-xs">
                          {subject.teacher ? "Assigned" : "Pending"}
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
                            <DropdownMenuItem
                              onClick={() => handleViewAnalysis(subject)}
                            >
                              <BarChart3 className="mr-2 h-4 w-4" />
                              View Analysis
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
        </CardContent>
      </Card>

      {/* Subject Analysis Dialog */}
      <Dialog open={isAnalysisOpen} onOpenChange={setIsAnalysisOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {selectedSubject?.subject.name} - Analysis
            </DialogTitle>
          </DialogHeader>

          {selectedSubject && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-blue-50 rounded-lg">
                  <p className="text-sm text-blue-600 font-medium">Subject Code</p>
                  <p className="text-2xl font-bold text-blue-900">{selectedSubject.subject_code}</p>
                </div>
                <div className="p-4 bg-purple-50 rounded-lg">
                  <p className="text-sm text-purple-600 font-medium">Type</p>
                  <p className="text-2xl font-bold text-purple-900">
                    {selectedSubject.subject.is_optional ? "Optional" : "Compulsory"}
                  </p>
                </div>
              </div>

              {selectedSubject.teacher && (
                <div className="p-4 bg-green-50 rounded-lg">
                  <p className="text-sm text-green-600 font-medium">Assigned Teacher</p>
                  <p className="text-lg font-semibold text-green-900">
                    {selectedSubject.teacher.first_name} {selectedSubject.teacher.last_name}
                  </p>
                </div>
              )}

              {selectedSubject.subject.department && (
                <div className="p-4 bg-amber-50 rounded-lg">
                  <p className="text-sm text-amber-600 font-medium">Department</p>
                  <p className="text-lg font-semibold text-amber-900">
                    {selectedSubject.subject.department}
                  </p>
                </div>
              )}

              <div className="border rounded-lg p-4 bg-gray-50">
                <p className="text-sm font-semibold text-gray-700 mb-3">Additional Information</p>
                <ul className="space-y-2 text-sm">
                  <li className="flex items-center gap-2">
                    <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                    <span>Subject is available for students in this class</span>
                  </li>
                  {selectedSubject.subject.religion && (
                    <li className="flex items-center gap-2">
                      <span className="w-2 h-2 bg-purple-500 rounded-full"></span>
                      <span>Religion-based subject: {selectedSubject.subject.religion}</span>
                    </li>
                  )}
                  <li className="flex items-center gap-2">
                    <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                    <span>
                      {selectedSubject.teacher 
                        ? `Taught by ${selectedSubject.teacher.first_name} ${selectedSubject.teacher.last_name}` 
                        : "Currently unassigned to any teacher"}
                    </span>
                  </li>
                </ul>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
