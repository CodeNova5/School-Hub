"use client";

import { Student, Session, Term } from '@/lib/types';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { supabase } from '@/lib/supabase';
import { useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Label } from '@/components/ui/label';
import { ResultsTable } from './results-table';
import { AttendanceTimeline } from './attendance-timeline';
import { filterStudentResultsBySessionAndTerm, filterAttendanceByPeriod } from '@/lib/student-utils';
import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Mail, Phone, MapPin, Calendar, User, Hash, ArrowLeft, ArrowRight } from 'lucide-react';

interface StudentDetailsModalProps {
  student: Student | null;
  sessions: Session[];
  terms: Term[];
  isOpen: boolean;
  onClose: () => void;
}

export function StudentDetailsModal({
  student,
  sessions,
  terms,
  isOpen,
  onClose,
}: StudentDetailsModalProps) {
  const [selectedSessionId, setSelectedSessionId] = useState<string>('');
  const [selectedTermId, setSelectedTermId] = useState<string>('');
  const [attendancePeriod, setAttendancePeriod] = useState<
    'daily' | 'weekly' | 'monthly' | 'term' | 'session'
  >('monthly');
  // ⬇️ NEW: Fetch real attendance for this student
  const [realAttendance, setRealAttendance] = useState<any[]>([]);
  const [studentResults, setStudentResults] = useState<any[]>([]);
 

  useEffect(() => {
    async function loadAttendance() {
      const { data } = await supabase
        .from("attendance")
        .select("*")
        .eq("student_id", student?.id);

      setRealAttendance(data || []);
    }

    loadAttendance();
  }, [student?.id]);




  const currentSession = sessions.find(s => s.is_current);
  const currentTerm = terms.find(t => t.is_current);

  const activeSessionId = selectedSessionId || currentSession?.id || '';
  const activeTermId = selectedTermId || currentTerm?.id || '';
 
  const filteredResults = studentResults;


  const filteredAttendance = filterAttendanceByPeriod(
    realAttendance,
    attendancePeriod
  );

  const availableTerms = terms.filter(t => t.session_id === activeSessionId);

  const getInitials = (firstName: string, lastName: string) => {
    return `${firstName[0]}${lastName[0]}`.toUpperCase();
  };

  useEffect(() => {
    async function loadResults() {
      if (!student?.id || !activeSessionId || !activeTermId) {
        setStudentResults([]);
        return;
      }

      const { data, error } = await supabase
        .from("results")
        .select(`
          *,
          subject_classes (
            id,
            subjects (
              id,
              name,
              is_optional
            )
          )
        `)
        .eq("student_id", student.id)
        .eq("session_id", activeSessionId)
        .eq("term_id", activeTermId);

      // Get optional subjects for this student
      const { data: optionalSubjectRows } = await supabase
        .from("student_optional_subjects")
        .select("subject_id")
        .eq("student_id", student.id);
      const optionalSubjectIds = (optionalSubjectRows || []).map(row => row.subject_id);

      if (error) {
        console.error("Error fetching results:", error);
        setStudentResults([]);
        return;
      }

      // Transform and filter the data
      const transformedData = (data || []).filter((result: any) => {
        const subject = result.subject_classes?.subjects;
        if (!subject) return false;
        if (subject.is_optional) {
          return optionalSubjectIds.includes(subject.id);
        }
        return true;
      }).map((result: any) => ({
        ...result,
        subject_name: result.subject_classes?.subjects?.name || "Unknown"
      }));

      setStudentResults(transformedData);
    }

    loadResults();
  }, [student?.id, activeSessionId, activeTermId]);

  if (!student) return null;


  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto w-[95vw] max-w-[95vw] md:max-w-5xl p-4 md:p-6">
        <DialogHeader>
          <DialogTitle className="text-xl md:text-2xl">Student Details</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 md:space-y-6">
          <Card>
            <CardContent className="p-3 md:p-6">
              <div className="flex flex-col md:flex-row md:items-start gap-4 md:gap-6">
                <Avatar className="h-20 w-20 md:h-24 md:w-24 flex-shrink-0">
                  <AvatarImage src={student.photo_url} />
                  <AvatarFallback className="bg-blue-100 text-blue-700 text-xl md:text-2xl">
                    {getInitials(student.first_name, student.last_name)}
                  </AvatarFallback>
                </Avatar>

                <div className="flex-1 space-y-4">
                  <div>
                    <h2 className="text-xl md:text-2xl font-bold">
                      {student.first_name} {student.last_name}
                    </h2>
                    <div className="flex flex-wrap items-center gap-2 mt-1">
                      <Badge variant="outline" className="text-xs md:text-sm">
                        <Hash className="h-3 w-3 mr-1" />
                        {student.student_id}
                      </Badge>
                      <Badge className="text-xs md:text-sm">{student.status}</Badge>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 md:gap-4 text-xs md:text-sm">
                    <div className="flex items-center gap-2">
                      <Mail className="h-4 w-4 text-gray-500" />
                      <span>{student.email}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Phone className="h-4 w-4 text-gray-500" />
                      <span>{student.phone}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 text-gray-500" />
                      <span className="capitalize">{student.gender}</span>
                    </div>
                    {/* New: Department */}
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 text-gray-500" />
                      <span className="capitalize">Department: {student.department}</span>
                    </div>

                    {/* New: Date of Birth */}
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-gray-500" />
                      <span>
                        DOB: {student.date_of_birth ? new Date(student.date_of_birth).toLocaleDateString() : 'N/A'}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 text-gray-500" />
                      <span>
                        Age:{' '}
                        {student.date_of_birth
                          ? Math.floor(
                            (new Date().getTime() - new Date(student.date_of_birth).getTime()) /
                            (1000 * 60 * 60 * 24 * 365.25)
                          )
                          : 'N/A'}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-gray-500" />
                      <span>Admitted: {new Date(student.admission_date).toLocaleDateString()}</span>
                    </div>
                  </div>

                  {student.address && (
                    <div className="flex items-start gap-2 text-xs md:text-sm">
                      <MapPin className="h-4 w-4 text-gray-500 mt-0.5 flex-shrink-0" />
                      <span>{student.address}</span>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg md:text-xl">Parent/Guardian Information</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label className="text-xs md:text-sm text-gray-600">Name</Label>
                  <p className="font-medium text-sm md:text-base">{student.parent_name}</p>
                </div>
                <div>
                  <Label className="text-xs md:text-sm text-gray-600">Email</Label>
                  <p className="font-medium text-sm md:text-base break-all">{student.parent_email}</p>
                </div>
                <div>
                  <Label className="text-xs md:text-sm text-gray-600">Phone</Label>
                  <p className="font-medium text-sm md:text-base">{student.parent_phone}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Tabs defaultValue="attendance" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="attendance" className="text-xs md:text-sm">Attendance</TabsTrigger>
              <TabsTrigger value="results" className="text-xs md:text-sm">Academic Results</TabsTrigger>
            </TabsList>

            <TabsContent value="attendance" className="space-y-4">
              <Card>
                <CardHeader>
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                    <CardTitle className="text-lg md:text-xl">Attendance History</CardTitle>
                    <div className="flex flex-col md:flex-row md:items-center gap-2">
                      <Label className="text-xs md:text-sm">Filter by:</Label>
                      <select
                        value={attendancePeriod}
                        onChange={(e) => setAttendancePeriod(e.target.value as any)}
                        className="px-2 md:px-3 py-1.5 border rounded-md text-xs md:text-sm"
                      >
                        <option value="daily">Daily</option>
                        <option value="weekly">Weekly</option>
                        <option value="monthly">Monthly</option>
                        <option value="term">Term</option>
                        <option value="session">Session</option>
                      </select>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="mb-4 p-3 md:p-4 bg-blue-50 rounded-lg">
                    <p className="text-xs md:text-sm text-gray-600">Average Attendance</p>
                    <p className="text-2xl md:text-3xl font-bold text-blue-600">
                      {student.average_attendance}%
                    </p>
                  </div>
                  <AttendanceTimeline attendance={filteredAttendance} />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="results" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg md:text-xl">Academic Performance</CardTitle>
                  <div className="flex flex-col md:flex-row gap-3 md:gap-4 mt-4">
                    <div className="flex-1">
                      <Label className="text-xs md:text-sm">Session</Label>
                      <select
                        value={activeSessionId}
                        onChange={(e) => {
                          setSelectedSessionId(e.target.value);
                          setSelectedTermId('');
                        }}
                        className="w-full px-2 md:px-3 py-2 border rounded-md mt-1 text-xs md:text-sm"
                      >
                        <option value="">Select Session</option>
                        {sessions.map((session) => (
                          <option key={session.id} value={session.id}>
                            {session.name} {session.is_current && '(Current)'}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="flex-1">
                      <Label className="text-xs md:text-sm">Term</Label>
                      <select
                        value={activeTermId}
                        onChange={(e) => setSelectedTermId(e.target.value)}
                        className="w-full px-2 md:px-3 py-2 border rounded-md mt-1 text-xs md:text-sm"
                        disabled={!activeSessionId}
                      >
                        <option value="">Select Term</option>
                        {availableTerms.map((term) => (
                          <option key={term.id} value={term.id}>
                            {term.name} {term.is_current && '(Current)'}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <ResultsTable results={studentResults} />
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  );
}
