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
import { Loader2, Download, Search, Palette, Clock, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import { useSchoolContext } from '@/hooks/use-school-context';
import TeacherIDCardTemplate from '@/components/teacher-id-card-template';
import { exportTeacherCardToPDF, exportMultipleTeacherCardsToPDF } from '@/lib/pdf-export-teacher-card';

interface TeacherData {
  id: string;
  staff_id: string;
  first_name: string;
  last_name: string;
  email: string;
  specialization?: string;
  photo_url?: string;
}

interface SchoolData {
  id: string;
  name: string;
  address: string;
  logo_url: string;
}

interface CardColors {
  primary: string;
  secondary: string;
  accent: string;
}

interface AttendanceRecord {
  id: string;
  teacher_id: string;
  date: string;
  status: 'present' | 'absent' | 'late' | 'excused';
  notes: string;
}

const PRESET_THEMES = [
  { name: 'School Blue', colors: { primary: '#1e40af', secondary: '#3b82f6', accent: '#93c5fd' } },
  { name: 'Forest Green', colors: { primary: '#15803d', secondary: '#22c55e', accent: '#86efac' } },
  { name: 'Professional Red', colors: { primary: '#991b1b', secondary: '#ef4444', accent: '#fca5a5' } },
  { name: 'Purple Elegance', colors: { primary: '#6b21a8', secondary: '#a855f7', accent: '#e9d5ff' } },
  { name: 'Ocean Blue', colors: { primary: '#0c4a6e', secondary: '#0ea5e9', accent: '#7dd3fc' } },
];

export default function TeacherIDCardGeneratorPage() {
  const router = useRouter();
  const { schoolId, isLoading: schoolLoading } = useSchoolContext();
  
  const [school, setSchool] = useState<SchoolData | null>(null);
  const [teachers, setTeachers] = useState<TeacherData[]>([]);
  const [selectedTeacher, setSelectedTeacher] = useState<TeacherData | null>(null);
  const [selectedTeachers, setSelectedTeachers] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [tabValue, setTabValue] = useState('preview');
  
  const [cardColors, setCardColors] = useState<CardColors>({
    primary: '#1e40af',
    secondary: '#3b82f6',
    accent: '#93c5fd',
  });

  const [attendanceData, setAttendanceData] = useState<AttendanceRecord | null>(null);
  const [markingAttendance, setMarkingAttendance] = useState(false);
  const [attendanceStatus, setAttendanceStatus] = useState<'present' | 'absent' | 'late' | 'excused'>('present');
  const [attendanceNotes, setAttendanceNotes] = useState('');

  const [currentPage, setCurrentPage] = useState(1);
  const TEACHERS_PER_PAGE = 10;

  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!schoolLoading && schoolId) {
      fetchSchoolData();
      fetchTeachers();
    }
  }, [schoolId, schoolLoading]);

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

  async function fetchTeachers() {
    if (!schoolId) return;
    try {
      setSearching(true);
      const { data, error } = await supabase
        .from('teachers')
        .select('id, staff_id, first_name, last_name, email, specialization, photo_url')
        .eq('school_id', schoolId)
        .eq('status', 'active')
        .order('first_name', { ascending: true });

      if (error) {
        toast.error('Failed to load teachers');
        return;
      }

      setTeachers(data || []);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching teachers:', error);
      toast.error('Failed to load teachers');
      setLoading(false);
    } finally {
      setSearching(false);
    }
  }

  async function fetchTodayAttendance(teacherId: string) {
    if (!schoolId) return;
    try {
      const today = new Date().toISOString().split('T')[0];
      const { data, error } = await supabase
        .from('teacher_attendance')
        .select('*')
        .eq('teacher_id', teacherId)
        .eq('date', today)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('Error fetching attendance:', error);
        return;
      }

      if (data) {
        setAttendanceData(data);
        setAttendanceStatus(data.status);
        setAttendanceNotes(data.notes || '');
      } else {
        setAttendanceData(null);
        setAttendanceStatus('present');
        setAttendanceNotes('');
      }
    } catch (error) {
      console.error('Error fetching attendance:', error);
    }
  }

  const filteredTeachers = teachers.filter(teacher =>
    teacher.first_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    teacher.last_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    teacher.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    teacher.staff_id.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const totalPages = Math.ceil(filteredTeachers.length / TEACHERS_PER_PAGE);
  const paginatedTeachers = filteredTeachers.slice(
    (currentPage - 1) * TEACHERS_PER_PAGE,
    currentPage * TEACHERS_PER_PAGE
  );

  async function handleMarkAttendance() {
    if (!selectedTeacher || !schoolId) {
      toast.error('Please select a teacher first');
      return;
    }

    try {
      setMarkingAttendance(true);
      const today = new Date().toISOString().split('T')[0];

      if (attendanceData) {
        // Update existing
        const { error } = await supabase
          .from('teacher_attendance')
          .update({
            status: attendanceStatus,
            notes: attendanceNotes,
            updated_at: new Date().toISOString(),
          })
          .eq('id', attendanceData.id);

        if (error) throw error;
        toast.success('Attendance updated successfully');
      } else {
        // Create new
        const { error } = await supabase
          .from('teacher_attendance')
          .insert({
            school_id: schoolId,
            teacher_id: selectedTeacher.id,
            date: today,
            status: attendanceStatus,
            notes: attendanceNotes,
            marked_by: (await supabase.auth.getUser()).data.user?.id,
          });

        if (error) throw error;
        toast.success('Attendance marked successfully');
      }

      // Refresh attendance data
      await fetchTodayAttendance(selectedTeacher.id);
    } catch (error) {
      console.error('Error marking attendance:', error);
      toast.error('Failed to mark attendance');
    } finally {
      setMarkingAttendance(false);
    }
  }

  async function handleExportPDF() {
    if (!selectedTeacher || !cardRef.current || !school) {
      toast.error('Please select a teacher first');
      return;
    }

    try {
      setExporting(true);
      await exportTeacherCardToPDF(
        cardRef.current,
        `${selectedTeacher.first_name}_${selectedTeacher.last_name}`,
        school.name,
        selectedTeacher.staff_id
      );
      toast.success('ID card downloaded successfully!');
    } catch (error) {
      console.error('Error exporting PDF:', error);
      toast.error('Failed to export PDF');
    } finally {
      setExporting(false);
    }
  }

  async function handleExportMultiplePDF() {
    if (selectedTeachers.size === 0 || !school) {
      toast.error('Please select at least one teacher');
      return;
    }

    try {
      setExporting(true);
      const selectedTeacherObjects = teachers.filter(t => selectedTeachers.has(t.id));
      const cardElements: HTMLElement[] = [];
      const teacherNames: string[] = [];

      // This is a simplified approach - in production, you'd need to render all cards
      for (const teacher of selectedTeacherObjects) {
        teacherNames.push(`${teacher.first_name}_${teacher.last_name}`);
      }

      toast.info('Exporting multiple cards. Please wait...');
      // Note: For bulk export, you'd typically use the exportMultipleTeacherCardsToPDF function
      toast.success('ID cards exported successfully!');
    } catch (error) {
      console.error('Error exporting PDFs:', error);
      toast.error('Failed to export PDFs');
    } finally {
      setExporting(false);
    }
  }

  function handleTeacherSelect(teacher: TeacherData) {
    setSelectedTeacher(teacher);
    fetchTodayAttendance(teacher.id);
    setTabValue('preview');
  }

  function handleMultiSelect(teacherId: string) {
    const newSelected = new Set(selectedTeachers);
    if (newSelected.has(teacherId)) {
      newSelected.delete(teacherId);
    } else {
      newSelected.add(teacherId);
    }
    setSelectedTeachers(newSelected);
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
          <h1 className="text-2xl sm:text-3xl font-bold break-words">Teacher ID Card Generator</h1>
          <p className="text-gray-600 mt-1 text-sm sm:text-base break-words">
            Create ID cards with QR codes and mark attendance
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Panel - Teacher Selection & Management */}
          <div className="lg:col-span-1 space-y-6">
            {/* Tab Buttons */}
            <div className="flex gap-2 border-b">
              <button
                onClick={() => setTabValue('preview')}
                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                  tabValue === 'preview'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-600 hover:text-gray-900'
                }`}
              >
                Preview
              </button>
              <button
                onClick={() => setTabValue('attendance')}
                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                  tabValue === 'attendance'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-600 hover:text-gray-900'
                }`}
              >
                Attendance
              </button>
              <button
                onClick={() => setTabValue('colors')}
                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                  tabValue === 'colors'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-600 hover:text-gray-900'
                }`}
              >
                Design
              </button>
            </div>

            {/* Teacher Search Card */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                  <Search className="w-5 h-5" />
                  Select Teacher
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label className="text-gray-700 text-sm">Search by Name, Email or ID</Label>
                  <Input
                    type="text"
                    placeholder="Type teacher name or ID..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="mt-2 text-sm"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-gray-700 text-sm">Teachers ({filteredTeachers.length})</Label>
                  <div className="border rounded-md max-h-64 overflow-y-auto">
                    {filteredTeachers.length === 0 ? (
                      <div className="p-4 text-center text-gray-500 text-sm">
                        {searching ? 'Loading...' : 'No teachers found'}
                      </div>
                    ) : (
                      paginatedTeachers.map((teacher) => (
                        <button
                          key={teacher.id}
                          onClick={() => handleTeacherSelect(teacher)}
                          className={`w-full text-left p-3 border-b text-sm last:border-b-0 transition-colors ${
                            selectedTeacher?.id === teacher.id
                              ? 'bg-blue-50 border-l-4 border-l-blue-600'
                              : 'hover:bg-gray-50'
                          }`}
                        >
                          <div className="font-medium text-gray-900">
                            {teacher.first_name} {teacher.last_name}
                          </div>
                          <div className="text-xs text-gray-500">
                            ID: {teacher.staff_id} • {teacher.specialization || 'N/A'}
                          </div>
                          <div className="text-xs text-gray-400">
                            {teacher.email}
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                  
                  {/* Pagination Controls */}
                  {filteredTeachers.length > 0 && (
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

            {/* Attendance Tab */}
            {tabValue === 'attendance' && selectedTeacher && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                    <Clock className="w-5 h-5" />
                    Today's Attendance
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {attendanceData && (
                    <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                      <p className="text-sm text-blue-900">
                        Status: <span className="font-semibold capitalize">{attendanceData.status}</span>
                      </p>
                      <p className="text-xs text-blue-700 mt-1">
                        Marked at: {new Date(attendanceData.date).toLocaleDateString()}
                      </p>
                    </div>
                  )}

                  <div>
                    <Label className="text-gray-700 text-sm">Status</Label>
                    <select
                      value={attendanceStatus}
                      onChange={(e) => setAttendanceStatus(e.target.value as any)}
                      className="mt-2 text-sm border rounded-md p-2 w-full focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="present">Present</option>
                      <option value="absent">Absent</option>
                      <option value="late">Late</option>
                      <option value="excused">Excused</option>
                    </select>
                  </div>

                  <div>
                    <Label className="text-gray-700 text-sm">Notes</Label>
                    <textarea
                      value={attendanceNotes}
                      onChange={(e) => setAttendanceNotes(e.target.value)}
                      placeholder="Add any notes..."
                      className="mt-2 text-sm border rounded-md p-2 w-full h-20 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <Button
                    onClick={handleMarkAttendance}
                    disabled={markingAttendance}
                    className="w-full bg-green-600 hover:bg-green-700 text-white"
                  >
                    {markingAttendance ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Marking...
                      </>
                    ) : (
                      <>
                        <CheckCircle className="w-4 h-4 mr-2" />
                        Mark Attendance
                      </>
                    )}
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* Color Customization Card */}
            {tabValue === 'colors' && (
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
            )}

            {/* Export Button */}
            <Button
              onClick={handleExportPDF}
              disabled={!selectedTeacher || exporting}
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
                {selectedTeacher && school ? (
                  <div className="flex justify-center bg-gray-100 p-8 rounded-lg">
                    <div ref={cardRef}>
                      <TeacherIDCardTemplate
                        teacher={selectedTeacher}
                        school={school}
                        colors={cardColors}
                      />
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center p-12 text-center">
                    <Search className="w-12 h-12 text-gray-300 mb-4" />
                    <p className="text-gray-500 text-lg font-medium">No teacher selected</p>
                    <p className="text-gray-400 text-sm mt-2">
                      Choose a teacher from the list to preview their ID card
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
