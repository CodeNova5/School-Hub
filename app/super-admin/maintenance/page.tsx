"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  Loader2,
  Zap,
  ArrowDown,
  Clock,
  Mail,
  PlayCircle,
  CheckCircle2,
  XCircle,
  SkipForward,
  AlertTriangle,
  RefreshCw,
} from "lucide-react";

type TaskId = "charge" | "downgrade" | "expire-grants" | "reminders";

interface TaskResult {
  total?: number;
  processed?: number;
  succeeded?: number;
  failed?: number;
  skipped?: number;
  sent?: number;
  downgraded?: number;
  expired?: number;
  details?: any[];
}

const TASK_DEFINITIONS: {
  id: TaskId;
  label: string;
  description: string;
  icon: React.ReactNode;
  color: string;
  bgColor: string;
  borderColor: string;
}[] = [
  {
    id: "charge",
    label: "Charge Due Subscriptions",
    description: "Charge all schools due for billing that have a stored payment method. On success: renews subscription. On failure: sets 7-day grace period.",
    icon: <Zap className="h-5 w-5" />,
    color: "text-blue-600",
    bgColor: "bg-blue-50 dark:bg-blue-950",
    borderColor: "border-blue-200 dark:border-blue-800",
  },
  {
    id: "downgrade",
    label: "Downgrade Expired Grace Periods",
    description: "Downgrade schools past their 7-day grace period to the Basic plan and send downgrade alerts.",
    icon: <ArrowDown className="h-5 w-5" />,
    color: "text-amber-600",
    bgColor: "bg-amber-50 dark:bg-amber-950",
    borderColor: "border-amber-200 dark:border-amber-800",
  },
  {
    id: "expire-grants",
    label: "Expire Past Plan Grants",
    description: "Expire any manual time-limited plan grants that have passed their end date.",
    icon: <Clock className="h-5 w-5" />,
    color: "text-purple-600",
    bgColor: "bg-purple-50 dark:bg-purple-950",
    borderColor: "border-purple-200 dark:border-purple-800",
  },
  {
    id: "reminders",
    label: "Send Renewal Reminders",
    description: "Send T-7 renewal reminder emails to schools with upcoming billing dates and stored payment methods.",
    icon: <Mail className="h-5 w-5" />,
    color: "text-green-600",
    bgColor: "bg-green-50 dark:bg-green-950",
    borderColor: "border-green-200 dark:border-green-800",
  },
];

function resultSummary(taskId: TaskId, result: TaskResult): string {
  switch (taskId) {
    case "charge":
      return `${result.succeeded ?? 0} succeeded, ${result.failed ?? 0} failed, ${result.skipped ?? 0} skipped`;
    case "downgrade":
      return `${result.downgraded ?? 0} downgraded, ${result.failed ?? 0} failed`;
    case "expire-grants":
      return `${result.expired ?? 0} expired, ${result.failed ?? 0} failed`;
    case "reminders":
      return `${result.sent ?? 0} sent, ${result.skipped ?? 0} skipped, ${result.failed ?? 0} failed`;
    default:
      return "";
  }
}

export default function MaintenancePage() {
  const { toast } = useToast();
  const [runningTask, setRunningTask] = useState<TaskId | "all" | null>(null);
  const [results, setResults] = useState<Record<string, TaskResult> | null>(null);
  const [lastRun, setLastRun] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function runTask(task: TaskId | "all") {
    setRunningTask(task);
    setResults(null);
    setError(null);

    try {
      const res = await fetch("/api/super-admin/maintenance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ task }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Task failed");
      }

      setResults(data.results);
      setLastRun(new Date().toLocaleString());

      // Count total failures
      let totalFailed = 0;
      for (const key of Object.keys(data.results)) {
        const r = data.results[key];
        totalFailed += r.failed ?? 0;
      }

      if (totalFailed > 0) {
        toast({
          title: "⚠️ Completed with errors",
          description: `${totalFailed} operation(s) failed. Check results below.`,
          variant: "destructive",
        });
      } else {
        toast({
          title: "✅ Task completed",
          description: "All operations ran successfully.",
        });
      }
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred");
      toast({
        title: "❌ Task failed",
        description: err.message || "An unexpected error occurred",
        variant: "destructive",
      });
    } finally {
      setRunningTask(null);
    }
  }

  const isRunning = runningTask !== null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Maintenance Tasks</h1>
        <p className="text-muted-foreground mt-1">
          Manually run platform maintenance tasks that were previously handled by the daily cron job.
        </p>
      </div>

      {/* Run All Button */}
      <Card className="border-purple-200 dark:border-purple-800 bg-gradient-to-br from-purple-50/50 to-transparent dark:from-purple-950/20">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-purple-100 dark:bg-purple-900">
                <PlayCircle className="h-6 w-6 text-purple-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold">Run All Maintenance Tasks</h3>
                <p className="text-sm text-muted-foreground">
                  Executes all 4 tasks in sequence: Charge &rarr; Downgrade &rarr; Expire Grants &rarr; Reminders
                </p>
              </div>
            </div>
            <Button
              onClick={() => runTask("all")}
              disabled={isRunning}
              className="bg-purple-600 hover:bg-purple-700 min-w-[140px]"
              size="lg"
            >
              {runningTask === "all" ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Running All...</>
              ) : (
                <><PlayCircle className="h-4 w-4 mr-2" /> Run All Tasks</>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Individual Tasks */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {TASK_DEFINITIONS.map((task) => {
          const taskResult = results?.[
            task.id === "charge"
              ? "charge_subscriptions"
              : task.id === "downgrade"
              ? "downgrade_expired"
              : task.id === "expire-grants"
              ? "expire_plan_grants"
              : "subscription_reminders"
          ];

          return (
            <Card
              key={task.id}
              className={`border-2 ${task.borderColor} transition-all hover:shadow-md`}
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${task.bgColor} ${task.color}`}>
                      {task.icon}
                    </div>
                    <div>
                      <CardTitle className="text-base">{task.label}</CardTitle>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4 min-h-[40px]">
                  {task.description}
                </p>

                {/* Result display */}
                {taskResult && (
                  <div className={`mb-4 p-3 rounded-lg border text-sm ${
                    (taskResult.failed ?? 0) > 0
                      ? "bg-red-50 border-red-200 dark:bg-red-950 dark:border-red-800"
                      : (taskResult.succeeded ?? taskResult.downgraded ?? taskResult.expired ?? taskResult.sent ?? 0) > 0
                      ? "bg-green-50 border-green-200 dark:bg-green-950 dark:border-green-800"
                      : "bg-muted/30 border"
                  }`}>
                    <div className="flex items-center gap-2 mb-1">
                      {(taskResult.failed ?? 0) > 0 ? (
                        <AlertTriangle className="h-4 w-4 text-red-500" />
                      ) : (
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                      )}
                      <span className="font-medium text-xs uppercase tracking-wider">
                        Result
                      </span>
                    </div>
                    <p className="text-xs">{resultSummary(task.id, taskResult)}</p>
                    {taskResult.details && taskResult.details.length > 0 && (
                      <details className="mt-2">
                        <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground">
                          View details ({taskResult.details.length} items)
                        </summary>
                        <div className="mt-2 max-h-32 overflow-y-auto space-y-1">
                          {taskResult.details.map((d: any, i: number) => (
                            <div key={i} className="text-xs flex items-center gap-1.5 py-0.5">
                              {d.status === "success" || d.status === "sent" || d.status === "downgraded" || d.status === "expired" ? (
                                <CheckCircle2 className="h-3 w-3 text-green-500 shrink-0" />
                              ) : d.status === "failed" ? (
                                <XCircle className="h-3 w-3 text-red-500 shrink-0" />
                              ) : (
                                <SkipForward className="h-3 w-3 text-amber-500 shrink-0" />
                              )}
                              <span className="truncate">{d.school_name || d.school_id || `Item ${i + 1}`}</span>
                              {d.status && (
                                <Badge variant="outline" className="text-[10px] px-1 py-0">{d.status}</Badge>
                              )}
                            </div>
                          ))}
                        </div>
                      </details>
                    )}
                  </div>
                )}

                <Button
                  onClick={() => runTask(task.id)}
                  disabled={isRunning}
                  variant="outline"
                  className={`w-full ${task.color} border-current hover:bg-muted`}
                >
                  {runningTask === task.id ? (
                    <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Running...</>
                  ) : (
                    <><PlayCircle className="h-4 w-4 mr-2" /> Run Task</>
                  )}
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Error Display */}
      {error && (
        <Card className="border-red-200 dark:border-red-800 bg-red-50/50 dark:bg-red-950/20">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <XCircle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
              <div>
                <h3 className="font-semibold text-red-700 dark:text-red-400">Error</h3>
                <p className="text-sm text-red-600 dark:text-red-300 mt-1">{error}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Last Run Info */}
      {lastRun && !isRunning && (
        <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
          <RefreshCw className="h-3.5 w-3.5" />
          <span>Last run: {lastRun}</span>
        </div>
      )}
    </div>
  );
}
