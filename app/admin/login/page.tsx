"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import { PortalSwitcher } from "@/components/portal-switcher";
import { Lock, Mail, Eye, EyeOff, Shield, Loader2 } from "lucide-react";

export default function AdminLoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClientComponentClient();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [loading, setLoading] = useState(false);

  const redirectedFrom = searchParams.get("redirectedFrom") ?? "/admin";
  const errorParam = searchParams.get("error");

  // Display error from query params on page load
  useEffect(() => {
    if (errorParam === "unauthorized") {
      setErrorMsg("Your account is not authorized for admin access.");
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

    // Check if user is an admin
    const { data: canAccess, error: rpcError } = await supabase.rpc("can_access_admin");
    
    console.log("can_access_admin result:", { canAccess, rpcError });
    
    if (!canAccess) {
      setErrorMsg("Your account is not authorized for admin access.");
      await supabase.auth.signOut();
      setLoading(false);
      return;
    }

    // Wait for session to be properly stored before redirecting
    // This ensures the middleware can read the session cookie
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Force reload so middleware sees session cookie
    window.location.href = redirectedFrom;
  }

  return (
    <div className="relative min-h-screen overflow-hidden">
      {/* Animated gradient background */}
      <div className="absolute inset-0 bg-gradient-to-br from-red-600 via-orange-600 to-amber-600 opacity-90" />
      <div className="absolute -top-40 -right-40 w-80 h-80 bg-red-400 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob" />
      <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-orange-400 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-2000" />
      
      {/* Content */}
      <div className="relative flex items-center justify-center min-h-screen p-4">
        <Card className="w-full max-w-md shadow-2xl border-0 bg-white/95 backdrop-blur-sm">
          {/* Header with icon */}
          <CardHeader className="text-center pb-6">
            <div className="flex justify-center mb-4">
              <div className="p-3 bg-gradient-to-br from-red-500 to-orange-600 rounded-2xl">
                <Shield className="w-8 h-8 text-white" />
              </div>
            </div>
            <CardTitle className="text-3xl font-bold bg-gradient-to-r from-red-600 to-orange-600 bg-clip-text text-transparent">
              Admin Portal
            </CardTitle>
            <p className="text-gray-600 text-sm mt-3 font-medium">
              Administrator access to school management
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
                  type="email"
                  placeholder="admin@school.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={loading}
                  className="px-4 py-2.5 border-gray-300 focus:border-red-500 focus:ring-red-500"
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
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    disabled={loading}
                    className="px-4 py-2.5 pr-10 border-gray-300 focus:border-red-500 focus:ring-red-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    disabled={loading}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 disabled:opacity-50"
                  >
                    {showPassword ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              {errorMsg && (
                <div className="p-3 rounded-lg bg-red-50 border border-red-200">
                  <p className="text-sm text-red-600">{errorMsg}</p>
                </div>
              )}

              {/* Submit button */}
              <Button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-700 hover:to-orange-700 text-white font-semibold rounded-lg transition-all duration-200 shadow-lg hover:shadow-xl disabled:opacity-70"
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
                  Restricted access. Contact system administrator if you have issues.
                </p>
              </div>

              {/* Portal Switcher */}
              <PortalSwitcher currentPortal="admin" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Add animations */}
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
