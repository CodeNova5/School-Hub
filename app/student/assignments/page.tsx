"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { DashboardLayout } from "@/components/dashboard-layout";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search, FileText, Calendar } from "lucide-react";
import { toast } from "sonner";
import { getCurrentUser } from "@/lib/auth";

interface Assignment {
  id: string;
  title: string;
  description: string;
  due_date: string;
  class_id: string;
  subject_id: string;
  created_at: string;
  classes?: { name: string; level: string };
  subjects?: { id: string; name: string };
  assignment_submissions: { graded_at: string; submitted_at: string }[];
}

export default function StudentAssignmentsPage() {
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [filteredAssignments, setFilteredAssignments] = useState<Assignment[]>([]);
  const [subjects, setSubjects] = useState<{ id: string; name: string }[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [subjectFilter, setSubjectFilter] = useState("all");

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [assignments, searchTerm, statusFilter, subjectFilter]);

  async function loadData() {
    setIsLoading(true);
    try {
      const user = await getCurrentUser();
      if (!user) {
        toast.error("Please log in to continue");
        return;
      }

      const { data: student } = await supabase
        .from("students")
        .select("id, class_id")
        .eq("user_id", user.id)
        .single();
        
      if (!student) {
          toast.error("Student profile not found");
          return;
      }

      const { data: assignmentData } = await supabase
        .from("assignments")
        .select(
          `
        *,
        subjects (*),
        classes (*),
        assignment_submissions (
          id,
          submitted_at,
          graded_at
        )
      `
        )
        .eq("class_id", student.class_id)
        .order("due_date", { ascending: false });

      if (assignmentData) {
        setAssignments(assignmentData as any);
        const uniqueSubjects = Array.from(new Set(assignmentData.map(a => a.subjects?.id)))
          .map(id => {
            return assignmentData.find(a => a.subjects?.id === id)?.subjects
          })
          .filter(Boolean);
        setSubjects(uniqueSubjects as any);
      }
    } catch (error: any) {
      toast.error("Failed to load assignments: " + error.message);
    } finally {
      setIsLoading(false);
    }
  }

  function getStatus(assignment: Assignment) {
    if (assignment.assignment_submissions && assignment.assignment_submissions.length > 0) {
      if (assignment.assignment_submissions[0].graded_at) {
        return "Graded";
      }
      return "Submitted";
    }
    return "Not Submitted";
  }
  
  function applyFilters() {
    let filtered = [...assignments];

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (a) =>
          a.title.toLowerCase().includes(term) ||
          a.description.toLowerCase().includes(term)
      );
    }
      
    if (statusFilter !== "all") {
        filtered = filtered.filter((a) => getStatus(a) === statusFilter);
    }

    if (subjectFilter !== "all") {
        filtered = filtered.filter((a) => a.subjects?.id === subjectFilter);
    }

    setFilteredAssignments(filtered);
  }
  
  function getDaysUntilDue(dueDate: string): number {
    const due = new Date(dueDate);
    const today = new Date();
    const diff = due.getTime() - today.getTime();
    return Math.ceil(diff / (1000 * 3600 * 24));
  }

  function getDueStatus(dueDate: string) {
    const days = getDaysUntilDue(dueDate);
    if (days < 0) return { label: "Overdue", color: "bg-red-100 text-red-700" };
    if (days === 0) return { label: "Due Today", color: "bg-orange-100 text-orange-700" };
    if (days <= 3) return { label: `Due in ${days} days`, color: "bg-yellow-100 text-yellow-700" };
    return { label: `Due in ${days} days`, color: "bg-green-100 text-green-700" };
  }

  if (isLoading) {
    return (
      <DashboardLayout role="student">
        <div className="flex items-center justify-center h-96">
          <p className="text-gray-500">Loading assignments...</p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout role="student">
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold">My Assignments</h1>
          <p className="text-gray-600 mt-1">
            View and manage your assignments
          </p>
        </div>
        
        <Card>
          <CardHeader>
            <CardTitle>Filters</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search by title or description..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                    <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value="Not Submitted">Not Submitted</SelectItem>
                    <SelectItem value="Submitted">Submitted</SelectItem>
                    <SelectItem value="Graded">Graded</SelectItem>
                </SelectContent>
            </Select>
            <Select value={subjectFilter} onValueChange={setSubjectFilter}>
                <SelectTrigger>
                    <SelectValue placeholder="Filter by subject" />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="all">All Subjects</SelectItem>
                    {subjects.map(subject => (
                        <SelectItem key={subject.id} value={subject.id}>{subject.name}</SelectItem>
                    ))}
                </SelectContent>
            </Select>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>
              {filteredAssignments.length} Assignment{filteredAssignments.length !== 1 ? 's' : ''}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {filteredAssignments.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <FileText className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                <p>No assignments found</p>
                <p className="text-sm mt-1">Try adjusting your filters</p>
              </div>
            ) : (
              <div className="space-y-4">
                {filteredAssignments.map((assignment) => {
                  const dueStatus = getDueStatus(assignment.due_date);
                  const status = getStatus(assignment);
                  return (
                    <div
                      key={assignment.id}
                      className="border rounded-lg p-4 hover:shadow-md transition-shadow"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <h3 className="font-semibold text-lg mb-2">
                            {assignment.title}
                          </h3>
                          <p className="text-gray-600 text-sm mb-3">
                            {assignment.description}
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {assignment.subjects && (
                              <Badge variant="secondary" className="text-xs">
                                {assignment.subjects.name}
                              </Badge>
                            )}
                            <Badge className={`${dueStatus.color} text-xs`}>
                              <Calendar className="h-3 w-3 mr-1 inline" />
                              {dueStatus.label}
                            </Badge>
                             <Badge variant={status === 'Graded' ? 'default' : 'outline'}>{status}</Badge>
                          </div>
                        </div>
                        <div className="flex flex-col gap-2">
                          <Link href={`/student/assignments/${assignment.id}`}>
                            <Button variant="outline" size="sm">
                              View Details
                            </Button>
                          </Link>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
