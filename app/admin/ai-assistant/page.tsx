"use client";

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { MessageSquare, Plus, Settings, LogOut, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import AIAssistantChat from '@/components/ai-assistant-chat';
import { Button } from '@/components/ui/button';

export default function AdminAIAssistantLandingPage() {
	const router = useRouter();
	const redirectingRef = useRef(false);

	const [isLoading, setIsLoading] = useState(true);
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
		<div className="flex h-screen w-screen bg-[#090d16] text-slate-100 overflow-hidden">
			<div className={`${showSidebar ? 'w-80' : 'w-0'} bg-[#0e1524] border-r border-white/10 flex flex-col transition-all duration-300 overflow-hidden shadow-2xl`}>
				<div className="p-4 border-b border-white/10">
					<Button
						onClick={handleNewChat}
						className="w-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white rounded-lg font-semibold gap-2 h-10 shadow-lg hover:shadow-xl transition-all"
					>
						<Plus className="h-4 w-4" />
						New Chat
					</Button>
				</div>

				<div className="flex-1 p-6">
					<div className="h-full rounded-xl border border-white/10 bg-white/[0.03] p-4 text-center flex items-center justify-center">
						<p className="text-sm text-slate-400">Start by sending your first message.</p>
					</div>
				</div>

				<div className="p-4 border-t border-white/10 space-y-2">
					{showSettings && (
						<div
							className="fixed inset-0 bg-slate-900/80 z-50 flex items-center justify-center p-3"
							onClick={() => setShowSettings(false)}
						>
							<div
								className="bg-slate-800 rounded-lg p-5 w-full max-w-sm border border-slate-700 shadow-2xl z-[60]"
								onClick={(e) => e.stopPropagation()}
							>
								<div className="flex items-center gap-2 mb-4">
									<Settings className="h-5 w-5 text-blue-400" />
									<h2 className="text-lg font-semibold text-white">Settings</h2>
								</div>

								<div className="space-y-3">
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
										onClick={handleLogout}
										disabled={isLoggingOut}
										className="w-full p-3 text-left bg-slate-700/50 border border-slate-600 rounded-lg hover:bg-slate-700 hover:border-slate-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
									>
										<div className="flex items-center gap-2 mb-1">
											<LogOut className="h-4 w-4 text-slate-300" />
											<p className="text-sm font-medium text-slate-200">
												{isLoggingOut ? 'Signing out...' : 'Logout'}
											</p>
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

					<button
						onClick={() => setShowSettings(true)}
						className="w-full flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-slate-700 to-slate-800 hover:from-slate-600 hover:to-slate-700 text-slate-200 rounded-lg transition-all border border-slate-600 hover:border-slate-500"
					>
						<Settings className="h-4 w-4" />
						<span className="text-sm font-medium">Settings</span>
					</button>
				</div>
			</div>

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
