"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

export default function StudentLoginPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
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
    router.push("/student/dashboard");
  }


  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50 p-4">
      <Card className="w-full max-w-md shadow-xl">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold">Student Login</CardTitle>
          <p className="text-gray-600 text-sm mt-2">Enter your email and password</p>
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

          <p className="text-center text-sm text-gray-600 mt-4">
            Forgot password?{" "}
            <a href="/reset-password" className="text-blue-600 hover:underline">
              Reset here
            </a>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
