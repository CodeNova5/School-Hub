"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  ShieldAlert,
  ArrowLeft,
  Lock,
  Home,
  AlertTriangle,
} from "lucide-react";
import { Suspense } from "react";

function getPermissionDisplay(permission: string | null): {
  title: string;
  description: string;
} {
  if (!permission) {
    return {
      title: "Access Restricted",
      description: "You don't have permission to access this page.",
    };
  }

  const [namespace, action] = permission.split(":");
  const name = namespace
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());

  if (action === "write") {
    return {
      title: `${name} — Management Access Required`,
      description: `You need management-level access (write permission) to ${namespace.replace(/_/g, " ")} features. Contact your school admin to request this permission.`,
    };
  }

  return {
    title: `${name} — View Access Required`,
    description: `You need view access to the ${namespace.replace(/_/g, " ")} module. Contact your school admin to request this permission.`,
  };
}

function NoAccessContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const permission = searchParams.get("permission");
  const { title, description } = getPermissionDisplay(permission);

  return (
    <DashboardLayout role="admin">
      <div className="flex items-center justify-center min-h-[80vh]">
        <div className="w-full max-w-lg mx-auto">
          <Card className="border-0 shadow-xl overflow-hidden">
            {/* Top accent bar */}
            <div className="h-2 bg-gradient-to-r from-amber-500 via-orange-500 to-red-500" />

            <div className="p-8 sm:p-10 text-center">
              {/* Icon */}
              <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-amber-50 to-red-50 shadow-inner">
                <div className="relative">
                  <ShieldAlert className="h-10 w-10 text-amber-600" />
                  <Lock className="h-4 w-4 text-red-500 absolute -bottom-1 -right-1" />
                </div>
              </div>

              {/* Title */}
              <h1 className="text-2xl font-bold text-slate-900 mb-3">
                {title}
              </h1>

              {/* Description */}
              <p className="text-sm text-slate-600 leading-relaxed mb-8 max-w-sm mx-auto">
                {description}
              </p>

              {/* Permission badge */}
              {permission && (
                <div className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-4 py-2 mb-8">
                  <AlertTriangle className="h-4 w-4 text-amber-500" />
                  <code className="text-sm font-mono font-semibold text-slate-700">
                    {permission}
                  </code>
                </div>
              )}

              {/* Actions */}
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                <Button
                  variant="outline"
                  className="w-full sm:w-auto gap-2"
                  onClick={() => router.push("/admin")}
                >
                  <Home className="h-4 w-4" />
                  Dashboard
                </Button>
                <Button
                  variant="default"
                  className="w-full sm:w-auto gap-2 bg-slate-900 hover:bg-slate-800"
                  onClick={() => router.back()}
                >
                  <ArrowLeft className="h-4 w-4" />
                  Go Back
                </Button>
              </div>
            </div>

            {/* Footer */}
            <div className="border-t border-slate-100 bg-slate-50/50 px-8 py-4">
              <p className="text-xs text-slate-500 text-center">
                Need a different set of permissions? Contact your school
                administrator to update your role.
              </p>
            </div>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}

export default function NoAccessPage() {
  return (
    <Suspense
      fallback={
        <DashboardLayout role="admin">
          <div className="flex items-center justify-center min-h-[80vh]">
            <p className="text-sm text-slate-500">Loading...</p>
          </div>
        </DashboardLayout>
      }
    >
      <NoAccessContent />
    </Suspense>
  );
}
