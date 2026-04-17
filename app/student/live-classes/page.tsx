"use client";

import { useEffect, useMemo, useState } from "react";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Loader2, Radio } from "lucide-react";

type StudentLiveSession = {
  id: string;
  title: string;
  class_id: string;
  subject_class_id: string | null;
  status: "scheduled" | "live" | "ended" | "cancelled";
  scheduled_for: string | null;
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

export default function StudentLiveClassesPage() {
  const [loading, setLoading] = useState(true);
  const [joiningSessionId, setJoiningSessionId] = useState<string | null>(null);
  const [sessions, setSessions] = useState<StudentLiveSession[]>([]);

  useEffect(() => {
    loadSessions();
  }, []);

  async function loadSessions() {
    try {
      setLoading(true);
      const response = await fetch("/api/student/live-sessions");
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error || "Failed to load live classes");
      }

      setSessions(payload.data ?? []);
    } catch (error: any) {
      toast.error(error.message || "Failed to load live classes");
    } finally {
      setLoading(false);
    }
  }

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

  const sortedSessions = useMemo(() => {
    return [...sessions].sort((a, b) => {
      const aTime = a.scheduled_for || a.created_at;
      const bTime = b.scheduled_for || b.created_at;
      return new Date(bTime).getTime() - new Date(aTime).getTime();
    });
  }, [sessions]);

  if (loading) {
    return (
      <DashboardLayout role="student">
        <div className="flex min-h-[50vh] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout role="student">
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Live Classes</h1>
          <p className="text-sm text-gray-600">Join your subject live classes directly from here.</p>
        </div>

        <Card className="border-green-100 bg-green-50/40">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Radio className="h-5 w-5 text-green-600" />
              Joinable Sessions
            </CardTitle>
          </CardHeader>
          <CardContent>
            {sortedSessions.length === 0 ? (
              <p className="text-sm text-gray-600">No live classes available right now.</p>
            ) : (
              <div className="space-y-3">
                {sortedSessions.map((session) => {
                  const subjectInfo = session.subject_classes;
                  const teacherName = subjectInfo?.teachers
                    ? `${subjectInfo.teachers.first_name} ${subjectInfo.teachers.last_name}`
                    : "Teacher";
                  const subjectName = subjectInfo?.subjects?.name || "Subject Class";

                  return (
                    <div key={session.id} className="rounded-lg border bg-white p-3">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <p className="font-semibold text-gray-900">{session.title}</p>
                          <p className="text-xs text-gray-600">{subjectName} • {teacherName}</p>
                          <p className="text-xs text-gray-500">
                            {session.scheduled_for
                              ? `Scheduled: ${new Date(session.scheduled_for).toLocaleString()}`
                              : `Created: ${new Date(session.created_at).toLocaleString()}`}
                          </p>
                        </div>
                        <Button
                          className="bg-green-600 hover:bg-green-700"
                          onClick={() => joinSession(session.id)}
                          disabled={joiningSessionId === session.id}
                        >
                          {joiningSessionId === session.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                          Join
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
