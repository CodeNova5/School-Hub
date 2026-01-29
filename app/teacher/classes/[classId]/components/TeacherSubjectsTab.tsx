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
    router.push(`/teacher/subjects/${subject.subject.id}/analytics`);
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


    </>
  );
}
