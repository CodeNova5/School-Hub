"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClientComponentClient();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [loading, setLoading] = useState(false);

  const redirectedFrom = searchParams.get("redirectedFrom") ?? "/admin";

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

    const { data: canAccess } = await supabase.rpc("can_access_admin");

    if (!canAccess) {
      setErrorMsg("Your account is not authorized for admin access.");
      await supabase.auth.signOut();
      return;
    }


    router.push(redirectedFrom);
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <form
        onSubmit={handleLogin}
        className="w-full max-w-md space-y-4 rounded-lg border bg-white p-8 shadow-sm"
      >
        <div className="space-y-1">
          <h1 className="text-2xl font-bold">Admin Login</h1>
          <p className="text-sm text-gray-500">
            Sign in with your administrator credentials to access the dashboard.
          </p>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-700" htmlFor="email">
            Email
          </label>
          <Input
            id="email"
            type="email"
            placeholder="you@school.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            disabled={loading}
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-700" htmlFor="password">
            Password
          </label>
          <Input
            id="password"
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            disabled={loading}
          />
        </div>

        {errorMsg && (
          <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">
            {errorMsg}
          </p>
        )}

        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? "Signing in..." : "Sign in"}
        </Button>
      </form>
    </div>
  );
}
