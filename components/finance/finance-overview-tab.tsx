"use client";

import { useState, useMemo, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Banknote,
  Wallet,
  Clock,
  AlertTriangle,
  GraduationCap,
  Search,
  SlidersHorizontal,
  RotateCcw,
  Eye,
  Printer,
  ChevronDown,
  BookOpen,
  FilterX,
  PieChart,
} from "lucide-react";
import type {
  FinanceOverview,
  FeeTemplate,
  FinanceBill,
  StudentOption,
  ClassOption,
} from "./finance-types";

/* ── Props ─────────────────────────────────────────── */

interface OverviewTabProps {
  overview: FinanceOverview | null;
  bills: FinanceBill[];
  students: StudentOption[];
  fees: FeeTemplate[];
  classes: ClassOption[];
  formatMoney: (value: number) => string;
}

/* ── Helpers ───────────────────────────────────────── */

const CLASS_COLORS: Record<string, string> = {
  "JSS 1": "#6366f1",
  "JSS 2": "#8b5cf6",
  "JSS 3": "#a855f7",
  "SS 1": "#ec4899",
  "SS 2": "#f43f5e",
  "SS 3": "#f97316",
};

const AVATAR_COLORS = [
  "#6366f1", "#8b5cf6", "#a855f7", "#ec4899",
  "#f43f5e", "#f97316", "#22c55e", "#14b8a6",
  "#06b6d4", "#3b82f6",
];

const DEFAULT_CLASS_COLORS = [
  "#6366f1", "#8b5cf6", "#a855f7", "#ec4899",
  "#f43f5e", "#f97316", "#22c55e", "#14b8a6",
];

function getClassColor(className: string, index: number): string {
  return CLASS_COLORS[className] || DEFAULT_CLASS_COLORS[index % DEFAULT_CLASS_COLORS.length];
}

function getAvatarColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function getInitials(firstName?: string, lastName?: string): string {
  return ((firstName?.[0] || "") + (lastName?.[0] || "")).toUpperCase() || "?";
}

/* ── Status Badge ──────────────────────────────────── */

function StatusDotBadge({ status }: { status: string }) {
  const config: Record<string, { dot: string; bg: string; text: string; label: string }> = {
    paid: { dot: "bg-emerald-500", bg: "bg-emerald-50", text: "text-emerald-700", label: "Paid" },
    partial: { dot: "bg-amber-500", bg: "bg-amber-50", text: "text-amber-700", label: "Partial" },
    pending: { dot: "bg-blue-500", bg: "bg-blue-50", text: "text-blue-700", label: "Pending" },
    unpaid: { dot: "bg-rose-500", bg: "bg-rose-50", text: "text-rose-700", label: "Unpaid" },
    overdue: { dot: "bg-red-500", bg: "bg-red-50", text: "text-red-700", label: "Overdue" },
    waived: { dot: "bg-gray-500", bg: "bg-gray-50", text: "text-gray-600", label: "Waived" },
    cancelled: { dot: "bg-gray-500", bg: "bg-gray-50", text: "text-gray-600", label: "Cancelled" },
  };
  const cfg = config[status] || { dot: "bg-gray-500", bg: "bg-gray-50", text: "text-gray-600", label: status };
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${cfg.bg} ${cfg.text} border border-transparent`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot} ${status === "overdue" ? "animate-pulse" : ""}`} />
      {cfg.label}
    </span>
  );
}

/* ── Progress Bar ──────────────────────────────────── */

function PaymentProgressBar({ pct }: { pct: number }) {
  const fillClass = pct >= 100
    ? "from-emerald-500 to-green-500"
    : pct >= 50
    ? "from-amber-500 to-yellow-500"
    : "from-rose-500 to-orange-500";

  return (
    <div className="flex items-center gap-2 min-w-[100px]">
      <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full bg-gradient-to-r ${fillClass} transition-all duration-700 ease-out`}
          style={{ width: `${Math.min(pct, 100)}%` }}
        />
      </div>
      <span className="text-[11px] font-semibold text-gray-500 w-8 text-right tabular-nums">{pct}%</span>
    </div>
  );
}

/* ── Fee Pill ──────────────────────────────────────── */

function FeePill({ label }: { label: string }) {
  const short = label.replace(/ Fees$/, "").replace(/ & Activities$/, "").replace(/ Levy$/, "");
  return (
    <span className="inline-block text-[10px] font-medium px-2 py-0.5 rounded bg-gray-100 text-gray-600 border border-gray-200 whitespace-nowrap">
      {short}
    </span>
  );
}

/* ── Student Avatar ────────────────────────────────── */

function StudentAvatar({ firstName, lastName }: { firstName?: string; lastName?: string }) {
  const initials = getInitials(firstName, lastName);
  const color = getAvatarColor(`${firstName} ${lastName}`);
  return (
    <div
      className="w-8 h-8 rounded-full flex items-center justify-center text-white text-[11px] font-bold shrink-0"
      style={{ background: color }}
    >
      {initials}
    </div>
  );
}

/* ── Aggregated Student Bill Data ──────────────────── */

interface StudentBillSummary {
  studentId: string;
  student_id: string;
  firstName: string;
  lastName: string;
  fullName: string;
  classId?: string;
  className?: string;
  totalBilled: number;
  amountPaid: number;
  balance: number;
  status: string;
  paymentPct: number;
  feeItems: Array<{ title: string; amount: number }>;
  lastPaymentDate?: string;
  billCount: number;
}

function buildStudentBillMap(
  bills: FinanceBill[],
  students: StudentOption[],
  classes: ClassOption[]
): Map<string, StudentBillSummary> {
  const classMap = new Map<string, string>();
  classes.forEach((c) => classMap.set(c.id, c.name));

  const map = new Map<string, StudentBillSummary>();

  bills.forEach((bill) => {
    const sid = bill.student_id;
    if (!map.has(sid)) {
      const stu = bill.students || students.find((s) => s.id === sid);
      const clsName = bill.students
        ? classMap.get((students.find((s) => s.id === sid)?.class_id) || "") || ""
        : "";

      map.set(sid, {
        studentId: sid,
        student_id: stu?.student_id || "",
        firstName: stu?.first_name || "",
        lastName: stu?.last_name || "",
        fullName: `${stu?.first_name || ""} ${stu?.last_name || ""}`.trim() || "Unknown",
        classId: students.find((s) => s.id === sid)?.class_id,
        className: clsName,
        totalBilled: 0,
        amountPaid: 0,
        balance: 0,
        status: "pending",
        paymentPct: 0,
        feeItems: [],
        lastPaymentDate: undefined,
        billCount: 0,
      });
    }

    const entry = map.get(sid)!;
    entry.totalBilled += Number(bill.total_amount) || 0;
    entry.amountPaid += Number(bill.amount_paid) || 0;
    entry.balance += Number(bill.balance_amount) || 0;
    entry.billCount += 1;

    // Track fee items
    if (bill.finance_bill_items) {
      bill.finance_bill_items.forEach((item) => {
        const existing = entry.feeItems.find((f) => f.title === item.title);
        if (existing) {
          existing.amount += Number(item.amount) || 0;
        } else {
          entry.feeItems.push({ title: item.title, amount: Number(item.amount) || 0 });
        }
      });
    }

    // Status tracking: pick the "worst" status
    const statusOrder = ["paid", "pending", "partial", "unpaid", "overdue", "cancelled", "waived"];
    const currentIdx = statusOrder.indexOf(entry.status);
    const billIdx = statusOrder.indexOf(bill.status);
    if (billIdx > currentIdx) {
      entry.status = bill.status;
    }
  });

  // Compute derived values
  map.forEach((entry) => {
    entry.paymentPct = entry.totalBilled > 0
      ? Math.round((entry.amountPaid / entry.totalBilled) * 100)
      : 0;
  });

  return map;
}

/* ── Main Component ───────────────────────────────── */

export function FinanceOverviewTab({
  overview,
  bills,
  students,
  fees,
  classes,
  formatMoney,
}: OverviewTabProps) {
  // ── Derived data ──
  const studentBillMap = useMemo(() => buildStudentBillMap(bills, students, classes), [bills, students, classes]);

  // Build a class-to-students map from the bill summaries
  const classGroups = useMemo(() => {
    const map = new Map<string, StudentBillSummary[]>();
    studentBillMap.forEach((summary) => {
      const clsName = summary.className || "Unassigned";
      if (!map.has(clsName)) map.set(clsName, []);
      map.get(clsName)!.push(summary);
    });
    // Also add students without bills
    students.forEach((stu) => {
      if (!studentBillMap.has(stu.id)) {
        const clsName = classes.find((c) => c.id === stu.class_id)?.name || "Unassigned";
        if (!map.has(clsName)) map.set(clsName, []);
        map.get(clsName)!.push({
          studentId: stu.id,
          student_id: stu.student_id,
          firstName: stu.first_name,
          lastName: stu.last_name,
          fullName: `${stu.first_name} ${stu.last_name}`,
          classId: stu.class_id,
          className: clsName,
          totalBilled: 0,
          amountPaid: 0,
          balance: 0,
          status: "pending",
          paymentPct: 0,
          feeItems: [],
          billCount: 0,
        });
      }
    });

    // Sort class names (JSS before SS)
    const sortKey = (name: string) => {
      const match = name.match(/^([A-Za-z]+)\s*(\d+)/);
      if (match) {
        const prefix = match[1] === "JSS" ? "1" : match[1] === "SS" ? "2" : "3";
        return `${prefix}${String(parseInt(match[2])).padStart(2, "0")}`;
      }
      return name;
    };

    const sorted = Array.from(map.entries()).sort(([a], [b]) => sortKey(a).localeCompare(sortKey(b)));
    return sorted.map(([className, studs]) => ({
      className,
      students: studs.sort((a, b) => a.fullName.localeCompare(b.fullName)),
    }));
  }, [studentBillMap, students, classes]);

  // ── Stats from overview ──
  const stats = useMemo(() => {
    if (!overview?.stats) {
      // Compute from bills directly
      const totalBilled = bills.reduce((s, b) => s + Number(b.total_amount || 0), 0);
      const totalCollected = bills.reduce((s, b) => s + Number(b.amount_paid || 0), 0);
      const totalOutstanding = bills.reduce((s, b) => s + Number(b.balance_amount || 0), 0);
      const overdueCount = bills.filter((b) => b.status === "overdue").length;
      const paidCount = bills.filter((b) => b.status === "paid").length;
      const partialCount = bills.filter((b) => b.status === "partial").length;
      const totalBills = bills.length;

      return { totalBilled, totalCollected, totalOutstanding, overdueCount, totalBills, paidCount, partialCount };
    }

    const s = overview.stats;
    return {
      totalBilled: s.totalDue,
      totalCollected: s.totalCollected,
      totalOutstanding: s.totalOutstanding,
      overdueCount: s.overdueCount || bills.filter((b) => b.status === "overdue").length,
      totalBills: s.totalBills,
      paidCount: s.paidCount,
      partialCount: s.partialCount,
    };
  }, [overview, bills]);

  const collectionRate = stats.totalBilled > 0
    ? Math.round((stats.totalCollected / stats.totalBilled) * 100)
    : 0;

  // ── Filter state ──
  const [searchQuery, setSearchQuery] = useState("");
  const [classFilter, setClassFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [feeTypeFilter, setFeeTypeFilter] = useState("all");

  const hasActiveFilter = searchQuery.trim() !== "" || classFilter !== "all" || statusFilter !== "all" || feeTypeFilter !== "all";

  const filteredClassGroups = useMemo(() => {
    return classGroups
      .map((group) => ({
        ...group,
        students: group.students.filter((st) => {
          if (searchQuery.trim()) {
            const q = searchQuery.trim().toLowerCase();
            if (!st.fullName.toLowerCase().includes(q) && !st.student_id.toLowerCase().includes(q)) return false;
          }
          if (classFilter !== "all" && group.className !== classFilter) return false;
          if (statusFilter !== "all" && st.status !== statusFilter) return false;
          if (feeTypeFilter !== "all" && !st.feeItems.some((f) => f.title.toLowerCase().includes(feeTypeFilter.toLowerCase()))) return false;
          return true;
        }),
      }))
      .filter((g) => g.students.length > 0);
  }, [classGroups, searchQuery, classFilter, statusFilter, feeTypeFilter]);

  const totalFilteredStudents = useMemo(
    () => filteredClassGroups.reduce((s, g) => s + g.students.length, 0),
    [filteredClassGroups]
  );

  const resetFilters = () => {
    setSearchQuery("");
    setClassFilter("all");
    setStatusFilter("all");
    setFeeTypeFilter("all");
  };

  // ── Expanded class groups ──
  const [expandedClasses, setExpandedClasses] = useState<Set<string>>(new Set(classGroups.map((g) => g.className)));

  const toggleClass = useCallback((className: string) => {
    setExpandedClasses((prev) => {
      const next = new Set(prev);
      if (next.has(className)) next.delete(className);
      else next.add(className);
      return next;
    });
  }, []);

  // ── Student detail modal ──
  const [modalStudent, setModalStudent] = useState<StudentBillSummary | null>(null);

  // ── Fee template lookup for filter ──
  const uniqueFeeTitles = useMemo(() => {
    const titles = new Set<string>();
    bills.forEach((b) => {
      b.finance_bill_items?.forEach((item) => titles.add(item.title));
    });
    return Array.from(titles).sort();
  }, [bills]);

  const uniqueStatuses = useMemo(() => {
    const statuses = new Set<string>();
    studentBillMap.forEach((s) => statuses.add(s.status));
    return ["paid", "partial", "unpaid", "overdue", "pending", "waived", "cancelled"].filter((s) => statuses.has(s));
  }, [studentBillMap]);

  // ── Class options for filter ──
  const classOptions = useMemo(() => classGroups.map((g) => g.className), [classGroups]);

  const totalStudentsWithBills = studentBillMap.size;

  return (
    <div className="space-y-5 mt-6">
      {/* ── Stats Cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Billed */}
        <div className="group relative bg-white rounded-xl border border-gray-200 p-5 transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5 overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-indigo-500 to-violet-500 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
          <div className="w-10 h-10 rounded-lg bg-indigo-50 flex items-center justify-center mb-3">
            <Banknote className="h-5 w-5 text-indigo-500" />
          </div>
          <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1">Total Billed</p>
          <p className="text-2xl font-extrabold text-gray-900 tracking-tight">{formatMoney(stats.totalBilled)}</p>
          <p className="text-xs text-gray-400 mt-2">
            {stats.totalBills} bill{stats.totalBills !== 1 ? "s" : ""} · {totalStudentsWithBills} student{totalStudentsWithBills !== 1 ? "s" : ""}
          </p>
        </div>

        {/* Total Collected */}
        <div className="group relative bg-white rounded-xl border border-gray-200 p-5 transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5 overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-emerald-500 to-green-500 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
          <div className="w-10 h-10 rounded-lg bg-emerald-50 flex items-center justify-center mb-3">
            <Wallet className="h-5 w-5 text-emerald-500" />
          </div>
          <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1">Total Collected</p>
          <p className="text-2xl font-extrabold text-gray-900 tracking-tight">{formatMoney(stats.totalCollected)}</p>
          <div className="flex items-center gap-2 mt-2">
            <span className="text-xs text-gray-400">{stats.paidCount} fully paid</span>
            <span className="text-xs font-semibold text-emerald-600">↑ {collectionRate}%</span>
          </div>
          <div className="mt-2 h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-green-500 transition-all duration-1000 ease-out"
              style={{ width: `${Math.min(collectionRate, 100)}%` }}
            />
          </div>
        </div>

        {/* Outstanding */}
        <div className="group relative bg-white rounded-xl border border-gray-200 p-5 transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5 overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-amber-500 to-orange-500 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
          <div className="w-10 h-10 rounded-lg bg-amber-50 flex items-center justify-center mb-3">
            <Clock className="h-5 w-5 text-amber-500" />
          </div>
          <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1">Outstanding</p>
          <p className="text-2xl font-extrabold text-gray-900 tracking-tight">{formatMoney(stats.totalOutstanding)}</p>
          <p className="text-xs text-gray-400 mt-2">
            {stats.partialCount} partial · {studentBillMap.size - stats.paidCount} with balance
          </p>
        </div>

        {/* Overdue */}
        <div className="group relative bg-white rounded-xl border border-gray-200 p-5 transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5 overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-red-500 to-rose-500 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
          <div className="w-10 h-10 rounded-lg bg-red-50 flex items-center justify-center mb-3">
            <AlertTriangle className="h-5 w-5 text-red-500" />
          </div>
          <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1">Overdue</p>
          <p className="text-2xl font-extrabold text-gray-900 tracking-tight">{stats.overdueCount}</p>
          <p className="text-xs text-gray-400 mt-2">Student{stats.overdueCount !== 1 ? "s" : ""} past due date</p>
        </div>
      </div>

      {/* ── Outstanding by class (if available) ── */}
      {overview?.outstandingByClass && overview.outstandingByClass.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center gap-2 mb-4">
            <PieChart className="h-4 w-4 text-gray-400" />
            <p className="text-sm font-semibold text-gray-700">Outstanding by Class</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {overview.outstandingByClass.map((item) => {
              const pct = stats.totalOutstanding > 0
                ? Math.round((item.outstanding / stats.totalOutstanding) * 100)
                : 0;
              return (
                <div key={item.className} className="flex items-center gap-3 p-3 rounded-lg bg-gray-50 border border-gray-100">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-gray-700 truncate">{item.className}</p>
                    <p className="text-lg font-bold text-gray-900">{formatMoney(item.outstanding)}</p>
                  </div>
                  <span className="text-[11px] font-semibold text-amber-600 bg-amber-50 px-2 py-1 rounded-full">
                    {pct}%
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Filter Bar ── */}
      <Card className="border-gray-200 overflow-hidden transition-all duration-200 hover:shadow-md">
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 shrink-0">
              <SlidersHorizontal className="h-3.5 w-3.5" />
              Filters
            </div>

            <div className="w-px h-6 bg-gray-200 shrink-0" />

            {/* Search */}
            <div className="relative flex-1 min-w-[180px]">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
              <Input
                placeholder="Search student name or ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 h-8 text-xs bg-white border-gray-200 text-gray-900 placeholder:text-gray-400 focus:border-indigo-400"
              />
            </div>

            {/* Class Filter */}
            <Select value={classFilter} onValueChange={setClassFilter}>
              <SelectTrigger className="h-8 text-xs border-gray-200 bg-white text-gray-700 w-[130px]">
                <SelectValue placeholder="All Classes" />
              </SelectTrigger>
              <SelectContent className="bg-white border-gray-200 text-gray-700">
                <SelectItem value="all">All Classes</SelectItem>
                {classOptions.map((cls) => (
                  <SelectItem key={cls} value={cls}>{cls}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Status Filter */}
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="h-8 text-xs border-gray-200 bg-white text-gray-700 w-[120px]">
                <SelectValue placeholder="All Statuses" />
              </SelectTrigger>
              <SelectContent className="bg-white border-gray-200 text-gray-700">
                <SelectItem value="all">All Statuses</SelectItem>
                {uniqueStatuses.map((s) => (
                  <SelectItem key={s} value={s}>
                    <span className="capitalize">{s}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Fee Type Filter */}
            <Select value={feeTypeFilter} onValueChange={setFeeTypeFilter}>
              <SelectTrigger className="h-8 text-xs border-gray-200 bg-white text-gray-700 w-[130px]">
                <SelectValue placeholder="All Fee Types" />
              </SelectTrigger>
              <SelectContent className="bg-white border-gray-200 text-gray-700">
                <SelectItem value="all">All Fee Types</SelectItem>
                {uniqueFeeTitles.map((t) => (
                  <SelectItem key={t} value={t}>{t}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Reset */}
            <Button
              variant="ghost"
              size="sm"
              className="h-8 gap-1.5 text-xs text-gray-400 hover:text-gray-600"
              onClick={resetFilters}
            >
              <RotateCcw className="h-3 w-3" />
              Reset
            </Button>

            {hasActiveFilter && (
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
            )}
          </div>

          {/* Filter summary */}
          {hasActiveFilter && (
            <div className="flex items-center justify-between pt-3 mt-3 border-t border-gray-100">
              <p className="text-[11px] text-gray-400">
                Showing {totalFilteredStudents} of {studentBillMap.size} student{studentBillMap.size !== 1 ? "s" : ""}
              </p>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 gap-1 text-xs text-gray-400 hover:text-red-500"
                onClick={resetFilters}
              >
                <FilterX className="h-3 w-3" />
                Clear Filters
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Class Groups ── */}
      <div className="space-y-4">
        {filteredClassGroups.length > 0 ? (
          filteredClassGroups.map((group) => {
            const color = getClassColor(group.className, classGroups.findIndex((g) => g.className === group.className));
            const classBilled = group.students.reduce((s, st) => s + st.totalBilled, 0);
            const classCollected = group.students.reduce((s, st) => s + st.amountPaid, 0);
            const classOutstanding = classBilled - classCollected;
            const classPct = classBilled > 0 ? Math.round((classCollected / classBilled) * 100) : 0;
            const isExpanded = expandedClasses.has(group.className);

            return (
              <div
                key={group.className}
                className="bg-white rounded-xl border border-gray-200 overflow-hidden transition-all duration-200 hover:shadow-md"
              >
                {/* Class Header */}
                <button
                  onClick={() => toggleClass(group.className)}
                  className="w-full flex items-center justify-between px-5 py-3.5 bg-white hover:bg-gray-50 transition-colors duration-150 text-left"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <ChevronDown
                      className={`h-4 w-4 text-gray-400 transition-transform duration-200 ${
                        isExpanded ? "" : "-rotate-90"
                      }`}
                    />
                    <div className="flex items-center gap-2.5">
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ background: color }}
                      />
                      <span className="text-sm font-bold text-gray-900">{group.className}</span>
                      <span className="text-[11px] font-medium text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
                        {group.students.length} student{group.students.length !== 1 ? "s" : ""}
                      </span>
                    </div>
                  </div>

                  <div className="hidden sm:flex items-center gap-5">
                    <div className="text-right">
                      <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wider">Billed</p>
                      <p className="text-xs font-bold text-gray-800">{formatMoney(classBilled)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wider">Collected</p>
                      <p className="text-xs font-bold text-emerald-600">{formatMoney(classCollected)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wider">Outstanding</p>
                      <p className="text-xs font-bold text-amber-600">{formatMoney(classOutstanding)}</p>
                    </div>
                    <div className="text-right hidden lg:block">
                      <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wider">Rate</p>
                      <p className="text-xs font-bold text-gray-800">{classPct}%</p>
                    </div>
                  </div>
                </button>

                {/* Student Table */}
                {isExpanded && (
                  <div className="border-t border-gray-100">
                    {/* Table Header */}
                    <div className="hidden lg:grid lg:grid-cols-12 gap-3 px-5 py-2.5 bg-gray-50/80 text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
                      <div className="col-span-3">Student</div>
                      <div className="col-span-2">Fee Types</div>
                      <div className="col-span-1 text-right">Billed</div>
                      <div className="col-span-1 text-right">Paid</div>
                      <div className="col-span-1 text-right">Balance</div>
                      <div className="col-span-2">Progress</div>
                      <div className="col-span-1">Status</div>
                      <div className="col-span-1 text-right">Actions</div>
                    </div>

                    {/* Student Rows */}
                    <div className="divide-y divide-gray-50">
                      {group.students.map((st) => (
                        <div
                          key={st.studentId}
                          className="lg:grid lg:grid-cols-12 gap-3 px-5 py-3 flex flex-col lg:flex-row lg:items-center transition-all duration-150 hover:bg-gray-50 hover:pl-6"
                        >
                          {/* Student */}
                          <div className="col-span-3 flex items-center gap-2.5 min-w-0">
                            <StudentAvatar firstName={st.firstName} lastName={st.lastName} />
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-gray-900 truncate">{st.fullName}</p>
                              <p className="text-[10px] text-gray-400 font-mono truncate">{st.student_id}</p>
                            </div>
                          </div>

                          {/* Fee Types (desktop) */}
                          <div className="col-span-2 hidden lg:flex flex-wrap gap-1">
                            {st.feeItems.length > 0 ? (
                              st.feeItems.map((fee, fi) => (
                                <FeePill key={fi} label={fee.title} />
                              ))
                            ) : (
                              <span className="text-[10px] text-gray-300 italic">No fees</span>
                            )}
                          </div>

                          {/* Mobile fee pills */}
                          <div className="flex lg:hidden flex-wrap gap-1 mt-1">
                            {st.feeItems.length > 0 ? (
                              st.feeItems.map((fee, fi) => (
                                <FeePill key={fi} label={fee.title} />
                              ))
                            ) : (
                              <span className="text-[10px] text-gray-300 italic">No fees</span>
                            )}
                          </div>

                          {/* Billed */}
                          <div className="col-span-1 flex items-center justify-between lg:justify-end mt-1.5 lg:mt-0">
                            <span className="text-[11px] text-gray-400 lg:hidden">Billed:</span>
                            <span className="text-xs font-bold text-gray-900">{formatMoney(st.totalBilled)}</span>
                          </div>

                          {/* Paid */}
                          <div className="col-span-1 flex items-center justify-between lg:justify-end mt-0.5 lg:mt-0">
                            <span className="text-[11px] text-gray-400 lg:hidden">Paid:</span>
                            <span className="text-xs font-bold text-emerald-600">{formatMoney(st.amountPaid)}</span>
                          </div>

                          {/* Balance */}
                          <div className="col-span-1 flex items-center justify-between lg:justify-end mt-0.5 lg:mt-0">
                            <span className="text-[11px] text-gray-400 lg:hidden">Balance:</span>
                            <span className={`text-xs font-bold ${st.balance > 0 ? "text-amber-600" : "text-gray-400"}`}>
                              {formatMoney(st.balance)}
                            </span>
                          </div>

                          {/* Progress */}
                          <div className="col-span-2 mt-1.5 lg:mt-0">
                            <PaymentProgressBar pct={st.paymentPct} />
                          </div>

                          {/* Status */}
                          <div className="col-span-1 mt-1.5 lg:mt-0">
                            <StatusDotBadge status={st.status} />
                          </div>

                          {/* Actions */}
                          <div className="col-span-1 flex justify-end gap-1 mt-1.5 lg:mt-0">
                            <button
                              onClick={() => setModalStudent(st)}
                              className="p-1.5 rounded-md hover:bg-gray-100 text-gray-400 hover:text-indigo-600 transition-colors"
                              title="View Details"
                            >
                              <Eye className="h-3.5 w-3.5" />
                            </button>
                            <button
                              onClick={() => {
                                const data = `Receipt for ${st.fullName} (${st.student_id})
Class: ${st.className || "N/A"}
Total Billed: ${formatMoney(st.totalBilled)}
Amount Paid: ${formatMoney(st.amountPaid)}
Balance: ${formatMoney(st.balance)}`;
                                alert(data);
                              }}
                              className="p-1.5 rounded-md hover:bg-gray-100 text-gray-400 hover:text-blue-600 transition-colors"
                              title="Print Receipt"
                            >
                              <Printer className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })
        ) : (
          /* ── Empty State ── */
          <div className="bg-white rounded-xl border border-dashed border-gray-200 p-12 text-center">
            <Search className="h-10 w-10 text-gray-300 mx-auto mb-3" />
            <h3 className="text-sm font-semibold text-gray-500 mb-1">
              {hasActiveFilter ? "No students match your filters" : "No students found"}
            </h3>
            <p className="text-xs text-gray-400 mb-4">
              {hasActiveFilter
                ? "Try adjusting your search or filter criteria"
                : "Create bills for students to see them here"}
            </p>
            {hasActiveFilter && (
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 text-xs border-gray-200 text-gray-500"
                onClick={resetFilters}
              >
                <FilterX className="h-3.5 w-3.5" />
                Clear All Filters
              </Button>
            )}
          </div>
        )}
      </div>

      {/* ── Footer Info ── */}
      <div className="text-center py-4 text-[11px] text-gray-400 border-t border-gray-100">
        School Finance Dashboard · Last synced: {new Date().toLocaleString("en-NG", {
          day: "2-digit",
          month: "short",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        })}
      </div>

      {/* ── Student Detail Modal ── */}
      <Dialog open={!!modalStudent} onOpenChange={(open) => { if (!open) setModalStudent(null); }}>
        <DialogContent className="sm:max-w-lg bg-white border-gray-200">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base text-gray-900">
              <div className="p-1 rounded-lg bg-indigo-100">
                <GraduationCap className="h-4 w-4 text-indigo-600" />
              </div>
              {modalStudent?.fullName || "Student Details"}
            </DialogTitle>
            <DialogDescription className="text-gray-500">
              Fee breakdown and payment details
            </DialogDescription>
          </DialogHeader>

          {modalStudent && (
            <div className="space-y-3">
              {/* ID and Class */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-lg bg-gray-50 border border-gray-100">
                  <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wider mb-0.5">Student ID</p>
                  <p className="text-sm font-semibold text-gray-900 font-mono">{modalStudent.student_id}</p>
                </div>
                <div className="p-3 rounded-lg bg-gray-50 border border-gray-100">
                  <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wider mb-0.5">Class</p>
                  <p className="text-sm font-semibold text-gray-900">{modalStudent.className || "Unassigned"}</p>
                </div>
              </div>

              {/* Financial Summary */}
              <div className="grid grid-cols-3 gap-3">
                <div className="p-3 rounded-lg bg-indigo-50 border border-indigo-100">
                  <p className="text-[10px] font-medium text-indigo-500 uppercase tracking-wider mb-0.5">Billed</p>
                  <p className="text-base font-extrabold text-indigo-700">{formatMoney(modalStudent.totalBilled)}</p>
                </div>
                <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-100">
                  <p className="text-[10px] font-medium text-emerald-500 uppercase tracking-wider mb-0.5">Paid</p>
                  <p className="text-base font-extrabold text-emerald-700">{formatMoney(modalStudent.amountPaid)}</p>
                </div>
                <div className="p-3 rounded-lg bg-amber-50 border border-amber-100">
                  <p className="text-[10px] font-medium text-amber-500 uppercase tracking-wider mb-0.5">Balance</p>
                  <p className={`text-base font-extrabold ${modalStudent.balance > 0 ? "text-amber-700" : "text-gray-400"}`}>
                    {formatMoney(modalStudent.balance)}
                  </p>
                </div>
              </div>

              {/* Progress bar */}
              <div className="flex items-center gap-3">
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[11px] font-medium text-gray-500">Payment Progress</span>
                    <span className="text-[11px] font-bold text-gray-700">{modalStudent.paymentPct}%</span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full bg-gradient-to-r transition-all duration-700 ${
                        modalStudent.paymentPct >= 100
                          ? "from-emerald-500 to-green-500"
                          : modalStudent.paymentPct >= 50
                          ? "from-amber-500 to-yellow-500"
                          : "from-rose-500 to-orange-500"
                      }`}
                      style={{ width: `${Math.min(modalStudent.paymentPct, 100)}%` }}
                    />
                  </div>
                </div>
                <StatusDotBadge status={modalStudent.status} />
              </div>

              {/* Fee Breakdown */}
              {modalStudent.feeItems.length > 0 && (
                <div>
                  <p className="text-[11px] font-semibold text-gray-600 mb-2 flex items-center gap-1.5">
                    <BookOpen className="h-3.5 w-3.5 text-gray-400" />
                    Fee Breakdown
                  </p>
                  <div className="space-y-1.5">
                    {modalStudent.feeItems.map((fee, fi) => (
                      <div
                        key={fi}
                        className="flex items-center justify-between p-2.5 rounded-lg bg-gray-50 border border-gray-100"
                      >
                        <span className="text-xs text-gray-600">{fee.title}</span>
                        <span className="text-xs font-bold text-gray-900">{formatMoney(fee.amount)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Bills count */}
              {modalStudent.billCount > 1 && (
                <p className="text-[10px] text-gray-400 text-center">
                  {modalStudent.billCount} bill{modalStudent.billCount !== 1 ? "s" : ""} combined
                </p>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
