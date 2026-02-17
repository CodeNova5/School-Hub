"use client";

import { Sidebar } from './sidebar';
import { Header } from './header';
import { ReactNode, useState } from 'react';

interface DashboardLayoutProps {
  children: ReactNode;
  role: 'admin' | 'teacher' | 'student' | 'parent';
  schoolName?: string;
}

export function DashboardLayout({ children, role, schoolName = "School Hub" }: DashboardLayoutProps) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-gray-50">
      <Header 
        onMenuToggle={setIsMobileMenuOpen} 
        isMobileMenuOpen={isMobileMenuOpen}
        schoolName={schoolName}
      />
      <Sidebar 
        role={role} 
        isMobileMenuOpen={isMobileMenuOpen}
        onMobileMenuClose={() => setIsMobileMenuOpen(false)}
      />
      <main className="ml-20 sm:ml-56 md:ml-64 min-h-screen pt-16 md:pt-0 p-3 sm:p-4 md:p-6 lg:p-8 overflow-x-hidden">
        {children}
      </main>
    </div>
  );
}
