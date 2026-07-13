import { APP_NAME } from "@/data";
import { Suspense } from "react";
import { FeatureLockedPage } from "@/components/feature-locked-page";

/**
 * Upgrade page — shown when a user tries to access a feature their
 * school plan does not include.
 *
 * Query params:
 *   - feature: The PlanFeature key (e.g., "finance", "ai_assistant")
 *   - plan:    The school's current plan (e.g., "basic", "pro")
 */
export const metadata = {
  title: `Upgrade Required — ${APP_NAME}`,
  description: `This feature requires an upgraded school plan.`,
};

export default function UpgradePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 dark:from-slate-950 dark:to-slate-900 flex items-center justify-center">
          <div className="animate-pulse space-y-4 text-center">
            <div className="w-16 h-16 rounded-2xl bg-slate-200 dark:bg-slate-800 mx-auto" />
            <div className="h-5 w-40 bg-slate-200 dark:bg-slate-800 rounded-lg mx-auto" />
          </div>
        </div>
      }
    >
      <FeatureLockedPage />
    </Suspense>
  );
}
