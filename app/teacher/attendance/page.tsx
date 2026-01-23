"use client";

import { DashboardLayout } from '@/components/dashboard-layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Class, Student, Attendance } from '@/lib/types';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Calendar } from 'lucide-react';
import { toast } from 'sonner';

interface StudentAttendance extends Student {
  attendanceStatus: 'present' | 'absent' | 'late' | 'excused' | 'not_marked';
  attendanceId?: string;
}

export default function AttendancePage() {
  const [classes, setClasses] = useState<Class[]>([]);
  const [selectedClass, setSelectedClass] = useState<Class | null>(null);
  const [students, setStudents] = useState<StudentAttendance[]>([]);
  const [selectedDate, setSelectedDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    fetchClasses();
  }, []);

  async function fetchClasses() {
    const { data } = await supabase.from('classes').select('*').order('name');
    if (data) setClasses(data);
  }

  async function openAttendanceModal(cls: Class) {
    setSelectedClass(cls);
    setIsModalOpen(true);
    await loadStudentsAndAttendance(cls.id, selectedDate);
  }

  async function loadStudentsAndAttendance(classId: string, date: string) {
    setIsLoading(true);
    const loadingToast = toast.loading('Loading attendance data...');

    try {
      const { data: studentsData, error: studentsError } = await supabase
        .from('students')
        .select('*')
        .eq('class_id', classId)
        .eq('status', 'active')
        .order('first_name');

      if (studentsError) throw studentsError;

      const { data: attendanceData, error: attendanceError } = await supabase
        .from('attendance')
        .select('*')
        .eq('class_id', classId)
        .eq('date', date);

      if (attendanceError) throw attendanceError;

      const studentsWithAttendance: StudentAttendance[] = (studentsData || []).map((student) => {
        const attendance = attendanceData?.find((a) => a.student_id === student.id);
        return {
          ...student,
          attendanceStatus: attendance ? (attendance.status as any) : 'not_marked',
          attendanceId: attendance?.id,
        };
      });

      setStudents(studentsWithAttendance);
      toast.success('Attendance data loaded', { id: loadingToast });
    } catch (error) {
      toast.error('Failed to load attendance data', { id: loadingToast });
    } finally {
      setIsLoading(false);
    }
  }

  function handleDateChange(date: string) {
    setSelectedDate(date);
    if (selectedClass) {
      loadStudentsAndAttendance(selectedClass.id, date);
    }
  }

  function setToday() {
    const today = new Date().toISOString().split('T')[0];
    setSelectedDate(today);
    if (selectedClass) {
      loadStudentsAndAttendance(selectedClass.id, today);
    }
  }

  function markAllPresent() {
    setStudents((prev) =>
      prev.map((student) => ({
        ...student,
        attendanceStatus: 'present',
      }))
    );
    toast.success('All students marked as present');
  }

  function updateStudentStatus(studentId: string, status: StudentAttendance['attendanceStatus']) {
    setStudents((prev) =>
      prev.map((student) =>
        student.id === studentId ? { ...student, attendanceStatus: status } : student
      )
    );
  }

  async function submitAttendance() {
    if (!selectedClass) return;

    setIsLoading(true);
    const savingToast = toast.loading('Saving attendance...');

    try {
      // Get active session and term
      const { data: sessionData } = await supabase
        .from('sessions')
        .select('*')
        .eq('is_current', true)
        .single();
      const { data: termData } = await supabase
        .from('terms')
        .select('*')
        .eq('is_current', true)
        .single();

      const attendanceRecords = students
        .filter((s) => s.attendanceStatus !== 'not_marked')
        .map((student) => ({
          student_id: student.id,
          class_id: selectedClass.id,
          date: selectedDate,
          status: student.attendanceStatus,
          marked_by: null,
          session_id: sessionData?.id || null,
          term_id: termData?.id || null,
        }));

      const existingRecords = students.filter((s) => s.attendanceId);

      if (existingRecords.length > 0) {
        const deleteIds = existingRecords.map((s) => s.attendanceId).filter(Boolean);
        if (deleteIds.length > 0) {
          await supabase.from('attendance').delete().in('id', deleteIds);
        }
      }

      if (attendanceRecords.length > 0) {
        const { error } = await supabase.from('attendance').insert(attendanceRecords);

        if (error) throw error;
      }

      toast.success('Attendance saved successfully!', { id: savingToast });
      await loadStudentsAndAttendance(selectedClass.id, selectedDate);
    } catch (error) {
      toast.error('Failed to save attendance', { id: savingToast });
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  }

  function getFormattedDate(dateString: string) {
    const date = new Date(dateString + 'T00:00:00');
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  }

  const statusColors = {
    present: 'bg-green-100 text-green-800',
    absent: 'bg-red-100 text-red-800',
    late: 'bg-yellow-100 text-yellow-800',
    excused: 'bg-blue-100 text-blue-800',
    not_marked: 'bg-gray-100 text-gray-800',
  };

  return (
    <DashboardLayout role="teacher">
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold">Attendance</h1>
          <p className="text-gray-600 mt-1">Mark and view attendance records</p>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {classes.map((cls) => (
            <Card key={cls.id} className="hover:shadow-lg transition-shadow cursor-pointer">
              <CardContent className="p-6">
                <h3 className="text-xl font-bold mb-2">{cls.name}</h3>
                <p className="text-gray-600 mb-4">{cls.level}</p>
                <Button onClick={() => openAttendanceModal(cls)} className="w-full">
                  <Calendar className="mr-2 h-4 w-4" />
                  Mark Attendance
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>

        {classes.length === 0 && (
          <Card>
            <CardContent className="p-12 text-center">
              <p className="text-gray-500">No classes available</p>
            </CardContent>
          </Card>
        )}

        <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
            <DialogHeader>
              <DialogTitle>
                Mark Attendance - {selectedClass?.name}
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-4 overflow-y-auto flex-1">
              <div className="flex items-center justify-between gap-4 pb-4 border-b sticky top-0 bg-white z-10">
                <div className="flex-1">
                  <label className="block text-sm font-medium mb-2">Select Date</label>
                  <div className="flex gap-2">
                    <input
                      type="date"
                      value={selectedDate}
                      onChange={(e) => handleDateChange(e.target.value)}
                      className="flex-1 px-3 py-2 border rounded-md"
                    />
                    <Button variant="outline" onClick={setToday}>
                      Today
                    </Button>
                  </div>
                  <p className="text-sm text-gray-600 mt-1">{getFormattedDate(selectedDate)}</p>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Quick Actions</label>
                  <Button onClick={markAllPresent} variant="outline" disabled={isLoading}>
                    Mark All Present
                  </Button>
                </div>
              </div>

              {isLoading ? (
                <div className="text-center py-8">
                  <p className="text-gray-500">Loading students...</p>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="grid grid-cols-12 gap-4 px-4 py-2 bg-gray-50 rounded-lg font-medium text-sm">
                    <div className="col-span-1">#</div>
                    <div className="col-span-4">Student Name</div>
                    <div className="col-span-2">Gender</div>
                    <div className="col-span-2">Status</div>
                    <div className="col-span-3">Action</div>
                  </div>

                  {students.map((student, index) => (
                    <div
                      key={student.id}
                      className="grid grid-cols-12 gap-4 px-4 py-3 border rounded-lg items-center hover:bg-gray-50"
                    >
                      <div className="col-span-1 text-gray-600">{index + 1}</div>
                      <div className="col-span-4">
                        <p className="font-medium">
                          {student.first_name} {student.last_name}
                        </p>
                        <p className="text-xs text-gray-500">{student.student_id}</p>
                      </div>
                      <div className="col-span-2 text-sm text-gray-600 capitalize">
                        {student.gender || 'N/A'}
                      </div>
                      <div className="col-span-2">
                        <span
                          className={`inline-block px-2 py-1 rounded text-xs font-medium ${
                            statusColors[student.attendanceStatus]
                          }`}
                        >
                          {student.attendanceStatus.replace('_', ' ').toUpperCase()}
                        </span>
                      </div>
                      <div className="col-span-3">
                        <select
                          value={student.attendanceStatus}
                          onChange={(e) =>
                            updateStudentStatus(
                              student.id,
                              e.target.value as StudentAttendance['attendanceStatus']
                            )
                          }
                          className="w-full px-2 py-1.5 border rounded text-sm"
                        >
                          <option value="not_marked">Not Marked</option>
                          <option value="present">Present</option>
                          <option value="absent">Absent</option>
                          <option value="late">Late</option>
                          <option value="excused">Excused</option>
                        </select>
                      </div>
                    </div>
                  ))}

                  {students.length === 0 && (
                    <div className="text-center py-8 text-gray-500">
                      No students found in this class
                    </div>
                  )}
                </div>
              )}

              <div className="flex gap-2 pt-4 border-t sticky bottom-0 bg-white">
                <Button
                  onClick={submitAttendance}
                  disabled={isLoading || students.length === 0}
                  className="flex-1"
                >
                  Save Attendance
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setIsModalOpen(false)}
                  disabled={isLoading}
                >
                  Cancel
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
