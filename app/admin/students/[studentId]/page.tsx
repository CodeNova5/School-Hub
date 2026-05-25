"use client";

import { useEffect, useState, useRef } from 'react';
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
import { ArrowLeft, Calendar, Mail, Phone, User, Hash, Trash2, Users, ShieldAlert, RefreshCcw, KeyRound, CheckCircle2, PencilLine, MoveRight, Search, Loader2, UserPlus } from 'lucide-react';
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
	const transferConfirmButtonRef = useRef<HTMLButtonElement | null>(null);
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

	useEffect(() => {
		if (schoolId && studentId) loadData();
	}, [schoolId, studentId]);

	// Focus management: focus class select when transfer dialog opens
	useEffect(() => {
		if (isTransferOpen) {
			setTimeout(() => transferClassSelectRef.current?.focus(), 0);
		}
	}, [isTransferOpen]);

	// Focus management: focus confirm button when confirm dialog opens
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
			if (!student) {
				return;
			}

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

				toast.success('Parent linked to student');
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
		if (!student || !guardianToUnlink) {
			return;
		}

		try {
			setIsUnlinkingParent(true);
			const response = await fetch(`/api/admin/students/${student.id}/guardians?guardianId=${guardianToUnlink.id}`, {
				method: 'DELETE',
			});

			const payload = await response.json();

			if (!response.ok || !payload.success) {
				throw new Error(payload.error || 'Failed to remove parent');
			}

			toast.success('Parent removed from student');
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
						<Button variant="ghost" size="sm" onClick={() => router.back()} aria-label="Back to students list" className="rounded-xl px-3 py-2 text-slate-700 hover:bg-slate-100">
							<ArrowLeft className="h-4 w-4 mr-2" />
							Back
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
							<div className="flex items-center justify-between gap-3">
								<CardTitle>Parent / Guardian</CardTitle>
								<Button variant="outline" size="sm" onClick={() => setIsLinkParentOpen(true)} className="rounded-xl gap-2">
									<UserPlus className="h-4 w-4" />
									Link existing parent
								</Button>
							</div>
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
										<div className="flex flex-col items-end gap-2">
											<div className="text-xs text-slate-400">{g.can_pickup ? 'Can pickup' : ''}</div>
											<Button
												variant="ghost"
												size="sm"
												className="h-8 rounded-lg text-red-600 hover:bg-red-50 hover:text-red-700"
												onClick={() => { setGuardianToUnlink(g); setIsUnlinkConfirmOpen(true); }}
											>
												Remove
											</Button>
										</div>
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

				<Dialog open={isLinkParentOpen} onOpenChange={setIsLinkParentOpen}>
					<DialogContent className="sm:max-w-2xl rounded-2xl">
						<DialogHeader>
							<DialogTitle className="text-lg font-bold text-slate-900">Link existing parent</DialogTitle>
							<p className="text-sm text-slate-500 mt-1">Search the parent directory and select a parent to link to this student.</p>
						</DialogHeader>

						<div className="space-y-4">
							<div className="space-y-2">
								<Label htmlFor="parentSearch">Search by name or email</Label>
								<div className="relative">
									<Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
									<Input
										id="parentSearch"
										ref={linkParentSearchRef}
										value={linkParentSearch}
										onChange={(e) => setLinkParentSearch(e.target.value)}
										placeholder="Search parents by name or email"
										className="pl-9"
									/>
								</div>
								<p className="text-xs text-slate-500">Type at least 2 characters. Results are filtered on the server and limited for performance.</p>
							</div>

							<div className="grid gap-3 md:grid-cols-2">
								<div className="space-y-2">
									<Label htmlFor="relationshipType">Relationship</Label>
									<select
										id="relationshipType"
										value={linkRelationshipType}
										onChange={(e) => { setLinkRelationshipType(e.target.value); if (e.target.value !== 'Other') setLinkRelationshipCustom(''); }}
										className="w-full px-3 py-2 border rounded"
									>
										<option value="Guardian">Guardian</option>
										<option value="Mother">Mother</option>
										<option value="Father">Father</option>
										<option value="Grandparent">Grandparent</option>
										<option value="Sibling">Sibling</option>
										<option value="Emergency contact">Emergency contact</option>
										<option value="Other">Other (custom)</option>
									</select>
									{linkRelationshipType === 'Other' ? (
										<Input id="relationshipTypeCustom" value={linkRelationshipCustom} onChange={(e) => setLinkRelationshipCustom(e.target.value)} placeholder="Enter relationship (e.g. Aunt)" />
									) : null}
								</div>
								<div className="rounded-xl border border-slate-200 p-3 text-sm text-slate-600">
									<div className="flex flex-col gap-2">
										<label className="inline-flex items-center gap-2">
											<input
												type="checkbox"
												checked={linkIsPrimaryContact}
												onChange={(e) => setLinkIsPrimaryContact(e.target.checked)}
												className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
											/>
											<span className="select-none">Primary contact</span>
										</label>
										<label className="inline-flex items-center gap-2">
											<input
												type="checkbox"
												checked={linkHasLegalCustody}
												onChange={(e) => setLinkHasLegalCustody(e.target.checked)}
												className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
											/>
											<span className="select-none">Has legal custody</span>
										</label>
										<label className="inline-flex items-center gap-2">
											<input
												type="checkbox"
												checked={linkCanPickup}
												onChange={(e) => setLinkCanPickup(e.target.checked)}
												className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
											/>
											<span className="select-none">Can pickup student</span>
										</label>
									</div>
								</div>
							</div>

							{linkParentError ? (
								<div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{linkParentError}</div>
							) : null}

							<div className="max-h-80 space-y-2 overflow-auto rounded-xl border border-slate-200 p-2" role="listbox" aria-label="Parent search results">
								{linkParentLoading ? (
									<div className="flex items-center justify-center gap-2 py-6 text-sm text-slate-500">
										<Loader2 className="h-4 w-4 animate-spin" />
										Searching parents...
									</div>
								) : linkParentSearch.trim().length < 2 ? (
									<div className="py-6 text-center text-sm text-slate-500">Start typing to search the parent directory.</div>
								) : linkParentResults.length === 0 ? (
									<div className="py-6 text-center text-sm text-slate-500">No parents matched your search.</div>
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
												className={`w-full flex items-start gap-3 rounded-lg border p-3 text-left transition focus:outline-none ${isSelected ? 'ring-2 ring-indigo-300 border-indigo-300 bg-indigo-50' : 'border-slate-100 bg-white hover:border-slate-200 hover:bg-slate-50'} ${parent.is_linked_to_student ? 'opacity-60 cursor-not-allowed' : ''}`}
											>
												<div className="flex items-center gap-3">
													<Avatar className="h-10 w-10">
														<AvatarFallback className="bg-blue-100 text-blue-700 text-sm">{getInitials(parent.name.split(' ')[0] || '?', parent.name.split(' ')[1] || '?')}</AvatarFallback>
													</Avatar>
												</div>
												<div className="flex-1">
													<p className="font-semibold text-slate-900">{parent.name}</p>
													<p className="text-sm text-slate-600">{parent.email}</p>
													<p className="text-xs text-slate-500">{parent.phone || 'No phone number'}</p>
												</div>
												<div className="flex flex-col items-end gap-1 text-xs">
													<Badge variant={parent.is_active ? 'default' : 'secondary'}>{parent.is_active ? 'Active' : 'Inactive'}</Badge>
													{parent.is_linked_to_student ? <Badge variant="secondary">Already linked</Badge> : null}
												</div>
											</button>
										);
									})
								)}
							</div>

							{linkParentHasMore ? <p className="text-xs text-slate-500">More matches exist. Refine the search to narrow the list.</p> : null}

							<div className="flex justify-end gap-2">
								<Button variant="outline" onClick={() => setIsLinkParentOpen(false)}>Cancel</Button>
								<Button onClick={handleLinkExistingParent} disabled={isLinkingParent || !selectedLinkParentId || linkParentResults.find((parent) => parent.id === selectedLinkParentId)?.is_linked_to_student}>
									{isLinkingParent ? 'Linking…' : 'Link parent'}
								</Button>
							</div>
						</div>
					</DialogContent>
				</Dialog>

				<AlertDialog open={isUnlinkConfirmOpen} onOpenChange={(open) => { setIsUnlinkConfirmOpen(open); if (!open) setGuardianToUnlink(null); }}>
					<AlertDialogContent>
						<AlertDialogHeader>
							<AlertDialogTitle>Remove parent?</AlertDialogTitle>
							<AlertDialogDescription>
								This will unlink {guardianToUnlink?.name || 'this parent'} from {student.first_name} {student.last_name}.
							</AlertDialogDescription>
						</AlertDialogHeader>
						<AlertDialogFooter>
							<AlertDialogCancel>Cancel</AlertDialogCancel>
							<AlertDialogAction onClick={handleUnlinkParent} disabled={isUnlinkingParent}>
								{isUnlinkingParent ? 'Removing…' : 'Remove parent'}
							</AlertDialogAction>
						</AlertDialogFooter>
					</AlertDialogContent>
				</AlertDialog>

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
							<select id="transferClassSelect" ref={transferClassSelectRef} value={transferTargetClassId} onChange={(e) => setTransferTargetClassId(e.target.value)} className="w-full mt-4 px-3 py-2 border rounded" aria-label="Target class">
								<option value="">Select class</option>
								{classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
							</select>
							<div className="flex justify-end gap-2 mt-4">
								<Button variant="outline" onClick={() => { setIsTransferOpen(false); setTransferTargetClassId(''); }}>Cancel</Button>
								<Button onClick={() => setIsTransferConfirmOpen(true)} disabled={!transferTargetClassId} aria-label="Confirm transfer">Transfer</Button>
							</div>
						</div>
					</DialogContent>
				</Dialog>

				{/* Transfer confirmation */}
				<AlertDialog open={isTransferConfirmOpen} onOpenChange={(open) => { setIsTransferConfirmOpen(open); if (!open) setTransferError(''); }}>
					<AlertDialogContent>
						<AlertDialogHeader>
							<AlertDialogTitle>Confirm transfer</AlertDialogTitle>
							<AlertDialogDescription>
								Move {student.first_name} {student.last_name} to {classes.find((c) => c.id === transferTargetClassId)?.name || 'the selected class'}?
							</AlertDialogDescription>
						</AlertDialogHeader>
						{transferError ? (
							<div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{transferError}</div>
						) : null}
						<AlertDialogFooter>
							<AlertDialogCancel>Cancel</AlertDialogCancel>
							<AlertDialogAction id="transfer-confirm-btn" onClick={async () => {
								setTransferError('');
								setIsTransferring(true);
								try {
									const result = await handleTransfer();
									if (result.success) {
										toast.success(result.data?.message || 'Student transferred');
										setIsTransferConfirmOpen(false);
										setIsTransferOpen(false);
										setTransferTargetClassId('');
										await loadData();
									} else {
										setTransferError(result.error || 'Transfer failed');
									}
								} catch (err: any) {
									setTransferError(err?.message || 'Transfer failed');
								} finally {
									setIsTransferring(false);
								}
							}} disabled={isTransferring}>{isTransferring ? 'Transferring…' : 'Confirm transfer'}</AlertDialogAction>
						</AlertDialogFooter>
					</AlertDialogContent>
				</AlertDialog>

				<AlertDialog open={isResetConfirmOpen} onOpenChange={setIsResetConfirmOpen}>
					<AlertDialogContent>
						<AlertDialogHeader>
							<AlertDialogTitle>Send password reset email?</AlertDialogTitle>
							<AlertDialogDescription>
								A reset link will be sent to {student.email} and the student will need to use it to set a new password.
							</AlertDialogDescription>
						</AlertDialogHeader>
						<AlertDialogFooter>
							<AlertDialogCancel>Cancel</AlertDialogCancel>
							<AlertDialogAction onClick={handleResetConfirmed}>Send reset email</AlertDialogAction>
						</AlertDialogFooter>
					</AlertDialogContent>
				</AlertDialog>

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

							{emailStep === 'success' ? (
								<div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 space-y-3">
									<div className="flex items-start gap-3">
										<CheckCircle2 className="h-5 w-5 text-emerald-600 mt-0.5" />
										<div>
											<p className="font-semibold text-emerald-900">Email updated successfully</p>
											<p className="text-sm text-emerald-800">{emailChangeSuccess}</p>
											<p className="text-sm text-emerald-800 mt-1">New login email: {newEmail}</p>
										</div>
									</div>
									<div className="flex justify-end">
										<Button onClick={closeEmailChangeDialog} className="rounded-xl">Done</Button>
									</div>
								</div>
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
								<Button variant="destructive" onClick={() => setIsResetConfirmOpen(true)} disabled={isResettingPassword} className="w-full rounded-xl">
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

						<Card className="border-red-200 bg-white shadow-sm">
							<CardHeader className="space-y-2">
								<div className="flex items-center gap-2">
									<PencilLine className="h-4 w-4 text-red-600" />
									<CardTitle className="text-base text-slate-900">Edit Student</CardTitle>
								</div>
								<p className="text-sm text-slate-500">Open the edit modal to update profile details and contact info.</p>
							</CardHeader>
							<CardContent>
								<Button onClick={() => setIsEditOpen(true)} className="w-full rounded-xl bg-indigo-600 text-white hover:bg-indigo-700">
									Open Edit Modal
								</Button>
							</CardContent>
						</Card>

						<Card className="border-red-200 bg-white shadow-sm">
							<CardHeader className="space-y-2">
								<div className="flex items-center gap-2">
									<MoveRight className="h-4 w-4 text-red-600" />
									<CardTitle className="text-base text-slate-900">Transfer Student</CardTitle>
								</div>
								<p className="text-sm text-slate-500">Move this student to another class using the transfer dialog.</p>
							</CardHeader>
							<CardContent>
								<Button variant="outline" onClick={() => setIsTransferOpen(true)} className="w-full rounded-xl border-red-200 text-red-700 hover:bg-red-50">
									Open Transfer Dialog
								</Button>
							</CardContent>
						</Card>

						<Card className="border-red-200 bg-white shadow-sm">
							<CardHeader className="space-y-2">
								<div className="flex items-center gap-2">
									<Trash2 className="h-4 w-4 text-red-600" />
									<CardTitle className="text-base text-slate-900">Delete Student</CardTitle>
								</div>
								<p className="text-sm text-slate-500">Permanently remove this student and their linked auth record.</p>
							</CardHeader>
							<CardContent>
								<Button variant="destructive" onClick={handleDelete} disabled={isDeleting} className="w-full rounded-xl">
									{isDeleting ? 'Deleting…' : 'Delete Student'}
								</Button>
							</CardContent>
						</Card>
					</CardContent>
				</Card>
			</main>
		</DashboardLayout>
	);
}

