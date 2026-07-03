"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { usePlanDisplayInfo, PLAN_KEYS_IN_ORDER } from "@/hooks/use-plan-display-info";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import {
  GraduationCap,
  Shield,
  Zap,
  Sparkles,
  Building2,
  Mail,
  Phone,
  MapPin,
  User,
  Lock,
  Eye,
  EyeOff,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  Loader2,
  ChevronRight,
} from "lucide-react";

function formatPrice(cents: number): string {
  if (cents === 0) return "Free";
  return `₦${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

const STEPS = [
  { label: "Choose Plan", short: "Plan" },
  { label: "School Details", short: "School" },
  { label: "Admin Account", short: "Account" },
  { label: "Confirmation", short: "Done" },
];

export default function RegisterPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { getPlanInfo, isLoading: plansLoading } = usePlanDisplayInfo();

  // Step
  const [step, setStep] = useState(1);
  const [mounted, setMounted] = useState(false);
  const [saving, setSaving] = useState(false);

  // Step 1: Plan selection
  const preselectedPlan = searchParams.get("plan") || "basic";
  const preselectedInterval = (searchParams.get("interval") || "termly") as "termly" | "yearly";
  const [selectedPlan, setSelectedPlan] = useState(preselectedPlan);
  const [billingInterval, setBillingInterval] = useState<"termly" | "yearly">(preselectedInterval);

  // Step 2: School details
  const [schoolForm, setSchoolForm] = useState({
    name: "",
    email: "",
    phone: "",
    address: "",
  });

  // Step 3: Admin account
  const [adminForm, setAdminForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    confirmPassword: "",
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Errors
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [generalError, setGeneralError] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => setMounted(true), 80);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (preselectedPlan) setSelectedPlan(preselectedPlan);
    if (preselectedInterval) setBillingInterval(preselectedInterval);
  }, [preselectedPlan, preselectedInterval]);

  // ── Validation ──

  function validateStep1(): boolean {
    return !!selectedPlan;
  }

  function validateStep2(): boolean {
    const errs: Record<string, string> = {};
    if (!schoolForm.name.trim()) errs.schoolName = "School name is required";
    if (!schoolForm.email.trim()) errs.schoolEmail = "Email is required";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(schoolForm.email)) errs.schoolEmail = "Invalid email format";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  function validateStep3(): boolean {
    const errs: Record<string, string> = {};
    if (!adminForm.firstName.trim()) errs.firstName = "First name is required";
    if (!adminForm.lastName.trim()) errs.lastName = "Last name is required";
    if (!adminForm.email.trim()) errs.adminEmail = "Email is required";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(adminForm.email)) errs.adminEmail = "Invalid email format";
    if (!adminForm.password) errs.password = "Password is required";
    else if (adminForm.password.length < 8) errs.password = "Password must be at least 8 characters";
    if (adminForm.password !== adminForm.confirmPassword) errs.confirmPassword = "Passwords do not match";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  // ── Submit ──

  async function handleSubmit() {
    if (!validateStep3()) {
      setStep(3);
      return;
    }
    setSaving(true);
    setGeneralError("");

    try {
      const res = await fetch("/api/register-school", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          plan: selectedPlan,
          billingInterval,
          school: {
            name: schoolForm.name,
            email: schoolForm.email,
            phone: schoolForm.phone,
            address: schoolForm.address,
          },
          admin: {
            firstName: adminForm.firstName,
            lastName: adminForm.lastName,
            email: adminForm.email,
            password: adminForm.password,
          },
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Registration failed. Please try again.");
      }

      // Success — sign in automatically and redirect
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: adminForm.email,
        password: adminForm.password,
      });

      if (signInError) {
        // Account created but auto-login failed — redirect to login
        toast.success("Account created! Please sign in.");
        router.push("/admin/login");
        return;
      }

      setStep(4);
      toast.success("School registered successfully!");

      // Redirect to dashboard after a brief moment
      setTimeout(() => {
        router.push("/admin");
      }, 3000);
    } catch (err: any) {
      setGeneralError(err.message || "Registration failed");
      setSaving(false);
    }
  }

  const planInfo = getPlanInfo(selectedPlan);
  const animClass = mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6";

  return (
    <div className="min-h-screen bg-white">
      {/* ── Header ── */}
      <header className="border-b border-gray-100 bg-white/80 backdrop-blur-sm sticky top-0 z-40">
        <div className="max-w-3xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-gradient-to-br from-blue-600 to-blue-400">
              <GraduationCap className="h-3.5 w-3.5 text-white" />
            </div>
            <span className="text-sm font-bold text-gray-900">School Hub</span>
          </Link>
          {step < 4 && (
            <Link href="/subscription">
              <span className="text-xs text-gray-500 hover:text-gray-700 transition-colors cursor-pointer">
                Back to pricing
              </span>
            </Link>
          )}
        </div>
      </header>

      {/* ── Main ── */}
      <div className="max-w-xl mx-auto px-4 py-8 sm:py-12">
        {/* Progress */}
        {step < 4 && (
          <div className="mb-8 space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium text-gray-900">
                Step {step} of {STEPS.length}: {STEPS[step - 1].label}
              </span>
              <span className="text-xs text-gray-400">{Math.round(((step - 1) / (STEPS.length - 1)) * 100)}%</span>
            </div>
            <Progress value={((step - 1) / (STEPS.length - 1)) * 100} className="h-2" />
            <div className="flex gap-1">
              {STEPS.map((s, i) => (
                <div
                  key={i}
                  className={`flex-1 text-center text-xs py-0.5 rounded transition-colors ${
                    i + 1 < step
                      ? "bg-blue-600 text-white"
                      : i + 1 === step
                      ? "bg-blue-100 text-blue-700 font-medium"
                      : "bg-gray-100 text-gray-400"
                  }`}
                >
                  {s.short}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Step 1: Choose Plan ── */}
        {step === 1 && (
          <div className={`transition-all duration-500 ${animClass}`}>
            <div className="text-center mb-8">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-blue-100 mb-4">
                <Sparkles className="h-6 w-6 text-blue-600" />
              </div>
              <h1 className="text-2xl font-bold text-gray-900">Choose your plan</h1>
              <p className="text-sm text-gray-500 mt-1">Start free, upgrade anytime.</p>
            </div>

            {/* Billing toggle */}
            <div className="inline-flex items-center p-1 rounded-xl bg-gray-100 border border-gray-200 mb-6 mx-auto block w-fit">
              <button
                onClick={() => setBillingInterval("termly")}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  billingInterval === "termly"
                    ? "bg-white text-gray-900 shadow-sm"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                Per Term
              </button>
              <button
                onClick={() => setBillingInterval("yearly")}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  billingInterval === "yearly"
                    ? "bg-white text-gray-900 shadow-sm"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                Yearly
                <span className="text-[10px] font-semibold text-emerald-600 bg-emerald-100 px-1.5 py-0.5 rounded">Save</span>
              </button>
            </div>

            {/* Plan cards */}
            <div className="space-y-3">
              {PLAN_KEYS_IN_ORDER.map((key) => {
                const info = getPlanInfo(key);
                const isSelected = selectedPlan === key;
                const isPro = key === "pro";
                const isPremium = key === "premium";
                const isBasic = key === "basic";
                const price = billingInterval === "termly"
                  ? (info.termly_price || info.monthly_price * 3)
                  : info.yearly_price;

                return (
                  <button
                    key={key}
                    onClick={() => setSelectedPlan(key)}
                    className={`w-full text-left flex items-center gap-4 p-4 rounded-xl border-2 transition-all ${
                      isSelected
                        ? isPro
                          ? "border-blue-500 bg-blue-50 shadow-md"
                          : isPremium
                          ? "border-purple-500 bg-purple-50 shadow-md"
                          : "border-gray-900 bg-gray-50 shadow-md"
                        : "border-gray-200 hover:border-gray-300 bg-white"
                    }`}
                  >
                    <div
                      className={`p-2.5 rounded-xl ${
                        isBasic ? "bg-emerald-100" : isPro ? "bg-blue-100" : "bg-purple-100"
                      }`}
                    >
                      {key === "basic" ? (
                        <Shield className="h-5 w-5 text-emerald-600" />
                      ) : isPro ? (
                        <Zap className="h-5 w-5 text-blue-600" />
                      ) : (
                        <Sparkles className="h-5 w-5 text-purple-600" />
                      )}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-gray-900">{info.label_short}</span>
                        {isPro && (
                          <span className="text-[10px] font-semibold text-blue-600 bg-blue-100 px-1.5 py-0.5 rounded-full">Most Popular</span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500">{info.description}</p>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-gray-900">
                        {price === 0 ? "Free" : formatPrice(price)}
                      </div>
                      <div className="text-[10px] text-gray-400">
                        /{billingInterval === "termly" ? "term" : "yr"}
                      </div>
                    </div>
                    {isSelected && (
                      <CheckCircle2 className={`h-5 w-5 ${isPro ? "text-blue-500" : isPremium ? "text-purple-500" : "text-gray-900"}`} />
                    )}
                  </button>
                );
              })}
            </div>

            <div className="mt-8">
              <Button
                onClick={() => setStep(2)}
                disabled={!validateStep1()}
                className="w-full h-11 rounded-xl bg-gray-900 hover:bg-gray-800 text-white"
              >
                Continue
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {/* ── Step 2: School Details ── */}
        {step === 2 && (
          <div className={`transition-all duration-500 ${animClass}`}>
            <div className="text-center mb-8">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-blue-100 mb-4">
                <Building2 className="h-6 w-6 text-blue-600" />
              </div>
              <h1 className="text-2xl font-bold text-gray-900">Tell us about your school</h1>
              <p className="text-sm text-gray-500 mt-1">
                Your school will be set up on the{" "}
                <span className="font-semibold">{planInfo.label_short}</span> plan.
              </p>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="schoolName" className="text-sm font-medium text-gray-700">
                  School Name *
                </Label>
                <Input
                  id="schoolName"
                  value={schoolForm.name}
                  onChange={(e) => setSchoolForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="Greenfield Academy"
                  className="h-10"
                />
                {errors.schoolName && <p className="text-xs text-red-500">{errors.schoolName}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="schoolEmail" className="text-sm font-medium text-gray-700">
                  School Email *
                </Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                  <Input
                    id="schoolEmail"
                    type="email"
                    value={schoolForm.email}
                    onChange={(e) => setSchoolForm((f) => ({ ...f, email: e.target.value }))}
                    placeholder="admin@greenfield.edu"
                    className="h-10 pl-9"
                  />
                </div>
                {errors.schoolEmail && <p className="text-xs text-red-500">{errors.schoolEmail}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="schoolPhone" className="text-sm font-medium text-gray-700">
                  Phone Number
                </Label>
                <div className="relative">
                  <Phone className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                  <Input
                    id="schoolPhone"
                    type="tel"
                    value={schoolForm.phone}
                    onChange={(e) => setSchoolForm((f) => ({ ...f, phone: e.target.value }))}
                    placeholder="+234 800 000 0000"
                    className="h-10 pl-9"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="schoolAddress" className="text-sm font-medium text-gray-700">
                  Address
                </Label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                  <Input
                    id="schoolAddress"
                    value={schoolForm.address}
                    onChange={(e) => setSchoolForm((f) => ({ ...f, address: e.target.value }))}
                    placeholder="123 School Road, Lagos"
                    className="h-10 pl-9"
                  />
                </div>
              </div>
            </div>

            <div className="mt-8 flex gap-3">
              <Button
                variant="outline"
                onClick={() => setStep(1)}
                className="h-11 rounded-xl"
              >
                <ArrowLeft className="h-4 w-4 mr-1" />
                Back
              </Button>
              <Button
                onClick={() => {
                  if (validateStep2()) setStep(3);
                }}
                className="flex-1 h-11 rounded-xl bg-gray-900 hover:bg-gray-800 text-white"
              >
                Continue
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {/* ── Step 3: Admin Account ── */}
        {step === 3 && (
          <div className={`transition-all duration-500 ${animClass}`}>
            <div className="text-center mb-8">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-blue-100 mb-4">
                <User className="h-6 w-6 text-blue-600" />
              </div>
              <h1 className="text-2xl font-bold text-gray-900">Create your admin account</h1>
              <p className="text-sm text-gray-500 mt-1">
                This will be the primary administrator for{" "}
                <span className="font-semibold">{schoolForm.name || "your school"}</span>.
              </p>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="firstName" className="text-sm font-medium text-gray-700">
                    First Name *
                  </Label>
                  <Input
                    id="firstName"
                    value={adminForm.firstName}
                    onChange={(e) => setAdminForm((f) => ({ ...f, firstName: e.target.value }))}
                    placeholder="John"
                    className="h-10"
                  />
                  {errors.firstName && <p className="text-xs text-red-500">{errors.firstName}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lastName" className="text-sm font-medium text-gray-700">
                    Last Name *
                  </Label>
                  <Input
                    id="lastName"
                    value={adminForm.lastName}
                    onChange={(e) => setAdminForm((f) => ({ ...f, lastName: e.target.value }))}
                    placeholder="Doe"
                    className="h-10"
                  />
                  {errors.lastName && <p className="text-xs text-red-500">{errors.lastName}</p>}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="adminEmail" className="text-sm font-medium text-gray-700">
                  Email Address *
                </Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                  <Input
                    id="adminEmail"
                    type="email"
                    value={adminForm.email}
                    onChange={(e) => setAdminForm((f) => ({ ...f, email: e.target.value }))}
                    placeholder="john@greenfield.edu"
                    className="h-10 pl-9"
                  />
                </div>
                {errors.adminEmail && <p className="text-xs text-red-500">{errors.adminEmail}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-sm font-medium text-gray-700">
                  Password *
                </Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={adminForm.password}
                    onChange={(e) => setAdminForm((f) => ({ ...f, password: e.target.value }))}
                    placeholder="••••••••"
                    className="h-10 pl-9 pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {errors.password && <p className="text-xs text-red-500">{errors.password}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword" className="text-sm font-medium text-gray-700">
                  Confirm Password *
                </Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                  <Input
                    id="confirmPassword"
                    type={showConfirmPassword ? "text" : "password"}
                    value={adminForm.confirmPassword}
                    onChange={(e) => setAdminForm((f) => ({ ...f, confirmPassword: e.target.value }))}
                    placeholder="••••••••"
                    className="h-10 pl-9 pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600"
                  >
                    {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {errors.confirmPassword && <p className="text-xs text-red-500">{errors.confirmPassword}</p>}
              </div>

              {generalError && (
                <div className="p-3 rounded-lg bg-red-50 border border-red-200">
                  <p className="text-sm text-red-600">{generalError}</p>
                </div>
              )}

              {/* Summary */}
              <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2">Summary</p>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500">Plan</span>
                  <span className="font-medium text-gray-900">{planInfo.label_short}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500">Billing</span>
                  <span className="font-medium text-gray-900 capitalize">{billingInterval === "termly" ? "Per Term" : "Yearly"}</span>
                </div>
                {schoolForm.name && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-500">School</span>
                    <span className="font-medium text-gray-900">{schoolForm.name}</span>
                  </div>
                )}
                {planInfo.termly_price > 0 && (
                  <div className="border-t border-gray-200 pt-2 flex items-center justify-between text-sm">
                    <span className="font-medium text-gray-700">Total</span>
                    <span className="font-bold text-gray-900">
                      {formatPrice(billingInterval === "termly" ? planInfo.termly_price : planInfo.yearly_price)}
                      <span className="text-xs text-gray-400 font-normal">/{billingInterval === "termly" ? "term" : "yr"}</span>
                    </span>
                  </div>
                )}
              </div>
            </div>

            <div className="mt-8 flex gap-3">
              <Button
                variant="outline"
                onClick={() => setStep(2)}
                disabled={saving}
                className="h-11 rounded-xl"
              >
                <ArrowLeft className="h-4 w-4 mr-1" />
                Back
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={saving}
                className="flex-1 h-11 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-lg shadow-blue-200"
              >
                {saving ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Creating your school...
                  </>
                ) : (
                  <>
                    Create School Account
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </>
                )}
              </Button>
            </div>
          </div>
        )}

        {/* ── Step 4: Done ── */}
        {step === 4 && (
          <div className="text-center py-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-emerald-100 mb-6">
              <CheckCircle2 className="h-8 w-8 text-emerald-600" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">School Registered! 🎉</h1>
            <p className="text-gray-500 mb-6 max-w-md mx-auto">
              Your school <span className="font-semibold text-gray-900">{schoolForm.name}</span> has been
              created on the <span className="font-semibold">{planInfo.label_short}</span> plan.
              You're being redirected to your dashboard...
            </p>

            <div className="inline-flex items-center gap-2 text-sm text-gray-400">
              <Loader2 className="h-4 w-4 animate-spin" />
              Redirecting to dashboard
            </div>

            <div className="mt-6">
              <Link href="/admin">
                <Button className="rounded-xl bg-gray-900 hover:bg-gray-800 text-white">
                  Go to Dashboard
                  <ChevronRight className="ml-1 h-4 w-4" />
                </Button>
              </Link>
            </div>
          </div>
        )}

        {/* Trust indicators */}
        {step < 4 && (
          <div className="mt-8 flex flex-wrap items-center justify-center gap-4 text-xs text-gray-400">
            <span>🔒 Secured with 256-bit encryption</span>
            <span>💳 Powered by Paystack</span>
            <span>🇳🇬 Nigerian schools</span>
          </div>
        )}
      </div>
    </div>
  );
}
