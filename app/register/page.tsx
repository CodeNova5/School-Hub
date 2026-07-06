"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import {
  Building2,
  Mail,
  Phone,
  MapPin,
  User,
  Lock,
  Eye,
  EyeOff,
  GraduationCap,
  Loader2,
  Check,
  X,
  Sparkles,
  ArrowRight,
  ChevronRight,
  Shield,
  Zap,
  Star,
  AlertCircle,
} from "lucide-react";
import { PortalSwitcher } from "@/components/portal-switcher";

// ── Plan display helpers ──────────────────────────────────────────────────

const PLAN_META: Record<string, { label: string; icon: any; gradient: string; badge: string; description: string }> = {
  basic: {
    label: "Basic",
    icon: Shield,
    gradient: "from-gray-600 to-gray-500",
    badge: "Free Forever",
    description: "Core school management features — free forever.",
  },
  pro: {
    label: "Pro",
    icon: Zap,
    gradient: "from-blue-600 to-indigo-600",
    badge: "Most Popular",
    description: "Advanced features for growing schools.",
  },
  premium: {
    label: "Premium",
    icon: Star,
    gradient: "from-purple-600 to-violet-600",
    badge: "Best Value",
    description: "Everything for school groups and chains.",
  },
};

// ── Password strength ─────────────────────────────────────────────────────

function getPasswordStrength(password: string): { score: number; label: string; color: string } {
  let score = 0;
  if (password.length >= 8) score += 1;
  if (password.length >= 12) score += 1;
  if (/[A-Z]/.test(password)) score += 1;
  if (/[a-z]/.test(password)) score += 1;
  if (/[0-9]/.test(password)) score += 1;
  if (/[^A-Za-z0-9]/.test(password)) score += 1;

  if (score <= 2) return { score, label: "Weak", color: "bg-red-500" };
  if (score <= 4) return { score, label: "Medium", color: "bg-amber-500" };
  return { score, label: "Strong", color: "bg-emerald-500" };
}

const PASSWORD_REQUIREMENTS = [
  { label: "At least 8 characters", test: (p: string) => p.length >= 8 },
  { label: "At least 12 characters (recommended)", test: (p: string) => p.length >= 12 },
  { label: "Uppercase letter", test: (p: string) => /[A-Z]/.test(p) },
  { label: "Lowercase letter", test: (p: string) => /[a-z]/.test(p) },
  { label: "Number", test: (p: string) => /[0-9]/.test(p) },
  { label: "Special character", test: (p: string) => /[^A-Za-z0-9]/.test(p) },
];

// ── Main Component ────────────────────────────────────────────────────────

function RegisterForm() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const plan = searchParams.get("plan") || "basic";
  const billingInterval = searchParams.get("interval") || "termly";
  const planMeta = PLAN_META[plan] || PLAN_META.basic;

  // Form state
  const [step, setStep] = useState<"school" | "admin" | "review">("school");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);

  // School fields
  const [schoolName, setSchoolName] = useState("");
  const [schoolEmail, setSchoolEmail] = useState("");
  const [schoolPhone, setSchoolPhone] = useState("");
  const [schoolAddress, setSchoolAddress] = useState("");

  // Admin fields
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPassword, setAdminPassword] = useState("");

  const strength = getPasswordStrength(adminPassword);

  // Validation
  const isSchoolValid = schoolName.trim().length >= 2 && schoolEmail.includes("@");
  const isAdminValid = firstName.trim().length >= 1 && lastName.trim().length >= 1 && adminEmail.includes("@") && adminPassword.length >= 8;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!isSchoolValid || !isAdminValid || !acceptedTerms) return;

    setLoading(true);

    try {
      const response = await fetch("/api/register-school", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          plan,
          billingInterval,
          school: {
            name: schoolName.trim(),
            email: schoolEmail.trim(),
            phone: schoolPhone.trim() || undefined,
            address: schoolAddress.trim() || undefined,
          },
          admin: {
            firstName: firstName.trim(),
            lastName: lastName.trim(),
            email: adminEmail.trim(),
            password: adminPassword,
          },
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        toast.error(data.error || "Registration failed. Please try again.");
        setLoading(false);
        return;
      }

      toast.success("School registered successfully! Welcome aboard.");
      router.push("/admin/login?registered=true");
    } catch (error: any) {
      toast.error(error?.message || "Network error. Please try again.");
      setLoading(false);
    }
  }

  return (
    <div className="relative min-h-screen overflow-hidden">
      {/* Animated gradient background */}
      <div className="absolute inset-0 bg-gradient-to-br from-blue-600 via-indigo-600 to-violet-600 opacity-90" />
      <div className="absolute -top-40 -right-40 w-80 h-80 bg-blue-400 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob" />
      <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-indigo-400 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-2000" />

      {/* Subtle dot pattern overlay */}
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: `radial-gradient(circle at 1px 1px, #fff 1px, transparent 0)`,
          backgroundSize: "32px 32px",
        }}
      />

      {/* Content */}
      <div className="relative flex items-center justify-center min-h-screen p-4 py-12">
        <Card className="w-full max-w-lg shadow-2xl border-0 bg-white/95 backdrop-blur-sm">
          {/* Header with brand icon */}
          <CardHeader className="text-center pb-4 border-b border-gray-100">
            <div className="flex justify-center mb-3">
              <div className="p-2.5 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl shadow-lg shadow-blue-200/50">
                <GraduationCap className="w-7 h-7 text-white" />
              </div>
            </div>
            <CardTitle className="text-2xl font-bold text-gray-900">
              Register Your School
            </CardTitle>
            <p className="text-gray-500 text-sm mt-1.5">
              Set up your school management system in minutes
            </p>

            {/* Plan badge */}
            {plan !== "basic" && (
              <div className="inline-flex items-center gap-1.5 mt-4 px-3 py-1.5 rounded-full bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-100">
                <planMeta.icon className="w-3.5 h-3.5 text-blue-600" />
                <span className="text-xs font-semibold text-blue-700">
                  {planMeta.label} Plan — {billingInterval === "yearly" ? "Yearly" : "Termly"}
                </span>
                <span className="text-[10px] font-bold text-emerald-600 bg-emerald-100 px-1.5 py-0.5 rounded-full">
                  {planMeta.badge}
                </span>
              </div>
            )}
          </CardHeader>

          <CardContent className="pt-5 pb-4">
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* ── Step Indicators ── */}
              <div className="flex items-center gap-2">
                {["school", "admin"].map((s, i) => (
                  <div key={s} className="flex items-center gap-2 flex-1">
                    <button
                      type="button"
                      onClick={() => setStep(s as any)}
                      className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 ${
                        step === s
                          ? "bg-blue-100 text-blue-700 shadow-sm"
                          : "bg-gray-50 text-gray-400 hover:text-gray-600"
                      }`}
                    >
                      <span
                        className={`flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-bold ${
                          step === s
                            ? "bg-blue-600 text-white"
                            : "bg-gray-200 text-gray-500"
                        }`}
                      >
                        {i + 1}
                      </span>
                      {s === "school" ? "School" : "Admin"}
                    </button>
                    {i === 0 && (
                      <ChevronRight className="w-3.5 h-3.5 text-gray-300 flex-shrink-0" />
                    )}
                  </div>
                ))}
              </div>

              {/* ── School Information Section ── */}
              {step === "school" && (
                <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                  <div>
                    <h3 className="text-sm font-bold text-gray-800 flex items-center gap-2 mb-1">
                      <Building2 className="w-4 h-4 text-blue-500" />
                      School Information
                    </h3>
                    <p className="text-xs text-gray-500 mb-4">
                      Tell us about your school
                    </p>
                  </div>

                  {/* School Name */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-gray-700">
                      School Name <span className="text-red-400">*</span>
                    </label>
                    <Input
                      value={schoolName}
                      onChange={(e) => setSchoolName(e.target.value)}
                      placeholder="e.g. Springfield International School"
                      required
                      className="px-4 py-2.5 border-gray-300 focus:border-blue-500 focus:ring-blue-500 text-sm"
                    />
                  </div>

                  {/* School Email & Phone */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-gray-700 flex items-center gap-1.5">
                        <Mail className="w-3.5 h-3.5 text-gray-400" />
                        School Email <span className="text-red-400">*</span>
                      </label>
                      <Input
                        type="email"
                        value={schoolEmail}
                        onChange={(e) => setSchoolEmail(e.target.value)}
                        placeholder="school@example.com"
                        required
                        className="px-4 py-2.5 border-gray-300 focus:border-blue-500 focus:ring-blue-500 text-sm"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-gray-700 flex items-center gap-1.5">
                        <Phone className="w-3.5 h-3.5 text-gray-400" />
                        Phone Number
                      </label>
                      <Input
                        type="tel"
                        value={schoolPhone}
                        onChange={(e) => setSchoolPhone(e.target.value)}
                        placeholder="e.g. +234 800 000 0000"
                        className="px-4 py-2.5 border-gray-300 focus:border-blue-500 focus:ring-blue-500 text-sm"
                      />
                    </div>
                  </div>

                  {/* School Address */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-gray-700 flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-gray-400" />
                      Address
                    </label>
                    <Input
                      value={schoolAddress}
                      onChange={(e) => setSchoolAddress(e.target.value)}
                      placeholder="School address"
                      className="px-4 py-2.5 border-gray-300 focus:border-blue-500 focus:ring-blue-500 text-sm"
                    />
                  </div>

                  {/* Next button */}
                  <Button
                    type="button"
                    disabled={!isSchoolValid}
                    onClick={() => setStep("admin")}
                    className="w-full py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold rounded-lg transition-all duration-200 shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Continue
                    <ArrowRight className="ml-2 w-4 h-4" />
                  </Button>
                </div>
              )}

              {/* ── Admin Account Section ── */}
              {step === "admin" && (
                <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                  <div>
                    <h3 className="text-sm font-bold text-gray-800 flex items-center gap-2 mb-1">
                      <User className="w-4 h-4 text-blue-500" />
                      Admin Account
                    </h3>
                    <p className="text-xs text-gray-500 mb-4">
                      Create the administrator account for your school
                    </p>
                  </div>

                  {/* First & Last Name */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-gray-700">
                        First Name <span className="text-red-400">*</span>
                      </label>
                      <Input
                        value={firstName}
                        onChange={(e) => setFirstName(e.target.value)}
                        placeholder="John"
                        required
                        className="px-4 py-2.5 border-gray-300 focus:border-blue-500 focus:ring-blue-500 text-sm"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-gray-700">
                        Last Name <span className="text-red-400">*</span>
                      </label>
                      <Input
                        value={lastName}
                        onChange={(e) => setLastName(e.target.value)}
                        placeholder="Doe"
                        required
                        className="px-4 py-2.5 border-gray-300 focus:border-blue-500 focus:ring-blue-500 text-sm"
                      />
                    </div>
                  </div>

                  {/* Admin Email */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-gray-700 flex items-center gap-1.5">
                      <Mail className="w-3.5 h-3.5 text-gray-400" />
                      Email Address <span className="text-red-400">*</span>
                    </label>
                    <Input
                      type="email"
                      value={adminEmail}
                      onChange={(e) => setAdminEmail(e.target.value)}
                      placeholder="admin@school.com"
                      required
                      className="px-4 py-2.5 border-gray-300 focus:border-blue-500 focus:ring-blue-500 text-sm"
                    />
                  </div>

                  {/* Password */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-gray-700 flex items-center gap-1.5">
                      <Lock className="w-3.5 h-3.5 text-gray-400" />
                      Password <span className="text-red-400">*</span>
                    </label>
                    <div className="relative">
                      <Input
                        type={showPassword ? "text" : "password"}
                        value={adminPassword}
                        onChange={(e) => setAdminPassword(e.target.value)}
                        placeholder="Create a strong password"
                        required
                        minLength={8}
                        className="px-4 py-2.5 pr-10 border-gray-300 focus:border-blue-500 focus:ring-blue-500 text-sm"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 transition-colors"
                      >
                        {showPassword ? (
                          <EyeOff className="w-4 h-4" />
                        ) : (
                          <Eye className="w-4 h-4" />
                        )}
                      </button>
                    </div>

                    {/* Password strength bar */}
                    {adminPassword.length > 0 && (
                      <div className="mt-2 space-y-2">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-1.5 rounded-full bg-gray-200 overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all duration-300 ${strength.color}`}
                              style={{
                                width: `${(strength.score / 6) * 100}%`,
                              }}
                            />
                          </div>
                          <span className="text-[10px] font-semibold text-gray-500 min-w-[48px] text-right">
                            {strength.label}
                          </span>
                        </div>

                        {/* Requirements checklist */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1">
                          {PASSWORD_REQUIREMENTS.map((req) => {
                            const met = req.test(adminPassword);
                            return (
                              <div
                                key={req.label}
                                className={`flex items-center gap-1.5 text-[11px] transition-colors duration-200 ${
                                  met ? "text-emerald-600" : "text-gray-400"
                                }`}
                              >
                                {met ? (
                                  <Check className="w-3 h-3 flex-shrink-0" />
                                ) : (
                                  <X className="w-3 h-3 flex-shrink-0" />
                                )}
                                {req.label}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Navigation buttons */}
                  <div className="flex gap-3 pt-1">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setStep("school")}
                      className="flex-1 border-gray-300 text-gray-700 hover:bg-gray-50"
                    >
                      Back
                    </Button>
                    <Button
                      type="button"
                      disabled={!isAdminValid}
                      onClick={() => setStep("review")}
                      className="flex-1 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold rounded-lg transition-all duration-200 shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Review
                      <ArrowRight className="ml-2 w-4 h-4" />
                    </Button>
                  </div>
                </div>
              )}

              {/* ── Review & Submit Section ── */}
              {step === "review" && (
                <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                  <div>
                    <h3 className="text-sm font-bold text-gray-800 flex items-center gap-2 mb-1">
                      <Sparkles className="w-4 h-4 text-blue-500" />
                      Review & Confirm
                    </h3>
                    <p className="text-xs text-gray-500 mb-4">
                      Please review your information before submitting
                    </p>
                  </div>

                  {/* Review card */}
                  <div className="rounded-xl border border-gray-200 bg-gray-50/50 overflow-hidden">
                    {/* School summary */}
                    <div className="p-4 border-b border-gray-100">
                      <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2 flex items-center gap-1.5">
                        <Building2 className="w-3.5 h-3.5" />
                        School
                      </h4>
                      <div className="space-y-1">
                        <p className="text-sm font-medium text-gray-900">{schoolName}</p>
                        <p className="text-xs text-gray-500">{schoolEmail}</p>
                        {schoolPhone && <p className="text-xs text-gray-500">{schoolPhone}</p>}
                        {schoolAddress && <p className="text-xs text-gray-500">{schoolAddress}</p>}
                      </div>
                    </div>

                    {/* Admin summary */}
                    <div className="p-4 border-b border-gray-100">
                      <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2 flex items-center gap-1.5">
                        <User className="w-3.5 h-3.5" />
                        Administrator
                      </h4>
                      <p className="text-sm font-medium text-gray-900">
                        {firstName} {lastName}
                      </p>
                      <p className="text-xs text-gray-500">{adminEmail}</p>
                    </div>

                    {/* Plan summary */}
                    <div className="p-4">
                      <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2 flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5" />
                        Plan
                      </h4>
                      <div className="flex items-center gap-2">
                        <div className={`p-1.5 rounded-lg bg-gradient-to-br ${planMeta.gradient}`}>
                          <planMeta.icon className="w-3.5 h-3.5 text-white" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-gray-900">
                            {planMeta.label} — {billingInterval === "yearly" ? "Yearly" : "Per Term"}
                          </p>
                          <p className="text-xs text-gray-500">{planMeta.description}</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Terms */}
                  <label className="flex items-start gap-2.5 cursor-pointer group">
                    <div className="relative flex items-center justify-center mt-0.5">
                      <input
                        type="checkbox"
                        checked={acceptedTerms}
                        onChange={(e) => setAcceptedTerms(e.target.checked)}
                        className="sr-only"
                      />
                      <div
                        className={`w-4 h-4 rounded border-2 transition-all duration-200 flex items-center justify-center ${
                          acceptedTerms
                            ? "bg-blue-600 border-blue-600"
                            : "border-gray-300 group-hover:border-blue-400"
                        }`}
                      >
                        {acceptedTerms && <Check className="w-3 h-3 text-white" />}
                      </div>
                    </div>
                    <span className="text-xs text-gray-600 leading-relaxed">
                      I agree to the{" "}
                      <Link href="#" className="text-blue-600 hover:text-blue-700 font-medium underline underline-offset-2">
                        Terms of Service
                      </Link>{" "}
                      and{" "}
                      <Link href="#" className="text-blue-600 hover:text-blue-700 font-medium underline underline-offset-2">
                        Privacy Policy
                      </Link>
                    </span>
                  </label>

                  {/* Submit buttons */}
                  <div className="flex gap-3 pt-1">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setStep("admin")}
                      className="flex-1 border-gray-300 text-gray-700 hover:bg-gray-50"
                    >
                      Back
                    </Button>
                    <Button
                      type="submit"
                      disabled={loading || !acceptedTerms}
                      className="flex-1 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-700 hover:to-emerald-600 text-white font-semibold rounded-lg transition-all duration-200 shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {loading ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Creating account...
                        </>
                      ) : (
                        <>
                          Create Account
                          <ArrowRight className="ml-2 w-4 h-4" />
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              )}
            </form>

            {/* Footer Links */}
            <div className="mt-6 space-y-4 border-t pt-5">
              {/* Login link */}
              <div className="text-center">
                <p className="text-sm text-gray-500">
                  Already have an account?{" "}
                  <Link
                    href="/admin/login"
                    className="font-semibold text-blue-600 hover:text-blue-700 underline underline-offset-2 transition-colors"
                  >
                    Sign in
                  </Link>
                </p>
              </div>

              {/* Portal Switcher */}
              <PortalSwitcher />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Blob animations */}
      <style>{`
        @keyframes blob {
          0%, 100% {
            transform: translate(0, 0) scale(1);
          }
          33% {
            transform: translate(30px, -50px) scale(1.1);
          }
          66% {
            transform: translate(-20px, 20px) scale(0.9);
          }
        }
        
        .animate-blob {
          animation: blob 7s infinite;
        }
        
        .animation-delay-2000 {
          animation-delay: 2s;
        }

        @keyframes fade-in {
          from { opacity: 0; transform: translateY(4px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .animate-in {
          animation: fade-in 0.25s ease-out;
        }
      `}</style>
    </div>
  );
}

// ── Page Export with Suspense ─────────────────────────────────────────────
// searchParams() requires Suspense boundary

export default function RegisterPage() {
  return (
    <Suspense
      fallback={
        <div className="relative min-h-screen overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-blue-600 via-indigo-600 to-violet-600 opacity-90" />
          <div className="relative flex items-center justify-center min-h-screen p-4">
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="w-8 h-8 text-white animate-spin" />
              <p className="text-white/80 text-sm font-medium">Loading registration...</p>
            </div>
          </div>
        </div>
      }
    >
      <RegisterForm />
    </Suspense>
  );
}
