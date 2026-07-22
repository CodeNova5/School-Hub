"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  CheckCircle2,
  AlertCircle,
  Clock,
  Loader2,
  Users,
  GraduationCap,
  ChevronDown,
  ChevronUp,
  ArrowRight,
  RefreshCw,
  Lock,
  Unlock,
  Zap,
  Globe,
  AlertTriangle,
  Calendar,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSessionPromotionStatus } from "@/lib/publication-utils";
import type { SessionPromotionSummary, PromotionProgress } from "@/lib/publication-utils";
import type { Session } from "@/lib/types";

/* ── Staggered delay helper ── */
function delay(i: number) {
  return `${i * 40}ms`;
}

/* ── Props ── */

interface SessionPromotionReadinessProps {
  supabase: SupabaseClient;
  schoolId: string;
  sessionId: string;
  sessionName: string;
  onRefresh: () => void;
  onClassSelect: (classId: string, className: string) => void;
  /** All sessions in the school (used to find the next session for advancing) */
  sessions?: Session[];
  /** Called after the session has been successfully changed */
  onSessionChanged?: () => void;
}

/* ── Component ── */

export function SessionPromotionReadiness({
  supabase,
  schoolId,
  sessionId,
  sessionName,
  onRefresh,
  onClassSelect,
  sessions: allSessions,
  onSessionChanged,
}: SessionPromotionReadinessProps) {
  const [status, setStatus] = useState<SessionPromotionSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(true);
  const [autoProcessing, setAutoProcessing] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);

  const loadStatus = useCallback(async () => {
    if (!schoolId || !sessionId) return;
    setLoading(true);
    setError(null);
    try {
      const result = await getSessionPromotionStatus(supabase, {
        schoolId,
        sessionId,
      });
      setStatus(result);
    } catch (err) {
      console.error("Error loading promotion status:", err);
      setError("Failed to load promotion status");
    } finally {
      setLoading(false);
    }
  }, [supabase, schoolId, sessionId]);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  // ── Advance to Next Session ──
  const [showSessionAdvanceDialog, setShowSessionAdvanceDialog] = useState(false);
  const [isAdvancingSession, setIsAdvancingSession] = useState(false);

  // Find the next session chronologically (sorted by name ascending)
  const nextSession = useMemo(() => {
    if (!allSessions || allSessions.length === 0) return null;
    const sorted = [...allSessions].sort((a, b) => a.name.localeCompare(b.name));
    const currentIndex = sorted.findIndex((s) => s.id === sessionId);
    if (currentIndex === -1 || currentIndex >= sorted.length - 1) return null;
    return sorted[currentIndex + 1];
  }, [allSessions, sessionId]);

  async function handleAdvanceToNextSession() {
    if (!nextSession) return;
    setIsAdvancingSession(true);
    try {
      // Unset all sessions, then set the next session as current
      await supabase
        .from("sessions")
        .update({ is_current: false })
        .eq("school_id", schoolId);
      await supabase
        .from("sessions")
        .update({ is_current: true })
        .eq("school_id", schoolId)
        .eq("id", nextSession.id);

      // Also set the first term of the next session as current
      const { data: nextSessionTerms } = await supabase
        .from("terms")
        .select("id")
        .eq("school_id", schoolId)
        .eq("session_id", nextSession.id)
        .order("start_date", { ascending: true })
        .limit(1);

      if (nextSessionTerms && nextSessionTerms.length > 0) {
        await supabase
          .from("terms")
          .update({ is_current: false })
          .eq("school_id", schoolId);
        await supabase
          .from("terms")
          .update({ is_current: true })
          .eq("school_id", schoolId)
          .eq("id", nextSessionTerms[0].id);
      }

      toast.success(
        `Advanced to ${nextSession.name}! ${sessionName} is now closed and ${nextSession.name} is active.`,
      );
      setShowSessionAdvanceDialog(false);
      onSessionChanged?.();
    } catch (err) {
      console.error("Error advancing session:", err);
      toast.error("Failed to advance to the next session. Please try again.");
    } finally {
      setIsAdvancingSession(false);
    }
  }

  // ── Auto-promote remaining eligible students across all pending classes ──

  async function handleAutoPromoteAll() {
    if (!status || status.isFullyPromoted) return;

    const pending = status.classes.filter((c) => c.status !== "completed");
    if (pending.length === 0) return;

    setShowConfirmDialog(false);
    setAutoProcessing(true);
    try {
      let totalProcessed = 0;
      let totalErrors = 0;

      for (const cls of pending) {
        try {
          // Fetch eligible students for this class
          const params = new URLSearchParams({
            sessionId,
            classId: cls.classId,
            excludeProcessed: "true",
            limit: "100",
            offset: "0",
            statusFilter: "eligible",
          });

          const response = await fetch(
            `/api/admin/promotions?${params}`,
            { cache: "no-store" }
          );

          if (!response.ok) continue;

          const data = await response.json();
          const eligibleStudents = data.students || [];

          if (eligibleStudents.length === 0) continue;

          // Auto-promote each eligible student
          const promotions = eligibleStudents.map((s: any) => {
            const action = s.is_graduating ? "graduate" : "promote";
            return {
              student_id: s.student_id,
              student_name: s.student_name,
              student_number: s.student_number,
              current_class_id: s.current_class_id,
              current_class_name: s.current_class_name,
              education_level: s.education_level,
              department: s.department,
              terms_completed: s.terms_completed,
              cumulative_average: s.cumulative_average,
              cumulative_grade: s.cumulative_average >= 75 ? "A1" : s.cumulative_average >= 70 ? "B2" : s.cumulative_average >= 65 ? "B3" : s.cumulative_average >= 60 ? "C4" : s.cumulative_average >= 55 ? "C5" : s.cumulative_average >= 50 ? "C6" : s.cumulative_average >= 45 ? "D7" : s.cumulative_average >= 40 ? "E8" : "F9",
              action,
              next_class_id: action === "promote" ? s.next_class_id : null,
              notes: action === "graduate"
                ? "Graduated from final class level (auto-promote)"
                : `Auto-promoted to ${s.next_class_name || "next class"} with ${s.cumulative_average.toFixed(1)}% average`,
            };
          });

          const processResponse = await fetch("/api/admin/promotions", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              sessionId,
              classId: cls.classId,
              idempotencyKey: `auto_${Date.now()}_${cls.classId}`,
              promotions,
            }),
          });

          if (processResponse.ok) {
            totalProcessed += promotions.length;
          } else {
            totalErrors++;
          }
        } catch {
          totalErrors++;
        }
      }

      if (totalProcessed > 0) {
        toast.success(`Auto-promoted ${totalProcessed} student(s) across ${pending.length} class(es)`);
      } else {
        toast.info("No eligible students found for auto-promotion");
      }

      await loadStatus();
      onRefresh();
    } catch (err) {
      console.error("Error during auto-promotion:", err);
      toast.error("Auto-promotion failed");
    } finally {
      setAutoProcessing(false);
    }
  }

  // ── Compute confirmation summary ──

  const pendingClasses = status?.classes.filter((c) => c.status !== "completed") || [];
  const totalPendingStudents = pendingClasses.reduce((sum, c) => sum + c.totalStudents, 0);
  const totalProcessedSoFar = pendingClasses.reduce((sum, c) => sum + c.processedStudents, 0);
  const estimatedToProcess = totalPendingStudents - totalProcessedSoFar;

  // ── Empty state ──

  if (!loading && status && status.classes.length === 0) {
    return (
      <Card className="border-slate-200 shadow-sm overflow-hidden">
        <CardHeader className="pb-3 border-b border-slate-100">
          <CardTitle className="text-sm font-semibold text-slate-700 flex items-center gap-2">
            <Globe className="h-4 w-4 text-indigo-500" />
            Promotion Readiness
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6 text-center text-sm text-slate-400">
          <GraduationCap className="h-8 w-8 text-slate-200 mx-auto mb-2" />
          <p>No classes with students found for this session.</p>
        </CardContent>
      </Card>
    );
  }

  // ── Loading ──

  if (loading) {
    return (
      <Card className="border-slate-200 shadow-sm overflow-hidden">
        <CardHeader className="pb-3 border-b border-slate-100">
          <CardTitle className="text-sm font-semibold text-slate-700 flex items-center gap-2">
            <Globe className="h-4 w-4 text-indigo-500" />
            Promotion Readiness
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6 flex items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-slate-300" />
        </CardContent>
      </Card>
    );
  }

  // ── Error ──

  if (error) {
    return (
      <Card className="border-red-200 shadow-sm overflow-hidden">
        <CardHeader className="pb-3 border-b border-red-100">
          <CardTitle className="text-sm font-semibold text-red-700 flex items-center gap-2">
            <AlertCircle className="h-4 w-4" />
            Promotion Readiness
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4">
          <p className="text-sm text-red-600">{error}</p>
          <Button size="sm" variant="outline" onClick={loadStatus} className="mt-2">
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (!status) return null;

  const pendingCount = status.classes.filter((c) => c.status !== "completed").length;

  return (
    <>
      <Card className="border-slate-200 shadow-sm overflow-hidden transition-all duration-200 hover:shadow-md">
        {/* ── Header with readiness indicator ── */}
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full text-left"
        >
          <CardHeader
            className={`pb-3 border-b border-slate-100 transition-colors ${
              status.isFullyPromoted
                ? "bg-gradient-to-r from-green-50 to-emerald-50 hover:from-green-100 hover:to-emerald-100"
                : "bg-gradient-to-r from-amber-50 to-orange-50 hover:from-amber-100 hover:to-orange-100"
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Globe className={`h-4 w-4 ${status.isFullyPromoted ? "text-green-500" : "text-amber-500"}`} />
                <CardTitle className="text-sm font-semibold text-slate-700">
                  Promotion Readiness
                </CardTitle>
                {status.isFullyPromoted ? (
                  <Badge className="bg-green-100 text-green-700 border-green-200 text-[10px] px-1.5 py-0">
                    <Unlock className="h-3 w-3 mr-0.5" />
                    Session Can Change
                  </Badge>
                ) : (
                  <Badge className="bg-amber-100 text-amber-700 border-amber-200 text-[10px] px-1.5 py-0">
                    <Lock className="h-3 w-3 mr-0.5" />
                    {pendingCount} Class(es) Blocking
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-3 text-xs text-slate-500">
                <span className="flex items-center gap-1">
                  <Users className="h-3 w-3" />
                  {status.classes.reduce((sum, c) => sum + c.totalStudents, 0)} students
                </span>
                <span className="flex items-center gap-1">
                  <GraduationCap className="h-3 w-3" />
                  {status.completedClasses}/{status.totalClasses} done
                </span>
                {expanded ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </div>
            </div>

            {/* Readiness message */}
            <p className="text-xs mt-2 text-slate-500">
              {status.isFullyPromoted
                ? `All ${status.totalClasses} class(es) have completed promotions. The session can now be changed.`
                : `${pendingCount} class(es) still need promotions completed before the session can be changed.`}
            </p>

            {/* Progress bar */}
            <div className="mt-3 w-full h-2.5 bg-slate-200 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-700 ease-out ${
                  status.isFullyPromoted
                    ? "bg-green-500"
                    : "bg-amber-400"
                }`}
                style={{
                  width: `${
                    status.totalClasses > 0
                      ? (status.completedClasses / status.totalClasses) * 100
                      : 0
                  }%`,
                }}
              />
            </div>
          </CardHeader>
        </button>

        {/* ── Expanded content ── */}
        {expanded && (
          <CardContent className="p-0">
            {/* Action bar */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-slate-50/50">
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500">
                  {status.isFullyPromoted
                    ? "✓ All promotions complete"
                    : `${pendingCount} class(es) remaining`}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={loadStatus}
                  disabled={loading}
                  className="text-xs h-8"
                >
                  <RefreshCw className={`h-3 w-3 mr-1 ${loading ? "animate-spin" : ""}`} />
                  Refresh
                </Button>
                {!status.isFullyPromoted && (
                  <Button
                    size="sm"
                    onClick={() => setShowConfirmDialog(true)}
                    disabled={autoProcessing || pendingCount === 0}
                    className="text-xs h-8 bg-indigo-600 hover:bg-indigo-700"
                  >
                    {autoProcessing ? (
                      <>
                        <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                        Processing...
                      </>
                    ) : (
                      <>
                        <Zap className="h-3 w-3 mr-1" />
                        Auto-Promote All
                      </>
                    )}
                  </Button>
                )}
              </div>
            </div>

            {/* Class list grouped by status */}
            <div className="divide-y divide-slate-100">
              {/* Completed classes */}
              {status.classes
                .filter((c) => c.status === "completed")
                .map((cls, i) => (
                  <ClassPromotionRow
                    key={cls.classId}
                    cls={cls}
                    style={{ animationDelay: delay(i) }}
                  />
                ))}

              {/* In-progress classes */}
              {status.classes
                .filter((c) => c.status === "in_progress")
                .map((cls, i) => (
                  <ClassPromotionRow
                    key={cls.classId}
                    cls={cls}
                    style={{ animationDelay: delay(i) }}
                  />
                ))}

              {/* Pending classes */}
              {status.classes
                .filter((c) => c.status === "pending")
                .map((cls, i) => (
                  <ClassPromotionRow
                    key={cls.classId}
                    cls={cls}
                    onProcess={() => onClassSelect(cls.classId, cls.className)}
                    style={{ animationDelay: delay(i) }}
                  />
                ))}
            </div>

            {/* Footer summary */}
            <div className="px-4 py-3 border-t border-slate-100 bg-slate-50/50 text-xs text-slate-400">
              <div className="flex items-center justify-between mb-2">
                <span>
                  {status.completedClasses} of {status.totalClasses} classes completed
                </span>
                {status.isFullyPromoted ? (
                  <span className="flex items-center gap-1 text-green-600 font-medium">
                    <Unlock className="h-3 w-3" />
                    Session change is now allowed
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-amber-600 font-medium">
                    <Lock className="h-3 w-3" />
                    Complete all promotions to enable session change
                  </span>
                )}
              </div>

              {/* ── Advance to Next Session CTA ── */}
              {status.isFullyPromoted && nextSession && !nextSession.is_current && (
                <div className="mt-3 rounded-xl border-2 border-green-200 bg-gradient-to-r from-green-50 to-emerald-50 p-4 animate-in fade-in slide-in-from-bottom-2 duration-500">
                  <div className="flex items-start gap-3">
                    <div className="h-10 w-10 rounded-full bg-green-100 flex items-center justify-center shrink-0">
                      <Sparkles className="h-5 w-5 text-green-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm text-green-800">
                        🎉 All promotions complete for {sessionName}!
                      </p>
                      <p className="text-xs text-green-700 mt-0.5">
                        You can now advance to{' '}
                        <strong>{nextSession.name}</strong> to begin the next academic session.
                      </p>
                      <div className="flex items-center gap-2 mt-3">
                        <Button
                          size="sm"
                          onClick={() => setShowSessionAdvanceDialog(true)}
                          className="bg-green-600 hover:bg-green-700 text-white text-xs h-9 px-4 rounded-xl shadow-sm"
                        >
                          <ArrowRight className="h-4 w-4 mr-1.5" />
                          Advance to {nextSession.name}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={loadStatus}
                          className="text-xs h-9 px-3 rounded-xl border-green-200 text-green-700 hover:bg-green-50"
                        >
                          Refresh
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ── No next session exists — guide to Sessions page ── */}
              {status.isFullyPromoted && !nextSession && (
                <div className="mt-3 rounded-xl border-2 border-blue-200 bg-gradient-to-r from-blue-50 to-indigo-50 p-4 animate-in fade-in slide-in-from-bottom-2 duration-500">
                  <div className="flex items-start gap-3">
                    <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                      <Calendar className="h-5 w-5 text-blue-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm text-blue-800">
                        ✅ All promotions complete for {sessionName}!
                      </p>
                      <p className="text-xs text-blue-700 mt-0.5">
                        The next session hasn't been created yet. Go to the{' '}
                        <a
                          href="/admin/sessions"
                          className="font-semibold underline hover:text-blue-900"
                        >
                          Sessions page
                        </a>{' '}
                        to create the next session, then return here to activate it.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        )}
      </Card>

      {/* ── Session Advance Confirmation Dialog ── */}
      <AlertDialog open={showSessionAdvanceDialog} onOpenChange={setShowSessionAdvanceDialog}>
        <AlertDialogContent className="rounded-2xl max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-lg">
              <ArrowRight className="h-5 w-5 text-green-600" />
              Advance to {nextSession?.name || "Next Session"}?
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-3 pt-2">
              <p>
                This will <strong>close {sessionName}</strong> and set{' '}
                <strong>{nextSession?.name || "the next session"}</strong> as the
                active academic session.{' '}
                {nextSession && (
                  <>
                    The <strong>first term</strong> of {nextSession.name} will be
                    set as the active term.
                  </>
                )}
              </p>

              <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
                <strong>⚠️ Before continuing, confirm:</strong>
                <ul className="list-disc list-inside mt-1 space-y-0.5">
                  <li>All classes have completed promotions ✓</li>
                  <li>
                    No further promotions needed for {sessionName}
                  </li>
                  <li>
                    {nextSession?.name || "The next session"} is ready for class setup
                  </li>
                  <li>Teachers are assigned to new classes in the next session</li>
                </ul>
              </div>

              {/* Session comparison */}
              {nextSession && (
                <div className="rounded-lg border border-slate-200 bg-white p-3 space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-500">Closing:</span>
                    <span className="font-semibold text-slate-700">{sessionName}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-500">Opening:</span>
                    <span className="font-semibold text-green-700">{nextSession.name}</span>
                  </div>
                  {nextSession.start_date && (
                    <div className="flex items-center justify-between text-xs text-slate-400">
                      <span>Starts:</span>
                      <span>{new Date(nextSession.start_date).toLocaleDateString()}</span>
                    </div>
                  )}
                </div>
              )}

              <p className="text-xs text-slate-400">
                This action can be undone by setting a different active session on
                the Sessions page.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel className="rounded-xl" disabled={isAdvancingSession}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleAdvanceToNextSession();
              }}
              disabled={isAdvancingSession}
              className="rounded-xl bg-green-600 hover:bg-green-700 text-white"
            >
              {isAdvancingSession ? (
                <>
                  <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                  Advancing...
                </>
              ) : (
                <>
                  <ArrowRight className="h-4 w-4 mr-1.5" />
                  Yes, Advance to {nextSession?.name}
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Auto-Promote Confirmation Dialog ── */}
      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent className="max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-amber-700">
              <AlertTriangle className="h-5 w-5" />
              Confirm Auto-Promote All
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-3 pt-2">
              <p>
                This will automatically promote all eligible students across{" "}
                <strong>{pendingClasses.length}</strong> pending class(es) in{" "}
                <strong>{sessionName}</strong>.
              </p>

              {/* Summary breakdown */}
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-600">Classes to process:</span>
                  <span className="font-semibold">{pendingClasses.length}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-600">Total students in pending classes:</span>
                  <span className="font-semibold">{totalPendingStudents}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-600">Already processed:</span>
                  <span className="font-semibold">{totalProcessedSoFar}</span>
                </div>
                <div className="border-t border-amber-200 pt-2 flex items-center justify-between text-sm font-medium">
                  <span className="text-slate-800">Estimated to process now:</span>
                  <span className="text-indigo-700">{Math.max(0, estimatedToProcess)}</span>
                </div>
              </div>

              {/* Pending classes list */}
              <div>
                <p className="text-xs font-medium text-slate-500 mb-1.5">Classes to be processed:</p>
                <div className="max-h-32 overflow-y-auto space-y-1">
                  {pendingClasses.map((cls) => (
                    <div
                      key={cls.classId}
                      className="flex items-center justify-between text-xs bg-white rounded border border-slate-200 px-2.5 py-1.5"
                    >
                      <span className="font-medium text-slate-700">{cls.className}</span>
                      <span className="text-slate-400">
                        {cls.processedStudents}/{cls.totalStudents} done
                        {cls.processedStudents < cls.totalStudents && (
                          <span className="text-amber-600 ml-1">
                            · {cls.totalStudents - cls.processedStudents} remaining
                          </span>
                        )}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <p className="text-xs text-amber-700 bg-amber-50 rounded-md p-2 border border-amber-200">
                <strong>Note:</strong> Only students who meet the minimum pass mark
                will be promoted. Students needing review will be skipped and can
                be handled individually.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>

          <AlertDialogFooter>
            <AlertDialogCancel disabled={autoProcessing}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleAutoPromoteAll();
              }}
              disabled={autoProcessing}
              className="bg-indigo-600 hover:bg-indigo-700"
            >
              {autoProcessing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <Zap className="h-4 w-4 mr-1.5" />
                  Auto-Promote {Math.max(0, estimatedToProcess)} Student{estimatedToProcess !== 1 ? "s" : ""}
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

/* ── Individual Class Promotion Row ── */

function ClassPromotionRow({
  cls,
  onProcess,
  style,
}: {
  cls: PromotionProgress;
  onProcess?: () => void;
  style?: React.CSSProperties;
}) {
  const completionPercent = cls.totalStudents > 0
    ? Math.min(100, Math.round((cls.processedStudents / cls.totalStudents) * 100))
    : 0;

  return (
    <div
      className={`flex items-center justify-between px-4 py-3 transition-all duration-150 animate-in fade-in slide-in-from-left-2 ${
        cls.status === "completed"
          ? "opacity-80 hover:opacity-100"
          : cls.status === "in_progress"
            ? "bg-blue-50/30 hover:bg-blue-50/60"
            : "hover:bg-amber-50/50"
      }`}
      style={style}
    >
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="font-medium text-sm text-slate-800 truncate">
              {cls.className}
            </p>
            {cls.status === "completed" && (
              <Badge className="bg-green-100 text-green-700 border-green-200 text-[10px] px-1.5 py-0">
                <CheckCircle2 className="h-2.5 w-2.5 mr-0.5" />
                Done
              </Badge>
            )}
            {cls.status === "in_progress" && (
              <Badge className="bg-blue-100 text-blue-700 border-blue-200 text-[10px] px-1.5 py-0">
                <Clock className="h-2.5 w-2.5 mr-0.5" />
                In Progress
              </Badge>
            )}
            {cls.status === "pending" && (
              <Badge className="bg-amber-100 text-amber-700 border-amber-200 text-[10px] px-1.5 py-0">
                <AlertCircle className="h-2.5 w-2.5 mr-0.5" />
                Pending
              </Badge>
            )}
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            <Users className="h-3 w-3 inline mr-0.5 -mt-0.5" />
            {cls.totalStudents} student{cls.totalStudents !== 1 ? "s" : ""}
            {cls.processedStudents > 0 && (
              <span className="ml-2">
                · {cls.processedStudents} processed
              </span>
            )}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-3 shrink-0 ml-3">
        {/* Mini progress bar */}
        {cls.status !== "pending" && (
          <div className="hidden sm:block w-20">
            <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full ${
                  cls.status === "completed"
                    ? "bg-green-500"
                    : "bg-blue-400"
                }`}
                style={{ width: `${completionPercent}%` }}
              />
            </div>
          </div>
        )}

        {cls.status === "pending" && onProcess && (
          <Button
            size="sm"
            variant="outline"
            onClick={onProcess}
            className="text-xs h-8 border-amber-200 text-amber-700 hover:bg-amber-50"
          >
            Process
            <ArrowRight className="h-3 w-3 ml-1" />
          </Button>
        )}

        {cls.status === "in_progress" && onProcess && (
          <Button
            size="sm"
            variant="outline"
            onClick={onProcess}
            className="text-xs h-8"
          >
            Continue
            <ArrowRight className="h-3 w-3 ml-1" />
          </Button>
        )}
      </div>
    </div>
  );
}
