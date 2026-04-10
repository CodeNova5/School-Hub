"use client";

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { DashboardLayout } from '@/components/dashboard-layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { Loader2, Download, Search, Palette } from 'lucide-react';
import { useSchoolContext } from '@/hooks/use-school-context';
import IDCardTemplate from '@/components/id-card-template';
import { exportStudentCardToPDF } from '@/lib/pdf-export-student-card';

interface StudentData {
  id: string;
  student_id: string;
  first_name: string;
  last_name: string;
  image_url?: string;
  class_id?: string;
  class_name?: string;
}

interface SchoolData {
  id: string;
  name: string;
  address: string;
  logo_url: string;
}

interface ClassData {
  id: string;
  name: string;
}

interface CardColors {
  primary: string;
  secondary: string;
  accent: string;
}

const PRESET_THEMES = [
  { name: 'School Blue', colors: { primary: '#1e40af', secondary: '#3b82f6', accent: '#93c5fd' } },
  { name: 'Forest Green', colors: { primary: '#15803d', secondary: '#22c55e', accent: '#86efac' } },
  { name: 'Professional Red', colors: { primary: '#991b1b', secondary: '#ef4444', accent: '#fca5a5' } },
  { name: 'Purple Elegance', colors: { primary: '#6b21a8', secondary: '#a855f7', accent: '#e9d5ff' } },
  { name: 'Ocean Blue', colors: { primary: '#0c4a6e', secondary: '#0ea5e9', accent: '#7dd3fc' } },
];

export default function IDCardGeneratorPage() {
  const router = useRouter();
  const { schoolId, isLoading: schoolLoading } = useSchoolContext();
  
  const [school, setSchool] = useState<SchoolData | null>(null);
  const [classes, setClasses] = useState<ClassData[]>([]);
  const [selectedClass, setSelectedClass] = useState<string | null>(null);
  const [students, setStudents] = useState<StudentData[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<StudentData | null>(null);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  const [cardColors, setCardColors] = useState<CardColors>({
    primary: '#1e40af',
    secondary: '#3b82f6',
    accent: '#93c5fd',
  });
  const [currentPage, setCurrentPage] = useState(1);
  const STUDENTS_PER_PAGE = 10;

  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!schoolLoading && schoolId) {
      fetchSchoolData();
      fetchClasses();
    }
  }, [schoolId, schoolLoading]);

  useEffect(() => {
    if (selectedClass) {
      setCurrentPage(1);
      fetchStudents();
    }
  }, [selectedClass]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery]);

  async function fetchSchoolData() {
    if (!schoolId) return;
    try {
      const { data, error } = await supabase
        .from('schools')
        .select('id, name, address, logo_url')
        .eq('id', schoolId)
        .single();

      if (error) {
        toast.error('Failed to load school data');
        return;
      }

      setSchool(data);
    } catch (error) {
      console.error('Error fetching school:', error);
      toast.error('Failed to load school data');
    }
  }

  async function fetchClasses() {
    if (!schoolId) return;
    try {
      const { data, error } = await supabase
        .from('classes')
        .select('id, name')
        .eq('school_id', schoolId)
        .order('name', { ascending: true });

      if (error) {
        toast.error('Failed to load classes');
        return;
      }

      setClasses(data || []);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching classes:', error);
      toast.error('Failed to load classes');
      setLoading(false);
    }
  }

  async function fetchStudents() {
    if (!schoolId || !selectedClass) return;
    try {
      setSearching(true);
      const { data, error } = await supabase
        .from('students')
        .select(`
          id,
          student_id,
          first_name,
          last_name,
          image_url,
          class_id,
          classes:class_id (name)
        `)
        .eq('school_id', schoolId)
        .eq('class_id', selectedClass)
        .eq('status', 'active')
        .order('first_name', { ascending: true });

      if (error) {
        toast.error('Failed to load students');
        return;
      }

      const formattedStudents = data?.map((student: any) => ({
        id: student.id,
        student_id: student.student_id,
        first_name: student.first_name,
        last_name: student.last_name,
        image_url: student.image_url,
        class_id: student.class_id,
        class_name: student.classes?.name || 'N/A',
      })) || [];

      setStudents(formattedStudents);
    } catch (error) {
      console.error('Error fetching students:', error);
      toast.error('Failed to load students');
    } finally {
      setSearching(false);
    }
  }

  const filteredStudents = students.filter(student =>
    student.first_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    student.last_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    student.student_id.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const totalPages = Math.ceil(filteredStudents.length / STUDENTS_PER_PAGE);
  const paginatedStudents = filteredStudents.slice(
    (currentPage - 1) * STUDENTS_PER_PAGE,
    currentPage * STUDENTS_PER_PAGE
  );

  async function handleExportPDF() {
    if (!selectedStudent || !cardRef.current || !school) {
      toast.error('Please select a student first');
      return;
    }

    try {
      setExporting(true);
      await exportStudentCardToPDF(
        cardRef.current,
        `${selectedStudent.first_name}_${selectedStudent.last_name}`,
        school.name,
        selectedStudent.student_id
      );
      toast.success('ID card downloaded successfully!');
    } catch (error) {
      console.error('Error exporting PDF:', error);
      toast.error('Failed to export PDF');
    } finally {
      setExporting(false);
    }
  }

  if (loading || schoolLoading) {
    return (
      <DashboardLayout role="admin">
        <div className="flex items-center justify-center min-h-screen">
          <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout role="admin">
      <div className="space-y-8 px-2 sm:px-0">
        {/* Header */}
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold break-words">Student ID Card Generator</h1>
          <p className="text-gray-600 mt-1 text-sm sm:text-base break-words">
            Create and customize ID cards for your students
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Panel - Student Selection & Color Customization */}
          <div className="lg:col-span-1 space-y-6">
            {/* Student Search Card */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                  <Search className="w-5 h-5" />
                  Select Student
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label className="text-gray-700 text-sm">Select Class</Label>
                  <select
                    value={selectedClass || ''}
                    onChange={(e) => setSelectedClass(e.target.value)}
                    className="mt-2 text-sm border rounded-md p-2 w-full focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="" disabled>
                      Choose a class
                    </option>
                    {classes.map((cls) => (
                      <option key={cls.id} value={cls.id}>
                        {cls.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <Label className="text-gray-700 text-sm">Search by Name or ID</Label>
                  <Input
                    type="text"
                    placeholder="Type student name or ID..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="mt-2 text-sm"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-gray-700 text-sm">Students ({filteredStudents.length})</Label>
                  <div className="border rounded-md max-h-64 overflow-y-auto">
                    {filteredStudents.length === 0 ? (
                      <div className="p-4 text-center text-gray-500 text-sm">
                        {searching ? 'Loading...' : 'No students found'}
                      </div>
                    ) : (
                      paginatedStudents.map((student) => (
                        <button
                          key={student.id}
                          onClick={() => setSelectedStudent(student)}
                          className={`w-full text-left p-3 border-b text-sm last:border-b-0 transition-colors ${
                            selectedStudent?.id === student.id
                              ? 'bg-blue-50 border-l-4 border-l-blue-600'
                              : 'hover:bg-gray-50'
                          }`}
                        >
                          <div className="font-medium text-gray-900">
                            {student.first_name} {student.last_name}
                          </div>
                          <div className="text-xs text-gray-500">
                            ID: {student.student_id} • {student.class_name}
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                  
                  {/* Pagination Controls */}
                  {filteredStudents.length > 0 && (
                    <div className="flex items-center justify-between pt-3 border-t">
                      <Button
                        onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                        disabled={currentPage === 1}
                        variant="outline"
                        size="sm"
                        className="text-xs"
                      >
                        Previous
                      </Button>
                      <span className="text-xs text-gray-600">
                        Page {currentPage} of {totalPages}
                      </span>
                      <Button
                        onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                        disabled={currentPage === totalPages}
                        variant="outline"
                        size="sm"
                        className="text-xs"
                      >
                        Next
                      </Button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Color Customization Card */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                  <Palette className="w-5 h-5" />
                  Customize Colors
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Preset Themes */}
                <div>
                  <Label className="text-gray-700 text-sm font-semibold block mb-2">Quick Themes</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {PRESET_THEMES.map((theme) => (
                      <button
                        key={theme.name}
                        onClick={() => setCardColors(theme.colors)}
                        className="p-3 rounded-lg border-2 transition-all hover:border-blue-600"
                        title={theme.name}
                      >
                        <div className="flex gap-1 mb-1">
                          <div
                            className="w-3 h-3 rounded"
                            style={{ backgroundColor: theme.colors.primary }}
                          />
                          <div
                            className="w-3 h-3 rounded"
                            style={{ backgroundColor: theme.colors.secondary }}
                          />
                          <div
                            className="w-3 h-3 rounded"
                            style={{ backgroundColor: theme.colors.accent }}
                          />
                        </div>
                        <p className="text-xs text-gray-600 truncate">{theme.name}</p>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Custom Color Pickers */}
                <div className="border-t pt-4 space-y-3">
                  <Label className="text-gray-700 text-sm font-semibold">Custom Colors</Label>
                  
                  <div>
                    <label className="text-xs text-gray-600 block mb-2">Primary Color</label>
                    <div className="flex gap-2">
                      <div
                        className="w-10 h-10 rounded border-2 cursor-pointer"
                        style={{ backgroundColor: cardColors.primary, borderColor: cardColors.primary }}
                      />
                      <Input
                        type="text"
                        value={cardColors.primary}
                        onChange={(e) => setCardColors({ ...cardColors, primary: e.target.value })}
                        placeholder="#1e40af"
                        className="text-xs"
                      />
                      <Input
                        type="color"
                        value={cardColors.primary}
                        onChange={(e) => setCardColors({ ...cardColors, primary: e.target.value })}
                        className="w-10 h-10 p-1 cursor-pointer"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-xs text-gray-600 block mb-2">Secondary Color</label>
                    <div className="flex gap-2">
                      <div
                        className="w-10 h-10 rounded border-2 cursor-pointer"
                        style={{ backgroundColor: cardColors.secondary, borderColor: cardColors.secondary }}
                      />
                      <Input
                        type="text"
                        value={cardColors.secondary}
                        onChange={(e) => setCardColors({ ...cardColors, secondary: e.target.value })}
                        placeholder="#3b82f6"
                        className="text-xs"
                      />
                      <Input
                        type="color"
                        value={cardColors.secondary}
                        onChange={(e) => setCardColors({ ...cardColors, secondary: e.target.value })}
                        className="w-10 h-10 p-1 cursor-pointer"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-xs text-gray-600 block mb-2">Accent Color</label>
                    <div className="flex gap-2">
                      <div
                        className="w-10 h-10 rounded border-2 cursor-pointer"
                        style={{ backgroundColor: cardColors.accent, borderColor: cardColors.accent }}
                      />
                      <Input
                        type="text"
                        value={cardColors.accent}
                        onChange={(e) => setCardColors({ ...cardColors, accent: e.target.value })}
                        placeholder="#93c5fd"
                        className="text-xs"
                      />
                      <Input
                        type="color"
                        value={cardColors.accent}
                        onChange={(e) => setCardColors({ ...cardColors, accent: e.target.value })}
                        className="w-10 h-10 p-1 cursor-pointer"
                      />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Export Button */}
            <Button
              onClick={handleExportPDF}
              disabled={!selectedStudent || exporting}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white h-12"
              size="lg"
            >
              {exporting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Generating PDF...
                </>
              ) : (
                <>
                  <Download className="w-4 h-4 mr-2" />
                  Download as PDF
                </>
              )}
            </Button>
          </div>

          {/* Right Panel - Card Preview */}
          <div className="lg:col-span-2">
            <Card className="sticky top-20">
              <CardHeader>
                <CardTitle className="text-base sm:text-lg">ID Card Preview</CardTitle>
              </CardHeader>
              <CardContent>
                {selectedStudent && school ? (
                  <div className="flex justify-center bg-gray-100 p-8 rounded-lg">
                    <div ref={cardRef}>
                      <IDCardTemplate
                        student={selectedStudent}
                        school={school}
                        colors={cardColors}
                      />
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center p-12 text-center">
                    <Search className="w-12 h-12 text-gray-300 mb-4" />
                    <p className="text-gray-500 text-lg font-medium">No student selected</p>
                    <p className="text-gray-400 text-sm mt-2">
                      Choose a student from the list to preview their ID card
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
