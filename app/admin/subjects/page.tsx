"use client";

import { DashboardLayout } from '@/components/dashboard-layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Plus, Search, Edit, Trash2, BookOpen, MoreVertical, Eye } from 'lucide-react';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Subject, Teacher, EducationLevel, Department, Religion } from '@/lib/types';
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
import { BulkCreateSubjectsDialog } from '@/components/bulk-create-subjects-dialog';


export default function SubjectsPage() {
  const { schoolId } = useSchoolContext();
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [subjectClassCounts, setSubjectClassCounts] = useState<Record<string, number>>({});
  const [searchTerm, setSearchTerm] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingSubject, setEditingSubject] = useState<Subject | null>(null);
  const [selectedLevelId, setSelectedLevelId] = useState<string>('');
  const [customSubjectName, setCustomSubjectName] = useState<string>('');
  const [selectedDepartmentId, setSelectedDepartmentId] = useState<string>('');
  const [selectedReligionId, setSelectedReligionId] = useState<string>('');
  const [isOptional, setIsOptional] = useState(false);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [selectedTeacher, setSelectedTeacher] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Pagination & Filtering
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 25;
  const [totalSubjects, setTotalSubjects] = useState(0);
  const [filterLevel, setFilterLevel] = useState<string>('');
  const [filterDept, setFilterDept] = useState<string>('');
  const [filterType, setFilterType] = useState<'all' | 'optional' | 'religion'>('all');
  const [isFormStep2, setIsFormStep2] = useState(false);

  // Fetch config data
  const { data: educationLevels, isLoading: isLoadingEduLevels } = useSchoolConfig({
    type: "education_levels",
  });

  const { data: departments, isLoading: isLoadingDepartments } = useSchoolConfig({
    type: "departments",
  });

  const { data: religions, isLoading: isLoadingReligions } = useSchoolConfig({
    type: "religions",
  });

  useEffect(() => {
    if (schoolId) {
      fetchSubjects();
      fetchTeachers();
      fetchSubjectClassCounts();
    }
  }, [schoolId, currentPage, filterLevel, filterDept, filterType, searchTerm]);

  async function fetchSubjectClassCounts() {
    if (!schoolId) return;
    try {
      const { data, error } = await supabase
        .from('subject_classes')
        .select('subject_id', { count: 'exact' })
        .eq('school_id', schoolId);
      if (error) throw error;
      
      // Count classes per subject
      const counts: Record<string, number> = {};
      if (data) {
        data.forEach((row: any) => {
          counts[row.subject_id] = (counts[row.subject_id] || 0) + 1;
        });
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
        .select('*', { count: 'exact' })
        .eq('school_id', schoolId);

      // Apply filters
      if (filterLevel) {
        query = query.eq('education_level_id', filterLevel);
      }
      if (filterDept) {
        query = query.eq('department_id', filterDept);
      }
      if (filterType === 'optional') {
        query = query.eq('is_optional', true);
      }
      if (filterType === 'religion') {
        query = query.not('religion_id', 'is', null);
      }

      // Apply search
      if (searchTerm) {
        query = query.ilike('name', `%${searchTerm}%`);
      }

      // Apply pagination
      const offset = (currentPage - 1) * pageSize;
      query = query
        .order('education_level_id', { ascending: true })
        .order('name', { ascending: true })
        .range(offset, offset + pageSize - 1);

      const { data, error, count } = await query;
      if (error) throw error;
      
      setSubjects(data || []);
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
      setTeachers(data as Teacher[]);
    } catch (error) {
      toast.error('Error fetching teachers');
    }
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    
    // Step 1 validation & move to step 2
    if (!isFormStep2) {
      if (!customSubjectName.trim()) {
        toast.error('Please enter a subject name');
        return;
      }
      if (!selectedLevelId) {
        toast.error('Please select an education level');
        return;
      }
      setIsFormStep2(true);
      return;
    }

    // Step 2: Final submission
    setIsSubmitting(true);

    const subjectData = {
      school_id: schoolId,
      name: customSubjectName.trim(),
      education_level_id: selectedLevelId,
      department_id: selectedDepartmentId || null,
      religion_id: selectedReligionId || null,
      is_optional: isOptional,
      is_active: true,
    };

    // ===========================
    // ✏️ EDIT SUBJECT
    // ===========================
    if (editingSubject) {
      try {
        // Update subject
        const { error: updateError } = await supabase
          .from('subjects')
          .update(subjectData)
          .eq('school_id', schoolId)
          .eq('id', editingSubject.id);

        if (updateError) {
          if (updateError.message?.includes('duplicate') || updateError.message?.includes('23505')) {
            toast.error('This subject already exists for this level/department');
          } else {
            toast.error(updateError.message || 'Failed to update subject');
          }
          setIsSubmitting(false);
          return;
        }

        await fetchSubjects();
        toast.success('Subject updated successfully');
        setIsSubmitting(false);
        closeDialog();
        return;
      } catch (error: any) {
        toast.error(error.message || 'Failed to update subject');
        setIsSubmitting(false);
        return;
      }
    }

    // ===========================
    // ➕ CREATE SUBJECT
    // ===========================
    try {
      // Insert subject
      const { data: newSubjectArr, error: insertError } = await supabase
        .from('subjects')
        .insert([subjectData])
        .select();

      if (insertError) {
        if (insertError.message?.includes('duplicate') || insertError.message?.includes('23505')) {
          toast.error('This subject already exists for this level/department');
        } else {
          toast.error(insertError.message || 'Failed to create subject');
        }
        setIsSubmitting(false);
        return;
      }

      const newSubject = Array.isArray(newSubjectArr) ? newSubjectArr[0] : newSubjectArr;

      // Get all class levels for this education level
      const { data: classLevels, error: classLevelsError } = await supabase
        .from('school_class_levels')
        .select('id')
        .eq('school_id', schoolId)
        .eq('education_level_id', selectedLevelId);

      if (classLevelsError || !Array.isArray(classLevels) || classLevels.length === 0) {
        toast.error('Could not find class levels for this education level.');
        setIsSubmitting(false);
        return;
      }

      const classLevelIds = classLevels.map(cl => cl.id);

      // Get all classes for these class levels (with names)
      const { data: classes, error: classesError } = await supabase
        .from('classes')
        .select('id, name')
        .eq('school_id', schoolId)
        .in('class_level_id', classLevelIds)
        .order('name', { ascending: true });

      if (classesError || !Array.isArray(classes) || classes.length === 0) {
        toast.error('Could not find classes to apply subjects to.');
        setIsSubmitting(false);
        return;
      }

      // Generate subject code
      const generateSubjectCode = (subjectName: string, className: string) => {
        const clean = subjectName.replace(/\s+/g, "");
        const prefix = clean.slice(0, 3).toUpperCase();
        return `${prefix}-${className}`;
      };

      // Create subject_classes rows with subject_code
      const subjectClasses = classes.map((c: any) => ({
        school_id: schoolId,
        class_id: c.id,
        subject_id: newSubject.id,
        subject_code: generateSubjectCode(newSubject.name, c.name),
      }));

      // Insert subject_classes
      const { error: subjectClassesError } = await supabase
        .from('subject_classes')
        .insert(subjectClasses);

      if (subjectClassesError) {
        toast.error(subjectClassesError.message || 'Failed to create subject_classes');
        setIsSubmitting(false);
        return;
      }

      await fetchSubjects();
      toast.success('Subject created and applied to all classes in this level');
      setIsSubmitting(false);
      closeDialog();
    } catch (error: any) {
      toast.error(error.message || 'Failed to create subject');
      setIsSubmitting(false);
    }
  }

  const filteredSubjectsForDisplay = subjects;

  async function handleDelete(id: string) {
    if (!confirm('Are you sure you want to delete this subject?')) return;

    try {
      // Delete subject_classes first
      await supabase
        .from('subject_classes')
        .delete()
        .eq('school_id', schoolId)
        .eq('subject_id', id);

      // Then delete the subject
      const { error } = await supabase
        .from('subjects')
        .delete()
        .eq('school_id', schoolId)
        .eq('id', id);

      if (error) throw error;

      setCurrentPage(1);
      await fetchSubjects();
      toast.success('Subject deleted successfully');
    } catch (error: any) {
      toast.error('Error deleting subject');
    }
  }

  const getLevelColor = (levelId: string) => {
    const level = educationLevels.find(l => l.id === levelId);
    const levelName = level?.name || '';
    
    switch (levelName) {
      case 'Pre-Primary':
        return 'bg-pink-100 text-pink-700';
      case 'Primary':
        return 'bg-blue-100 text-blue-700';
      case 'JSS':
        return 'bg-green-100 text-green-700';
      case 'SSS':
        return 'bg-purple-100 text-purple-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  async function openEditDialog(subject: Subject) {
    setEditingSubject(subject);
    setSelectedLevelId(subject.education_level_id);
    setSelectedDepartmentId(subject.department_id || "");
    setCustomSubjectName(subject.name);
    setSelectedReligionId(subject.religion_id || "");
    setIsOptional(subject.is_optional);
    setSelectedTeacher("");
    setIsFormStep2(false);
    setIsDialogOpen(true);
  }

  function closeDialog() {
    setIsDialogOpen(false);
    setEditingSubject(null);
    setSelectedLevelId('');
    setCustomSubjectName('');
    setSelectedDepartmentId('');
    setSelectedReligionId('');
    setSelectedTeacher('');
    setIsOptional(false);
    setIsFormStep2(false);
  }

  const totalPages = Math.ceil(totalSubjects / pageSize);
  const pageNumbers = [];
  if (totalPages <= 5) {
    for (let i = 1; i <= totalPages; i++) {
      pageNumbers.push(i);
    }
  } else {
    if (currentPage <= 3) {
      pageNumbers.push(1, 2, 3, 4, 5);
    } else if (currentPage >= totalPages - 2) {
      pageNumbers.push(totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages);
    } else {
      pageNumbers.push(currentPage - 2, currentPage - 1, currentPage, currentPage + 1, currentPage + 2);
    }
  }

  return (
    <DashboardLayout role="admin">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Subjects</h1>
            <p className="text-gray-600 mt-1">
              Manage subjects and assign them to classes
            </p>
          </div>
          <div className="flex gap-2">
            {schoolId && (
              <BulkCreateSubjectsDialog
                schoolId={schoolId}
                onSuccess={() => { setCurrentPage(1); fetchSubjects(); }}
                educationLevels={educationLevels}
                departments={departments}
                religions={religions}
                teachers={teachers}
              />
            )}
            <Dialog open={isDialogOpen} onOpenChange={(open) => { setIsDialogOpen(open); if (!open) closeDialog(); }}>
              <DialogTrigger asChild>
                <Button onClick={() => { setEditingSubject(null); setIsFormStep2(false); }}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Subject
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>
                    {editingSubject ? 'Edit Subject' : 'Add New Subject'}
                    {!editingSubject && !isFormStep2 && <span className="text-sm font-normal text-gray-500 ml-2">(Step 1 of 2)</span>}
                    {!editingSubject && isFormStep2 && <span className="text-sm font-normal text-gray-500 ml-2">(Step 2 of 2)</span>}
                  </DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                  {/* STEP 1: Basic Information */}
                  {!isFormStep2 || editingSubject ? (
                    <>
                      <div>
                        <Label htmlFor="education_level">Education Level *</Label>
                        <select
                          id="education_level"
                          value={selectedLevelId}
                          onChange={(e) => {
                            setSelectedLevelId(e.target.value);
                            setCustomSubjectName('');
                            setSelectedDepartmentId('');
                          }}
                          className="w-full px-3 py-2 border rounded-md"
                          required
                          disabled={!!editingSubject}
                        >
                          <option value="">Select Level</option>
                          {isLoadingEduLevels ? (
                            <option disabled>Loading...</option>
                          ) : (
                            educationLevels.map((level) => (
                              <option key={level.id} value={level.id}>
                                {level.name}
                              </option>
                            ))
                          )}
                        </select>
                        {editingSubject && (
                          <p className="text-xs text-gray-500 mt-1">
                            Cannot change when editing
                          </p>
                        )}
                      </div>

                      {selectedLevelId && departments.length > 0 && (
                        <div>
                          <Label htmlFor="department">Department (Optional)</Label>
                          {isLoadingDepartments ? (
                            <select disabled className="w-full px-3 py-2 border rounded-md">
                              <option>Loading...</option>
                            </select>
                          ) : (
                            <select
                              id="department"
                              value={selectedDepartmentId}
                              onChange={(e) => {
                                setSelectedDepartmentId(e.target.value);
                                setCustomSubjectName('');
                              }}
                              className="w-full px-3 py-2 border rounded-md"
                              disabled={!!editingSubject}
                            >
                              <option value="">No Department</option>
                              {departments.map((dept) => (
                                <option key={dept.id} value={dept.id}>
                                  {dept.name}
                                </option>
                              ))}
                            </select>
                          )}
                          {editingSubject && (
                            <p className="text-xs text-gray-500 mt-1">
                              Cannot change when editing
                            </p>
                          )}
                        </div>
                      )}

                      <div>
                        <Label htmlFor="subject_name">Subject Name *</Label>
                        <Input
                          id="subject_name"
                          value={customSubjectName}
                          onChange={(e) => setCustomSubjectName(e.target.value)}
                          placeholder="Enter subject name"
                          required
                        />
                      </div>

                      {editingSubject && (
                        <div className="p-3 bg-blue-50 border border-blue-200 rounded-md">
                          <p className="text-sm text-blue-800">
                            Update the subject details below.
                          </p>
                        </div>
                      )}
                    </>
                  ) : null}

                  {/* STEP 2: Optional Settings */}
                  {isFormStep2 && !editingSubject ? (
                    <>
                      <div>
                        <Label>Subject Type</Label>
                        <div className="space-y-3">
                          <div className="flex items-center gap-2">
                            <Switch
                              id="is_optional"
                              checked={isOptional}
                              onCheckedChange={setIsOptional}
                            />
                            <Label htmlFor="is_optional" className="flex-1 font-normal cursor-pointer">
                              Optional Subject
                              <p className="text-xs text-gray-500">Students can choose not to take this</p>
                            </Label>
                          </div>
                        </div>
                      </div>

                      <div>
                        <Label htmlFor="religion">Religion-Specific (Optional)</Label>
                        <select
                          id="religion"
                          value={selectedReligionId}
                          onChange={(e) => setSelectedReligionId(e.target.value)}
                          className="w-full px-3 py-2 border rounded-md"
                        >
                          <option value="">Not Specific</option>
                          {isLoadingReligions ? (
                            <option disabled>Loading...</option>
                          ) : (
                            religions.map((rel) => (
                              <option key={rel.id} value={rel.id}>
                                {rel.name}
                              </option>
                            ))
                          )}
                        </select>
                      </div>

                      <div>
                        <Label>Assign Teacher (Optional)</Label>
                        <select
                          className="w-full border rounded-md p-2"
                          value={selectedTeacher}
                          onChange={(e) => setSelectedTeacher(e.target.value)}
                        >
                          <option value="">Do not assign yet</option>
                          {teachers.map((t) => (
                            <option key={t.id} value={t.id}>
                              {t.first_name} {t.last_name}
                            </option>
                          ))}
                        </select>
                        <p className="text-xs text-gray-500 mt-1">
                          Auto-assigns to classes without a class teacher
                        </p>
                      </div>

                      <div className="p-3 bg-blue-50 border border-blue-200 rounded-md">
                        <p className="text-sm text-blue-800">
                          <strong>Note:</strong> This subject will apply to all classes under <strong>{educationLevels.find(l => l.id === selectedLevelId)?.name}</strong>.
                        </p>
                      </div>
                    </>
                  ) : null}

                  {/* Form Actions */}
                  <div className="flex gap-2 pt-4 border-t">
                    {!editingSubject && isFormStep2 && (
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setIsFormStep2(false)}
                        disabled={isSubmitting}
                      >
                        Back
                      </Button>
                    )}
                    <Button type="submit" className="flex-1" disabled={isSubmitting}>
                      {isSubmitting ? 'Saving...' : isFormStep2 && !editingSubject ? 'Create Subject' : editingSubject ? 'Update' : 'Next'}
                    </Button>
                    <Button type="button" variant="outline" onClick={closeDialog} disabled={isSubmitting}>
                      Cancel
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <Label htmlFor="filter-level" className="text-sm font-medium mb-2 block">
                  Education Level
                </Label>
                <select
                  id="filter-level"
                  value={filterLevel}
                  onChange={(e) => {
                    setFilterLevel(e.target.value);
                    setFilterDept('');
                    setCurrentPage(1);
                  }}
                  className="w-full px-3 py-2 border rounded-md"
                >
                  <option value="">All Levels</option>
                  {educationLevels.map((level) => (
                    <option key={level.id} value={level.id}>
                      {level.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <Label htmlFor="filter-dept" className="text-sm font-medium mb-2 block">
                  Department
                </Label>
                <select
                  id="filter-dept"
                  value={filterDept}
                  onChange={(e) => {
                    setFilterDept(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="w-full px-3 py-2 border rounded-md"
                  disabled={!filterLevel && departments.length > 0}
                >
                  <option value="">All Departments</option>
                  {departments.map((dept) => (
                    <option key={dept.id} value={dept.id}>
                      {dept.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <Label htmlFor="filter-type" className="text-sm font-medium mb-2 block">
                  Subject Type
                </Label>
                <select
                  id="filter-type"
                  value={filterType}
                  onChange={(e) => {
                    setFilterType(e.target.value as 'all' | 'optional' | 'religion');
                    setCurrentPage(1);
                  }}
                  className="w-full px-3 py-2 border rounded-md"
                >
                  <option value="all">All Types</option>
                  <option value="optional">Optional Only</option>
                  <option value="religion">Religion-Specific</option>
                </select>
              </div>

              <div>
                <Label htmlFor="search" className="text-sm font-medium mb-2 block">
                  Search
                </Label>
                <div className="relative">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                  <Input
                    id="search"
                    placeholder="Search subjects..."
                    className="pl-10"
                    value={searchTerm}
                    onChange={(e) => {
                      setSearchTerm(e.target.value);
                      setCurrentPage(1);
                    }}
                  />
                </div>
              </div>
            </div>

            {(filterLevel || filterDept || filterType !== 'all' || searchTerm) && (
              <div className="mt-4">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setFilterLevel('');
                    setFilterDept('');
                    setFilterType('all');
                    setSearchTerm('');
                    setCurrentPage(1);
                  }}
                >
                  Clear Filters
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Table */}
        <Card>
          <CardContent className="p-0">
            {filteredSubjectsForDisplay.length === 0 ? (
              <div className="p-12 text-center">
                <BookOpen className="h-12 w-12 mx-auto text-gray-300 mb-4" />
                <p className="text-gray-500 font-medium">No subjects found</p>
                <p className="text-sm text-gray-400 mt-2">
                  {searchTerm || filterLevel || filterDept || filterType !== 'all'
                    ? 'Try adjusting your filters'
                    : 'Add your first subject'}
                </p>
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Level</TableHead>
                        <TableHead>Department</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead className="text-center">Classes</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredSubjectsForDisplay.map((subject) => {
                        const level = educationLevels.find(l => l.id === subject.education_level_id);
                        const dept = departments.find(d => d.id === subject.department_id);
                        const religion = religions.find(r => r.id === subject.religion_id);
                        const classCount = subjectClassCounts[subject.id] || 0;

                        return (
                          <TableRow key={subject.id}>
                            <TableCell className="font-medium">{subject.name}</TableCell>
                            <TableCell>
                              <Badge className={getLevelColor(subject.education_level_id)}>
                                {level?.name || 'Unknown'}
                              </Badge>
                            </TableCell>
                            <TableCell>{dept?.name || '-'}</TableCell>
                            <TableCell>
                              <div className="flex gap-1 flex-wrap">
                                {subject.is_optional && (
                                  <Badge variant="secondary" className="text-xs">
                                    Optional
                                  </Badge>
                                )}
                                {religion && (
                                  <Badge variant="outline" className="text-xs">
                                    {religion.name}
                                  </Badge>
                                )}
                                {!subject.is_optional && !religion && (
                                  <span className="text-gray-500 text-sm">-</span>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="text-center">
                              <Badge variant="outline">{classCount}</Badge>
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
                                  <DropdownMenuItem onClick={() => openEditDialog(subject)}>
                                    <Edit className="mr-2 h-4 w-4" />
                                    Edit
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

                {/* Pagination */}
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
                              <PaginationLink
                                onClick={() => setCurrentPage(1)}
                                href="#"
                                isActive={currentPage === 1}
                              >
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
                            <PaginationLink
                              onClick={() => setCurrentPage(page)}
                              href="#"
                              isActive={currentPage === page}
                            >
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

                {/* Results Summary */}
                <div className="border-t px-6 py-3 bg-gray-50 text-sm text-gray-600">
                  Showing {(currentPage - 1) * pageSize + 1} to {Math.min(currentPage * pageSize, totalSubjects)} of {totalSubjects} subjects
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}