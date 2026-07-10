"use client";

import { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import { PortalSwitcher } from "@/components/portal-switcher";
import {
  Lock,
  Mail,
  Eye,
  EyeOff,
  Shield,
  Loader2,
  GraduationCap,
  Sparkles,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";

function AdminLoginForm() {
  const searchParams = useSearchParams();
  const supabase = createClientComponentClient();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [loading, setLoading] = useState(false);
  const [emailFocused, setEmailFocused] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);

  const redirectedFrom = searchParams.get("redirectedFrom") ?? "/admin";
  const errorParam = searchParams.get("error");
  const isNewlyRegistered = searchParams.get("registered") === "true";

  useEffect(() => {
    if (errorParam === "unauthorized") {
      setErrorMsg("Your account is not authorized for admin access.");
    } else if (errorParam === "school_mismatch") {
      setErrorMsg(
        "You are not authorized to access this school portal. Please use your school's login URL."
      );
    } else if (errorParam === "error") {
      setErrorMsg(searchParams.get("message") || "An error occurred. Please try again.");
    }
  }, [errorParam, searchParams]);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg("");
    setLoading(true);

    const { data: signInData, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error || !signInData.session) {
      setErrorMsg(error?.message || "Unable to log in. Please try again.");
      setLoading(false);
      return;
    }

    const { data: canAccess, error: rpcError } = await supabase.rpc("can_access_admin");

    console.log("can_access_admin result:", { canAccess, rpcError });

    if (!canAccess) {
      setErrorMsg("Your account is not authorized for admin access.");
      await supabase.auth.signOut();
      setLoading(false);
      return;
    }

    window.location.href = redirectedFrom;
  }

  return (
    <div className="relative min-h-screen overflow-hidden flex">
      {/* Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-blue-950 to-indigo-950" />
      {/* Blobs */}
      <div className="absolute -top-40 -right-40 w-96 h-96 bg-blue-600 rounded-full mix-blend-multiply filter blur-3xl opacity-10 animate-blob" />
      <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-indigo-500 rounded-full mix-blend-multiply filter blur-3xl opacity-10 animate-blob animation-delay-2000" />
      {/* Dot overlay */}
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: `radial-gradient(circle at 1px 1px, #fff 1px, transparent 0)`,
          backgroundSize: "28px 28px",
        }}
      />

      {/* Content */}
      <div className="relative flex items-center justify-center w-full p-4 py-10">
        <div className="w-full max-w-md">

          {/* Brand header */}
          <div className="flex flex-col items-center mb-8">
            <div className="p-3.5 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl shadow-2xl shadow-blue-500/30 mb-4">
              <GraduationCap className="w-8 h-8 text-white" />
            </div>
            <span className="text-white font-extrabold text-xl tracking-tight">School Hub</span>
            <span className="text-blue-300/70 text-xs font-medium tracking-widest uppercase mt-0.5">Admin Portal</span>
          </div>

          {/* Newly registered welcome banner */}
          {isNewlyRegistered && (
            <div className="mb-6 p-4 rounded-2xl bg-gradient-to-r from-emerald-500/15 to-teal-500/15 border border-emerald-400/25 backdrop-blur-sm welcome-banner">
              <div className="flex items-start gap-3">
                <div className="p-1.5 bg-emerald-400/20 rounded-lg flex-shrink-0">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                </div>
                <div>
                  <p className="text-emerald-300 font-bold text-sm">Welcome to School Hub! 🎉</p>
                  <p className="text-emerald-200/70 text-xs mt-0.5 leading-relaxed">
                    Your school was registered successfully. Sign in using the email and password you just created.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Card */}
          <div className="bg-white/[0.06] backdrop-blur-xl rounded-3xl border border-white/10 shadow-2xl overflow-hidden">
            {/* Card header stripe */}
            <div className="px-8 pt-8 pb-6 border-b border-white/8">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-gradient-to-br from-red-500/20 to-orange-500/20 rounded-xl border border-red-400/20">
                  <Shield className="w-5 h-5 text-red-400" />
                </div>
                <div>
                  <h1 className="text-white font-bold text-lg leading-tight">
                    {isNewlyRegistered ? "First time sign in" : "Sign in"}
                  </h1>
                  <p className="text-blue-200/60 text-xs mt-0.5">
                    {isNewlyRegistered
                      ? "Use the credentials you just created"
                      : "Administrator access only"
                    }
                  </p>
                </div>
              </div>
            </div>

            <div className="px-8 py-7">
              <form onSubmit={handleLogin} className="space-y-5">
                {/* Email */}
                <div className="space-y-1.5">
                  <label htmlFor="email" className="block text-xs font-semibold text-blue-100/80">
                    Email Address
                  </label>
                  <div className="relative">
                    <div className={`absolute left-3.5 top-1/2 -translate-y-1/2 transition-colors duration-200 ${emailFocused ? "text-blue-400" : "text-blue-300/40"}`}>
                      <Mail className="w-4 h-4" />
                    </div>
                    <input
                      id="email"
                      type="email"
                      placeholder="admin@school.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      onFocus={() => setEmailFocused(true)}
                      onBlur={() => setEmailFocused(false)}
                      required
                      disabled={loading}
                      className="w-full bg-white/8 border border-white/12 rounded-xl pl-10 pr-4 py-3 text-sm text-white placeholder:text-blue-200/30 outline-none transition-all duration-200 focus:bg-white/12 focus:border-blue-400/60 focus:shadow-md focus:shadow-blue-500/10 disabled:opacity-50"
                    />
                  </div>
                </div>

                {/* Password */}
                <div className="space-y-1.5">
                  <label htmlFor="password" className="block text-xs font-semibold text-blue-100/80">
                    Password
                  </label>
                  <div className="relative">
                    <div className={`absolute left-3.5 top-1/2 -translate-y-1/2 transition-colors duration-200 ${passwordFocused ? "text-blue-400" : "text-blue-300/40"}`}>
                      <Lock className="w-4 h-4" />
                    </div>
                    <input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      onFocus={() => setPasswordFocused(true)}
                      onBlur={() => setPasswordFocused(false)}
                      required
                      disabled={loading}
                      className="w-full bg-white/8 border border-white/12 rounded-xl pl-10 pr-12 py-3 text-sm text-white placeholder:text-blue-200/30 outline-none transition-all duration-200 focus:bg-white/12 focus:border-blue-400/60 focus:shadow-md focus:shadow-blue-500/10 disabled:opacity-50"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      disabled={loading}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-blue-300/50 hover:text-blue-200 transition-colors duration-150 disabled:opacity-50"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Error */}
                {errorMsg && (
                  <div className="flex items-start gap-2.5 p-3.5 rounded-xl bg-red-500/10 border border-red-400/20 error-msg">
                    <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                    <p className="text-sm text-red-300 leading-snug">{errorMsg}</p>
                  </div>
                )}

                {/* Submit */}
                <Button
                  type="submit"
                  disabled={loading}
                  className="w-full h-12 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold rounded-xl transition-all duration-200 shadow-lg shadow-blue-600/30 hover:shadow-xl hover:shadow-blue-500/40 hover:-translate-y-px active:translate-y-0 disabled:opacity-70 disabled:cursor-not-allowed disabled:shadow-none disabled:transform-none mt-2"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Signing in...
                    </>
                  ) : (
                    <>
                      Sign In
                      <ArrowRight className="ml-2 w-4 h-4" />
                    </>
                  )}
                </Button>
              </form>

              {/* Footer */}
              <div className="mt-6 pt-5 border-t border-white/8 space-y-4">
                <p className="text-center text-xs text-blue-200/40 leading-relaxed">
                  Restricted access. Contact your system administrator if you need help.
                </p>

                <div className="text-center">
                  <p className="text-sm text-blue-200/60">
                    New school?{" "}
                    <Link
                      href="/register"
                      className="font-bold text-blue-300 hover:text-blue-100 underline underline-offset-2 transition-colors"
                    >
                      Register here
                    </Link>
                  </p>
                </div>

                <PortalSwitcher currentPortal="admin" />
              </div>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes blob {
          0%, 100% { transform: translate(0,0) scale(1); }
          33% { transform: translate(20px,-40px) scale(1.05); }
          66% { transform: translate(-15px,15px) scale(0.97); }
        }
        .animate-blob { animation: blob 8s infinite; }
        .animation-delay-2000 { animation-delay: 2s; }

        @keyframes welcome-in {
          from { opacity: 0; transform: translateY(-8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .welcome-banner { animation: welcome-in 0.35s cubic-bezier(0.16,1,0.3,1); }

        @keyframes error-in {
          from { opacity: 0; transform: translateY(-4px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .error-msg { animation: error-in 0.25s cubic-bezier(0.16,1,0.3,1); }

        @media (prefers-reduced-motion: reduce) {
          .animate-blob { animation: none; }
          .welcome-banner, .error-msg { animation: none; }
        }
      `}</style>
    </div>
  );
}

export default function AdminLoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-slate-900">
          <Loader2 className="w-8 h-8 text-white animate-spin" />
        </div>
      }
    >
      <AdminLoginForm />
    </Suspense>
  );
}
