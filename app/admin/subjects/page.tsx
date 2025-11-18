"use client";

import { DashboardLayout } from '@/components/dashboard-layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Plus, Search, Edit, Trash2, BookOpen } from 'lucide-react';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Subject, Class } from '@/lib/types';
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

export default function SubjectsPage() {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingSubject, setEditingSubject] = useState<Subject | null>(null);
  const [selectedLevel, setSelectedLevel] = useState<string>('');
  const [selectedDepartment, setSelectedDepartment] = useState<string>('');
  const [selectedReligion, setSelectedReligion] = useState<string>('');
  const [isOptional, setIsOptional] = useState(false);
  const [selectedClasses, setSelectedClasses] = useState<string[]>([]);

  useEffect(() => {
    fetchSubjects();
    fetchClasses();
  }, []);

  async function fetchSubjects() {
    const { data } = await supabase.from('subjects').select('*').order('name');
    if (data) setSubjects(data);
  }

  async function fetchClasses() {
    const { data } = await supabase.from('classes').select('*').order('name');
    if (data) setClasses(data);
  }

  async function loadSubjectClasses(subjectId: string) {
    const { data } = await supabase
      .from('subject_classes')
      .select('class_id')
      .eq('subject_id', subjectId);

    if (data) {
      setSelectedClasses(data.map((sc) => sc.class_id));
    }
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    const subjectData = {
      name: formData.get('name') as string,
      education_level: selectedLevel,
      department: selectedLevel === 'SSS' ? selectedDepartment : null,
      religion: selectedReligion || null,
      is_optional: isOptional,
    };

    if (!selectedLevel) {
      toast.error('Please select an education level');
      return;
    }

    if (selectedLevel === 'SSS' && !selectedDepartment) {
      toast.error('Please select a department for SSS subjects');
      return;
    }

    if (editingSubject) {
      const { error } = await supabase
        .from('subjects')
        .update(subjectData)
        .eq('id', editingSubject.id);

      if (error) {
        toast.error('Failed to update subject');
        return;
      }

      await supabase.from('subject_classes').delete().eq('subject_id', editingSubject.id);

      if (selectedClasses.length > 0) {
        const classAssignments = selectedClasses.map((classId) => ({
          subject_id: editingSubject.id,
          class_id: classId,
        }));

        await supabase.from('subject_classes').insert(classAssignments);
      }

      toast.success('Subject updated successfully');
      closeDialog();
      fetchSubjects();
    } else {
      const { data: subject, error } = await supabase
        .from('subjects')
        .insert(subjectData)
        .select()
        .single();

      if (error) {
        toast.error('Failed to create subject');
        return;
      }

      if (selectedClasses.length > 0) {
        const classAssignments = selectedClasses.map((classId) => ({
          subject_id: subject.id,
          class_id: classId,
        }));

        await supabase.from('subject_classes').insert(classAssignments);
      }

      toast.success('Subject created successfully');
      closeDialog();
      fetchSubjects();
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Are you sure you want to delete this subject?')) return;

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
    setSelectedReligion(subject.religion || '');
    setIsOptional(subject.is_optional);
    await loadSubjectClasses(subject.id);
    setIsDialogOpen(true);
  }

  function closeDialog() {
    setIsDialogOpen(false);
    setEditingSubject(null);
    setSelectedLevel('');
    setSelectedDepartment('');
    setSelectedReligion('');
    setIsOptional(false);
    setSelectedClasses([]);
  }

  function toggleClassSelection(classId: string) {
    setSelectedClasses((prev) =>
      prev.includes(classId) ? prev.filter((id) => id !== classId) : [...prev, classId]
    );
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

  return (
    <DashboardLayout role="admin">
      <div className="space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Subjects</h1>
            <p className="text-gray-600 mt-1">Manage academic subjects</p>
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
                  <Label htmlFor="name">Subject Name</Label>
                  <Input
                    id="name"
                    name="name"
                    placeholder="e.g., Mathematics, English Language"
                    defaultValue={editingSubject?.name}
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="education_level">Education Level</Label>
                  <select
                    id="education_level"
                    value={selectedLevel}
                    onChange={(e) => {
                      setSelectedLevel(e.target.value);
                      if (e.target.value !== 'SSS') {
                        setSelectedDepartment('');
                      }
                    }}
                    className="w-full px-3 py-2 border rounded-md"
                    required
                  >
                    <option value="">Select Level</option>
                    <option value="Pre-Primary">Pre-Primary</option>
                    <option value="Primary">Primary</option>
                    <option value="JSS">JSS (Junior Secondary School)</option>
                    <option value="SSS">SSS (Senior Secondary School)</option>
                  </select>
                </div>

                {selectedLevel === 'SSS' && (
                  <div>
                    <Label htmlFor="department">Department</Label>
                    <select
                      id="department"
                      value={selectedDepartment}
                      onChange={(e) => setSelectedDepartment(e.target.value)}
                      className="w-full px-3 py-2 border rounded-md"
                      required
                    >
                      <option value="">Select Department</option>
                      <option value="Science">Science</option>
                      <option value="Arts">Arts</option>
                      <option value="Commercial">Commercial</option>
                    </select>
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

                <div>
                  <Label>Assign Classes</Label>
                  <div className="border rounded-md p-3 max-h-48 overflow-y-auto space-y-2">
                    {classes.map((cls) => (
                      <label key={cls.id} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={selectedClasses.includes(cls.id)}
                          onChange={() => toggleClassSelection(cls.id)}
                          className="h-4 w-4"
                        />
                        <span className="text-sm">
                          {cls.name} - {cls.level}
                        </span>
                      </label>
                    ))}
                    {classes.length === 0 && (
                      <p className="text-sm text-gray-500">No classes available</p>
                    )}
                  </div>
                </div>

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

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {filteredSubjects.map((subject) => (
            <Card key={subject.id} className="hover:shadow-lg transition-shadow">
              <CardContent className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-start gap-3">
                    <div className="h-12 w-12 rounded-full bg-orange-100 flex items-center justify-center">
                      <BookOpen className="h-6 w-6 text-orange-600" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold text-lg">{subject.name}</h3>
                      <div className="flex flex-wrap gap-1 mt-2">
                        <Badge className={getLevelColor(subject.education_level)}>
                          {subject.education_level}
                        </Badge>
                        {subject.department && (
                          <Badge variant="outline">{subject.department}</Badge>
                        )}
                        {subject.religion && (
                          <Badge variant="outline">{subject.religion}</Badge>
                        )}
                        {subject.is_optional && (
                          <Badge variant="secondary">Optional</Badge>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" onClick={() => openEditDialog(subject)}>
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
          ))}
        </div>

        {filteredSubjects.length === 0 && (
          <Card>
            <CardContent className="p-12 text-center">
              <BookOpen className="h-12 w-12 mx-auto text-gray-300 mb-4" />
              <p className="text-gray-500">No subjects found</p>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
