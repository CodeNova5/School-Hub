"use client";

/* ─────────────────────────────────────────────
   Shared Finance UI Components
   StatusDotBadge, PaymentProgressBar, FeePill, StudentAvatar
───────────────────────────────────────────── */

/* ── Status Badge with Colored Dot ──────────────────── */

interface StatusDotBadgeProps {
  status: string;
}

export function StatusDotBadge({ status }: StatusDotBadgeProps) {
  const config: Record<string, { dot: string; bg: string; text: string; label: string }> = {
    paid: { dot: "bg-emerald-500", bg: "bg-emerald-50", text: "text-emerald-700", label: "Paid" },
    partial: { dot: "bg-amber-500", bg: "bg-amber-50", text: "text-amber-700", label: "Partial" },
    pending: { dot: "bg-blue-500", bg: "bg-blue-50", text: "text-blue-700", label: "Pending" },
    unpaid: { dot: "bg-rose-500", bg: "bg-rose-50", text: "text-rose-700", label: "Unpaid" },
    overdue: { dot: "bg-red-500", bg: "bg-red-50", text: "text-red-700", label: "Overdue" },
    waived: { dot: "bg-gray-500", bg: "bg-gray-50", text: "text-gray-600", label: "Waived" },
    cancelled: { dot: "bg-gray-500", bg: "bg-gray-50", text: "text-gray-600", label: "Cancelled" },
    success: { dot: "bg-emerald-500", bg: "bg-emerald-50", text: "text-emerald-700", label: "Success" },
    failed: { dot: "bg-red-500", bg: "bg-red-50", text: "text-red-700", label: "Failed" },
  };
  const cfg = config[status] || { dot: "bg-gray-500", bg: "bg-gray-50", text: "text-gray-600", label: status };
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${cfg.bg} ${cfg.text} border border-transparent`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot} ${status === "overdue" ? "animate-pulse" : ""}`} />
      {cfg.label}
    </span>
  );
}

/* ── Payment Progress Bar ───────────────────────────── */

interface PaymentProgressBarProps {
  pct: number;
}

export function PaymentProgressBar({ pct }: PaymentProgressBarProps) {
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

/* ── Fee Pill (Shortened Fee Label) ─────────────────── */

interface FeePillProps {
  label: string;
}

export function FeePill({ label }: FeePillProps) {
  const short = label.replace(/ Fees$/, "").replace(/ & Activities$/, "").replace(/ Levy$/, "");
  return (
    <span className="inline-block text-[10px] font-medium px-2 py-0.5 rounded bg-gray-100 text-gray-600 border border-gray-200 whitespace-nowrap">
      {short}
    </span>
  );
}

/* ── Student Avatar (Initials) ──────────────────────── */

interface StudentAvatarProps {
  firstName?: string;
  lastName?: string;
}

const AVATAR_COLORS = [
  "#6366f1", "#8b5cf6", "#a855f7", "#ec4899",
  "#f43f5e", "#f97316", "#22c55e", "#14b8a6",
  "#06b6d4", "#3b82f6",
];

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

export function StudentAvatar({ firstName, lastName }: StudentAvatarProps) {
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
