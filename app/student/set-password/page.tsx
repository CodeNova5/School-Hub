"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { toast } from "sonner";

export default function SetPasswordPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    const form = new FormData(e.target as HTMLFormElement);
    const password = form.get("password") as string;

    // 1️⃣ Update password for logged-in magic link user
    const { error } = await supabase.auth.updateUser({ password });

    if (error) {
      toast.error("Failed to set password");
      setLoading(false);
      return;
    }

    toast.success("Password set successfully!");
    router.push("/student/dashboard");
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50 p-4">
      <Card className="w-full max-w-md shadow">
        <CardHeader>
          <CardTitle className="text-xl text-center">Set Your Password</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-sm font-medium">New Password</label>
              <Input name="password" type="password" required minLength={6} />
            </div>

            <Button className="w-full" type="submit" disabled={loading}>
              {loading ? "Saving..." : "Set Password"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
