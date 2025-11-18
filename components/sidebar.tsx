"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  Calendar,
  Users,
  BookOpen,
  GraduationCap,
  FileText,
  Settings,
  ClipboardList,
  School,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useState } from 'react';

interface NavItem {
  href: string;
  label: string;
  icon: React.ReactNode;
}

interface SidebarProps {
  role: 'admin' | 'teacher';
}

export function Sidebar({ role }: SidebarProps) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  const adminNav: NavItem[] = [
    { href: '/admin', label: 'Dashboard', icon: <LayoutDashboard className="h-5 w-5" /> },
    { href: '/admin/sessions', label: 'Sessions & Terms', icon: <Calendar className="h-5 w-5" /> },
    { href: '/admin/classes', label: 'Classes', icon: <School className="h-5 w-5" /> },
    { href: '/admin/subjects', label: 'Subjects', icon: <BookOpen className="h-5 w-5" /> },
    { href: '/admin/students', label: 'Students', icon: <Users className="h-5 w-5" /> },
    { href: '/admin/teachers', label: 'Teachers', icon: <GraduationCap className="h-5 w-5" /> },
    { href: '/admin/admissions', label: 'Admissions', icon: <ClipboardList className="h-5 w-5" /> },
    { href: '/admin/calendar', label: 'Calendar', icon: <Calendar className="h-5 w-5" /> },
    { href: '/admin/settings', label: 'Settings', icon: <Settings className="h-5 w-5" /> },
  ];

  const teacherNav: NavItem[] = [
    { href: '/teacher', label: 'Dashboard', icon: <LayoutDashboard className="h-5 w-5" /> },
    { href: '/teacher/classes', label: 'Classes', icon: <School className="h-5 w-5" /> },
    { href: '/teacher/students', label: 'Students', icon: <Users className="h-5 w-5" /> },
    { href: '/teacher/subjects', label: 'Subjects', icon: <BookOpen className="h-5 w-5" /> },
    { href: '/teacher/assignments', label: 'Assignments', icon: <FileText className="h-5 w-5" /> },
    { href: '/teacher/attendance', label: 'Attendance', icon: <ClipboardList className="h-5 w-5" /> },
    { href: '/teacher/calendar', label: 'Calendar', icon: <Calendar className="h-5 w-5" /> },
    { href: '/teacher/settings', label: 'Settings', icon: <Settings className="h-5 w-5" /> },
  ];

  const navItems = role === 'admin' ? adminNav : teacherNav;

  return (
    <aside
      className={cn(
        "fixed left-0 top-0 z-40 h-screen border-r bg-white transition-all duration-300",
        collapsed ? "w-16" : "w-64"
      )}
    >
      <div className="flex h-full flex-col">
        <div className="flex h-16 items-center justify-between border-b px-4">
          {!collapsed && (
            <div className="flex items-center gap-2">
              <School className="h-6 w-6 text-blue-600" />
              <span className="font-semibold text-lg">School MS</span>
            </div>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setCollapsed(!collapsed)}
            className="ml-auto"
          >
            {collapsed ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <ChevronLeft className="h-4 w-4" />
            )}
          </Button>
        </div>

        <nav className="flex-1 overflow-y-auto p-4">
          <ul className="space-y-2">
            {navItems.map((item) => {
              const isActive = pathname === item.href;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={cn(
                      "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                      isActive
                        ? "bg-blue-50 text-blue-700"
                        : "text-gray-700 hover:bg-gray-100"
                    )}
                  >
                    {item.icon}
                    {!collapsed && <span>{item.label}</span>}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="border-t p-4">
          <div className={cn(
            "flex items-center gap-3",
            collapsed && "justify-center"
          )}>
            <div className="h-8 w-8 rounded-full bg-gray-300 flex items-center justify-center">
              <span className="text-xs font-medium">AD</span>
            </div>
            {!collapsed && (
              <div className="flex-1">
                <p className="text-sm font-medium">Admin User</p>
                <p className="text-xs text-gray-500">{role}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </aside>
  );
}
