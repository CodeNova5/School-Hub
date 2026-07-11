"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePlanDisplayInfo, PLAN_KEYS_IN_ORDER } from "@/hooks/use-plan-display-info";
import {
  Check,
  X,
  Zap,
  Shield,
  Star,
  Sparkles,
  GraduationCap,
  Calendar,
  ChevronRight,
  HelpCircle,
  ArrowRight,
  Building2,
  BarChart3,
  Users,
  BookOpen,
  Bell,
  CreditCard,
  Globe,
  Brain,
  Monitor,
  MessageSquare,
  Award,
  ChevronDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

// ── Helpers ────────────────────────────────────────────────────────────────

function formatPrice(cents: number): string {
  if (cents === 0) return "Free";
  return `₦${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

const planIcons: Record<string, any> = {
  basic: Shield,
  pro: Zap,
  premium: Sparkles,
};

// ── Feature definitions for display ──────────────────────────────────────

interface DisplayFeature {
  key: string;
  label: string;
  category: string;
  icon: any;
  pro: boolean;
  premium: boolean;
}

const ALL_DISPLAY_FEATURES: DisplayFeature[] = [
  // Core (all plans)
  { key: "core_subjects", label: "Curriculum & Subjects", category: "Core", icon: BookOpen, pro: false, premium: false },
  { key: "core_students", label: "Student Management", category: "Core", icon: Users, pro: false, premium: false },
  { key: "core_timetable", label: "Timetable Scheduling", category: "Core", icon: Calendar, pro: false, premium: false },
  { key: "core_attendance", label: "Attendance Tracking", category: "Core", icon: BarChart3, pro: false, premium: false },
  { key: "core_results", label: "Results & Report Cards", category: "Core", icon: Award, pro: false, premium: false },
  { key: "core_classes", label: "Class & Level Management", category: "Core", icon: Building2, pro: false, premium: false },

  // Pro
  { key: "finance", label: "Finance & Fee Management", category: "Pro", icon: CreditCard, pro: true, premium: true },
  { key: "payroll", label: "Staff Payroll", category: "Pro", icon: Users, pro: true, premium: true },
  { key: "notifications", label: "SMS & Email Notifications", category: "Pro", icon: Bell, pro: true, premium: true },
  { key: "subject_analytics", label: "Subject Performance Analytics", category: "Pro", icon: BarChart3, pro: true, premium: true },
  { key: "parents_guardians", label: "Parent/Guardian Portal", category: "Pro", icon: Users, pro: true, premium: true },
  { key: "student_id_cards", label: "Student ID Cards", category: "Pro", icon: Award, pro: true, premium: true },
  { key: "teacher_id_cards", label: "Teacher ID Cards", category: "Pro", icon: Award, pro: true, premium: true },
  { key: "assignments", label: "Assignment Management", category: "Pro", icon: BookOpen, pro: true, premium: true },
  { key: "calendar", label: "School Calendar & Events", category: "Pro", icon: Calendar, pro: true, premium: true },
  { key: "families", label: "Family Account Linking", category: "Pro", icon: Users, pro: true, premium: true },

  // Premium
  { key: "ai_assistant", label: "AI Teaching Assistant", category: "Premium", icon: Brain, pro: false, premium: true },
  { key: "website_builder", label: "School Website Builder", category: "Premium", icon: Globe, pro: false, premium: true },
  { key: "question_bank", label: "Question Bank & Exams", category: "Premium", icon: BookOpen, pro: false, premium: true },
  { key: "jamb_cbt", label: "JAMB CBT Simulator", category: "Premium", icon: Monitor, pro: false, premium: true },
  { key: "live_classes", label: "Live Virtual Classes", category: "Premium", icon: Monitor, pro: false, premium: true },
  { key: "lesson_notes", label: "Digital Lesson Notes", category: "Premium", icon: BookOpen, pro: false, premium: true },
  { key: "admissions", label: "Online Admissions", category: "Premium", icon: GraduationCap, pro: false, premium: true },
  { key: "alumni", label: "Alumni Management", category: "Premium", icon: Users, pro: false, premium: true },
  { key: "audit_trail", label: "Audit Trail & Logs", category: "Premium", icon: Shield, pro: false, premium: true },
  { key: "website_builder_custom", label: "Custom Website Domain", category: "Premium", icon: Globe, pro: false, premium: true },
  { key: "whatsapp", label: "WhatsApp Integration", category: "Premium", icon: MessageSquare, pro: false, premium: true },
];

// ── FAQ ──────────────────────────────────────────────────────────────────

const FAQS = [
  {
    q: "How does the Free plan work?",
    a: "The Free plan gives you full access to core school management features — subjects, students, classes, timetables, attendance, and report cards. There's no time limit and no credit card required.",
  },
  {
    q: "Can I upgrade from Free to Pro mid-term?",
    a: "Absolutely! You can upgrade at any time. The upgrade takes effect immediately, and you'll only be charged a prorated amount for the rest of the term.",
  },
  {
    q: "What payment methods do you accept?",
    a: "We accept all major Nigerian debit/credit cards, bank transfers, and USSD payments through our secure Paystack integration.",
  },
  {
    q: "Is there a discount for yearly billing?",
    a: "Yes! Yearly billing gives you effectively 2 months free compared to termly billing. It's our best value option.",
  },
  {
    q: "How does multi-tenant billing work?",
    a: "Each school in your network is billed separately based on its own plan. You can mix and match plans across schools — some on Free, some on Pro, others on Premium.",
  },
  {
    q: "Can I get a custom plan for my school group?",
    a: "Yes! Contact our sales team for custom pricing on school groups, districts, or multi-campus networks. We offer volume discounts.",
  },
];

// ── Loading Skeleton ──────────────────────────────────────────────────────

function PricingSkeleton() {
  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-6xl mx-auto px-4 py-20 sm:px-6 lg:px-8">
        <div className="space-y-6 text-center mb-14 animate-pulse">
          <div className="h-6 w-48 bg-gray-200 rounded-full mx-auto" />
          <div className="h-10 w-80 bg-gray-200 rounded-lg mx-auto" />
          <div className="h-4 w-96 bg-gray-200 rounded-lg mx-auto" />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {[1, 2, 3].map((i) => (
            <div key={i} className="animate-pulse space-y-6 p-8 rounded-2xl border border-gray-100 bg-white">
              <div className="h-6 w-24 bg-gray-200 rounded-lg" />
              <div className="h-4 w-40 bg-gray-200 rounded-lg" />
              <div className="h-10 w-32 bg-gray-200 rounded-lg" />
              <div className="space-y-3 pt-4">
                {Array.from({ length: 6 }).map((_, j) => (
                  <div key={j} className="h-5 w-full bg-gray-100 rounded" />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────

export default function SubscriptionPage() {
  const { getPlanInfo, isLoading: plansLoading } = usePlanDisplayInfo();

  const [billingInterval, setBillingInterval] = useState<"termly" | "yearly">("termly");
  const [mounted, setMounted] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => setMounted(true), 80);
    return () => clearTimeout(timer);
  }, []);

  if (plansLoading) return <PricingSkeleton />;

  return (
    <div className="min-h-screen bg-white">
      {/* ── Hero ── */}
      <section className="relative pt-24 sm:pt-28 pb-16 sm:pb-20 overflow-hidden">
        {/* Background */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 -right-40 w-[600px] h-[600px] rounded-full bg-gradient-to-br from-blue-50/80 to-indigo-50/80 blur-3xl" />
          <div className="absolute -bottom-20 -left-40 w-[500px] h-[500px] rounded-full bg-gradient-to-tr from-purple-50/80 to-pink-50/80 blur-3xl" />
          <div
            className="absolute inset-0 opacity-[0.015]"
            style={{
              backgroundImage: `radial-gradient(circle at 1px 1px, #000 1px, transparent 0)`,
              backgroundSize: "40px 40px",
            }}
          />
        </div>

        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl mx-auto text-center">
            {/* Badge */}
            <div
              className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-blue-50 border border-blue-100 mb-6 transition-all duration-500 ${
                mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
              }`}
            >
              <Sparkles className="h-3.5 w-3.5 text-blue-500" />
              <span className="text-xs font-medium text-blue-700">Simple, transparent pricing</span>
            </div>

            <h1
              className={`text-4xl sm:text-5xl font-bold tracking-tight text-gray-900 leading-[1.1] mb-4 transition-all duration-500 delay-75 ${
                mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
              }`}
            >
              Plans for schools of{" "}
              <span className="bg-gradient-to-r from-blue-600 to-indigo-500 bg-clip-text text-transparent">
                every size
              </span>
            </h1>

            <p
              className={`text-lg text-gray-500 max-w-xl mx-auto leading-relaxed mb-8 transition-all duration-500 delay-100 ${
                mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
              }`}
            >
              Start with core school management for free. Upgrade as your school grows and needs
              more advanced capabilities.
            </p>

            {/* Billing Toggle */}
            <div
              className={`inline-flex items-center p-1 rounded-xl bg-gray-100 border border-gray-200 transition-all duration-500 delay-150 ${
                mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
              }`}
            >
              <button
                onClick={() => setBillingInterval("termly")}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                  billingInterval === "termly"
                    ? "bg-white text-gray-900 shadow-sm"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                <GraduationCap className="h-4 w-4" />
                Per Term
                <span className="text-[10px] font-semibold text-emerald-600 bg-emerald-100 px-1.5 py-0.5 rounded">
                  School Calendar
                </span>
              </button>
              <button
                onClick={() => setBillingInterval("yearly")}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                  billingInterval === "yearly"
                    ? "bg-white text-gray-900 shadow-sm"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                <Calendar className="h-4 w-4" />
                Yearly
                <span className="text-[10px] font-semibold text-emerald-600 bg-emerald-100 px-1.5 py-0.5 rounded">
                  Best Value
                </span>
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ── Plan Cards ── */}
      <section className="pb-16 sm:pb-20 -mt-4">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">
            {PLAN_KEYS_IN_ORDER.map((key, index) => {
              const info = getPlanInfo(key);
              const PlanIcon = planIcons[key] || Shield;
              const isPro = key === "pro";
              const isPremium = key === "premium";
              const isBasic = key === "basic";

              const price = billingInterval === "termly"
                ? (info.termly_price || info.monthly_price * 3)
                : info.yearly_price;

              const allFeatures = ALL_DISPLAY_FEATURES;

              return (
                <div
                  key={key}
                  className={`relative flex flex-col rounded-2xl border bg-white transition-all duration-500 ${
                    mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
                  } ${isPro ? "border-blue-200 shadow-xl shadow-blue-100 scale-[1.02] lg:scale-105" : "border-gray-200 shadow-sm hover:shadow-lg"} ${isPro ? "" : "hover:scale-[1.01]"}`}
                  style={{ transitionDelay: `${200 + index * 120}ms` }}
                >
                  {/* Popular Badge */}
                  {isPro && (
                    <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 z-10">
                      <span className="inline-flex items-center gap-1 px-4 py-1 rounded-full text-xs font-semibold bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-200">
                        <Star className="h-3 w-3 fill-white" />
                        Most Popular
                      </span>
                    </div>
                  )}

                  {/* Card Content */}
                  <div className="p-6 sm:p-8 flex flex-col flex-1">
                    {/* Icon & Name */}
                    <div className="flex items-center gap-3 mb-4">
                      <div
                        className={`p-2.5 rounded-xl ${
                          isBasic
                            ? "bg-emerald-100"
                            : isPro
                            ? "bg-blue-100"
                            : "bg-purple-100"
                        }`}
                      >
                        <PlanIcon
                          className={`h-5 w-5 ${
                            isBasic
                              ? "text-emerald-600"
                              : isPro
                              ? "text-blue-600"
                              : "text-purple-600"
                          }`}
                        />
                      </div>
                      <div>
                        <h3 className="text-lg font-bold text-gray-900">{info.label_short}</h3>
                        <p className="text-xs text-gray-500">{isBasic ? "Free forever" : isPro ? "For growing schools" : "For school groups"}</p>
                      </div>
                    </div>

                    {/* Price */}
                    <div className="mb-6">
                      {price === 0 ? (
                        <div className="flex items-baseline gap-1">
                          <span className="text-4xl font-bold text-gray-900">Free</span>
                          <span className="text-sm text-gray-400 ml-1">/term</span>
                        </div>
                      ) : (
                        <div>
                          <div className="flex items-baseline gap-1">
                            <span className="text-3xl sm:text-4xl font-bold text-gray-900">
                              {formatPrice(price)}
                            </span>
                            <span className="text-sm text-gray-400">
                              /{billingInterval === "termly" ? "term" : "yr"}
                            </span>
                          </div>
                          {billingInterval === "yearly" && info.monthly_price > 0 && (
                            <p className="text-xs text-emerald-600 mt-1">
                              {formatPrice(info.monthly_price)}/mo billed annually —
                              <span className="font-semibold"> save {Math.round((1 - info.yearly_price / (info.termly_price * 3)) * 100)}%</span>
                            </p>
                          )}
                          {billingInterval === "termly" && info.yearly_price > 0 && (
                            <p className="text-xs text-gray-400 mt-1">
                              3 terms per year · No holiday charges
                            </p>
                          )}
                        </div>
                      )}
                    </div>

                    {/* CTA */}
                    <Link
                      href={isBasic ? "/register" : `/register?plan=${key}&interval=${billingInterval}`}
                      className="block mb-6"
                    >
                      <Button
                        className={`w-full h-11 rounded-xl text-sm font-semibold transition-all duration-200 ${
                          isPro
                            ? "bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-lg shadow-blue-200 hover:shadow-xl hover:shadow-blue-300"
                            : isPremium
                            ? "bg-gradient-to-r from-purple-600 to-violet-600 hover:from-purple-700 hover:to-violet-700 text-white shadow-lg shadow-purple-200 hover:shadow-xl hover:shadow-purple-300"
                            : "bg-gray-900 hover:bg-gray-800 text-white"
                        }`}
                      >
                        {isBasic ? "Get Started Free" : "Start Free Trial"}
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </Button>
                    </Link>

                    {/* Feature List */}
                    <div className="border-t border-gray-100 pt-6 flex-1">
                      <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-4">
                        {isBasic
                          ? "Core Features — All Free"
                          : isPro
                          ? "Everything in Free, plus:"
                          : "Everything in Pro, plus:"}
                      </p>

                      <ul className="space-y-3">
                        {allFeatures.map((feature) => {
                          const enabled = isBasic
                            ? !feature.pro && !feature.premium
                            : isPro
                            ? !feature.premium
                            : true;
                          return (
                            <li
                              key={feature.key}
                              className={`flex items-start gap-3 text-sm ${
                                enabled ? "text-gray-700" : "text-gray-400"
                              }`}
                            >
                              {enabled ? (
                                <span className="flex-shrink-0 mt-0.5">
                                  {isPro && !feature.pro && !feature.premium ? (
                                    <Check className="h-4 w-4 text-emerald-500" />
                                  ) : isPremium && !feature.premium ? (
                                    <Check className="h-4 w-4 text-emerald-500" />
                                  ) : (
                                    <Check className="h-4 w-4 text-blue-500" />
                                  )}
                                </span>
                              ) : (
                                <span className="flex-shrink-0 mt-0.5 text-gray-300">
                                  <X className="h-4 w-4" />
                                </span>
                              )}
                              <span className="flex items-center gap-2">
                                <feature.icon className="h-3.5 w-3.5 text-gray-400" />
                                <span>{feature.label}</span>
                              </span>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── Feature Comparison Table ── */}
      <section className="py-16 sm:py-20 bg-gradient-to-b from-gray-50 to-white border-y border-gray-100">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-3">
              Compare Plans in Detail
            </h2>
            <p className="text-gray-500">
              Every feature, every tier — see exactly what you get with each plan.
            </p>
          </div>

          <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
            {/* Table Header */}
            <div className="grid grid-cols-4 gap-px bg-gray-100">
              <div className="bg-white p-4 flex items-center">
                <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">Feature</span>
              </div>
              {PLAN_KEYS_IN_ORDER.map((key) => (
                <div key={key} className="bg-white p-4 text-center">
                  <span
                    className={`text-sm font-bold ${
                      key === "basic" ? "text-gray-900" : key === "pro" ? "text-blue-600" : "text-purple-600"
                    }`}
                  >
                    {getPlanInfo(key).label_short}
                  </span>
                </div>
              ))}
            </div>

            {/* Table Rows */}
            {(() => {
              const categories = ["Core", "Pro", "Premium"] as const;
              const rows: { category: string; features: DisplayFeature[] }[] = categories.map((cat) => ({
                category: cat,
                features: ALL_DISPLAY_FEATURES.filter((f) => f.category === cat),
              }));

              return rows.map((section) => (
                <div key={section.category}>
                  {/* Category Header */}
                  <div className="grid grid-cols-4 gap-px bg-gray-100">
                    <div className="bg-gray-50 p-3">
                      <span className="text-xs font-semibold uppercase tracking-wider text-gray-600">
                        {section.category}
                      </span>
                    </div>
                    {PLAN_KEYS_IN_ORDER.map((key) => (
                      <div key={key} className="bg-gray-50 p-3 text-center">
                        <span className="text-[10px] font-medium text-gray-400">
                          {key === "basic" ? "Free" : key === "pro" ? "Pro" : "Premium"}
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Feature Rows */}
                  {section.features.map((feature) => (
                    <div key={feature.key} className="grid grid-cols-4 gap-px bg-gray-100">
                      <div className="bg-white p-3.5 flex items-center gap-2">
                        <feature.icon className="h-3.5 w-3.5 text-gray-400" />
                        <span className="text-sm text-gray-700">{feature.label}</span>
                      </div>
                      {(["basic", "pro", "premium"] as const).map((planKey) => {
                        const enabled = planKey === "basic"
                          ? !feature.pro && !feature.premium
                          : planKey === "pro"
                          ? !feature.premium
                          : true;
                        return (
                          <div key={planKey} className="bg-white p-3.5 text-center">
                            {enabled ? (
                              <Check className="h-4 w-4 text-emerald-500 mx-auto" />
                            ) : (
                              <X className="h-4 w-4 text-gray-300 mx-auto" />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>
              ));
            })()}
          </div>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section className="py-16 sm:py-20">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <Badge variant="outline" className="mb-4 px-4 py-1.5 border-gray-200 text-gray-600 bg-gray-50 text-xs font-medium">
              <HelpCircle className="h-3.5 w-3.5 mr-1.5" />
              Got questions?
            </Badge>
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-3">
              Frequently Asked Questions
            </h2>
            <p className="text-gray-500">
              Everything you need to know about our plans and billing.
            </p>
          </div>

          <div className="space-y-3">
            {FAQS.map((faq, i) => (
              <div
                key={i}
                className="rounded-xl border border-gray-200 bg-white overflow-hidden transition-all duration-200"
              >
                <button
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="flex items-center justify-between w-full p-4 sm:p-5 text-left"
                >
                  <span className="text-sm font-semibold text-gray-900 pr-4">{faq.q}</span>
                  <ChevronDown
                    className={`h-4 w-4 text-gray-400 flex-shrink-0 transition-transform duration-200 ${
                      openFaq === i ? "rotate-180" : ""
                    }`}
                  />
                </button>
                <div
                  className={`overflow-hidden transition-all duration-300 ease-in-out ${
                    openFaq === i ? "max-h-96 opacity-100" : "max-h-0 opacity-0"
                  }`}
                >
                  <p className="px-4 sm:px-5 pb-4 sm:pb-5 text-sm text-gray-500 leading-relaxed">
                    {faq.a}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="py-16 sm:py-20 bg-gradient-to-br from-gray-900 via-gray-900 to-gray-800 relative overflow-hidden">
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage: `radial-gradient(circle at 1px 1px, #fff 1px, transparent 0)`,
            backgroundSize: "32px 32px",
          }}
        />
        <div className="absolute -top-40 -right-40 w-[500px] h-[500px] rounded-full bg-gradient-to-br from-blue-500/10 to-purple-500/10 blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-[500px] h-[500px] rounded-full bg-gradient-to-tr from-emerald-500/10 to-cyan-500/10 blur-3xl" />

        <div className="relative max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/10 border border-white/10 mb-6">
            <Sparkles className="h-3.5 w-3.5 text-blue-300" />
            <span className="text-xs font-medium text-blue-200">No hidden fees, no surprises</span>
          </div>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white mb-4">
            Start with Free. Upgrade when ready.
          </h2>
          <p className="text-gray-400 text-lg leading-relaxed mb-8 max-w-xl mx-auto">
            No credit card required. Full access to core features forever. Upgrade anytime your
            school needs more.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link href="/register">
              <Button className="h-12 px-8 rounded-xl text-sm font-semibold bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-500/20 hover:shadow-xl hover:shadow-blue-500/30 transition-all duration-300">
                Get Started Free
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
            <Link href="#features">
              <Button
                variant="outline"
                className="h-12 px-8 rounded-xl text-sm font-semibold border-white/10 text-gray-300 hover:bg-white/5 hover:text-white"
              >
                Talk to Sales
                <ChevronRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="bg-white border-t border-gray-100">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2.5">
              <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-gradient-to-br from-blue-600 to-blue-400">
                <GraduationCap className="h-3.5 w-3.5 text-white" />
              </div>
              <span className="text-sm font-bold text-gray-900">School Hub</span>
            </div>
            <div className="flex items-center gap-6">
              <Link href="/privacy" className="text-xs text-gray-500 hover:text-gray-700 transition-colors">Privacy Policy</Link>
              <Link href="#" className="text-xs text-gray-500 hover:text-gray-700 transition-colors">Terms of Service</Link>
              <Link href="#" className="text-xs text-gray-500 hover:text-gray-700 transition-colors">Contact Support</Link>
            </div>
            <p className="text-xs text-gray-400">
              &copy; {new Date().getFullYear()} School Hub. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
