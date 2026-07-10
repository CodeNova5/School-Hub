"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  Circle,
  ChevronDown,
  ChevronUp,
  X,
  Rocket,
  Building2,
  GraduationCap,
  Calendar,
  UserPlus,
  Users,
  ExternalLink,
  Sparkles,
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────

interface ChecklistItem {
  id: string;
  icon: any;
  title: string;
  desc: string;
  href: string;
  color: string;
  iconColor: string;
  dotColor: string;
}

// ── Checklist definition ──────────────────────────────────────────────────

const CHECKLIST_ITEMS: ChecklistItem[] = [
  {
    id: "school_config",
    icon: Building2,
    title: "Complete school profile",
    desc: "Add your school logo, motto, address and contact details.",
    href: "/admin/school-config",
    color: "text-blue-600",
    iconColor: "bg-blue-50 text-blue-600",
    dotColor: "bg-blue-500",
  },
  {
    id: "setup_wizard",
    icon: Sparkles,
    title: "Run school setup wizard",
    desc: "Configure academic structure, classes, streams and departments.",
    href: "/admin/school-config",
    color: "text-violet-600",
    iconColor: "bg-violet-50 text-violet-600",
    dotColor: "bg-violet-500",
  },
  {
    id: "sessions",
    icon: Calendar,
    title: "Create an academic session",
    desc: "Set up your current academic year and term dates.",
    href: "/admin/sessions",
    color: "text-amber-600",
    iconColor: "bg-amber-50 text-amber-600",
    dotColor: "bg-amber-500",
  },
  {
    id: "teachers",
    icon: UserPlus,
    title: "Add your first teachers",
    desc: "Register teaching staff so they can access their portal.",
    href: "/admin/teachers",
    color: "text-emerald-600",
    iconColor: "bg-emerald-50 text-emerald-600",
    dotColor: "bg-emerald-500",
  },
  {
    id: "students",
    icon: GraduationCap,
    title: "Enroll your first students",
    desc: "Add student records and assign them to classes.",
    href: "/admin/students",
    color: "text-indigo-600",
    iconColor: "bg-indigo-50 text-indigo-600",
    dotColor: "bg-indigo-500",
  },
];

const STORAGE_KEY = "schoolhub_onboarding_dismissed";
const CHECKED_KEY = "schoolhub_onboarding_checked";

// ── Progress ring ─────────────────────────────────────────────────────────

function ProgressRing({ done, total }: { done: number; total: number }) {
  const pct = total === 0 ? 0 : done / total;
  const r = 16;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - pct);

  return (
    <svg className="w-10 h-10 -rotate-90" viewBox="0 0 40 40">
      <circle cx="20" cy="20" r={r} fill="none" stroke="#e5e7eb" strokeWidth="3.5" />
      <circle
        cx="20" cy="20" r={r}
        fill="none"
        stroke={done === total ? "#10b981" : "#3b82f6"}
        strokeWidth="3.5"
        strokeLinecap="round"
        strokeDasharray={circ}
        strokeDashoffset={offset}
        style={{ transition: "stroke-dashoffset 0.4s cubic-bezier(0.16,1,0.3,1), stroke 0.3s ease" }}
      />
      <text
        x="20" y="20"
        textAnchor="middle"
        dominantBaseline="central"
        className="rotate-90 origin-center"
        style={{ transform: "rotate(90deg)", transformOrigin: "20px 20px" }}
        fontSize="11"
        fontWeight="700"
        fill={done === total ? "#10b981" : "#3b82f6"}
      >
        {done}/{total}
      </text>
    </svg>
  );
}

// ── Main Component ────────────────────────────────────────────────────────

interface OnboardingChecklistProps {
  /** Hide if school already has students & teachers (passed from dashboard) */
  isNewSchool?: boolean;
}

export function OnboardingChecklist({ isNewSchool = true }: OnboardingChecklistProps) {
  const router = useRouter();
  const [dismissed, setDismissed] = useState(true); // start hidden, load from storage
  const [collapsed, setCollapsed] = useState(false);
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set());
  const [mounted, setMounted] = useState(false);

  // Load persisted state
  useEffect(() => {
    const isDismissed = localStorage.getItem(STORAGE_KEY) === "true";
    const savedChecked = localStorage.getItem(CHECKED_KEY);
    if (savedChecked) {
      try {
        setCheckedIds(new Set(JSON.parse(savedChecked)));
      } catch {}
    }
    setDismissed(isDismissed);
    setMounted(true);
  }, []);

  // Persist checked state
  useEffect(() => {
    if (!mounted) return;
    localStorage.setItem(CHECKED_KEY, JSON.stringify([...checkedIds]));
  }, [checkedIds, mounted]);

  function toggleCheck(id: string) {
    setCheckedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function dismiss() {
    localStorage.setItem(STORAGE_KEY, "true");
    setDismissed(true);
  }

  // Don't render if dismissed, not mounted, or not a new school
  if (!mounted || dismissed || !isNewSchool) return null;

  const done = checkedIds.size;
  const total = CHECKLIST_ITEMS.length;
  const allDone = done === total;

  return (
    <div className={`onboarding-checklist rounded-2xl border shadow-sm overflow-hidden transition-all duration-300 ${allDone ? "border-emerald-200 bg-gradient-to-r from-emerald-50 to-teal-50" : "border-blue-100 bg-gradient-to-r from-blue-50/80 to-indigo-50/50 bg-white"}`}>
      {/* Header */}
      <div className="px-5 py-4 flex items-center gap-4">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <ProgressRing done={done} total={total} />
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h3 className={`font-bold text-sm ${allDone ? "text-emerald-700" : "text-gray-900"}`}>
                {allDone ? "School setup complete! 🎉" : "Getting Started"}
              </h3>
              {!allDone && (
                <span className="text-[10px] font-bold text-blue-600 bg-blue-100 px-1.5 py-0.5 rounded-full flex-shrink-0">
                  {total - done} remaining
                </span>
              )}
            </div>
            <p className={`text-xs truncate ${allDone ? "text-emerald-600" : "text-gray-500"}`}>
              {allDone
                ? "You've completed all setup steps — your school is ready!"
                : "Complete these steps to get your school fully set up"
              }
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            type="button"
            onClick={() => setCollapsed(!collapsed)}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-white/60 transition-all duration-150"
            aria-label={collapsed ? "Expand" : "Collapse"}
          >
            {collapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
          </button>
          <button
            type="button"
            onClick={dismiss}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-white/60 transition-all duration-150"
            aria-label="Dismiss checklist"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Collapsible body */}
      {!collapsed && (
        <div className="px-5 pb-5 space-y-2 checklist-body">
          {CHECKLIST_ITEMS.map((item, i) => {
            const isChecked = checkedIds.has(item.id);
            return (
              <div
                key={item.id}
                className={`
                  group flex items-center gap-3 p-3.5 rounded-xl border transition-all duration-200 cursor-pointer
                  ${isChecked
                    ? "bg-white/40 border-gray-100 opacity-70"
                    : "bg-white border-gray-100 hover:border-blue-200 hover:shadow-sm hover:shadow-blue-50"
                  }
                `}
                onClick={() => toggleCheck(item.id)}
                style={{ animationDelay: `${i * 0.05}s` }}
              >
                {/* Checkbox */}
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); toggleCheck(item.id); }}
                  className="flex-shrink-0 focus:outline-none"
                  aria-label={isChecked ? "Mark incomplete" : "Mark complete"}
                >
                  {isChecked
                    ? <CheckCircle2 className="w-5 h-5 text-emerald-500 transition-all duration-200" />
                    : <Circle className="w-5 h-5 text-gray-300 group-hover:text-blue-400 transition-colors duration-200" />
                  }
                </button>

                {/* Icon */}
                <div className={`p-1.5 rounded-lg flex-shrink-0 transition-all duration-200 ${isChecked ? "opacity-50" : item.iconColor}`}>
                  <item.icon className="w-4 h-4" />
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-semibold transition-all duration-200 ${isChecked ? "text-gray-400 line-through" : "text-gray-800"}`}>
                    {item.title}
                  </p>
                  <p className={`text-xs truncate transition-all duration-200 ${isChecked ? "text-gray-300" : "text-gray-500"}`}>
                    {item.desc}
                  </p>
                </div>

                {/* Go arrow */}
                {!isChecked && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      router.push(item.href);
                    }}
                    className={`flex-shrink-0 p-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-all duration-200 hover:bg-blue-50 ${item.color}`}
                    aria-label={`Go to ${item.title}`}
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            );
          })}

          {/* All done CTA */}
          {allDone && (
            <div className="flex items-center justify-between p-3.5 rounded-xl bg-emerald-100/60 border border-emerald-200 mt-2">
              <div className="flex items-center gap-2">
                <Rocket className="w-4 h-4 text-emerald-600" />
                <span className="text-sm font-semibold text-emerald-700">
                  Your school is fully configured!
                </span>
              </div>
              <button
                type="button"
                onClick={dismiss}
                className="text-xs font-bold text-emerald-600 hover:text-emerald-800 underline underline-offset-2 transition-colors"
              >
                Dismiss
              </button>
            </div>
          )}
        </div>
      )}

      <style>{`
        @keyframes checklist-in {
          from { opacity: 0; transform: translateY(-12px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .onboarding-checklist { animation: checklist-in 0.35s cubic-bezier(0.16,1,0.3,1); }

        @keyframes checklist-item-in {
          from { opacity: 0; transform: translateX(-6px); }
          to { opacity: 1; transform: translateX(0); }
        }
        .checklist-body > div { animation: checklist-item-in 0.25s cubic-bezier(0.16,1,0.3,1) both; }

        @media (prefers-reduced-motion: reduce) {
          .onboarding-checklist { animation: none; }
          .checklist-body > div { animation: none; }
        }
      `}</style>
    </div>
  );
}
