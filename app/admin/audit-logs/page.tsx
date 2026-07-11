"use client";

import { useEffect, useState, useMemo, useCallback, useRef } from "react";
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
  Clock,
  Search,
  Filter,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Eye,
  Plus,
  PencilLine,
  Trash2,
  ArrowUpDown,
  AlertCircle,
  Trash,
  Loader2,
  Sparkles,
  Bot,
  Download,
  RotateCcw,
  CheckCircle2,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/components/auth-provider";
import { AuditActivityChart } from "@/components/audit-activity-chart";
import {
  TABLE_LABELS,
  operationLabel,
  operationColor,
  getChangedFields,
  formatAuditTimestamp,
  CONFIG_TABLES,
  type AdminAuditLogRecord,
  type AuditOperation,
} from "@/lib/admin-audit";

// ─── Time Ago Helper ──────────────────────────────────────────────────────

function timeAgo(dateStr: string): string {
  const now = Date.now();
  const date = new Date(dateStr).getTime();
  const diffMs = now - date;
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSecs < 60) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)}mo ago`;
  return `${Math.floor(diffDays / 365)}y ago`;
}

// ─── Export to CSV ────────────────────────────────────────────────────────

function exportToCSV(logs: AdminAuditLogRecord[]) {
  const headers = [
    "Timestamp",
    "Operation",
    "Table",
    "Record ID",
    "Changed By",
    "Details",
  ];

  const rows = logs.map((log) => {
    const changes =
      log.operation === "UPDATE" && log.old_data && log.new_data
        ? getChangedFields(log.old_data, log.new_data)
            .slice(0, 5)
            .map((c) => `${c.field}: ${c.oldValue} \u2192 ${c.newValue}`)
            .join("; ")
        : log.operation === "INSERT"
          ? "Record created"
          : "Record deleted";

    return [
      formatAuditTimestamp(log.created_at),
      operationLabel(log.operation),
      TABLE_LABELS[log.table_name] || log.table_name,
      log.record_id.slice(0, 8) + "\u2026",
      log.changed_by_name || "Unknown",
      log.ai_summary || changes,
    ];
  });

  const csvContent = [
    headers.join(","),
    ...rows.map((row) =>
      row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")
    ),
  ].join("\n");

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `audit-logs-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Generate AI Summary Helper ───────────────────────────────────────────

async function generateSummaryForLog(
  logId: string
): Promise<{ summary: string; undo_description?: string } | null> {
  try {
    const res = await fetch("/api/admin/audit-logs/summarize", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ log_id: logId }),
    });
    const data = await res.json();
    if (!res.ok) {
      console.warn("AI summary failed:", data.error);
      return null;
    }
    return { summary: data.summary, undo_description: data.undo_description };
  } catch {
    return null;
  }
}

// ─── Detail Sheet ─────────────────────────────────────────────────────────

function AuditDetailSheet({
  log,
  open,
  onClose,
  onFilterByAdmin,
}: {
  log: AdminAuditLogRecord | null;
  open: boolean;
  onClose: () => void;
  onFilterByAdmin?: (name: string) => void;
}) {
  if (!log) return null;
  const logId = log.id;

  const [aiSummary, setAiSummary] = useState<string | null>(log.ai_summary || null);
  const [undoDescription, setUndoDescription] = useState<string | null>(log.undo_description || null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  // Reset AI state when switching to a different log entry
  useEffect(() => {
    setAiSummary(log.ai_summary || null);
    setUndoDescription(log.undo_description || null);
    setAiLoading(false);
    setAiError(null);
  }, [logId, log.ai_summary, log.undo_description]);

  const changes =
    log.operation === "UPDATE" && log.old_data && log.new_data
      ? getChangedFields(log.old_data, log.new_data)
      : [];

  async function generateAISummary() {
    setAiLoading(true);
    setAiError(null);
    const result = await generateSummaryForLog(logId);
    if (result) {
      setAiSummary(result.summary);
      if (result.undo_description) setUndoDescription(result.undo_description);
    } else {
      setAiError("Failed to generate AI summary");
    }
    setAiLoading(false);
  }

  const renderValue = (val: unknown): string => {
    if (val === null || val === undefined) return "\u2014";
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
            {log.undone_at && (
              <Badge
                variant="outline"
                className="text-[10px] gap-1 bg-slate-100 text-slate-500 border-slate-200 font-normal"
              >
                <RotateCcw className="w-2.5 h-2.5" />
                Undone
              </Badge>
            )}
          </SheetTitle>
          <SheetDescription>
            <span className="text-xs text-slate-500 flex items-center gap-2">
              <span>{formatAuditTimestamp(log.created_at)}</span>
              <span className="text-slate-300">\u00b7</span>
              <span className="text-purple-500 font-medium">
                {timeAgo(log.created_at)}
              </span>
              {log.changed_by_name && (
                <>
                  <span className="text-slate-300">\u00b7</span>
                  <span>by </span>
                  <button
                    onClick={() => onFilterByAdmin?.(log.changed_by_name!)}
                    className="text-blue-600 hover:text-blue-800 hover:underline font-medium transition-colors"
                  >
                    {log.changed_by_name}
                  </button>
                </>
              )}
            </span>
          </SheetDescription>
        </SheetHeader>

        {/* AI Summary */}
        <div className="mb-6">
          {aiSummary ? (
            <div className="bg-gradient-to-br from-purple-50 to-blue-50 border border-purple-200 rounded-lg p-4 animate-in fade-in slide-in-from-top-2 duration-300">
              <div className="flex items-start gap-2">
                <Bot className="w-4 h-4 text-purple-500 mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs font-semibold text-purple-700 mb-1">
                    AI Explanation
                  </p>
                  <p className="text-sm text-slate-700 leading-relaxed">
                    {aiSummary}
                  </p>
                </div>
              </div>
              {undoDescription && (
                <div className="mt-3 pt-3 border-t border-purple-200/50 flex items-start gap-2">
                  <RotateCcw className="w-3.5 h-3.5 text-amber-500 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs font-semibold text-amber-700 mb-0.5">
                      What undoing this will do
                    </p>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      {undoDescription}
                    </p>
                  </div>
                </div>
              )}
            </div>
          ) : aiError ? (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <p className="text-xs text-red-600">{aiError}</p>
              <button
                onClick={generateAISummary}
                className="text-xs text-red-700 underline mt-1 hover:no-underline"
              >
                Retry
              </button>
            </div>
          ) : null}

          {!aiSummary && !aiLoading && !aiError && (
            <Button
              variant="outline"
              size="sm"
              onClick={generateAISummary}
              className="text-xs gap-1.5 border-purple-200 text-purple-600 hover:bg-purple-50 hover:text-purple-700 w-full"
            >
              <Sparkles className="w-3.5 h-3.5" />
              Explain this change with AI
            </Button>
          )}

          {aiLoading && (
            <div className="flex items-center gap-2 text-xs text-purple-600 bg-purple-50 border border-purple-200 rounded-lg p-3">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              Generating AI explanation...
            </div>
          )}
        </div>

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
                {log.record_id.slice(0, 8)}\u2026
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
              {log.changed_by_name ? (
                <button
                  onClick={() => onFilterByAdmin?.(log.changed_by_name!)}
                  className="text-blue-600 hover:text-blue-800 hover:underline font-medium transition-colors"
                >
                  {log.changed_by_name}
                </button>
              ) : (
                <span className="text-slate-400 italic">Unknown</span>
              )}
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-500 font-medium">Timestamp</span>
              <span className="text-slate-800 text-xs flex items-center gap-1.5">
                {formatAuditTimestamp(log.created_at)}
                <span className="text-purple-500 font-medium">
                  ({timeAgo(log.created_at)})
                </span>
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

// ─── Build a human-readable change description ────────────────────────────

function buildChangeDescription(log: AdminAuditLogRecord): {
  primary: string;
  detail: string | null;
} {
  // If AI summary is available, use it as the primary description
  if (log.ai_summary) {
    return { primary: log.ai_summary, detail: null };
  }

  const tableLabel = TABLE_LABELS[log.table_name] || log.table_name.replace(/_/g, " ");

  switch (log.operation) {
    case "INSERT":
      return {
        primary: `Created a new ${tableLabel.toLowerCase()} record`,
        detail: null,
      };
    case "UPDATE": {
      if (!log.old_data || !log.new_data) {
        return { primary: `Updated a ${tableLabel.toLowerCase()} record`, detail: null };
      }
      const changes = getChangedFields(log.old_data, log.new_data);
      if (changes.length === 0) {
        return { primary: `Updated a ${tableLabel.toLowerCase()} record`, detail: null };
      }

      // Build a smart description from field changes
      // Group related fields and produce natural-language descriptions
      const hasNameChange = changes.some((c) =>
        ["first_name", "last_name", "name"].includes(c.field)
      );
      const hasClassChange = changes.some((c) => c.field === "class_id");
      const hasEmailChange = changes.some((c) => c.field === "email");
      const hasStatusChange = changes.some((c) =>
        ["is_active", "status", "activation_used"].includes(c.field)
      );
      const hasPhoneChange = changes.some((c) => c.field === "phone");
      const hasTeacherChange = changes.some((c) => c.field === "class_teacher_id");
      const smartParts: string[] = [];

      if (hasNameChange) {
        const oldFirst = changes.find((c) => c.field === "first_name")?.oldValue;
        const newFirst = changes.find((c) => c.field === "first_name")?.newValue;
        const oldLast = changes.find((c) => c.field === "last_name")?.oldValue;
        const newLast = changes.find((c) => c.field === "last_name")?.newValue;
        if (oldFirst || oldLast || newFirst || newLast) {
          const oldName = [oldFirst, oldLast].filter(Boolean).join(" ") || "—";
          const newName = [newFirst, newLast].filter(Boolean).join(" ") || "—";
          if (oldName !== newName) {
            smartParts.push(`renamed from “${oldName}” to “${newName}”`);
          }
        } else {
          smartParts.push("name");
        }
      }
      if (hasClassChange) {
        smartParts.push("moved to a different class");
      }
      if (hasEmailChange) {
        const oldEmail = changes.find((c) => c.field === "email")?.oldValue;
        const newEmail = changes.find((c) => c.field === "email")?.newValue;
        if (oldEmail && newEmail && String(oldEmail).length < 60) {
          smartParts.push(`email from ${oldEmail} to ${newEmail}`);
        } else {
          smartParts.push("email");
        }
      }
      if (hasStatusChange) {
        const oldStatus = changes.find((c) => c.field === "is_active")?.oldValue;
        const newStatus = changes.find((c) => c.field === "is_active")?.newValue;
        if (oldStatus !== undefined && newStatus !== undefined) {
          smartParts.push(
            newStatus === true || newStatus === "active"
              ? "activated the account"
              : "deactivated the account"
          );
        } else {
          smartParts.push("status");
        }
      }
      if (hasPhoneChange) {
        const oldPhone = changes.find((c) => c.field === "phone")?.oldValue;
        const newPhone = changes.find((c) => c.field === "phone")?.newValue;
        if (oldPhone && newPhone) {
          smartParts.push(`phone to ${newPhone}`);
        } else {
          smartParts.push("phone number");
        }
      }
      if (hasTeacherChange) {
        smartParts.push("assigned a new class teacher");
      }

      // For remaining changes not covered above, add them generically
      const coveredFields = new Set([
        "first_name",
        "last_name",
        "name",
        "class_id",
        "email",
        "is_active",
        "status",
        "activation_used",
        "phone",
        "class_teacher_id",
        "activation_token_hash",
        "user_id",
      ]);
      for (const c of changes) {
        if (coveredFields.has(c.field)) continue;
        const fieldName = c.field.replace(/_/g, " ");
        const oldStr = String(c.oldValue ?? "—");
        const newStr = String(c.newValue ?? "—");
        if (
          (c.field.endsWith("_id") || c.field === "id") &&
          typeof c.oldValue === "string" &&
          c.oldValue.length > 20
        ) {
          smartParts.push(fieldName.replace(/_id$/, ""));
        } else if (
          typeof c.oldValue === "boolean" ||
          typeof c.newValue === "boolean"
        ) {
          smartParts.push(`${fieldName} → ${newStr}`);
        } else if (oldStr.length < 50 && newStr.length < 50) {
          smartParts.push(`${fieldName}: ${oldStr} → ${newStr}`);
        } else {
          smartParts.push(fieldName);
        }
      }

      // Remove duplicates
      const uniqueParts = [...new Set(smartParts)];

      if (uniqueParts.length === 0) {
        return { primary: `Updated a ${tableLabel.toLowerCase()} record`, detail: null };
      }

      const extra = changes.length > uniqueParts.length
        ? ` +${changes.length - uniqueParts.length} more`
        : "";
      const primary = uniqueParts[0].charAt(0).toUpperCase() + uniqueParts[0].slice(1) +
        (uniqueParts.length > 1
          ? `, ${uniqueParts.slice(1).join(", ")}`
          : "") + extra;
      return { primary, detail: null };
    }
    case "DELETE":
      return {
        primary: `Deleted a ${tableLabel.toLowerCase()} record`,
        detail: null,
      };
    default:
      return { primary: `Action on ${tableLabel.toLowerCase()}`, detail: null };
  }
}

// ─── Main Component ───────────────────────────────────────────────────────

export default function AuditLogsPage() {
  const { user } = useAuth();
  const role = (user?.role || "admin") as "admin" | "teacher" | "student" | "parent";

  const [isLoading, setIsLoading] = useState(true);
  const [logs, setLogs] = useState<AdminAuditLogRecord[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [tableFilter, setTableFilter] = useState("all");
  const [operationFilter, setOperationFilter] = useState("all");
  const [undoneFilter, setUndoneFilter] = useState("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [selectedLog, setSelectedLog] = useState<AdminAuditLogRecord | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [isPurging, setIsPurging] = useState(false);
  const [purgeDialogOpen, setPurgeDialogOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(true);
  const [showConfigChanges, setShowConfigChanges] = useState(true);
  const [undoingId, setUndoingId] = useState<string | null>(null);
  const [undoConfirmId, setUndoConfirmId] = useState<string | null>(null);
  const [generatingIds, setGeneratingIds] = useState<Set<string>>(new Set());
  const autoGeneratedRef = useRef(false);

  const LIMIT = 50;

  // ── Debounce search input ──

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // ── Load logs ──

  const loadLogs = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("limit", String(LIMIT));
      params.set("offset", String(currentPage * LIMIT));
      if (tableFilter !== "all") params.set("table_name", tableFilter);
      if (operationFilter !== "all") params.set("operation", operationFilter);
      if (debouncedSearch.trim()) params.set("search", debouncedSearch.trim());
      if (fromDate) params.set("from_date", fromDate);
      if (toDate) params.set("to_date", toDate);
      if (!showConfigChanges) {
        params.set("exclude_tables", Array.from(CONFIG_TABLES).join(","));
      }
      if (undoneFilter !== "all") {
        params.set("undone_status", undoneFilter);
      }

      const res = await fetch(`/api/admin/audit-logs?${params}`);
      if (!res.ok) {
        const errText = await res.text();
        console.error("Failed to load audit logs", errText);
        toast.error("Failed to load audit logs");
        return;
      }

      const data = await res.json();
      const fetchedLogs: AdminAuditLogRecord[] = data.logs || [];
      setLogs(fetchedLogs);
      setTotalCount(data.total || 0);
    } catch (err) {
      console.error("Failed to load audit logs", err);
      toast.error("Failed to load audit logs. Check your connection.");
    } finally {
      setIsLoading(false);
    }
  }, [currentPage, tableFilter, operationFilter, debouncedSearch, fromDate, toDate, showConfigChanges, undoneFilter]);

  // Reload when filters change (reset to page 0)
  useEffect(() => {
    setCurrentPage(0);
    autoGeneratedRef.current = false; // Reset auto-generation flag
  }, [tableFilter, operationFilter, debouncedSearch, fromDate, toDate, showConfigChanges, undoneFilter]);

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  // Auto-generate AI summaries in the background AFTER logs load,
  // without blocking the UI. Only runs once per filter set.
  useEffect(() => {
    if (logs.length === 0 || autoGeneratedRef.current) return;
    const logsWithoutSummary = logs.filter(
      (l) => !l.ai_summary && !l.undo_description
    );
    if (logsWithoutSummary.length === 0) {
      autoGeneratedRef.current = true;
      return;
    }
    autoGeneratedRef.current = true;

    const toGenerate = logsWithoutSummary.slice(0, 3);
    let cancelled = false;

    (async () => {
      for (const log of toGenerate) {
        if (cancelled) break;
        setGeneratingIds((prev) => new Set(prev).add(log.id));
        const result = await generateSummaryForLog(log.id);
        if (cancelled) break;
        if (result) {
          setLogs((prev) =>
            prev.map((l) =>
              l.id === log.id
                ? {
                    ...l,
                    ai_summary: result.summary,
                    undo_description: result.undo_description || null,
                  }
                : l
            )
          );
        }
        setGeneratingIds((prev) => {
          const next = new Set(prev);
          next.delete(log.id);
          return next;
        });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [logs]);

  const totalPages = Math.max(1, Math.ceil(totalCount / LIMIT));

  async function handlePurge() {
    setPurgeDialogOpen(false);
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

  function filterByAdmin(name: string) {
    setSearchQuery(name);
    setDebouncedSearch(name);
    setDetailOpen(false);
    setSelectedLog(null);
  }

  // Validate date range
  const dateRangeValid =
    !fromDate || !toDate || new Date(fromDate) <= new Date(toDate);

  // ── Undo handler ──

  const FIVE_MINUTES = 5 * 60 * 1000;

  function canUndo(log: AdminAuditLogRecord): boolean {
    const createdAt = new Date(log.created_at).getTime();
    return (
      Date.now() - createdAt < FIVE_MINUTES &&
      log.changed_by === user?.id &&
      !log.undone_at
    );
  }

  async function handleUndo(logId: string) {
    setUndoingId(logId);
    setUndoConfirmId(null);
    try {
      const res = await fetch('/api/admin/audit-logs/undo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ log_id: logId }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || 'Failed to undo');
        return;
      }
      toast.success(data.message || 'Undo successful!');
      loadLogs();
    } catch (err) {
      console.error('Undo error:', err);
      toast.error('Failed to undo. Check your connection.');
    } finally {
      setUndoingId(null);
    }
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
      {/* Undo Confirmation Dialog */}
      <AlertDialog
        open={!!undoConfirmId}
        onOpenChange={(v) => !v && setUndoConfirmId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-amber-600">
              <RotateCcw className="w-5 h-5" />
              Undo Action
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>
                This will reverse the most recent change made by you.
              </p>
              <p className="text-xs text-slate-500">
                {(() => {
                  const log = logs.find((l) => l.id === undoConfirmId);
                  if (!log) return "";
                  // Show AI-powered undo description if available
                  if (log.undo_description) return log.undo_description;
                  // Fallback
                  const tableLabel = TABLE_LABELS[log.table_name] || log.table_name;
                  switch (log.operation) {
                    case "INSERT":
                      return `This will delete the ${tableLabel} record that was just created.`;
                    case "UPDATE":
                      return `This will restore the ${tableLabel} record to its previous values.`;
                    case "DELETE":
                      return `This will re-insert the ${tableLabel} record that was just deleted.`;
                    default:
                      return "";
                  }
                })()}
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => undoConfirmId && handleUndo(undoConfirmId)}
              className="bg-amber-600 hover:bg-amber-700 text-white"
            >
              Yes, Undo
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Purge Confirmation Dialog */}
      <AlertDialog open={purgeDialogOpen} onOpenChange={setPurgeDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-red-600">
              <Trash className="w-5 h-5" />
              Purge Old Audit Logs
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>
                This will permanently delete all audit log entries older than{" "}
                <strong>90 days</strong>.
              </p>
              <p className="font-medium text-amber-600">
                This action cannot be undone.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handlePurge}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              Yes, Purge Old Logs
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 pb-12">
        {/* Header */}
        <div className="sticky top-0 z-40 bg-white/95 backdrop-blur-sm border-b border-slate-200 shadow-sm">
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
                {logs.length > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => exportToCSV(logs)}
                    className="text-xs gap-1.5 text-slate-500 hover:text-slate-700"
                    title="Export visible logs to CSV"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Export</span>
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPurgeDialogOpen(true)}
                  disabled={isPurging}
                  className="text-xs gap-1.5 border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
                >
                  {isPurging ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Trash className="w-3.5 h-3.5" />
                  )}
                  <span className="hidden sm:inline">Purge Old Logs</span>
                </Button>
                <Badge variant="outline" className="text-xs gap-1.5 whitespace-nowrap">
                  <Clock className="w-3.5 h-3.5" />
                  {totalCount} event{totalCount !== 1 ? "s" : ""}
                </Badge>
              </div>
            </div>
          </div>
        </div>

        <div className="container mx-auto px-4 py-8 space-y-6">
          {/* Activity Stats */}
          <AuditActivityChart showConfigChanges={showConfigChanges} />

          {/* Filters */}
          <Card className="border-slate-200">
            <CardContent className="pt-5">
              {/* Search row */}
              <div className="flex items-center gap-3 mb-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input
                    placeholder="Search by admin name..."
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      if (currentPage !== 0) setCurrentPage(0);
                    }}
                    className="pl-9 h-10 text-sm"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery("")}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                    >
                      \u00d7
                    </button>
                  )}
                </div>

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setFiltersOpen(!filtersOpen)}
                  className="text-xs gap-1.5 text-slate-500 hover:text-slate-700 shrink-0"
                >
                  <Filter className="w-3.5 h-3.5" />
                  Filters
                  {filtersOpen ? (
                    <ChevronUp className="w-3 h-3" />
                  ) : (
                    <ChevronDown className="w-3 h-3" />
                  )}
                </Button>
              </div>

              {/* Collapsible filter panel */}
              {filtersOpen && (
                <div className="space-y-4 animate-in slide-in-from-top-1 duration-200">
                  <div className="flex flex-col sm:flex-row items-start sm:items-end gap-4">
                    <div className="flex items-center gap-3 w-full sm:w-auto flex-wrap">
                      <div className="flex flex-col gap-1.5 min-w-[140px] flex-1 sm:flex-initial">
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

                      <div className="flex flex-col gap-1.5 min-w-[120px] flex-1 sm:flex-initial">
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

                      <div className="flex flex-col gap-1.5 min-w-[130px] flex-1 sm:flex-initial">
                        <Label className="text-[10px] text-slate-500 font-semibold uppercase tracking-wide flex items-center gap-1">
                          <RotateCcw className="w-2.5 h-2.5" />
                          Status
                        </Label>
                        <Select
                          value={undoneFilter}
                          onValueChange={setUndoneFilter}
                        >
                          <SelectTrigger className="h-10 text-sm">
                            <SelectValue placeholder="All" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All Entries</SelectItem>
                            <SelectItem value="undone">Undone Only</SelectItem>
                            <SelectItem value="not_undone">Not Undone</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 w-full sm:w-auto flex-wrap">
                      <div className="flex flex-col gap-1.5 min-w-[130px] flex-1 sm:flex-initial">
                        <Label className="text-[10px] text-slate-500 font-semibold uppercase tracking-wide">
                          From Date
                        </Label>
                        <Input
                          type="date"
                          value={fromDate}
                          onChange={(e) => setFromDate(e.target.value)}
                          className={`h-10 text-sm ${!dateRangeValid && fromDate ? "border-red-400 focus-visible:ring-red-400" : ""}`}
                          max={toDate || undefined}
                        />
                      </div>
                      <div className="flex flex-col gap-1.5 min-w-[130px] flex-1 sm:flex-initial">
                        <Label className="text-[10px] text-slate-500 font-semibold uppercase tracking-wide">
                          To Date
                        </Label>
                        <Input
                          type="date"
                          value={toDate}
                          onChange={(e) => setToDate(e.target.value)}
                          className={`h-10 text-sm ${!dateRangeValid && toDate ? "border-red-400 focus-visible:ring-red-400" : ""}`}
                          min={fromDate || undefined}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Date validation warning */}
                  {!dateRangeValid && (
                    <p className="text-xs text-red-500 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" />
                      From date must be before or equal to To date
                    </p>
                  )}

                  <div className="flex items-center justify-between pt-2 border-t border-slate-100 flex-wrap gap-2">
                    <p className="text-xs text-slate-400 flex items-center gap-1.5">
                      <Filter className="w-3 h-3" />
                      Page {currentPage + 1} of {totalPages} ({totalCount} total)
                    </p>

                    <div className="flex items-center gap-3 flex-wrap">
                      {/* Config changes toggle */}
                      <label className="flex items-center gap-1.5 cursor-pointer select-none">
                        <button
                          type="button"
                          role="switch"
                          aria-checked={showConfigChanges}
                          onClick={() => setShowConfigChanges(!showConfigChanges)}
                          className={`relative inline-flex h-4 w-7 shrink-0 rounded-full border transition-colors ${
                            showConfigChanges
                              ? "bg-blue-500 border-blue-500"
                              : "bg-slate-200 border-slate-300"
                          }`}
                        >
                          <span
                            className={`inline-block h-3 w-3 rounded-full bg-white shadow-sm transition-transform ${
                              showConfigChanges ? "translate-x-[14px]" : "translate-x-[1px]"
                            }`}
                          />
                        </button>
                        <span className="text-[10px] text-slate-500 font-medium">
                          Show config changes
                        </span>
                      </label>

                      {/* Active filter badges */}
                      {tableFilter !== "all" && (
                        <Badge variant="secondary" className="text-[10px] gap-1">
                          {TABLE_LABELS[tableFilter]}
                          <button onClick={() => setTableFilter("all")}>\u00d7</button>
                        </Badge>
                      )}
                      {operationFilter !== "all" && (
                        <Badge variant="secondary" className="text-[10px] gap-1">
                          {operationLabel(operationFilter as AuditOperation)}
                          <button onClick={() => setOperationFilter("all")}>\u00d7</button>
                        </Badge>
                      )}
                      {debouncedSearch && (
                        <Badge variant="secondary" className="text-[10px] gap-1">
                          Admin: {debouncedSearch}
                          <button onClick={() => { setSearchQuery(""); setDebouncedSearch(""); }}>\u00d7</button>
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              )}
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
                  {tableFilter !== "all" ||
                  operationFilter !== "all" ||
                  debouncedSearch.trim() ||
                  fromDate ||
                  toDate
                    ? "Try adjusting your filters or search query."
                    : "Admin actions like creating students, editing teachers, or updating classes will appear here automatically once the audit migration has been applied."}
                </p>
              </CardContent>
            </Card>
          )}

          {/* Audit log entries */}
          {!isLoading && logs.length > 0 && (
            <Card className="border-slate-200 overflow-hidden">
              <CardContent className="p-0 divide-y divide-slate-100">
                {logs.map((log, index) => {
                  const description = buildChangeDescription(log);
                  const isGenerating = generatingIds.has(log.id);

                  return (
                    <div
                      key={log.id}
                      className="flex items-start gap-4 px-4 sm:px-6 py-4 hover:bg-slate-50 transition-colors group animate-in fade-in duration-200"
                      style={{ animationDelay: `${index * 30}ms` }}
                    >
                      {/* Operation icon */}
                      <div
                        className={`flex items-center justify-center w-9 h-9 rounded-xl border shrink-0 mt-0.5 ${operationColor(
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
                          {log.undone_at && (
                            <Badge
                              variant="outline"
                              className="text-[10px] gap-1 bg-slate-100 text-slate-500 border-slate-200 font-normal"
                            >
                              <RotateCcw className="w-2.5 h-2.5" />
                              Undone
                            </Badge>
                          )}
                          <span className="text-xs font-medium text-slate-600 truncate">
                            {TABLE_LABELS[log.table_name] || log.table_name}
                          </span>
                          <span className="text-xs text-slate-300 hidden sm:inline">\u00b7</span>
                          <span className="text-xs text-slate-400 hidden sm:inline whitespace-nowrap">
                            {formatAuditTimestamp(log.created_at)}
                          </span>
                          <span className="text-xs text-purple-500 font-medium whitespace-nowrap">
                            {timeAgo(log.created_at)}
                          </span>
                        </div>

                        {/* AI-powered description or fallback */}
                        {log.ai_summary ? (
                          <div className="mt-1 flex items-start gap-1.5">
                            <Bot className="w-3.5 h-3.5 text-purple-400 mt-0.5 shrink-0 hidden sm:block" />
                            <p className="text-xs text-slate-600 leading-relaxed line-clamp-2">
                              {log.ai_summary}
                            </p>
                          </div>
                        ) : isGenerating ? (
                          <div className="mt-1 flex items-center gap-1.5 text-xs text-purple-500">
                            <Loader2 className="w-3 h-3 animate-spin" />
                            Generating AI explanation...
                          </div>
                        ) : (
                          <p className="text-xs text-slate-500 mt-1 line-clamp-1">
                            {description.primary}
                          </p>
                        )}
                      </div>

                      {/* Actor + Generate AI + View + Undo buttons */}
                      <div className="shrink-0 flex items-center gap-1">
                        <div className="text-right hidden sm:block">
                          {log.changed_by_name && (
                            <button
                              onClick={() => filterByAdmin(log.changed_by_name!)}
                              className="text-xs font-medium text-slate-500 hover:text-blue-600 hover:underline transition-colors"
                              title={`Filter by ${log.changed_by_name}`}
                            >
                              {log.changed_by_name}
                            </button>
                          )}
                        </div>

                        {/* Generate AI button — only show if no AI summary yet */}
                        {!log.ai_summary && !isGenerating && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={async () => {
                              setGeneratingIds((prev) => new Set(prev).add(log.id));
                              const result = await generateSummaryForLog(log.id);
                              if (result) {
                                setLogs((prev) =>
                                  prev.map((l) =>
                                    l.id === log.id
                                      ? { ...l, ai_summary: result.summary, undo_description: result.undo_description || null }
                                      : l
                                  )
                                );
                              }
                              setGeneratingIds((prev) => {
                                const next = new Set(prev);
                                next.delete(log.id);
                                return next;
                              });
                            }}
                            className="h-8 w-8 text-slate-400 hover:text-purple-600 hover:bg-purple-50 transition-colors"
                            title="Generate AI explanation"
                          >
                            <Sparkles className="w-3.5 h-3.5" />
                          </Button>
                        )}

                        {/* Undo button — only on the most recent entry within 5 min */}
                        {index === 0 && canUndo(log) && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setUndoConfirmId(log.id)}
                            disabled={undoingId === log.id}
                            className="h-8 w-8 text-slate-400 hover:text-amber-600 hover:bg-amber-50 transition-colors"
                            title="Undo this action"
                          >
                            {undoingId === log.id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <RotateCcw className="w-4 h-4" />
                            )}
                          </Button>
                        )}

                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                          title="View details"
                          onClick={() => openDetail(log)}
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-6">
              <p className="text-xs text-slate-500 order-2 sm:order-1">
                Showing {(currentPage * LIMIT) + 1}\u2013{Math.min((currentPage + 1) * LIMIT, totalCount)} of {totalCount} entries
              </p>
              <div className="flex items-center gap-1 order-1 sm:order-2">
                <button
                  onClick={() => setCurrentPage((p) => Math.max(0, p - 1))}
                  disabled={currentPage === 0}
                  className="p-2 rounded-md border border-slate-200 text-slate-500 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  aria-label="Previous page"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>

                {(() => {
                  const maxVisible = totalPages <= 7 ? totalPages : 5;
                  let startPage: number;
                  if (totalPages <= 7) {
                    startPage = 0;
                  } else if (currentPage < 2) {
                    startPage = 0;
                  } else if (currentPage > totalPages - 3) {
                    startPage = totalPages - maxVisible;
                  } else {
                    startPage = currentPage - 2;
                  }

                  const pages = Array.from(
                    { length: Math.min(maxVisible, totalPages) },
                    (_, i) => startPage + i
                  );

                  return (
                    <>
                      {startPage > 0 && (
                        <>
                          <button
                            onClick={() => setCurrentPage(0)}
                            className="min-w-[32px] h-8 px-1.5 rounded-md text-xs border border-slate-200 text-slate-500 hover:bg-slate-100 transition-colors"
                          >
                            1
                          </button>
                          {startPage > 1 && (
                            <span className="px-1 text-slate-300 text-xs">\u2026</span>
                          )}
                        </>
                      )}

                      {pages.map((pageNum) => (
                        <button
                          key={pageNum}
                          onClick={() => setCurrentPage(pageNum)}
                          className={`min-w-[32px] h-8 px-2 rounded-md text-sm font-semibold transition-colors ${
                            currentPage === pageNum
                              ? "bg-blue-600 text-white shadow-sm"
                              : "border border-slate-200 text-slate-600 hover:bg-slate-100"
                          }`}
                        >
                          {pageNum + 1}
                        </button>
                      ))}

                      {startPage + maxVisible < totalPages && (
                        <>
                          {startPage + maxVisible < totalPages - 1 && (
                            <span className="px-1 text-slate-300 text-xs">\u2026</span>
                          )}
                          <button
                            onClick={() => setCurrentPage(totalPages - 1)}
                            className="min-w-[32px] h-8 px-1.5 rounded-md text-xs border border-slate-200 text-slate-500 hover:bg-slate-100 transition-colors"
                          >
                            {totalPages}
                          </button>
                        </>
                      )}
                    </>
                  );
                })()}

                <button
                  onClick={() =>
                    setCurrentPage((p) => Math.min(totalPages - 1, p + 1))
                  }
                  disabled={currentPage >= totalPages - 1}
                  className="p-2 rounded-md border border-slate-200 text-slate-500 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  aria-label="Next page"
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
        onFilterByAdmin={filterByAdmin}
      />
    </DashboardLayout>
  );
}
