"use client";

import { APP_NAME } from "@/data";
import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { MessageSquare, Plus, Settings, LogOut, Loader2, Download, Trash2 as TrashIcon, Trash, Archive, Clock, MoreVertical } from 'lucide-react';
import AIAssistantSidebar from '@/components/ai-assistant-sidebar';
import { supabase } from '@/lib/supabase';
import useAIAssistantSessions from '@/hooks/useAIAssistantSessions';
import AIAssistantChat from '@/components/ai-assistant-chat';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';

export default function AdminAIAssistantLandingPage() {
	const router = useRouter();
	const redirectingRef = useRef(false);

	const { sessions, archivedSessions, isLoading, loadSessions, unarchiveSession, permanentDelete, clearAllArchived, exportAsJSON, deleteAllChatHistory } = useAIAssistantSessions();
	const [authLoading, setAuthLoading] = useState(true);
	const [showSidebar, setShowSidebar] = useState(true);
	const [showSettings, setShowSettings] = useState(false);
	const [showArchived, setShowArchived] = useState(false);
	const [isLoggingOut, setIsLoggingOut] = useState(false);
	const [isAutoCollapseSidebar, setIsAutoCollapseSidebar] = useState(false);
	const [isClearingArchived, setIsClearingArchived] = useState(false);
	const [isDeletingAll, setIsDeletingAll] = useState(false);
	const [loadingActionId, setLoadingActionId] = useState<string | null>(null);

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

	const handleOpenArchived = useCallback(() => {
		setShowArchived(true);
		setShowSettings(false);
	}, []);

	const handleCloseArchived = useCallback(() => {
		setShowArchived(false);
	}, []);

	const handleUnarchiveSession = useCallback(async (id: string) => {
		try {
			setLoadingActionId(id);
			await unarchiveSession(id);
			setShowArchived(false);
			await loadSessions();
		} catch (error) {
			console.error('Error unarchiving session:', error);
			alert('Failed to unarchive session. Please try again.');
		} finally {
			setLoadingActionId(null);
		}
	}, [unarchiveSession, loadSessions]);

	const handlePermanentDelete = useCallback(async (id: string) => {
		const ok = window.confirm('This conversation will be permanently deleted. This action cannot be undone.');
		if (!ok) return;

		try {
			setLoadingActionId(id);
			await permanentDelete(id);
			await loadSessions();
		} catch (error) {
			console.error('Error permanently deleting session:', error);
			alert('Failed to delete session. Please try again.');
		} finally {
			setLoadingActionId(null);
		}
	}, [permanentDelete, loadSessions]);

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
			{showArchived && (
				<div
					className="fixed inset-0 bg-slate-900/80 z-50 flex items-center justify-center p-3"
					onClick={handleCloseArchived}
				>
					<div
						className="bg-[#0e1524] rounded-2xl w-full max-w-2xl border border-white/10 shadow-2xl z-[60] flex flex-col max-h-[80vh]"
						onClick={(e) => e.stopPropagation()}
					>
						<div className="p-6 border-b border-white/10 bg-[#0f172a]">
							<div className="flex items-center gap-3 justify-between">
								<div className="flex items-center gap-3">
									<div className="p-2.5 bg-amber-500/30 rounded-lg">
										<Archive className="h-6 w-6 text-amber-400" />
									</div>
									<div>
										<h2 className="text-xl font-bold text-white">Archived Conversations</h2>
										<p className="text-xs text-slate-400 mt-1">View, restore, or permanently remove archived chats</p>
									</div>
								</div>
								<span className="px-3 py-1.5 bg-amber-500/30 text-amber-200 rounded-full text-sm font-semibold">
									{archivedSessions.length}
								</span>
							</div>
						</div>

						<ScrollArea className="flex-1 [&_[data-radix-scroll-area-thumb]]:hidden">
							<div className="p-6 space-y-3">
								{archivedSessions.length === 0 ? (
									<div className="flex flex-col items-center justify-center py-12">
										<Archive className="h-12 w-12 text-slate-600 mb-3" />
										<p className="text-sm text-slate-400 text-center">No archived conversations yet</p>
									</div>
								) : (
									archivedSessions.map((session) => (
										<div key={session.id} className="group p-4 rounded-lg cursor-pointer transition-all duration-200 border bg-slate-700/50 border-slate-600 hover:bg-slate-700 hover:border-slate-500">
											<div className="flex items-start gap-3 justify-between">
												<div
													onClick={() => {
														handleCloseArchived();
														router.push(`/admin/ai-assistant/${session.id}`);
													}}
													className="flex items-start gap-3 flex-1 min-w-0"
												>
													<div className="flex items-center gap-1.5 mt-1">
														<MessageSquare className="h-5 w-5 flex-shrink-0 text-slate-400" />
														<Archive className="h-4 w-4 flex-shrink-0 text-amber-400" fill="currentColor" />
													</div>
													<div className="min-w-0 flex-1">
														<h3 className="text-base font-semibold truncate mb-2 text-slate-100">{session.title}</h3>
														<div className="text-sm flex items-center gap-2 text-slate-400">
															<Clock className="h-4 w-4 flex-shrink-0" />
															<span className="whitespace-nowrap">
																{session.updatedAt instanceof Date
																	? session.updatedAt.toLocaleString([], {
																		month: 'short',
																		day: 'numeric',
																		hour: '2-digit',
																		minute: '2-digit',
																		hour12: false,
																	})
																	: new Date(session.updatedAt).toLocaleString([], {
																		month: 'short',
																		day: 'numeric',
																		hour: '2-digit',
																		minute: '2-digit',
																		hour12: false,
																	})}
															</span>
														</div>
													</div>
												</div>

												<div className="relative">
													<button
														onClick={(e) => {
															e.stopPropagation();
															handleUnarchiveSession(session.id);
														}}
														disabled={loadingActionId === session.id}
														className="w-full px-4 py-3 text-left text-sm text-slate-200 hover:bg-slate-600 flex items-center gap-3 transition-colors border-b border-slate-600 disabled:opacity-50 disabled:cursor-not-allowed rounded-t-lg"
													>
														<MoreVertical className="h-4 w-4 opacity-0" />
														<span>{loadingActionId === session.id ? 'Processing...' : 'Unarchive'}</span>
													</button>
													<button
														onClick={(e) => {
															e.stopPropagation();
															handlePermanentDelete(session.id);
														}}
														disabled={loadingActionId === session.id}
														className="w-full px-4 py-3 text-left text-sm text-red-300 hover:bg-red-900/30 flex items-center gap-3 transition-colors disabled:opacity-50 disabled:cursor-not-allowed rounded-b-lg"
													>
														<Trash className="h-4 w-4" />
														<span>{loadingActionId === session.id ? 'Processing...' : 'Delete Permanently'}</span>
													</button>
												</div>
											</div>
										</div>
									))
								)}
							</div>
						</ScrollArea>

						<div className="p-6 border-t border-white/10 bg-[#0f172a]/70">
							<button
								onClick={handleCloseArchived}
								className="w-full px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors text-sm font-semibold shadow-lg hover:shadow-xl"
							>
								Close
							</button>
						</div>
					</div>
				</div>
			)}

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
				onOpenArchived={handleOpenArchived}
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
									<h1 className="truncate text-lg font-semibold tracking-tight text-white">{APP_NAME} AI</h1>
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
						welcomeMessage={`👋 Welcome to ${APP_NAME} AI! I'm here to help you analyze your school data. Ask me anything about students, classes, grades, attendance, teachers, and more.`}
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
