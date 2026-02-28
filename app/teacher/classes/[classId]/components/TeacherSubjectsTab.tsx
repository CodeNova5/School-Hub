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
import { Button } from "@/components/ui/button";
import { Search, MoreVertical, Eye, BarChart3 } from "lucide-react";
import { useRouter } from "next/navigation";

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

export default function TeacherSubjectsTab({
  classId,
  subjects,
  onRefresh,
}: TeacherSubjectsTabProps) {
  const [search, setSearch] = useState("");

  const router = useRouter();

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
    // Navigate to subject analytics page
    router.push(`/teacher/subjects/${subject.id}/analytics`);
  }

  return (
    <>
      <Card>
        <CardHeader className="p-4 sm:p-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
            <CardTitle className="text-lg sm:text-xl">Class Subjects ({subjects.length})</CardTitle>
            <Button size="sm" variant="outline" onClick={onRefresh} className="text-xs sm:text-sm h-9 sm:h-10 w-full sm:w-auto">
              Refresh
            </Button>
          </div>
        </CardHeader>

        <CardContent className="space-y-3 sm:space-y-4 p-4 sm:p-6">
          {/* Search */}
          <div className="relative">
            <Search className="h-3 w-3 sm:h-4 sm:w-4 absolute left-2.5 sm:left-3 top-2.5 sm:top-3 text-muted-foreground" />
            <Input
              placeholder="Search subjects..."
              className="pl-8 sm:pl-9 h-9 sm:h-10 text-sm"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          {/* Subjects Table */}
          <div className="border rounded-md overflow-hidden">
            {/* Desktop Table */}
            <div className="hidden lg:block overflow-x-auto">
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
                            <Button variant="ghost" size="icon" className="h-8 w-8">
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

            {/* Mobile Card Layout */}
            <div className="lg:hidden space-y-3 p-3">
              {filteredSubjects.length === 0 && subjects.length > 0 ? (
                <div className="p-8 text-center text-sm text-muted-foreground">
                  No subjects match your search
                </div>
              ) : filteredSubjects.length === 0 ? (
                <div className="p-8 text-center text-sm text-muted-foreground">
                  No subjects assigned to this class
                </div>
              ) : (
                filteredSubjects.map((subject) => (
                  <div key={subject.id} className="border rounded-lg p-4 space-y-3 bg-white shadow-sm">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <Badge variant="outline" className="text-xs font-mono shrink-0">
                            {subject.subject_code}
                          </Badge>
                          <Badge variant={subject.subject.is_optional ? "secondary" : "default"} className="text-xs shrink-0">
                            {subject.subject.is_optional ? "Optional" : "Compulsory"}
                          </Badge>
                        </div>
                        <p className="font-medium text-sm sm:text-base truncate">
                          {subject.subject.name}
                        </p>
                      </div>
                    </div>

                    <div className="space-y-2 py-2 border-y">
                      <div>
                        <p className="text-xs text-muted-foreground font-medium">Teacher</p>
                        <p className="text-sm font-medium mt-0.5">
                          {subject.teacher ? (
                            <span>
                              {subject.teacher.first_name} {subject.teacher.last_name}
                            </span>
                          ) : (
                            <span className="text-muted-foreground italic">Unassigned</span>
                          )}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between">
                      <Badge variant="outline" className={`text-xs ${subject.teacher ? "bg-green-50 text-green-700 border-green-200" : "bg-yellow-50 text-yellow-700 border-yellow-200"}`}>
                        {subject.teacher ? "Assigned" : "Pending"}
                      </Badge>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleViewAnalysis(subject)}
                        className="text-xs h-8"
                      >
                        <BarChart3 className="mr-1 h-3 w-3" />
                        Analyze
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </CardContent>
      </Card>


    </>
  );
}
