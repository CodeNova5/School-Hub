"use client";

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { MessageSquare, Plus, Settings, LogOut, Loader2, Clock, Pin } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import AIAssistantChat from '@/components/ai-assistant-chat';
import { Button } from '@/components/ui/button';
import AIAssistantShell from '@/components/ai-assistant-shell';

export default function AdminAIAssistantLandingPage() {
	const router = useRouter();
	const redirectingRef = useRef(false);

	const [isLoading, setIsLoading] = useState(true);
	const [sessions, setSessions] = useState<any[]>([]);
	const [archivedSessions, setArchivedSessions] = useState<any[]>([]);
	const [isLoadingSessions, setIsLoadingSessions] = useState(true);
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

				// load sessions for sidebar
				try {
					setIsLoadingSessions(true);
					const { data: { session } } = await supabase.auth.getSession();
					if (!session) return;
					const { data: dbSessions } = await supabase
						.from('ai_chat_sessions')
						.select('id, title, created_at, updated_at, is_pinned, is_archived')
						.eq('user_id', session.user.id)
						.is('deleted_at', null)
						.order('is_pinned', { ascending: false })
						.order('updated_at', { ascending: false })
						.limit(50);

					if (mounted && dbSessions) {
						const active = dbSessions.filter((s: any) => !s.is_archived).map((s: any) => ({
							id: s.id,
							title: s.title || 'Untitled Conversation',
							updatedAt: new Date(s.updated_at),
							isPinned: s.is_pinned || false,
						}));
						const archived = dbSessions.filter((s: any) => s.is_archived).map((s: any) => ({
							id: s.id,
							title: s.title || 'Untitled Conversation',
							updatedAt: new Date(s.updated_at),
							isPinned: s.is_pinned || false,
						}));
						setSessions(active);
						setArchivedSessions(archived);
					}
				} catch (err) {
					console.error('Error loading sessions on landing:', err);
				} finally {
					if (mounted) setIsLoadingSessions(false);
				}

				setIsLoading(false);
			} catch (error) {
				if (mounted) {
					setIsLoading(false);
				}
			}
		};

		initialize();

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
		<AIAssistantShell
			sessions={sessions}
			archivedSessions={archivedSessions}
			isLoadingSessions={isLoadingSessions}
			onNewChat={handleNewChat}
			onSelectSession={(id) => router.push(`/admin/ai-assistant/${id}`)}
			onLogout={handleLogout}
			onToggleAutoCollapse={handleToggleAutoCollapse}
			onUnarchive={async (id: string) => {
				try {
					await supabase.from('ai_chat_sessions').update({ is_archived: false, updated_at: new Date().toISOString() }).eq('id', id);
					// refresh sessions list
					const { data: { session } } = await supabase.auth.getSession();
					if (session) {
						const { data: dbSessions } = await supabase
							.from('ai_chat_sessions')
							.select('id, title, created_at, updated_at, is_pinned, is_archived')
							.eq('user_id', session.user.id)
							.is('deleted_at', null)
							.order('is_pinned', { ascending: false })
							.order('updated_at', { ascending: false })
							.limit(50);

						if (dbSessions) {
							const active = dbSessions.filter((s: any) => !s.is_archived).map((s: any) => ({ id: s.id, title: s.title || 'Untitled Conversation', updatedAt: new Date(s.updated_at), isPinned: s.is_pinned || false }));
							const archived = dbSessions.filter((s: any) => s.is_archived).map((s: any) => ({ id: s.id, title: s.title || 'Untitled Conversation', updatedAt: new Date(s.updated_at), isPinned: s.is_pinned || false }));
							setSessions(active);
							setArchivedSessions(archived);
						}
					}

					// navigate to unarchived session
					router.push(`/admin/ai-assistant/${id}`);
				} catch (err) {
					console.error('Error unarchiving session:', err);
					alert('Failed to unarchive. Please try again.');
				}
			}}
		>
			<div className="flex-1 flex flex-col overflow-hidden">
				<div className="border-b border-white/10 bg-[#0f1420]/90 backdrop-blur-xl px-6 py-3">
					<div className="flex items-center justify-between gap-4">
						<div className="flex items-center gap-3 min-w-0">
							<button onClick={() => setShowSidebar(!showSidebar)} className="grid h-10 w-10 place-items-center rounded-xl border border-white/10 bg-white/5 text-slate-100 transition-colors hover:bg-white/10">
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
					<AIAssistantChat loadHistory={false} onSessionIdChange={handleSessionIdChange} welcomeMessage={"👋 Welcome to School Deck AI! I'm here to help you analyze your school data. Ask me anything about students, classes, grades, attendance, teachers, and more."} placeholder={"Ask me anything about your school data..."} suggestedQuestions={[ 'How many students are enrolled?', 'Show students with low attendance', 'Average grades by class', 'Which teacher has the most classes assigned?', ]} />
				</div>
			</div>
		</AIAssistantShell>
	);
}
