"use client";

import { Sidebar } from './sidebar';
import { ReactNode } from 'react';

interface DashboardLayoutProps {
  children: ReactNode;
  role: 'admin' | 'teacher';
}

export function DashboardLayout({ children, role }: DashboardLayoutProps) {
  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar role={role} />
      <main className="flex-1 p-8">
        {children}
      </main>
    </div>

  );
}
