
// =============================
// /teacher/login/page.tsx
// =============================
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export default function TeacherLoginPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleLogin(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const email = formData.get("email") as string;
    const password = formData.get("password") as string;

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      toast.error("Invalid login credentials");
      setLoading(false);
      return;
    }

    const role = data.user?.user_metadata?.role;

    if (role !== "teacher") {
      toast.error("Unauthorized access");
      setLoading(false);
      return;
    }

    // Optional: check teacher active status
    const { data: teacher } = await supabase
      .from("teachers")
      .select("is_active")
      .eq("user_id", data.user.id)
      .single();

    if (!teacher?.is_active) {
      toast.error("Account not activated");
      await supabase.auth.signOut();
      setLoading(false);
      return;
    }

    toast.success("Login successful");
    router.push("/teacher");
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50 p-4">
      <Card className="w-full max-w-md shadow-xl">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold">Teacher Login</CardTitle>
          <p className="text-gray-600 text-sm mt-2">
            Enter your email and password
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="text-sm font-medium">Email</label>
              <Input name="email" type="email" required />
            </div>

            <div>
              <label className="text-sm font-medium">Password</label>
              <Input name="password" type="password" required />
            </div>

            <Button type="submit" disabled={loading} className="w-full">
              {loading ? "Logging in..." : "Login"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
