"use client";

// =============================
// /teacher/activate/page.tsx
// =============================
export const dynamic = "force-dynamic";

import { useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Loader2, CheckCircle2, AlertCircle, Eye, EyeOff } from "lucide-react";

function TeacherActivateContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [loading, setLoading] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [success, setSuccess] = useState(false);

  const passwordStrength = {
    hasMinLength: password.length >= 6,
    hasUpperCase: /[A-Z]/.test(password),
    hasLowerCase: /[a-z]/.test(password),
    hasNumbers: /[0-9]/.test(password),
    hasSpecial: /[!@#$%^&*]/.test(password),
  };

  const passwordsMatch = password === confirmPassword && password.length > 0;
  const isStrongPassword = Object.values(passwordStrength).filter(Boolean).length >= 3;

  async function handleActivate(e: React.FormEvent) {
    e.preventDefault();

    if (!token) {
      toast.error("Invalid activation link");
      return;
    }

    if (password.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }

    if (!passwordsMatch) {
      toast.error("Passwords do not match");
      return;
    }

    setLoading(true);

    const res = await fetch("/api/teacher/activate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, password }),
    });

    const data = await res.json();

    if (!res.ok) {
      toast.error(data.error || "Activation failed");
      setLoading(false);
      return;
    }

    setSuccess(true);
    toast.success("Account activated successfully");
    
    setTimeout(() => {
      router.push("/teacher/login");
    }, 2000);
  }

  if (!token) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-4">
        <Card className="w-full max-w-md shadow-2xl">
          <CardHeader className="text-center border-b bg-gradient-to-r from-red-50 to-orange-50">
            <AlertCircle className="w-12 h-12 mx-auto text-red-500 mb-3" />
            <CardTitle className="text-xl font-bold text-red-900">
              Invalid Activation Link
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <p className="text-gray-600 text-center mb-4">
              The activation link is missing or invalid. Please check your email for a valid link.
            </p>
            <Button 
              onClick={() => router.push("/teacher/login")} 
              className="w-full bg-slate-900 hover:bg-slate-800"
            >
              Back to Login
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (success) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-4">
        <Card className="w-full max-w-md shadow-2xl">
          <CardHeader className="text-center border-b bg-gradient-to-r from-green-50 to-emerald-50">
            <CheckCircle2 className="w-12 h-12 mx-auto text-green-600 mb-3" />
            <CardTitle className="text-xl font-bold text-green-900">
              Activation Successful!
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6 text-center">
            <p className="text-gray-600 mb-2">
              Your account has been activated successfully.
            </p>
            <p className="text-sm text-gray-500">
              Redirecting to login page...
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-4">
      <Card className="w-full max-w-md shadow-2xl">
        <CardHeader className="text-center border-b bg-gradient-to-r from-blue-50 to-indigo-50">
          <CardTitle className="text-2xl font-bold text-gray-900">
            Activate Your Account
          </CardTitle>
          <p className="text-sm text-gray-600 mt-3">
            Create a secure password to activate your teacher account
          </p>
        </CardHeader>
        <CardContent className="pt-6">
          <form onSubmit={handleActivate} className="space-y-5">
            {/* Password Field */}
            <div>
              <label className="text-sm font-semibold text-gray-700 block mb-2">
                Password
              </label>
              <div className="relative">
                <Input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  className="pr-10"
                  required
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

              {/* Password Strength Indicators */}
              {password.length > 0 && (
                <div className="mt-3 space-y-2">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <div
                        className={`w-2 h-2 rounded-full ${
                          passwordStrength.hasMinLength
                            ? "bg-green-500"
                            : "bg-gray-300"
                        }`}
                      />
                      <span className="text-xs text-gray-600">
                        At least 6 characters
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div
                        className={`w-2 h-2 rounded-full ${
                          passwordStrength.hasUpperCase
                            ? "bg-green-500"
                            : "bg-gray-300"
                        }`}
                      />
                      <span className="text-xs text-gray-600">
                        One uppercase letter
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div
                        className={`w-2 h-2 rounded-full ${
                          passwordStrength.hasLowerCase
                            ? "bg-green-500"
                            : "bg-gray-300"
                        }`}
                      />
                      <span className="text-xs text-gray-600">
                        One lowercase letter
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div
                        className={`w-2 h-2 rounded-full ${
                          passwordStrength.hasNumbers
                            ? "bg-green-500"
                            : "bg-gray-300"
                        }`}
                      />
                      <span className="text-xs text-gray-600">One number</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div
                        className={`w-2 h-2 rounded-full ${
                          passwordStrength.hasSpecial
                            ? "bg-green-500"
                            : "bg-gray-300"
                        }`}
                      />
                      <span className="text-xs text-gray-600">
                        One special character (!@#$%^&*)
                      </span>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <div
                        key={i}
                        className={`h-1 flex-1 rounded-full transition-colors ${
                          i <
                          Object.values(passwordStrength).filter(Boolean).length
                            ? "bg-blue-500"
                            : "bg-gray-200"
                        }`}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Confirm Password Field */}
            <div>
              <label className="text-sm font-semibold text-gray-700 block mb-2">
                Confirm Password
              </label>
              <div className="relative">
                <Input
                  type={showConfirmPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm your password"
                  className="pr-10"
                  required
                />
                <button
                  type="button"
                  onClick={() =>
                    setShowConfirmPassword(!showConfirmPassword)
                  }
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                >
                  {showConfirmPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
              {confirmPassword && !passwordsMatch && (
                <p className="text-xs text-red-600 mt-1">
                  Passwords do not match
                </p>
              )}
              {confirmPassword && passwordsMatch && (
                <p className="text-xs text-green-600 mt-1 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" />
                  Passwords match
                </p>
              )}
            </div>

            {/* Submit Button */}
            <Button
              type="submit"
              disabled={loading || !password || !confirmPassword || !passwordsMatch}
              className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold py-2.5 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Activating Account...
                </>
              ) : (
                "Activate Account"
              )}
            </Button>

            {/* Info Message */}
            <p className="text-xs text-gray-500 text-center mt-4 px-2">
              This link expires in 24 hours. If it expired, request a new reset from your settings.
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

export default function TeacherActivatePage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen">Loading...</div>}>
      <TeacherActivateContent />
    </Suspense>
  );
}

