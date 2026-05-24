"use client";

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { DashboardLayout } from '@/components/dashboard-layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/lib/supabase';
import { useSchoolContext } from '@/hooks/use-school-context';
import { Student, Session, Term, Class } from '@/lib/types';
import { ResultsTable } from '@/components/results-table';
import { AttendanceTimeline } from '@/components/attendance-timeline';
import { filterAttendanceByPeriod } from '@/lib/student-utils';
import { EditStudentModal } from '@/components/edit-student-modal';
import { toast } from 'sonner';
import { ArrowLeft, Calendar, Mail, Phone, User, Hash, Trash2, Upload, Users } from 'lucide-react';

export default function AdminStudentPage() {
	const params = useParams();
	const router = useRouter();
	const studentId = params.studentId as string;
	const { schoolId, isLoading: schoolLoading, error: schoolError } = useSchoolContext();

	const [student, setStudent] = useState<Student | null>(null);
	const [sessions, setSessions] = useState<Session[]>([]);
	const [terms, setTerms] = useState<Term[]>([]);
	const [classes, setClasses] = useState<Class[]>([]);
	const [attendance, setAttendance] = useState<any[]>([]);
	const [studentResults, setStudentResults] = useState<any[]>([]);
	const [attendancePeriod, setAttendancePeriod] = useState<'daily'|'weekly'|'monthly'|'term'|'session'>('monthly');

	const [loading, setLoading] = useState(true);
	const [isEditOpen, setIsEditOpen] = useState(false);
	const [isTransferOpen, setIsTransferOpen] = useState(false);
	const [transferTargetClassId, setTransferTargetClassId] = useState('');
	const [isDeleting, setIsDeleting] = useState(false);

	useEffect(() => {
		if (schoolId && studentId) loadData();
	}, [schoolId, studentId]);

	async function loadData() {
		setLoading(true);
		try {
			if (!schoolId) throw new Error('School ID missing');

			const [{ data: studentData, error: studentError }, { data: sessionsData }, { data: termsData }, { data: classesData }] = await Promise.all([
				supabase.from('students').select(`*, classes(id,name), school_departments(id,name)`).eq('school_id', schoolId).eq('id', studentId).maybeSingle(),
				supabase.from('sessions').select('*').eq('school_id', schoolId).order('name', { ascending: false }),
				supabase.from('terms').select('*').eq('school_id', schoolId).order('start_date', { ascending: false }),
				supabase.from('classes').select('*').eq('school_id', schoolId).order('name', { ascending: true }),
			]);

			if (studentError) throw studentError;
			setStudent(studentData || null);
			setSessions(sessionsData || []);
			setTerms(termsData || []);
			setClasses(classesData || []);

			// attendance
			if (studentData?.id) {
				const { data: attendanceData } = await supabase.from('attendance').select('*').eq('student_id', studentData.id).eq('school_id', schoolId);
				setAttendance(attendanceData || []);
			}

		} catch (e: any) {
			console.error(e);
			toast.error('Failed to load student: ' + (e.message || 'Unknown'));
			router.push('/admin/students');
		} finally {
			setLoading(false);
		}
	}

	async function handleDelete() {
		if (!student) return;
		if (!confirm(`Permanently delete ${student.first_name} ${student.last_name}?`)) return;
		setIsDeleting(true);
		try {
			const res = await fetch('/api/admin', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'delete-student', studentId: student.id, userId: student.user_id }) });
			const body = await res.json();
			if (!res.ok) { throw new Error(body.error || 'Failed to delete'); }
			toast.success('Student deleted');
			router.push('/admin/students');
		} catch (e: any) {
			toast.error('Delete failed: ' + (e.message || 'Unknown'));
		} finally { setIsDeleting(false); }
	}

	function handleManageSubjects() { if (student) router.push(`/admin/students/${student.id}/subjects`); }

	function handleViewReport() {
		if (!student) return;
		// open report page for current session/term if available
		const currentSession = sessions.find(s => s.is_current);
		const currentTerm = terms.find(t => t.is_current);
		const params = new URLSearchParams();
		if (currentSession) params.set('session', currentSession.id);
		if (currentTerm) params.set('term', currentTerm.id);
		router.push(`/admin/students/${student.id}/report?${params.toString()}`);
	}

	async function handleTransfer() {
		if (!student || !transferTargetClassId) { toast.error('Select a target class'); return; }
		try {
			const res = await fetch('/api/admin', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'transfer-students', studentIds: [student.id], targetClassId: transferTargetClassId }) });
			const data = await res.json();
			if (!res.ok) { toast.error(data.error || 'Transfer failed'); return; }
			toast.success(data.message || 'Student transferred');
			// refresh
			loadData();
			setIsTransferOpen(false);
		} catch (e: any) { toast.error('Transfer failed: ' + e.message); }
	}

	if (schoolLoading || loading) return (
		<DashboardLayout role="admin"><div className="flex items-center justify-center h-96">Loading...</div></DashboardLayout>
	);

	if (schoolError || !schoolId) return (
		<DashboardLayout role="admin"><div className="flex items-center justify-center h-96">{schoolError || 'School not available'}</div></DashboardLayout>
	);

	if (!student) return (
		<DashboardLayout role="admin"><div className="flex items-center justify-center h-96">Student not found</div></DashboardLayout>
	);

	const getInitials = (f: string, l: string) => `${(f || '?')[0]}${(l || '?')[0]}`.toUpperCase();
	const currentSession = sessions.find(s => s.is_current);
	const currentTerm = terms.find(t => t.is_current);
	const filteredAttendance = filterAttendanceByPeriod(attendance, attendancePeriod);

	return (
		<DashboardLayout role="admin">
			<div className="max-w-5xl mx-auto p-6 space-y-6">
				<div className="flex items-center justify-between">
					<div>
						<h1 className="text-2xl font-bold">{student.first_name} {student.last_name}</h1>
						<p className="text-sm text-slate-500">Student profile and academic records</p>
					</div>
					<div className="flex items-center gap-2">
						<Button variant="ghost" onClick={() => router.back()}><ArrowLeft className="h-4 w-4" /> Back</Button>
						<Button onClick={() => setIsEditOpen(true)}><Users className="h-4 w-4 mr-2" /> Edit</Button>
						<Button variant="outline" onClick={() => setIsTransferOpen(true)}>Transfer</Button>
						<Button variant="destructive" onClick={handleDelete} disabled={isDeleting}><Trash2 className="h-4 w-4 mr-2" />{isDeleting ? 'Deleting…' : 'Delete'}</Button>
						<Button onClick={() => { navigator.clipboard?.writeText(window.location.href); toast.success('Link copied'); }}>Share</Button>
					</div>
				</div>

				<Card>
					<CardContent className="p-4 md:p-6">
						<div className="flex flex-col md:flex-row gap-4">
							<Avatar className="h-24 w-24">
								<AvatarImage src={student.photo_url} />
								<AvatarFallback className="bg-blue-100 text-blue-700 text-2xl">{getInitials(student.first_name, student.last_name)}</AvatarFallback>
							</Avatar>
							<div className="flex-1">
								<div className="flex items-center gap-3">
									<h2 className="text-xl font-bold">{student.first_name} {student.last_name}</h2>
									<Badge>{student.status}</Badge>
								</div>
								<div className="grid grid-cols-1 md:grid-cols-3 gap-2 mt-3 text-sm">
									<div className="flex items-center gap-2"><Mail className="h-4 w-4 text-gray-500" />{student.email}</div>
									<div className="flex items-center gap-2"><Phone className="h-4 w-4 text-gray-500" />{student.phone}</div>
									<div className="flex items-center gap-2"><User className="h-4 w-4 text-gray-500" />{student.gender}</div>
									<div className="flex items-center gap-2"><Calendar className="h-4 w-4 text-gray-500" />Admitted: {new Date(student.admission_date).toLocaleDateString()}</div>
									<div className="flex items-center gap-2"><Hash className="h-4 w-4 text-gray-500" />{student.student_id}</div>
								</div>
							</div>
						</div>
					</CardContent>
				</Card>

				<Card>
					<CardHeader>
						<CardTitle>Parent / Guardian</CardTitle>
					</CardHeader>
					<CardContent>
						<div className="grid grid-cols-1 md:grid-cols-3 gap-4">
							<div>
								<Label>Name</Label>
								<div className="font-medium">{student.parent_name}</div>
							</div>
							<div>
								<Label>Email</Label>
								<div className="font-medium break-all">{student.parent_email}</div>
							</div>
							<div>
								<Label>Phone</Label>
								<div className="font-medium">{student.parent_phone}</div>
							</div>
						</div>
					</CardContent>
				</Card>

				<Tabs defaultValue="attendance" className="w-full">
					<TabsList className="grid w-full grid-cols-2">
						<TabsTrigger value="attendance" className="text-sm">Attendance</TabsTrigger>
						<TabsTrigger value="results" className="text-sm">Academic Results</TabsTrigger>
					</TabsList>

					<TabsContent value="attendance" className="space-y-4">
						<Card>
							<CardHeader className="flex items-center justify-between">
								<CardTitle>Attendance</CardTitle>
								<div className="flex items-center gap-2">
									<Label>Period</Label>
									<select value={attendancePeriod} onChange={(e) => setAttendancePeriod(e.target.value as any)} className="px-2 py-1 border rounded">
										<option value="daily">Daily</option>
										<option value="weekly">Weekly</option>
										<option value="monthly">Monthly</option>
										<option value="term">Term</option>
										<option value="session">Session</option>
									</select>
								</div>
							</CardHeader>
							<CardContent>
								<div className="mb-4">
									<div className="text-2xl font-bold">{student.average_attendance}%</div>
									<div className="text-sm text-slate-500">Average attendance</div>
								</div>
								<AttendanceTimeline attendance={filteredAttendance} />
							</CardContent>
						</Card>
					</TabsContent>

					<TabsContent value="results" className="space-y-4">
						<Card>
							<CardHeader>
								<CardTitle>Results</CardTitle>
							</CardHeader>
							<CardContent>
								<ResultsTable results={studentResults} />
								<div className="flex gap-2 mt-4">
									<Button onClick={handleManageSubjects}>Manage Subjects</Button>
									<Button variant="outline" onClick={handleViewReport}>View Report</Button>
								</div>
							</CardContent>
						</Card>
					</TabsContent>
				</Tabs>

				<EditStudentModal student={student} isOpen={isEditOpen} onClose={() => setIsEditOpen(false)} onSuccess={(updated: Student) => { setStudent(updated); toast.success('Student updated'); }} />

				{/* Transfer dialog (simple inline) */}
				{isTransferOpen && (
					<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
						<div className="bg-white rounded-lg p-6 w-full max-w-md">
							<h3 className="text-lg font-bold">Transfer Student</h3>
							<p className="text-sm text-slate-500 mt-1">Move {student.first_name} {student.last_name} to another class</p>
							<select value={transferTargetClassId} onChange={(e) => setTransferTargetClassId(e.target.value)} className="w-full mt-4 px-3 py-2 border rounded">
								<option value="">Select class</option>
								{classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
							</select>
							<div className="flex justify-end gap-2 mt-4">
								<Button variant="outline" onClick={() => { setIsTransferOpen(false); setTransferTargetClassId(''); }}>Cancel</Button>
								<Button onClick={handleTransfer}>Transfer</Button>
							</div>
						</div>
					</div>
				)}

			</div>
		</DashboardLayout>
	);
}

