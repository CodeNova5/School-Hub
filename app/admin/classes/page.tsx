"use client";

import { DashboardLayout } from '@/components/dashboard-layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Plus, Search, Edit, Trash2, Users, BookOpen, User } from 'lucide-react';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Class, Teacher, Session } from '@/lib/types';
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

const EDUCATION_LEVELS = {
  'Pre-Primary': ['Nursery 1', 'Nursery 2', 'KG 1', 'KG 2'],
  'Primary': ['Primary 1', 'Primary 2', 'Primary 3', 'Primary 4', 'Primary 5', 'Primary 6'],
  'JSS': ['JSS 1', 'JSS 2', 'JSS 3'],
  'SSS': ['SSS 1', 'SSS 2', 'SSS 3'],
};

export default function ClassesPage() {
  const [classes, setClasses] = useState<Class[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingClass, setEditingClass] = useState<Class | null>(null);
  const [selectedEducationLevel, setSelectedEducationLevel] = useState<string>('');
  const [selectedLevel, setSelectedLevel] = useState<string>('');
  const [selectedDepartment, setSelectedDepartment] = useState<string>('');
  const [filterLevel, setFilterLevel] = useState<string>('');

  useEffect(() => {
    fetchClasses();
    fetchTeachers();
    fetchSessions();
  }, []);

  async function fetchClasses() {
    const { data } = await supabase
      .from('classes')
      .select('*')
      .order('level');

    if (data) {
      const classesWithStats = await Promise.all(
        data.map(async (cls) => {
          const [studentsRes, teachersRes, subjectsRes] = await Promise.all([
            supabase.from('students').select('id', { count: 'exact' }).eq('class_id', cls.id).eq('status', 'active'),
            supabase.from('teacher_classes').select('id', { count: 'exact' }).eq('class_id', cls.id),
            supabase.from('subject_classes').select('id', { count: 'exact' }).eq('class_id', cls.id),
          ]);

          const teacher = cls.class_teacher_id
            ? teachers.find((t) => t.id === cls.class_teacher_id)
            : null;

          return {
            ...cls,
            studentCount: studentsRes.count || 0,
            teacherCount: teachersRes.count || 0,
            subjectCount: subjectsRes.count || 0,
            teacherName: teacher ? `${teacher.first_name} ${teacher.last_name}` : undefined,
          };
        })
      );
      setClasses(classesWithStats);
    }
  }

  async function fetchTeachers() {
    const { data } = await supabase
      .from('teachers')
      .select('*')
      .eq('status', 'active')
      .order('first_name');
    if (data) setTeachers(data);
  }

  async function fetchSessions() {
    const { data } = await supabase.from('sessions').select('*').order('start_date', { ascending: false });
    if (data) setSessions(data);
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    const classData = {
      name: formData.get('name') as string,
      level: selectedLevel,
      capacity: parseInt(formData.get('capacity') as string) || 30,
      room_number: formData.get('room_number') as string || null,
      class_teacher_id: formData.get('class_teacher_id') as string || null,
      academic_year: formData.get('academic_year') as string || null,
      department: selectedLevel.startsWith('SSS') ? selectedDepartment : null,
      stream: formData.get('stream') as string || null,
      session_id: formData.get('session_id') as string || null,
    };

    if (!selectedLevel) {
      toast.error('Please select a class level');
      return;
    }

    if (selectedLevel.startsWith('SSS') && !selectedDepartment) {
      toast.error('Please select a department for SSS classes');
      return;
    }

    if (editingClass) {
      const { error } = await supabase.from('classes').update(classData).eq('id', editingClass.id);

      if (error) {
        toast.error('Failed to update class');
      } else {
        toast.success('Class updated successfully');
        closeDialog();
        fetchClasses();
      }
    } else {
      const { error } = await supabase.from('classes').insert(classData);

      if (error) {
        toast.error('Failed to create class');
      } else {
        toast.success('Class created successfully');
        closeDialog();
        fetchClasses();
      }
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Are you sure you want to delete this class?')) return;

    const { error } = await supabase.from('classes').delete().eq('id', id);

    if (error) {
      toast.error('Failed to delete class');
    } else {
      toast.success('Class deleted successfully');
      fetchClasses();
    }
  }

  function openEditDialog(cls: Class) {
    setEditingClass(cls);

    const educationLevel = Object.keys(EDUCATION_LEVELS).find((key) =>
      EDUCATION_LEVELS[key as keyof typeof EDUCATION_LEVELS].includes(cls.level)
    );

    setSelectedEducationLevel(educationLevel || '');
    setSelectedLevel(cls.level);
    setSelectedDepartment(cls.department || '');
    setIsDialogOpen(true);
  }

  function closeDialog() {
    setIsDialogOpen(false);
    setEditingClass(null);
    setSelectedEducationLevel('');
    setSelectedLevel('');
    setSelectedDepartment('');
  }

  const filteredClasses = classes.filter((cls) => {
    const matchesSearch = cls.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         cls.level.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFilter = !filterLevel || cls.level === filterLevel;
    return matchesSearch && matchesFilter;
  });

  const getLevelColor = (level: string) => {
    if (level.startsWith('Nursery') || level.startsWith('KG')) return 'bg-pink-100 text-pink-700';
    if (level.startsWith('Primary')) return 'bg-blue-100 text-blue-700';
    if (level.startsWith('JSS')) return 'bg-green-100 text-green-700';
    if (level.startsWith('SSS')) return 'bg-purple-100 text-purple-700';
    return 'bg-gray-100 text-gray-700';
  };

  const groupedClasses = filteredClasses.reduce((acc, cls) => {
    const educationLevel = Object.keys(EDUCATION_LEVELS).find((key) =>
      EDUCATION_LEVELS[key as keyof typeof EDUCATION_LEVELS].includes(cls.level)
    ) || 'Other';

    if (!acc[educationLevel]) acc[educationLevel] = [];
    acc[educationLevel].push(cls);
    return acc;
  }, {} as Record<string, Class[]>);

  const currentSession = sessions.find((s) => s.is_current);

  return (
    <DashboardLayout role="admin">
      <div className="space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Classes</h1>
            <p className="text-gray-600 mt-1">Manage school classes across all education levels</p>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => setEditingClass(null)}>
                <Plus className="mr-2 h-4 w-4" />
                Add Class
              </Button>
            </DialogTrigger>
            <DialogContent className="max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editingClass ? 'Edit Class' : 'Add New Class'}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label htmlFor="name">Class Name</Label>
                  <Input
                    id="name"
                    name="name"
                    placeholder="e.g., Class A, Gold Class"
                    defaultValue={editingClass?.name}
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="education_level">Education Level</Label>
                  <select
                    id="education_level"
                    value={selectedEducationLevel}
                    onChange={(e) => {
                      setSelectedEducationLevel(e.target.value);
                      setSelectedLevel('');
                      setSelectedDepartment('');
                    }}
                    className="w-full px-3 py-2 border rounded-md"
                    required
                  >
                    <option value="">Select Education Level</option>
                    <option value="Pre-Primary">Pre-Primary</option>
                    <option value="Primary">Primary</option>
                    <option value="JSS">JSS (Junior Secondary)</option>
                    <option value="SSS">SSS (Senior Secondary)</option>
                  </select>
                </div>

                {selectedEducationLevel && (
                  <div>
                    <Label htmlFor="level">Class Level</Label>
                    <select
                      id="level"
                      value={selectedLevel}
                      onChange={(e) => setSelectedLevel(e.target.value)}
                      className="w-full px-3 py-2 border rounded-md"
                      required
                    >
                      <option value="">Select Level</option>
                      {EDUCATION_LEVELS[selectedEducationLevel as keyof typeof EDUCATION_LEVELS].map((level) => (
                        <option key={level} value={level}>
                          {level}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {selectedLevel.startsWith('SSS') && (
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
                  <Label htmlFor="stream">Stream (Optional)</Label>
                  <Input
                    id="stream"
                    name="stream"
                    placeholder="e.g., A, B, Alpha, Beta"
                    defaultValue={editingClass?.stream}
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Use streams for multiple classes of the same level
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="capacity">Class Capacity</Label>
                    <Input
                      id="capacity"
                      name="capacity"
                      type="number"
                      min="1"
                      defaultValue={editingClass?.capacity || 30}
                      required
                    />
                  </div>

                  <div>
                    <Label htmlFor="room_number">Room Number</Label>
                    <Input
                      id="room_number"
                      name="room_number"
                      placeholder="e.g., 101, A-12"
                      defaultValue={editingClass?.room_number}
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="class_teacher_id">Class Teacher</Label>
                  <select
                    id="class_teacher_id"
                    name="class_teacher_id"
                    className="w-full px-3 py-2 border rounded-md"
                    defaultValue={editingClass?.class_teacher_id}
                  >
                    <option value="">No Class Teacher</option>
                    {teachers.map((teacher) => (
                      <option key={teacher.id} value={teacher.id}>
                        {teacher.first_name} {teacher.last_name} - {teacher.staff_id}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="academic_year">Academic Year</Label>
                    <Input
                      id="academic_year"
                      name="academic_year"
                      placeholder="e.g., 2023/2024"
                      defaultValue={editingClass?.academic_year}
                    />
                  </div>

                  <div>
                    <Label htmlFor="session_id">Session</Label>
                    <select
                      id="session_id"
                      name="session_id"
                      className="w-full px-3 py-2 border rounded-md"
                      defaultValue={editingClass?.session_id || currentSession?.id}
                    >
                      <option value="">No Session</option>
                      {sessions.map((session) => (
                        <option key={session.id} value={session.id}>
                          {session.name} {session.is_current && '(Current)'}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button type="submit" className="flex-1">
                    {editingClass ? 'Update' : 'Create'}
                  </Button>
                  <Button type="button" variant="outline" onClick={closeDialog}>
                    Cancel
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Search & Filters</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search classes..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>

              <select
                value={filterLevel}
                onChange={(e) => setFilterLevel(e.target.value)}
                className="px-3 py-2 border rounded-md"
              >
                <option value="">All Levels</option>
                {Object.entries(EDUCATION_LEVELS).map(([category, levels]) => (
                  <optgroup key={category} label={category}>
                    {levels.map((level) => (
                      <option key={level} value={level}>
                        {level}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </div>
          </CardContent>
        </Card>

        {Object.keys(groupedClasses).length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center">
              <Users className="h-12 w-12 mx-auto text-gray-300 mb-4" />
              <p className="text-gray-500">No classes found</p>
            </CardContent>
          </Card>
        ) : (
          Object.entries(groupedClasses).map(([educationLevel, levelClasses]) => (
            <Card key={educationLevel}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <span>{educationLevel}</span>
                  <Badge variant="outline">
                    {levelClasses.length} {levelClasses.length === 1 ? 'class' : 'classes'}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                  {levelClasses.map((cls) => (
                    <Card key={cls.id} className="hover:shadow-lg transition-shadow">
                      <CardContent className="p-6">
                        <div className="flex items-start justify-between mb-4">
                          <div className="flex-1">
                            <h3 className="font-semibold text-lg mb-2">
                              {cls.name}
                              {cls.stream && <span className="text-gray-500"> ({cls.stream})</span>}
                            </h3>
                            <div className="flex flex-wrap gap-1 mb-3">
                              <Badge className={getLevelColor(cls.level)}>{cls.level}</Badge>
                              {cls.department && (
                                <Badge variant="outline">{cls.department}</Badge>
                              )}
                              {cls.room_number && (
                                <Badge variant="secondary">Room {cls.room_number}</Badge>
                              )}
                            </div>

                            <div className="space-y-2 text-sm">
                              {cls.teacherName && (
                                <div className="flex items-center gap-2 text-gray-600">
                                  <User className="h-4 w-4" />
                                  <span>{cls.teacherName}</span>
                                </div>
                              )}
                              <div className="flex items-center gap-2 text-gray-600">
                                <Users className="h-4 w-4" />
                                <span>
                                  {cls.studentCount}/{cls.capacity} students
                                </span>
                              </div>
                              <div className="flex items-center gap-2 text-gray-600">
                                <BookOpen className="h-4 w-4" />
                                <span>{cls.subjectCount} subjects</span>
                              </div>
                            </div>
                          </div>

                          <div className="flex gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => openEditDialog(cls)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDelete(cls.id)}
                            >
                              <Trash2 className="h-4 w-4 text-red-600" />
                            </Button>
                          </div>
                        </div>

                        <div className="w-full bg-gray-200 rounded-full h-2 mt-4">
                          <div
                            className="bg-blue-600 h-2 rounded-full"
                            style={{
                              width: `${Math.min(((cls.studentCount || 0) / cls.capacity) * 100, 100)}%`,
                            }}
                          />
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </DashboardLayout>
  );
}
