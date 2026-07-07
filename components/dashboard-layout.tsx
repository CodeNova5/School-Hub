"use client";

import { Sidebar } from "./sidebar";
import { AppHeader } from "./app-header";
import { ReactNode, useState } from "react";

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
      <div className="flex-1 flex flex-col min-h-screen">
        {/* New AppHeader - visible on all screen sizes */}
        <AppHeader
          role={role}
          onMenuToggle={() => setMobileOpen(true)}
        />

        {/* Page Content */}
        <main
          className={`
             flex-1 p-4 sm:p-6 md:p-8 transition-all duration-300
               ${collapsed ? "md:ml-20" : "md:ml-64"}
               `}
        >
          {children}
        </main>

      </div>
    </div>
  );
}
