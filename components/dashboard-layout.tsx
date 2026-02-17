"use client";

import { Sidebar } from "./sidebar";
import { ReactNode, useState } from "react";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";

interface DashboardLayoutProps {
  children: ReactNode;
  role: "admin" | "teacher" | "student" | "parent";
}

export function DashboardLayout({ children, role }: DashboardLayoutProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar */}
      <Sidebar
        role={role}
        collapsed={collapsed}
        setCollapsed={setCollapsed}
        mobileOpen={mobileOpen}
        setMobileOpen={setMobileOpen}
      />

      {/* Main Section */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <header className="md:hidden h-16 bg-white border-b border-slate-200 flex items-center justify-between px-4">
          <div className="flex items-center gap-4">
            {/* Mobile Toggle */}
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden"
              onClick={() => setMobileOpen(true)}
            >
              <Menu className="h-6 w-6" />
            </Button>

            {/* School Name */}
            <div>
              <h1 className="text-sm font-bold text-slate-900">
                School MS
              </h1>
              <p className="text-xs text-slate-500">
                Management System
              </p>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main
          className={`
    min-h-screen p-4 sm:p-6 md:p-8 transition-all duration-300
    ${collapsed ? "md:ml-20" : "md:ml-64"}
  `}
        >
          {children}
        </main>

      </div>
    </div>
  );
}
