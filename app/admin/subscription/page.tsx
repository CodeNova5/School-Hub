"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Building2,
  Info,
  BookOpen,
  Receipt,
  CreditCard,
  ExternalLink,
  AlertTriangle,
  AlertCircle,
  Umbrella,
  GraduationCap,
  Calendar,
  Clock,
  ArrowRight,
  X,
  RefreshCw,
  CreditCard as CreditCardIcon,
} from "lucide-react";
import { usePlanDisplayInfo } from "@/hooks/use-plan-display-info";
import {
  formatDate,
  formatShortDate,
  getStatusBadge,
  getPlanIcon,
  SubscriptionPageSkeleton,
} from "@/components/subscription-utils";
import { SubscriptionOverviewTab } from "@/components/subscription-overview-tab";
import { SubscriptionPlansTab } from "@/components/subscription-plans-tab";
import { SubscriptionBillingTab } from "@/components/subscription-billing-tab";
import type { ApiResponse, ActiveGrant } from "@/components/subscription-types";

export default function AdminSubscriptionPage() {
  const router = useRouter();
  const { getPlanInfo } = usePlanDisplayInfo();
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [holidayDismissed, setHolidayDismissed] = useState(false);
  const [activeTab, setActiveTab] = useState("overview");

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch("/api/admin/subscription");
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to load subscription data");
      }
      const json: ApiResponse = await res.json();
      setData(json);
    } catch (err: any) {
      console.error("Failed to fetch subscription data:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <DashboardLayout role="admin"><SubscriptionPageSkeleton /></DashboardLayout>;

  if (error) {
    return (
      <DashboardLayout role="admin">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <AlertCircle className="h-12 w-12 text-red-600 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 mb-2">
              Failed to load subscription
            </h2>
            <p className="text-gray-600 mb-4">{error}</p>
            <Button onClick={fetchData}>Try Again</Button>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  const {
    subscription,
    school,
    plans,
    transactions,
    status,
    current_term,
    yearly_covered_terms,
    upcoming_terms,
    terms_by_session,
    active_grants,
  } = data ?? {};

  const currentPlanKey = subscription?.plan_key || school?.plan || "basic";
  const currentPlanInfo = getPlanInfo(currentPlanKey);
  const PlanIcon = getPlanIcon(currentPlanKey);
  const isGrantBased = !!(active_grants && active_grants.length > 0);
  const currentGrant: ActiveGrant | null = isGrantBased ? active_grants![0] : null;

  // Determine the effective status for display
  const effectiveStatus = status?.status || subscription?.status || "active";
  const isGraceActive = !!(effectiveStatus === "past_due" && !status?.should_degrade);
  const isGraceExpired = !!(effectiveStatus === "past_due" && status?.should_degrade);

  // Detect holiday break (termly + active + current term ended + next term exists)
  const now = new Date();
  const isHolidayBreak = !!(
    subscription?.billing_interval === "termly" &&
    effectiveStatus === "active" &&
    current_term?.end_date &&
    new Date(current_term.end_date) < now &&
    current_term?.next_term != null
  );

  // Check if any upgrades are available
  const availablePlans = plans?.filter(
    (p) => p.plan_key !== "basic" && p.plan_key !== currentPlanKey
  ) ?? [];

  // ── Tab configurations ──
  const tabs = [
    { id: "overview", label: "Overview", icon: Info },
    { id: "plans", label: "Plans & Payments", icon: CreditCardIcon },
    { id: "billing", label: "Billing", icon: Receipt },
  ];

  return (
    <DashboardLayout role="admin">
      <div className="space-y-6">
        {/* ── Header ── */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Building2 className="h-6 w-6 text-slate-600" />
              Subscription
            </h1>
            <p className="text-sm text-gray-500 mt-0.5">
              Manage your school plan, view terms, and billing history
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setActiveTab("plans")}
            >
              <CreditCard className="h-4 w-4 mr-1.5" />
              Plans & Payments
            </Button>
            <Button
              size="sm"
              className="bg-blue-600 hover:bg-blue-700"
              onClick={() => router.push("/admin")}
            >
              <ExternalLink className="h-4 w-4 mr-1.5" />
              Dashboard
            </Button>
          </div>
        </div>

        {/* ── Grace Period Alerts ── */}
        {isGraceActive && subscription?.grace_period_ends_at && (
          <Card className="border-amber-200 bg-gradient-to-r from-amber-50 to-yellow-50 shadow-sm">
            <CardContent className="p-4 flex items-start gap-4">
              <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <p className="font-semibold text-amber-900 text-sm">Payment Past Due</p>
                <p className="text-sm text-amber-700 mt-1">
                  Your subscription payment is overdue. All features are still available during the
                  grace period, which ends{" "}
                  <span className="font-semibold">{formatDate(subscription.grace_period_ends_at)}</span>.
                </p>
                <Button
                  size="sm"
                  className="mt-3 bg-amber-600 hover:bg-amber-700"
                  onClick={() => setActiveTab("plans")}
                >
                  <CreditCard className="h-4 w-4 mr-1.5" />
                  Pay Now
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {isGraceExpired && (
          <Card className="border-red-200 bg-gradient-to-r from-red-50 to-rose-50 shadow-sm">
            <CardContent className="p-4 flex items-start gap-4">
              <AlertCircle className="h-5 w-5 text-red-600 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <p className="font-semibold text-red-900 text-sm">Grace Period Expired</p>
                <p className="text-sm text-red-700 mt-1">
                  {status?.degrade_reason || "Your grace period has ended. Paid features have been locked."}
                </p>
                <Button
                  size="sm"
                  className="mt-3 bg-red-600 hover:bg-red-700"
                  onClick={() => setActiveTab("plans")}
                >
                  <RefreshCw className="h-4 w-4 mr-1.5" />
                  Renew Now
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Holiday Break Banner */}
        {isHolidayBreak && !holidayDismissed && current_term?.next_term && (
          <Card className="border-teal-200 bg-gradient-to-r from-teal-50 to-emerald-50 shadow-sm">
            <CardContent className="p-4 flex items-start gap-4">
              <div className="flex-shrink-0 mt-0.5">
                <div className="h-10 w-10 rounded-lg bg-teal-100 flex items-center justify-center">
                  <Umbrella className="h-5 w-5 text-teal-600" />
                </div>
              </div>
              <div className="flex-1">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-semibold text-teal-900 text-sm">On Holiday Break</p>
                    <p className="text-sm text-teal-700 mt-1">
                      <span className="font-semibold">{current_term.name} · {current_term.session_name}</span>{" "}
                      has ended. Your school is currently on break — all features remain available.
                    </p>
                  </div>
                  <button
                    onClick={() => setHolidayDismissed(true)}
                    className="flex-shrink-0 p-1 rounded-md text-teal-400 hover:text-teal-600 hover:bg-teal-100 transition-colors"
                    aria-label="Dismiss banner"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-2">
                  <div className="flex items-center gap-2 text-sm">
                    <GraduationCap className="h-4 w-4 text-teal-500" />
                    <span className="text-teal-800">
                      <span className="font-semibold">{current_term.next_term.name}</span>
                      <span className="text-teal-500 ml-1">· {current_term.next_term.session_name}</span>
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Calendar className="h-4 w-4 text-teal-500" />
                    <span className="text-teal-800">
                      Starts {new Date(current_term.next_term.start_date).toLocaleDateString("en-NG", { weekday: "short", day: "numeric", month: "short", year: "numeric" })}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Clock className="h-4 w-4 text-teal-500" />
                    <span className="text-teal-800">{current_term.next_term.weeks} weeks</span>
                  </div>
                </div>

                <div className="mt-4 flex gap-3">
                  <Button
                    size="sm"
                    className="bg-teal-600 hover:bg-teal-700 text-white shadow-sm"
                    onClick={() =>
                      router.push(
                        `/checkout?plan=${currentPlanKey}&interval=termly&termId=${current_term.next_term!.id}`
                      )
                    }
                  >
                    <CreditCard className="h-4 w-4 mr-1.5" />
                    Pay for {current_term.next_term.name}
                    <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* ── Tabs ── */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="bg-white border border-gray-200 rounded-lg p-1 shadow-sm">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <TabsTrigger
                  key={tab.id}
                  value={tab.id}
                  className="flex items-center gap-1.5 text-sm data-[state=active]:bg-blue-50 data-[state=active]:text-blue-700 data-[state=active]:shadow-none rounded-md px-4 py-2"
                >
                  <Icon className="h-4 w-4" />
                  {tab.label}
                </TabsTrigger>
              );
            })}
          </TabsList>

          {/* Tab 1: Overview */}
          <TabsContent value="overview">
            <SubscriptionOverviewTab
              subscription={subscription}
              plans={plans}
              currentPlanKey={currentPlanKey}
              currentPlanInfo={currentPlanInfo}
              PlanIcon={PlanIcon}
              isGrantBased={isGrantBased}
              currentGrant={currentGrant}
              effectiveStatus={effectiveStatus}
              isGraceActive={isGraceActive}
              isGraceExpired={isGraceExpired}
              isHolidayBreak={isHolidayBreak}
              availablePlans={availablePlans}
              holidayDismissed={holidayDismissed}
              setHolidayDismissed={setHolidayDismissed}
              subscriptionStatus={status}
              currentTerm={current_term}
              yearlyCoveredTerms={yearly_covered_terms}
              activeGrants={active_grants}
              schoolName={school?.name || ""}
              onNavigateToPlans={() => setActiveTab("plans")}
            />
          </TabsContent>

          {/* Tab 2: Plans & Payments */}
          <TabsContent value="plans">
            <SubscriptionPlansTab
              subscription={subscription}
              plans={plans}
              currentPlanKey={currentPlanKey}
              isGrantBased={isGrantBased}
              activeGrants={active_grants}
              currentTerm={current_term}
              termsBySession={terms_by_session}
            />
          </TabsContent>

          {/* Tab 3: Billing */}
          <TabsContent value="billing">
            <SubscriptionBillingTab
              subscription={subscription}
              plans={plans}
              transactions={transactions}
              currentTerm={current_term}
              upcomingTerms={upcoming_terms}
              yearlyCoveredTerms={yearly_covered_terms}
              isGrantBased={isGrantBased}
              currentPlanKey={currentPlanKey}
            />
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
