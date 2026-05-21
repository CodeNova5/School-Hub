"use client";

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { MessageSquare, Plus, Settings, LogOut, Loader2, Download, Trash2 as TrashIcon, Trash } from 'lucide-react';
import AIAssistantSidebar from '@/components/ai-assistant-sidebar';
import { supabase } from '@/lib/supabase';
import useAIAssistantSessions from '@/hooks/useAIAssistantSessions';
import AIAssistantChat from '@/components/ai-assistant-chat';
import { Button } from '@/components/ui/button';

export default function AdminAIAssistantLandingPage() {
	const router = useRouter();
	const redirectingRef = useRef(false);

	const { sessions, archivedSessions, isLoading, loadSessions, clearAllArchived, exportAsJSON, deleteAllChatHistory } = useAIAssistantSessions();
	const [authLoading, setAuthLoading] = useState(true);
	const [showSidebar, setShowSidebar] = useState(true);
	const [showSettings, setShowSettings] = useState(false);
	const [isLoggingOut, setIsLoggingOut] = useState(false);
	const [isAutoCollapseSidebar, setIsAutoCollapseSidebar] = useState(false);
	const [isClearingArchived, setIsClearingArchived] = useState(false);
	const [isDeletingAll, setIsDeletingAll] = useState(false);

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

				setAuthLoading(false);
			} catch (error) {
				if (mounted) {
					setAuthLoading(false);
				}
			}
		};

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

	const handleClearAllArchived = useCallback(async () => {
		if (archivedSessions.length === 0) {
			alert('No archived conversations to delete.');
			return;
		}

		const ok = window.confirm(
			`Are you sure you want to permanently delete all ${archivedSessions.length} archived conversations? This action cannot be undone.`
		);

		if (!ok) return;

		setIsClearingArchived(true);
		try {
			await clearAllArchived();
			setShowSettings(false);
			alert('All archived conversations have been deleted.');
		} catch (error) {
			console.error('Error clearing archived conversations:', error);
			alert('Failed to delete archived conversations. Please try again.');
		} finally {
			setIsClearingArchived(false);
		}
	}, [archivedSessions.length, clearAllArchived]);

	const handleExportAsJSON = useCallback(() => {
		exportAsJSON();
		setShowSettings(false);
		alert('Chat history exported successfully!');
	}, [exportAsJSON]);

	const handleDeleteAllChatHistory = useCallback(async () => {
		const ok = window.confirm('This will permanently delete ALL conversations, messages, and archived chats. This action cannot be undone.');

		if (!ok) return;

		setIsDeletingAll(true);
		try {
			await deleteAllChatHistory();
			setShowSettings(false);
			alert('All chat history has been permanently deleted.');
		} catch (error) {
			console.error('Error deleting all chat history:', error);
			alert('Failed to delete chat history. Please try again.');
		} finally {
			setIsDeletingAll(false);
		}
	}, [deleteAllChatHistory]);

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
			{showSettings && (
				<div className="fixed inset-0 bg-slate-900/80 z-50 flex items-center justify-center p-3" onClick={() => setShowSettings(false)}>
					<div className="bg-slate-800 rounded-lg p-5 w-full max-w-sm border border-slate-700 shadow-2xl z-[60]" onClick={(e) => e.stopPropagation()}>
						<div className="flex items-center gap-2 mb-4">
							<Settings className="h-5 w-5 text-blue-400" />
							<h2 className="text-lg font-semibold text-white">Settings</h2>
						</div>

						<div className="space-y-3 max-h-96 overflow-y-auto">
							<div className="p-3 bg-slate-700/50 rounded-lg border border-slate-600 hover:border-slate-500 transition-colors">
								<label className="flex items-center gap-3 cursor-pointer">
									<input
										type="checkbox"
										checked={isAutoCollapseSidebar}
										onChange={handleToggleAutoCollapse}
										className="w-4 h-4 rounded accent-blue-500"
									/>
									<div>
										<p className="text-sm font-medium text-slate-200">Auto-Collapse Sidebar</p>
										<p className="text-xs text-slate-400">Sidebar collapses on startup</p>
									</div>
								</label>
							</div>

							<button
								onClick={handleExportAsJSON}
								className="w-full p-3 text-left bg-slate-700/50 border border-slate-600 rounded-lg hover:bg-slate-700 hover:border-slate-500 transition-colors"
							>
								<div className="flex items-center gap-2 mb-1">
									<Download className="h-4 w-4 text-green-400" />
									<p className="text-sm font-medium text-slate-200">Export as JSON</p>
								</div>
								<p className="text-xs text-slate-400 ml-6">Download all chat history</p>
							</button>

							<button
								onClick={handleClearAllArchived}
								disabled={isClearingArchived || archivedSessions.length === 0}
								className="w-full p-3 text-left bg-red-900/20 border border-red-700/50 rounded-lg hover:bg-red-900/30 hover:border-red-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
							>
								<div className="flex items-center gap-2 mb-1">
									<TrashIcon className="h-4 w-4 text-red-400" />
									<p className="text-sm font-medium text-red-300">{isClearingArchived ? 'Clearing...' : 'Clear All Archived'}</p>
								</div>
								<p className="text-xs text-red-300/70 ml-6">Permanently delete all archived</p>
							</button>

							<button
								onClick={handleDeleteAllChatHistory}
								disabled={isDeletingAll}
								className="w-full p-3 text-left bg-red-900/30 border border-red-700/50 rounded-lg hover:bg-red-900/40 hover:border-red-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
							>
								<div className="flex items-center gap-2 mb-1">
									<Trash className="h-4 w-4 text-red-400" />
									<p className="text-sm font-medium text-red-300">{isDeletingAll ? 'Deleting...' : 'Delete All History'}</p>
								</div>
								<p className="text-xs text-red-300/70 ml-6">Permanently remove everything</p>
							</button>

							<button
								onClick={handleLogout}
								disabled={isLoggingOut}
								className="w-full p-3 text-left bg-slate-700/50 border border-slate-600 rounded-lg hover:bg-slate-700 hover:border-slate-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
							>
								<div className="flex items-center gap-2 mb-1">
									<LogOut className="h-4 w-4 text-slate-300" />
									<p className="text-sm font-medium text-slate-200">{isLoggingOut ? 'Signing out...' : 'Logout'}</p>
								</div>
								<p className="text-xs text-slate-400 ml-6">Sign out from your account</p>
							</button>
						</div>

						<div className="flex gap-2 mt-4">
							<button
								onClick={() => setShowSettings(false)}
								className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 rounded transition-colors font-medium text-sm"
							>
								Done
							</button>
						</div>
					</div>
				</div>
			)}

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
