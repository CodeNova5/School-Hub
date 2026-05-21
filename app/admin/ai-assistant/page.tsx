"use client";

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { MessageSquare, Plus, Settings, LogOut, Loader2 } from 'lucide-react';
import AIAssistantSidebar from '@/components/ai-assistant-sidebar';
import { supabase } from '@/lib/supabase';
import AIAssistantChat from '@/components/ai-assistant-chat';
import { Button } from '@/components/ui/button';

export default function AdminAIAssistantLandingPage() {
	const router = useRouter();
	const redirectingRef = useRef(false);

	const [isLoading, setIsLoading] = useState(true);
	const [sessions, setSessions] = useState([]);
	const [archivedSessions, setArchivedSessions] = useState([]);
	const [showSidebar, setShowSidebar] = useState(true);
	const [showSettings, setShowSettings] = useState(false);
	const [isLoggingOut, setIsLoggingOut] = useState(false);
	const [isAutoCollapseSidebar, setIsAutoCollapseSidebar] = useState(false);

	useEffect(() => {
		let mounted = true;

		const initialize = async () => {
			try {
				const savedAutoCollapse = localStorage.getItem('aiAssistant_autoCollapseSidebar') === 'true';
				if (mounted) {
					setIsAutoCollapseSidebar(savedAutoCollapse);
					if (savedAutoCollapse) {
						setShowSidebar(false);
					}
				}

				const {
					data: { session },
				} = await supabase.auth.getSession();

				if (!mounted) return;

				if (!session) {
					router.push('/admin/login');
					return;
				}

				setIsLoading(false);
			} catch (error) {
				if (mounted) {
					setIsLoading(false);
				}
			}
		};

		// load user's sessions for the sidebar
		async function loadSessions() {
			try {
				const {
					data: { session },
				} = await supabase.auth.getSession();
				if (!session) return;
				const { data: dbSessions, error } = await supabase
					.from('ai_chat_sessions')
					.select('id, title, created_at, updated_at, is_pinned, is_archived, deleted_at')
					.eq('user_id', session.user.id)
					.is('deleted_at', null)
					.order('is_pinned', { ascending: false })
					.order('updated_at', { ascending: false })
					.limit(50);

				if (!error && dbSessions) {
					const active = dbSessions
						.filter((s: any) => !s.is_archived)
						.map((s: any) => ({
							id: s.id,
							title: s.title || 'Untitled Conversation',
							createdAt: new Date(s.created_at),
							updatedAt: new Date(s.updated_at),
							isPinned: s.is_pinned || false,
							isArchived: s.is_archived || false,
						}));

					const archived = dbSessions
						.filter((s: any) => s.is_archived)
						.map((s: any) => ({
							id: s.id,
							title: s.title || 'Untitled Conversation',
							createdAt: new Date(s.created_at),
							updatedAt: new Date(s.updated_at),
							isPinned: s.is_pinned || false,
							isArchived: s.is_archived || false,
						}));

					setSessions(active);
					setArchivedSessions(archived);
				}
			} catch (err) {
				console.error('Failed to load chat sessions for sidebar', err);
			}
		}

		initialize();
		loadSessions();

		return () => {
			mounted = false;
		};
	}, [router]);

	const handleNewChat = useCallback(() => {
		router.push('/admin/ai-assistant');
	}, [router]);

	const handleLogout = useCallback(async () => {
		setIsLoggingOut(true);
		try {
			await supabase.auth.signOut();
			router.push('/admin/login');
		} catch (error) {
			console.error('Error logging out:', error);
			alert('Failed to logout. Please try again.');
		} finally {
			setIsLoggingOut(false);
		}
	}, [router]);

	const handleToggleAutoCollapse = useCallback(() => {
		const newValue = !isAutoCollapseSidebar;
		setIsAutoCollapseSidebar(newValue);
		localStorage.setItem('aiAssistant_autoCollapseSidebar', String(newValue));
	}, [isAutoCollapseSidebar]);

	const handleSessionIdChange = useCallback(
		(newSessionId: string) => {
			if (!newSessionId || redirectingRef.current) return;
			redirectingRef.current = true;
			router.push(`/admin/ai-assistant/${newSessionId}`);
		},
		[router]
	);

	if (isLoading) {
		return (
			<div className="flex h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 items-center justify-center">
				<Loader2 className="h-8 w-8 animate-spin text-blue-500" />
			</div>
		);
	}

	return (
		<div className="flex h-screen w-screen bg-[#090d16] text-slate-100 overflow-hidden">
			<AIAssistantSidebar
				sessions={sessions}
				archivedSessions={archivedSessions}
				currentSessionId={undefined}
				showSidebar={showSidebar}
				onNewChat={handleNewChat}
				onSessionClick={(id) => router.push(`/admin/ai-assistant/${id}`)}
				onOpenSettings={() => setShowSettings(true)}
				onOpenArchived={() => { /* landing page can open archived modal later if needed */ }}
			/>

			<div className="flex-1 flex flex-col overflow-hidden">
				<div className="border-b border-white/10 bg-[#0f1420]/90 backdrop-blur-xl px-6 py-3">
					<div className="flex items-center justify-between gap-4">
						<div className="flex items-center gap-3 min-w-0">
							<button
								onClick={() => setShowSidebar(!showSidebar)}
								className="grid h-10 w-10 place-items-center rounded-xl border border-white/10 bg-white/5 text-slate-100 transition-colors hover:bg-white/10"
							>
								<svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
								</svg>
							</button>
							<div className="flex items-center gap-3 min-w-0">
								<div className="grid h-10 w-10 place-items-center rounded-2xl bg-gradient-to-br from-blue-500 via-cyan-500 to-emerald-400 shadow-lg shadow-blue-500/20">
									<MessageSquare className="h-5 w-5 text-white" />
								</div>
								<div className="min-w-0">
									<h1 className="truncate text-lg font-semibold tracking-tight text-white">School Deck AI</h1>
									<p className="truncate text-sm text-slate-400">Ask questions, get data answers</p>
								</div>
							</div>
						</div>
						<div className="flex items-center gap-3">
							<div className="hidden sm:flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-slate-300">
								<span className="h-2 w-2 rounded-full bg-emerald-400" />
								Live
							</div>
							<div className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-right">
								<p className="text-xs font-medium text-slate-200">0 conversations</p>
								<p className="text-[11px] text-slate-400">New chat</p>
							</div>
						</div>
					</div>
				</div>

				<div className="flex-1 overflow-hidden">
					<AIAssistantChat
						loadHistory={false}
						onSessionIdChange={handleSessionIdChange}
						welcomeMessage="👋 Welcome to School Deck AI! I'm here to help you analyze your school data. Ask me anything about students, classes, grades, attendance, teachers, and more."
						placeholder="Ask me anything about your school data..."
						suggestedQuestions={[
							'How many students are enrolled?',
							'Show students with low attendance',
							'Average grades by class',
							'Which teacher has the most classes assigned?',
						]}
					/>
				</div>
			</div>
		</div>
	);
}
