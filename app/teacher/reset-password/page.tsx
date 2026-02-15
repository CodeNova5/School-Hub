// =============================
// /teacher/reset-password/page.tsx
// =============================
"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Lock, Eye, EyeOff, CheckCircle, Loader2, ArrowLeft, AlertCircle } from "lucide-react";
import crypto from "crypto";

export default function ResetPasswordPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [tokenLoading, setTokenLoading] = useState(true);
  const [isTokenValid, setIsTokenValid] = useState(false);
  const [resetSuccess, setResetSuccess] = useState(false);
  const [teacherId, setTeacherId] = useState<string | null>(null);

  useEffect(() => {
    validateToken();
  }, []);

  async function validateToken() {
    try {
      if (!token) {
        toast.error("Invalid or missing reset token");
        setTimeout(() => router.push("/teacher/login"), 2000);
        setTokenLoading(false);
        return;
      }

      // Hash the token to match what's stored in the database
      const tokenHash = crypto
        .createHash("sha256")
        .update(token)
        .digest("hex");

      // Verify token in database
      const { data: teacher, error } = await supabase
        .from("teachers")
        .select("id, activation_token_hash, activation_expires_at, activation_used")
        .eq("activation_token_hash", tokenHash)
        .maybeSingle();

      if (error) {
        console.error("Token validation error:", error);
        toast.error("Failed to validate reset token. Please try again.");
        setTimeout(() => router.push("/teacher/login"), 2000);
        setTokenLoading(false);
        return;
      }

      if (!teacher) {
        console.warn("No teacher found with token hash:", tokenHash.substring(0, 8) + "...");
        toast.error("Invalid or expired reset token");
        setTimeout(() => router.push("/teacher/login"), 2000);
        setTokenLoading(false);
        return;
      }

      // Check if token has expired
      const expirationTime = new Date(teacher.activation_expires_at);
      if (new Date() > expirationTime) {
        toast.error("Reset token has expired");
        setTimeout(() => router.push("/teacher/login"), 2000);
        setTokenLoading(false);
        return;
      }

      // Check if token was already used
      if (teacher.activation_used) {
        toast.error("This reset token has already been used");
        setTimeout(() => router.push("/teacher/login"), 2000);
        setTokenLoading(false);
        return;
      }

      setTeacherId(teacher.id);
      setIsTokenValid(true);
    } catch (error) {
      console.error("Error validating token:", error);
      toast.error("Failed to validate reset token");
      setTimeout(() => router.push("/teacher/login"), 2000);
    } finally {
      setTokenLoading(false);
    }
  }

  async function handleResetPassword(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    // Validation
    if (!password || !confirmPassword) {
      toast.error("Please fill in all fields");
      return;
    }

    if (password.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }

    if (password !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }

    try {
      setLoading(true);

      // Get the teacher's user_id to reset their password
      const { data: teacherData, error: fetchError } = await supabase
        .from("teachers")
        .select("user_id")
        .eq("id", teacherId)
        .single();

      if (fetchError || !teacherData) {
        toast.error("Failed to find teacher information");
        return;
      }

      // Update password using admin API
      const response = await fetch("/api/teacher/update-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: teacherData.user_id,
          newPassword: password,
          token: token,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        toast.error(result.error || "Failed to update password");
        return;
      }

      toast.success("Password updated successfully!");
      setResetSuccess(true);

      // Redirect to login after 2 seconds
      setTimeout(() => {
        router.push("/teacher/login");
      }, 2000);
    } catch (error: any) {
      console.error("Error updating password:", error);
      toast.error("Failed to update password");
    } finally {
      setLoading(false);
    }
  }

  if (tokenLoading) {
    return (
      <div className="relative min-h-screen overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-600 via-purple-600 to-pink-600 opacity-90" />
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-blue-400 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-purple-400 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-2000" />

        <div className="relative flex items-center justify-center min-h-screen p-4">
          <div className="text-center">
            <Loader2 className="w-12 h-12 animate-spin text-white mx-auto mb-4" />
            <p className="text-white text-lg font-medium">Verifying reset link...</p>
          </div>
        </div>

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

  if (resetSuccess) {
    return (
      <div className="relative min-h-screen overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-600 via-purple-600 to-pink-600 opacity-90" />
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-blue-400 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-purple-400 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-2000" />

        <div className="relative flex items-center justify-center min-h-screen p-4">
          <Card className="w-full max-w-md shadow-2xl border-0 bg-white/95 backdrop-blur-sm">
            <CardContent className="pt-8 text-center">
              <div className="mb-4 flex justify-center">
                <div className="p-3 bg-gradient-to-br from-green-400 to-emerald-500 rounded-full">
                  <CheckCircle className="w-12 h-12 text-white" />
                </div>
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                Password Updated!
              </h2>
              <p className="text-gray-600 mb-6">
                Your password has been successfully reset. You'll be redirected to the login page shortly.
              </p>
              <Button
                onClick={() => router.push("/teacher/login")}
                className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Login
              </Button>
            </CardContent>
          </Card>
        </div>

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

  if (!isTokenValid) {
    return (
      <div className="relative min-h-screen overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-600 via-purple-600 to-pink-600 opacity-90" />
        <div className="relative flex items-center justify-center min-h-screen p-4">
          <Card className="w-full max-w-md shadow-2xl border-0 bg-white/95 backdrop-blur-sm">
            <CardContent className="pt-8 text-center">
              <div className="mb-4 flex justify-center">
                <div className="p-3 bg-gradient-to-br from-red-400 to-red-500 rounded-full">
                  <AlertCircle className="w-12 h-12 text-white" />
                </div>
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                Invalid Reset Link
              </h2>
              <p className="text-gray-600 mb-6">
                The reset link is invalid or has expired. Please request a new one.
              </p>
              <Button
                onClick={() => router.push("/teacher/login")}
                className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Login
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen overflow-hidden">
      {/* Animated gradient background */}
      <div className="absolute inset-0 bg-gradient-to-br from-blue-600 via-purple-600 to-pink-600 opacity-90" />
      <div className="absolute -top-40 -right-40 w-80 h-80 bg-blue-400 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob" />
      <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-purple-400 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-2000" />

      {/* Content */}
      <div className="relative flex items-center justify-center min-h-screen p-4">
        <Card className="w-full max-w-md shadow-2xl border-0 bg-white/95 backdrop-blur-sm">
          {/* Header */}
          <CardHeader className="text-center pb-6">
            <div className="flex justify-center mb-4">
              <div className="p-3 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl">
                <Lock className="w-8 h-8 text-white" />
              </div>
            </div>
            <CardTitle className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              Reset Password
            </CardTitle>
            <p className="text-gray-600 text-sm mt-3 font-medium">
              Create a new secure password
            </p>
          </CardHeader>

          <CardContent>
            <form onSubmit={handleResetPassword} className="space-y-5">
              {/* New Password field */}
              <div className="space-y-2">
                <label className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                  <Lock className="w-4 h-4 text-gray-500" />
                  New Password
                </label>
                <div className="relative">
                  <Input
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="px-4 py-2.5 pr-10 border-gray-300 focus:border-blue-500 focus:ring-blue-500"
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
                <p className="text-xs text-gray-500 mt-1">
                  Minimum 6 characters
                </p>
              </div>

              {/* Confirm Password field */}
              <div className="space-y-2">
                <label className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                  <Lock className="w-4 h-4 text-gray-500" />
                  Confirm Password
                </label>
                <div className="relative">
                  <Input
                    type={showConfirmPassword ? "text" : "password"}
                    placeholder="••••••••"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    className="px-4 py-2.5 pr-10 border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                  >
                    {showConfirmPassword ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              {/* Password strength indicator */}
              {password && (
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-xs">
                    <div
                      className={`h-1 flex-1 rounded-full ${
                        password.length >= 6 ? "bg-green-500" : "bg-gray-300"
                      }`}
                    />
                    <span className={password.length >= 6 ? "text-green-600" : "text-gray-500"}>
                      {password.length >= 6 ? "Strong" : "Weak"}
                    </span>
                  </div>
                </div>
              )}

              {/* Submit button */}
              <Button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-semibold rounded-lg transition-all duration-200 shadow-lg hover:shadow-xl disabled:opacity-70"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Updating...
                  </>
                ) : (
                  "Update Password"
                )}
              </Button>

              {/* Back to login link */}
              <Button
                type="button"
                variant="outline"
                onClick={() => router.push("/teacher/login")}
                className="w-full text-gray-700 border-gray-300 hover:bg-gray-50"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Login
              </Button>
            </form>

            {/* Security notice */}
            <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
              <p className="text-xs text-blue-700 font-medium">
                💡 For security, make sure to use a strong password with a mix of letters, numbers, and symbols.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Animations */}
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
