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
import { Checkbox } from "@/components/ui/checkbox";
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
  Eye,
  EyeOff,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Clock,
  Users,
  BookOpen,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  Globe,
  Lock,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getTermPublicationStatus } from "@/lib/publication-utils";
import type { TermPublicationSummary, ClassPublicationStatus } from "@/lib/publication-utils";
import type { Term } from "@/lib/types";

// Staggered animation delay helper
function delay(i: number) {
  return `${i * 40}ms`;
}

/* ── Props ── */

interface TermPublicationOverviewProps {
  supabase: SupabaseClient;
  schoolId: string;
  sessionId: string;
  termId: string;
  termName: string;
  onRefresh: () => void;
  /** All terms in the school (used to find the next term for advancing) */
  terms?: Term[];
  /** Called after the term has been successfully changed */
  onTermChanged?: () => void;
}

/* ── Component ── */

export function TermPublicationOverview({
  supabase,
  schoolId,
  sessionId,
  termId,
  termName,
  onRefresh,
  terms: allTerms,
  onTermChanged,
}: TermPublicationOverviewProps) {
  const [status, setStatus] = useState<TermPublicationSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(true);
  const [publishing, setPublishing] = useState(false);
  const [selectedClasses, setSelectedClasses] = useState<Set<string>>(new Set());

  const loadStatus = useCallback(async () => {
    if (!schoolId || !sessionId || !termId) return;
    setLoading(true);
    setError(null);
    try {
      const result = await getTermPublicationStatus(supabase, {
        schoolId,
        sessionId,
        termId,
      });
      setStatus(result);

      // Auto-select pending classes
      const pending = result.classes
        .filter((c) => !c.is_published && c.has_results)
        .map((c) => c.classId);
      setSelectedClasses(new Set(pending));
    } catch (err) {
      console.error("Error loading publication status:", err);
      setError("Failed to load publication status");
    } finally {
      setLoading(false);
    }
  }, [supabase, schoolId, sessionId, termId]);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  // ── Advance to Next Term ──
  const [showAdvanceDialog, setShowAdvanceDialog] = useState(false);
  const [isAdvancing, setIsAdvancing] = useState(false);

  // Only allow advancing from the currently active term
  const isCurrentTerm =
    allTerms?.find((t: Term) => t.is_current)?.id === termId;

  // Find the next term chronologically (only when fully published)
  const nextTerm = useMemo(() => {
    if (!allTerms || allTerms.length === 0) return null;
    const sessionTerms = allTerms
      .filter((t: Term) => t.session_id === sessionId)
      .sort(
        (a: Term, b: Term) =>
          new Date(a.start_date).getTime() - new Date(b.start_date).getTime(),
      );
    const currentIndex = sessionTerms.findIndex((t: Term) => t.id === termId);
    if (currentIndex === -1 || currentIndex >= sessionTerms.length - 1) return null;
    return sessionTerms[currentIndex + 1];
  }, [allTerms, sessionId, termId]);

  async function handleAdvanceToNextTerm() {
    if (!nextTerm) return;
    setIsAdvancing(true);
    try {
      // Unset all terms, then set the next term as current
      await supabase
        .from("terms")
        .update({ is_current: false })
        .eq("school_id", schoolId);
      await supabase
        .from("terms")
        .update({ is_current: true })
        .eq("school_id", schoolId)
        .eq("id", nextTerm.id);

      toast.success(
        `Advanced to ${nextTerm.name}! ${termName} is now closed and ${nextTerm.name} is active.`,
      );
      setShowAdvanceDialog(false);
      onTermChanged?.();
    } catch (err) {
      console.error("Error advancing term:", err);
      toast.error("Failed to advance to the next term. Please try again.");
    } finally {
      setIsAdvancing(false);
    }
  }

  // ── Bulk Publish ──

  // Load all active component templates to use as defaults for new publications
  const [activeComponents, setActiveComponents] = useState<string[]>([]);

  useEffect(() => {
    if (schoolId) {
      (async () => {
        try {
          const { data } = await supabase
            .from("result_component_templates")
            .select("component_key")
            .eq("school_id", schoolId)
            .eq("is_active", true)
            .order("display_order", { ascending: true });
          setActiveComponents((data || []).map((c: any) => c.component_key));
        } catch {
          // Silently fail — admin can configure components later
        }
      })();
    }
  }, [schoolId]);

  async function handlePublishSelected() {
    if (selectedClasses.size === 0) {
      toast.error("No classes selected for publishing");
      return;
    }

    setPublishing(true);
    try {
      // First, read existing publication records to preserve component selections
      const { data: existingPublications } = await supabase
        .from("results_publication")
        .select("class_id, published_component_keys, is_published_to_parents")
        .eq("school_id", schoolId)
        .eq("session_id", sessionId)
        .eq("term_id", termId)
        .in("class_id", Array.from(selectedClasses));

      const existingMap = new Map<string, any>();
      (existingPublications || []).forEach((p: any) => {
        existingMap.set(p.class_id, p);
      });

      const results = await Promise.allSettled(
        Array.from(selectedClasses).map(async (classId) => {
          const existing = existingMap.get(classId);
          // Preserve existing component keys; for first-time publish, use all active components
          const componentKeys = existing?.published_component_keys?.length > 0
            ? existing.published_component_keys
            : activeComponents;
          const parentsPublished = existing?.is_published_to_parents ?? true;

          const { error } = await supabase.from("results_publication").upsert(
            {
              school_id: schoolId,
              class_id: classId,
              session_id: sessionId,
              term_id: termId,
              is_published: true,
              is_published_to_parents: parentsPublished,
              published_at: new Date().toISOString(),
              published_component_keys: componentKeys,
              calculation_mode: "all",
            },
            {
              onConflict: "class_id,session_id,term_id,school_id",
            },
          );
          if (error) throw error;
        }),
      );

      const succeeded = results.filter((r) => r.status === "fulfilled").length;
      const failed = results.filter((r) => r.status === "rejected").length;

      if (failed > 0) {
        toast.warning(`Published ${succeeded} class(es). ${failed} failed.`);
      } else {
        toast.success(`Published results for ${succeeded} class(es)!`);
      }

      await loadStatus();
      onRefresh();
    } catch (err) {
      console.error("Error publishing:", err);
      toast.error("Failed to publish results");
    } finally {
      setPublishing(false);
    }
  }

  // ── Toggle single class selection ──

  function toggleClass(classId: string) {
    const next = new Set(selectedClasses);
    if (next.has(classId)) {
      next.delete(classId);
    } else {
      next.add(classId);
    }
    setSelectedClasses(next);
  }

  // ── Select/Deselect all pending ──

  function toggleSelectAllPending() {
    if (!status) return;
    const allPending = status.classes
      .filter((c) => !c.is_published)
      .map((c) => c.classId);

    const allSelected = allPending.every((id) => selectedClasses.has(id));
    if (allSelected) {
      // Deselect all pending
      const next = new Set(selectedClasses);
      allPending.forEach((id) => next.delete(id));
      setSelectedClasses(next);
    } else {
      // Select all pending
      const next = new Set(selectedClasses);
      allPending.forEach((id) => next.add(id));
      setSelectedClasses(next);
    }
  }

  // ── Empty state ──

  if (!loading && status && status.classes.length === 0) {
    return (
      <Card className="border-slate-200 shadow-sm overflow-hidden">
        <CardHeader className="pb-3 border-b border-slate-100">
          <CardTitle className="text-sm font-semibold text-slate-700 flex items-center gap-2">
            <Globe className="h-4 w-4 text-indigo-500" />
            Term Publication Overview
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6 text-center text-sm text-slate-400">
          <BookOpen className="h-8 w-8 text-slate-200 mx-auto mb-2" />
          <p>No classes with students found for this term.</p>
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
            Term Publication Overview
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
            Term Publication Overview
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

  const pendingCount = status.classes.filter((c) => !c.is_published).length;
  const canPublish = Array.from(selectedClasses).some(
    (id) => !status.classes.find((c) => c.classId === id)?.is_published,
  );

  return (
    <Card className="border-slate-200 shadow-sm overflow-hidden transition-all duration-200 hover:shadow-md">
      {/* ── Header with summary ―――――――――――――――――――――――――――― */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full text-left"
      >
        <CardHeader className="pb-3 border-b border-slate-100 bg-gradient-to-r from-indigo-50 to-blue-50 hover:from-indigo-100 hover:to-blue-100 transition-colors">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Globe className="h-4 w-4 text-indigo-500" />
              <CardTitle className="text-sm font-semibold text-slate-700">
                Term Publication Overview
              </CardTitle>
              {status.isFullyPublished ? (
                <Badge className="bg-green-100 text-green-700 border-green-200 text-[10px] px-1.5 py-0">
                  <CheckCircle2 className="h-3 w-3 mr-0.5" />
                  All Published
                </Badge>
              ) : (
                <Badge className="bg-amber-100 text-amber-700 border-amber-200 text-[10px] px-1.5 py-0">
                  <AlertCircle className="h-3 w-3 mr-0.5" />
                  {pendingCount} Pending
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-3 text-xs text-slate-500">
              <span className="flex items-center gap-1">
                <Users className="h-3 w-3" />
                {status.totalStudents} students
              </span>
              <span className="flex items-center gap-1">
                <BookOpen className="h-3 w-3" />
                {status.publishedClasses}/{status.totalClasses} classes
              </span>
              {expanded ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </div>
          </div>

          {/* Progress bar */}
          <div className="mt-3 w-full h-2 bg-slate-200 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-700 ease-out ${
                status.isFullyPublished ? "bg-green-500" : "bg-indigo-400"
              }`}
              style={{
                width: `${
                  status.totalClasses > 0
                    ? (status.publishedClasses / status.totalClasses) * 100
                    : 0
                }%`,
              }}
            />
          </div>
        </CardHeader>
      </button>

      {/* ── Expanded content ―――――――――――――――――――――――――――――― */}
      {expanded && (
        <CardContent className="p-0">
          {/* Action bar */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-slate-50/50">
            <div className="flex items-center gap-2">
              <Checkbox
                id="select-all-pending"
                checked={
                  status.classes.filter((c) => !c.is_published).length > 0 &&
                  status.classes
                    .filter((c) => !c.is_published)
                    .every((c) => selectedClasses.has(c.classId))
                }
                onCheckedChange={toggleSelectAllPending}
              />
              <label htmlFor="select-all-pending" className="text-xs text-slate-500 cursor-pointer">
                Select all pending
              </label>
            </div>

            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={loadStatus}
                disabled={loading}
                className="text-xs h-8"
              >
                <Loader2
                  className={`h-3 w-3 mr-1 ${loading ? "animate-spin" : ""}`}
                />
                Refresh
              </Button>
              <Button
                size="sm"
                onClick={handlePublishSelected}
                disabled={publishing || !canPublish || selectedClasses.size === 0}
                className="text-xs h-8 bg-indigo-600 hover:bg-indigo-700"
              >
                {publishing ? (
                  <>
                    <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                    Publishing...
                  </>
                ) : (
                  <>
                    <Eye className="h-3 w-3 mr-1" />
                    Publish Selected ({selectedClasses.size})
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* Class list */}
          <div className="divide-y divide-slate-100">
            {status.classes.map((cls, i) => (
              <ClassRow
                key={cls.classId}
                cls={cls}
                selected={selectedClasses.has(cls.classId)}
                onToggle={() => toggleClass(cls.classId)}
                style={{ animationDelay: delay(i) }}
              />
            ))}
          </div>

          {/* Footer summary */}
          <div className="px-4 py-3 border-t border-slate-100 bg-slate-50/50 text-xs text-slate-400">
            <div className="flex items-center justify-between mb-2">
              <span>
                {status.publishedClasses} of {status.totalClasses} classes published
              </span>
              {status.isFullyPublished ? (
                <span className="flex items-center gap-1 text-green-600 font-medium">
                  <CheckCircle2 className="h-3 w-3" />
                  All report cards are published for {termName}
                </span>
              ) : (
                <span className="flex items-center gap-1 text-amber-600 font-medium">
                  <AlertCircle className="h-3 w-3" />
                  {pendingCount} class(es) still need publishing
                </span>
              )}
            </div>

            {/* ── Advance to Next Term CTA ── */}
            {status.isFullyPublished && isCurrentTerm && nextTerm && !nextTerm.is_current && (
              <div className="mt-3 rounded-xl border-2 border-green-200 bg-gradient-to-r from-green-50 to-emerald-50 p-4 animate-in fade-in slide-in-from-bottom-2 duration-500">
                <div className="flex items-start gap-3">
                  <div className="h-10 w-10 rounded-full bg-green-100 flex items-center justify-center shrink-0">
                    <Sparkles className="h-5 w-5 text-green-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm text-green-800">
                      🎉 All report cards published for {termName}!
                    </p>
                    <p className="text-xs text-green-700 mt-0.5">
                      You can now advance to{' '}
                      <strong>{nextTerm.name}</strong> to begin the next academic period.
                    </p>
                    <div className="flex items-center gap-2 mt-3">
                      <Button
                        size="sm"
                        onClick={() => setShowAdvanceDialog(true)}
                        className="bg-green-600 hover:bg-green-700 text-white text-xs h-9 px-4 rounded-xl shadow-sm"
                      >
                        <ArrowRight className="h-4 w-4 mr-1.5" />
                        Advance to {nextTerm.name}
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

            {/* ── Last term — no next term ── */}
            {status.isFullyPublished && isCurrentTerm && !nextTerm && (
              <div className="mt-3 rounded-xl border-2 border-blue-200 bg-gradient-to-r from-blue-50 to-indigo-50 p-4 animate-in fade-in slide-in-from-bottom-2 duration-500">
                <div className="flex items-start gap-3">
                  <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                    <CheckCircle2 className="h-5 w-5 text-blue-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm text-blue-800">
                      ✅ {termName} fully published!
                    </p>
                    <p className="text-xs text-blue-700 mt-0.5">
                      This is the last term in this session. To proceed, complete student promotions
                      on the{' '}
                      <a
                        href="/admin/promotions"
                        className="font-semibold underline hover:text-blue-900"
                      >
                        Promotions page
                      </a>{' '}
                      before changing to a new session.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      )}
      {/* ── Advance Confirmation Dialog ── */}
      <AlertDialog open={showAdvanceDialog} onOpenChange={setShowAdvanceDialog}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-lg">
              <ArrowRight className="h-5 w-5 text-green-600" />
              Advance to {nextTerm?.name || "Next Term"}?
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-3 pt-2">
              <p>
                This will <strong>close {termName}</strong> and set{' '}
                <strong>{nextTerm?.name || "the next term"}</strong> as the
                active term.
              </p>
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
                <strong>⚠️ Before continuing, confirm:</strong>
                <ul className="list-disc list-inside mt-1 space-y-0.5">
                  <li>All report cards are published ✓</li>
                  <li>
                    No further edits needed for {termName}
                  </li>
                  <li>Teachers are ready to start entering scores for {nextTerm?.name}</li>
                </ul>
              </div>
              <p className="text-xs text-slate-400">
                This action can be undone by setting a different active term on
                the Sessions page.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel className="rounded-xl" disabled={isAdvancing}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleAdvanceToNextTerm();
              }}
              disabled={isAdvancing}
              className="rounded-xl bg-green-600 hover:bg-green-700 text-white"
            >
              {isAdvancing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                  Advancing...
                </>
              ) : (
                <>
                  <ArrowRight className="h-4 w-4 mr-1.5" />
                  Yes, Advance to {nextTerm?.name}
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}

/* ── Individual Class Row ── */

function ClassRow({
  cls,
  selected,
  onToggle,
  style,
}: {
  cls: ClassPublicationStatus;
  selected: boolean;
  onToggle: () => void;
  style?: React.CSSProperties;
}) {
  return (
    <div
      className={`flex items-center justify-between px-4 py-3 transition-all duration-150 animate-in fade-in slide-in-from-left-2 ${
        cls.is_published
          ? "opacity-80 hover:opacity-100"
          : "hover:bg-amber-50/50"
      }`}
      style={style}
    >
      <div className="flex items-center gap-3 min-w-0">
        <Checkbox
          checked={selected}
          onCheckedChange={onToggle}
          disabled={cls.is_published}
          className={cls.is_published ? "opacity-40" : ""}
        />
        <div className="min-w-0">
          <p className="font-medium text-sm text-slate-800 truncate">
            {cls.className}
          </p>
          <p className="text-xs text-slate-400 mt-0.5">
            <Users className="h-3 w-3 inline mr-0.5 -mt-0.5" />
            {cls.studentCount} student{cls.studentCount !== 1 ? "s" : ""}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {cls.is_published ? (
          <>
            <Badge className="bg-green-100 text-green-700 border-green-200 text-xs px-2 py-0">
              <Eye className="h-3 w-3 mr-1" />
              Published
            </Badge>
            {cls.is_published_to_parents && (
              <Badge
                variant="outline"
                className="text-[10px] text-blue-600 border-blue-200 px-1.5 py-0"
              >
                Parents
              </Badge>
            )}
          </>
        ) : cls.has_results ? (
          <Badge className="bg-amber-100 text-amber-700 border-amber-200 text-xs px-2 py-0">
            <Clock className="h-3 w-3 mr-1" />
            Pending
          </Badge>
        ) : (
          <Badge
            variant="outline"
            className="text-xs text-slate-400 border-slate-200 px-2 py-0"
          >
            <Lock className="h-3 w-3 mr-1" />
            No results
          </Badge>
        )}

        {cls.published_at && (
          <span className="text-[10px] text-slate-400 hidden sm:inline">
            {new Date(cls.published_at).toLocaleDateString()}
          </span>
        )}
      </div>
    </div>
  );
}
