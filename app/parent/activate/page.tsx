"use client";

export const dynamic = "force-dynamic";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Eye, EyeOff, Loader2 } from "lucide-react";

export default function ParentActivatePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isValidating, setIsValidating] = useState(true);
  const [parentInfo, setParentInfo] = useState<{
    name: string;
    email: string;
    students: Array<{ first_name: string; last_name: string; student_id: string }>;
  } | null>(null);

  useEffect(() => {
    if (!token) {
      toast.error("Invalid activation link");
      router.push("/parent/login");
      return;
    }

    validateToken();
  }, [token]);

  async function validateToken() {
    try {
      const response = await fetch("/api/parent/validate-activation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });

      const result = await response.json();

      if (!response.ok) {
        toast.error(result.error || "Invalid or expired activation link");
        setTimeout(() => router.push("/parent/login"), 2000);
        return;
      }

      setParentInfo(result.parent);
    } catch (error: any) {
      toast.error("Failed to validate activation link");
      setTimeout(() => router.push("/parent/login"), 2000);
    } finally {
      setIsValidating(false);
    }
  }

  async function handleActivate(e: React.FormEvent) {
    e.preventDefault();

    if (password.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }

    if (password !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch("/api/parent/activate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });

      const result = await response.json();

      if (!response.ok) {
        toast.error(result.error || "Failed to activate account");
        return;
      }

      toast.success("Account activated successfully! Redirecting to login...");
      setTimeout(() => router.push("/parent/login"), 2000);
    } catch (error: any) {
      toast.error(error.message || "Failed to activate account");
    } finally {
      setIsLoading(false);
    }
  }

  if (isValidating) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="flex flex-col items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-blue-600 mb-4" />
              <p className="text-gray-600">Validating activation link...</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!parentInfo) {
    return null;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Activate Parent Account</CardTitle>
          <CardDescription>
            Welcome, <strong>{parentInfo.name}</strong>! Set your password to access the parent portal.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {parentInfo.students.length > 0 && (
            <div className="mb-6 p-4 bg-blue-50 rounded-lg">
              <p className="text-sm font-medium text-blue-900 mb-2">Your Children:</p>
              <ul className="space-y-1">
                {parentInfo.students.map((student, index) => (
                  <li key={index} className="text-sm text-blue-700">
                    • {student.first_name} {student.last_name} ({student.student_id})
                  </li>
                ))}
              </ul>
            </div>
          )}

          <form onSubmit={handleActivate} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter password"
                  required
                  minLength={8}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <p className="text-xs text-gray-500">Minimum 8 characters</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm Password</Label>
              <div className="relative">
                <Input
                  id="confirmPassword"
                  type={showConfirmPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm password"
                  required
                  minLength={8}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                >
                  {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Activating...
                </>
              ) : (
                "Activate Account"
              )}
            </Button>
          </form>

          <p className="text-xs text-gray-500 text-center mt-4">
            Already have an account?{" "}
            <a href="/parent/login" className="text-blue-600 hover:underline">
              Login here
            </a>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
