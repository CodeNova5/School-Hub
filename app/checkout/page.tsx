"use client";

import { useEffect, useState, Suspense, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { usePlanDisplayInfo } from "@/hooks/use-plan-display-info";
import {
  Shield,
  Zap,
  Sparkles,
  ArrowLeft,
  Check,
  Loader2,
  AlertCircle,
  Clock,
  Calendar,
  ChevronRight,
  Lock,
  CreditCard,
  Building2,
  Mail,
  Receipt,
} from "lucide-react";

// ── Helpers ────────────────────────────────────────────────────────────────

function formatPrice(cents: number): string {
  if (cents === 0) return "Free";
  return `₦${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

// ── Loading Skeleton ──────────────────────────────────────────────────────

function CheckoutSkeleton() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
      <div className="max-w-3xl mx-auto px-4 py-16 sm:px-6">
        <div className="space-y-6 animate-pulse">
          <div className="h-6 w-32 bg-slate-200 dark:bg-slate-800 rounded-lg" />
          <div className="h-10 w-64 bg-slate-200 dark:bg-slate-800 rounded-lg mx-auto" />
          <div className="h-4 w-96 bg-slate-200 dark:bg-slate-800 rounded-lg mx-auto" />
          <div className="h-64 bg-slate-200 dark:bg-slate-800 rounded-2xl" />
        </div>
      </div>
    </div>
  );
}

// ── Error State ──────────────────────────────────────────────────────────

function CheckoutError({ title, message }: { title: string; message: string }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 flex items-center justify-center p-6">
      <div className="text-center space-y-4 max-w-md">
        <div className="w-16 h-16 rounded-2xl bg-red-100 dark:bg-red-900/30 flex items-center justify-center mx-auto">
          <AlertCircle className="h-8 w-8 text-red-600 dark:text-red-400" />
        </div>
        <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">{title}</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400">{message}</p>
      </div>
    </div>
  );
}

// ── Main Checkout Content ────────────────────────────────────────────────

function CheckoutContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { getPlanInfo, isLoading: plansLoading } = usePlanDisplayInfo();

  // ── Params ──
  const planKey = searchParams.get("plan") || "";
  const billingInterval = (searchParams.get("interval") || "termly") as "termly" | "yearly";
  const featureKey = searchParams.get("feature") || "";
  const returnPath = searchParams.get("from") || "";

  // ── State ──
  const [mounted, setMounted] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const planInfo = getPlanInfo(planKey);
  const price = billingInterval === "termly"
    ? (planInfo.termly_price || planInfo.monthly_price * 3)
    : planInfo.yearly_price;

  // ── Animate in ──
  useEffect(() => {
    const timer = setTimeout(() => setMounted(true), 80);
    return () => clearTimeout(timer);
  }, []);

  // ── Handle payment ──
  const handleProceedToPayment = useCallback(async () => {
    if (!planKey || processing) return;
    setProcessing(true);
    setError(null);

    try {
      // Initialize payment — server accepts plan_key directly (e.g., "pro")
      const initRes = await fetch("/api/school/subscription/initialize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          planId: planKey,
          billingInterval,
        }),
      });

      const initData = await initRes.json();
      if (!initRes.ok) throw new Error(initData.error || "Failed to initialize payment");

      // Redirect to Paystack
      if (initData.authorizationUrl) {
        window.location.href = initData.authorizationUrl;
      } else {
        throw new Error("No payment URL received");
      }
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred");
      setProcessing(false);
    }
  }, [planKey, billingInterval, processing]);

  // ── Handle success from Paystack redirect ──
  useEffect(() => {
    const reference = searchParams.get("reference");
    const txRef = searchParams.get("trxref");

    if (reference || txRef) {
      const ref = reference || txRef!;
      setProcessing(true);

      fetch(`/api/school/subscription/verify?reference=${encodeURIComponent(ref)}`)
        .then((res) => res.json())
        .then((data) => {
          setProcessing(false);
          if (data.status === "success") {
            router.push(`/checkout/success?plan=${planKey}&interval=${billingInterval}`);
          } else if (data.status === "abandoned") {
            setError("Payment was cancelled. You can try again.");
          } else {
            setError("Payment verification failed. Please contact support.");
          }
        })
        .catch(() => {
          setProcessing(false);
          setError("Failed to verify payment. Please contact support.");
        });
    }
  }, []);

  // ── Loading ──
  if (plansLoading) return <CheckoutSkeleton />;

  // ── No plan specified ──
  if (!planKey || !planInfo) {
    return (
      <CheckoutError
        title="No plan selected"
        message="Please select a plan from the subscription page first."
      />
    );
  }

  const animClass = mounted
    ? "opacity-100 translate-y-0"
    : "opacity-0 translate-y-6";

  const planColors = {
    iconBg: planKey === "basic" ? "bg-green-100 dark:bg-green-900/30"
      : planKey === "pro" ? "bg-blue-100 dark:bg-blue-900/30"
      : "bg-purple-100 dark:bg-purple-900/30",
    color: planKey === "basic" ? "text-green-600"
      : planKey === "pro" ? "text-blue-600"
      : "text-purple-600",
    border: planKey === "basic" ? "border-green-200 dark:border-green-800"
      : planKey === "pro" ? "border-blue-200 dark:border-blue-800"
      : "border-purple-200 dark:border-purple-800",
    buttonBg: planKey === "basic"
      ? "bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-slate-200"
      : planKey === "pro"
        ? "bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
        : "bg-gradient-to-r from-purple-600 to-violet-600 hover:from-purple-700 hover:to-violet-700",
    shadow: planKey === "pro" ? "shadow-blue-500/20" : planKey === "premium" ? "shadow-purple-500/20" : "",
  };

  const PlanIcon = planKey === "basic" ? Shield
    : planKey === "pro" ? Zap
    : Sparkles;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
      {/* Decorative Background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 rounded-full bg-gradient-to-br from-blue-100/30 to-indigo-100/20 dark:from-blue-900/10 dark:to-indigo-900/5 blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 rounded-full bg-gradient-to-tr from-purple-100/20 to-pink-100/10 dark:from-purple-900/5 dark:to-pink-900/5 blur-3xl" />
      </div>

      <div className="relative max-w-3xl mx-auto px-4 py-12 sm:py-16 sm:px-6 lg:px-8">
        {/* Back button */}
        <div className={`mb-8 transition-all duration-500 ease-out ${animClass}`}>
          <button
            onClick={() => router.push(returnPath || "/subscription")}
            className="inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to plans
          </button>
        </div>

        {/* Header */}
        <div className={`text-center mb-10 transition-all duration-500 ease-out ${animClass}`}>
          <h1 className="text-3xl sm:text-4xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
            Complete Your Purchase
          </h1>
          <p className="mt-3 text-sm sm:text-base text-slate-500 dark:text-slate-400 max-w-xl mx-auto leading-relaxed">
            Review your plan selection and proceed to payment
          </p>
        </div>

        <div className={`grid grid-cols-1 lg:grid-cols-5 gap-8 transition-all duration-500 delay-100 ease-out ${animClass}`}>
          {/* ── Order Summary ── */}
          <div className="lg:col-span-3 space-y-6">
            {/* Plan Summary Card */}
            <div className={`rounded-2xl border-2 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl ${planColors.border} overflow-hidden`}>
              <div className="p-6 sm:p-8">
                <div className="flex items-start gap-4">
                  <div className={`p-3 rounded-xl ${planColors.iconBg}`}>
                    <PlanIcon className={`h-6 w-6 ${planColors.color}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">
                      {planInfo.label_short} Plan
                    </h2>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                      {planInfo.description}
                    </p>
                  </div>
                </div>
              </div>

              {/* Price Breakdown */}
              <div className="border-t border-slate-200 dark:border-slate-700 px-6 sm:px-8 py-5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {billingInterval === "termly" ? (
                      <Clock className="h-4 w-4 text-slate-400" />
                    ) : (
                      <Calendar className="h-4 w-4 text-slate-400" />
                    )}
                    <span className="text-sm text-slate-600 dark:text-slate-300">
                      {billingInterval === "termly" ? "Per Term" : "Yearly"} billing
                    </span>
                  </div>                    <span className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                    {formatPrice(price)}
                  </span>
                </div>

                {billingInterval === "termly" && price > 0 && (
                  <div className="mt-3 p-3 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
                    <div className="flex items-center gap-2 text-sm text-green-700 dark:text-green-300">
                      <Check className="h-4 w-4" />
                      <span>3 terms per academic year. No charges during holidays.</span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* What You'll Get */}
            <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white/50 dark:bg-slate-900/50 p-6 sm:p-8">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-4">
                What&apos;s Included
              </h3>
              <ul className="space-y-3">
                {[
                  "Full access to all {plan} features",
                  "Priority email & chat support",
                  "Secure data hosting & backups",
                  "Regular feature updates",
                  "Multi-platform access (Admin, Teacher, Student, Parent)",
                ].map((item, i) => (
                  <li key={i} className="flex items-start gap-3 text-sm text-slate-600 dark:text-slate-400">
                    <Check className={`h-4 w-4 mt-0.5 flex-shrink-0 ${planColors.color}`} />
                    <span>{item.replace("{plan}", planInfo.label_short)}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* ── Payment Panel ── */}
          <div className="lg:col-span-2">
            <div className="sticky top-8 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl shadow-xl overflow-hidden">
              {/* Summary Bar */}
              <div className="p-6 border-b border-slate-200 dark:border-slate-700">
                <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-4">
                  Payment Summary
                </h3>

                <div className="space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-500 dark:text-slate-400">
                      {planInfo.label_short} Plan ({billingInterval === "termly" ? "Termly" : "Yearly"})
                    </span>
                    <span className="font-medium text-slate-700 dark:text-slate-300">
                      {formatPrice(price)}
                    </span>
                  </div>
                  <div className="border-t border-slate-200 dark:border-slate-700 pt-3 flex items-center justify-between">
                    <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                      Total Due Today
                    </span>
                    <span className="text-xl font-bold text-slate-900 dark:text-slate-100">
                      {formatPrice(price)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Payment Info */}
              <div className="p-6 space-y-4">
                <div className="flex items-center gap-3 p-3 rounded-lg bg-slate-50 dark:bg-slate-800 text-sm text-slate-600 dark:text-slate-400">
                  <Lock className="h-4 w-4 text-slate-400 flex-shrink-0" />
                  <span>Payments are processed securely via Paystack</span>
                </div>

                <div className="flex items-center gap-3 p-3 rounded-lg bg-slate-50 dark:bg-slate-800 text-sm text-slate-600 dark:text-slate-400">
                  <Receipt className="h-4 w-4 text-slate-400 flex-shrink-0" />
                  <span>Invoice will be sent to your email after payment</span>
                </div>

                {/* CTA */}
                <button
                  onClick={handleProceedToPayment}
                  disabled={processing || !planKey}
                  className={`
                    w-full inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl text-sm font-semibold
                    text-white shadow-lg transition-all duration-200
                    ${planColors.buttonBg}
                    ${planColors.shadow}
                    hover:scale-[1.02] hover:shadow-xl
                    active:scale-[0.98]
                    focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500/50
                    disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100
                  `}
                >
                  {processing ? (
                    <>
                      <Loader2 className="h-5 w-5 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <CreditCard className="h-5 w-5" />
                      Pay with Paystack
                      <ChevronRight className="h-4 w-4" />
                    </>
                  )}
                </button>

                {/* Error Display */}
                {error && (
                  <div className="flex items-start gap-2 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-sm">
                    <AlertCircle className="h-4 w-4 text-red-500 mt-0.5 flex-shrink-0" />
                    <span className="text-red-600 dark:text-red-400">{error}</span>
                  </div>
                )}

                <p className="text-xs text-center text-slate-400 dark:text-slate-500">
                  By proceeding, you agree to our{" "}
                  <button className="text-blue-600 dark:text-blue-400 hover:underline">Terms of Service</button>
                  {" "}and{" "}
                  <button className="text-blue-600 dark:text-blue-400 hover:underline">Privacy Policy</button>
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Wrap in Suspense for useSearchParams ─────────────────────────────────

export default function CheckoutPage() {
  return (
    <Suspense fallback={<CheckoutSkeleton />}>
      <CheckoutContent />
    </Suspense>
  );
}
