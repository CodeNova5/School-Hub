"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Lock, Mail, Eye, EyeOff, BookOpen, Loader2, X } from "lucide-react";
import { PortalSwitcher } from "@/components/portal-switcher";

export default function StudentLoginPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [resettingPassword, setResettingPassword] = useState(false);

  async function handleLogin(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const email = formData.get("email") as string;
    const password = formData.get("password") as string;

    // 1️⃣ Supabase auth login
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error || !data.user) {
      toast.error("Invalid login credentials");
      setLoading(false);
      return;
    }

    // 2️⃣ Role check
    const metadata = data.user.user_metadata;
    if (metadata?.role !== "student") {
      await supabase.auth.signOut();
      toast.error("Unauthorized. This portal is for students.");
      setLoading(false);
      return;
    }

    // 3️⃣ Activation check
    const { data: student, error: studentError } = await supabase
      .from("students")
      .select("is_active")
      .eq("email", email)
      .single();

    if (studentError || !student) {
      await supabase.auth.signOut();
      toast.error("Student record not found");
      setLoading(false);
      return;
    }

    if (!student.is_active) {
      await supabase.auth.signOut();
      toast.error("Account not activated. Check your email.");
      setLoading(false);
      return;
    }

    // 4️⃣ Success
    toast.success("Login successful");
    router.push("/student/");
  }

  async function handleForgotPassword(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    
    if (!resetEmail) {
      toast.error("Please enter your email address");
      return;
    }

    try {
      setResettingPassword(true);
      
      // Call the API to send reset email
      const response = await fetch('/api/student/reset-password', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email: resetEmail }),
      });

      const data = await response.json();

      if (!response.ok) {
        toast.error(data.error || "Failed to send reset email");
        return;
      }

      toast.success("Password reset email sent! Check your inbox.");
      setShowForgotPassword(false);
      setResetEmail("");
    } catch (error: any) {
      console.error("Error:", error);
      toast.error("Failed to send reset email");
    } finally {
      setResettingPassword(false);
    }
  }

  return (
    <div className="relative min-h-screen overflow-hidden">
      {/* Animated gradient background */}
      <div className="absolute inset-0 bg-gradient-to-br from-emerald-600 via-teal-600 to-cyan-600 opacity-90" />
      <div className="absolute -top-40 -right-40 w-80 h-80 bg-emerald-400 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob" />
      <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-teal-400 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-2000" />
      
      {/* Content */}
      <div className="relative flex items-center justify-center min-h-screen p-4">
        <Card className="w-full max-w-md shadow-2xl border-0 bg-white/95 backdrop-blur-sm">
          {/* Header with icon */}
          <CardHeader className="text-center pb-6">
            <div className="flex justify-center mb-4">
              <div className="p-3 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl">
                <BookOpen className="w-8 h-8 text-white" />
              </div>
            </div>
            <CardTitle className="text-3xl font-bold bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent">
              Student Portal
            </CardTitle>
            <p className="text-gray-600 text-sm mt-3 font-medium">
              Welcome back! Sign in to your account
            </p>
          </CardHeader>

          <CardContent>
            <form onSubmit={handleLogin} className="space-y-5">
              {/* Email field */}
              <div className="space-y-2">
                <label className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                  <Mail className="w-4 h-4 text-gray-500" />
                  Email Address
                </label>
                <Input
                  name="email"
                  type="email"
                  placeholder="you@example.com"
                  required
                  className="px-4 py-2.5 border-gray-300 focus:border-emerald-500 focus:ring-emerald-500"
                />
              </div>

              {/* Password field */}
              <div className="space-y-2">
                <label className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                  <Lock className="w-4 h-4 text-gray-500" />
                  Password
                </label>
                <div className="relative">
                  <Input
                    name="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    required
                    className="px-4 py-2.5 pr-10 border-gray-300 focus:border-emerald-500 focus:ring-emerald-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                  >
                    {showPassword ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              {/* Forgot Password Link */}
              <div className="text-right">
                <button
                  type="button"
                  onClick={() => setShowForgotPassword(true)}
                  className="text-sm text-emerald-600 hover:text-emerald-700 font-medium transition-colors"
                >
                  Forgot password?
                </button>
              </div>

              {/* Submit button */}
              <Button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-semibold rounded-lg transition-all duration-200 shadow-lg hover:shadow-xl disabled:opacity-70"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Signing in...
                  </>
                ) : (
                  "Sign In"
                )}
              </Button>
            </form>

            {/* Footer */}
            <div className="mt-6 space-y-6 border-t pt-6">
              <div className="text-center">
                <p className="text-sm text-gray-600">
                  Having trouble? Contact your administrator
                </p>
              </div>

              {/* Portal Switcher */}
              <PortalSwitcher currentPortal="student" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Forgot Password Modal */}
      {showForgotPassword && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <Card className="w-full max-w-sm shadow-2xl border-0 bg-white">
            <div className="flex items-center justify-between p-6 border-b">
              <h2 className="text-xl font-bold text-gray-900">Reset Password</h2>
              <button
                onClick={() => {
                  setShowForgotPassword(false);
                  setResetEmail("");
                }}
                className="text-gray-500 hover:text-gray-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <CardContent className="pt-6">
              <form onSubmit={handleForgotPassword} className="space-y-4">
                <p className="text-sm text-gray-600 mb-4">
                  Enter your email address and we'll send you a link to reset your password.
                </p>

                <div className="space-y-2">
                  <label className="text-sm font-semibold text-gray-700">Email Address</label>
                  <Input
                    type="email"
                    placeholder="you@example.com"
                    value={resetEmail}
                    onChange={(e) => setResetEmail(e.target.value)}
                    required
                    className="px-4 py-2.5 border-gray-300 focus:border-emerald-500 focus:ring-emerald-500"
                  />
                </div>

                <div className="pt-4 flex gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setShowForgotPassword(false);
                      setResetEmail("");
                    }}
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={resettingPassword}
                    className="flex-1 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white"
                  >
                    {resettingPassword ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Sending...
                      </>
                    ) : (
                      "Send Reset Link"
                    )}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Add animations to globals or create them in the component */}
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
      `}</style>
    </div>
  );
}
