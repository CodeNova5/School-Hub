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
			toast.success('Department and religion updated successfully');
		} catch (error: any) {
			toast.error(error.message || 'Failed to update academic profile');
		} finally {
			setIsSavingAcademicProfile(false);
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
			toast.success('Student record removed completely');
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
			if (!student || !transferTargetClassId) { return { success: false, error: 'Select a target class' }; }
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
			setLinkParentError('Select a parent to link');
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

			toast.success('Parent linked to student successfully');
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

			toast.success('Password reset email dispatched');
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
			const successMessage = updateData.message || 'Student email updated successfully';
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

			toast.success('Parent relationship terminated');
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
			<div className="flex flex-col items-center justify-center h-[60vh] gap-3" role="status" aria-live="polite">
				<Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
				<p className="text-sm font-medium text-slate-500">Loading profile data...</p>
			</div>
		</DashboardLayout>
	);

	if (schoolError || !schoolId) return (
		<DashboardLayout role="admin">
			<div className="flex items-center justify-center h-96 text-red-500 font-medium">
				{schoolError || 'School environment context not available'}
			</div>
		</DashboardLayout>
	);

	if (!student) return (
		<DashboardLayout role="admin">
			<div className="flex items-center justify-center h-96 text-slate-500 font-medium">
				Student record could not be found
			</div>
		</DashboardLayout>
	);

	const getInitials = (f: string, l: string) => `${(f || '?')[0]}${(l || '?')[0]}`.toUpperCase();
	const filteredAttendance = filterAttendanceByPeriod(attendance, attendancePeriod);

	return (
		<DashboardLayout role="admin">
			<main className="max-w-7xl mx-auto p-4 md:p-8 space-y-8" id="main-content">
				
				{/* Top Action Bar */}
				<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
					<div className="space-y-1">
						<div className="flex items-center gap-2 text-sm text-slate-500">
							<GraduationCap className="h-4 w-4" />
							<span>Student Registry Administration</span>
						</div>
						<h1 className="text-3xl font-bold tracking-tight text-slate-900">{student.first_name} {student.last_name}</h1>
					</div>
					<Button variant="outline" size="sm" onClick={() => router.back()} aria-label="Back to students list" className="rounded-xl px-4 py-2 text-slate-700 hover:bg-slate-50 border-slate-200 transition-all self-start sm:self-auto shadow-sm">
						<ArrowLeft className="h-4 w-4 mr-2 text-slate-500" />
						Back to Registry
					</Button>
				</div>

				{/* Grid Dynamic Layout */}
				<div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
					
					{/* Left Profile Sidebar Summary */}
					<div className="space-y-6 lg:col-span-1">
						<Card className="overflow-hidden border-slate-200/80 shadow-md shadow-slate-100/50 bg-gradient-to-b from-slate-50/50 to-white">
							<div className="h-24 bg-gradient-to-r from-indigo-500 to-purple-600 relative" />
							<CardContent className="p-6 pt-0 relative flex flex-col items-center text-center">
								<figure className="-mt-12 mb-4 relative z-10">
									<Avatar className="h-24 w-24 border-4 border-white shadow-xl ring-1 ring-slate-100">
										<AvatarImage src={student.photo_url} alt={`${student.first_name} ${student.last_name}`} />
										<AvatarFallback className="bg-gradient-to-tr from-indigo-100 to-purple-100 text-indigo-700 text-2xl font-bold">{getInitials(student.first_name, student.last_name)}</AvatarFallback>
									</Avatar>
								</figure>

								<div className="space-y-1">
									<h2 className="text-xl font-bold text-slate-900">{student.first_name} {student.last_name}</h2>
									<p className="text-xs font-mono bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md inline-block">ID: {student.student_id}</p>
								</div>

								<div className="mt-3">
									<Badge className={`rounded-full px-3 py-0.5 text-xs font-medium border ${
										student.status === 'active' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-50 text-slate-700 border-slate-200'
									}`}>{student.status}</Badge>
								</div>

								<div className="w-full border-t border-slate-100 my-5" />

								<div className="w-full space-y-4 text-left text-sm">
									<div className="flex items-center gap-3 text-slate-600 hover:text-slate-900 transition-colors">
										<div className="p-2 bg-slate-100 rounded-lg text-slate-500"><Mail className="h-4 w-4" /></div>
										<span className="truncate font-medium">{student.email}</span>
									</div>
									<div className="flex items-center gap-3 text-slate-600 hover:text-slate-900 transition-colors">
										<div className="p-2 bg-slate-100 rounded-lg text-slate-500"><Phone className="h-4 w-4" /></div>
										<span className="font-medium">{student.phone || '—'}</span>
									</div>
									<div className="flex items-center gap-3 text-slate-600">
										<div className="p-2 bg-slate-100 rounded-lg text-slate-500"><User className="h-4 w-4" /></div>
										<span className="capitalize font-medium">{student.gender}</span>
									</div>
									<div className="flex items-center gap-3 text-slate-600">
										<div className="p-2 bg-slate-100 rounded-lg text-slate-500"><Calendar className="h-4 w-4" /></div>
										<span className="font-medium">Admitted: {new Date(student.admission_date).toLocaleDateString(undefined, {year: 'numeric', month: 'short', day: 'numeric'})}</span>
									</div>
								</div>
							</CardContent>
						</Card>

						{/* Academic Information Quick Controls */}
						<Card className="border-slate-200/80 shadow-sm">
							<CardHeader className="pb-3 border-b border-slate-50 bg-slate-50/50">
								<div className="flex items-center gap-2">
									<BookOpen className="h-4 w-4 text-indigo-600" />
									<CardTitle className="text-base font-semibold text-slate-900">Academic Profile</CardTitle>
								</div>
							</CardHeader>
							<CardContent className="p-5 space-y-4">
								<div className="space-y-1.5">
									<Label htmlFor="studentDepartment" className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Classification/Department</Label>
									<select
										id="studentDepartment"
										value={selectedDepartmentId}
										onChange={(e) => setSelectedDepartmentId(e.target.value)}
										className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
									>
										<option value="">No Custom Department Specified</option>
										{departments.map((department) => (
											<option key={department.id} value={department.id}>{department.name}</option>
										))}
									</select>
								</div>

								<div className="space-y-1.5">
									<Label htmlFor="studentReligion" className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Religion Core Filtering</Label>
									<select
										id="studentReligion"
										value={selectedReligionId}
										onChange={(e) => setSelectedReligionId(e.target.value)}
										className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
									>
										<option value="">No Core Specified</option>
										{religions.map((religion) => (
											<option key={religion.id} value={religion.id}>{religion.name}</option>
										))}
									</select>
								</div>

								<Button 
									onClick={handleSaveAcademicProfile} 
									disabled={isSavingAcademicProfile} 
									className="w-full rounded-xl mt-2 bg-indigo-600 hover:bg-indigo-700 shadow-sm text-sm"
								>
									{isSavingAcademicProfile ? (
										<span className="flex items-center gap-2 justify-center"><Loader2 className="h-4 w-4 animate-spin"/> Updating Profile...</span>
									) : 'Save Meta Data Updates'}
								</Button>
							</CardContent>
						</Card>
					</div>

					{/* Right Content Management Space */}
					<div className="space-y-6 lg:col-span-2">
						
						{/* Guardians Card */}
						<Card className="border-slate-200 shadow-sm overflow-hidden">
							<CardHeader className="flex flex-row items-center justify-between gap-4 bg-slate-50/50 border-b border-slate-100 p-5">
								<div className="space-y-0.5">
									<div className="flex items-center gap-2">
										<Heart className="h-4 w-4 text-rose-500" />
										<CardTitle className="text-lg font-bold text-slate-900">Parent &amp; Guardian Links</CardTitle>
									</div>
									<CardDescription className="text-xs">Manage active account links for parents or direct contacts.</CardDescription>
								</div>
								<Button variant="outline" size="sm" onClick={() => setIsLinkParentOpen(true)} className="rounded-xl gap-2 border-slate-200 text-slate-700 hover:bg-slate-100 transition-all shadow-sm shrink-0">
									<UserPlus className="h-4 w-4 text-indigo-600" />
									Link Directory Entry
								</Button>
							</CardHeader>
							<CardContent className="p-5">
								{guardians && guardians.length > 0 ? (
									<ul role="list" className="space-y-3">
										{guardians.map((g) => (
											<li key={g.id} className="flex items-start justify-between gap-4 p-4 rounded-xl border border-slate-100 bg-slate-50/60 hover:bg-white hover:border-slate-200 hover:shadow-sm transition-all duration-200">
												<div className="space-y-1">
													<div className="flex items-center gap-2 flex-wrap">
														<Link href={`/admin/parents/${g.id}`} className="font-semibold text-slate-900 hover:text-indigo-600 hover:underline focus:outline-none">{g.name}</Link>
														<Badge variant="outline" className="text-[10px] uppercase font-bold tracking-wider px-2 py-0 bg-white text-slate-600 border-slate-200">{g.relationship}</Badge>
														{g.is_primary && <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 uppercase tracking-wide">Primary Contact</span>}
													</div>
													<div className="text-xs text-slate-500 flex flex-wrap gap-x-3 gap-y-1 pt-1">
														<span className="flex items-center gap-1"><Mail className="h-3 w-3" /> {g.email || '—'}</span>
														<span className="flex items-center gap-1"><Phone className="h-3 w-3" /> {g.phone || '—'}</span>
													</div>
												</div>
												<div className="flex flex-col items-end justify-between self-stretch shrink-0">
													<span className={`text-[11px] font-medium px-2 py-0.5 rounded-md ${g.can_pickup ? 'bg-indigo-50 text-indigo-700' : 'bg-slate-100 text-slate-400'}`}>
														{g.can_pickup ? 'Authorized Pick-up' : 'No Pick-up Access'}
													</span>
													<Button
														variant="ghost"
														size="sm"
														className="h-7 text-xs text-rose-600 hover:bg-rose-50 hover:text-rose-700 rounded-lg font-medium px-2"
														onClick={() => { setGuardianToUnlink(g); setIsUnlinkConfirmOpen(true); }}
													>
														Unlink
													</Button>
												</div>
											</li>
										))}
									</ul>
								) : (
									<div className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-slate-50/50 p-4 rounded-xl border border-slate-100 border-dashed">
										<div className="space-y-0.5">
											<Label className="text-[11px] uppercase tracking-wider font-bold text-slate-400">Legacy Contact Name</Label>
											<div className="font-medium text-slate-800">{student.parent_name || '—'}</div>
										</div>
										<div className="space-y-0.5">
											<Label className="text-[11px] uppercase tracking-wider font-bold text-slate-400">Legacy Email Contact</Label>
											<div className="font-medium text-slate-800 break-all">{student.parent_email || '—'}</div>
										</div>
										<div className="space-y-0.5">
											<Label className="text-[11px] uppercase tracking-wider font-bold text-slate-400">Legacy Contact Phone</Label>
											<div className="font-medium text-slate-800">{student.parent_phone || '—'}</div>
										</div>
									</div>
								)}
							</CardContent>
						</Card>

						{/* Academic & Attendance Records Block */}
						<Tabs defaultValue="attendance" className="w-full">
							<TabsList className="grid w-full grid-cols-2 p-1 bg-slate-100 rounded-xl">
								<TabsTrigger value="attendance" className="text-sm font-medium rounded-lg py-2 data-[state=active]:bg-white data-[state=active]:shadow-sm">Attendance Records</TabsTrigger>
								<TabsTrigger value="results" className="text-sm font-medium rounded-lg py-2 data-[state=active]:bg-white data-[state=active]:shadow-sm">Academic Results Terminal</TabsTrigger>
							</TabsList>

							<TabsContent value="attendance" className="space-y-4 mt-4 focus-visible:outline-none">
								<Card className="border-slate-200 shadow-sm">
									<CardHeader className="flex flex-row items-center justify-between space-y-0 p-5 border-b border-slate-50">
										<CardTitle className="text-base font-bold text-slate-900">Attendance Track Metrics</CardTitle>
										<div className="flex items-center gap-2">
											<Label htmlFor="attendancePeriodSelect" className="text-xs text-slate-500 font-medium">Period Window</Label>
											<select id="attendancePeriodSelect" value={attendancePeriod} onChange={(e) => setAttendancePeriod(e.target.value as any)} className="px-2.5 py-1 text-xs font-medium border border-slate-200 rounded-lg bg-white shadow-sm outline-none" aria-label="Attendance period font-medium">
												<option value="daily">Daily View</option>
												<option value="weekly">Weekly Window</option>
												<option value="monthly">Monthly Cycle</option>
												<option value="term">Current Term</option>
												<option value="session">Full Session</option>
											</select>
										</div>
									</CardHeader>
									<CardContent className="p-5 space-y-6">
										<div className="flex flex-col sm:flex-row sm:items-center gap-4 bg-gradient-to-r from-indigo-50/60 to-blue-50/40 p-4 rounded-xl border border-indigo-100/40">
											<div className="inline-flex items-center justify-center px-4 py-2.5 rounded-xl bg-indigo-600 text-white font-bold text-2xl tracking-tight shadow-sm" aria-live="polite" aria-atomic="true">
												{student.average_attendance}%
											</div>
											<div className="space-y-1 flex-1">
												<div className="text-sm font-semibold text-slate-800">Aggregated Attendance Rating</div>
												<div className="w-full bg-slate-200/70 rounded-full h-2 overflow-hidden">
													<div className="bg-indigo-600 h-2 rounded-full transition-all duration-500" style={{ width: `${student.average_attendance}%` }} />
												</div>
											</div>
										</div>
										<AttendanceTimeline attendance={filteredAttendance} />
									</CardContent>
								</Card>
							</TabsContent>

							<TabsContent value="results" className="space-y-4 mt-4 focus-visible:outline-none">
								<Card className="border-slate-200 shadow-sm">
									<CardHeader className="p-5 border-b border-slate-50">
										<CardTitle className="text-base font-bold text-slate-900">Performance Matrix Summary</CardTitle>
									</CardHeader>
									<CardContent className="p-5 space-y-4">
										<div className="overflow-hidden rounded-xl border border-slate-100 shadow-inner">
											<ResultsTable results={studentResults} />
										</div>
										<div className="flex flex-wrap gap-2 pt-2">
											<Button onClick={handleManageSubjects} aria-label="Manage subjects" className="bg-slate-900 hover:bg-slate-800 text-white text-xs rounded-xl px-4 py-2 font-medium shadow-sm">
												Configure Registrations
											</Button>
											<Button variant="outline" onClick={handleViewReport} aria-label="View report" className="text-xs rounded-xl px-4 py-2 font-medium shadow-sm border-slate-200 text-slate-700 hover:bg-slate-50">
												<FileText className="h-3.5 w-3.5 mr-1.5 text-slate-500" /> Print Term Report Sheet
											</Button>
										</div>
									</CardContent>
								</Card>
							</TabsContent>
						</Tabs>

						{/* Identity Danger & Operations Hub Zone */}
						<Card className="border-rose-100 bg-gradient-to-b from-rose-50/30 to-rose-50/10 rounded-2xl overflow-hidden shadow-sm">
							<CardHeader className="p-5 border-b border-rose-100/60 bg-rose-50/50">
								<div className="flex items-center gap-2">
									<ShieldAlert className="h-5 w-5 text-rose-600" />
									<CardTitle className="text-lg font-bold text-rose-950">Administrative Account Actions</CardTitle>
								</div>
								<CardDescription className="text-xs text-rose-800/80">Execute sensitive system configuration mutations and credential modifications for this student account.</CardDescription>
							</CardHeader>
							<CardContent className="p-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2 gap-4">
								
								<Card className="border-slate-200/60 bg-white shadow-sm flex flex-col justify-between">
									<CardHeader className="p-4 pb-2 space-y-1">
										<div className="flex items-center gap-2">
											<RefreshCcw className="h-4 w-4 text-rose-600" />
											<h3 className="font-bold text-slate-900 text-sm">Dispatched Password Reset</h3>
										</div>
										<p className="text-xs text-slate-500 leading-relaxed">Sends a localized cryptographic token password configuration reset pathway directory link directly onto the current identity profile email index.</p>
									</CardHeader>
									<CardContent className="p-4 pt-2">
										<Button variant="outline" onClick={() => setIsResetConfirmOpen(true)} disabled={isResettingPassword} className="w-full text-xs rounded-xl font-semibold border-rose-200 text-rose-700 hover:bg-rose-50 hover:border-rose-300">
											{isResettingPassword ? 'Processing Link Dispatched...' : 'Trigger Password Reset Link'}
										</Button>
									</CardContent>
								</Card>

								<Card className="border-slate-200/60 bg-white shadow-sm flex flex-col justify-between">
									<CardHeader className="p-4 pb-2 space-y-1">
										<div className="flex items-center gap-2">
											<KeyRound className="h-4 w-4 text-rose-600" />
											<h3 className="font-bold text-slate-900 text-sm">Email Access Configuration</h3>
										</div>
										<p className="text-xs text-slate-500 leading-relaxed">Modifies authentication state routing addresses. Requires interactive multi-factor confirmation tokens verification processing execution loops.</p>
									</CardHeader>
									<CardContent className="p-4 pt-2">
										<Button variant="outline" onClick={openEmailChangeDialog} className="w-full text-xs rounded-xl font-semibold border-slate-200 text-slate-700 hover:bg-slate-50">
											Initiate Email Lifecycle Switch
										</Button>
									</CardContent>
								</Card>

								<Card className="border-slate-200/60 bg-white shadow-sm flex flex-col justify-between">
									<CardHeader className="p-4 pb-2 space-y-1">
										<div className="flex items-center gap-2">
											<PencilLine className="h-4 w-4 text-indigo-600" />
											<h3 className="font-bold text-slate-900 text-sm">Profile Manifest Matrix</h3>
										</div>
										<p className="text-xs text-slate-500 leading-relaxed">Updates primitive fields including core data strings, localized text configurations, bio vectors and parent fallback properties arrays.</p>
									</CardHeader>
									<CardContent className="p-4 pt-2">
										<Button onClick={() => setIsEditOpen(true)} className="w-full text-xs rounded-xl font-semibold bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm">
											Open Structural Profiler Editor
										</Button>
									</CardContent>
								</Card>

								<Card className="border-slate-200/60 bg-white shadow-sm flex flex-col justify-between">
									<CardHeader className="p-4 pb-2 space-y-1">
										<div className="flex items-center gap-2">
											<MoveRight className="h-4 w-4 text-indigo-600" />
											<h3 className="font-bold text-slate-900 text-sm">Transfer Class Placement</h3>
										</div>
										<p className="text-xs text-slate-500 leading-relaxed">Migrates student records across educational tiers while managing associated contextual grading trees cleanly.</p>
									</CardHeader>
									<CardContent className="p-4 pt-2">
										<Button variant="outline" onClick={() => setIsTransferOpen(true)} className="w-full text-xs rounded-xl font-semibold border-indigo-200 text-indigo-700 hover:bg-indigo-50">
											Initialize Tier Transfer Loop
										</Button>
									</CardContent>
								</Card>

								<Card className="border-rose-200 bg-rose-50/20 shadow-sm sm:col-span-2 lg:col-span-1 xl:col-span-2 flex flex-col justify-between">
									<CardHeader className="p-4 pb-2 space-y-1">
										<div className="flex items-center gap-2">
											<Trash2 className="h-4 w-4 text-rose-600" />
											<h3 className="font-bold text-rose-950 text-sm">Purge Record Database</h3>
										</div>
										<p className="text-xs text-rose-800/80 leading-relaxed">Permanently drops student entity frames, related grading records, attendance charts, and related identity framework entries across all tables. This action is irreversible.</p>
									</CardHeader>
									<CardContent className="p-4 pt-2">
										<Button variant="destructive" onClick={handleDelete} disabled={isDeleting} className="w-full text-xs rounded-xl font-semibold bg-rose-600 hover:bg-rose-700 shadow-sm">
											{isDeleting ? 'Purging Entity Stack...' : 'Purge All Student Records'}
										</Button>
									</CardContent>
								</Card>

							</CardContent>
						</Card>
					</div>
				</div>
			</main>

			{/* Directories Links Linkage Modals Box */}
			<Dialog open={isLinkParentOpen} onOpenChange={setIsLinkParentOpen}>
				<DialogContent className="sm:max-w-2xl rounded-2xl p-6 overflow-hidden border border-slate-100 shadow-2xl">
					<DialogHeader className="pb-4 border-b border-slate-50">
						<DialogTitle className="text-xl font-bold text-slate-900">Link Existing Parent Account</DialogTitle>
						<p className="text-xs text-slate-500 mt-1">Query database structures to link centralized parent data models to this student framework directly.</p>
					</DialogHeader>

					<div className="space-y-5 pt-4">
						<div className="space-y-1.5">
							<Label htmlFor="parentSearch" className="text-xs font-semibold text-slate-700">Search Context</Label>
							<div className="relative">
								<Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
								<Input
									id="parentSearch"
									ref={linkParentSearchRef}
									value={linkParentSearch}
									onChange={(e) => setLinkParentSearch(e.target.value)}
									placeholder="Query via Name string index, email mapping strings, etc..."
									className="pl-10 rounded-xl border-slate-200 text-sm focus-visible:ring-indigo-100 focus-visible:border-indigo-400"
								/>
							</div>
							<p className="text-[11px] text-slate-400">Provide an evaluation string slice containing at least 2 characters to trigger query evaluations.</p>
						</div>

						<div className="grid gap-4 md:grid-cols-2">
							<div className="space-y-1.5">
								<Label htmlFor="relationshipType" className="text-xs font-semibold text-slate-700">Relationship Classification Tag</Label>
								<select
									id="relationshipType"
									value={linkRelationshipType}
									onChange={(e) => { setLinkRelationshipType(e.target.value); if (e.target.value !== 'Other') setLinkRelationshipCustom(''); }}
									className="w-full px-3 py-2 border border-slate-200 bg-white rounded-xl text-sm shadow-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
								>
									<option value="Guardian">Legal Guardian</option>
									<option value="Mother">Biological/Legal Mother</option>
									<option value="Father">Biological/Legal Father</option>
									<option value="Grandparent">Grandparent Tier</option>
									<option value="Sibling">Sibling Direct Contact</option>
									<option value="Emergency contact">Proxy Emergency Contact</option>
									<option value="Other">Custom Unlisted Designation</option>
								</select>
								{linkRelationshipType === 'Other' && (
									<Input id="relationshipTypeCustom" value={linkRelationshipCustom} onChange={(e) => setLinkRelationshipCustom(e.target.value)} placeholder="Specify configuration tag (e.g., Aunt)" className="mt-2 rounded-xl text-sm border-slate-200" />
								)}
							</div>
							<div className="rounded-xl border border-slate-100 bg-slate-50/50 p-4 text-xs text-slate-600 flex flex-col justify-center gap-2.5">
								<label className="inline-flex items-center gap-2.5 cursor-pointer">
									<input
										type="checkbox"
										checked={linkIsPrimaryContact}
										onChange={(e) => setLinkIsPrimaryContact(e.target.checked)}
										className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
									/>
									<span className="select-none font-medium text-slate-700">Designate Primary Contact Node</span>
								</label>
								<label className="inline-flex items-center gap-2.5 cursor-pointer">
									<input
										type="checkbox"
										checked={linkHasLegalCustody}
										onChange={(e) => setLinkHasLegalCustody(e.target.checked)}
										className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
									/>
									<span className="select-none font-medium text-slate-700">Maintains Retained Legal Custody</span>
								</label>
								<label className="inline-flex items-center gap-2.5 cursor-pointer">
									<input
										type="checkbox"
										checked={linkCanPickup}
										onChange={(e) => setLinkCanPickup(e.target.checked)}
										className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
									/>
									<span className="select-none font-medium text-slate-700">Authorized Campus Pick-up Clearing</span>
								</label>
							</div>
						</div>

						{linkParentError && (
							<div className="rounded-xl border border-rose-200 bg-rose-50/50 p-3 text-xs font-medium text-rose-700">{linkParentError}</div>
						)}

						<div className="max-h-60 space-y-2 overflow-auto rounded-xl border border-slate-100 bg-slate-50/30 p-2" role="listbox" aria-label="Parent search results">
							{linkParentLoading ? (
								<div className="flex items-center justify-center gap-2 py-8 text-xs font-medium text-slate-400">
									<Loader2 className="h-4 w-4 animate-spin text-indigo-500" />
									Executing Remote Directory Scanning...
								</div>
							) : linkParentSearch.trim().length < 2 ? (
								<div className="py-8 text-center text-xs font-medium text-slate-400">Input parameter queries inside field boxes to map records.</div>
							) : linkParentResults.length === 0 ? (
								<div className="py-8 text-center text-xs font-medium text-slate-400">Zero entries returned for this parameter array.</div>
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
											className={`w-full flex items-start gap-3 rounded-xl border p-3 text-left transition-all focus:outline-none ${isSelected ? 'ring-2 ring-indigo-500/20 border-indigo-500 bg-indigo-50/40' : 'border-slate-100 bg-white hover:border-slate-200 hover:shadow-sm'} ${parent.is_linked_to_student ? 'opacity-50 cursor-not-allowed bg-slate-50' : ''}`}
										>
											<Avatar className="h-9 w-9 shrink-0">
												<AvatarFallback className="bg-slate-100 text-slate-700 text-xs font-bold">{getInitials(parent.name.split(' ')[0] || '?', parent.name.split(' ')[1] || '?')}</AvatarFallback>
											</Avatar>
											<div className="flex-1 min-w-0">
												<p className="font-semibold text-slate-900 text-sm truncate">{parent.name}</p>
												<p className="text-xs text-slate-500 truncate">{parent.email}</p>
												<p className="text-[11px] text-slate-400 font-medium mt-0.5">{parent.phone || 'No Linked Phone Line'}</p>
											</div>
											<div className="flex flex-col items-end gap-1.5 shrink-0 text-[10px]">
												<Badge variant={parent.is_active ? 'default' : 'secondary'} className="text-[9px] px-1.5 py-0 uppercase tracking-wider font-bold">{parent.is_active ? 'Active' : 'Inactive'}</Badge>
												{parent.is_linked_to_student && <Badge variant="secondary" className="text-[9px] bg-slate-200/60 text-slate-600 px-1.5 py-0 font-medium">Already Linked</Badge>}
											</div>
										</button>
									);
								})
							)}
						</div>

						{linkParentHasMore && <p className="text-[10px] text-slate-400 italic">Truncation bounds reached. Refine parameters to reveal hidden database rows.</p>}

						<div className="flex justify-end gap-2 pt-2 border-t border-slate-50">
							<Button variant="outline" onClick={() => setIsLinkParentOpen(false)} className="rounded-xl text-xs font-medium border-slate-200">Cancel</Button>
							<Button 
								onClick={handleLinkExistingParent} 
								disabled={isLinkingParent || !selectedLinkParentId || linkParentResults.find((parent) => parent.id === selectedLinkParentId)?.is_linked_to_student}
								className="rounded-xl text-xs bg-indigo-600 hover:bg-indigo-700 font-medium shadow-sm"
							>
								{isLinkingParent ? 'Binding Mapping Node...' : 'Commit Mapping Association'}
							</Button>
						</div>
					</div>
				</DialogContent>
			</Dialog>

			{/* Interactive Structural Alert Dialogboxes */}
			<AlertDialog open={isUnlinkConfirmOpen} onOpenChange={(open) => { setIsUnlinkConfirmOpen(open); if (!open) setGuardianToUnlink(null); }}>
				<AlertDialogContent className="rounded-2xl border border-slate-100">
					<AlertDialogHeader>
						<AlertDialogTitle className="text-lg font-bold text-slate-900">Sever Contact Mapping Relationship?</AlertDialogTitle>
						<AlertDialogDescription className="text-sm text-slate-500">
							This breaks relationship matrices between entry context item <span className="font-semibold text-slate-900">{guardianToUnlink?.name}</span> and student file tracking parameters. This configuration can be linked back later if needed.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter className="gap-2 sm:gap-0">
						<AlertDialogCancel className="rounded-xl text-xs font-medium border-slate-200">Cancel Operation</AlertDialogCancel>
						<AlertDialogAction onClick={handleUnlinkParent} disabled={isUnlinkingParent} className="rounded-xl text-xs font-medium bg-rose-600 hover:bg-rose-700 text-white">
							{isUnlinkingParent ? 'Breaking Link...' : 'Terminate Linked Account'}
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>

			<EditStudentModal student={student} isOpen={isEditOpen} onClose={() => setIsEditOpen(false)} onSuccess={(updated: Student) => { setStudent(updated); toast.success('Student core configuration schema updated'); }} />

			{/* Operational Modal Transitions */}
			<Dialog open={isTransferOpen} onOpenChange={setIsTransferOpen}>
				<DialogContent id="transfer-dialog" className="rounded-2xl sm:max-w-md p-6 border border-slate-100 shadow-2xl">
					<DialogHeader>
						<DialogTitle className="text-lg font-bold text-slate-900">Execute Registry Student Tier Transfer</DialogTitle>
					</DialogHeader>
					<div className="space-y-4 pt-2">
						<p className="text-xs text-slate-500 leading-relaxed">Changes framework paths, registry tracking lists, and curriculum lines for student entry record <span className="font-semibold text-slate-700">{student.first_name} {student.last_name}</span>.</p>
						<div className="space-y-1">
							<Label htmlFor="transferClassSelect" className="text-xs font-semibold text-slate-700">Target Structural Placement Tier</Label>
							<select 
								id="transferClassSelect" 
								ref={transferClassSelectRef} 
								value={transferTargetClassId} 
								onChange={(e) => setTransferTargetClassId(e.target.value)} 
								className="w-full px-3 py-2 text-sm border border-slate-200 bg-white rounded-xl shadow-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100" 
								aria-label="Target class selection dropdown"
							>
								<option value="">Select Target Class Assignment Matrix...</option>
								{classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
							</select>
						</div>
						<div className="flex justify-end gap-2 pt-2">
							<Button variant="outline" onClick={() => { setIsTransferOpen(false); setTransferTargetClassId(''); }} className="rounded-xl text-xs border-slate-200">Abort</Button>
							<Button onClick={() => setIsTransferConfirmOpen(true)} disabled={!transferTargetClassId} className="rounded-xl text-xs bg-indigo-600 hover:bg-indigo-700 font-medium shadow-sm">
								Proceed to Confirmation
							</Button>
						</div>
					</div>
				</DialogContent>
			</Dialog>

			{/* Sub-tier Transfer Approvals Confirmation */}
			<AlertDialog open={isTransferConfirmOpen} onOpenChange={(open) => { setIsTransferConfirmOpen(open); if (!open) setTransferError(''); }}>
				<AlertDialogContent className="rounded-2xl border border-slate-100">
					<AlertDialogHeader>
						<AlertDialogTitle className="text-lg font-bold text-slate-900">Authorize Record Class Placement Mutation?</AlertDialogTitle>
						<AlertDialogDescription className="text-sm text-slate-500">
							Confirm migration path for <span className="font-semibold text-slate-800">{student.first_name} {student.last_name}</span> into registry destination slot: <span className="font-bold text-indigo-600">{classes.find((c) => c.id === transferTargetClassId)?.name || 'Unspecified Node'}</span>.
						</AlertDialogDescription>
					</AlertDialogHeader>
					{transferError && (
						<div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-medium text-rose-700">{transferError}</div>
					)}
					<AlertDialogFooter className="gap-2 sm:gap-0">
						<AlertDialogCancel className="rounded-xl text-xs font-medium border-slate-200">Abort Route</AlertDialogCancel>
						<AlertDialogAction id="transfer-confirm-btn" onClick={async () => {
							setTransferError('');
							setIsTransferring(true);
							try {
								const result = await handleTransfer();
								if (result.success) {
									toast.success(result.data?.message || 'Tier transfer structural operations passed');
									setIsTransferConfirmOpen(false);
									setIsTransferOpen(false);
									setTransferTargetClassId('');
									await loadData();
								} else {
									setTransferError(result.error || 'Operations stack structural failure exception');
								}
							} catch (err: any) {
								setTransferError(err?.message || 'Structural network operation failure');
							} finally {
								setIsTransferring(false);
							}
						}} disabled={isTransferring} className="rounded-xl text-xs font-medium bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm">
							{isTransferring ? 'Re-writing System Blocks...' : 'Authorize Placement Re-route'}
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>

			{/* Credential Reset Controls Container */}
			<AlertDialog open={isResetConfirmOpen} onOpenChange={setIsResetConfirmOpen}>
				<AlertDialogContent className="rounded-2xl border border-slate-100">
					<AlertDialogHeader>
						<AlertDialogTitle className="text-lg font-bold text-slate-900">Dispatch Interactive Password Re-assignment Protocol?</AlertDialogTitle>
						<AlertDialogDescription className="text-sm text-slate-500">
							This forces access suspension and sends a recovery token directly to the target mailbox <span className="font-medium text-slate-900">{student.email}</span>.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter className="gap-2 sm:gap-0">
						<AlertDialogCancel className="rounded-xl text-xs font-medium border-slate-200">Abort Reset</AlertDialogCancel>
						<AlertDialogAction onClick={handleResetConfirmed} className="rounded-xl text-xs font-medium bg-rose-600 hover:bg-rose-700 text-white shadow-sm">
							Transmit Cryptographic Reset Token
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>

			{/* Email Swapping Lifecycle Manager Modal */}
			<Dialog open={isEmailChangeOpen} onOpenChange={(open) => (open ? setIsEmailChangeOpen(true) : closeEmailChangeDialog())}>
				<DialogContent className="sm:max-w-lg rounded-2xl p-6 border border-slate-100 shadow-2xl">
					<DialogHeader>
						<DialogTitle className="text-lg font-bold text-slate-900">Modify Security Route Email</DialogTitle>
					</DialogHeader>

					<div className="space-y-4 pt-2">
						<div className="rounded-xl border border-amber-200 bg-amber-50/60 p-3.5 text-xs text-amber-900 leading-relaxed flex gap-2.5 items-start">
							<ShieldAlert className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
							<span>Security checkpoint: An operational authentication code token will be delivered onto the new mailbox address destination before execution loops close.</span>
						</div>

						{emailChangeError && (
							<div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-medium text-rose-700">{emailChangeError}</div>
						)}

						{emailStep === 'success' ? (
							<div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-4 space-y-3">
								<div className="flex items-start gap-3">
									<CheckCircle className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
									<div className="space-y-1">
										<p className="font-bold text-emerald-900 text-sm">System Database Record Updated</p>
										<p className="text-xs text-emerald-800 leading-relaxed">{emailChangeSuccess}</p>
										<p className="text-xs font-mono bg-white border border-emerald-100 rounded-md px-2 py-1 text-emerald-900 inline-block mt-1">Active ID: {newEmail}</p>
									</div>
								</div>
								<div className="flex justify-end">
									<Button onClick={closeEmailChangeDialog} className="rounded-xl text-xs font-medium bg-emerald-600 hover:bg-emerald-700 text-white px-4">Close Dialogue</Button>
								</div>
							</div>
						) : emailStep === 'email' ? (
							<div className="space-y-4">
								<div className="space-y-1.5">
									<Label htmlFor="newEmail" className="text-xs font-semibold text-slate-700">New Authentication Email Route Target</Label>
									<Input
										id="newEmail"
										type="email"
										value={newEmail}
										onChange={(e) => setNewEmail(e.target.value)}
										placeholder="e.g., student.new.record@school.edu"
										className="rounded-xl border-slate-200 text-sm focus-visible:ring-indigo-100"
									/>
								</div>
								<div className="flex justify-end gap-2 pt-2">
									<Button variant="outline" onClick={closeEmailChangeDialog} className="rounded-xl text-xs border-slate-200">Cancel</Button>
									<Button onClick={handleSendEmailCode} disabled={isSendingCode} className="rounded-xl text-xs bg-indigo-600 hover:bg-indigo-700 font-medium text-white shadow-sm">
										{isSendingCode ? 'Transmitting Token...' : 'Generate Dispatch Verification Token'}
									</Button>
								</div>
							</div>
						) : (
							<div className="space-y-4">
								<div className="space-y-1.5">
									<Label htmlFor="verificationCode" className="text-xs font-semibold text-slate-700">6-Digit Verification Check Token</Label>
									<Input
										id="verificationCode"
										inputMode="numeric"
										maxLength={6}
										value={verificationCode}
										onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
										placeholder="******"
										className="rounded-xl border-slate-200 text-center tracking-widest text-lg font-bold font-mono focus-visible:ring-indigo-100"
									/>
								</div>
								<p className="text-xs text-slate-400">Security checkpoint payload sent onto entry address: <span className="font-semibold text-slate-600">{newEmail}</span></p>
								<div className="flex justify-between gap-2 pt-2 border-t border-slate-50">
									<Button variant="ghost" onClick={() => setEmailStep('email')} className="rounded-xl text-xs font-medium text-slate-500 hover:bg-slate-100">Return to Mail Entry</Button>
									<div className="flex gap-2">
										<Button variant="outline" onClick={closeEmailChangeDialog} className="rounded-xl text-xs border-slate-200">Abort Changing</Button>
										<Button onClick={handleVerifyAndApplyEmailChange} disabled={isVerifyingCode || isApplyingEmailChange} className="rounded-xl text-xs bg-indigo-600 hover:bg-indigo-700 text-white font-medium shadow-sm">
											{isVerifyingCode || isApplyingEmailChange ? 'Re-writing Identity Frames...' : 'Confirm Authentication Swap'}
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