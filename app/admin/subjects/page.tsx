"use client";

import { DashboardLayout } from '@/components/dashboard-layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Plus, Search, Edit, Trash2, BookOpen } from 'lucide-react';
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
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Switch } from '@/components/ui/switch';
import { useSchoolContext } from '@/hooks/use-school-context';
import { useSchoolConfig } from '@/hooks/use-school-config';
import { BulkCreateSubjectsDialog } from '@/components/bulk-create-subjects-dialog';


export default function SubjectsPage() {
  const { schoolId } = useSchoolContext();
  const [subjects, setSubjects] = useState<Subject[]>([]);
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
    }
  }, [schoolId]);

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

  async function fetchSubjects() {
    if (!schoolId) return;
    try {
      const { data, error } = await supabase
        .from('subjects')
        .select('*')
        .eq('school_id', schoolId)
        .order('education_level_id', { ascending: true })
        .order('name', { ascending: true });
      if (error) throw error;
      setSubjects(data || []);
    } catch (error) {
      toast.error('Failed to fetch subjects');
    }
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setIsSubmitting(true);

    if (!customSubjectName.trim()) {
      toast.error('Please enter a subject name');
      setIsSubmitting(false);
      return;
    }

    if (!selectedLevelId) {
      toast.error('Please select an education level');
      setIsSubmitting(false);
      return;
    }

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

      await fetchSubjects();
      toast.success('Subject deleted successfully');
    } catch (error: any) {
      toast.error('Error deleting subject');
    }
  }

  async function openEditDialog(subject: Subject) {
    setEditingSubject(subject);
    setSelectedLevelId(subject.education_level_id);
    setSelectedDepartmentId(subject.department_id || "");
    setCustomSubjectName(subject.name);
    setSelectedReligionId(subject.religion_id || "");
    setIsOptional(subject.is_optional);
    setSelectedTeacher("");
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
  }

  const filteredSubjects = subjects.filter((subject) =>
    subject.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

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

  const groupedSubjects = filteredSubjects.reduce((acc, subject) => {
    const eduLevel = educationLevels.find(el => el.id === subject.education_level_id);
    const dept = departments.find(d => d.id === subject.department_id);
    
    let groupKey: string;
    if (dept) {
      groupKey = `${eduLevel?.name || 'Unknown'} - ${dept.name}`;
    } else {
      groupKey = eduLevel?.name || 'Unknown';
    }

    if (!acc[groupKey]) acc[groupKey] = [];
    acc[groupKey].push(subject);
    return acc;
  }, {} as Record<string, Subject[]>);

  return (
    <DashboardLayout role="admin">
      <div className="space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Subjects</h1>
            <p className="text-gray-600 mt-1">
              Manage subjects by education level - subjects apply to all classes in the level
            </p>
          </div>
          <div className="flex gap-2">
            {schoolId && (
              <BulkCreateSubjectsDialog
                schoolId={schoolId}
                onSuccess={fetchSubjects}
                educationLevels={educationLevels}
                departments={departments}
                religions={religions}
                teachers={teachers}
              />
            )}
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button onClick={() => setEditingSubject(null)}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Subject
                </Button>
              </DialogTrigger>
            <DialogContent className="max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editingSubject ? 'Edit Subject' : 'Add New Subject'}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label htmlFor="education_level">Education Level</Label>
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
                      Education level cannot be changed when editing
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
                        Department cannot be changed when editing
                      </p>
                    )}
                  </div>
                )}

                {selectedLevelId && !editingSubject && (
                  <div>
                    <Label htmlFor="subject_name">Subject Name</Label>
                    <Input
                      id="subject_name"
                      value={customSubjectName}
                      onChange={(e) => setCustomSubjectName(e.target.value)}
                      placeholder="Enter subject name"
                      required
                    />
                  </div>
                )}

                {(editingSubject) && (
                  <div>
                    <Label htmlFor="custom_name">Subject Name</Label>
                    <Input
                      id="custom_name"
                      value={customSubjectName}
                      onChange={(e) => setCustomSubjectName(e.target.value)}
                      placeholder="Enter subject name"
                      required
                    />
                  </div>
                )}
                <div>
                  <Label>Select Subject Teacher (Optional)</Label>
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
                    This will auto-assign to classes that have no class teacher yet.
                  </p>
                </div>

                <div>
                  <Label htmlFor="religion">Religion (Optional)</Label>
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

                <div className="flex items-center justify-between p-3 border rounded-md">
                  <div>
                    <Label htmlFor="is_optional">Optional Subject</Label>
                    <p className="text-xs text-gray-500">
                      Mark if this subject is optional for students
                    </p>
                  </div>
                  <Switch
                    id="is_optional"
                    checked={isOptional}
                    onCheckedChange={setIsOptional}
                  />
                </div>

                {!editingSubject && (
                  <div className="p-3 bg-blue-50 border border-blue-200 rounded-md">
                    <p className="text-sm text-blue-800">
                      <strong>Note:</strong> This subject will automatically apply to all classes
                      under the selected education level {selectedDepartmentId && `and department`}.
                    </p>
                  </div>
                )}

                <div className="flex gap-2">
                  <Button type="submit" className="flex-1" disabled={isSubmitting}>
                    {isSubmitting ? 'Saving...' : (editingSubject ? 'Update' : 'Create')}
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

        <div className="relative">
          <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search subjects..."
            className="pl-10"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        {Object.keys(groupedSubjects).length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center">
              <BookOpen className="h-12 w-12 mx-auto text-gray-300 mb-4" />
              <p className="text-gray-500">No subjects found</p>
              <p className="text-sm text-gray-400 mt-2">
                Add subjects to assign them to all classes in an education level
              </p>
            </CardContent>
          </Card>
        ) : (
          Object.entries(groupedSubjects).map(([level, levelSubjects]) => (
            <Card key={level}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Badge className={getLevelColor(levelSubjects[0].education_level_id)}>
                    {level}
                  </Badge>
                  <span className="text-sm font-normal text-gray-600">
                    ({levelSubjects.length} subjects)
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {levelSubjects.map((subject) => {
                    return (
                      <Card key={subject.id} className="hover:shadow-lg transition-shadow">
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between mb-3">
                            <div className="flex items-start gap-3 flex-1">
                              <div className="h-10 w-10 rounded-full bg-orange-100 flex items-center justify-center flex-shrink-0">
                                <BookOpen className="h-5 w-5 text-orange-600" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <h3 className="font-semibold text-base mb-2 break-words">
                                  {subject.name}
                                </h3>
                                <div className="flex flex-wrap gap-1 mb-2">
                                  {subject.religion_id && (
                                    <Badge variant="outline" className="text-xs">
                                      {religions.find(r => r.id === subject.religion_id)?.name || 'Unknown'}
                                    </Badge>
                                  )}
                                  {subject.is_optional && (
                                    <Badge variant="secondary" className="text-xs">
                                      Optional
                                    </Badge>
                                  )}
                                </div>
                              </div>
                            </div>
                            <div className="flex gap-1 flex-shrink-0">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => openEditDialog(subject)}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleDelete(subject.id)}
                              >
                                <Trash2 className="h-4 w-4 text-red-600" />
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </DashboardLayout>
  );
}
