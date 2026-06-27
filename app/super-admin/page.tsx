"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
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
  School,
  Users,
  GraduationCap,
  Plus,
  ExternalLink,
  CheckCircle2,
  XCircle,
  Shield,
  BarChart3,
  AlertTriangle,
  ArrowRight,
  Bell,
  Loader2,
} from "lucide-react";
import type { School as SchoolType, SchoolPlan } from "@/lib/types";
import { usePlanDisplayInfo, PLAN_KEYS_IN_ORDER } from "@/hooks/use-plan-display-info";

interface PastDueSubscription {
  school_id: string;
  status: string;
  grace_period_ends_at: string | null;
}

interface AtRiskSchool {
  id: string;
  name: string;
  plan: SchoolPlan;
  daysOverdue?: number;
  graceEndsAt?: string;
}

interface PlatformStats {
  totalSchools: number;
  activeSchools: number;
  suspendedSchools: number;
  totalStudents: number;
  totalTeachers: number;
  planDistribution: Record<SchoolPlan, number>;
}

interface SchoolWithStats extends SchoolType {
  studentCount?: number;
  teacherCount?: number;
}

export default function SuperAdminDashboard() {
  const { getPlanInfo } = usePlanDisplayInfo();
  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [schools, setSchools] = useState<SchoolWithStats[]>([]);
  const [atRiskSchools, setAtRiskSchools] = useState<AtRiskSchool[]>([]);
  const [notifyingSchool, setNotifyingSchool] = useState<string | null>(null);
  const [notifyResult, setNotifyResult] = useState<{ schoolId: string; success: boolean; message: string } | null>(null);
  const [confirmNotify, setConfirmNotify] = useState<AtRiskSchool | null>(null);
  const [loading, setLoading] = useState(true);

  async function handleNotifySuperAdmin(schoolId: string, schoolName: string) {
    setNotifyingSchool(schoolId);
    try {
      const res = await fetch("/api/super-admin/notify-at-risk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ schoolId }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setNotifyResult({ schoolId, success: true, message: `Alert sent for ${schoolName}` });
      } else {
        setNotifyResult({ schoolId, success: false, message: data.error || "Failed to send alert" });
      }
    } catch (err: any) {
      setNotifyResult({ schoolId, success: false, message: err.message || "Network error" });
    } finally {
      setNotifyingSchool(null);
      setTimeout(() => {
        setNotifyResult((prev) => prev?.schoolId === schoolId ? null : prev);
      }, 4000);
    }
  }

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    try {
      setLoading(true);

      // Fetch all schools
      const { data: schoolsData, error: schoolsErr } = await supabase
        .from("schools")
        .select("*")
        .order("created_at", { ascending: false });

      if (schoolsErr) throw schoolsErr;

      // Fetch aggregate counts per school
      const enriched: SchoolWithStats[] = await Promise.all(
        (schoolsData ?? []).map(async (school: SchoolType) => {
          const [{ count: studentCount }, { count: teacherCount }] = await Promise.all([
            supabase
              .from("students")
              .select("*", { count: "exact", head: true })
              .eq("school_id", school.id),
            supabase
              .from("teachers")
              .select("*", { count: "exact", head: true })
              .eq("school_id", school.id),
          ]);
          return {
            ...school,
            studentCount: studentCount ?? 0,
            teacherCount: teacherCount ?? 0,
          };
        })
      );

      setSchools(enriched);

      // Platform-level stats
      const allStudents = enriched.reduce((s, sc) => s + (sc.studentCount ?? 0), 0);
      const allTeachers = enriched.reduce((s, sc) => s + (sc.teacherCount ?? 0), 0);
      const planDist: Record<SchoolPlan, number> = { basic: 0, pro: 0, premium: 0 };
      for (const sc of enriched) {
        const plan = (sc.plan ?? 'basic') as SchoolPlan;
        planDist[plan] = (planDist[plan] || 0) + 1;
      }
      setStats({
        totalSchools: enriched.length,
        activeSchools: enriched.filter((s) => s.is_active).length,
        suspendedSchools: enriched.filter((s) => !s.is_active).length,
        totalStudents: allStudents,
        totalTeachers: allTeachers,
        planDistribution: planDist,
      });

      // Fetch at-risk schools (past-due subscriptions) — wrapped in own try/catch
      try {
        const { data: pastDueSubs } = await supabase
          .from("school_subscriptions")
          .select("school_id, status, grace_period_ends_at")
          .eq("status", "past_due");

        if (pastDueSubs && pastDueSubs.length > 0) {
          const raw = (pastDueSubs as PastDueSubscription[])
            .map((sub: PastDueSubscription) => {
              const school = enriched.find((s: SchoolWithStats) => s.id === sub.school_id);
              if (!school) return null;
              const graceEnd = sub.grace_period_ends_at
                ? new Date(sub.grace_period_ends_at)
                : null;
              const daysRemaining = graceEnd
                ? Math.max(0, Math.ceil((graceEnd.getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
                : 0;
              return {
                id: school.id,
                name: school.name,
                plan: (school.plan as SchoolPlan) || "basic",
                daysOverdue: 7 - daysRemaining,
                graceEndsAt: sub.grace_period_ends_at || undefined,
              } as AtRiskSchool;
            })
            .filter(Boolean) as AtRiskSchool[];
          const atRisk = raw;
          setAtRiskSchools(atRisk);
        } else {
          setAtRiskSchools([]);
        }
      } catch (_err) {
        console.warn("Failed to fetch at-risk subscription data:", _err);
        setAtRiskSchools([]);
      }
    } catch (err) {
      console.error("Failed to load platform data:", err);
    } finally {
      setLoading(false);
    }
  }

  const statCards = [
    {
      label: "Total Schools",
      value: stats?.totalSchools ?? 0,
      icon: <School className="h-5 w-5" />,
      color: "text-blue-600",
      bg: "bg-blue-50 dark:bg-blue-950",
    },
    {
      label: "Active Schools",
      value: stats?.activeSchools ?? 0,
      icon: <CheckCircle2 className="h-5 w-5" />,
      color: "text-green-600",
      bg: "bg-green-50 dark:bg-green-950",
    },
    {
      label: "Total Students",
      value: stats?.totalStudents ?? 0,
      icon: <GraduationCap className="h-5 w-5" />,
      color: "text-purple-600",
      bg: "bg-purple-50 dark:bg-purple-950",
    },
    {
      label: "Total Teachers",
      value: stats?.totalTeachers ?? 0,
      icon: <Users className="h-5 w-5" />,
      color: "text-orange-600",
      bg: "bg-orange-50 dark:bg-orange-950",
    },
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Platform Overview</h1>
          <p className="text-muted-foreground mt-1">Manage all schools on the platform</p>
        </div>
        <div className="flex gap-3">
          <Link href="/super-admin/analytics">
            <Button variant="outline" className="text-purple-600 border-purple-200 hover:bg-purple-50">
              <BarChart3 className="h-4 w-4 mr-2" />
              Analytics
            </Button>
          </Link>
          <Link href="/super-admin/schools">
            <Button className="bg-purple-600 hover:bg-purple-700">
              <Plus className="h-4 w-4 mr-2" />
              New School
            </Button>
          </Link>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {loading
          ? Array.from({ length: 4 }).map((_, i) => (
              <Card key={i}>
                <CardContent className="pt-6 space-y-2">
                  <Skeleton className="h-4 w-1/2" />
                  <Skeleton className="h-8 w-1/3" />
                </CardContent>
              </Card>
            ))
          : statCards.map((card) => (
              <Card key={card.label}>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${card.bg} ${card.color}`}>{card.icon}</div>
                    <div>
                      <p className="text-xs text-muted-foreground">{card.label}</p>
                      <p className="text-2xl font-bold">{card.value.toLocaleString()}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
      </div>

      {/* Plan Distribution */}
      <Card>
        <CardHeader>
          <CardTitle>Plan Distribution</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex gap-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-24 w-full" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-4">
              {PLAN_KEYS_IN_ORDER.map((plan) => {
                const info = getPlanInfo(plan);
                const count = stats?.planDistribution[plan as SchoolPlan] ?? 0;
                const total = stats?.totalSchools ?? 1;
                const pct = Math.round((count / total) * 100);
                return (
                  <div
                    key={plan}
                    className="flex flex-col items-center p-4 rounded-xl border bg-muted/30"
                  >
                    <Shield className={`h-6 w-6 mb-2 ${info.color}`} />
                    <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      {info.label_short}
                    </span>
                    <span className="text-3xl font-bold mt-1">{count}</span>
                    <span className="text-xs text-muted-foreground mt-1">{pct}% of schools</span>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* At-Risk Schools Widget */}
      <Card className={atRiskSchools.length > 0 ? "border-amber-200 dark:border-amber-800" : ""}>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className={`h-5 w-5 ${atRiskSchools.length > 0 ? "text-amber-500" : "text-muted-foreground"}`} />
            At-Risk Schools
            {!loading && atRiskSchools.length > 0 && (
              <Badge variant="destructive" className="ml-2">{atRiskSchools.length}</Badge>
            )}
          </CardTitle>
          <Link href="/super-admin/subscription">
            <Button variant="outline" size="sm">
              Manage Subscriptions
              <ExternalLink className="h-3.5 w-3.5 ml-2" />
            </Button>
          </Link>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Notify result banner */}
          {notifyResult && (
            <div
              className={`flex items-center justify-between px-3 py-2 rounded-lg text-sm ${
                notifyResult.success
                  ? "bg-green-50 border border-green-200 text-green-800 dark:bg-green-950 dark:border-green-800 dark:text-green-200"
                  : "bg-red-50 border border-red-200 text-red-800 dark:bg-red-950 dark:border-red-800 dark:text-red-200"
              }`}
            >
              <div className="flex items-center gap-2">
                {notifyResult.success ? (
                  <CheckCircle2 className="h-4 w-4 shrink-0" />
                ) : (
                  <XCircle className="h-4 w-4 shrink-0" />
                )}
                <span>{notifyResult.message}</span>
              </div>
              <button
                onClick={() => setNotifyResult(null)}
                className="text-xs font-medium hover:underline shrink-0 ml-2"
              >
                Dismiss
              </button>
            </div>
          )}

          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 2 }).map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : atRiskSchools.length === 0 ? (
            <div className="flex items-center justify-center py-8 text-muted-foreground">
              <CheckCircle2 className="h-5 w-5 mr-2 text-green-500" />
              <span>No schools at risk — all subscriptions are in good standing</span>
            </div>
          ) : (
            <div className="space-y-2">
              {atRiskSchools.slice(0, 5).map((school) => {
                const planInfo = getPlanInfo(school.plan);
                const isUrgent = school.daysOverdue !== undefined && school.daysOverdue >= 7;
                return (
                  <div
                    key={school.id}
                    className={`flex items-center justify-between p-3 rounded-lg border ${
                      isUrgent
                        ? "bg-red-50 border-red-200 dark:bg-red-950 dark:border-red-800"
                        : "bg-amber-50 border-amber-200 dark:bg-amber-950 dark:border-amber-800"
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`p-1.5 rounded-full shrink-0 ${
                        isUrgent ? "bg-red-100 dark:bg-red-900" : "bg-amber-100 dark:bg-amber-900"
                      }`}>
                        <AlertTriangle className={`h-4 w-4 ${isUrgent ? "text-red-600" : "text-amber-600"}`} />
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-sm truncate">{school.name}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <Badge
                            variant="secondary"
                            className={`text-[10px] px-1.5 py-0 ${
                              isUrgent ? "bg-red-200 text-red-800 dark:bg-red-800 dark:text-red-200" : "bg-amber-200 text-amber-800 dark:bg-amber-800 dark:text-amber-200"
                            }`}
                          >
                            {planInfo.label_short}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {school.daysOverdue !== undefined
                              ? isUrgent
                                ? "Grace period expired"
                                : `${school.daysOverdue}/7 days overdue`
                              : "Past due"}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="shrink-0 h-8 px-2"
                        title="Send alert to super admins"
                        onClick={() => setConfirmNotify(school)}
                        disabled={notifyingSchool === school.id}
                      >
                        {notifyingSchool === school.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                        ) : (
                          <Bell className="h-3.5 w-3.5 text-muted-foreground hover:text-amber-600" />
                        )}
                      </Button>
                      <Link href={`/super-admin/schools`}>
                        <Button variant="ghost" size="sm" className="shrink-0 h-8 w-8 p-0">
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                      </Link>
                    </div>
                  </div>
                );
              })}
              {atRiskSchools.length > 5 && (
                <div className="text-center pt-2">
                  <Link href="/super-admin/subscription">
                    <Button variant="link" size="sm">
                      View all {atRiskSchools.length} at-risk schools
                      <ArrowRight className="h-3.5 w-3.5 ml-1" />
                    </Button>
                  </Link>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Confirm Notify Dialog */}
      <AlertDialog open={!!confirmNotify} onOpenChange={(open) => { if (!open) setConfirmNotify(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5 text-amber-500" />
              Send alert for {confirmNotify?.name || "this school"}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This will send an at-risk email notification to all super admins about <strong>{confirmNotify?.name}</strong>.
              The email will include the school's current plan ({confirmNotify ? getPlanInfo(confirmNotify.plan).label_short : "-"}),
              overdue status, and details about the failed payment.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-lg p-3 text-sm space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">School</span>
              <span className="font-medium">{confirmNotify?.name}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Plan</span>
              <span className="font-medium">{confirmNotify ? getPlanInfo(confirmNotify.plan).label_short : "-"}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Status</span>
              <span className="font-medium text-amber-600">
                {confirmNotify?.daysOverdue !== undefined && confirmNotify.daysOverdue >= 7
                  ? "Grace period expired"
                  : `${confirmNotify?.daysOverdue || 0}/7 days overdue`}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Recipients</span>
              <span className="font-medium">All super admins</span>
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={notifyingSchool === (confirmNotify?.id || null)}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={notifyingSchool === (confirmNotify?.id || null)}
              onClick={(e) => {
                if (!confirmNotify) return;
                e.preventDefault();
                setConfirmNotify(null);
                handleNotifySuperAdmin(confirmNotify.id, confirmNotify.name);
              }}
              className="bg-amber-600 hover:bg-amber-700 text-white"
            >
              {notifyingSchool === (confirmNotify?.id || null) ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Sending...
                </>
              ) : (
                <>
                  <Bell className="h-4 w-4 mr-2" />
                  Send Alert
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Schools List */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>All Schools</CardTitle>
          <Link href="/super-admin/schools">
            <Button variant="outline" size="sm">
              Manage Schools
              <ExternalLink className="h-3.5 w-3.5 ml-2" />
            </Button>
          </Link>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : schools.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <School className="h-10 w-10 mx-auto mb-3 opacity-40" />
              <p>No schools registered yet.</p>
              <Link href="/super-admin/schools">
                <Button variant="link" className="mt-2">
                  Create your first school
                </Button>
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {schools.map((school) => (
                <div
                  key={school.id}
                  className="flex items-center justify-between p-4 rounded-lg border bg-muted/30"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-full bg-blue-100 dark:bg-blue-900">
                      <School className="h-5 w-5 text-blue-600" />
                    </div>
                    <div>
                      <p className="font-semibold">{school.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {school.subdomain
                          ? `${school.subdomain}.myapp.com`
                          : "No subdomain"}{" "}
                        · {school.studentCount} students · {school.teacherCount} teachers
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge
                      variant={school.is_active ? "default" : "secondary"}
                      className={school.is_active ? "bg-green-500" : ""}
                    >
                      {school.is_active ? (
                        <CheckCircle2 className="h-3 w-3 mr-1" />
                      ) : (
                        <XCircle className="h-3 w-3 mr-1" />
                      )}
                      {school.is_active ? "Active" : "Suspended"}
                    </Badge>
                    <Link href={`/super-admin/schools`}>
                      <Button variant="ghost" size="sm">
                        <ExternalLink className="h-4 w-4" />
                      </Button>
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
