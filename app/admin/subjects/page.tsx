"use client";

import { useEffect, useMemo, useState } from 'react';
import { DashboardLayout } from '@/components/dashboard-layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Plus, Search, Edit, Trash2, BookOpen, MoreVertical, Layers } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Subject, Teacher } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Switch } from '@/components/ui/switch';
import { useSchoolContext } from '@/hooks/use-school-context';
import { useSchoolConfig } from '@/hooks/use-school-config';

type SchoolClassOption = {
  id: string;
  name: string;
};

type ExistingAssignment = {
  class_id: string;
  teacher_id: string | null;
  department_id: string | null;
  religion_id: string | null;
  is_optional: boolean | null;
  full_mark_obtainable: number | null;
  pass_mark: number | null;
  prerequisite_subject_id: string | null;
  prerequisite_min_score: number | null;
};

export default function SubjectsPage() {
  const { schoolId } = useSchoolContext();
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [subjectClassCounts, setSubjectClassCounts] = useState<Record<string, number>>({});
  const [searchTerm, setSearchTerm] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingSubject, setEditingSubject] = useState<Subject | null>(null);
  const [customSubjectName, setCustomSubjectName] = useState('');
  const [subjectCode, setSubjectCode] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [teachers, setTeachers] = useState<Teacher[]>([]);

  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 25;
  const [totalSubjects, setTotalSubjects] = useState(0);

  const [isAssignmentDialogOpen, setIsAssignmentDialogOpen] = useState(false);
  const [subjectForAssignment, setSubjectForAssignment] = useState<Subject | null>(null);
  const [classOptions, setClassOptions] = useState<SchoolClassOption[]>([]);
  const [selectedClassIds, setSelectedClassIds] = useState<string[]>([]);
  const [existingClassIds, setExistingClassIds] = useState<string[]>([]);
  const [assignmentSearchTerm, setAssignmentSearchTerm] = useState('');
  const [assignmentTeacherId, setAssignmentTeacherId] = useState('');
  const [assignmentDepartmentId, setAssignmentDepartmentId] = useState('');
  const [assignmentReligionId, setAssignmentReligionId] = useState('');
  const [assignmentIsOptional, setAssignmentIsOptional] = useState(false);
  const [assignmentFullMark, setAssignmentFullMark] = useState('100');
  const [assignmentPassMark, setAssignmentPassMark] = useState('40');
  const [assignmentPrerequisiteSubjectId, setAssignmentPrerequisiteSubjectId] = useState('');
  const [assignmentPrerequisiteMinScore, setAssignmentPrerequisiteMinScore] = useState('');
  const [isAssigning, setIsAssigning] = useState(false);

  const { data: departments } = useSchoolConfig({
    type: 'departments',
  });

  const { data: religions } = useSchoolConfig({
    type: 'religions',
  });

  useEffect(() => {
    if (!schoolId) {
      return;
    }

    fetchSubjects();
    fetchTeachers();
    fetchSubjectClassCounts();
  }, [schoolId, currentPage, searchTerm]);

  const filteredClassOptions = useMemo(() => {
    if (!assignmentSearchTerm.trim()) {
      return classOptions;
    }

    return classOptions.filter((classOption) =>
      classOption.name.toLowerCase().includes(assignmentSearchTerm.toLowerCase())
    );
  }, [assignmentSearchTerm, classOptions]);

  async function fetchSubjectClassCounts() {
    if (!schoolId) return;

    try {
      const { data, error } = await supabase
        .from('subject_classes')
        .select('subject_id')
        .eq('school_id', schoolId);

      if (error) throw error;

      const counts: Record<string, number> = {};
      for (const row of data || []) {
        counts[row.subject_id] = (counts[row.subject_id] || 0) + 1;
      }

      setSubjectClassCounts(counts);
    } catch (error) {
      console.error('Error fetching class counts:', error);
    }
  }

  async function fetchSubjects() {
    if (!schoolId) return;

    try {
      let query = supabase
        .from('subjects')
        .select('id, school_id, name, subject_code, is_active, created_at, updated_at', { count: 'exact' })
        .eq('school_id', schoolId);

      if (searchTerm.trim()) {
        query = query.ilike('name', `%${searchTerm}%`);
      }

      const offset = (currentPage - 1) * pageSize;
      const { data, error, count } = await query
        .order('name', { ascending: true })
        .range(offset, offset + pageSize - 1);

      if (error) throw error;

      setSubjects((data || []) as Subject[]);
      setTotalSubjects(count || 0);
    } catch (error) {
      toast.error('Failed to fetch subjects');
      console.error(error);
    }
  }

  async function fetchTeachers() {
    if (!schoolId) return;

    try {
      const { data, error } = await supabase
        .from('teachers')
        .select('id, first_name, last_name')
        .eq('school_id', schoolId);

      if (error) throw error;
      setTeachers((data || []) as Teacher[]);
    } catch (error) {
      toast.error('Error fetching teachers');
    }
  }

  function resetSubjectDialog() {
    setEditingSubject(null);
    setCustomSubjectName('');
    setSubjectCode('');
    setIsDialogOpen(false);
  }

  function resetAssignmentDialog() {
    setSubjectForAssignment(null);
    setClassOptions([]);
    setSelectedClassIds([]);
    setExistingClassIds([]);
    setAssignmentSearchTerm('');
    setAssignmentTeacherId('');
    setAssignmentDepartmentId('');
    setAssignmentReligionId('');
    setAssignmentIsOptional(false);
    setAssignmentFullMark('100');
    setAssignmentPassMark('40');
    setAssignmentPrerequisiteSubjectId('');
    setAssignmentPrerequisiteMinScore('');
    setIsAssignmentDialogOpen(false);
  }

  function openEditDialog(subject: Subject) {
    setEditingSubject(subject);
    setCustomSubjectName(subject.name);
    setSubjectCode(subject.subject_code || '');
    setIsDialogOpen(true);
  }

  async function handleSubjectSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!schoolId) {
      toast.error('School not found');
      return;
    }

    if (!customSubjectName.trim()) {
      toast.error('Please enter a subject name');
      return;
    }

    setIsSubmitting(true);

    try {
      const subjectPayload = {
        school_id: schoolId,
        name: customSubjectName.trim(),
        subject_code: subjectCode.trim() || null,
        is_active: true,
      };

      if (editingSubject) {
        const { error } = await supabase
          .from('subjects')
          .update(subjectPayload)
          .eq('school_id', schoolId)
          .eq('id', editingSubject.id);

        if (error) throw error;
        toast.success('Subject updated successfully');
      } else {
        const { error } = await supabase
          .from('subjects')
          .insert([subjectPayload]);

        if (error) throw error;
        toast.success('Subject added to the catalog');
      }

      await fetchSubjects();
      resetSubjectDialog();
    } catch (error: any) {
      if (error.message?.includes('23505')) {
        toast.error('This subject already exists in the catalog');
      } else {
        toast.error(error.message || 'Failed to save subject');
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  async function openAssignmentDialog(subject: Subject) {
    if (!schoolId) return;

    setSubjectForAssignment(subject);
    setIsAssignmentDialogOpen(true);

    try {
      const [classesResponse, assignmentsResponse] = await Promise.all([
        supabase
          .from('classes')
          .select('id, name')
          .eq('school_id', schoolId)
          .order('name', { ascending: true }),
        supabase
          .from('subject_classes')
          .select('class_id, teacher_id, department_id, religion_id, is_optional, full_mark_obtainable, pass_mark, prerequisite_subject_id, prerequisite_min_score')
          .eq('school_id', schoolId)
          .eq('subject_id', subject.id),
      ]);

      if (classesResponse.error) throw classesResponse.error;
      if (assignmentsResponse.error) throw assignmentsResponse.error;

      const availableClasses = (classesResponse.data || []) as SchoolClassOption[];
      const assignments = (assignmentsResponse.data || []) as ExistingAssignment[];

      setClassOptions(availableClasses);

      const assignedClassIds = assignments.map((assignment) => assignment.class_id);
      setSelectedClassIds(assignedClassIds);
      setExistingClassIds(assignedClassIds);

      if (assignments.length > 0) {
        const firstAssignment = assignments[0];
        setAssignmentTeacherId(firstAssignment.teacher_id || '');
        setAssignmentDepartmentId(firstAssignment.department_id || '');
        setAssignmentReligionId(firstAssignment.religion_id || '');
        setAssignmentIsOptional(Boolean(firstAssignment.is_optional));
        setAssignmentFullMark(String(firstAssignment.full_mark_obtainable ?? 100));
        setAssignmentPassMark(String(firstAssignment.pass_mark ?? 40));
        setAssignmentPrerequisiteSubjectId(firstAssignment.prerequisite_subject_id || '');
        setAssignmentPrerequisiteMinScore(
          firstAssignment.prerequisite_min_score == null ? '' : String(firstAssignment.prerequisite_min_score)
        );
      }
    } catch (error) {
      console.error('Error loading assignment dialog:', error);
      toast.error('Failed to load class assignments');
      resetAssignmentDialog();
    }
  }

  function generateSubjectCode(subjectName: string, className: string) {
    const prefix = subjectName.replace(/\s+/g, '').slice(0, 3).toUpperCase();
    return `${prefix}-${className}`;
  }

  function toggleClassSelection(classId: string) {
    setSelectedClassIds((current) =>
      current.includes(classId)
        ? current.filter((value) => value !== classId)
        : [...current, classId]
    );
  }

  async function handleAssignmentSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!schoolId || !subjectForAssignment) {
      toast.error('Subject assignment is not ready');
      return;
    }

    if (selectedClassIds.length === 0) {
      toast.error('Select at least one class');
      return;
    }

    const fullMark = Number(assignmentFullMark);
    const passMark = Number(assignmentPassMark);
    const prerequisiteMinScore = assignmentPrerequisiteMinScore.trim()
      ? Number(assignmentPrerequisiteMinScore)
      : null;

    if (!Number.isFinite(fullMark) || fullMark <= 0) {
      toast.error('Full mark must be greater than 0');
      return;
    }

    if (!Number.isFinite(passMark) || passMark < 0 || passMark > fullMark) {
      toast.error('Pass mark must be between 0 and full mark');
      return;
    }

    if (prerequisiteMinScore != null && (!Number.isFinite(prerequisiteMinScore) || prerequisiteMinScore < 0)) {
      toast.error('Prerequisite minimum score must be 0 or greater');
      return;
    }

    setIsAssigning(true);

    try {
      const subjectClassesPayload = selectedClassIds.map((classId) => {
        const classOption = classOptions.find((entry)  => entry.id === classId);

        return {
          school_id: schoolId,
          subject_id: subjectForAssignment.id,
          class_id: classId,
          teacher_id: assignmentTeacherId || null,
          department_id: assignmentDepartmentId || null,
          religion_id: assignmentReligionId || null,
          is_optional: assignmentIsOptional,
          full_mark_obtainable: fullMark,
          pass_mark: passMark,
          prerequisite_subject_id: assignmentPrerequisiteSubjectId || null,
          prerequisite_min_score: prerequisiteMinScore,
          subject_code: generateSubjectCode(subjectForAssignment.name, classOption?.name || 'CLASS'),
          is_active: true,
        };
      });

      const removedClassIds = existingClassIds.filter((classId) => !selectedClassIds.includes(classId));
      if (removedClassIds.length > 0) {
        const { error: deleteError } = await supabase
          .from('subject_classes')
          .delete()
          .eq('school_id', schoolId)
          .eq('subject_id', subjectForAssignment.id)
          .in('class_id', removedClassIds);

        if (deleteError) throw deleteError;
      }

      const { error } = await supabase
        .from('subject_classes')
        .upsert(subjectClassesPayload, {
          onConflict: 'school_id,subject_id,class_id',
        });

      if (error) throw error;

      toast.success('Subject assignments saved');
      await fetchSubjectClassCounts();
      resetAssignmentDialog();
    } catch (error: any) {
      toast.error(error.message || 'Failed to save subject assignments');
    } finally {
      setIsAssigning(false);
    }
  }

  async function handleDelete(id: string) {
    if (!schoolId) return;
    if (!confirm('Are you sure you want to delete this subject and all its class assignments?')) return;

    try {
      await supabase
        .from('subject_classes')
        .delete()
        .eq('school_id', schoolId)
        .eq('subject_id', id);

      const { error } = await supabase
        .from('subjects')
        .delete()
        .eq('school_id', schoolId)
        .eq('id', id);

      if (error) throw error;

      setCurrentPage(1);
      await fetchSubjects();
      await fetchSubjectClassCounts();
      toast.success('Subject deleted successfully');
    } catch (error: any) {
      toast.error(error.message || 'Error deleting subject');
    }
  }

  const totalPages = Math.ceil(totalSubjects / pageSize);
  const pageNumbers: number[] = [];
  if (totalPages <= 5) {
    for (let page = 1; page <= totalPages; page += 1) {
      pageNumbers.push(page);
    }
  } else if (currentPage <= 3) {
    pageNumbers.push(1, 2, 3, 4, 5);
  } else if (currentPage >= totalPages - 2) {
    pageNumbers.push(totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages);
  } else {
    pageNumbers.push(currentPage - 2, currentPage - 1, currentPage, currentPage + 1, currentPage + 2);
  }

  return (
    <DashboardLayout role="admin">
      <div className="space-y-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">Subjects</h1>
            <p className="mt-1 text-gray-600">
              Build a global subject catalog, then configure each subject independently for any class.
            </p>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={(open) => (!open ? resetSubjectDialog() : setIsDialogOpen(true))}>
            <DialogTrigger asChild>
              <Button onClick={() => setEditingSubject(null)}>
                <Plus className="mr-2 h-4 w-4" />
                Add Subject
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>{editingSubject ? 'Edit Catalog Subject' : 'Add Catalog Subject'}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubjectSubmit} className="space-y-4">
                <div>
                  <Label htmlFor="subject_name">Subject Name</Label>
                  <Input
                    id="subject_name"
                    value={customSubjectName}
                    onChange={(event) => setCustomSubjectName(event.target.value)}
                    placeholder="Mathematics"
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="subject_code">Catalog Code</Label>
                  <Input
                    id="subject_code"
                    value={subjectCode}
                    onChange={(event) => setSubjectCode(event.target.value)}
                    placeholder="MTH"
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    Optional. Class-specific codes are still generated when you assign the subject.
                  </p>
                </div>

                <div className="rounded-md border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800">
                  Catalog subjects are no longer tied to a single education level. Optionality, department,
                  religion, marks, and teacher assignment now happen per class assignment.
                </div>

                <div className="flex gap-2 border-t pt-4">
                  <Button type="submit" className="flex-1" disabled={isSubmitting}>
                    {isSubmitting ? 'Saving...' : editingSubject ? 'Update Subject' : 'Create Subject'}
                  </Button>
                  <Button type="button" variant="outline" onClick={resetSubjectDialog} disabled={isSubmitting}>
                    Cancel
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">New Assignment Model</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 text-sm text-gray-600 md:grid-cols-3">
            <div className="rounded-lg border bg-gray-50 p-4">
              Create each subject once in the catalog.
            </div>
            <div className="rounded-lg border bg-gray-50 p-4">
              Assign that subject to one or many classes.
            </div>
            <div className="rounded-lg border bg-gray-50 p-4">
              Configure optionality, religion, department, marks, and teacher per class.
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="max-w-md">
              <Label htmlFor="search" className="mb-2 block text-sm font-medium">
                Search Catalog
              </Label>
              <div className="relative">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                <Input
                  id="search"
                  placeholder="Search subjects..."
                  className="pl-10"
                  value={searchTerm}
                  onChange={(event) => {
                    setSearchTerm(event.target.value);
                    setCurrentPage(1);
                  }}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-0">
            {subjects.length === 0 ? (
              <div className="p-12 text-center">
                <BookOpen className="mx-auto mb-4 h-12 w-12 text-gray-300" />
                <p className="font-medium text-gray-500">No subjects found</p>
                <p className="mt-2 text-sm text-gray-400">
                  {searchTerm ? 'Try a different search term' : 'Add your first catalog subject'}
                </p>
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Subject</TableHead>
                        <TableHead>Catalog Code</TableHead>
                        <TableHead className="text-center">Assigned Classes</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {subjects.map((subject) => {
                        const classCount = subjectClassCounts[subject.id] || 0;

                        return (
                          <TableRow key={subject.id}>
                            <TableCell>
                              <div className="font-medium">{subject.name}</div>
                            </TableCell>
                            <TableCell>{subject.subject_code || '-'}</TableCell>
                            <TableCell className="text-center">
                              <Badge variant="outline">{classCount}</Badge>
                            </TableCell>
                            <TableCell>
                              <Badge variant={classCount > 0 ? 'default' : 'secondary'}>
                                {classCount > 0 ? 'Assigned' : 'Catalog only'}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="icon">
                                    <MoreVertical className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem onClick={() => openAssignmentDialog(subject)}>
                                    <Layers className="mr-2 h-4 w-4" />
                                    Assign to Classes
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => openEditDialog(subject)}>
                                    <Edit className="mr-2 h-4 w-4" />
                                    Edit Catalog Entry
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => handleDelete(subject.id)}>
                                    <Trash2 className="mr-2 h-4 w-4 text-red-600" />
                                    Delete
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>

                {totalPages > 1 && (
                  <div className="border-t p-4">
                    <Pagination>
                      <PaginationContent>
                        <PaginationItem>
                          <PaginationPrevious
                            onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                            href="#"
                            className={currentPage === 1 ? 'pointer-events-none opacity-50' : ''}
                          />
                        </PaginationItem>

                        {pageNumbers[0] > 1 && (
                          <>
                            <PaginationItem>
                              <PaginationLink onClick={() => setCurrentPage(1)} href="#" isActive={currentPage === 1}>
                                1
                              </PaginationLink>
                            </PaginationItem>
                            {pageNumbers[0] > 2 && (
                              <PaginationItem>
                                <PaginationEllipsis />
                              </PaginationItem>
                            )}
                          </>
                        )}

                        {pageNumbers.map((page) => (
                          <PaginationItem key={page}>
                            <PaginationLink onClick={() => setCurrentPage(page)} href="#" isActive={currentPage === page}>
                              {page}
                            </PaginationLink>
                          </PaginationItem>
                        ))}

                        {pageNumbers[pageNumbers.length - 1] < totalPages && (
                          <>
                            {pageNumbers[pageNumbers.length - 1] < totalPages - 1 && (
                              <PaginationItem>
                                <PaginationEllipsis />
                              </PaginationItem>
                            )}
                            <PaginationItem>
                              <PaginationLink
                                onClick={() => setCurrentPage(totalPages)}
                                href="#"
                                isActive={currentPage === totalPages}
                              >
                                {totalPages}
                              </PaginationLink>
                            </PaginationItem>
                          </>
                        )}

                        <PaginationItem>
                          <PaginationNext
                            onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                            href="#"
                            className={currentPage === totalPages ? 'pointer-events-none opacity-50' : ''}
                          />
                        </PaginationItem>
                      </PaginationContent>
                    </Pagination>
                  </div>
                )}

                <div className="border-t bg-gray-50 px-6 py-3 text-sm text-gray-600">
                  Showing {(currentPage - 1) * pageSize + 1} to {Math.min(currentPage * pageSize, totalSubjects)} of {totalSubjects} subjects
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <Dialog
          open={isAssignmentDialogOpen}
          onOpenChange={(open) => {
            if (!open) {
              resetAssignmentDialog();
              return;
            }

            setIsAssignmentDialogOpen(true);
          }}
        >
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle>
                Assign {subjectForAssignment?.name || 'Subject'} to Classes
              </DialogTitle>
            </DialogHeader>

            <form onSubmit={handleAssignmentSubmit} className="space-y-6">
              <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                This saves configuration on the class assignment itself. If you update multiple selected classes here,
                they will all share the same teacher, optionality, department, religion, and marks settings.
              </div>

              <div className="grid gap-6 lg:grid-cols-[1.15fr_1fr]">
                <div className="space-y-3 rounded-lg border p-4">
                  <div>
                    <Label htmlFor="class-search">Classes</Label>
                    <Input
                      id="class-search"
                      value={assignmentSearchTerm}
                      onChange={(event) => setAssignmentSearchTerm(event.target.value)}
                      placeholder="Search classes"
                    />
                  </div>

                  <div className="max-h-80 space-y-2 overflow-y-auto rounded-md border p-3">
                    {filteredClassOptions.length === 0 ? (
                      <p className="text-sm text-gray-500">No matching classes</p>
                    ) : (
                      filteredClassOptions.map((classOption) => (
                        <label
                          key={classOption.id}
                          className="flex cursor-pointer items-center justify-between rounded-md border px-3 py-2"
                        >
                          <span className="text-sm font-medium">{classOption.name}</span>
                          <input
                            type="checkbox"
                            checked={selectedClassIds.includes(classOption.id)}
                            onChange={() => toggleClassSelection(classOption.id)}
                          />
                        </label>
                      ))
                    )}
                  </div>

                  <p className="text-xs text-gray-500">
                    Selected classes: {selectedClassIds.length}
                  </p>
                </div>

                <div className="space-y-4 rounded-lg border p-4">
                  <div>
                    <Label htmlFor="teacher">Teacher in Charge</Label>
                    <select
                      id="teacher"
                      value={assignmentTeacherId}
                      onChange={(event) => setAssignmentTeacherId(event.target.value)}
                      className="w-full rounded-md border px-3 py-2"
                    >
                      <option value="">Unassigned</option>
                      {teachers.map((teacher) => (
                        <option key={teacher.id} value={teacher.id}>
                          {teacher.first_name} {teacher.last_name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <Label htmlFor="department">Department</Label>
                    <select
                      id="department"
                      value={assignmentDepartmentId}
                      onChange={(event) => setAssignmentDepartmentId(event.target.value)}
                      className="w-full rounded-md border px-3 py-2"
                    >
                      <option value="">All departments</option>
                      {departments.map((department) => (
                        <option key={department.id} value={department.id}>
                          {department.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <Label htmlFor="religion">Religion</Label>
                    <select
                      id="religion"
                      value={assignmentReligionId}
                      onChange={(event) => setAssignmentReligionId(event.target.value)}
                      className="w-full rounded-md border px-3 py-2"
                    >
                      <option value="">No religion filter</option>
                      {religions.map((religion) => (
                        <option key={religion.id} value={religion.id}>
                          {religion.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex items-center gap-3 rounded-md border px-3 py-2">
                    <Switch
                      id="assignment_is_optional"
                      checked={assignmentIsOptional}
                      onCheckedChange={setAssignmentIsOptional}
                    />
                    <Label htmlFor="assignment_is_optional" className="cursor-pointer font-normal">
                      Optional subject for selected classes
                    </Label>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label htmlFor="full_mark">Full Mark Obtainable</Label>
                      <Input
                        id="full_mark"
                        type="number"
                        min="1"
                        value={assignmentFullMark}
                        onChange={(event) => setAssignmentFullMark(event.target.value)}
                      />
                    </div>
                    <div>
                      <Label htmlFor="pass_mark">Pass Mark</Label>
                      <Input
                        id="pass_mark"
                        type="number"
                        min="0"
                        value={assignmentPassMark}
                        onChange={(event) => setAssignmentPassMark(event.target.value)}
                      />
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="prerequisite_subject">Prerequisite Subject</Label>
                    <select
                      id="prerequisite_subject"
                      value={assignmentPrerequisiteSubjectId}
                      onChange={(event) => setAssignmentPrerequisiteSubjectId(event.target.value)}
                      className="w-full rounded-md border px-3 py-2"
                    >
                      <option value="">None</option>
                      {subjects
                        .filter((subject) => subject.id !== subjectForAssignment?.id)
                        .map((subject) => (
                          <option key={subject.id} value={subject.id}>
                            {subject.name}
                          </option>
                        ))}
                    </select>
                  </div>

                  <div>
                    <Label htmlFor="prerequisite_score">Minimum Score for Prerequisite</Label>
                    <Input
                      id="prerequisite_score"
                      type="number"
                      min="0"
                      value={assignmentPrerequisiteMinScore}
                      onChange={(event) => setAssignmentPrerequisiteMinScore(event.target.value)}
                      placeholder="Leave blank if not required"
                    />
                  </div>
                </div>
              </div>

              <div className="flex gap-2 border-t pt-4">
                <Button type="submit" className="flex-1" disabled={isAssigning}>
                  {isAssigning ? 'Saving assignments...' : 'Save Class Assignments'}
                </Button>
                <Button type="button" variant="outline" onClick={resetAssignmentDialog} disabled={isAssigning}>
                  Cancel
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}