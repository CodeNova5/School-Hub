"use client";

import { DashboardLayout } from '@/components/dashboard-layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { getCurrentUser, getTeacherByUserId } from '@/lib/auth';
import { AssignmentModal } from '@/components/assignment-modal';
import { Search, Plus, FileText, Trash2, Calendar } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
interface Assignment {
  id: string;
  title: string;
  description: string;
  due_date: string;
  class_id: string;
  subject_id: string;
  created_at: string;
  classes?: { name: string; level: string };
  subjects?: { name: string };
}

export default function AssignmentsPage() {
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [filteredAssignments, setFilteredAssignments] = useState<Assignment[]>([]);
  const [teacherId, setTeacherId] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const ITEMS_PER_PAGE = 10;

  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // filters
  const [selectedClass, setSelectedClass] = useState<string>('all');
  const [gradedStatus, setGradedStatus] = useState<'all' | 'graded' | 'ungraded'>('all');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  // derived
  const totalPages = Math.ceil(totalCount / ITEMS_PER_PAGE);

  useEffect(() => {
    loadData(1);
  }, [searchTerm, selectedClass, gradedStatus, startDate, endDate]);


  useEffect(() => {
    applyFilters();
  }, [assignments, searchTerm]);

  async function loadData(page = 1) {
    setIsLoading(true);
    try {
      const user = await getCurrentUser();
      if (!user) return toast.error('Please log in');

      const teacher = await getTeacherByUserId(user.id);
      if (!teacher) return toast.error('Teacher profile not found');

      setTeacherId(teacher.id);

      let query = supabase
        .from('assignments')
        .select('*, classes(*), subjects(*)', { count: 'exact' })
        .eq('teacher_id', teacher.id);

      if (selectedClass !== 'all') {
        query = query.eq('class_id', selectedClass);
      }

      if (gradedStatus !== 'all') {
        query =
          gradedStatus === 'graded'
            ? query.eq('is_graded', true)
            : query.eq('is_graded', false);
      }

      if (startDate) query = query.gte('due_date', startDate);
      if (endDate) query = query.lte('due_date', endDate);

      if (searchTerm) {
        query = query.or(
          `title.ilike.%${searchTerm}%,description.ilike.%${searchTerm}%`
        );
      }

      const from = (page - 1) * ITEMS_PER_PAGE;
      const to = from + ITEMS_PER_PAGE - 1;

      const { data, count, error } = await query
        .order('due_date', { ascending: false })
        .range(from, to);

      if (error) throw error;

      setAssignments(data || []);
      setFilteredAssignments(data || []);
      setTotalCount(count || 0);
      setCurrentPage(page);
    } catch (err: any) {
      toast.error(err.message);
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

  async function handleDelete(id: string) {
    if (!confirm('Are you sure you want to delete this assignment?')) return;

    try {
      const { error } = await supabase
        .from('assignments')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast.success('Assignment deleted successfully');
      setAssignments(assignments.filter(a => a.id !== id));
    } catch (error: any) {
      toast.error('Failed to delete assignment: ' + error.message);
    }
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

  function AssignmentSkeleton() {
    return (
      <div className="border rounded-lg p-4 space-y-4 skeleton">
        {/* Title */}
        <div className="h-5 w-2/3 bg-gray-200 rounded" />

        {/* Description */}
        <div className="space-y-2">
          <div className="h-4 w-full bg-gray-200 rounded" />
          <div className="h-4 w-5/6 bg-gray-200 rounded" />
        </div>

        {/* Badges */}
        <div className="flex gap-2">
          <div className="h-5 w-20 bg-gray-200 rounded-full" />
          <div className="h-5 w-24 bg-gray-200 rounded-full" />
          <div className="h-5 w-28 bg-gray-200 rounded-full" />
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2 pt-2">
          <div className="h-8 w-24 bg-gray-200 rounded" />
          <div className="h-8 w-10 bg-gray-200 rounded" />
        </div>
      </div>
    );
  }

  function AssignmentSkeletonList() {
    return (
      <div className="space-y-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <AssignmentSkeleton key={i} />
        ))}
      </div>
    );
  }



  if (isLoading) {
    return (
      <DashboardLayout role="teacher">
        <div className="space-y-8">
          {/* Header skeleton */}
          <div className="flex justify-between items-center">
            <div className="space-y-2">
              <div className="h-7 w-48 bg-gray-200 rounded skeleton" />
              <div className="h-4 w-72 bg-gray-200 rounded skeleton" />
            </div>
            <div className="h-10 w-44 bg-gray-200 rounded skeleton" />
          </div>

          {/* Filters skeleton */}
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <div
                key={i}
                className="h-10 bg-gray-200 rounded skeleton"
              />
            ))}
          </div>

          {/* List skeleton */}
          <AssignmentSkeletonList />
        </div>
      </DashboardLayout>
    );
  }



  return (
    <DashboardLayout role="teacher">
      <div className="space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Assignments</h1>
            <p className="text-gray-600 mt-1">
              Create and manage assignments for your classes
            </p>
          </div>
          <Button onClick={() => setIsModalOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Create Assignment
          </Button>
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
            <CardTitle>Filters</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <Input
              placeholder="Search..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />

            <Input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />

            <Input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />

            <select
              className="border rounded-md px-3 py-2"
              value={gradedStatus}
              onChange={(e) => setGradedStatus(e.target.value as any)}
            >
              <option value="all">All</option>
              <option value="graded">Graded</option>
              <option value="ungraded">Ungraded</option>
            </select>

            <Button
              variant="outline"
              onClick={() => {
                setSearchTerm('');
                setSelectedClass('all');
                setGradedStatus('all');
                setStartDate('');
                setEndDate('');
              }}
            >
              Clear
            </Button>
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
                <p className="text-sm mt-1">Create your first assignment to get started</p>
              </div>
            ) : (
              <div className="space-y-4">
                {filteredAssignments.map((assignment) => {
                  const dueStatus = getDueStatus(assignment.due_date);
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
                            {assignment.classes && (
                              <Badge variant="outline" className="text-xs">
                                {assignment.classes.name}
                              </Badge>
                            )}
                            {assignment.subjects && (
                              <Badge variant="secondary" className="text-xs">
                                {assignment.subjects.name}
                              </Badge>
                            )}
                            <Badge className={`${dueStatus.color} text-xs`}>
                              <Calendar className="h-3 w-3 mr-1 inline" />
                              {dueStatus.label}
                            </Badge>
                          </div>
                        </div>
                        <div className="flex flex-col gap-2">
                          <Link href={`/teacher/assignments/${assignment.id}`}>
                            <Button variant="outline" size="sm">
                              View Details
                            </Button>
                          </Link>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => handleDelete(assignment.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
        {totalPages > 1 && (
          <div className="flex items-center justify-between pt-6">
            <p className="text-sm text-gray-500">
              Page {currentPage} of {totalPages}
            </p>

            <div className="flex gap-2">
              <Button
                variant="outline"
                disabled={currentPage === 1}
                onClick={() => loadData(currentPage - 1)}
              >
                Previous
              </Button>

              <Button
                variant="outline"
                disabled={currentPage === totalPages}
                onClick={() => loadData(currentPage + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        )}

      </div>

      <AssignmentModal
        open={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={loadData}
        teacherId={teacherId}
      />
    </DashboardLayout>
  );
}
