"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Clock,
  Search,
  Filter,
  ChevronLeft,
  ChevronRight,
  Eye,
  Plus,
  PencilLine,
  Trash2,
  ArrowUpDown,
  AlertCircle,
  Trash,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import {
  TABLE_LABELS,
  operationLabel,
  operationColor,
  getChangedFields,
  formatAuditTimestamp,
  type AdminAuditLogRecord,
  type AuditOperation,
} from "@/lib/admin-audit";

// ─── Detail Sheet ─────────────────────────────────────────────────────────

function AuditDetailSheet({
  log,
  open,
  onClose,
}: {
  log: AdminAuditLogRecord | null;
  open: boolean;
  onClose: () => void;
}) {
  if (!log) return null;

  const changes =
    log.operation === "UPDATE" && log.old_data && log.new_data
      ? getChangedFields(log.old_data, log.new_data)
      : [];

  const renderValue = (val: unknown): string => {
    if (val === null || val === undefined) return "—";
    if (typeof val === "boolean") return val ? "true" : "false";
    if (typeof val === "string" && !isNaN(Date.parse(val)) && val.includes("-"))
      return new Date(val).toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
      });
    if (typeof val === "object") return JSON.stringify(val);
    return String(val);
  };

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader className="mb-6">
          <SheetTitle className="flex items-center gap-2">
            <span
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold border ${operationColor(
                log.operation
              )}`}
            >
              {operationLabel(log.operation)}
            </span>
            <span className="text-base font-semibold text-slate-900">
              {TABLE_LABELS[log.table_name] || log.table_name}
            </span>
          </SheetTitle>
          <SheetDescription>
            <span className="text-xs text-slate-500">
              {formatAuditTimestamp(log.created_at)}
              {log.changed_by_name && ` — by ${log.changed_by_name}`}
            </span>
          </SheetDescription>
        </SheetHeader>

        {/* Metadata */}
        <div className="space-y-3 mb-6">
          <div className="bg-slate-50 rounded-lg p-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-slate-500 font-medium">Table</span>
              <span className="text-slate-800">
                {TABLE_LABELS[log.table_name] || log.table_name}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-500 font-medium">Record ID</span>
              <code className="text-xs text-slate-600 bg-slate-100 px-2 py-0.5 rounded">
                {log.record_id.slice(0, 8)}…
              </code>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-500 font-medium">Operation</span>
              <Badge
                variant="outline"
                className={`text-[10px] font-semibold ${operationColor(log.operation)}`}
              >
                {operationLabel(log.operation)}
              </Badge>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-500 font-medium">Changed by</span>
              <span className="text-slate-800">
                {log.changed_by_name || "Unknown"}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-500 font-medium">Timestamp</span>
              <span className="text-slate-800 text-xs">
                {formatAuditTimestamp(log.created_at)}
              </span>
            </div>
          </div>
        </div>

        {/* Changed fields (for UPDATE) */}
        {changes.length > 0 && (
          <div className="mb-6">
            <h4 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-1.5">
              <ArrowUpDown className="w-4 h-4" />
              Changes ({changes.length})
            </h4>
            <div className="space-y-2">
              {changes.map((c) => (
                <div
                  key={c.field}
                  className="bg-white border border-slate-200 rounded-lg p-3"
                >
                  <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-2">
                    {c.field.replace(/_/g, " ")}
                  </p>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="bg-red-50 border border-red-100 rounded p-2">
                      <p className="text-red-500 font-medium mb-0.5">Before</p>
                      <p className="text-slate-700 break-words">
                        {renderValue(c.oldValue)}
                      </p>
                    </div>
                    <div className="bg-emerald-50 border border-emerald-100 rounded p-2">
                      <p className="text-emerald-600 font-medium mb-0.5">After</p>
                      <p className="text-slate-700 break-words">
                        {renderValue(c.newValue)}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Raw JSON data (for INSERT/DELETE or full review) */}
        <div className="space-y-4">
          {log.new_data && (
            <div>
              <h4 className="text-sm font-semibold text-slate-700 mb-2">New Data</h4>
              <pre className="bg-slate-900 text-slate-100 text-xs p-3 rounded-lg overflow-x-auto max-h-48">
                {JSON.stringify(log.new_data, null, 2)}
              </pre>
            </div>
          )}
          {log.old_data && log.operation !== "UPDATE" && (
            <div>
              <h4 className="text-sm font-semibold text-slate-700 mb-2">Old Data</h4>
              <pre className="bg-slate-900 text-slate-100 text-xs p-3 rounded-lg overflow-x-auto max-h-48">
                {JSON.stringify(log.old_data, null, 2)}
              </pre>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────

export default function AuditLogsPage() {
  const role = "admin"; // Moved role configuration inside the component
  const [isLoading, setIsLoading] = useState(true);
  const [logs, setLogs] = useState<AdminAuditLogRecord[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [tableFilter, setTableFilter] = useState("all");
  const [operationFilter, setOperationFilter] = useState("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [selectedLog, setSelectedLog] = useState<AdminAuditLogRecord | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [isPurging, setIsPurging] = useState(false);

  const LIMIT = 50;

  const loadLogs = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("limit", String(LIMIT));
      params.set("offset", String(currentPage * LIMIT));
      if (tableFilter !== "all") params.set("table_name", tableFilter);
      if (operationFilter !== "all") params.set("operation", operationFilter);
      if (searchQuery.trim()) params.set("search", searchQuery.trim());
      if (fromDate) params.set("from_date", fromDate);
      if (toDate) params.set("to_date", toDate);

      const res = await fetch(`/api/admin/audit-logs?${params}`);
      if (!res.ok) {
        const errText = await res.text();
        console.error("Failed to load audit logs", errText);
        toast.error("Failed to load audit logs");
        return;
      }

      const data = await res.json();
      setLogs(data.logs || []);
      setTotalCount(data.total || 0);
    } catch (err) {
      console.error("Failed to load audit logs", err);
      toast.error("Failed to load audit logs. Check your connection.");
    } finally {
      setIsLoading(false);
    }
  }, [currentPage, tableFilter, operationFilter, searchQuery, fromDate, toDate]);

  // Reload when filters change (reset to page 0)
  useEffect(() => {
    setCurrentPage(0);
  }, [tableFilter, operationFilter, searchQuery, fromDate, toDate]);

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  const totalPages = Math.max(1, Math.ceil(totalCount / LIMIT));

  async function handlePurge() {
    if (!confirm('Delete all audit logs older than 90 days? This action cannot be undone.')) return;
    setIsPurging(true);
    try {
      const res = await fetch('/api/admin/audit-logs/cleanup', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || 'Failed to purge old logs');
        return;
      }
      toast.success(data.message || `Cleaned up ${data.deleted} entries.`);
      loadLogs();
    } catch (err) {
      console.error('Purge error:', err);
      toast.error('Failed to purge old logs');
    } finally {
      setIsPurging(false);
    }
  }

  function openDetail(log: AdminAuditLogRecord) {
    setSelectedLog(log);
    setDetailOpen(true);
  }

  // ── Operation icon ──

  function OperationIcon({ op }: { op: AuditOperation }) {
    switch (op) {
      case "INSERT":
        return <Plus className="w-3.5 h-3.5" />;
      case "UPDATE":
        return <PencilLine className="w-3.5 h-3.5" />;
      case "DELETE":
        return <Trash2 className="w-3.5 h-3.5" />;
    }
  }

  // ── Table options for the filter dropdown ──

  const tableOptions = useMemo(() => {
    const entries = Object.entries(TABLE_LABELS).sort(([, a], [, b]) =>
      a.localeCompare(b)
    );
    return entries;
  }, []);

  // ── Render ──

  return (
    <DashboardLayout role={role}>
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 pb-12">
        {/* Header */}
        <div className="sticky top-0 z-50 bg-white border-b border-slate-200 shadow-sm">
          <div className="container mx-auto px-4 py-4">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <h1 className="text-2xl font-bold text-slate-900">
                  Admin Audit Trail
                </h1>
                <p className="text-sm text-slate-500">
                  Every change made by admins across the school
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handlePurge}
                  disabled={isPurging}
                  className="text-xs gap-1.5 border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
                >
                  {isPurging ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Trash className="w-3.5 h-3.5" />
                  )}
                  Purge Old Logs
                </Button>
                <Badge variant="outline" className="text-xs gap-1.5">
                  <Clock className="w-3.5 h-3.5" />
                  {totalCount} event{totalCount !== 1 ? "s" : ""}
                </Badge>
              </div>
            </div>
          </div>
        </div>

        <div className="container mx-auto px-4 py-8">
          {/* Filters */}
          <Card className="mb-6 border-slate-200">
            <CardContent className="pt-5">
              <div className="flex flex-col md:flex-row items-start md:items-center gap-4">
                <div className="relative flex-1 w-full">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input
                    placeholder="Search by admin name..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9 h-10 text-sm"
                  />
                </div>

                <div className="flex items-center gap-3 w-full md:w-auto">
                  <div className="flex flex-col gap-1.5 w-full md:w-48">
                    <Label className="text-[10px] text-slate-500 font-semibold uppercase tracking-wide">
                      Table
                    </Label>
                    <Select value={tableFilter} onValueChange={setTableFilter}>
                      <SelectTrigger className="h-10 text-sm">
                        <SelectValue placeholder="All Tables" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Tables</SelectItem>
                        {tableOptions.map(([key, label]) => (
                          <SelectItem key={key} value={key}>
                            {label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex flex-col gap-1.5 w-full md:w-36">
                    <Label className="text-[10px] text-slate-500 font-semibold uppercase tracking-wide">
                      Action
                    </Label>
                    <Select
                      value={operationFilter}
                      onValueChange={setOperationFilter}
                    >
                      <SelectTrigger className="h-10 text-sm">
                        <SelectValue placeholder="All Actions" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Actions</SelectItem>
                        <SelectItem value="INSERT">Created</SelectItem>
                        <SelectItem value="UPDATE">Updated</SelectItem>
                        <SelectItem value="DELETE">Deleted</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="flex items-center gap-3 w-full md:w-auto">
                  <div className="flex flex-col gap-1.5 w-full md:w-40">
                    <Label className="text-[10px] text-slate-500 font-semibold uppercase tracking-wide">
                      From Date
                    </Label>
                    <Input
                      type="date"
                      value={fromDate}
                      onChange={(e) => setFromDate(e.target.value)}
                      className="h-10 text-sm"
                    />
                  </div>
                  <div className="flex flex-col gap-1.5 w-full md:w-40">
                    <Label className="text-[10px] text-slate-500 font-semibold uppercase tracking-wide">
                      To Date
                    </Label>
                    <Input
                      type="date"
                      value={toDate}
                      onChange={(e) => setToDate(e.target.value)}
                      className="h-10 text-sm"
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between mt-4 pt-3 border-t border-slate-100">
                <p className="text-xs text-slate-400 flex items-center gap-1.5">
                  <Filter className="w-3 h-3" />
                  Page {currentPage + 1} of {totalPages} ({totalCount} total)
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Loading state */}
          {isLoading && (
            <div className="flex min-h-[40vh] items-center justify-center">
              <div className="text-center space-y-3">
                <div className="mx-auto h-8 w-8 rounded-full border-2 border-blue-200 border-t-blue-600 animate-spin" />
                <p className="text-sm text-gray-500 font-medium">
                  Loading audit trail...
                </p>
              </div>
            </div>
          )}

          {/* Empty state */}
          {!isLoading && logs.length === 0 && (
            <Card className="border-slate-200">
              <CardContent className="py-16 text-center">
                <AlertCircle className="w-12 h-12 text-slate-200 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-slate-700 mb-1">
                  No Results Found
                </h3>
                <p className="text-sm text-slate-500 max-w-md mx-auto">
                  {tableFilter !== "all" || operationFilter !== "all" || searchQuery.trim() || fromDate || toDate
                    ? "Try adjusting your filters or search query."
                    : "Admin actions like creating students, editing teachers, or updating classes will appear here automatically once the audit migration has been applied."}
                </p>
              </CardContent>
            </Card>
          )}

          {/* Audit log entries */}
          {!isLoading && logs.length > 0 && (
            <Card className="border-slate-200">
              <CardContent className="p-0 divide-y divide-slate-100">
                {logs.map((log) => (
                  <div
                    key={log.id}
                    className="flex items-start gap-4 px-6 py-4 hover:bg-slate-50/50 transition-colors"
                  >
                    {/* Operation icon */}
                    <div
                      className={`flex items-center justify-center w-9 h-9 rounded-xl border shrink-0 ${operationColor(
                        log.operation
                      )}`}
                    >
                      <OperationIcon op={log.operation} />
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-0.5">
                        <Badge
                          variant="outline"
                          className={`text-[10px] font-semibold ${operationColor(
                            log.operation
                          )}`}
                        >
                          {operationLabel(log.operation)}
                        </Badge>
                        <span className="text-xs font-medium text-slate-600">
                          {TABLE_LABELS[log.table_name] || log.table_name}
                        </span>
                        <span className="text-xs text-slate-400">·</span>
                        <span className="text-xs text-slate-400">
                          {formatAuditTimestamp(log.created_at)}
                        </span>
                      </div>

                      {/* Changed fields summary for UPDATE */}
                      {log.operation === "UPDATE" &&
                        log.old_data &&
                        log.new_data && (
                          <p className="text-xs text-slate-500 mt-1">
                            {(() => {
                              const changes = getChangedFields(
                                log.old_data,
                                log.new_data
                              );
                              if (changes.length === 0) return "No visible changes";
                              const fieldLabels = changes
                                .slice(0, 3)
                                .map((c) => c.field.replace(/_/g, " "));
                              const remaining = changes.length - 3;
                              return (
                                <>
                                  Changed:{" "}
                                  <span className="text-slate-700 font-medium">
                                    {fieldLabels.join(", ")}
                                    {remaining > 0 &&
                                      ` +${remaining} more`}
                                  </span>
                                </>
                              );
                            })()}
                          </p>
                        )}

                      {/* For INSERT/DELETE, show a simple description */}
                      {log.operation !== "UPDATE" && (
                        <p className="text-xs text-slate-500 mt-1">
                          {log.operation === "INSERT"
                            ? "Record created"
                            : "Record deleted"}
                        </p>
                      )}
                    </div>

                    {/* Actor + View button */}
                    <div className="shrink-0 flex items-center gap-3">
                      <div className="text-right">
                        {log.changed_by_name && (
                          <p className="text-xs font-medium text-slate-600">
                            {log.changed_by_name}
                          </p>
                        )}
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-slate-400 hover:text-blue-600"
                        title="View details"
                        onClick={() => openDetail(log)}
                      >
                        <Eye className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-6">
              <p className="text-xs text-slate-500">
                Page {currentPage + 1} of {totalPages}
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCurrentPage((p) => Math.max(0, p - 1))}
                  disabled={currentPage === 0}
                  className="p-2 rounded-md border border-slate-200 text-slate-500 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>

                {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                  let pageNum: number;
                  if (totalPages <= 7) {
                    pageNum = i;
                  } else if (currentPage < 3) {
                    pageNum = i;
                  } else if (currentPage > totalPages - 4) {
                    pageNum = totalPages - 7 + i;
                  } else {
                    pageNum = currentPage - 3 + i;
                  }
                  return (
                    <button
                      key={pageNum}
                      onClick={() => setCurrentPage(pageNum)}
                      className={`min-w-[32px] h-8 px-2 rounded-md text-sm font-semibold transition-colors ${
                        currentPage === pageNum
                          ? "bg-blue-600 text-white"
                          : "border border-slate-200 text-slate-600 hover:bg-slate-100"
                      }`}
                    >
                      {pageNum + 1}
                    </button>
                  );
                })}

                <button
                  onClick={() =>
                    setCurrentPage((p) => Math.min(totalPages - 1, p + 1))
                  }
                  disabled={currentPage >= totalPages - 1}
                  className="p-2 rounded-md border border-slate-200 text-slate-500 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Detail Sheet */}
      <AuditDetailSheet
        log={selectedLog}
        open={detailOpen}
        onClose={() => {
          setDetailOpen(false);
          setSelectedLog(null);
        }}
      />
    </DashboardLayout>
  );
}