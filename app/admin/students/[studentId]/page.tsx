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
import { 
	ArrowLeft, Calendar, Mail, Phone, User, Hash, Trash2, Users, ShieldAlert, 
	RefreshCcw, KeyRound, CheckCircle2, PencilLine, MoveRight, Search, Loader2, 
	UserPlus, Settings, BookOpen, Zap, Award, Clock
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
	const [selectedDepartmentId, setSelectedDepartmentId] = useState('');
	const [selectedReligionId, setSelectedReligionId] = useState('');
	const [isSavingAcademicProfile, setIsSavingAcademicProfile] = useState(false);

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

				setLinkParentResults(payload.data);
				setLinkParentHasMore(payload.hasMore);
				setLinkParentError('');
			} catch (err: any) {
				if (err.name === 'AbortError' || cancelled) return;
				setLinkParentError((err as Error).message);
			} finally {
				setLinkParentLoading(false);
			}
		}

		const timer = setTimeout(() => searchParents(), 300);

		return () => {
			cancelled = true;
			clearTimeout(timer);
		};
	}, [linkParentSearch, isLinkParentOpen, studentId]);

	const loadData = async () => {
		setLoading(true);
		try {
			const res = await fetch(`/api/admin/students/${studentId}`);
			const payload = await res.json();

			if (!res.ok) {
				throw new Error(payload?.error || 'Failed to load student data');
			}

			// Support APIs that return a flat `data` object or explicit fields
			const data = payload.data || payload;

			setStudent(data.student ?? null);
			setSessions(data.sessions ?? []);
			setTerms(data.terms ?? []);
			setClasses(data.classes ?? []);
			setDepartments(data.departments ?? []);
			setReligions(data.religions ?? []);
			setAttendance(data.attendance ?? []);
			setStudentResults(data.results ?? []);
			setGuardians(data.guardians ?? []);
		} catch (err: any) {
			console.error('loadData error', err);
			toast.error(err?.message || 'Unable to load student data');
		} finally {
			setLoading(false);
		}
	};

	const handleResetConfirmed = async () => {
		setIsResetConfirmOpen(false);
		setIsResettingPassword(true);
		try {
			const res = await fetch(`/api/admin/students/${studentId}/send-reset`, { method: 'POST' });
			const payload = await res.json();
			if (!res.ok || !payload.success) throw new Error(payload?.error || 'Failed to send reset email');
			toast.success('Reset email sent');
		} catch (err: any) {
			console.error(err);
			toast.error(err?.message || 'Failed to send reset email');
		} finally {
			setIsResettingPassword(false);
		}
	};

	const closeEmailChangeDialog = () => {
		setIsEmailChangeOpen(false);
		setEmailStep('email');
		setNewEmail('');
		setVerificationCode('');
		setEmailChangeError('');
		setEmailChangeSuccess('');
	};

	const openEmailChangeDialog = () => {
		setIsEmailChangeOpen(true);
	};

	const handleSendEmailCode = async () => {
		if (!newEmail || !newEmail.includes('@')) {
			setEmailChangeError('Please enter a valid email address');
			return;
		}

		setIsSendingCode(true);
		setEmailChangeError('');
		try {
			const res = await fetch(`/api/admin/students/${studentId}/send-email-code`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ email: newEmail }),
			});
			const payload = await res.json();
			if (!res.ok || !payload.success) throw new Error(payload?.error || 'Failed to send verification code');
			setEmailStep('code');
			toast.success('Verification code sent');
		} catch (err: any) {
			console.error(err);
			setEmailChangeError(err?.message || 'Failed to send code');
		} finally {
			setIsSendingCode(false);
		}
	};

	const handleVerifyAndApplyEmailChange = async () => {
		if (verificationCode.length !== 6) {
			setEmailChangeError('Enter the 6-digit verification code');
			return;
		}

		setIsVerifyingCode(true);
		setIsApplyingEmailChange(true);
		setEmailChangeError('');
		try {
			const res = await fetch(`/api/admin/students/${studentId}/verify-email-code`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ email: newEmail, code: verificationCode }),
			});
			const payload = await res.json();
			if (!res.ok || !payload.success) throw new Error(payload?.error || 'Verification failed');
			setEmailChangeSuccess('Email updated');
			setEmailStep('success');
			// Refresh student data
			await loadData();
			toast.success('Student email updated');
		} catch (err: any) {
			console.error(err);
			setEmailChangeError(err?.message || 'Failed to verify code');
		} finally {
			setIsVerifyingCode(false);
			setIsApplyingEmailChange(false);
		}
	};

	const handleDelete = async () => {
		if (!confirm('Are you sure you want to permanently delete this student?')) return;
		setIsDeleting(true);
		try {
			const res = await fetch(`/api/admin/students/${studentId}`, { method: 'DELETE' });
			const payload = await res.json();
			if (!res.ok || !payload.success) throw new Error(payload?.error || 'Failed to delete student');
			toast.success('Student deleted');
			router.push('/admin/students');
		} catch (err: any) {
			console.error(err);
			toast.error(err?.message || 'Failed to delete student');
		} finally {
			setIsDeleting(false);
		}
	};

	if (loading) {
		return (
			<DashboardLayout role='admin'>
				<main className="flex items-center justify-center min-h-screen">
					<Loader2 className="h-8 w-8 animate-spin text-slate-400" />
				</main>
			</DashboardLayout>
		);
	}

	if (!student) {
		return (
			<DashboardLayout role='admin'>
				<main className="p-6">
					<div className="rounded-2xl border border-slate-200 bg-slate-50 p-8 text-center">
						<User className="mx-auto h-12 w-12 text-slate-300 mb-3" />
						<p className="text-slate-600 font-medium">Student not found</p>
					</div>
				</main>
			</DashboardLayout>
		);
	}

	return (
		<DashboardLayout role='admin'>
			<main className="flex-1 bg-gradient-to-br from-slate-50 to-slate-100/50 min-h-screen">
				{/* Header Section */}
				<div className="border-b border-slate-200 bg-white shadow-sm">
					<div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
						{/* Back Button */}
						<Link href="/admin/students" className="mb-6 inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors">
							<ArrowLeft className="h-4 w-4" />
							Back to Students
						</Link>

						{/* Student Hero Card */}
						<div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
							<div className="flex gap-4 sm:gap-6">
								<div className="relative">
									<Avatar className="h-20 w-20 sm:h-24 sm:w-24 ring-4 ring-indigo-100">
										<AvatarImage src={student.photo_url || undefined} alt={student.first_name} />
										<AvatarFallback className="bg-gradient-to-br from-indigo-400 to-purple-500 text-white text-lg font-semibold">
											{(student.first_name?.[0] || '') + (student.last_name?.[0] || '')}
										</AvatarFallback>
									</Avatar>
									<div className="absolute bottom-0 right-0 h-5 w-5 rounded-full border-2 border-white bg-emerald-500"></div>
								</div>
								<div className="flex flex-col justify-end gap-2 pb-1">
									<div>
										<h1 className="text-2xl font-bold text-slate-900">
											{student.first_name} {student.last_name}
										</h1>
										<p className="text-sm text-slate-500 font-medium">Student ID: {studentId.slice(0, 8)}</p>
									</div>
									<div className="flex flex-wrap gap-2">
										<Badge className="bg-indigo-100 text-indigo-700 border-0 font-medium">
											{classes.find(c => c.id === student.class_id)?.name || '—'}
										</Badge>
										{student.status === 'active' ? (
											<Badge className="bg-emerald-100 text-emerald-700 border-0">Active</Badge>
										) : (
											<Badge className="bg-slate-100 text-slate-700 border-0">Inactive</Badge>
										)}
									</div>
								</div>
							</div>

							{/* Quick Action Buttons */}
							<div className="flex gap-2 flex-wrap sm:flex-nowrap sm:justify-end">
								<Button 
									onClick={() => setIsEditOpen(true)} 
									className="gap-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-medium"
								>
									<PencilLine className="h-4 w-4" />
									Edit Profile
								</Button>
								<Button 
									variant="outline"
									onClick={() => setIsLinkParentOpen(true)}
									className="gap-2 rounded-xl font-medium border-slate-200"
								>
									<UserPlus className="h-4 w-4" />
									Add Guardian
								</Button>
							</div>
						</div>
					</div>
				</div>

				{/* Main Content */}
				<div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8 space-y-8">
					{/* Contact & Personal Info Section */}
					<div className="grid gap-6 md:grid-cols-2">
						{/* Contact Information */}
						<Card className="border-slate-200 shadow-sm hover:shadow-md transition-shadow">
							<CardHeader className="pb-4">
								<div className="flex items-center gap-3">
									<div className="rounded-lg bg-blue-100 p-2">
										<Mail className="h-5 w-5 text-blue-600" />
									</div>
									<CardTitle className="text-lg">Contact Information</CardTitle>
								</div>
							</CardHeader>
							<CardContent className="space-y-4">
								<div>
									<p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Email</p>
									<p className="text-sm text-slate-900 font-medium mt-1 break-all">{student.email}</p>
								</div>
								<div>
									<p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Phone</p>
									<p className="text-sm text-slate-900 font-medium mt-1">{student.phone || '—'}</p>
								</div>
								<div>
									<p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Date of Birth</p>
									<p className="text-sm text-slate-900 font-medium mt-1">
										{student.date_of_birth ? new Date(student.date_of_birth).toLocaleDateString() : '—'}
									</p>
								</div>
								<Button 
									variant="ghost" 
									onClick={() => setIsEmailChangeOpen(true)}
									className="w-full justify-start gap-2 text-indigo-600 hover:bg-indigo-50 mt-2 rounded-lg"
								>
									<KeyRound className="h-4 w-4" />
									Change Email
								</Button>
							</CardContent>
						</Card>

						{/* Academic Profile */}
						<Card className="border-slate-200 shadow-sm hover:shadow-md transition-shadow">
							<CardHeader className="pb-4">
								<div className="flex items-center gap-3">
									<div className="rounded-lg bg-purple-100 p-2">
										<BookOpen className="h-5 w-5 text-purple-600" />
									</div>
									<CardTitle className="text-lg">Academic Profile</CardTitle>
								</div>
							</CardHeader>
							<CardContent className="space-y-4">
								<div>
									<p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Department</p>
									<select 
										value={selectedDepartmentId} 
										onChange={(e) => setSelectedDepartmentId(e.target.value)}
										className="w-full mt-1 text-sm px-3 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-purple-500"
									>
										<option value="">Select Department</option>
										{departments.map((dept) => (
											<option key={dept.id} value={dept.id}>{dept.name}</option>
										))}
									</select>
								</div>
								<div>
									<p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Religion</p>
									<select 
										value={selectedReligionId} 
										onChange={(e) => setSelectedReligionId(e.target.value)}
										className="w-full mt-1 text-sm px-3 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-purple-500"
									>
										<option value="">Select Religion</option>
										{religions.map((rel) => (
											<option key={rel.id} value={rel.id}>{rel.name}</option>
										))}
									</select>
								</div>
								<Button 
									onClick={() => setIsSavingAcademicProfile(true)}
									disabled={isSavingAcademicProfile}
									className="w-full bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium mt-2"
								>
									{isSavingAcademicProfile ? 'Saving…' : 'Save Changes'}
								</Button>
							</CardContent>
						</Card>
					</div>

					{/* Guardians Section */}
					<Card className="border-slate-200 shadow-sm">
						<CardHeader className="pb-4 border-b border-slate-100">
							<div className="flex items-center justify-between">
								<div className="flex items-center gap-3">
									<div className="rounded-lg bg-pink-100 p-2">
										<Users className="h-5 w-5 text-pink-600" />
									</div>
									<div>
										<CardTitle className="text-lg">Guardians & Contacts</CardTitle>
										<p className="text-xs text-slate-500 mt-1">{guardians.length} guardian{guardians.length !== 1 ? 's' : ''} linked</p>
									</div>
								</div>
								<Button 
									onClick={() => setIsLinkParentOpen(true)}
									size="sm"
									className="gap-2 bg-pink-600 hover:bg-pink-700 text-white rounded-lg"
								>
									<UserPlus className="h-4 w-4" />
									Add
								</Button>
							</div>
						</CardHeader>
						<CardContent className="pt-6">
							{guardians.length === 0 ? (
								<div className="text-center py-8">
									<Users className="h-12 w-12 text-slate-200 mx-auto mb-3" />
									<p className="text-slate-500 text-sm font-medium">No guardians linked yet</p>
									<Button 
										onClick={() => setIsLinkParentOpen(true)}
										variant="outline"
										className="mt-4 rounded-lg"
									>
										Link First Guardian
									</Button>
								</div>
							) : (
								<div className="space-y-3">
									{guardians.map((guardian) => (
										<div key={guardian.id} className="rounded-lg border border-slate-100 bg-slate-50 p-4 flex items-start justify-between hover:bg-slate-100 transition-colors">
											<div className="flex gap-3 flex-1">
												<Avatar className="h-10 w-10 ring-2 ring-slate-200 flex-shrink-0">
													<AvatarFallback className="bg-gradient-to-br from-pink-300 to-rose-400 text-white text-xs font-semibold">
														{(guardian.name?.[0] || '?').toUpperCase()}
													</AvatarFallback>
												</Avatar>
												<div className="flex-1 min-w-0">
													<p className="font-medium text-slate-900">{guardian.name}</p>
													<p className="text-xs text-slate-500">{guardian.relationship_type}</p>
													{guardian.email && <p className="text-xs text-slate-500 truncate">{guardian.email}</p>}
													<div className="flex gap-1 mt-2 flex-wrap">
														{guardian.is_primary_contact && (
															<Badge className="bg-amber-100 text-amber-700 text-xs border-0">Primary</Badge>
														)}
														{guardian.has_legal_custody && (
															<Badge className="bg-indigo-100 text-indigo-700 text-xs border-0">Legal Custody</Badge>
														)}
														{guardian.can_pickup && (
															<Badge className="bg-emerald-100 text-emerald-700 text-xs border-0">Can Pickup</Badge>
														)}
													</div>
												</div>
											</div>
											<Button 
												variant="ghost"
												size="sm"
												onClick={() => {
													setGuardianToUnlink(guardian);
													setIsUnlinkConfirmOpen(true);
												}}
												className="text-red-600 hover:bg-red-50 rounded-lg ml-2 flex-shrink-0"
											>
												<Trash2 className="h-4 w-4" />
											</Button>
										</div>
									))}
								</div>
							)}
						</CardContent>
					</Card>

					{/* Academic Performance & Attendance */}
					<Tabs defaultValue="results" className="space-y-6">
						<TabsList className="bg-slate-200 rounded-xl p-1">
							<TabsTrigger value="results" className="gap-2 rounded-lg">
								<Award className="h-4 w-4" />
								Academic Results
							</TabsTrigger>
							<TabsTrigger value="attendance" className="gap-2 rounded-lg">
								<Clock className="h-4 w-4" />
								Attendance
							</TabsTrigger>
						</TabsList>

						{/* Results Tab */}
						<TabsContent value="results">
							<Card className="border-slate-200 shadow-sm">
								<CardHeader className="pb-4 border-b border-slate-100">
									<div className="flex items-center gap-3">
										<div className="rounded-lg bg-amber-100 p-2">
											<Award className="h-5 w-5 text-amber-600" />
										</div>
										<div>
											<CardTitle>Academic Results</CardTitle>
											<p className="text-xs text-slate-500 mt-1">Performance across all subjects and terms</p>
										</div>
									</div>
								</CardHeader>
								<CardContent className="pt-6 overflow-x-auto">
									{studentResults.length > 0 ? (
										<ResultsTable results={studentResults} />
									) : (
										<div className="text-center py-8">
											<Award className="h-12 w-12 text-slate-200 mx-auto mb-3" />
											<p className="text-slate-500 text-sm font-medium">No results recorded yet</p>
										</div>
									)}
								</CardContent>
							</Card>
						</TabsContent>

						{/* Attendance Tab */}
						<TabsContent value="attendance">
							<Card className="border-slate-200 shadow-sm">
								<CardHeader className="pb-4 border-b border-slate-100">
									<div className="flex items-center justify-between">
										<div className="flex items-center gap-3">
											<div className="rounded-lg bg-teal-100 p-2">
												<Clock className="h-5 w-5 text-teal-600" />
											</div>
											<div>
												<CardTitle>Attendance Record</CardTitle>
												<p className="text-xs text-slate-500 mt-1">Track presence over time</p>
											</div>
										</div>
										<select 
											value={attendancePeriod}
											onChange={(e) => setAttendancePeriod(e.target.value as any)}
											className="text-sm px-3 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500"
										>
											<option value="daily">Daily</option>
											<option value="weekly">Weekly</option>
											<option value="monthly">Monthly</option>
											<option value="term">Term</option>
											<option value="session">Session</option>
										</select>
									</div>
								</CardHeader>
								<CardContent className="pt-6">
									{attendance.length > 0 ? (
										<AttendanceTimeline 
											attendance={filterAttendanceByPeriod(attendance, attendancePeriod)}
										/>
									) : (
										<div className="text-center py-8">
											<Calendar className="h-12 w-12 text-slate-200 mx-auto mb-3" />
											<p className="text-slate-500 text-sm font-medium">No attendance records yet</p>
										</div>
									)}
								</CardContent>
							</Card>
						</TabsContent>
					</Tabs>

					{/* Danger Zone */}
					<Card className="border-red-200 bg-red-50/30">
						<CardHeader className="pb-4 border-b border-red-100">
							<div className="flex items-center gap-3">
								<div className="rounded-lg bg-red-100 p-2">
									<ShieldAlert className="h-5 w-5 text-red-600" />
								</div>
								<div>
									<CardTitle className="text-red-900">Danger Zone</CardTitle>
									<p className="text-xs text-red-700/70 mt-1 font-medium">Advanced account management – use with caution</p>
								</div>
							</div>
						</CardHeader>
						<CardContent className="pt-6">
							<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
								{/* Reset Password Card */}
								<Card className="border-red-200/50 bg-white shadow-sm hover:shadow-md transition-shadow">
									<CardHeader className="pb-3">
										<div className="flex items-center gap-2">
											<RefreshCcw className="h-5 w-5 text-red-600" />
											<CardTitle className="text-base">Reset Password</CardTitle>
										</div>
										<p className="text-xs text-slate-600 mt-2">Send reset link to current email</p>
									</CardHeader>
									<CardContent>
										<Button 
											variant="destructive" 
											onClick={() => setIsResetConfirmOpen(true)}
											disabled={isResettingPassword}
											className="w-full rounded-lg font-medium"
										>
											{isResettingPassword ? 'Sending…' : 'Send Reset Link'}
										</Button>
									</CardContent>
								</Card>

								{/* Change Email Card */}
								<Card className="border-red-200/50 bg-white shadow-sm hover:shadow-md transition-shadow">
									<CardHeader className="pb-3">
										<div className="flex items-center gap-2">
											<Mail className="h-5 w-5 text-red-600" />
											<CardTitle className="text-base">Change Email</CardTitle>
										</div>
										<p className="text-xs text-slate-600 mt-2">Update with verification code</p>
									</CardHeader>
									<CardContent>
										<Button 
											variant="outline"
											onClick={openEmailChangeDialog}
											className="w-full rounded-lg font-medium border-red-200 text-red-700 hover:bg-red-50"
										>
											Change Email
										</Button>
									</CardContent>
								</Card>

								{/* Transfer Student Card */}
								<Card className="border-red-200/50 bg-white shadow-sm hover:shadow-md transition-shadow">
									<CardHeader className="pb-3">
										<div className="flex items-center gap-2">
											<MoveRight className="h-5 w-5 text-red-600" />
											<CardTitle className="text-base">Transfer Class</CardTitle>
										</div>
										<p className="text-xs text-slate-600 mt-2">Move to another class</p>
									</CardHeader>
									<CardContent>
										<Button 
											variant="outline"
											onClick={() => setIsTransferOpen(true)}
											className="w-full rounded-lg font-medium border-red-200 text-red-700 hover:bg-red-50"
										>
											Transfer
										</Button>
									</CardContent>
								</Card>

								{/* Delete Student Card */}
								<Card className="border-red-200/50 bg-white shadow-sm hover:shadow-md transition-shadow md:col-span-2 lg:col-span-1">
									<CardHeader className="pb-3">
										<div className="flex items-center gap-2">
											<Trash2 className="h-5 w-5 text-red-600" />
											<CardTitle className="text-base">Delete Student</CardTitle>
										</div>
										<p className="text-xs text-slate-600 mt-2">Permanently remove record</p>
									</CardHeader>
									<CardContent>
										<Button 
											variant="destructive"
											onClick={handleDelete}
											disabled={isDeleting}
											className="w-full rounded-lg font-medium"
										>
											{isDeleting ? 'Deleting…' : 'Delete'}
										</Button>
									</CardContent>
								</Card>
							</div>
						</CardContent>
					</Card>
				</div>

				{/* Edit Student Modal */}
				<EditStudentModal
					isOpen={isEditOpen}
					onClose={() => setIsEditOpen(false)}
					student={student}
					onSuccess={() => {
						setIsEditOpen(false);
						loadData();
					}}
				/>

				{/* Transfer Dialog */}
				<Dialog open={isTransferOpen} onOpenChange={setIsTransferOpen}>
					<DialogContent className="sm:max-w-md rounded-2xl">
						<DialogHeader>
							<DialogTitle className="text-lg">Transfer Student to Another Class</DialogTitle>
						</DialogHeader>

						{transferError && (
							<div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
								{transferError}
							</div>
						)}

						<div className="space-y-4">
							<div>
								<Label htmlFor="transfer-class" className="text-sm font-medium">Select Destination Class</Label>
								<select
									ref={transferClassSelectRef}
									id="transfer-class"
									value={transferTargetClassId}
									onChange={(e) => setTransferTargetClassId(e.target.value)}
									className="w-full mt-2 px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
								>
									<option value="">Choose a class…</option>
									{classes.map((cls) => (
										<option key={cls.id} value={cls.id}>{cls.name}</option>
									))}
								</select>
							</div>

							<div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
								<p className="font-medium mb-1">Note:</p>
								<p>The student's current class assignment will be updated. All academic records will remain intact.</p>
							</div>

							<div className="flex gap-2 justify-end">
								<Button variant="outline" onClick={() => setIsTransferOpen(false)} className="rounded-lg">
									Cancel
								</Button>
								<Button 
									onClick={() => setIsTransferConfirmOpen(true)}
									disabled={!transferTargetClassId || isTransferring}
									className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg"
								>
									{isTransferring ? 'Transferring…' : 'Next'}
								</Button>
							</div>
						</div>
					</DialogContent>
				</Dialog>

				{/* Transfer Confirmation Dialog */}
				<AlertDialog open={isTransferConfirmOpen} onOpenChange={setIsTransferConfirmOpen}>
					<AlertDialogContent className="rounded-2xl">
						<AlertDialogHeader>
							<AlertDialogTitle>Confirm Transfer</AlertDialogTitle>
							<AlertDialogDescription>
								Are you sure you want to transfer {student.first_name} to {classes.find(c => c.id === transferTargetClassId)?.name}? This cannot be undone.
							</AlertDialogDescription>
						</AlertDialogHeader>
						<AlertDialogFooter>
							<AlertDialogCancel className="rounded-lg">Cancel</AlertDialogCancel>
							<AlertDialogAction id="transfer-confirm-btn" className="bg-indigo-600 hover:bg-indigo-700 rounded-lg">
								Confirm Transfer
							</AlertDialogAction>
						</AlertDialogFooter>
					</AlertDialogContent>
				</AlertDialog>

				{/* Link Parent Dialog */}
				<Dialog open={isLinkParentOpen} onOpenChange={setIsLinkParentOpen}>
					<DialogContent className="sm:max-w-lg rounded-2xl max-h-[80vh] overflow-y-auto">
						<DialogHeader>
							<DialogTitle className="text-lg">Link a Guardian</DialogTitle>
						</DialogHeader>

						{linkParentError && (
							<div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
								{linkParentError}
							</div>
						)}

						<div className="space-y-4">
							{/* Search */}
							<div className="relative">
								<Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 pointer-events-none" />
								<Input
									ref={linkParentSearchRef}
									type="text"
									placeholder="Search by name or email…"
									value={linkParentSearch}
									onChange={(e) => setLinkParentSearch(e.target.value)}
									className="pl-10 rounded-lg border-slate-200"
								/>
							</div>

							{/* Results */}
							{linkParentResults.length > 0 && (
								<div className="space-y-2 max-h-48 overflow-y-auto">
									{linkParentResults.map((parent) => (
										<div
											key={parent.id}
											onClick={() => setSelectedLinkParentId(parent.id)}
											className={`rounded-lg border-2 p-3 cursor-pointer transition-all ${
												selectedLinkParentId === parent.id
													? 'border-indigo-500 bg-indigo-50'
													: 'border-slate-200 hover:border-slate-300 bg-white'
											}`}
										>
											<p className="font-medium text-sm text-slate-900">{parent.name}</p>
											<p className="text-xs text-slate-600">{parent.email}</p>
											{parent.phone && <p className="text-xs text-slate-600">{parent.phone}</p>}
										</div>
									))}
								</div>
							)}

							{/* Relationship Details */}
							{selectedLinkParentId && (
								<div className="space-y-4 border-t pt-4">
									<div>
										<Label htmlFor="relationship" className="text-sm font-medium">Relationship Type</Label>
										<select
											id="relationship"
											value={linkRelationshipType}
											onChange={(e) => setLinkRelationshipType(e.target.value)}
											className="w-full mt-2 px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
										>
											<option value="Guardian">Guardian</option>
											<option value="Parent">Parent</option>
											<option value="Grandparent">Grandparent</option>
											<option value="Uncle/Aunt">Uncle/Aunt</option>
											<option value="Other">Other</option>
										</select>
									</div>

									{linkRelationshipType === 'Other' && (
										<div>
											<Label htmlFor="custom-relation" className="text-sm font-medium">Specify Relationship</Label>
											<Input
												id="custom-relation"
												value={linkRelationshipCustom}
												onChange={(e) => setLinkRelationshipCustom(e.target.value)}
												placeholder="e.g., Family Friend"
												className="mt-2 rounded-lg"
											/>
										</div>
									)}

									<div className="space-y-3 rounded-lg border border-slate-100 bg-slate-50 p-4">
										<label className="flex items-center gap-3 cursor-pointer">
											<input
												type="checkbox"
												checked={linkIsPrimaryContact}
												onChange={(e) => setLinkIsPrimaryContact(e.target.checked)}
												className="rounded"
											/>
											<span className="text-sm font-medium text-slate-900">Primary Contact</span>
										</label>
										<label className="flex items-center gap-3 cursor-pointer">
											<input
												type="checkbox"
												checked={linkHasLegalCustody}
												onChange={(e) => setLinkHasLegalCustody(e.target.checked)}
												className="rounded"
											/>
											<span className="text-sm font-medium text-slate-900">Has Legal Custody</span>
										</label>
										<label className="flex items-center gap-3 cursor-pointer">
											<input
												type="checkbox"
												checked={linkCanPickup}
												onChange={(e) => setLinkCanPickup(e.target.checked)}
												className="rounded"
											/>
											<span className="text-sm font-medium text-slate-900">Can Pickup Student</span>
										</label>
									</div>

									<div className="flex gap-2 justify-end">
										<Button variant="outline" onClick={() => setIsLinkParentOpen(false)} className="rounded-lg">
											Cancel
										</Button>
										<Button 
											onClick={async () => {
												// Link parent implementation
												setIsLinkParentOpen(false);
											}}
											disabled={isLinkingParent}
											className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg"
										>
											{isLinkingParent ? 'Linking…' : 'Link Guardian'}
										</Button>
									</div>
								</div>
							)}

							{!selectedLinkParentId && linkParentSearch && linkParentResults.length === 0 && !linkParentLoading && (
								<div className="text-center py-6">
									<Users className="h-8 w-8 text-slate-200 mx-auto mb-2" />
									<p className="text-sm text-slate-500">No guardians found matching your search</p>
								</div>
							)}

							{linkParentLoading && (
								<div className="flex justify-center py-6">
									<Loader2 className="h-5 w-5 animate-spin text-slate-400" />
								</div>
							)}
						</div>
					</DialogContent>
				</Dialog>

				{/* Unlink Confirmation */}
				<AlertDialog open={isUnlinkConfirmOpen} onOpenChange={setIsUnlinkConfirmOpen}>
					<AlertDialogContent className="rounded-2xl">
						<AlertDialogHeader>
							<AlertDialogTitle>Remove Guardian</AlertDialogTitle>
							<AlertDialogDescription>
								Are you sure you want to unlink {guardianToUnlink?.name} from this student? This cannot be undone.
							</AlertDialogDescription>
						</AlertDialogHeader>
						<AlertDialogFooter>
							<AlertDialogCancel className="rounded-lg">Cancel</AlertDialogCancel>
							<AlertDialogAction className="bg-red-600 hover:bg-red-700 rounded-lg">
								Remove Guardian
							</AlertDialogAction>
						</AlertDialogFooter>
					</AlertDialogContent>
				</AlertDialog>

				{/* Password Reset Confirmation */}
				<AlertDialog open={isResetConfirmOpen} onOpenChange={setIsResetConfirmOpen}>
					<AlertDialogContent className="rounded-2xl">
						<AlertDialogHeader>
							<AlertDialogTitle>Send Password Reset Email</AlertDialogTitle>
							<AlertDialogDescription>
								A reset link will be sent to <span className="font-semibold">{student.email}</span>. The student will need to use it to set a new password.
							</AlertDialogDescription>
						</AlertDialogHeader>
						<AlertDialogFooter>
							<AlertDialogCancel className="rounded-lg">Cancel</AlertDialogCancel>
							<AlertDialogAction onClick={handleResetConfirmed} className="bg-red-600 hover:bg-red-700 rounded-lg">
								Send Reset Email
							</AlertDialogAction>
						</AlertDialogFooter>
					</AlertDialogContent>
				</AlertDialog>

				{/* Email Change Dialog */}
				<Dialog open={isEmailChangeOpen} onOpenChange={(open) => (open ? setIsEmailChangeOpen(true) : closeEmailChangeDialog())}>
					<DialogContent className="sm:max-w-lg rounded-2xl">
						<DialogHeader>
							<DialogTitle className="text-lg font-bold text-slate-900">Change Student Email</DialogTitle>
						</DialogHeader>

						<div className="space-y-4">
							<div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 font-medium">
								A 6-digit code will be sent to verify the new email address.
							</div>

							{emailChangeError && (
								<div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
									{emailChangeError}
								</div>
							)}

							{emailStep === 'success' ? (
								<div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 space-y-3">
									<div className="flex items-start gap-3">
										<CheckCircle2 className="h-5 w-5 text-emerald-600 flex-shrink-0 mt-0.5" />
										<div>
											<p className="font-semibold text-emerald-900">Email Updated Successfully</p>
											<p className="text-sm text-emerald-800 mt-1">New login email: <span className="font-medium">{newEmail}</span></p>
										</div>
									</div>
									<Button onClick={closeEmailChangeDialog} className="w-full bg-emerald-600 hover:bg-emerald-700 rounded-lg">
										Done
									</Button>
								</div>
							) : null}

							{emailStep === 'email' ? (
								<div className="space-y-3">
									<div>
										<Label htmlFor="newEmail" className="text-sm font-medium">New Email Address</Label>
										<Input
											id="newEmail"
											type="email"
											value={newEmail}
											onChange={(e) => setNewEmail(e.target.value)}
											placeholder="student.new@email.com"
											className="mt-2 rounded-lg"
										/>
									</div>
									<div className="flex gap-2 justify-end">
										<Button variant="outline" onClick={closeEmailChangeDialog} className="rounded-lg">Cancel</Button>
										<Button onClick={handleSendEmailCode} disabled={isSendingCode} className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg">
											{isSendingCode ? 'Sending code…' : 'Send Code'}
										</Button>
									</div>
								</div>
							) : (
								<div className="space-y-3">
									<div>
										<Label htmlFor="verificationCode" className="text-sm font-medium">6-Digit Verification Code</Label>
										<Input
											id="verificationCode"
											inputMode="numeric"
											maxLength={6}
											value={verificationCode}
											onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
											placeholder="123456"
											className="mt-2 rounded-lg text-center text-lg tracking-widest"
										/>
									</div>
									<p className="text-sm text-slate-500">Code sent to {newEmail}</p>
									<div className="flex justify-between gap-2">
										<Button variant="ghost" onClick={() => setEmailStep('email')} className="rounded-lg">Back</Button>
										<div className="flex gap-2">
											<Button variant="outline" onClick={closeEmailChangeDialog} className="rounded-lg">Cancel</Button>
											<Button onClick={handleVerifyAndApplyEmailChange} disabled={isVerifyingCode || isApplyingEmailChange} className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg">
												{isVerifyingCode || isApplyingEmailChange ? 'Updating…' : 'Verify & Update'}
											</Button>
										</div>
									</div>
								</div>
							)}
						</div>
					</DialogContent>
				</Dialog>
			</main>
		</DashboardLayout>
	);
}