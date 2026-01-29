"use client";

import { DashboardLayout } from '@/components/dashboard-layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Plus, Search, Edit, Trash2, BookOpen, User } from 'lucide-react';
import { useEffect, useState } from 'react';
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
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Switch } from '@/components/ui/switch';

const PREDEFINED_SUBJECTS = {
  'Pre-Primary': [
    'English',
    'Hand Writing',
    'Mathematics',
    'Science',
    'Social Habits',
    'Health Habits',
    'Cultural and Creative Arts',
    'Rhymes and Poems',
  ],
  'Primary': [
    'English Studies',
    'Mathematics',
    'French Language',
    'Basic Science and Technology',
    'Physical and Health Education',
    'IRS / CRS',
    'Social Studies',
    'Civic Education',
    'Agricultural Science',
    'Computer Studies',
    'Cultural and Creative Arts',
    'Quantitative Reasoning',
    'Verbal Reasoning',
    'Vocational Studies',
  ],
  'JSS': [
    'English Studies',
    'Mathematics',
    'French Language',
    'Basic Science',
    'Basic Technology',
    'Physical and Health Education',
    'IRS / CRS',
    'Social Studies',
    'Civic Education',
    'Security Education',
    'Agricultural Science',
    'Computer Studies',
    'Cultural and Creative Arts',
    'Home Economics',
    'Business Studies',
    'Coding',
  ],
  'SSS-Science': [
    'Physics',
    'Chemistry',
    'Biology',
    'Coding',
    'Data Processing',
    'Animal Husbandry',
  ],
  'SSS-Arts': [
    'Literature-in-English',
    'Christian Religious Studies',
    'Islamic Religious Studies',
    'Government',
    'Biology',
    'French',
    'History',
    'Music',
    'Yoruba Language',
  ],
  'SSS-Commercial': [
    'Government',
    'Insurance',
    'Book Keeping',
    'Economics',
    'Financial Accounting',
    'Commerce',
    'Marketing',
    'Office Practice',
  ],
  'SSS-All': [
    'English Language',
    'Mathematics',
    'Civic Education',
    'Further Mathematics',
    'Economics',
    'Marketing',
    'Geography',
    'History',
  ],
};

export default function SubjectsPage() {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingSubject, setEditingSubject] = useState<Subject | null>(null);
  const [selectedLevel, setSelectedLevel] = useState<string>('');
  const [selectedSubject, setSelectedSubject] = useState<string>('');
  const [customSubjectName, setCustomSubjectName] = useState<string>('');
  const [selectedDepartment, setSelectedDepartment] = useState<string>('');
  const [selectedReligion, setSelectedReligion] = useState<string>('');
  const [isOptional, setIsOptional] = useState(false);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [assigningSubject, setAssigningSubject] = useState<Subject | null>(null);
  const [selectedTeacher, setSelectedTeacher] = useState("");
  const [forceAssign, setForceAssign] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetchSubjects();

  }, []);

  useEffect(() => {
    async function fetchTeachers() {
      try {
        const response = await fetch('/api/admin-read', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            operation: 'select',
            table: 'teachers',
            select: 'id, first_name, last_name',
          }),
        });
        const data = await response.json();
        if (response.ok) setTeachers(data as Teacher[]);
      } catch (error) {
        console.error('Error fetching teachers:', error);
      }
    }
    fetchTeachers();
  }, []);


  async function fetchSubjects() {
    try {
      const response = await fetch('/api/admin-read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          operation: 'select',
          table: 'subjects',
          select: '*',
          order: [
            { column: 'education_level', ascending: true },
            { column: 'name', ascending: true },
          ],
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        console.error('Error fetching subjects:', data.error);
        toast.error('Failed to fetch subjects');
        return;
      }

      setSubjects(data);
    } catch (error) {
      console.error('Error fetching subjects:', error);
      toast.error('Failed to fetch subjects');
    }
  }


  function getAvailableSubjects(): string[] {
    if (!selectedLevel) return [];

    let predefinedKey = selectedLevel;
    if (selectedLevel === 'SSS' && selectedDepartment) {
      predefinedKey = `SSS-${selectedDepartment}`;
    }

    if (selectedLevel === 'SSS' && !selectedDepartment) {
      predefinedKey = 'SSS-All';
    }


    const allPredefined =
      PREDEFINED_SUBJECTS[predefinedKey as keyof typeof PREDEFINED_SUBJECTS] || [];

    const existingSubjects = subjects
      .filter(
        (s) =>
          s.education_level === selectedLevel &&
          (selectedDepartment ? s.department === selectedDepartment : true)
      )
      .map((s) => s.name);


    return allPredefined.filter((name) => !existingSubjects.includes(name));
  }
  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setIsSubmitting(true);

    const subjectName =
      selectedSubject === 'custom' ? customSubjectName : selectedSubject;

    if (!subjectName) {
      toast.error('Please select or enter a subject name');
      setIsSubmitting(false);
      return;
    }

    if (!selectedLevel) {
      toast.error('Please select an education level');
      setIsSubmitting(false);
      return;
    }

    const subjectData = {
      name: subjectName,
      education_level: selectedLevel,
      department: selectedLevel === 'SSS' ? (selectedDepartment || null) : null,
      religion: selectedReligion || null,
      is_optional: isOptional,
    };

    // ===========================
    // ✏️ EDIT SUBJECT
    // ===========================
    if (editingSubject) {
      try {
        console.log('Updating subject:', editingSubject.id, 'with data:', subjectData);
        
        const response = await fetch('/api/admin-operation', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            operation: 'update',
            table: 'subjects',
            data: subjectData,
            filters: { id: editingSubject.id },
          }),
        });

        const result = await response.json();
        if (!response.ok) {
          if (result.error?.includes('duplicate') || result.error?.includes('23505')) {
            toast.error('This subject already exists for this level/department');
          } else {
            toast.error(result.error || 'Failed to update subject');
          }
          setIsSubmitting(false);
          return;
        }

        console.log('Subject updated successfully:', result);

        // 🔥 AUTO ASSIGN TO EMPTY CLASSES
        const { data: emptyClasses } = await supabase
          .from("classes")
          .select("id")
          .eq("education_level", selectedLevel)
          .is("class_teacher_id", null);

        if (emptyClasses && emptyClasses.length > 0 && selectedTeacher) {
          const classIds = emptyClasses.map(c => c.id);

          for (const classId of classIds) {
            await fetch('/api/admin-operation', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                operation: 'update',
                table: 'subject_classes',
                data: { teacher_id: selectedTeacher || null },
                filters: { subject_id: editingSubject.id, class_id: classId },
              }),
            });
          }
        }

        console.log('Refetching subjects...');
        await fetchSubjects();
        console.log('Subjects refetched');
        
        toast.success('Subject updated successfully');
        setIsSubmitting(false);
        closeDialog();
        return;
      } catch (error: any) {
        console.error('Update error:', error);
        toast.error(error.message || 'Failed to update subject');
        setIsSubmitting(false);
        return;
      }
    }

    // ===========================
    // ➕ CREATE SUBJECT
    // ===========================
    try {
      const response = await fetch('/api/admin-operation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          operation: 'insert',
          table: 'subjects',
          data: subjectData,
        }),
      });

      const result = await response.json();
      if (!response.ok) {
        if (result.error?.includes('duplicate') || result.error?.includes('23505')) {
          toast.error('This subject already exists for this level/department');
        } else {
          toast.error(result.error || 'Failed to create subject');
        }
        setIsSubmitting(false);
        return;
      }

      const newSubject = Array.isArray(result) ? result[0] : result;
      console.log('✅ Subject created:', newSubject);

      // 1️⃣ Get all classes in level (with names) - using API, not direct Supabase
      console.log('🔍 Fetching classes for level:', selectedLevel);
      const classesResponse = await fetch('/api/admin-read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          operation: 'select',
          table: 'classes',
          select: 'id, name',
          filters: { education_level: selectedLevel },
          order: [{ column: 'name', ascending: true }],
        }),
      });

      const classes = await classesResponse.json();
      console.log('📚 Classes found:', classes);

      if (!classesResponse.ok || !Array.isArray(classes) || classes.length === 0) {
        console.error('❌ Error fetching classes:', classes);
        toast.error('Could not find classes to apply subjects to. Response: ' + JSON.stringify(classes));
        setIsSubmitting(false);
        return;
      }

      // 2️⃣ Generate subject code
      const generateSubjectCode = (subjectName: string, className: string) => {
        const clean = subjectName.replace(/\s+/g, "");
        const prefix = clean.slice(0, 3).toUpperCase();
        return `${prefix}-${className}`;
      };

      // 3️⃣ Create subject_classes rows with subject_code
      const subjectClasses = classes.map((c: any) => ({
        class_id: c.id,
        subject_id: newSubject.id,
        subject_code: generateSubjectCode(newSubject.name, c.name),
      }));

      console.log('📝 Creating subject_classes entries:', subjectClasses);

      const subjectClassesResponse = await fetch('/api/admin-operation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          operation: 'insert',
          table: 'subject_classes',
          data: subjectClasses,
        }),
      });

      const subjectClassesResult = await subjectClassesResponse.json();
      console.log('🔧 Subject classes response:', { 
        status: subjectClassesResponse.status, 
        data: subjectClassesResult 
      });

      if (!subjectClassesResponse.ok) {
        console.error('❌ Failed to create subject_classes:', subjectClassesResult);
        toast.error(subjectClassesResult.error || 'Failed to create subject_classes');
        setIsSubmitting(false);
        return;
      }

      console.log('✅ Subject classes created successfully');

      // 4️⃣ Auto assign to empty classes only
      if (selectedTeacher) {
        console.log('👨‍🏫 Attempting to assign teacher:', selectedTeacher);
        const { data: emptyClasses } = await supabase
          .from("classes")
          .select("id")
          .eq("education_level", selectedLevel)
          .is("class_teacher_id", null);

        console.log('📋 Empty classes found:', emptyClasses);

        if (emptyClasses && emptyClasses.length > 0) {
          const classIds = emptyClasses.map(c => c.id);
          console.log('🎯 Assigning to class IDs:', classIds);

          for (const classId of classIds) {
            const assignResponse = await fetch('/api/admin-operation', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                operation: 'update',
                table: 'subject_classes',
                data: { teacher_id: selectedTeacher },
                filters: { subject_id: newSubject.id, class_id: classId },
              }),
            });

            const assignResult = await assignResponse.json();
            if (!assignResponse.ok) {
              console.warn('⚠️ Failed to assign teacher to class:', classId, assignResult.error);
            } else {
              console.log('✅ Teacher assigned to class:', classId);
            }
          }
        } else {
          console.log('ℹ️ No empty classes found for teacher assignment');
        }
      } else {
        console.log('ℹ️ No teacher selected, skipping assignment');
      }

      console.log('🔄 Refetching subjects...');
      await fetchSubjects();
      console.log('✅ Subjects refetched');
      
      toast.success('Subject created and applied to all classes in this level');
      setIsSubmitting(false);
      closeDialog();
    } catch (error: any) {
      console.error('Create error:', error);
      toast.error(error.message || 'Failed to create subject');
      setIsSubmitting(false);
    }
  }


  async function handleDelete(id: string) {
    if (!confirm('Are you sure you want to delete this subject?')) return;

    try {
      // Delete subject_classes first
      await fetch('/api/admin-operation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          operation: 'delete',
          table: 'subject_classes',
          filters: { subject_id: id },
        }),
      });

      // Then delete the subject
      const response = await fetch('/api/admin-operation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          operation: 'delete',
          table: 'subjects',
          filters: { id },
        }),
      });

      const result = await response.json();
      if (!response.ok) throw new Error(result.error);

      await fetchSubjects();
      toast.success('Subject deleted successfully');
    } catch (error: any) {
      console.error('Error:', error);
      toast.error(error.message || 'Failed to delete subject');
    }
  }
  async function openEditDialog(subject: Subject) {
    setEditingSubject(subject);
    setSelectedLevel(subject.education_level);
    setSelectedDepartment(subject.department || "");

    setSelectedSubject("custom");
    setCustomSubjectName(subject.name);

    setSelectedReligion(subject.religion || "");
    setIsOptional(subject.is_optional);

    // 🔥 Load existing assigned teacher (if any)
    const { data, error } = await supabase
      .from("subject_classes")
      .select("teacher_id")
      .eq("subject_id", subject.id)
      .not("teacher_id", "is", null)
      .limit(1)
      .maybeSingle();

    setSelectedTeacher(data?.teacher_id || "");

    setIsDialogOpen(true);
  }


  function closeDialog() {
    setIsDialogOpen(false);
    setEditingSubject(null);
    setSelectedLevel('');
    setSelectedSubject('');
    setCustomSubjectName('');
    setSelectedDepartment('');
    setSelectedReligion('');
    setSelectedTeacher('');
    setIsOptional(false);
  }

  const filteredSubjects = subjects.filter((subject) =>
    subject.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getLevelColor = (level: string) => {
    switch (level) {
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
    let groupKey: string;

    if (subject.education_level === 'SSS') {
      groupKey = subject.department ? `SSS - ${subject.department}` : 'SSS - All';
    } else {
      groupKey = subject.education_level;
    }

    if (!acc[groupKey]) acc[groupKey] = [];
    acc[groupKey].push(subject);
    return acc;
  }, {} as Record<string, Subject[]>);

  const availableSubjectsForSelection = getAvailableSubjects();

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
                    value={selectedLevel}
                    onChange={(e) => {
                      setSelectedLevel(e.target.value);
                      setSelectedSubject('');
                      setCustomSubjectName('');
                      setSelectedDepartment('');
                    }}
                    className="w-full px-3 py-2 border rounded-md"
                    required
                    disabled={!!editingSubject}
                  >
                    <option value="">Select Level</option>
                    <option value="Pre-Primary">Pre-Primary</option>
                    <option value="Primary">Primary</option>
                    <option value="JSS">JSS (Junior Secondary School)</option>
                    <option value="SSS">SSS (Senior Secondary School)</option>
                  </select>
                  {editingSubject && (
                    <p className="text-xs text-gray-500 mt-1">
                      Education level cannot be changed when editing
                    </p>
                  )}
                </div>


                {selectedLevel === 'SSS' && (
                  <div>
                    <Label htmlFor="department">Department (Optional)</Label>
                    <select
                      id="department"
                      value={selectedDepartment}
                      onChange={(e) => {
                        setSelectedDepartment(e.target.value);
                        setSelectedSubject('');
                        setCustomSubjectName('');
                      }}
                      className="w-full px-3 py-2 border rounded-md"
                      disabled={!!editingSubject}
                    >
                      <option value="">No Department</option>
                      <option value="Science">Science</option>
                      <option value="Arts">Arts</option>
                      <option value="Commercial">Commercial</option>
                    </select>
                    {editingSubject ? (
                      <p className="text-xs text-gray-500 mt-1">
                        Department cannot be changed when editing
                      </p>
                    ) : (
                      <p className="text-xs text-gray-500 mt-1">
                        Department is optional; leave empty to apply to all SSS subjects.
                      </p>
                    )}
                  </div>
                )}

                {selectedLevel && !editingSubject && (
                  <div>
                    <Label htmlFor="subject">Subject</Label>
                    <select
                      id="subject"
                      value={selectedSubject}
                      onChange={(e) => {
                        setSelectedSubject(e.target.value);
                        if (e.target.value !== 'custom') {
                          setCustomSubjectName('');
                        }
                      }}
                      className="w-full px-3 py-2 border rounded-md"
                      required
                    >
                      <option value="">Select Subject</option>
                      {availableSubjectsForSelection.map((subject) => (
                        <option key={subject} value={subject}>
                          {subject}
                        </option>
                      ))}
                      <option value="custom">Custom Subject (Not in List)</option>
                    </select>
                    {availableSubjectsForSelection.length === 0 && (
                      <p className="text-xs text-amber-600 mt-1">
                        All predefined subjects have been added. Use custom to add more.
                      </p>
                    )}
                  </div>
                )}

                {(selectedSubject === 'custom' || editingSubject) && (
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
                    value={selectedReligion}
                    onChange={(e) => setSelectedReligion(e.target.value)}
                    className="w-full px-3 py-2 border rounded-md"
                  >
                    <option value="">Not Specific</option>
                    <option value="Christian">Christian</option>
                    <option value="Muslim">Muslim</option>
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
                      under the selected education level
                      {selectedLevel === 'SSS' && selectedDepartment
                        ? ` and ${selectedDepartment} department`
                        : ''}
                      .
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
                  <Badge className={getLevelColor(levelSubjects[0].education_level)}>
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
                                  {subject.religion && (
                                    <Badge variant="outline" className="text-xs">
                                      {subject.religion}
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
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setAssigningSubject(subject);
                                  setAssignDialogOpen(true);
                                }}
                              >
                                <User className="h-4 w-4 mr-1" />
                                Assign Teacher
                              </Button>
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

        <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Assign Teacher to All {assigningSubject?.education_level} Classes</DialogTitle>
            </DialogHeader>

            <div className="space-y-4">
              <div>
                <Label>Select Teacher</Label>
                <select
                  className="w-full border rounded-md p-2"
                  value={selectedTeacher}
                  onChange={(e) => setSelectedTeacher(e.target.value)}
                >
                  <option value="">Select teacher</option>
                  {teachers.map(t => (
                    <option key={t.id} value={t.id}>
                      {t.first_name} {t.last_name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center justify-between border p-3 rounded-md">
                <div>
                  <p className="font-medium">Overwrite existing teachers?</p>
                  <p className="text-sm text-gray-500">
                    If off, only unassigned classes will be filled.
                  </p>
                </div>
                <Switch checked={forceAssign} onCheckedChange={setForceAssign} />
              </div>

              <Button
                disabled={!selectedTeacher}
                onClick={async () => {
                  const loading = toast.loading("Assigning teacher...");

                  const res = await fetch("/api/assign-teacher-to-level", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      teacher_id: selectedTeacher,
                      subject_id: assigningSubject?.id,
                      education_level: assigningSubject?.education_level,
                      force: forceAssign,
                    }),
                  });

                  const json = await res.json();

                  if (!res.ok) {
                    toast.error(json.error || "Failed", { id: loading });
                  } else {
                    toast.success("Teacher assigned successfully", { id: loading });
                    setAssignDialogOpen(false);
                  }
                }}
              >
                Assign
              </Button>
            </div>
          </DialogContent>
        </Dialog>

      </div>
    </DashboardLayout>
  );
}
