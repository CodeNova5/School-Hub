"use client";

import { useEffect, useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { DashboardLayout } from '@/components/dashboard-layout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
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
import { 
	ArrowLeft, Calendar, Mail, Phone, User, Hash, Trash2, Users, 
	ShieldAlert, RefreshCcw, KeyRound, CheckCircle2, PencilLine, 
	MoveRight, Search, Loader2, UserPlus, GraduationCap, Heart, 
	BookOpen, FileText, CheckCircle
} from 'lucide-react';
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog';
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from '@/components/ui/alert-dialog';

export default function AdminStudentPage() {
	const params = useParams();
	const router = useRouter();
	const studentId = params.studentId as string;
	const { schoolId, isLoading: schoolLoading, error: schoolError } = useSchoolContext();

	const [student, setStudent] = useState<Student | null>(null);
	const [sessions, setSessions] = useState<Session[]>([]);
	const [terms, setTerms] = useState<Term[]>([]);
	const [classes, setClasses] = useState<Class[]>([]);
	const [departments, setDepartments] = useState<Array<{ id: string; name: string }>>([]);
	const [religions, setReligions] = useState<Array<{ id: string; name: string }>>([]);
	const [attendance, setAttendance] = useState<any[]>([]);
	const [studentResults, setStudentResults] = useState<any[]>([]);
	const [guardians, setGuardians] = useState<any[]>([]);
	const [attendancePeriod, setAttendancePeriod] = useState<'daily'|'weekly'|'monthly'|'term'|'session'>('monthly');

	const [loading, setLoading] = useState(true);
	const [isEditOpen, setIsEditOpen] = useState(false);
	const [isTransferOpen, setIsTransferOpen] = useState(false);
	const [isTransferConfirmOpen, setIsTransferConfirmOpen] = useState(false);
	const [transferTargetClassId, setTransferTargetClassId] = useState('');
	const [isTransferring, setIsTransferring] = useState(false);
	const [transferError, setTransferError] = useState('');
	const transferClassSelectRef = useRef<HTMLSelectElement | null>(null);
	const [isLinkParentOpen, setIsLinkParentOpen] = useState(false);
	const [linkParentSearch, setLinkParentSearch] = useState('');
	const [linkParentResults, setLinkParentResults] = useState<Array<{ id: string; name: string; email: string; phone: string | null; is_active: boolean; is_linked_to_student: boolean }>>([]);
	const [linkParentLoading, setLinkParentLoading] = useState(false);
	const [linkParentError, setLinkParentError] = useState('');
	const [linkParentHasMore, setLinkParentHasMore] = useState(false);
	const [selectedLinkParentId, setSelectedLinkParentId] = useState('');
	const [linkRelationshipType, setLinkRelationshipType] = useState('Guardian');
	const [linkRelationshipCustom, setLinkRelationshipCustom] = useState('');
	const [linkIsPrimaryContact, setLinkIsPrimaryContact] = useState(false);
	const [linkHasLegalCustody, setLinkHasLegalCustody] = useState(false);
	const [linkCanPickup, setLinkCanPickup] = useState(true);
	const [isLinkingParent, setIsLinkingParent] = useState(false);
	const [isUnlinkConfirmOpen, setIsUnlinkConfirmOpen] = useState(false);
	const [guardianToUnlink, setGuardianToUnlink] = useState<any | null>(null);
	const [isUnlinkingParent, setIsUnlinkingParent] = useState(false);
	const linkParentSearchRef = useRef<HTMLInputElement | null>(null);
	const linkParentSearchAbortRef = useRef<AbortController | null>(null);
	const [isDeleting, setIsDeleting] = useState(false);
	const [isResetConfirmOpen, setIsResetConfirmOpen] = useState(false);
	const [isResettingPassword, setIsResettingPassword] = useState(false);
	const [isEmailChangeOpen, setIsEmailChangeOpen] = useState(false);
	const [emailStep, setEmailStep] = useState<'email' | 'code' | 'success'>('email');
	const [newEmail, setNewEmail] = useState('');
	const [verificationCode, setVerificationCode] = useState('');
	const [emailChangeError, setEmailChangeError] = useState('');
	const [emailChangeSuccess, setEmailChangeSuccess] = useState('');
	const [isSendingCode, setIsSendingCode] = useState(false);
	const [isVerifyingCode, setIsVerifyingCode] = useState(false);
	const [isApplyingEmailChange, setIsApplyingEmailChange] = useState(false);
	const [selectedDepartmentId, setSelectedDepartmentId] = useState('');
	const [selectedReligionId, setSelectedReligionId] = useState('');
	const [isSavingAcademicProfile, setIsSavingAcademicProfile] = useState(false);

	useEffect(() => {
		if (schoolId && studentId) loadData();
	}, [schoolId, studentId]);

	useEffect(() => {
		if (isTransferOpen) {
			setTimeout(() => transferClassSelectRef.current?.focus(), 0);
		}
	}, [isTransferOpen]);

	useEffect(() => {
		if (isTransferConfirmOpen) {
			setTimeout(() => {
				const el = document.getElementById('transfer-confirm-btn') as HTMLButtonElement | null;
				el?.focus();
			}, 0);
		}
	}, [isTransferConfirmOpen]);

	useEffect(() => {
		if (isLinkParentOpen) {
			setTimeout(() => linkParentSearchRef.current?.focus(), 0);
			return;
		}

		setLinkParentSearch('');
		setLinkParentResults([]);
		setLinkParentError('');
		setLinkParentHasMore(false);
		setSelectedLinkParentId('');
		setLinkRelationshipType('Guardian');
		setLinkIsPrimaryContact(false);
		setLinkHasLegalCustody(false);
		setLinkCanPickup(true);
	}, [isLinkParentOpen]);

	useEffect(() => {
		if (!student) {
			setSelectedDepartmentId('');
			setSelectedReligionId('');
			return;
		}

		setSelectedDepartmentId(student.department_id || '');
		setSelectedReligionId(student.religion_id || '');
	}, [student]);

	useEffect(() => {
		if (!isLinkParentOpen) return;

		const query = linkParentSearch.trim();

		if (query.length < 2) {
			linkParentSearchAbortRef.current?.abort();
			setLinkParentResults([]);
			setLinkParentHasMore(false);
			setLinkParentLoading(false);
			return;
		}

		const controller = new AbortController();
		linkParentSearchAbortRef.current?.abort();
		linkParentSearchAbortRef.current = controller;

		let cancelled = false;

		async function searchParents() {
			try {
				setLinkParentLoading(true);
				const params = new URLSearchParams({
					search: query,
					studentId,
					pageSize: '8',
				});

				const response = await fetch(`/api/admin/parents/search?${params.toString()}`, { signal: controller.signal });
				const payload = await response.json();

				if (!response.ok || !payload.success) {
					throw new Error(payload.error || 'Failed to search parents');
				}

				if (cancelled) return;

				setLinkParentResults(payload.data.parents || []);
				setLinkParentHasMore(Boolean(payload.data.meta?.hasMore));
				setSelectedLinkParentId((current) => {
					if (current && (payload.data.parents || []).some((parent: any) => parent.id === current)) {
						return current;
					}
					const firstAvailable = (payload.data.parents || []).find((parent: any) => !parent.is_linked_to_student);
					return firstAvailable?.id || '';
				});
			} catch (error: any) {
				if (error?.name === 'AbortError' || cancelled) return;
				setLinkParentResults([]);
				setLinkParentHasMore(false);
				setLinkParentError(error.message || 'Failed to search parents');
			} finally {
				if (!cancelled) {
					setLinkParentLoading(false);
				}
			}
		}

		void searchParents();

		return () => {
			cancelled = true;
			controller.abort();
		};
	}, [linkParentSearch, isLinkParentOpen, studentId]);

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

			const [departmentResult, religionResult] = await Promise.allSettled([
				supabase
					.from('school_departments')
					.select('id, name')
					.eq('school_id', schoolId)
					.eq('is_active', true)
					.order('name', { ascending: true }),
				supabase
					.from('school_religions')
					.select('id, name')
					.eq('school_id', schoolId)
					.eq('is_active', true)
					.order('name', { ascending: true }),
			]);

			if (departmentResult.status === 'fulfilled') {
				setDepartments(departmentResult.value.data || []);
			} else {
				console.error('Failed to load departments', departmentResult.reason);
				setDepartments([]);
			}

			if (religionResult.status === 'fulfilled') {
				setReligions(religionResult.value.data || []);
			} else {
				console.error('Failed to load religions', religionResult.reason);
				setReligions([]);
			}

			if (studentData?.id) {
				const { data: attendanceData } = await supabase.from('attendance').select('*').eq('student_id', studentData.id).eq('school_id', schoolId);
				setAttendance(attendanceData || []);
			}

			if (studentData?.id) {
				const { data: guardianRows, error: guardianError } = await supabase
					.from('student_guardian_links')
					.select(`id, relationship_type, is_primary_contact, has_legal_custody, can_pickup, parents(id, name, email, phone)`)
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

	async function handleSaveAcademicProfile() {
		if (!student) return;

		try {
			setIsSavingAcademicProfile(true);
			const response = await fetch('/api/admin/update-student', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					studentId: student.id,
					updates: {
						department_id: selectedDepartmentId || null,
						religion_id: selectedReligionId || null,
					},
				}),
			});

			const data = await response.json();
			if (!response.ok) {
				throw new Error(data.error || data.message || 'Failed to update academic profile');
			}

			if (data.student) {
				setStudent(data.student);
			}
			toast.success('Academic info updated successfully');
		} catch (error: any) {
			toast.error(error.message || 'Failed to update academic profile');
		} finally {
			setIsSavingAcademicProfile(false);
		}
	}

	async function handleDelete() {
		if (!student) return;
		if (!confirm(`Permanently delete ${student.first_name} ${student.last_name}? This cannot be undone.`)) return;
		setIsDeleting(true);
		try {
			const res = await fetch('/api/admin', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'delete-student', studentId: student.id, userId: student.user_id }) });
			const body = await res.json();
			if (!res.ok) { throw new Error(body.error || 'Failed to delete'); }
			toast.success('Student deleted successfully');
			router.push('/admin/students');
		} catch (e: any) {
			toast.error('Delete failed: ' + (e.message || 'Unknown'));
		} finally { setIsDeleting(false); }
	}

	function handleManageSubjects() { if (student) router.push(`/admin/students/${student.id}/subjects`); }

	function handleViewReport() {
		if (!student) return;
		const currentSession = sessions.find(s => s.is_current);
		const currentTerm = terms.find(t => t.is_current);
		const params = new URLSearchParams();
		if (currentSession) params.set('session', currentSession.id);
		if (currentTerm) params.set('term', currentTerm.id);
		router.push(`/admin/students/${student.id}/report?${params.toString()}`);
	}

	async function handleTransfer() {
			if (!student || !transferTargetClassId) { return { success: false, error: 'Please select a target class' }; }
			try {
				const res = await fetch('/api/admin', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'transfer-students', studentIds: [student.id], targetClassId: transferTargetClassId }) });
				const data = await res.json();
				if (!res.ok) {
					return { success: false, error: data.error || 'Transfer failed' };
				}
				return { success: true, data };
			} catch (e: any) { return { success: false, error: e.message || 'Transfer failed' }; }
	}

	async function handleLinkExistingParent() {
		if (!student) return;

		const selectedParent = linkParentResults.find((parent) => parent.id === selectedLinkParentId);
		if (!selectedParent) {
			setLinkParentError('Please select a parent to link');
			return;
		}

		if (selectedParent.is_linked_to_student) {
			setLinkParentError('This parent is already linked to the student');
			return;
		}

		try {
			setIsLinkingParent(true);
			setLinkParentError('');
			const relationshipToSend = linkRelationshipType === 'Other' ? (linkRelationshipCustom.trim() || 'Other') : linkRelationshipType;

			const response = await fetch(`/api/admin/students/${student.id}/guardians`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					studentId: student.id,
					guardianId: selectedParent.id,
					relationshipType: relationshipToSend,
					isPrimaryContact: linkIsPrimaryContact,
					hasLegalCustody: linkHasLegalCustody,
					canPickup: linkCanPickup,
				}),
			});

			const payload = await response.json();

			if (!response.ok || !payload.success) {
				throw new Error(payload.error || 'Failed to link parent');
			}

			toast.success('Parent linked successfully');
			setIsLinkParentOpen(false);
			await loadData();
		} catch (error: any) {
			setLinkParentError(error.message || 'Failed to link parent');
		} finally {
			setIsLinkingParent(false);
		}
	}

	async function handleResetPassword() {
		if (!student?.email) {
			toast.error('Student email is missing');
			return;
		}

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
		setEmailChangeSuccess('');
		setEmailStep('email');
		setIsEmailChangeOpen(true);
	}

	function closeEmailChangeDialog() {
		setIsEmailChangeOpen(false);
		setNewEmail('');
		setVerificationCode('');
		setEmailChangeError('');
		setEmailChangeSuccess('');
		setEmailStep('email');
	}

	async function handleSendEmailCode() {
		if (!newEmail.trim()) {
			setEmailChangeError('Please enter a new email address');
			return;
		}

		const normalizedEmail = newEmail.trim().toLowerCase();
		if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
			setEmailChangeError('Please enter a valid email address');
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
			toast.success('Verification code sent');
		} catch (e: any) {
			setEmailChangeError(e.message || 'Failed to send verification code');
		} finally {
			setIsSendingCode(false);
		}
	}

	async function handleVerifyAndApplyEmailChange() {
		if (!student) return;
		if (!verificationCode.trim() || verificationCode.trim().length !== 6) {
			setEmailChangeError('Please enter the 6-digit verification code');
			return;
		}

		setEmailChangeError('');
		setEmailChangeSuccess('');
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
			const successMessage = updateData.message || 'Email updated successfully';
			setEmailChangeSuccess(successMessage);
			setEmailStep('success');
			toast.success(successMessage);
		} catch (e: any) {
			setEmailChangeError(e.message || 'Failed to update email');
		} finally {
			setIsVerifyingCode(false);
			setIsApplyingEmailChange(false);
		}
	}

	function handleResetConfirmed() {
		setIsResetConfirmOpen(false);
		void handleResetPassword();
	}

	async function handleUnlinkParent() {
		if (!student || !guardianToUnlink) return;

		try {
			setIsUnlinkingParent(true);
			const response = await fetch(`/api/admin/students/${student.id}/guardians?guardianId=${guardianToUnlink.id}`, {
				method: 'DELETE',
			});

			const payload = await response.json();

			if (!response.ok || !payload.success) {
				throw new Error(payload.error || 'Failed to remove parent');
			}

			toast.success('Parent unlinked successfully');
			setIsUnlinkConfirmOpen(false);
			setGuardianToUnlink(null);
			await loadData();
		} catch (error: any) {
			toast.error(error.message || 'Failed to remove parent');
		} finally {
			setIsUnlinkingParent(false);
		}
	}

	if (schoolLoading || loading) return (
		<DashboardLayout role="admin">
			<div className="flex flex-col items-center justify-center h-[60vh] gap-4" role="status" aria-live="polite">
				<Loader2 className="h-10 w-10 animate-spin text-indigo-600" />
				<p className="text-base font-medium text-slate-500">Loading student profile...</p>
			</div>
		</DashboardLayout>
	);

	if (schoolError || !schoolId) return (
		<DashboardLayout role="admin">
			<div className="flex items-center justify-center h-96 text-red-500 font-medium text-lg">
				{schoolError || 'School environment could not be found.'}
			</div>
		</DashboardLayout>
	);

	if (!student) return (
		<DashboardLayout role="admin">
			<div className="flex items-center justify-center h-96 text-slate-500 font-medium text-lg">
				Student record not found.
			</div>
		</DashboardLayout>
	);

	const getInitials = (f: string, l: string) => `${(f || '?')[0]}${(l || '?')[0]}`.toUpperCase();
	const filteredAttendance = filterAttendanceByPeriod(attendance, attendancePeriod);

	return (
		<DashboardLayout role="admin">
			<main className="max-w-7xl mx-auto p-6 md:p-10 space-y-10" id="main-content">
				
				{/* Top Action Bar */}
				<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 pb-6 border-b border-slate-100">
					<div className="space-y-2">
						<div className="flex items-center gap-2 text-sm text-slate-500">
							<GraduationCap className="h-4 w-4" />
							<span>Student Profile</span>
						</div>
						<h1 className="text-4xl font-bold tracking-tight text-slate-900">{student.first_name} {student.last_name}</h1>
					</div>
					<Button variant="outline" size="sm" onClick={() => router.back()} aria-label="Back to students list" className="rounded-xl px-5 py-2.5 text-slate-700 hover:bg-slate-50 border-slate-200 transition-all self-start sm:self-auto shadow-sm">
						<ArrowLeft className="h-4 w-4 mr-2 text-slate-500" />
						Back to Students
					</Button>
				</div>

				{/* Grid Dynamic Layout */}
				<div className="grid grid-cols-1 lg:grid-cols-3 gap-10 items-start">
					
					{/* Left Profile Sidebar Summary */}
					<div className="space-y-8 lg:col-span-1">
						<Card className="overflow-hidden border-slate-200/80 shadow-md bg-gradient-to-b from-slate-50/50 to-white">
							<div className="h-32 bg-gradient-to-r from-indigo-500 to-purple-600 relative" />
							<CardContent className="p-8 pt-0 relative flex flex-col items-center text-center">
								<figure className="-mt-16 mb-6 relative z-10">
									<Avatar className="h-32 w-32 border-4 border-white shadow-xl ring-1 ring-slate-100">
										<AvatarImage src={student.image_url || student.photo_url} alt={`${student.first_name} ${student.last_name}`} />
										<AvatarFallback className="bg-gradient-to-tr from-indigo-100 to-purple-100 text-indigo-700 text-3xl font-bold">{getInitials(student.first_name, student.last_name)}</AvatarFallback>
									</Avatar>
								</figure>

								<div className="space-y-2">
									<h2 className="text-2xl font-bold text-slate-900">{student.first_name} {student.last_name}</h2>
									<p className="text-sm font-mono bg-slate-100 text-slate-600 px-3 py-1 rounded-md inline-block">ID: {student.student_id}</p>
								</div>

								<div className="mt-5">
									<Badge className={`rounded-full px-4 py-1 text-sm font-medium border ${
										student.status === 'active' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-50 text-slate-700 border-slate-200'
									}`}>{student.status}</Badge>
								</div>

								<div className="w-full border-t border-slate-100 my-6" />

								<div className="w-full space-y-5 text-left text-sm">
									<div className="flex items-center gap-4 text-slate-600 hover:text-slate-900 transition-colors">
										<div className="p-2.5 bg-slate-100 rounded-lg text-slate-500"><Mail className="h-5 w-5" /></div>
										<span className="truncate font-medium">{student.email}</span>
									</div>
									<div className="flex items-center gap-4 text-slate-600 hover:text-slate-900 transition-colors">
										<div className="p-2.5 bg-slate-100 rounded-lg text-slate-500"><Phone className="h-5 w-5" /></div>
										<span className="font-medium">{student.phone || '—'}</span>
									</div>
									<div className="flex items-center gap-4 text-slate-600">
										<div className="p-2.5 bg-slate-100 rounded-lg text-slate-500"><User className="h-5 w-5" /></div>
										<span className="capitalize font-medium">{student.gender}</span>
									</div>
									<div className="flex items-center gap-4 text-slate-600">
										<div className="p-2.5 bg-slate-100 rounded-lg text-slate-500"><Calendar className="h-5 w-5" /></div>
										<span className="font-medium">Admitted: {new Date(student.admission_date).toLocaleDateString(undefined, {year: 'numeric', month: 'long', day: 'numeric'})}</span>
									</div>
								</div>
							</CardContent>
						</Card>

						{/* Academic Information Quick Controls */}
						<Card className="border-slate-200/80 shadow-sm">
							<CardHeader className="pb-4 border-b border-slate-50 bg-slate-50/50 p-6">
								<div className="flex items-center gap-3">
									<BookOpen className="h-5 w-5 text-indigo-600" />
									<CardTitle className="text-lg font-semibold text-slate-900">Academic Info</CardTitle>
								</div>
							</CardHeader>
							<CardContent className="p-6 space-y-6">
								<div className="space-y-2">
									<Label htmlFor="studentDepartment" className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Department</Label>
									<select
										id="studentDepartment"
										value={selectedDepartmentId}
										onChange={(e) => setSelectedDepartmentId(e.target.value)}
										className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm shadow-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
									>
										<option value="">No Department Selected</option>
										{departments.map((department) => (
											<option key={department.id} value={department.id}>{department.name}</option>
										))}
									</select>
								</div>

								<div className="space-y-2">
									<Label htmlFor="studentReligion" className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Religion</Label>
									<select
										id="studentReligion"
										value={selectedReligionId}
										onChange={(e) => setSelectedReligionId(e.target.value)}
										className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm shadow-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
									>
										<option value="">No Religion Selected</option>
										{religions.map((religion) => (
											<option key={religion.id} value={religion.id}>{religion.name}</option>
										))}
									</select>
								</div>

								<Button 
									onClick={handleSaveAcademicProfile} 
									disabled={isSavingAcademicProfile} 
									className="w-full rounded-xl mt-4 bg-indigo-600 hover:bg-indigo-700 shadow-sm py-5"
								>
									{isSavingAcademicProfile ? (
										<span className="flex items-center gap-2 justify-center"><Loader2 className="h-5 w-5 animate-spin"/> Saving...</span>
									) : 'Save Changes'}
								</Button>
							</CardContent>
						</Card>
					</div>

					{/* Right Content Management Space */}
					<div className="space-y-8 lg:col-span-2">
						
						{/* Guardians Card */}
						<Card className="border-slate-200 shadow-sm overflow-hidden">
							<CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-50/50 border-b border-slate-100 p-6 sm:p-8">
								<div className="space-y-1">
									<div className="flex items-center gap-3">
										<Heart className="h-5 w-5 text-rose-500" />
										<CardTitle className="text-xl font-bold text-slate-900">Parents &amp; Guardians</CardTitle>
									</div>
									<CardDescription className="text-sm">Manage the student's parents and emergency contacts.</CardDescription>
								</div>
								<Button variant="outline" onClick={() => setIsLinkParentOpen(true)} className="rounded-xl gap-2 border-slate-200 text-slate-700 hover:bg-slate-100 transition-all shadow-sm py-5">
									<UserPlus className="h-5 w-5 text-indigo-600" />
									Link Parent
								</Button>
							</CardHeader>
							<CardContent className="p-6 sm:p-8">
								{guardians && guardians.length > 0 ? (
									<ul role="list" className="space-y-4">
										{guardians.map((g) => (
											<li key={g.id} className="flex flex-col sm:flex-row items-start justify-between gap-4 p-5 rounded-2xl border border-slate-100 bg-slate-50/60 hover:bg-white hover:border-slate-200 hover:shadow-sm transition-all duration-200">
												<div className="space-y-2">
													<div className="flex items-center gap-3 flex-wrap">
														<Link href={`/admin/parents/${g.id}`} className="font-semibold text-lg text-slate-900 hover:text-indigo-600 hover:underline focus:outline-none">{g.name}</Link>
														<Badge variant="outline" className="text-xs uppercase font-bold tracking-wider px-2.5 py-0.5 bg-white text-slate-600 border-slate-200">{g.relationship}</Badge>
														{g.is_primary && <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 uppercase tracking-wide">Primary Contact</span>}
													</div>
													<div className="text-sm text-slate-500 flex flex-wrap gap-x-5 gap-y-2 pt-1">
														<span className="flex items-center gap-2"><Mail className="h-4 w-4" /> {g.email || '—'}</span>
														<span className="flex items-center gap-2"><Phone className="h-4 w-4" /> {g.phone || '—'}</span>
													</div>
												</div>
												<div className="flex flex-row sm:flex-col items-center sm:items-end justify-between w-full sm:w-auto gap-3 shrink-0">
													<span className={`text-xs font-medium px-3 py-1 rounded-md ${g.can_pickup ? 'bg-indigo-50 text-indigo-700' : 'bg-slate-100 text-slate-500'}`}>
														{g.can_pickup ? 'Can Pick Up' : 'No Pick-Up'}
													</span>
													<Button
														variant="ghost"
														className="text-sm text-rose-600 hover:bg-rose-50 hover:text-rose-700 rounded-lg font-medium px-4"
														onClick={() => { setGuardianToUnlink(g); setIsUnlinkConfirmOpen(true); }}
													>
														Unlink
													</Button>
												</div>
											</li>
										))}
									</ul>
								) : (
									<div className="grid grid-cols-1 md:grid-cols-3 gap-6 bg-slate-50/50 p-6 rounded-2xl border border-slate-200 border-dashed">
										<div className="space-y-1">
											<Label className="text-xs uppercase tracking-wider font-bold text-slate-400">Old Contact Name</Label>
											<div className="font-medium text-slate-800">{student.parent_name || '—'}</div>
										</div>
										<div className="space-y-1">
											<Label className="text-xs uppercase tracking-wider font-bold text-slate-400">Old Email Contact</Label>
											<div className="font-medium text-slate-800 break-all">{student.parent_email || '—'}</div>
										</div>
										<div className="space-y-1">
											<Label className="text-xs uppercase tracking-wider font-bold text-slate-400">Old Contact Phone</Label>
											<div className="font-medium text-slate-800">{student.parent_phone || '—'}</div>
										</div>
									</div>
								)}
							</CardContent>
						</Card>

						{/* Academic & Attendance Records Block */}
						<Tabs defaultValue="attendance" className="w-full">
							<TabsList className="grid w-full grid-cols-2 p-1.5 bg-slate-100 rounded-2xl">
								<TabsTrigger value="attendance" className="text-base font-medium rounded-xl py-3 data-[state=active]:bg-white data-[state=active]:shadow-sm">Attendance</TabsTrigger>
								<TabsTrigger value="results" className="text-base font-medium rounded-xl py-3 data-[state=active]:bg-white data-[state=active]:shadow-sm">Academic Results</TabsTrigger>
							</TabsList>

							<TabsContent value="attendance" className="space-y-6 mt-6 focus-visible:outline-none">
								<Card className="border-slate-200 shadow-sm">
									<CardHeader className="flex flex-row items-center justify-between space-y-0 p-6 sm:p-8 border-b border-slate-50">
										<CardTitle className="text-lg font-bold text-slate-900">Attendance Log</CardTitle>
										<div className="flex items-center gap-3">
											<Label htmlFor="attendancePeriodSelect" className="text-sm text-slate-500 font-medium">Time Period</Label>
											<select id="attendancePeriodSelect" value={attendancePeriod} onChange={(e) => setAttendancePeriod(e.target.value as any)} className="px-3 py-2 text-sm font-medium border border-slate-200 rounded-xl bg-white shadow-sm outline-none" aria-label="Select attendance period">
												<option value="daily">Daily</option>
												<option value="weekly">Weekly</option>
												<option value="monthly">Monthly</option>
												<option value="term">Current Term</option>
												<option value="session">Full Session</option>
											</select>
										</div>
									</CardHeader>
									<CardContent className="p-6 sm:p-8 space-y-8">
										<div className="flex flex-col sm:flex-row sm:items-center gap-6 bg-indigo-50/60 p-6 rounded-2xl border border-indigo-100">
											<div className="inline-flex items-center justify-center px-6 py-4 rounded-xl bg-indigo-600 text-white font-bold text-3xl tracking-tight shadow-sm" aria-live="polite" aria-atomic="true">
												{student.average_attendance}%
											</div>
											<div className="space-y-2 flex-1">
												<div className="text-base font-semibold text-slate-800">Average Attendance</div>
												<div className="w-full bg-slate-200 rounded-full h-3 overflow-hidden">
													<div className="bg-indigo-600 h-3 rounded-full transition-all duration-500" style={{ width: `${student.average_attendance}%` }} />
												</div>
											</div>
										</div>
										<AttendanceTimeline attendance={filteredAttendance} />
									</CardContent>
								</Card>
							</TabsContent>

							<TabsContent value="results" className="space-y-6 mt-6 focus-visible:outline-none">
								<Card className="border-slate-200 shadow-sm">
									<CardHeader className="p-6 sm:p-8 border-b border-slate-50">
										<CardTitle className="text-lg font-bold text-slate-900">Performance Summary</CardTitle>
									</CardHeader>
									<CardContent className="p-6 sm:p-8 space-y-6">
										<div className="overflow-hidden rounded-2xl border border-slate-200 shadow-sm">
											<ResultsTable results={studentResults} />
										</div>
										<div className="flex flex-wrap gap-4 pt-4">
											<Button onClick={handleManageSubjects} aria-label="Manage subjects" className="bg-slate-900 hover:bg-slate-800 text-white text-sm rounded-xl px-6 py-5 font-medium shadow-sm">
												Manage Subjects
											</Button>
											<Button variant="outline" onClick={handleViewReport} aria-label="View report" className="text-sm rounded-xl px-6 py-5 font-medium shadow-sm border-slate-200 text-slate-700 hover:bg-slate-50">
												<FileText className="h-4 w-4 mr-2 text-slate-500" /> Print Report Card
											</Button>
										</div>
									</CardContent>
								</Card>
							</TabsContent>
						</Tabs>

						{/* Operations Hub Zone */}
						<Card className="border-rose-200 bg-rose-50/30 rounded-2xl overflow-hidden shadow-sm">
							<CardHeader className="p-6 sm:p-8 border-b border-rose-100 bg-rose-50/50">
								<div className="flex items-center gap-3">
									<ShieldAlert className="h-6 w-6 text-rose-600" />
									<CardTitle className="text-xl font-bold text-rose-950">Account Actions</CardTitle>
								</div>
								<CardDescription className="text-sm text-rose-800 mt-2">Manage student account access and critical settings.</CardDescription>
							</CardHeader>
							<CardContent className="p-6 sm:p-8 grid grid-cols-1 sm:grid-cols-2 gap-6">
								
								<Card className="border-slate-200 bg-white shadow-sm flex flex-col justify-between p-6 gap-6">
									<div className="space-y-2">
										<div className="flex items-center gap-3">
											<RefreshCcw className="h-5 w-5 text-rose-600" />
											<h3 className="font-bold text-slate-900 text-base">Password Reset</h3>
										</div>
										<p className="text-sm text-slate-500 leading-relaxed">Sends a password reset link to the student's email address.</p>
									</div>
									<Button variant="outline" onClick={() => setIsResetConfirmOpen(true)} disabled={isResettingPassword} className="w-full text-sm rounded-xl font-semibold border-rose-200 text-rose-700 hover:bg-rose-50 py-5">
										{isResettingPassword ? 'Sending Link...' : 'Send Reset Link'}
									</Button>
								</Card>

								<Card className="border-slate-200 bg-white shadow-sm flex flex-col justify-between p-6 gap-6">
									<div className="space-y-2">
										<div className="flex items-center gap-3">
											<KeyRound className="h-5 w-5 text-rose-600" />
											<h3 className="font-bold text-slate-900 text-base">Change Email</h3>
										</div>
										<p className="text-sm text-slate-500 leading-relaxed">Update the student's login email address. Requires an email verification code.</p>
									</div>
									<Button variant="outline" onClick={openEmailChangeDialog} className="w-full text-sm rounded-xl font-semibold border-slate-200 text-slate-700 hover:bg-slate-50 py-5">
										Change Email
									</Button>
								</Card>

								<Card className="border-slate-200 bg-white shadow-sm flex flex-col justify-between p-6 gap-6">
									<div className="space-y-2">
										<div className="flex items-center gap-3">
											<PencilLine className="h-5 w-5 text-indigo-600" />
											<h3 className="font-bold text-slate-900 text-base">Edit Profile</h3>
										</div>
										<p className="text-sm text-slate-500 leading-relaxed">Update basic information like name, date of birth, and contact details.</p>
									</div>
									<Button onClick={() => setIsEditOpen(true)} className="w-full text-sm rounded-xl font-semibold bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm py-5">
										Edit Student Info
									</Button>
								</Card>

								<Card className="border-slate-200 bg-white shadow-sm flex flex-col justify-between p-6 gap-6">
									<div className="space-y-2">
										<div className="flex items-center gap-3">
											<MoveRight className="h-5 w-5 text-indigo-600" />
											<h3 className="font-bold text-slate-900 text-base">Change Class</h3>
										</div>
										<p className="text-sm text-slate-500 leading-relaxed">Move the student to a different class or grade level.</p>
									</div>
									<Button variant="outline" onClick={() => setIsTransferOpen(true)} className="w-full text-sm rounded-xl font-semibold border-indigo-200 text-indigo-700 hover:bg-indigo-50 py-5">
										Transfer Student
									</Button>
								</Card>

								<Card className="border-rose-200 bg-rose-50 shadow-sm sm:col-span-2 flex flex-col justify-between p-6 gap-6">
									<div className="space-y-2">
										<div className="flex items-center gap-3">
											<Trash2 className="h-5 w-5 text-rose-600" />
											<h3 className="font-bold text-rose-900 text-base">Delete Student Record</h3>
										</div>
										<p className="text-sm text-rose-800 leading-relaxed">Permanently remove the student, their grades, attendance, and all related data. This action cannot be undone.</p>
									</div>
									<Button variant="destructive" onClick={handleDelete} disabled={isDeleting} className="w-full text-sm rounded-xl font-semibold bg-rose-600 hover:bg-rose-700 shadow-sm py-5">
										{isDeleting ? 'Deleting...' : 'Delete Student'}
									</Button>
								</Card>

							</CardContent>
						</Card>
					</div>
				</div>
			</main>

			{/* Link Parent Modal */}
			<Dialog open={isLinkParentOpen} onOpenChange={setIsLinkParentOpen}>
				<DialogContent className="sm:max-w-2xl rounded-2xl p-8 border border-slate-200 shadow-2xl">
					<DialogHeader className="pb-6 border-b border-slate-100">
						<DialogTitle className="text-2xl font-bold text-slate-900">Link Parent Account</DialogTitle>
						<p className="text-sm text-slate-500 mt-2">Search for an existing parent account to link to this student.</p>
					</DialogHeader>

					<div className="space-y-6 pt-6">
						<div className="space-y-2">
							<Label htmlFor="parentSearch" className="text-sm font-semibold text-slate-700">Search Parent</Label>
							<div className="relative">
								<Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
								<Input
									id="parentSearch"
									ref={linkParentSearchRef}
									value={linkParentSearch}
									onChange={(e) => setLinkParentSearch(e.target.value)}
									placeholder="Search by name or email..."
									className="pl-12 py-6 rounded-xl border-slate-200 text-base focus-visible:ring-indigo-100"
								/>
							</div>
							<p className="text-xs text-slate-400">Type at least 2 characters to search.</p>
						</div>

						<div className="grid gap-6 md:grid-cols-2">
							<div className="space-y-2">
								<Label htmlFor="relationshipType" className="text-sm font-semibold text-slate-700">Relationship</Label>
								<select
									id="relationshipType"
									value={linkRelationshipType}
									onChange={(e) => { setLinkRelationshipType(e.target.value); if (e.target.value !== 'Other') setLinkRelationshipCustom(''); }}
									className="w-full px-4 py-3 border border-slate-200 bg-white rounded-xl text-sm shadow-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
								>
									<option value="Guardian">Legal Guardian</option>
									<option value="Mother">Mother</option>
									<option value="Father">Father</option>
									<option value="Grandparent">Grandparent</option>
									<option value="Sibling">Sibling</option>
									<option value="Emergency contact">Emergency Contact</option>
									<option value="Other">Other</option>
								</select>
								{linkRelationshipType === 'Other' && (
									<Input id="relationshipTypeCustom" value={linkRelationshipCustom} onChange={(e) => setLinkRelationshipCustom(e.target.value)} placeholder="Please specify (e.g., Aunt)" className="mt-3 rounded-xl text-sm border-slate-200 py-5" />
								)}
							</div>
							<div className="rounded-xl border border-slate-200 bg-slate-50 p-5 text-sm text-slate-700 flex flex-col justify-center gap-4">
								<label className="inline-flex items-center gap-3 cursor-pointer">
									<input
										type="checkbox"
										checked={linkIsPrimaryContact}
										onChange={(e) => setLinkIsPrimaryContact(e.target.checked)}
										className="h-5 w-5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
									/>
									<span className="select-none font-medium">Primary Contact</span>
								</label>
								<label className="inline-flex items-center gap-3 cursor-pointer">
									<input
										type="checkbox"
										checked={linkHasLegalCustody}
										onChange={(e) => setLinkHasLegalCustody(e.target.checked)}
										className="h-5 w-5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
									/>
									<span className="select-none font-medium">Has Legal Custody</span>
								</label>
								<label className="inline-flex items-center gap-3 cursor-pointer">
									<input
										type="checkbox"
										checked={linkCanPickup}
										onChange={(e) => setLinkCanPickup(e.target.checked)}
										className="h-5 w-5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
									/>
									<span className="select-none font-medium">Can Pick Up Student</span>
								</label>
							</div>
						</div>

						{linkParentError && (
							<div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm font-medium text-rose-700">{linkParentError}</div>
						)}

						<div className="max-h-72 space-y-3 overflow-auto rounded-xl border border-slate-200 bg-slate-50 p-3">
							{linkParentLoading ? (
								<div className="flex items-center justify-center gap-3 py-10 text-sm font-medium text-slate-500">
									<Loader2 className="h-5 w-5 animate-spin text-indigo-500" />
									Searching...
								</div>
							) : linkParentSearch.trim().length < 2 ? (
								<div className="py-10 text-center text-sm font-medium text-slate-400">Type a name or email to start searching.</div>
							) : linkParentResults.length === 0 ? (
								<div className="py-10 text-center text-sm font-medium text-slate-400">No parents found.</div>
							) : (
								linkParentResults.map((parent) => {
									const isSelected = selectedLinkParentId === parent.id;
									return (
										<button
											key={parent.id}
											type="button"
											onClick={() => setSelectedLinkParentId(parent.id)}
											aria-selected={isSelected}
											role="option"
											disabled={parent.is_linked_to_student}
											className={`w-full flex items-center gap-4 rounded-xl border p-4 text-left transition-all focus:outline-none ${isSelected ? 'ring-2 ring-indigo-500/20 border-indigo-500 bg-indigo-50/40' : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm'} ${parent.is_linked_to_student ? 'opacity-50 cursor-not-allowed bg-slate-100' : ''}`}
										>
											<Avatar className="h-10 w-10 shrink-0">
												<AvatarFallback className="bg-slate-200 text-slate-700 text-sm font-bold">{getInitials(parent.name.split(' ')[0] || '?', parent.name.split(' ')[1] || '?')}</AvatarFallback>
											</Avatar>
											<div className="flex-1 min-w-0">
												<p className="font-semibold text-slate-900 text-base truncate">{parent.name}</p>
												<p className="text-sm text-slate-500 truncate">{parent.email}</p>
											</div>
											<div className="flex flex-col items-end gap-2 shrink-0">
												<Badge variant={parent.is_active ? 'default' : 'secondary'} className="text-xs px-2 py-0.5 uppercase tracking-wider font-bold">{parent.is_active ? 'Active' : 'Inactive'}</Badge>
												{parent.is_linked_to_student && <Badge variant="secondary" className="text-xs bg-slate-200 text-slate-700 px-2 py-0.5 font-medium">Already Linked</Badge>}
											</div>
										</button>
									);
								})
							)}
						</div>

						<div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
							<Button variant="outline" onClick={() => setIsLinkParentOpen(false)} className="rounded-xl text-sm font-medium border-slate-200 py-5 px-6">Cancel</Button>
							<Button 
								onClick={handleLinkExistingParent} 
								disabled={isLinkingParent || !selectedLinkParentId || linkParentResults.find((parent) => parent.id === selectedLinkParentId)?.is_linked_to_student}
								className="rounded-xl text-sm bg-indigo-600 hover:bg-indigo-700 font-medium shadow-sm py-5 px-6"
							>
								{isLinkingParent ? 'Linking...' : 'Link Parent'}
							</Button>
						</div>
					</div>
				</DialogContent>
			</Dialog>

			{/* Unlink Parent Dialog */}
			<AlertDialog open={isUnlinkConfirmOpen} onOpenChange={(open) => { setIsUnlinkConfirmOpen(open); if (!open) setGuardianToUnlink(null); }}>
				<AlertDialogContent className="rounded-2xl border border-slate-200 p-8">
					<AlertDialogHeader className="space-y-3">
						<AlertDialogTitle className="text-xl font-bold text-slate-900">Unlink Parent?</AlertDialogTitle>
						<AlertDialogDescription className="text-base text-slate-600">
							This will remove <span className="font-semibold text-slate-900">{guardianToUnlink?.name}</span> from the student's contacts. You can add them back later if needed.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter className="gap-3 sm:gap-0 mt-6">
						<AlertDialogCancel className="rounded-xl text-sm font-medium border-slate-200 py-5">Cancel</AlertDialogCancel>
						<AlertDialogAction onClick={handleUnlinkParent} disabled={isUnlinkingParent} className="rounded-xl text-sm font-medium bg-rose-600 hover:bg-rose-700 text-white py-5">
							{isUnlinkingParent ? 'Unlinking...' : 'Unlink Parent'}
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>

			<EditStudentModal student={student} isOpen={isEditOpen} onClose={() => setIsEditOpen(false)} onSuccess={(updated: Student) => { setStudent(updated); toast.success('Student info updated successfully'); }} />

			{/* Transfer Class Dialog */}
			<Dialog open={isTransferOpen} onOpenChange={setIsTransferOpen}>
				<DialogContent id="transfer-dialog" className="rounded-2xl sm:max-w-lg p-8 border border-slate-200 shadow-2xl">
					<DialogHeader className="space-y-2">
						<DialogTitle className="text-xl font-bold text-slate-900">Transfer Student to a New Class</DialogTitle>
					</DialogHeader>
					<div className="space-y-6 pt-4">
						<p className="text-sm text-slate-600 leading-relaxed">Choose a new class for <span className="font-semibold text-slate-800">{student.first_name} {student.last_name}</span>.</p>
						<div className="space-y-2">
							<Label htmlFor="transferClassSelect" className="text-sm font-semibold text-slate-700">New Class</Label>
							<select 
								id="transferClassSelect" 
								ref={transferClassSelectRef} 
								value={transferTargetClassId} 
								onChange={(e) => setTransferTargetClassId(e.target.value)} 
								className="w-full px-4 py-3 text-base border border-slate-200 bg-white rounded-xl shadow-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100" 
							>
								<option value="">Select a class...</option>
								{classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
							</select>
						</div>
						<div className="flex justify-end gap-3 pt-4">
							<Button variant="outline" onClick={() => { setIsTransferOpen(false); setTransferTargetClassId(''); }} className="rounded-xl text-sm border-slate-200 py-5 px-6">Cancel</Button>
							<Button onClick={() => setIsTransferConfirmOpen(true)} disabled={!transferTargetClassId} className="rounded-xl text-sm bg-indigo-600 hover:bg-indigo-700 font-medium shadow-sm py-5 px-6">
								Continue
							</Button>
						</div>
					</div>
				</DialogContent>
			</Dialog>

			{/* Confirm Class Transfer */}
			<AlertDialog open={isTransferConfirmOpen} onOpenChange={(open) => { setIsTransferConfirmOpen(open); if (!open) setTransferError(''); }}>
				<AlertDialogContent className="rounded-2xl border border-slate-200 p-8">
					<AlertDialogHeader className="space-y-3">
						<AlertDialogTitle className="text-xl font-bold text-slate-900">Confirm Class Transfer</AlertDialogTitle>
						<AlertDialogDescription className="text-base text-slate-600">
							Are you sure you want to move <span className="font-semibold text-slate-800">{student.first_name} {student.last_name}</span> to <span className="font-bold text-indigo-600">{classes.find((c) => c.id === transferTargetClassId)?.name || 'the new class'}</span>?
						</AlertDialogDescription>
					</AlertDialogHeader>
					{transferError && (
						<div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm font-medium text-rose-700 mt-4">{transferError}</div>
					)}
					<AlertDialogFooter className="gap-3 sm:gap-0 mt-6">
						<AlertDialogCancel className="rounded-xl text-sm font-medium border-slate-200 py-5 px-6">Cancel</AlertDialogCancel>
						<AlertDialogAction id="transfer-confirm-btn" onClick={async () => {
							setTransferError('');
							setIsTransferring(true);
							try {
								const result = await handleTransfer();
								if (result.success) {
									toast.success('Student transferred successfully');
									setIsTransferConfirmOpen(false);
									setIsTransferOpen(false);
									setTransferTargetClassId('');
									await loadData();
								} else {
									setTransferError(result.error || 'Failed to transfer student');
								}
							} catch (err: any) {
								setTransferError(err?.message || 'Failed to transfer student');
							} finally {
								setIsTransferring(false);
							}
						}} disabled={isTransferring} className="rounded-xl text-sm font-medium bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm py-5 px-6">
							{isTransferring ? 'Transferring...' : 'Confirm Transfer'}
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>

			{/* Reset Password Dialog */}
			<AlertDialog open={isResetConfirmOpen} onOpenChange={setIsResetConfirmOpen}>
				<AlertDialogContent className="rounded-2xl border border-slate-200 p-8">
					<AlertDialogHeader className="space-y-3">
						<AlertDialogTitle className="text-xl font-bold text-slate-900">Send Password Reset Email?</AlertDialogTitle>
						<AlertDialogDescription className="text-base text-slate-600">
							This will send a password reset link to <span className="font-medium text-slate-900">{student.email}</span>.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter className="gap-3 sm:gap-0 mt-6">
						<AlertDialogCancel className="rounded-xl text-sm font-medium border-slate-200 py-5 px-6">Cancel</AlertDialogCancel>
						<AlertDialogAction onClick={handleResetConfirmed} className="rounded-xl text-sm font-medium bg-rose-600 hover:bg-rose-700 text-white shadow-sm py-5 px-6">
							Send Email
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>

			{/* Change Email Dialog */}
			<Dialog open={isEmailChangeOpen} onOpenChange={(open) => (open ? setIsEmailChangeOpen(true) : closeEmailChangeDialog())}>
				<DialogContent className="sm:max-w-lg rounded-2xl p-8 border border-slate-200 shadow-2xl">
					<DialogHeader className="space-y-2">
						<DialogTitle className="text-xl font-bold text-slate-900">Change Student Email</DialogTitle>
					</DialogHeader>

					<div className="space-y-6 pt-4">
						<div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 leading-relaxed flex gap-3 items-start">
							<ShieldAlert className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
							<span>Security check: A verification code will be sent to the new email address to confirm the change.</span>
						</div>

						{emailChangeError && (
							<div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm font-medium text-rose-700">{emailChangeError}</div>
						)}

						{emailStep === 'success' ? (
							<div className="rounded-xl border border-emerald-200 bg-emerald-50 p-6 space-y-4">
								<div className="flex items-start gap-4">
									<CheckCircle className="h-6 w-6 text-emerald-600 shrink-0 mt-0.5" />
									<div className="space-y-2">
										<p className="font-bold text-emerald-900 text-base">Email Updated Successfully</p>
										<p className="text-sm text-emerald-800 leading-relaxed">{emailChangeSuccess}</p>
										<p className="text-sm font-mono bg-white border border-emerald-100 rounded-md px-3 py-1.5 text-emerald-900 inline-block mt-2">{newEmail}</p>
									</div>
								</div>
								<div className="flex justify-end pt-2">
									<Button onClick={closeEmailChangeDialog} className="rounded-xl text-sm font-medium bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-5">Close</Button>
								</div>
							</div>
						) : emailStep === 'email' ? (
							<div className="space-y-6">
								<div className="space-y-2">
									<Label htmlFor="newEmail" className="text-sm font-semibold text-slate-700">New Email Address</Label>
									<Input
										id="newEmail"
										type="email"
										value={newEmail}
										onChange={(e) => setNewEmail(e.target.value)}
										placeholder="e.g., new.email@example.com"
										className="rounded-xl border-slate-200 text-base focus-visible:ring-indigo-100 py-6"
									/>
								</div>
								<div className="flex justify-end gap-3 pt-4">
									<Button variant="outline" onClick={closeEmailChangeDialog} className="rounded-xl text-sm border-slate-200 py-5 px-6">Cancel</Button>
									<Button onClick={handleSendEmailCode} disabled={isSendingCode} className="rounded-xl text-sm bg-indigo-600 hover:bg-indigo-700 font-medium text-white shadow-sm py-5 px-6">
										{isSendingCode ? 'Sending...' : 'Send Verification Code'}
									</Button>
								</div>
							</div>
						) : (
							<div className="space-y-6">
								<div className="space-y-2">
									<Label htmlFor="verificationCode" className="text-sm font-semibold text-slate-700">6-Digit Verification Code</Label>
									<Input
										id="verificationCode"
										inputMode="numeric"
										maxLength={6}
										value={verificationCode}
										onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
										placeholder="******"
										className="rounded-xl border-slate-200 text-center tracking-widest text-2xl font-bold font-mono focus-visible:ring-indigo-100 py-6"
									/>
								</div>
								<p className="text-sm text-slate-500">We sent a code to: <span className="font-semibold text-slate-700">{newEmail}</span></p>
								<div className="flex justify-between gap-3 pt-4 border-t border-slate-100">
									<Button variant="ghost" onClick={() => setEmailStep('email')} className="rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-100 py-5">Back to Email</Button>
									<div className="flex gap-3">
										<Button variant="outline" onClick={closeEmailChangeDialog} className="rounded-xl text-sm border-slate-200 py-5 px-6">Cancel</Button>
										<Button onClick={handleVerifyAndApplyEmailChange} disabled={isVerifyingCode || isApplyingEmailChange} className="rounded-xl text-sm bg-indigo-600 hover:bg-indigo-700 text-white font-medium shadow-sm py-5 px-6">
											{isVerifyingCode || isApplyingEmailChange ? 'Updating...' : 'Confirm Change'}
										</Button>
									</div>
								</div>
							</div>
						)}
					</div>
				</DialogContent>
			</Dialog>
		</DashboardLayout>
	);
}