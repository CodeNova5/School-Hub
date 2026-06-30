"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CheckCircle, ChevronRight, Sparkles, GraduationCap, Calendar } from "lucide-react";

function SuccessSkeleton() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-green-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 flex items-center justify-center p-6">
      <div className="w-full max-w-md animate-pulse space-y-6">
        <div className="w-20 h-20 rounded-full bg-green-200 dark:bg-green-800 mx-auto" />
        <div className="h-8 w-48 bg-slate-200 dark:bg-slate-800 rounded-lg mx-auto" />
        <div className="h-4 w-64 bg-slate-200 dark:bg-slate-800 rounded-lg mx-auto" />
        <div className="h-12 w-full bg-slate-200 dark:bg-slate-800 rounded-xl" />
      </div>
    </div>
  );
}

function SuccessContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [mounted, setMounted] = useState(false);

  const planKey = searchParams.get("plan") || "basic";
  const interval = searchParams.get("interval") || "termly";
  const termName = searchParams.get("termName");
  const termNames = searchParams.get("termNames") || "";

  useEffect(() => {
    const timer = setTimeout(() => setMounted(true), 80);
    return () => clearTimeout(timer);
  }, []);

  const animClass = mounted
    ? "opacity-100 translate-y-0"
    : "opacity-0 translate-y-6";

  const planLabel = planKey.charAt(0).toUpperCase() + planKey.slice(1);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-green-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 flex items-center justify-center p-6">
      <div className={`max-w-md w-full transition-all duration-700 ease-out ${animClass}`}>
        <div className="rounded-2xl border-2 border-green-200 dark:border-green-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl shadow-xl p-8 sm:p-10 text-center space-y-6">
          {/* Success Icon */}
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-green-100 dark:bg-green-900/30">
            <CheckCircle className="h-10 w-10 text-green-600 dark:text-green-400" />
          </div>

          {/* Title */}
          <div className="space-y-2">
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-slate-100">
              Payment Successful!
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Your <span className="font-semibold text-slate-700 dark:text-slate-300">{planLabel}</span> plan has
              been activated with {interval === "termly" ? "termly" : "yearly"} billing.
            </p>
          </div>

          {/* Term info */}
          {interval === "termly" && termName && (
            <div className="p-3 rounded-xl bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 flex items-center gap-3 text-left">
              <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/50 shrink-0">
                <GraduationCap className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-medium text-blue-500 dark:text-blue-400 uppercase tracking-wider">
                  Covered Term
                </p>
                <p className="text-sm font-semibold text-blue-900 dark:text-blue-200 truncate">
                  {termName}
                </p>
              </div>
            </div>
          )}

          {interval === "yearly" && termNames && (
            <div className="p-4 rounded-xl bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 text-left space-y-3">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/50 shrink-0">
                  <Calendar className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <p className="text-xs font-medium text-blue-500 dark:text-blue-400 uppercase tracking-wider">
                    Covered Terms (3 terms ahead)
                  </p>
                  <p className="text-[10px] text-blue-400 dark:text-blue-500 mt-0.5">
                    Full academic year — no charges during breaks
                  </p>
                </div>
              </div>
              <div className="space-y-1.5">
                {termNames.split(", ").map((name, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm">
                    <span className="w-5 h-5 rounded-full bg-blue-100 dark:bg-blue-800 flex items-center justify-center text-[10px] font-bold text-blue-700 dark:text-blue-300 shrink-0">
                      {i + 1}
                    </span>
                    <span className="font-medium text-blue-800 dark:text-blue-200">{name}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {interval === "yearly" && !termNames && (
            <div className="p-3 rounded-xl bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 flex items-center gap-3 text-left">
              <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/50 shrink-0">
                <Calendar className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-medium text-blue-500 dark:text-blue-400 uppercase tracking-wider">
                  Billing Period
                </p>
                <p className="text-sm font-semibold text-blue-900 dark:text-blue-200">
                  Full academic year
                </p>
              </div>
            </div>
          )}

          {/* Benefits */}
          <div className="p-4 rounded-xl bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-left space-y-2">
            {[
              "All features are now unlocked",
              "Access to premium tools and integrations",
              "Priority support available",
              interval === "termly"
                ? "Next term payment will be due before the next term starts"
                : "Next billing will be processed in one year",
            ].map((item, i) => (
              <div key={i} className="flex items-start gap-2 text-sm text-green-700 dark:text-green-300">
                <Sparkles className="h-4 w-4 mt-0.5 flex-shrink-0" />
                <span>{item}</span>
              </div>
            ))}
          </div>

          {/* CTA */}
          <button
            onClick={() => router.push("/admin")}
            className="w-full inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl text-sm font-semibold
              bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:from-blue-700 hover:to-indigo-700
              shadow-lg shadow-blue-500/20 hover:shadow-xl
              transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]
              focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500/50"
          >
            Go to Dashboard
            <ChevronRight className="h-4 w-4" />
          </button>

          {/* Footer */}
          <p className="text-xs text-slate-400 dark:text-slate-500">
            A receipt has been sent to your email. Need help?{" "}
            <button className="text-blue-600 dark:text-blue-400 hover:underline underline-offset-2">
              Contact support
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}

export default function CheckoutSuccessPage() {
  return (
    <Suspense fallback={<SuccessSkeleton />}>
      <SuccessContent />
    </Suspense>
  );
}
