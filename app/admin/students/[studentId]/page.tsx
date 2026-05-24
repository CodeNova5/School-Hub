"use client";

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { DashboardLayout } from '@/components/dashboard-layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/lib/supabase';
import { useSchoolContext } from '@/hooks/use-school-context';
import { Student, Session, Term, Class } from '@/lib/types';
import { ResultsTable } from '@/components/results-table';
import { AttendanceTimeline } from '@/components/attendance-timeline';
import { filterAttendanceByPeriod } from '@/lib/student-utils';
import { EditStudentModal } from '@/components/edit-student-modal';
import Link from 'next/link';
import { toast } from 'sonner';
import { ArrowLeft, Calendar, Mail, Phone, User, Hash, Trash2, Users, ShieldAlert, RefreshCcw, KeyRound } from 'lucide-react';
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog';

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
	const [guardians, setGuardians] = useState<any[]>([]);
	const [attendancePeriod, setAttendancePeriod] = useState<'daily'|'weekly'|'monthly'|'term'|'session'>('monthly');

	const [loading, setLoading] = useState(true);
	const [isEditOpen, setIsEditOpen] = useState(false);
	const [isTransferOpen, setIsTransferOpen] = useState(false);
	const [transferTargetClassId, setTransferTargetClassId] = useState('');
	const [isDeleting, setIsDeleting] = useState(false);
	const [isResettingPassword, setIsResettingPassword] = useState(false);
	const [isEmailChangeOpen, setIsEmailChangeOpen] = useState(false);
	const [emailStep, setEmailStep] = useState<'email' | 'code'>('email');
	const [newEmail, setNewEmail] = useState('');
	const [verificationCode, setVerificationCode] = useState('');
	const [emailChangeError, setEmailChangeError] = useState('');
	const [isSendingCode, setIsSendingCode] = useState(false);
	const [isVerifyingCode, setIsVerifyingCode] = useState(false);
	const [isApplyingEmailChange, setIsApplyingEmailChange] = useState(false);

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

			// guardians (new link table)
			if (studentData?.id) {
				const { data: guardianRows, error: guardianError } = await supabase
					.from('student_guardian_links')
					.select(`id, relationship_type, is_primary_contact, has_legal_custody, can_pickup, parents(id, name, email, phone)`) // parents is the FK target
					.eq('school_id', schoolId)
					.eq('student_id', studentData.id);
				if (guardianError) {
					console.error('Failed to load guardians', guardianError);
				} else {
					const mapped = (guardianRows || []).map((r: any) => ({
						id: r.parents?.id || r.guardian_id || r.id,
						name: r.parents?.name || 'Unknown',
						email: r.parents?.email || '',
						phone: r.parents?.phone || '',
						relationship: r.relationship_type,
						is_primary: r.is_primary_contact,
						can_pickup: r.can_pickup,
					}));
					setGuardians(mapped);
				}
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

	async function handleResetPassword() {
		if (!student?.email) {
			toast.error('Student email is missing');
			return;
		}

		const confirmed = window.confirm(`Send a password reset email to ${student.email}?`);
		if (!confirmed) return;

		try {
			setIsResettingPassword(true);
			const response = await fetch('/api/admin/reset-password', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ studentId: student.id }),
			});

			const data = await response.json();
			if (!response.ok) {
				throw new Error(data.error || 'Failed to send reset email');
			}

			toast.success('Password reset email sent');
		} catch (e: any) {
			toast.error(e.message || 'Failed to send reset email');
		} finally {
			setIsResettingPassword(false);
		}
	}

	function openEmailChangeDialog() {
		setNewEmail('');
		setVerificationCode('');
		setEmailChangeError('');
		setEmailStep('email');
		setIsEmailChangeOpen(true);
	}

	function closeEmailChangeDialog() {
		setIsEmailChangeOpen(false);
		setNewEmail('');
		setVerificationCode('');
		setEmailChangeError('');
		setEmailStep('email');
	}

	async function handleSendEmailCode() {
		if (!newEmail.trim()) {
			setEmailChangeError('Enter a new email address');
			return;
		}

		const normalizedEmail = newEmail.trim().toLowerCase();
		if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
			setEmailChangeError('Enter a valid email address');
			return;
		}

		setEmailChangeError('');
		try {
			setIsSendingCode(true);
			const response = await fetch('/api/admin/student-email-verification/send', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ email: normalizedEmail }),
			});
			const data = await response.json();
			if (!response.ok) {
				throw new Error(data.error || 'Failed to send verification code');
			}

			setNewEmail(normalizedEmail);
			setEmailStep('code');
			toast.success('Verification code sent to the new email address');
		} catch (e: any) {
			setEmailChangeError(e.message || 'Failed to send verification code');
		} finally {
			setIsSendingCode(false);
		}
	}

	async function handleVerifyAndApplyEmailChange() {
		if (!student) return;
		if (!verificationCode.trim() || verificationCode.trim().length !== 6) {
			setEmailChangeError('Enter the 6-digit verification code');
			return;
		}

		setEmailChangeError('');
		try {
			setIsVerifyingCode(true);
			const verifyResponse = await fetch('/api/admin/student-email-verification/verify', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ email: newEmail, code: verificationCode.trim() }),
			});
			const verifyData = await verifyResponse.json();
			if (!verifyResponse.ok) {
				throw new Error(verifyData.error || 'Verification failed');
			}

			setIsApplyingEmailChange(true);
			const updateResponse = await fetch('/api/admin/update-student', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					studentId: student.id,
					updates: { email: newEmail },
				}),
			});

			const updateData = await updateResponse.json();
			if (!updateResponse.ok) {
				throw new Error(updateData.error || 'Failed to update email');
			}

			if (updateData.student) {
				setStudent(updateData.student);
			}
			toast.success(updateData.message || 'Student email updated');
			setIsEmailChangeOpen(false);
		} catch (e: any) {
			setEmailChangeError(e.message || 'Failed to update email');
		} finally {
			setIsVerifyingCode(false);
			setIsApplyingEmailChange(false);
		}
	}

	if (schoolLoading || loading) return (
		<DashboardLayout role="admin"><div className="flex items-center justify-center h-96" role="status" aria-live="polite">Loading...</div></DashboardLayout>
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
			<main className="max-w-5xl mx-auto p-6 space-y-6" id="main-content">
				<div className="flex items-center justify-between">
					<div>
						<h1 className="text-2xl font-bold">{student.first_name} {student.last_name}</h1>
						<p className="text-sm text-slate-500">Student profile and academic records</p>
					</div>
					<div className="flex items-center gap-3">
						<div className="inline-flex items-center gap-2 bg-white/50 p-1 rounded-xl shadow-sm">
							<Button variant="ghost" size="sm" onClick={() => router.back()} aria-label="Back to students list" className="rounded-xl px-3 py-2 text-slate-700 hover:bg-slate-100">
								<ArrowLeft className="h-4 w-4 mr-2" />
								Back
							</Button>

							<Button onClick={() => setIsEditOpen(true)} aria-label="Edit student" className="rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 px-3 py-2">
								<Users className="h-4 w-4 mr-2" /> Edit
							</Button>

							<Button variant="outline" onClick={() => setIsTransferOpen(true)} aria-haspopup="dialog" aria-controls="transfer-dialog" className="rounded-xl border-indigo-200 text-indigo-700 px-3 py-2">
								Transfer
							</Button>
						</div>

						<Button variant="destructive" onClick={handleDelete} disabled={isDeleting} aria-label="Delete student" className="rounded-xl px-3 py-2">
							<Trash2 className="h-4 w-4 mr-2" />{isDeleting ? 'Deleting…' : 'Delete'}
						</Button>

					</div>
				</div>

				<Card>
					<CardContent className="p-4 md:p-6">
						<div className="flex flex-col md:flex-row gap-4">
							<figure className="flex-shrink-0">
								<Avatar className="h-24 w-24">
									<AvatarImage src={student.photo_url} alt={`Photo of ${student.first_name} ${student.last_name}`} />
									<AvatarFallback className="bg-blue-100 text-blue-700 text-2xl">{getInitials(student.first_name, student.last_name)}</AvatarFallback>
								</Avatar>
								<figcaption className="sr-only">Photo of {student.first_name} {student.last_name}</figcaption>
							</figure>
							<div className="flex-1">
								<div className="flex items-center gap-3">
									<h2 className="text-xl font-bold">{student.first_name} {student.last_name}</h2>
									<Badge>{student.status}</Badge>
								</div>
								<div className="grid grid-cols-1 md:grid-cols-3 gap-2 mt-3 text-sm">
									<div className="flex items-center gap-2"><Mail className="h-4 w-4 text-gray-500" /><span>{student.email}</span></div>
									<div className="flex items-center gap-2"><Phone className="h-4 w-4 text-gray-500" /><span>{student.phone}</span></div>
									<div className="flex items-center gap-2"><User className="h-4 w-4 text-gray-500" /><span className="capitalize">{student.gender}</span></div>
									<div className="flex items-center gap-2"><Calendar className="h-4 w-4 text-gray-500" /><span>Admitted: {new Date(student.admission_date).toLocaleDateString()}</span></div>
									<div className="flex items-center gap-2"><Hash className="h-4 w-4 text-gray-500" /><span>{student.student_id}</span></div>
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
						{guardians && guardians.length > 0 ? (
							<ul role="list" className="space-y-3">
								{guardians.map((g) => (
									<li key={g.id} className="flex items-start justify-between gap-4 p-3 rounded-lg border border-slate-100 bg-slate-50 hover:bg-white transition">
										<div>
											<p className="font-semibold">
												<Link href={`/admin/parents/${g.id}`} className="hover:underline focus:outline-none focus:ring-2 focus:ring-indigo-200">{g.name}</Link>
												{g.is_primary && <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-emerald-50 text-emerald-700">Primary</span>}
											</p>
											<p className="text-xs text-slate-500">{g.relationship}</p>
											<p className="text-sm mt-1">{g.email || '—'} · {g.phone || '—'}</p>
										</div>
										<div className="text-xs text-slate-400">{g.can_pickup ? 'Can pickup' : ''}</div>
									</li>
								))}
							</ul>
						) : (
							<div className="grid grid-cols-1 md:grid-cols-3 gap-4">
								<div>
									<Label>Name</Label>
									<div className="font-medium">{student.parent_name || '—'}</div>
								</div>
								<div>
									<Label>Email</Label>
									<div className="font-medium break-all">{student.parent_email || '—'}</div>
								</div>
								<div>
									<Label>Phone</Label>
									<div className="font-medium">{student.parent_phone || '—'}</div>
								</div>
							</div>
						)}
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
									<Label htmlFor="attendancePeriodSelect">Period</Label>
									<select id="attendancePeriodSelect" value={attendancePeriod} onChange={(e) => setAttendancePeriod(e.target.value as any)} className="px-2 py-1 border rounded" aria-label="Attendance period">
										<option value="daily">Daily</option>
										<option value="weekly">Weekly</option>
										<option value="monthly">Monthly</option>
										<option value="term">Term</option>
										<option value="session">Session</option>
									</select>
								</div>
							</CardHeader>
							<CardContent>
								<div className="mb-4 flex items-center gap-4">
									<div className="inline-flex items-center gap-3 px-3 py-2 rounded-lg bg-blue-50 text-blue-700 font-bold text-2xl" aria-live="polite" aria-atomic="true">{student.average_attendance}%</div>
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
									<Button onClick={handleManageSubjects} aria-label="Manage subjects">Manage Subjects</Button>
									<Button variant="outline" onClick={handleViewReport} aria-label="View report">View Report</Button>
								</div>
							</CardContent>
						</Card>
					</TabsContent>
				</Tabs>

				<EditStudentModal student={student} isOpen={isEditOpen} onClose={() => setIsEditOpen(false)} onSuccess={(updated: Student) => { setStudent(updated); toast.success('Student updated'); }} />

				{/* Accessible Transfer Dialog */}
				<Dialog open={isTransferOpen} onOpenChange={setIsTransferOpen}>
					<DialogContent id="transfer-dialog" className="rounded-2xl sm:max-w-md">
						<DialogHeader>
							<DialogTitle className="text-lg font-bold">Transfer Student</DialogTitle>
						</DialogHeader>
						<div>
							<p className="text-sm text-slate-500 mt-1">Move {student.first_name} {student.last_name} to another class</p>
							<label htmlFor="transferClassSelect" className="sr-only">Select target class</label>
							<select id="transferClassSelect" value={transferTargetClassId} onChange={(e) => setTransferTargetClassId(e.target.value)} className="w-full mt-4 px-3 py-2 border rounded" aria-label="Target class">
								<option value="">Select class</option>
								{classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
							</select>
							<div className="flex justify-end gap-2 mt-4">
								<Button variant="outline" onClick={() => { setIsTransferOpen(false); setTransferTargetClassId(''); }}>Cancel</Button>
								<Button onClick={handleTransfer} aria-disabled={!transferTargetClassId} aria-label="Confirm transfer">Transfer</Button>
							</div>
						</div>
					</DialogContent>
				</Dialog>

				<Dialog open={isEmailChangeOpen} onOpenChange={(open) => (open ? setIsEmailChangeOpen(true) : closeEmailChangeDialog())}>
					<DialogContent className="sm:max-w-lg rounded-2xl">
						<DialogHeader>
							<DialogTitle className="text-lg font-bold text-slate-900">Change Student Email</DialogTitle>
						</DialogHeader>

						<div className="space-y-4">
							<div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
								A 6-digit code will be sent to the new email address before the change is applied.
							</div>

							{emailChangeError ? (
								<div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{emailChangeError}</div>
							) : null}

							{emailStep === 'email' ? (
								<div className="space-y-3">
									<div className="space-y-2">
										<Label htmlFor="newEmail">New email address</Label>
										<Input
											id="newEmail"
											type="email"
											value={newEmail}
											onChange={(e) => setNewEmail(e.target.value)}
											placeholder="student.new@email.com"
										/>
									</div>
									<div className="flex justify-end gap-2">
										<Button variant="outline" onClick={closeEmailChangeDialog}>Cancel</Button>
										<Button onClick={handleSendEmailCode} disabled={isSendingCode}>
											{isSendingCode ? 'Sending code…' : 'Send Code'}
										</Button>
									</div>
								</div>
							) : (
								<div className="space-y-3">
									<div className="space-y-2">
										<Label htmlFor="verificationCode">6-digit code</Label>
										<Input
											id="verificationCode"
											inputMode="numeric"
											maxLength={6}
											value={verificationCode}
											onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
											placeholder="123456"
										/>
									</div>
									<p className="text-sm text-slate-500">Code sent to {newEmail}</p>
									<div className="flex justify-between gap-2">
										<Button variant="ghost" onClick={() => setEmailStep('email')}>Back</Button>
										<div className="flex gap-2">
											<Button variant="outline" onClick={closeEmailChangeDialog}>Cancel</Button>
											<Button onClick={handleVerifyAndApplyEmailChange} disabled={isVerifyingCode || isApplyingEmailChange}>
												{isVerifyingCode || isApplyingEmailChange ? 'Updating…' : 'Verify & Update'}
											</Button>
										</div>
									</div>
								</div>
							)}
						</div>
					</DialogContent>
				</Dialog>

				<Card className="border-red-200 bg-red-50/50">
					<CardHeader className="space-y-2">
						<div className="flex items-center gap-2">
							<ShieldAlert className="h-5 w-5 text-red-600" />
							<CardTitle className="text-red-800">Danger Zone</CardTitle>
						</div>
						<p className="text-sm text-red-700/80">Sensitive account actions for this student. Use these only when you need to reset access or correct login details.</p>
					</CardHeader>
					<CardContent className="grid gap-4 md:grid-cols-2">
						<Card className="border-red-200 bg-white shadow-sm">
							<CardHeader className="space-y-2">
								<div className="flex items-center gap-2">
									<RefreshCcw className="h-4 w-4 text-red-600" />
									<CardTitle className="text-base text-slate-900">Reset Password</CardTitle>
								</div>
								<p className="text-sm text-slate-500">Send a password reset link to the student&apos;s current email address.</p>
							</CardHeader>
							<CardContent>
								<Button variant="destructive" onClick={handleResetPassword} disabled={isResettingPassword} className="w-full rounded-xl">
									{isResettingPassword ? 'Sending reset email…' : 'Send Reset Email'}
								</Button>
							</CardContent>
						</Card>

						<Card className="border-red-200 bg-white shadow-sm">
							<CardHeader className="space-y-2">
								<div className="flex items-center gap-2">
									<KeyRound className="h-4 w-4 text-red-600" />
									<CardTitle className="text-base text-slate-900">Change Email</CardTitle>
								</div>
								<p className="text-sm text-slate-500">Requires a 6-digit confirmation code sent to the new email before the change is applied.</p>
							</CardHeader>
							<CardContent>
								<Button variant="outline" onClick={openEmailChangeDialog} className="w-full rounded-xl border-red-200 text-red-700 hover:bg-red-50">
									Start Email Change
								</Button>
							</CardContent>
						</Card>
					</CardContent>
				</Card>
			</main>
		</DashboardLayout>
	);
}

