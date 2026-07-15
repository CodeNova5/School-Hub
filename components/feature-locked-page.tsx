"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { APP_NAME } from "@/data";
import {
  Shield,
  ShieldAlert,
  ArrowUp,
  ArrowLeft,
  Lock,
  Sparkles,
  Check,
  Star,
  Building2,
} from "lucide-react";
import { getUpgradePlan } from "@/lib/plan-features";
import { usePlanFeatures } from "@/hooks/use-plan-features";
import { usePlanDisplayInfo } from "@/hooks/use-plan-display-info";
import type { PlanFeature, SchoolPlan } from "@/lib/types";

// ── Feature-to-benefits mapping ───────────────────────────────────────────

const FEATURE_BENEFITS: Partial<Record<PlanFeature, string[]>> = {
  finance: [
    "Fee templates and automated billing",
    "Paystack payment integration",
    "Digital receipts and invoices",
    "Payment tracking per student",
  ],
  payroll: [
    "Teacher salary configuration",
    "Automated payment processing",
    "Paystack subaccount support",
    "Payment history and reports",
  ],
  notifications: [
    "Push notification broadcasting",
    "Targeted messaging by class or role",
    "Real-time delivery status",
    "Notification history log",
  ],
  calendar: [
    "School events and holiday scheduling",
    "Exam timetable management",
    "Automated calendar sync",
    "Event reminders and alerts",
  ],
  families: [
    "Group siblings into families",
    "Consolidated billing per family",
    "Family-level communication",
    "Multi-student management",
  ],
  assignments: [
    "Create and distribute assignments",
    "Online submission portal",
    "Grading and feedback tools",
    "Due date tracking",
  ],
  subject_analytics: [
    "Per-subject performance tracking",
    "Class-level analytics dashboard",
    "Student progress reports",
    "Subject allocation management",
  ],
  parents_guardians: [
    "Parent account management",
    "Student-to-parent linking",
    "Parent communication portal",
    "Multi-guardian support",
  ],
  student_id_cards: [
    "Customizable ID card templates",
    "Student photo integration",
    "Batch card generation",
    "Print-ready export",
  ],
  teacher_id_cards: [
    "Professional ID card designs",
    "Staff photo integration",
    "Batch generation for all staff",
    "Print-ready PDF export",
  ],
  ai_assistant: [
    "AI-powered data query assistant",
    "Natural language reports",
    "Instant answers from school data",
    "Available for all user roles",
  ],
  website_builder: [
    "Drag-and-drop school website",
    "Custom subdomain setup",
    "Pre-built templates",
    "Real-time publishing",
  ],
  jamb_cbt: [
    "JAMB exam simulation platform",
    "Full subject coverage",
    "Performance analytics",
    "Timed practice tests",
  ],
  question_bank: [
    "Create and organize question banks",
    "Topic group management",
    "AI-assisted question generation",
    "Reusable assessment content",
  ],
  live_classes: [
    "Zoom-integrated virtual classes",
    "Schedule and manage sessions",
    "Attendance tracking",
    "Recording management",
  ],
  lesson_notes: [
    "AI-generated lesson notes",
    "Curriculum-aligned content",
    "Customizable templates",
    "Quick lesson preparation",
  ],
  admissions: [
    "Online application management",
    "Approve/reject workflow",
    "Exam scheduling",
    "Student data import on approval",
  ],
  alumni: [
    "Alumni profile directory",
    "Community engagement features",
    "Alumni event management",
    "Networking tools",
  ],
  inventory_management: [
    "Track assets, consumables, and saleable items",
    "Check-in/check-out workflow with serial numbers",
    "Low-stock alerts and automated notifications",
    "Full transaction audit ledger",
  ],
  audit_trail: [
    "Track all admin actions",
    "Detailed change logs",
    "User activity monitoring",
    "Compliance-ready records",
  ],
};

// ── Complete color variant sets ───────────────────────────────────────────

const PRO_VARIANTS = {
  gradientBg: "bg-gradient-to-br from-blue-600/10 via-indigo-500/5 to-blue-50 dark:to-blue-950/20",
  bannerBg: "bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300",
  iconBg: "bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-300",
  iconShadow: "shadow-blue-500/10",
  buttonBg: "bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700",
  buttonShadow: "shadow-blue-500/20",
  buttonShadowHover: "hover:shadow-blue-500/30",
  buttonFocus: "focus:ring-blue-500/50",
  accentText: "text-blue-500",
  borderClass: "border-blue-200 dark:border-blue-800",
  ringClass: "ring-blue-200 dark:ring-blue-800",
  decorationCircle: "bg-blue-100/40 dark:bg-blue-900/10",
  decorationCircle2: "bg-indigo-100/30 dark:bg-indigo-900/10",
  shadowColor: "shadow-blue-500/10",
};

const PREMIUM_VARIANTS = {
  gradientBg: "bg-gradient-to-br from-purple-600/10 via-violet-500/5 to-fuchsia-50 dark:to-purple-950/20",
  bannerBg: "bg-purple-50 dark:bg-purple-950/50 text-purple-700 dark:text-purple-300",
  iconBg: "bg-purple-100 dark:bg-purple-900/40 text-purple-600 dark:text-purple-300",
  iconShadow: "shadow-purple-500/10",
  buttonBg: "bg-gradient-to-r from-purple-600 to-violet-600 hover:from-purple-700 hover:to-violet-700",
  buttonShadow: "shadow-purple-500/20",
  buttonShadowHover: "hover:shadow-purple-500/30",
  buttonFocus: "focus:ring-purple-500/50",
  accentText: "text-purple-500",
  borderClass: "border-purple-200 dark:border-purple-800",
  ringClass: "ring-purple-200 dark:ring-purple-800",
  decorationCircle: "bg-purple-100/40 dark:bg-purple-900/10",
  decorationCircle2: "bg-violet-100/30 dark:bg-violet-900/10",
  shadowColor: "shadow-purple-500/10",
};

// ── Loading Skeleton ──────────────────────────────────────────────────────

function UpgradePageSkeleton() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 dark:from-slate-950 dark:to-slate-900 flex items-center justify-center p-6">
      <div className="w-full max-w-lg animate-pulse space-y-8">
        <div className="flex justify-center">
          <div className="w-20 h-20 rounded-2xl bg-slate-200 dark:bg-slate-800" />
        </div>
        <div className="space-y-3 text-center">
          <div className="h-6 w-48 bg-slate-200 dark:bg-slate-800 rounded-lg mx-auto" />
          <div className="h-4 w-72 bg-slate-200 dark:bg-slate-800 rounded-lg mx-auto" />
        </div>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-12 bg-slate-200 dark:bg-slate-800 rounded-xl" />
          ))}
        </div>
        <div className="h-12 bg-slate-200 dark:bg-slate-800 rounded-xl" />
        <div className="h-4 w-40 bg-slate-200 dark:bg-slate-800 rounded-lg mx-auto" />
      </div>
    </div>
  );
}

// ── Error State ───────────────────────────────────────────────────────────

function UpgradePageError({
  title,
  message,
}: {
  title: string;
  message: string;
}) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 dark:from-slate-950 dark:to-slate-900 flex items-center justify-center p-6">
      <div className="text-center space-y-4">
        <div className="w-16 h-16 rounded-2xl bg-red-100 dark:bg-red-900/30 flex items-center justify-center mx-auto">
          <ShieldAlert className="h-8 w-8 text-red-600 dark:text-red-400" />
        </div>
        <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">
          {title}
        </h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md">
          {message}
        </p>
      </div>
    </div>
  );
}

// ── Locked icon placeholder ───────────────────────────────────────────────

function FeatureFallbackIcon({ fallback }: { fallback: string }) {
  return (
    <span className="text-2xl" role="img" aria-hidden>
      {fallback}
    </span>
  );
}

// ============================================================================
// FeatureLockedPage Component
// ============================================================================

interface FeatureLockedPageProps {
  featureKey?: string | null;
  /**
   * Override the school plan (e.g., from context).
   * When not provided, the component reads it from search params.
   */
  currentPlan?: SchoolPlan | null;
}

export function FeatureLockedPage({
  featureKey,
  currentPlan: propPlan,
}: FeatureLockedPageProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { getRequiredPlan: getDbRequiredPlan, featureMetadata, isLoading: featuresLoading } = usePlanFeatures();
  const { getPlanInfo } = usePlanDisplayInfo();

  // ── State ──
  const [mounted, setMounted] = useState(false);

  // ── Derive feature & plans ──
  const featureKeyStr = featureKey ?? searchParams.get("feature") ?? "";
  const feature = featureKeyStr && featureMetadata
    ? (featureMetadata[featureKeyStr] ?? null)
    : null;

  // Required plan: DB-driven with fallback to FEATURE_PLAN_MAP logic
  const requiredPlan = featureKeyStr
    ? getDbRequiredPlan(featureKeyStr) as SchoolPlan | null
    : null;

  const planFromUrl = searchParams.get("plan") as SchoolPlan | null;
  const currentPlan: SchoolPlan = propPlan ?? planFromUrl ?? "basic";

  const upgradePlan = currentPlan ? getUpgradePlan(currentPlan) : null;
  const upgradeInfo = upgradePlan ? getPlanInfo(upgradePlan) : null;
  const currentInfo = getPlanInfo(currentPlan);
  const requiredInfo = requiredPlan ? getPlanInfo(requiredPlan) : null;

  // ── Animate in ──
  useEffect(() => {
    const timer = setTimeout(() => setMounted(true), 50);
    return () => clearTimeout(timer);
  }, []);

  // ── Determine visual variant ──
  const isPremium = requiredPlan === "premium";
  const v = isPremium ? PREMIUM_VARIANTS : PRO_VARIANTS;

  // ── Resolve feature icon ──
  const FeatureIcon = feature?.icon ? (
    <FeatureFallbackIcon fallback={feature.icon} />
  ) : null;

  // ── Benefits for this feature ──
  const benefits = featureKeyStr
    ? FEATURE_BENEFITS[featureKeyStr as PlanFeature] ?? []
    : [];

  // ── Handle back navigation with fallback ──
  const handleGoBack = () => {
    // Try to go back in history, fall back to /admin if no history
    if (window.history.length > 1) {
      router.back();
    } else {
      router.push("/admin");
    }
  };

  // ── Loading ──
  if (!mounted || (featuresLoading && !featureMetadata)) return <UpgradePageSkeleton />;

  // ── No feature found ──
  if (!feature || !requiredPlan) {
    return (
      <UpgradePageError
        title="No feature specified"
        message="Please specify which feature you'd like to unlock by providing a feature parameter."
      />
    );
  }

  const animClass = mounted
    ? "opacity-100 translate-y-0"
    : "opacity-0 translate-y-6";

  return (
    <div
      className={`min-h-screen ${v.gradientBg} dark:from-slate-950 dark:to-slate-900 flex flex-col items-center justify-center p-4 sm:p-6 transition-all duration-700 ease-out ${animClass}`}
    >
      {/* Decorative background elements */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div
          className={`absolute -top-40 -right-40 w-80 h-80 rounded-full bg-gradient-to-br ${v.decorationCircle} blur-3xl`}
        />
        <div
          className={`absolute -bottom-40 -left-40 w-80 h-80 rounded-full bg-gradient-to-tr ${v.decorationCircle2} blur-3xl`}
        />
      </div>

      {/* Main Card */}
      <div
        className={`
          relative w-full max-w-lg rounded-2xl border bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl
          ${v.shadowColor} shadow-2xl
          ${v.borderClass} ${v.ringClass}
          transition-all duration-500 delay-150 ease-out ${animClass}
          ring-1
        `}
      >
        {/* Lock Banner */}
        <div
          className={`flex items-center justify-center gap-2 px-4 py-2 rounded-t-2xl text-xs font-semibold uppercase tracking-wider ${v.bannerBg}`}
        >
          <Lock className="h-3.5 w-3.5" />
          <span>Feature Locked</span>
        </div>

        <div className="p-8 sm:p-10 space-y-8">
          {/* ── Feature Icon & Title ── */}
          <div className="text-center space-y-4">
            <div
              className={`inline-flex items-center justify-center w-20 h-20 rounded-2xl ${v.iconBg} ${v.iconShadow} shadow-lg ring-4 ring-white dark:ring-slate-800 transition-all duration-500 delay-300 ease-out scale-100 ${mounted ? "scale-100" : "scale-90 opacity-0"}`}
            >
              {FeatureIcon ?? <Shield className="h-10 w-10" />}
            </div>

            <div
              className={`transition-all duration-500 delay-400 ease-out ${mounted ? "opacity-100" : "opacity-0"}`}
            >
              <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-slate-100">
                {feature.label}
              </h1>
              <p className="mt-2 text-sm text-slate-500 dark:text-slate-400 max-w-sm mx-auto leading-relaxed">
                {feature.description}
              </p>
            </div>
          </div>

          {/* ── Plan Comparison ── */}
          <div
            className={`transition-all duration-500 delay-500 ease-out ${mounted ? "opacity-100" : "opacity-0"}`}
          >
            <div className="flex items-center justify-center gap-4 p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
              {/* Current Plan */}
              <div className="flex flex-col items-center gap-1.5 min-w-0">
                <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">
                  Your Plan
                </span>                  <span
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-semibold ${currentInfo.badge_color} dark:saturate-50`}
                >
                  <Shield className="h-3.5 w-3.5" />
                  {currentInfo.label_short}
                </span>
              </div>

              {/* Arrow */}
              <ArrowUp className="h-5 w-5 text-slate-300 dark:text-slate-600 flex-shrink-0" />

              {/* Required Plan */}
              <div className="flex flex-col items-center gap-1.5 min-w-0">
                <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">
                  Required
                </span>                  <span
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-semibold ${requiredInfo?.badge_color ?? currentInfo.badge_color} dark:saturate-50`}
                >
                  <Star className="h-3.5 w-3.5" />
                  {requiredInfo?.label_short ?? "Basic"}
                </span>
              </div>
            </div>
          </div>

          {/* ── Feature Benefits ── */}
          {benefits.length > 0 && (
            <div
              className={`space-y-3 transition-all duration-500 delay-600 ease-out ${mounted ? "opacity-100" : "opacity-0"}`}
            >
              <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                <Sparkles className={`h-4 w-4 ${v.accentText}`} />
                What you&apos;ll unlock
              </h3>
              <div className="space-y-2">
                {benefits.map((benefit, i) => (
                  <div
                    key={i}
                    className="flex items-start gap-3 text-sm text-slate-600 dark:text-slate-400"
                  >
                    <Check className={`h-4 w-4 mt-0.5 ${v.accentText} flex-shrink-0`} />
                    <span>{benefit}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Contact Admin Notice ── */}
          <div
            className={`transition-all duration-500 delay-700 ease-out ${mounted ? "opacity-100" : "opacity-0"}`}
          >
            <div className="p-5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 text-center space-y-3">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-slate-200 dark:bg-slate-700">
                <Building2 className="h-6 w-6 text-slate-500 dark:text-slate-400" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                  Contact your school administrator
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                  Plan changes and upgrades are managed by your school administration.
                  Please reach out to your admin to request access to this feature.
                </p>
              </div>
            </div>
          </div>

          {/* ── Back to Dashboard ── */}
          <div
            className={`text-center transition-all duration-500 delay-800 ease-out ${mounted ? "opacity-100" : "opacity-0"}`}
          >
            <button
              onClick={handleGoBack}
              className="inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Go back to dashboard
            </button>
          </div>
        </div>
      </div>

      {/* ── Footer branding ── */}
      <p className="mt-8 text-xs text-slate-400 dark:text-slate-600 transition-all duration-500 delay-1000">
        {APP_NAME} — Plan &amp; Billing
      </p>
    </div>
  );
}
