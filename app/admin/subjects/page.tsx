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

  useEffect(() => {
    fetchSubjects();

  }, []);

  async function fetchSubjects() {
    const { data } = await supabase.from('subjects').select('*').order('education_level', { ascending: true }).order('name');
    if (data) {
      setSubjects(data);
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

    const subjectName =
      selectedSubject === 'custom' ? customSubjectName : selectedSubject;

    if (!subjectName) {
      toast.error('Please select or enter a subject name');
      return;
    }

    if (!selectedLevel) {
      toast.error('Please select an education level');
      return;
    }


    const subjectData = {
      name: subjectName,
      education_level: selectedLevel,
      department: selectedLevel === 'SSS' ? selectedDepartment : null,
      religion: selectedReligion || null,
      is_optional: isOptional,

    };

    if (editingSubject) {
      const { error } = await supabase
        .from('subjects')
        .update(subjectData)
        .eq('id', editingSubject.id);

      if (error) {
        if (error.code === '23505') {
          toast.error('This subject already exists for this level/department');
        } else {
          toast.error('Failed to update subject');
        }
        return;
      }

      toast.success('Subject updated successfully');
      closeDialog();
      fetchSubjects();
    } else {
      const { data: newSubject, error } = await supabase.from('subjects').insert(subjectData).select().single();

      if (error) {
        if (error.code === '23505') {
          toast.error('This subject already exists for this level/department');
        } else {
          toast.error('Failed to create subject');
        }
        return;
      }

      let query = supabase.from('classes').select('id').eq('education_level', selectedLevel);
      const { data: classes, error: classesError } = await query;

      if (classesError) {
        toast.error('Could not find classes to apply subjects to.');
        return;
      }
      
      const subjectClasses = classes.map((c) => ({
        class_id: c.id,
        subject_id: newSubject.id,
      }));

      await supabase.from('subject_classes').insert(subjectClasses);
      toast.success('Subject created and applied to all classes in this level');
      closeDialog();
      fetchSubjects();
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Are you sure you want to delete this subject?')) return;

    await supabase.from('subject_classes').delete().eq('subject_id', id);
    const { error } = await supabase.from('subjects').delete().eq('id', id);

    if (error) {
      toast.error('Failed to delete subject');
    } else {
      toast.success('Subject deleted successfully');
      fetchSubjects();
    }
  }

  async function openEditDialog(subject: Subject) {
    setEditingSubject(subject);
    setSelectedLevel(subject.education_level);
    setSelectedDepartment(subject.department || '');

    setSelectedSubject('custom');
    setCustomSubjectName(subject.name);

    setSelectedReligion(subject.religion || '');
    setIsOptional(subject.is_optional);
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
                    >
                      <option value="">No Department</option>
                      <option value="Science">Science</option>
                      <option value="Arts">Arts</option>
                      <option value="Commercial">Commercial</option>
                    </select>
                    <p className="text-xs text-gray-500 mt-1">
                      Department is optional; leave empty to apply to all SSS subjects.
                    </p>
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
                  <Button type="submit" className="flex-1">
                    {editingSubject ? 'Update' : 'Create'}
                  </Button>
                  <Button type="button" variant="outline" onClick={closeDialog}>
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
