"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
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
  Shield,
  Zap,
  Star,
  BookOpen,
  Users,
  BarChart3,
  CheckCircle2,
  Rocket,
  Settings,
  UserPlus,
  AlertCircle,
} from "lucide-react";

// ── Plan display helpers ──────────────────────────────────────────────────

const PLAN_META: Record<string, { label: string; icon: any; gradient: string; badge: string; description: string }> = {
  basic: {
    label: "Basic",
    icon: Shield,
    gradient: "from-slate-500 to-slate-400",
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
    gradient: "from-violet-600 to-purple-600",
    badge: "Best Value",
    description: "Everything for school groups and chains.",
  },
};

// ── Password strength ─────────────────────────────────────────────────────

function getPasswordStrength(password: string): { score: number; label: string; color: string; segments: string[] } {
  let score = 0;
  if (password.length >= 8) score += 1;
  if (password.length >= 12) score += 1;
  if (/[A-Z]/.test(password)) score += 1;
  if (/[a-z]/.test(password)) score += 1;
  if (/[0-9]/.test(password)) score += 1;
  if (/[^A-Za-z0-9]/.test(password)) score += 1;

  const filled = Math.round((score / 6) * 4);
  const segments = [0, 1, 2, 3].map((i) => {
    if (i < filled) {
      if (score <= 2) return "bg-red-500";
      if (score <= 4) return "bg-amber-400";
      return "bg-emerald-500";
    }
    return "bg-gray-200";
  });

  if (score <= 2) return { score, label: "Weak", color: "text-red-500", segments };
  if (score <= 4) return { score, label: "Medium", color: "text-amber-500", segments };
  return { score, label: "Strong", color: "text-emerald-500", segments };
}

const PASSWORD_REQUIREMENTS = [
  { label: "At least 8 characters", test: (p: string) => p.length >= 8 },
  { label: "Uppercase letter", test: (p: string) => /[A-Z]/.test(p) },
  { label: "Lowercase letter", test: (p: string) => /[a-z]/.test(p) },
  { label: "Number", test: (p: string) => /[0-9]/.test(p) },
  { label: "Special character", test: (p: string) => /[^A-Za-z0-9]/.test(p) },
  { label: "12+ characters (recommended)", test: (p: string) => p.length >= 12 },
];

// ── Feature highlights for left panel ───────────────────────────────────

const FEATURES = [
  { icon: Users, text: "Manage students, teachers & parents" },
  { icon: BookOpen, text: "Subjects, timetables & assessments" },
  { icon: BarChart3, text: "Real-time analytics & reports" },
  { icon: Shield, text: "Bank-grade security & data privacy" },
];

const STEPS = [
  { id: "school", label: "School Info", short: "School" },
  { id: "admin", label: "Admin Account", short: "Admin" },
  { id: "review", label: "Review", short: "Review" },
];

// ── Step Progress Bar ─────────────────────────────────────────────────────

function StepBar({ step, setStep, isSchoolValid }: { step: string; setStep: (s: any) => void; isSchoolValid: boolean }) {
  const steps = STEPS;
  const currentIndex = steps.findIndex((s) => s.id === step);

  return (
    <div className="flex items-center gap-0 mb-8">
      {steps.map((s, i) => {
        const done = i < currentIndex;
        const active = i === currentIndex;
        const reachable = i === 0 || (i === 1 && isSchoolValid) || i < currentIndex;
        return (
          <div key={s.id} className="flex items-center flex-1 last:flex-none">
            <button
              type="button"
              onClick={() => reachable && setStep(s.id)}
              disabled={!reachable}
              className={`
                flex items-center gap-2 group transition-all duration-200 outline-none
                ${!reachable ? "cursor-not-allowed opacity-50" : "cursor-pointer"}
              `}
            >
              <span
                className={`
                  flex items-center justify-center w-8 h-8 rounded-full text-xs font-bold
                  transition-all duration-200 border-2 flex-shrink-0
                  ${done
                    ? "bg-blue-600 border-blue-600 text-white shadow-md shadow-blue-200"
                    : active
                    ? "bg-white border-blue-600 text-blue-600 shadow-md shadow-blue-100 ring-4 ring-blue-50"
                    : "bg-white border-gray-200 text-gray-400"
                  }
                `}
              >
                {done ? <Check className="w-3.5 h-3.5" /> : i + 1}
              </span>
              <span
                className={`text-xs font-semibold hidden sm:block transition-colors duration-200
                  ${active ? "text-blue-700" : done ? "text-blue-500" : "text-gray-400"}
                `}
              >
                {s.label}
              </span>
            </button>
            {i < steps.length - 1 && (
              <div className="flex-1 h-px mx-3 transition-colors duration-300"
                style={{ background: done ? "linear-gradient(to right, #2563eb, #6366f1)" : "#e5e7eb" }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Animated Step Wrapper ─────────────────────────────────────────────────

function StepPanel({ children, id, activeId }: { children: React.ReactNode; id: string; activeId: string }) {
  const isActive = id === activeId;
  return (
    <div
      className={`transition-all duration-200 ${isActive ? "reg-step-enter" : "hidden"}`}
      aria-hidden={!isActive}
    >
      {children}
    </div>
  );
}

// ── Floating Input ────────────────────────────────────────────────────────

function FloatingInput({
  label,
  id,
  value,
  onChange,
  type = "text",
  placeholder,
  required,
  icon: Icon,
  suffix,
  error,
  valid,
  minLength,
  disabled,
}: {
  label: string;
  id: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
  required?: boolean;
  icon?: any;
  suffix?: React.ReactNode;
  error?: string;
  valid?: boolean;
  minLength?: number;
  disabled?: boolean;
}) {
  const [focused, setFocused] = useState(false);
  const touched = value.length > 0;

  return (
    <div className="space-y-1">
      <label htmlFor={id} className="block text-xs font-semibold text-gray-700">
        {label}{required && <span className="text-red-400 ml-0.5">*</span>}
      </label>
      <div className="relative">
        {Icon && (
          <div className={`absolute left-3 top-1/2 -translate-y-1/2 transition-colors duration-200 ${focused ? "text-blue-500" : "text-gray-400"}`}>
            <Icon className="w-4 h-4" />
          </div>
        )}
        <input
          id={id}
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder={placeholder}
          required={required}
          minLength={minLength}
          disabled={disabled}
          className={`
            w-full rounded-xl border-2 bg-gray-50/60 px-4 py-2.5 text-sm text-gray-900
            placeholder:text-gray-400 outline-none transition-all duration-200
            ${Icon ? "pl-10" : ""}
            ${suffix ? "pr-10" : ""}
            ${focused
              ? "border-blue-500 bg-white shadow-sm shadow-blue-100/60"
              : touched && valid
              ? "border-emerald-400 bg-white"
              : touched && error
              ? "border-red-400 bg-white"
              : "border-gray-200 hover:border-gray-300"
            }
            disabled:opacity-60 disabled:cursor-not-allowed
          `}
        />
        {suffix && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            {suffix}
          </div>
        )}
        {touched && !suffix && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2 transition-all duration-200">
            {valid
              ? <Check className="w-4 h-4 text-emerald-500" />
              : error
              ? <AlertCircle className="w-4 h-4 text-red-400" />
              : null
            }
          </div>
        )}
      </div>
      {error && touched && (
        <p className="text-xs text-red-500 flex items-center gap-1 mt-0.5">
          <AlertCircle className="w-3 h-3 flex-shrink-0" />{error}
        </p>
      )}
    </div>
  );
}

// ── Main Registration Form ────────────────────────────────────────────────

function RegisterForm() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const plan = searchParams.get("plan") || "basic";
  const billingInterval = searchParams.get("interval") || "termly";
  const planMeta = PLAN_META[plan] || PLAN_META.basic;

  const [step, setStep] = useState<"school" | "admin" | "review">("school");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [registered, setRegistered] = useState(false);

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

  // Validation helpers
  const isEmailValid = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
  const isSchoolValid = schoolName.trim().length >= 2 && isEmailValid(schoolEmail);
  const isAdminValid =
    firstName.trim().length >= 1 &&
    lastName.trim().length >= 1 &&
    isEmailValid(adminEmail) &&
    adminPassword.length >= 8;

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
      setRegistered(true);
    } catch (error: any) {
      toast.error(error?.message || "Network error. Please try again.");
      setLoading(false);
    }
  }

  if (registered) {
    return <RegistrationSuccess firstName={firstName} schoolName={schoolName} />;
  }

  return (
    <div className="relative min-h-screen flex overflow-hidden bg-white">
      {/* ── Left decorative panel ── */}
      <div className="hidden lg:flex lg:w-[46%] xl:w-[42%] flex-col relative overflow-hidden bg-gradient-to-br from-blue-700 via-indigo-700 to-violet-800">
        {/* Mesh grid overlay */}
        <div
          className="absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage: `radial-gradient(circle at 1px 1px, rgba(255,255,255,0.8) 1px, transparent 0)`,
            backgroundSize: "28px 28px",
          }}
        />
        {/* Glow blobs */}
        <div className="absolute -top-32 -left-32 w-72 h-72 bg-blue-400 rounded-full mix-blend-multiply filter blur-3xl opacity-25 animate-blob" />
        <div className="absolute bottom-0 right-0 w-80 h-80 bg-violet-400 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-2000" />
        <div className="absolute top-1/2 left-1/3 w-60 h-60 bg-indigo-300 rounded-full mix-blend-multiply filter blur-3xl opacity-15 animate-blob animation-delay-4000" />

        <div className="relative flex flex-col h-full p-10 xl:p-14">
          {/* Brand */}
          <div className="flex items-center gap-3 mb-12">
            <div className="p-2.5 bg-white/15 backdrop-blur-sm rounded-xl border border-white/20">
              <GraduationCap className="w-6 h-6 text-white" />
            </div>
            <div>
              <span className="text-white font-bold text-lg tracking-tight">School Hub</span>
              <p className="text-blue-200 text-[10px] font-medium tracking-widest uppercase">Portal</p>
            </div>
          </div>

          {/* Hero text */}
          <div className="mb-10">
            <h1 className="text-3xl xl:text-4xl font-extrabold text-white leading-tight mb-4">
              Your school.<br />
              <span className="text-blue-200">Fully managed.</span>
            </h1>
            <p className="text-blue-100/80 text-sm leading-relaxed max-w-xs">
              Join thousands of schools already using School Hub to streamline administration, engage parents and improve learning outcomes.
            </p>
          </div>

          {/* Feature list */}
          <div className="space-y-4 mb-auto">
            {FEATURES.map((f) => (
              <div key={f.text} className="flex items-center gap-3 group">
                <div className="p-1.5 bg-white/10 rounded-lg border border-white/15 group-hover:bg-white/15 transition-colors duration-200 flex-shrink-0">
                  <f.icon className="w-4 h-4 text-blue-200" />
                </div>
                <span className="text-blue-100 text-sm font-medium">{f.text}</span>
              </div>
            ))}
          </div>

          {/* Plan badge */}
          {plan !== "basic" && (
            <div className={`mt-8 p-4 rounded-2xl bg-white/10 border border-white/20 backdrop-blur-sm`}>
              <div className="flex items-center gap-2 mb-1">
                <planMeta.icon className="w-4 h-4 text-white" />
                <span className="text-white font-bold text-sm">{planMeta.label} Plan Selected</span>
                <span className="text-[10px] font-bold bg-emerald-400 text-emerald-900 px-1.5 py-0.5 rounded-full">
                  {planMeta.badge}
                </span>
              </div>
              <p className="text-blue-200/80 text-xs">{planMeta.description}</p>
            </div>
          )}

          {/* Testimonial quote */}
          <div className="mt-6 pt-6 border-t border-white/10">
            <p className="text-blue-100/70 text-xs italic leading-relaxed">
              "School Hub transformed how we manage our 1,200+ students. Setup took minutes."
            </p>
            <p className="text-blue-200 text-xs font-semibold mt-2">— Principal Adeyemi, Lagos</p>
          </div>
        </div>
      </div>

      {/* ── Right form panel ── */}
      <div className="flex-1 flex flex-col items-center justify-start py-8 px-4 sm:px-8 overflow-y-auto">
        {/* Mobile brand */}
        <div className="flex lg:hidden items-center gap-2 mb-6 self-start">
          <div className="p-2 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl">
            <GraduationCap className="w-5 h-5 text-white" />
          </div>
          <span className="font-bold text-gray-900">School Hub</span>
        </div>

        <div className="w-full max-w-md">
          {/* Header */}
          <div className="mb-8">
            <h2 className="text-2xl sm:text-3xl font-extrabold text-gray-900 leading-tight">
              Register your school
            </h2>
            <p className="text-gray-500 text-sm mt-1.5">
              Set up your management system in under 3 minutes
            </p>
          </div>

          {/* Step progress */}
          <StepBar step={step} setStep={setStep} isSchoolValid={isSchoolValid} />

          {/* Form */}
          <form onSubmit={handleSubmit} noValidate>
            {/* ── Step 1: School Info ── */}
            <StepPanel id="school" activeId={step}>
              <div className="space-y-5">
                <div className="pb-1">
                  <h3 className="font-bold text-gray-800 flex items-center gap-2 text-sm">
                    <Building2 className="w-4 h-4 text-blue-500" />
                    School Information
                  </h3>
                  <p className="text-xs text-gray-500 mt-0.5">Tell us about your institution</p>
                </div>

                <FloatingInput
                  id="schoolName"
                  label="School Name"
                  value={schoolName}
                  onChange={setSchoolName}
                  placeholder="e.g. Springfield International School"
                  required
                  icon={Building2}
                  valid={schoolName.trim().length >= 2}
                  error={schoolName.trim().length > 0 && schoolName.trim().length < 2 ? "Name must be at least 2 characters" : undefined}
                />

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FloatingInput
                    id="schoolEmail"
                    label="School Email"
                    value={schoolEmail}
                    onChange={setSchoolEmail}
                    type="email"
                    placeholder="school@example.com"
                    required
                    icon={Mail}
                    valid={isEmailValid(schoolEmail)}
                    error={schoolEmail.length > 0 && !isEmailValid(schoolEmail) ? "Invalid email address" : undefined}
                  />
                  <FloatingInput
                    id="schoolPhone"
                    label="Phone Number"
                    value={schoolPhone}
                    onChange={setSchoolPhone}
                    type="tel"
                    placeholder="+234 800 000 0000"
                    icon={Phone}
                  />
                </div>

                <FloatingInput
                  id="schoolAddress"
                  label="School Address"
                  value={schoolAddress}
                  onChange={setSchoolAddress}
                  placeholder="School address (optional)"
                  icon={MapPin}
                />

                <Button
                  type="button"
                  disabled={!isSchoolValid}
                  onClick={() => setStep("admin")}
                  className="w-full h-12 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold rounded-xl transition-all duration-200 shadow-lg shadow-blue-200/50 hover:shadow-xl hover:shadow-blue-200/60 disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none hover:-translate-y-px active:translate-y-0"
                >
                  Continue
                  <ArrowRight className="ml-2 w-4 h-4" />
                </Button>
              </div>
            </StepPanel>

            {/* ── Step 2: Admin Account ── */}
            <StepPanel id="admin" activeId={step}>
              <div className="space-y-5">
                <div className="pb-1">
                  <h3 className="font-bold text-gray-800 flex items-center gap-2 text-sm">
                    <User className="w-4 h-4 text-blue-500" />
                    Administrator Account
                  </h3>
                  <p className="text-xs text-gray-500 mt-0.5">Create your admin login credentials</p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FloatingInput
                    id="firstName"
                    label="First Name"
                    value={firstName}
                    onChange={setFirstName}
                    placeholder="John"
                    required
                    icon={User}
                    valid={firstName.trim().length >= 1}
                  />
                  <FloatingInput
                    id="lastName"
                    label="Last Name"
                    value={lastName}
                    onChange={setLastName}
                    placeholder="Doe"
                    required
                    icon={User}
                    valid={lastName.trim().length >= 1}
                  />
                </div>

                <FloatingInput
                  id="adminEmail"
                  label="Email Address"
                  value={adminEmail}
                  onChange={setAdminEmail}
                  type="email"
                  placeholder="admin@school.com"
                  required
                  icon={Mail}
                  valid={isEmailValid(adminEmail)}
                  error={adminEmail.length > 0 && !isEmailValid(adminEmail) ? "Invalid email address" : undefined}
                />

                {/* Password */}
                <div className="space-y-1">
                  <label htmlFor="adminPassword" className="block text-xs font-semibold text-gray-700">
                    Password<span className="text-red-400 ml-0.5">*</span>
                  </label>
                  <div className="relative">
                    <div className={`absolute left-3 top-1/2 -translate-y-1/2 transition-colors duration-200 ${adminPassword ? "text-blue-500" : "text-gray-400"}`}>
                      <Lock className="w-4 h-4" />
                    </div>
                    <input
                      id="adminPassword"
                      type={showPassword ? "text" : "password"}
                      value={adminPassword}
                      onChange={(e) => setAdminPassword(e.target.value)}
                      placeholder="Create a strong password"
                      required
                      minLength={8}
                      className={`
                        w-full rounded-xl border-2 bg-gray-50/60 pl-10 pr-20 py-2.5 text-sm text-gray-900
                        placeholder:text-gray-400 outline-none transition-all duration-200
                        ${adminPassword.length > 0
                          ? adminPassword.length >= 8
                            ? "border-emerald-400 bg-white"
                            : "border-red-400 bg-white"
                          : "border-gray-200 hover:border-gray-300 focus:border-blue-500 focus:bg-white focus:shadow-sm focus:shadow-blue-100/60"
                        }
                      `}
                    />
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
                      {adminPassword.length > 0 && (
                        <span className={`text-[10px] font-bold ${strength.color}`}>{strength.label}</span>
                      )}
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="text-gray-400 hover:text-gray-600 transition-colors duration-150"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {/* Strength segments */}
                  {adminPassword.length > 0 && (
                    <div className="pt-1 space-y-2">
                      <div className="flex gap-1">
                        {strength.segments.map((seg, i) => (
                          <div
                            key={i}
                            className={`flex-1 h-1.5 rounded-full transition-all duration-300 ${seg}`}
                          />
                        ))}
                      </div>
                      <div className="grid grid-cols-2 gap-x-4 gap-y-0.5">
                        {PASSWORD_REQUIREMENTS.map((req) => {
                          const met = req.test(adminPassword);
                          return (
                            <div
                              key={req.label}
                              className={`flex items-center gap-1.5 text-[11px] transition-colors duration-200 ${met ? "text-emerald-600" : "text-gray-400"}`}
                            >
                              {met
                                ? <Check className="w-3 h-3 flex-shrink-0" />
                                : <X className="w-3 h-3 flex-shrink-0 opacity-60" />
                              }
                              {req.label}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex gap-3 pt-1">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setStep("school")}
                    className="flex-1 h-11 border-gray-200 text-gray-600 hover:bg-gray-50 rounded-xl font-semibold transition-all duration-200"
                  >
                    Back
                  </Button>
                  <Button
                    type="button"
                    disabled={!isAdminValid}
                    onClick={() => setStep("review")}
                    className="flex-[2] h-11 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold rounded-xl transition-all duration-200 shadow-lg shadow-blue-200/50 hover:shadow-xl hover:-translate-y-px active:translate-y-0 disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none"
                  >
                    Review Details
                    <ArrowRight className="ml-2 w-4 h-4" />
                  </Button>
                </div>
              </div>
            </StepPanel>

            {/* ── Step 3: Review ── */}
            <StepPanel id="review" activeId={step}>
              <div className="space-y-5">
                <div className="pb-1">
                  <h3 className="font-bold text-gray-800 flex items-center gap-2 text-sm">
                    <Sparkles className="w-4 h-4 text-blue-500" />
                    Review & Confirm
                  </h3>
                  <p className="text-xs text-gray-500 mt-0.5">Double-check everything before creating your account</p>
                </div>

                {/* Summary cards */}
                <div className="space-y-3">
                  {/* School card */}
                  <div className="rounded-2xl border border-gray-100 bg-gradient-to-br from-blue-50/60 to-indigo-50/40 p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <div className="p-1.5 bg-blue-100 rounded-lg">
                          <Building2 className="w-3.5 h-3.5 text-blue-600" />
                        </div>
                        <span className="text-xs font-bold text-blue-700 uppercase tracking-wide">School</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setStep("school")}
                        className="text-[11px] text-blue-600 hover:text-blue-800 font-semibold underline underline-offset-2 transition-colors"
                      >
                        Edit
                      </button>
                    </div>
                    <p className="font-bold text-gray-900 text-sm">{schoolName}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{schoolEmail}</p>
                    {schoolPhone && <p className="text-xs text-gray-500">{schoolPhone}</p>}
                    {schoolAddress && <p className="text-xs text-gray-500">{schoolAddress}</p>}
                  </div>

                  {/* Admin card */}
                  <div className="rounded-2xl border border-gray-100 bg-gradient-to-br from-violet-50/60 to-purple-50/40 p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <div className="p-1.5 bg-violet-100 rounded-lg">
                          <User className="w-3.5 h-3.5 text-violet-600" />
                        </div>
                        <span className="text-xs font-bold text-violet-700 uppercase tracking-wide">Administrator</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setStep("admin")}
                        className="text-[11px] text-violet-600 hover:text-violet-800 font-semibold underline underline-offset-2 transition-colors"
                      >
                        Edit
                      </button>
                    </div>
                    <p className="font-bold text-gray-900 text-sm">{firstName} {lastName}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{adminEmail}</p>
                    <div className="flex items-center gap-1.5 mt-2">
                      <div className="flex gap-0.5">
                        {strength.segments.map((seg, i) => (
                          <div key={i} className={`w-5 h-1 rounded-full ${seg}`} />
                        ))}
                      </div>
                      <span className={`text-[10px] font-bold ${strength.color}`}>{strength.label} password</span>
                    </div>
                  </div>

                  {/* Plan card */}
                  <div className={`rounded-2xl border border-gray-100 p-4 bg-gradient-to-br ${plan === "basic" ? "from-gray-50 to-slate-50/60" : plan === "pro" ? "from-blue-50/50 to-indigo-50/50" : "from-violet-50/50 to-purple-50/50"}`}>
                    <div className="flex items-center gap-2 mb-1">
                      <div className={`p-1.5 bg-gradient-to-br ${planMeta.gradient} rounded-lg`}>
                        <planMeta.icon className="w-3.5 h-3.5 text-white" />
                      </div>
                      <span className="text-xs font-bold text-gray-700 uppercase tracking-wide">Plan</span>
                      <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded-full">
                        {planMeta.badge}
                      </span>
                    </div>
                    <p className="font-bold text-gray-900 text-sm">
                      {planMeta.label} — {billingInterval === "yearly" ? "Yearly" : "Per Term"}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">{planMeta.description}</p>
                  </div>
                </div>

                {/* Terms */}
                <label className="flex items-start gap-3 cursor-pointer group select-none" htmlFor="acceptTerms">
                  <div className="relative mt-0.5 flex-shrink-0">
                    <input
                      id="acceptTerms"
                      type="checkbox"
                      checked={acceptedTerms}
                      onChange={(e) => setAcceptedTerms(e.target.checked)}
                      className="sr-only"
                    />
                    <div
                      className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all duration-200 ${
                        acceptedTerms
                          ? "bg-blue-600 border-blue-600 shadow-sm shadow-blue-200"
                          : "border-gray-300 group-hover:border-blue-400"
                      }`}
                    >
                      {acceptedTerms && <Check className="w-3 h-3 text-white" strokeWidth={3} />}
                    </div>
                  </div>
                  <span className="text-xs text-gray-600 leading-relaxed pt-0.5">
                    I agree to the{" "}
                    <Link href="#" className="text-blue-600 hover:text-blue-700 font-semibold underline underline-offset-2">
                      Terms of Service
                    </Link>{" "}
                    and{" "}
                    <Link href="#" className="text-blue-600 hover:text-blue-700 font-semibold underline underline-offset-2">
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
                    className="flex-1 h-11 border-gray-200 text-gray-600 hover:bg-gray-50 rounded-xl font-semibold transition-all duration-200"
                  >
                    Back
                  </Button>
                  <Button
                    type="submit"
                    disabled={loading || !acceptedTerms}
                    className="flex-[2] h-11 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-bold rounded-xl transition-all duration-200 shadow-lg shadow-emerald-200/50 hover:shadow-xl hover:-translate-y-px active:translate-y-0 disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Creating...
                      </>
                    ) : (
                      <>
                        <Rocket className="w-4 h-4 mr-2" />
                        Create Account
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </StepPanel>
          </form>

          {/* Footer */}
          <div className="mt-8 text-center space-y-3 border-t border-gray-100 pt-6">
            <p className="text-sm text-gray-500">
              Already have an account?{" "}
              <Link
                href="/admin/login"
                className="font-bold text-blue-600 hover:text-blue-700 underline underline-offset-2 transition-colors"
              >
                Sign in
              </Link>
            </p>
          </div>
        </div>
      </div>

      {/* Styles */}
      <style>{`
        @keyframes blob {
          0%, 100% { transform: translate(0,0) scale(1); }
          33% { transform: translate(20px,-40px) scale(1.05); }
          66% { transform: translate(-15px,15px) scale(0.97); }
        }
        .animate-blob { animation: blob 8s infinite; }
        .animation-delay-2000 { animation-delay: 2s; }
        .animation-delay-4000 { animation-delay: 4s; }

        @keyframes reg-step-enter {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .reg-step-enter { animation: reg-step-enter 0.22s cubic-bezier(0.16,1,0.3,1) forwards; }

        @media (prefers-reduced-motion: reduce) {
          .animate-blob { animation: none; }
          .reg-step-enter { animation: none; opacity: 1; transform: none; }
        }
      `}</style>
    </div>
  );
}

// ── Registration Success Screen ───────────────────────────────────────────

const NEXT_STEPS = [
  {
    icon: Settings,
    title: "Set up your school",
    desc: "Configure academic structure, streams and departments using the setup wizard.",
    href: "/admin/school-config",
    color: "bg-blue-50 border-blue-100",
    iconBg: "bg-blue-100",
    iconColor: "text-blue-600",
    btnColor: "text-blue-700 hover:text-blue-900",
  },
  {
    icon: UserPlus,
    title: "Add your teachers",
    desc: "Invite and register teaching staff so they can access their portal.",
    href: "/admin/teachers",
    color: "bg-violet-50 border-violet-100",
    iconBg: "bg-violet-100",
    iconColor: "text-violet-600",
    btnColor: "text-violet-700 hover:text-violet-900",
  },
  {
    icon: GraduationCap,
    title: "Enroll students",
    desc: "Add student records and assign them to classes to get started.",
    href: "/admin/students",
    color: "bg-emerald-50 border-emerald-100",
    iconBg: "bg-emerald-100",
    iconColor: "text-emerald-600",
    btnColor: "text-emerald-700 hover:text-emerald-900",
  },
];

function RegistrationSuccess({ firstName, schoolName }: { firstName: string; schoolName: string }) {
  const router = useRouter();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 60);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-blue-50 via-white to-violet-50 relative overflow-hidden">
      {/* Background blobs */}
      <div className="absolute -top-20 -left-20 w-60 h-60 bg-blue-100 rounded-full filter blur-3xl opacity-60" />
      <div className="absolute -bottom-20 -right-20 w-60 h-60 bg-violet-100 rounded-full filter blur-3xl opacity-60" />

      <div
        className={`w-full max-w-lg transition-all duration-500 ${visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"}`}
        style={{ transitionTimingFunction: "cubic-bezier(0.16,1,0.3,1)" }}
      >
        <div className="bg-white rounded-3xl shadow-2xl shadow-blue-100/40 border border-gray-100 overflow-hidden">
          {/* Top celebration banner */}
          <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 px-8 py-8 text-center relative overflow-hidden">
            <div className="absolute inset-0 opacity-[0.05]"
              style={{ backgroundImage: `radial-gradient(circle at 1px 1px, #fff 1px, transparent 0)`, backgroundSize: "20px 20px" }}
            />
            {/* Animated check ring */}
            <div className="relative flex justify-center mb-4">
              <div className="success-ring w-20 h-20 rounded-full bg-white/10 border-4 border-white/30 flex items-center justify-center">
                <div className="success-check w-14 h-14 rounded-full bg-white flex items-center justify-center shadow-xl">
                  <CheckCircle2 className="w-8 h-8 text-emerald-500" strokeWidth={2.5} />
                </div>
              </div>
              {/* Sparkle dots */}
              {[...Array(6)].map((_, i) => (
                <div key={i} className="absolute w-1.5 h-1.5 bg-white rounded-full sparkle-dot"
                  style={{
                    top: `${50 + 48 * Math.sin((i * Math.PI * 2) / 6)}%`,
                    left: `${50 + 48 * Math.cos((i * Math.PI * 2) / 6)}%`,
                    animationDelay: `${i * 0.1}s`,
                  }}
                />
              ))}
            </div>
            <h2 className="text-2xl font-extrabold text-white mb-1">
              You're all set, {firstName}! 🎉
            </h2>
            <p className="text-blue-100 text-sm">
              <span className="font-semibold text-white">{schoolName}</span> is registered and ready to go
            </p>
          </div>

          {/* Body */}
          <div className="p-6 sm:p-8">
            <p className="text-sm text-gray-600 text-center mb-6">
              Your admin account has been created. Here's what to do next to get your school fully up and running:
            </p>

            {/* Next steps */}
            <div className="space-y-3 mb-8">
              {NEXT_STEPS.map((step, i) => (
                <div
                  key={step.title}
                  className={`flex items-start gap-4 p-4 rounded-2xl border ${step.color} next-step-card`}
                  style={{ animationDelay: `${0.1 + i * 0.1}s` }}
                >
                  <div className={`p-2.5 rounded-xl ${step.iconBg} flex-shrink-0`}>
                    <step.icon className={`w-5 h-5 ${step.iconColor}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <h4 className="font-bold text-gray-900 text-sm">{step.title}</h4>
                      <span className="text-[10px] font-bold text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full flex-shrink-0">
                        Step {i + 1}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{step.desc}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* CTA */}
            <div className="space-y-3">
              <Button
                onClick={() => router.push("/admin/login?registered=true")}
                className="w-full h-12 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold rounded-xl transition-all duration-200 shadow-lg shadow-blue-200/50 hover:shadow-xl hover:-translate-y-px active:translate-y-0"
              >
                Sign in to your portal
                <ArrowRight className="ml-2 w-4 h-4" />
              </Button>
              <p className="text-center text-xs text-gray-400">
                Use the email and password you just set up
              </p>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes success-ring-pulse {
          0%, 100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(255,255,255,0.4); }
          50% { transform: scale(1.04); box-shadow: 0 0 0 12px rgba(255,255,255,0); }
        }
        .success-ring { animation: success-ring-pulse 2s ease-in-out infinite; }

        @keyframes check-pop {
          0% { transform: scale(0.97); }
          60% { transform: scale(1.04); }
          100% { transform: scale(1); }
        }
        .success-check { animation: check-pop 0.4s cubic-bezier(0.16,1,0.3,1) 0.1s both; }

        @keyframes sparkle {
          0%, 100% { opacity: 0; transform: translate(-50%, -50%) scale(0.97); }
          50% { opacity: 1; transform: translate(-50%, -50%) scale(1.2); }
        }
        .sparkle-dot {
          transform: translate(-50%, -50%);
          animation: sparkle 1.6s ease-in-out infinite;
        }

        @keyframes next-step-in {
          from { opacity: 0; transform: translateX(-8px); }
          to { opacity: 1; transform: translateX(0); }
        }
        .next-step-card { animation: next-step-in 0.3s cubic-bezier(0.16,1,0.3,1) both; }

        @media (prefers-reduced-motion: reduce) {
          .success-ring, .success-check, .sparkle-dot, .next-step-card { animation: none; }
        }
      `}</style>
    </div>
  );
}

// ── Page Export with Suspense ─────────────────────────────────────────────

export default function RegisterPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-600 via-indigo-600 to-violet-600">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="w-8 h-8 text-white animate-spin" />
            <p className="text-white/80 text-sm font-medium">Loading registration...</p>
          </div>
        </div>
      }
    >
      <RegisterForm />
    </Suspense>
  );
}
