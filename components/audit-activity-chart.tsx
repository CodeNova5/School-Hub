"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Bar,
  BarChart,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import {
  Activity,
  CalendarDays,
  TrendingUp,
  AlertCircle,
  Loader2,
} from "lucide-react";
import { CONFIG_TABLES } from "@/lib/admin-audit";

// ── Types ─────────────────────────────────────────────────────────────────

interface DailyCount {
  date: string;
  total: number;
  INSERT: number;
  UPDATE: number;
  DELETE: number;
}

interface StatsResponse {
  daily: DailyCount[];
  summary: {
    totalEvents: number;
    todayEvents: number;
    days: number;
    dateRange: { from: string; to: string };
  };
}

// ── Component ─────────────────────────────────────────────────────────────

interface AuditActivityChartProps {
  showConfigChanges?: boolean;
}

export function AuditActivityChart({ showConfigChanges = true }: AuditActivityChartProps) {
  const [data, setData] = useState<StatsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedDays, setSelectedDays] = useState(7);

  const fetchStats = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set("days", String(selectedDays));
      if (!showConfigChanges) {
        params.set("exclude_tables", Array.from(CONFIG_TABLES).join(","));
      }

      const res = await fetch(`/api/admin/audit-logs/stats?${params}`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Failed to load stats" }));
        throw new Error(err.error || "Failed to load stats");
      }
      const json: StatsResponse = await res.json();
      setData(json);
    } catch (err: any) {
      console.error("Audit stats error:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [selectedDays, showConfigChanges]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  // ── Custom tooltip ──

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    const day = payload[0].payload as DailyCount;
    return (
      <div className="bg-white border rounded-xl shadow-lg px-3.5 py-2.5 text-xs space-y-1.5">
        <p className="font-semibold text-slate-900">
          {new Date(day.date + "T00:00:00").toLocaleDateString("en-GB", {
            weekday: "short",
            day: "numeric",
            month: "short",
          })}
        </p>
        <div className="space-y-0.5 text-slate-600">
          <p>
            Total: <span className="font-semibold text-slate-900">{day.total}</span>
          </p>
          <p className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-emerald-400" />
            Created: {day.INSERT}
          </p>
          <p className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-amber-400" />
            Updated: {day.UPDATE}
          </p>
          <p className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-red-400" />
            Deleted: {day.DELETE}
          </p>
        </div>
      </div>
    );
  };

  // ── Loading state ──

  if (loading && !data) {
    return (
      <Card className="border-slate-200">
        <CardContent className="p-6">
          <div className="flex items-center justify-center min-h-[180px]">
            <div className="text-center space-y-2">
              <Loader2 className="h-6 w-6 animate-spin text-slate-400 mx-auto" />
              <p className="text-xs text-slate-500">Loading activity stats...</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // ── Error state ──

  if (error && !data) {
    return (
      <Card className="border-slate-200">
        <CardContent className="p-6">
          <div className="flex items-center justify-center min-h-[180px]">
            <div className="text-center space-y-2">
              <AlertCircle className="h-6 w-6 text-slate-300 mx-auto" />
              <p className="text-xs text-slate-500">Could not load stats</p>
              <button
                onClick={fetchStats}
                className="text-xs text-blue-600 hover:underline"
              >
                Retry
              </button>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!data) return null;

  const { daily, summary } = data;
  const hasData = daily.some((d) => d.total > 0);

  return (
    <Card className="border-slate-200 overflow-hidden">
      <CardContent className="p-5">
        {/* Summary row */}
        <div className="flex items-start justify-between gap-4 mb-5">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Activity className="w-4 h-4 text-blue-600" />
              <h3 className="text-sm font-semibold text-slate-800">
                Activity Overview
              </h3>
            </div>
            <p className="text-xs text-slate-500">
              {summary.dateRange.from} — {summary.dateRange.to}
            </p>
          </div>

          {/* Period toggle */}
          <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-0.5 shrink-0">
            <button
              onClick={() => setSelectedDays(7)}
              className={`px-2.5 py-1 text-xs font-medium rounded-md transition-all ${
                selectedDays === 7
                  ? "bg-white text-slate-900 shadow-sm border"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              7D
            </button>
            <button
              onClick={() => setSelectedDays(30)}
              className={`px-2.5 py-1 text-xs font-medium rounded-md transition-all ${
                selectedDays === 30
                  ? "bg-white text-slate-900 shadow-sm border"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              30D
            </button>
          </div>
        </div>

        {/* Stat chips */}
        <div className="flex items-center gap-3 flex-wrap mb-5">
          <Badge
            variant="outline"
            className="text-[10px] gap-1.5 bg-blue-50 text-blue-700 border-blue-200"
          >
            <CalendarDays className="w-3 h-3" />
            {summary.totalEvents} event{summary.totalEvents !== 1 ? "s" : ""}
          </Badge>
          <Badge
            variant="outline"
            className="text-[10px] gap-1.5 bg-emerald-50 text-emerald-700 border-emerald-200"
          >
            <TrendingUp className="w-3 h-3" />
            {summary.todayEvents} today
          </Badge>
          <Badge
            variant="outline"
            className="text-[10px] gap-1.5 bg-purple-50 text-purple-700 border-purple-200"
          >
            <Activity className="w-3 h-3" />
            Avg {(summary.totalEvents / summary.days).toFixed(0)}/day
          </Badge>
        </div>

        {/* Bar Chart */}
        {hasData ? (
          <div className="h-48 sm:h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={daily}
                margin={{ top: 4, right: 4, left: -12, bottom: 0 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="#f1f5f9"
                  vertical={false}
                />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 10, fill: "#94a3b8" }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(val: string) => {
                    const d = new Date(val + "T00:00:00");
                    return d.toLocaleDateString("en-GB", {
                      day: "numeric",
                      month: "short",
                    });
                  }}
                  interval={selectedDays === 30 ? 4 : 1}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: "#94a3b8" }}
                  tickLine={false}
                  axisLine={false}
                  allowDecimals={false}
                />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: "#f8fafc" }} />
                <Bar
                  dataKey="INSERT"
                  stackId="a"
                  fill="#10b981"
                  radius={[0, 0, 0, 0]}
                  name="Created"
                />
                <Bar
                  dataKey="UPDATE"
                  stackId="a"
                  fill="#f59e0b"
                  radius={[0, 0, 0, 0]}
                  name="Updated"
                />
                <Bar
                  dataKey="DELETE"
                  stackId="a"
                  fill="#ef4444"
                  radius={[2, 2, 0, 0]}
                  name="Deleted"
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="h-48 flex items-center justify-center">
            <div className="text-center">
              <Activity className="h-8 w-8 text-slate-200 mx-auto mb-2" />
              <p className="text-sm text-slate-500 font-medium">
                No activity in this period
              </p>
              <p className="text-xs text-slate-400 mt-1">
                Admin actions will appear here once logged
              </p>
            </div>
          </div>
        )}

        {/* Legend */}
        {hasData && (
          <div className="flex items-center gap-4 justify-center mt-4 pt-3 border-t border-slate-100">
            <span className="flex items-center gap-1 text-[10px] text-slate-500">
              <span className="h-2 w-2 rounded bg-emerald-400 inline-block" />
              Created
            </span>
            <span className="flex items-center gap-1 text-[10px] text-slate-500">
              <span className="h-2 w-2 rounded bg-amber-400 inline-block" />
              Updated
            </span>
            <span className="flex items-center gap-1 text-[10px] text-slate-500">
              <span className="h-2 w-2 rounded bg-red-400 inline-block" />
              Deleted
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
