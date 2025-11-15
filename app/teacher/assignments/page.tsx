"use client";

import { DashboardLayout } from '@/components/dashboard-layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Plus, FileText } from 'lucide-react';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Assignment } from '@/lib/types';

export default function AssignmentsPage() {
  const [assignments, setAssignments] = useState<Assignment[]>([]);

  useEffect(() => {
    fetchAssignments();
  }, []);

  async function fetchAssignments() {
    const { data } = await supabase
      .from('assignments')
      .select('*')
      .order('due_date', { ascending: true });
    if (data) setAssignments(data);
  }

  return (
    <DashboardLayout role="teacher">
      <div className="space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Assignments</h1>
            <p className="text-gray-600 mt-1">Create and manage assignments</p>
          </div>
          <Button><Plus className="mr-2 h-4 w-4" />Create Assignment</Button>
        </div>

        <div className="space-y-4">
          {assignments.map((assignment) => {
            const dueDate = new Date(assignment.due_date);
            const isOverdue = dueDate < new Date();

            return (
              <Card key={assignment.id}>
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex gap-4">
                      <div className="h-12 w-12 rounded-lg bg-blue-50 flex items-center justify-center">
                        <FileText className="h-6 w-6 text-blue-600" />
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold">{assignment.title}</h3>
                        <p className="text-gray-600 mt-1">{assignment.description}</p>
                        <div className="flex gap-4 mt-3 text-sm">
                          <p className="text-gray-500">
                            Due: {dueDate.toLocaleDateString()}
                          </p>
                          <p className="text-gray-500">
                            Total Marks: {assignment.total_marks}
                          </p>
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Badge variant={isOverdue ? 'destructive' : 'default'}>
                        {isOverdue ? 'Overdue' : 'Active'}
                      </Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}

          {assignments.length === 0 && (
            <Card>
              <CardContent className="p-12 text-center">
                <p className="text-gray-500">No assignments yet</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
