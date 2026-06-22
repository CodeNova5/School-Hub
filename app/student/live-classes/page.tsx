"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Loader2,
  Radio,
  Video,
  CalendarClock,
  Clock,
  ChevronDown,
  ChevronRight,
  Zap,
  History,
} from "lucide-react";
import { createSupabaseClient } from "@/lib/supabase";

type StudentLiveSession = {
  id: string;
  title: string;
  class_id: string;
  subject_class_id: string | null;
  status: "scheduled" | "live" | "ended" | "cancelled";
  scheduled_for: string | null;
  scheduled_end_at: string | null;
  started_at: string | null;
  ended_at: string | null;
  created_at: string;
  subject_classes?: {
    id: string;
    subject_code?: string;
    subjects?: { name: string };
    teachers?: { first_name: string; last_name: string };
  } | null;
};

function formatRelativeTime(dateStr: string): string {
  const now = Date.now();
  const date = new Date(dateStr).getTime();
  const diffMs = date - now;

  if (diffMs < 0) {
    const past = Math.abs(diffMs);
    const mins = Math.floor(past / 60000);
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    return `${hours}h ago`;
  }

  const mins = Math.floor(diffMs / 60000);
  if (mins < 60) return `in ${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `in ${hours}h`;
  const days = Math.floor(hours / 24);
  return `in ${days}d`;
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export default function StudentLiveClassesPage() {
  const [loading, setLoading] = useState(true);
  const [joiningSessionId, setJoiningSessionId] = useState<string | null>(null);
  const [sessions, setSessions] = useState<StudentLiveSession[]>([]);
  const [pastExpanded, setPastExpanded] = useState(false);

  const loadSessionsRef = useRef<() => Promise<void>>(async () => {});

  // Use ref to avoid stale closures in the realtime callback
  loadSessionsRef.current = useCallback(async () => {
    try {
      const response = await fetch("/api/student/live-sessions");
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error || "Failed to load live classes");
      }

      setSessions(payload.data ?? []);
    } catch (error: any) {
      toast.error(error.message || "Failed to load live classes");
    }
  }, []);

  async function loadSessions() {
    setLoading(true);
    await loadSessionsRef.current!();
    setLoading(false);
  }

  // Set up realtime subscription for live session changes
  useEffect(() => {
    const client = createSupabaseClient();

    let channel: any;
    let unsubscribed = false;

    async function setup() {
      try {
        if (client) {
          const { data: { user } } = await client.auth.getUser();
          if (user && !unsubscribed) {
            const { data: student } = await client
              .from("students")
              .select("school_id")
              .eq("user_id", user.id)
              .maybeSingle();

            if (student && !unsubscribed) {
              channel = client
                .channel("student-live-sessions")
                .on(
                  "postgres_changes",
                  {
                    event: "*",
                    schema: "public",
                    table: "live_sessions",
                    filter: `school_id=eq.${student.school_id}`,
                  },
                  () => {
                    loadSessionsRef.current?.();
                  }
                )
                .subscribe();
            }
          }
        }
      } catch {
        // Realtime unavailable — fall back to manual refresh
      } finally {
        // Always load initial data so the page isn't stuck loading
        if (!unsubscribed) await loadSessions();
      }
    }

    setup();

    return () => {
      unsubscribed = true;
      if (channel) {
        client?.removeChannel(channel);
      }
    };
  }, []);

  async function joinSession(sessionId: string) {
    try {
      setJoiningSessionId(sessionId);
      const response = await fetch(`/api/student/live-sessions/${sessionId}/join`);
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error || "Failed to create join links");
      }

      const links = payload?.data?.links;
      const userAgent = window.navigator.userAgent.toLowerCase();
      const isMobile = /android|iphone|ipad|ipod/.test(userAgent);
      const deepLink = isMobile ? links.mobileDeepLink : links.desktopDeepLink;

      window.location.href = deepLink;
      window.setTimeout(() => {
        window.open(links.webUrl, "_blank", "noopener,noreferrer");
      }, 1200);
    } catch (error: any) {
      toast.error(error.message || "Unable to join class");
    } finally {
      setJoiningSessionId(null);
    }
  }

  const { liveSessions, upcomingSessions, pastSessions } = useMemo(() => {
    const live: StudentLiveSession[] = [];
    const upcoming: StudentLiveSession[] = [];
    const past: StudentLiveSession[] = [];

    for (const session of sessions) {
      if (session.status === "live") {
        live.push(session);
      } else if (session.status === "scheduled") {
        upcoming.push(session);
      } else {
        past.push(session);
      }
    }

    // Sort: upcoming by scheduled_for ascending (closest first), past by started_at desc (most recent first)
    upcoming.sort(
      (a, b) =>
        new Date(a.scheduled_for || a.created_at).getTime() -
        new Date(b.scheduled_for || b.created_at).getTime()
    );
    past.sort(
      (a, b) =>
        new Date(b.started_at || b.created_at).getTime() -
        new Date(a.started_at || a.created_at).getTime()
    );

    return { liveSessions: live, upcomingSessions: upcoming, pastSessions: past };
  }, [sessions]);

  const totalCount = sessions.length;

  if (loading) {
    return (
      <DashboardLayout role="student">
        <div className="flex min-h-[50vh] items-center justify-center">
          <div className="text-center space-y-4">
            <div className="mx-auto h-10 w-10 rounded-full border-2 border-blue-200 border-t-blue-600 animate-spin" />
            <p className="text-sm text-slate-500 font-medium">Loading live classes...</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout role="student">
      <div className="space-y-8 pb-12">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Live Classes</h1>
            <p className="text-sm text-gray-600">
              {totalCount > 0
                ? `${liveSessions.length} active · ${upcomingSessions.length} upcoming · ${pastSessions.length} past`
                : "Join your subject live classes directly from here."}
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={loadSessions}
            className="gap-2"
          >
            <Clock className="w-4 h-4" />
            Refresh
          </Button>
        </div>

        {/* ═══ LIVE NOW ═══ */}
        {liveSessions.length > 0 && (
          <section>
            <div className="flex items-center gap-3 mb-4">
              <div className="relative">
                <div className="w-3 h-3 rounded-full bg-red-500" />
                <div className="absolute inset-0 w-3 h-3 rounded-full bg-red-500 animate-ping opacity-75" />
              </div>
              <h2 className="text-lg font-bold text-red-700 flex items-center gap-2">
                <Zap className="w-5 h-5" />
                Live Now
              </h2>
              <Badge className="bg-red-100 text-red-700 border-red-200">
                {liveSessions.length} session{liveSessions.length !== 1 ? "s" : ""}
              </Badge>
            </div>

            <div className="space-y-3">
              {liveSessions.map((session) => {
                const subjectInfo = session.subject_classes;
                const teacherName = subjectInfo?.teachers
                  ? `${subjectInfo.teachers.first_name} ${subjectInfo.teachers.last_name}`
                  : "Teacher";
                const subjectName = subjectInfo?.subjects?.name || "Subject Class";

                return (
                  <div
                    key={session.id}
                    className="rounded-xl border-2 border-red-300 bg-red-50 shadow-md shadow-red-100/50 p-4 transition-all hover:shadow-lg hover:border-red-400"
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <Badge className="bg-red-500 text-white border-red-500 animate-pulse text-[10px]">
                            <Radio className="w-3 h-3 mr-1" />
                            LIVE
                          </Badge>
                          <span className="text-xs text-red-600 font-medium">
                            Started {session.started_at ? formatRelativeTime(session.started_at) : "just now"}
                          </span>
                        </div>
                        <p className="font-bold text-gray-900 text-lg truncate">{session.title}</p>
                        <p className="text-sm text-gray-600">
                          {subjectName} &middot; {teacherName}
                        </p>
                        {session.scheduled_end_at && (
                          <p className="text-xs text-red-500 mt-0.5">
                            Ends {formatRelativeTime(session.scheduled_end_at)}
                          </p>
                        )}
                      </div>
                      <Button
                        className="bg-red-600 hover:bg-red-700 text-white gap-2 shadow-sm shrink-0"
                        onClick={() => joinSession(session.id)}
                        disabled={joiningSessionId === session.id}
                      >
                        {joiningSessionId === session.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Video className="w-4 h-4" />
                        )}
                        Join Now
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* ═══ UPCOMING ═══ */}
        {upcomingSessions.length > 0 && (
          <section>
            <div className="flex items-center gap-3 mb-4">
              <CalendarClock className="w-5 h-5 text-blue-600" />
              <h2 className="text-lg font-bold text-blue-700">Upcoming</h2>
              <Badge className="bg-blue-100 text-blue-700 border-blue-200">
                {upcomingSessions.length} session{upcomingSessions.length !== 1 ? "s" : ""}
              </Badge>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {upcomingSessions.map((session) => {
                const subjectInfo = session.subject_classes;
                const teacherName = subjectInfo?.teachers
                  ? `${subjectInfo.teachers.first_name} ${subjectInfo.teachers.last_name}`
                  : "Teacher";
                const subjectName = subjectInfo?.subjects?.name || "Subject Class";
                const startDate = session.scheduled_for ? new Date(session.scheduled_for) : null;

                return (
                  <div
                    key={session.id}
                    className="rounded-xl border border-blue-200 bg-white hover:bg-blue-50/40 hover:border-blue-300 transition-all p-4 shadow-sm"
                  >
                    <div className="flex flex-col h-full">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <Badge className="bg-blue-100 text-blue-700 border-blue-200 text-[10px]">
                          <CalendarClock className="w-3 h-3 mr-1" />
                          Scheduled
                        </Badge>
                        {startDate && (
                          <span className="text-xs font-semibold text-blue-600 shrink-0">
                            {formatRelativeTime(session.scheduled_for!)}
                          </span>
                        )}
                      </div>

                      <p className="font-semibold text-gray-900">{session.title}</p>
                      <p className="text-xs text-gray-600 mt-0.5">
                        {subjectName} &middot; {teacherName}
                      </p>

                      {startDate && (
                        <p className="text-xs text-gray-500 mt-1.5">
                          {formatDateTime(session.scheduled_for!)}
                        </p>
                      )}

                      <div className="mt-auto pt-3">
                        <Button
                          size="sm"
                          className="bg-blue-600 hover:bg-blue-700 text-white gap-1.5 w-full"
                          onClick={() => joinSession(session.id)}
                          disabled={joiningSessionId === session.id}
                        >
                          {joiningSessionId === session.id ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Video className="w-3.5 h-3.5" />
                          )}
                          Join Class
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* ═══ EMPTY STATE ═══ */}
        {liveSessions.length === 0 && upcomingSessions.length === 0 && pastSessions.length === 0 && (
          <Card className="border-slate-200">
            <CardContent className="py-16 text-center">
              <Radio className="w-12 h-12 text-slate-200 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-slate-700 mb-1">
                No Live Classes Available
              </h3>
              <p className="text-sm text-slate-500 max-w-sm mx-auto">
                You don&apos;t have any live classes right now. When your teachers schedule a live
                session, it will appear here.
              </p>
            </CardContent>
          </Card>
        )}

        {/* ═══ PAST ═══ */}
        {pastSessions.length > 0 && (
          <section>
            <button
              onClick={() => setPastExpanded(!pastExpanded)}
              className="flex items-center gap-3 w-full text-left group"
            >
              <History className="w-5 h-5 text-slate-500" />
              <h2 className="text-lg font-bold text-slate-600 group-hover:text-slate-800 transition-colors">
                Past Sessions
              </h2>
              <Badge variant="outline" className="text-xs text-slate-500 border-slate-300">
                {pastSessions.length}
              </Badge>
              <div className="ml-auto">
                {pastExpanded ? (
                  <ChevronDown className="w-4 h-4 text-slate-400" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-slate-400" />
                )}
              </div>
            </button>

            {pastExpanded && (
              <div className="mt-4 space-y-2">
                {pastSessions.map((session) => {
                  const subjectInfo = session.subject_classes;
                  const teacherName = subjectInfo?.teachers
                    ? `${subjectInfo.teachers.first_name} ${subjectInfo.teachers.last_name}`
                    : "Teacher";
                  const subjectName = subjectInfo?.subjects?.name || "Subject Class";
                  const isCancelled = session.status === "cancelled";

                  return (
                    <div
                      key={session.id}
                      className="rounded-lg border border-slate-200 bg-white p-3 opacity-70 hover:opacity-100 transition-opacity"
                    >
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-0.5">
                            <Badge
                              variant="outline"
                              className={`text-[10px] ${
                                isCancelled
                                  ? "bg-orange-50 text-orange-600 border-orange-200"
                                  : "bg-slate-100 text-slate-600 border-slate-200"
                              }`}
                            >
                              {isCancelled ? "Cancelled" : "Ended"}
                            </Badge>
                            <span className="text-xs text-slate-400">
                              {session.ended_at
                                ? `Ended ${formatRelativeTime(session.ended_at)}`
                                : session.started_at
                                  ? `Started ${formatRelativeTime(session.started_at)}`
                                  : ""}
                            </span>
                          </div>
                          <p className="font-medium text-slate-800 text-sm truncate">
                            {session.title}
                          </p>
                          <p className="text-xs text-slate-500">
                            {subjectName} &middot; {teacherName}
                          </p>
                          {session.scheduled_for && (
                            <p className="text-xs text-slate-400 mt-0.5">
                              {formatDateTime(session.scheduled_for)}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        )}
      </div>
    </DashboardLayout>
  );
}
