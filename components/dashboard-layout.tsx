"use client";

import { Sidebar } from './sidebar';
import { ReactNode } from 'react';

interface DashboardLayoutProps {
  children: ReactNode;
  role: 'admin' | 'teacher' | 'student' | 'parent';
}

export function DashboardLayout({ children, role }: DashboardLayoutProps) {
  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar role={role} />
      <main className="ml-20 sm:ml-56 md:ml-64 min-h-screen p-3 sm:p-4 md:p-6 lg:p-8 overflow-x-hidden">
        {children}
      </main>
    </div>
  );
}
