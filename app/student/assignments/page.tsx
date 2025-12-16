"use client";

import { DashboardLayout } from '@/components/dashboard-layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { getCurrentUser } from '@/lib/auth';
import { Search, FileText, Calendar, Upload } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface Assignment {
  id: string;
  title: string;
  description: string;
  instructions: string;
  due_date: string;
  subjects?: { name: string };
  classes?: { name: string };
}

interface Submission {
  assignment_id: string;
  submitted_at?: string;
  grade?: number;
  feedback?: string;
  submitted_on_time?: boolean;
}

export default function StudentAssignmentsPage() {
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [submissions, setSubmissions] = useState<Record<string, Submission>>({});
  const [filteredAssignments, setFilteredAssignments] = useState<Assignment[]>([]);
  const [studentId, setStudentId] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [assignments, searchTerm]);

  async function loadData() {
    setIsLoading(true);
    try {
      const user = await getCurrentUser();
      if (!user) {
        toast.error('Please log in to continue');
        return;
      }

      const { data: studentData } = await supabase
        .from('students')
        .select('id')
        .eq('user_id', user.id)
        .single();

      if (!studentData) {
        toast.error('Student profile not found');
        return;
      }

      setStudentId(studentData.id);

      const { data: classData } = await supabase
        .from('students')
        .select('class_id')
        .eq('id', studentData.id)
        .single();

      if (!classData?.class_id) {
        toast.error('Class not assigned');
        return;
      }

      const { data: assignmentData } = await supabase
        .from('assignments')
        .select('*, subjects(*), classes(*)')
        .eq('class_id', classData.class_id)
        .order('due_date', { ascending: true });

      if (assignmentData) {
        setAssignments(assignmentData as any);
      }

      const { data: submissionData } = await supabase
        .from('assignment_submissions')
        .select('*')
        .eq('student_id', studentData.id);

      const submissionsMap: Record<string, Submission> = {};
      submissionData?.forEach(sub => {
        submissionsMap[sub.assignment_id] = sub;
      });
      setSubmissions(submissionsMap);
    } catch (error: any) {
      toast.error('Failed to load assignments: ' + error.message);
    } finally {
      setIsLoading(false);
    }
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
    if (days < 0) return { label: 'Overdue', color: 'bg-red-100 text-red-700' };
    if (days === 0) return { label: 'Due Today', color: 'bg-orange-100 text-orange-700' };
    if (days <= 3) return { label: `Due in ${days} days`, color: 'bg-yellow-100 text-yellow-700' };
    return { label: `Due in ${days} days`, color: 'bg-green-100 text-green-700' };
  }

  function getSubmissionStatus(assignment: Assignment) {
    const sub = submissions[assignment.id];
    if (!sub) return 'Not Submitted';
    if (sub.grade !== null && sub.grade !== undefined) return `Graded: ${sub.grade}%`;
    return sub.submitted_on_time ? 'Submitted' : 'Submitted Late';
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
          <h1 className="text-3xl font-bold">Assignments</h1>
          <p className="text-gray-600 mt-1">
            View and submit your assignments
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Search Assignments</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search by title or description..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
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
                <p>No assignments yet</p>
                <p className="text-sm mt-1">Your assignments will appear here</p>
              </div>
            ) : (
              <div className="space-y-4">
                {filteredAssignments.map((assignment) => {
                  const dueStatus = getDueStatus(assignment.due_date);
                  const submissionStatus = getSubmissionStatus(assignment);
                  const sub = submissions[assignment.id];

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
                          <p className="text-gray-600 text-sm mb-3">
                            {assignment.instructions}
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
                            {sub?.grade !== null && sub?.grade !== undefined && (
                              <Badge className="bg-green-100 text-green-700 text-xs">
                                Grade: {sub.grade}%
                              </Badge>
                            )}
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-2">
                          <Badge
                            variant={sub ? 'default' : 'outline'}
                            className={sub?.grade ? 'bg-green-100 text-green-700' : ''}
                          >
                            {submissionStatus}
                          </Badge>
                          {sub?.feedback && (
                            <div className="text-xs bg-blue-50 p-2 rounded border border-blue-200 max-w-xs">
                              <p className="font-medium text-blue-900">Feedback:</p>
                              <p className="text-blue-800">{sub.feedback}</p>
                            </div>
                          )}
                          {!sub && (
                            <Button size="sm">
                              <Upload className="h-4 w-4 mr-2" />
                              Submit
                            </Button>
                          )}
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
