"use client";

import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  CreditCard,
  BookOpen,
  Calendar,
  CheckCircle2,
  GraduationCap,
  TrendingUp,
  Zap,
  Download,
  ChevronRight,
  Gift,
  Shield,
} from "lucide-react";
import { usePlanDisplayInfo } from "@/hooks/use-plan-display-info";
import {
  formatPrice,
  formatDate,
  formatShortDate,
  getStatusBadge,
  getPlanIconBg,
  getPlanColor,
  getIntervalLabel,
  getIntervalIcon,
  StatCard,
  GrantDetailsModal,
} from "./subscription-utils";
import type {
  Subscription,
  Plan,
  StatusResult,
  CurrentTermInfo,
  YearlyCoveredTerm,
  ActiveGrant,
} from "./subscription-types";

interface OverviewTabProps {
  subscription: Subscription | null | undefined;
  plans: Plan[] | undefined;
  currentPlanKey: string;
  currentPlanInfo: ReturnType<ReturnType<typeof usePlanDisplayInfo>["getPlanInfo"]>;
  PlanIcon: React.ComponentType<{ className?: string }>;
  isGrantBased: boolean;
  currentGrant: ActiveGrant | null;
  effectiveStatus: string;
  isGraceActive: boolean;
  isGraceExpired: boolean;
  isHolidayBreak: boolean;
  availablePlans: Plan[];
  holidayDismissed: boolean;
  setHolidayDismissed: (v: boolean) => void;
  subscriptionStatus: StatusResult | null | undefined;
  currentTerm: CurrentTermInfo | null | undefined;
  yearlyCoveredTerms: YearlyCoveredTerm[] | null | undefined;
  activeGrants: ActiveGrant[] | null | undefined;
  schoolName: string;
}

export function SubscriptionOverviewTab({
  subscription,
  plans,
  currentPlanKey,
  currentPlanInfo,
  PlanIcon,
  isGrantBased,
  currentGrant,
  effectiveStatus,
  isGraceActive,
  isGraceExpired,
  isHolidayBreak,
  availablePlans,
  holidayDismissed,
  setHolidayDismissed,
  subscriptionStatus,
  currentTerm,
  yearlyCoveredTerms,
  activeGrants,
  schoolName,
}: OverviewTabProps) {
  const router = useRouter();
  const { getPlanInfo } = usePlanDisplayInfo();

  return (
    <div className="space-y-6 mt-0">
      {/* Current Plan Card */}
      <Card className="shadow-sm border-gray-200 overflow-hidden">
        <CardHeader className="border-b bg-gradient-to-r from-slate-50 via-white to-blue-50/50 pb-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`p-3 rounded-xl ring-1 ring-black/5 ${getPlanIconBg(currentPlanKey)}`}>
                <PlanIcon className={`h-6 w-6 ${getPlanColor(currentPlanKey)}`} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <CardTitle className="text-lg">{currentPlanInfo?.label_short || currentPlanKey}</CardTitle>
                  {isGrantBased && (
                    <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 text-[10px] px-1.5 py-0">
                      <Gift className="h-3 w-3 mr-1" />
                      Granted
                    </Badge>
                  )}
                </div>
                <CardDescription>{subscription?.plan_name || schoolName || "School"}</CardDescription>
              </div>
            </div>
            {getStatusBadge(effectiveStatus)}
          </div>
        </CardHeader>
        <CardContent className="p-6">
          {/* Stats Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
            <StatCard
              icon={CheckCircle2}
              label="Status"
              value={
                <span className="capitalize">{effectiveStatus === "past_due" ? "Past Due (Grace Period)" : effectiveStatus}</span>
              }
              color="bg-emerald-100"
            />
            <StatCard
              icon={getIntervalIcon(subscription?.billing_interval, activeGrants)}
              label="Billing Interval"
              value={
                <span className="flex items-center gap-1.5">
                  {getIntervalLabel(subscription?.billing_interval, activeGrants)}
                </span>
              }
              color="bg-blue-100"
            />
            <StatCard
              icon={Calendar}
              label="Next Billing"
              value={formatShortDate(subscription?.next_billing_date)}
              color="bg-indigo-100"
            />
            <StatCard
              icon={GraduationCap}
              label="Current Term"
              value={currentTerm ? `${currentTerm.name} · ${currentTerm.session_name}` : "—"}
              color="bg-amber-100"
            />
          </div>

          {/* Price & Period Details */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-4 rounded-xl bg-gradient-to-br from-gray-50 to-gray-100/50 border border-gray-200">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Price</p>
              <p className="text-2xl font-bold text-gray-900">
                {isGrantBased ? (
                  <span className="flex items-center gap-2">
                    <Gift className="h-5 w-5 text-amber-500" />
                    <span>Granted</span>
                  </span>
                ) : subscription?.billing_interval === "termly" ? (
                  <>
                    {formatPrice(subscription.termly_price)}
                    <span className="text-sm font-normal text-gray-500">/term</span>
                  </>
                ) : (
                  <>
                    {formatPrice(subscription?.yearly_price || 0)}
                    <span className="text-sm font-normal text-gray-500">/yr</span>
                  </>
                )}
              </p>
              {isGrantBased && currentGrant && (
                <>
                  <p className="text-xs text-amber-600 mt-1 flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    {formatDate(currentGrant.start_date)} — {formatDate(currentGrant.end_date)}
                  </p>
                  {currentGrant.notes && (
                    <p className="text-xs text-gray-400 mt-0.5 italic">{currentGrant.notes}</p>
                  )}
                </>
              )}
            </div>
            <div className="p-4 rounded-xl bg-gradient-to-br from-gray-50 to-gray-100/50 border border-gray-200">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Billing Period</p>
              <p className="text-sm font-semibold text-gray-900">
                {formatDate(subscription?.current_period_start)} — {formatDate(subscription?.current_period_end)}
              </p>
              {currentTerm && (
                <div className="mt-2">
                  <p className="text-xs text-gray-500 flex items-center gap-1">
                    <GraduationCap className="h-3 w-3" />
                    {currentTerm.name} · {currentTerm.session_name}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {formatShortDate(currentTerm.start_date)} — {formatShortDate(currentTerm.end_date)}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Covered Terms (Yearly) */}
          {yearlyCoveredTerms && yearlyCoveredTerms.length > 0 && (
            <div className="mt-6 p-4 rounded-xl bg-blue-50 border border-blue-200">
              <div className="flex items-center gap-2 mb-3">
                <BookOpen className="h-4 w-4 text-blue-500" />
                <span className="text-xs font-semibold text-blue-700 uppercase tracking-wider">Covered Terms</span>
                <Badge variant="outline" className="text-blue-600 border-blue-300 bg-blue-100/50 ml-auto text-[10px]">
                  {yearlyCoveredTerms.length} terms
                </Badge>
              </div>
              <div className="space-y-2">
                {yearlyCoveredTerms.map((ct, idx) => (
                  <div key={ct.id} className="flex items-center gap-3">
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${
                      idx === yearlyCoveredTerms.length - 1
                        ? "bg-blue-200 text-blue-700 ring-2 ring-blue-300"
                        : "bg-blue-100 text-blue-500"
                    }`}>
                      {idx + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900">
                        {ct.name}
                        <span className="text-xs font-normal text-gray-500 ml-1">· {ct.session_name}</span>
                      </p>
                    </div>
                    <span className="text-xs text-gray-500 shrink-0">
                      {formatShortDate(ct.start_date)} – {formatShortDate(ct.end_date)}
                    </span>
                    <span className="text-[10px] font-medium text-blue-600 bg-blue-100 px-1.5 py-0.5 rounded-full shrink-0">
                      {ct.weeks}wk
                    </span>
                  </div>
                ))}
              </div>
              <p className="text-[10px] text-blue-500 mt-2 flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                Next renewal: {formatDate(subscription?.next_billing_date)}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Right Column — Quick Actions + Status + Upgrades */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Quick Actions */}
        <Card className="shadow-sm border-gray-200">
          <CardHeader className="border-b pb-4">
            <CardTitle className="text-sm flex items-center gap-2">
              <Zap className="h-4 w-4 text-amber-500" />
              Quick Actions
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 space-y-2">
            <Button
              variant="outline"
              className="w-full justify-start"
              onClick={() => router.push("/subscription")}
            >
              <TrendingUp className="h-4 w-4 mr-2" />
              Upgrade Plan
              <ChevronRight className="h-4 w-4 ml-auto" />
            </Button>
            <Button
              variant="outline"
              className="w-full justify-start"
              onClick={() => window.print()}
            >
              <Download className="h-4 w-4 mr-2" />
              Download Invoice
              <ChevronRight className="h-4 w-4 ml-auto" />
            </Button>
            {isGrantBased && currentGrant && (
              <>
                <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 mt-2">
                  <div className="flex items-start gap-2">
                    <Gift className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-xs font-semibold text-amber-800">Grant Active</p>
                      <p className="text-[10px] text-amber-600 mt-0.5">
                        Access granted by {currentGrant.granted_by_name || "Super Admin"}
                      </p>
                    </div>
                  </div>
                </div>
                <GrantDetailsModal grant={currentGrant} />
              </>
            )}
          </CardContent>
        </Card>

        {/* Status Card */}
        <Card className="shadow-sm border-gray-200">
          <CardHeader className="border-b pb-4">
            <CardTitle className="text-sm flex items-center gap-2">
              <Shield className="h-4 w-4 text-slate-500" />
              Subscription Status
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Status</span>
              {getStatusBadge(effectiveStatus)}
            </div>
            {subscription?.next_billing_date && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Next Charge</span>
                <span className="text-sm font-medium">{formatShortDate(subscription.next_billing_date)}</span>
              </div>
            )}
            {isGraceActive && subscription?.grace_period_ends_at && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Grace Ends</span>
                <span className="text-sm font-medium text-amber-600">
                  {formatShortDate(subscription.grace_period_ends_at)}
                </span>
              </div>
            )}
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Interval</span>
              <span className="text-sm font-medium capitalize">
                {getIntervalLabel(subscription?.billing_interval, activeGrants)}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Available Upgrades */}
        {availablePlans.length > 0 && (
          <Card className="shadow-sm border-gray-200">
            <CardHeader className="border-b pb-4">
              <CardTitle className="text-sm flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-emerald-500" />
                Available Upgrades
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-2">
              {availablePlans.map((plan) => {
                const info = getPlanInfo(plan.plan_key);
                const price = subscription?.billing_interval === "termly"
                  ? plan.termly_price
                  : plan.yearly_price;
                return (
                  <div
                    key={plan.id}
                    className="p-3 rounded-lg border hover:bg-gray-50 hover:border-gray-300 transition-all cursor-pointer"
                    onClick={() => router.push(`/subscription?plan=${plan.plan_key}`)}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className={`font-semibold text-sm ${getPlanColor(plan.plan_key)}`}>
                        {info?.label_short || plan.name}
                      </span>
                      <span className="text-sm font-bold">
                        {formatPrice(price)}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 line-clamp-1">{plan.description}</p>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
