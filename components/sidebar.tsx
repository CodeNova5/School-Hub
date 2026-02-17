"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  CalendarDays,
  Users,
  BookOpen,
  GraduationCap,
  Calendar,
  FileText,
  Settings,
  ClipboardList,
  School,
  ChevronLeft,
  History,
  ChevronRight,
  TrendingUp
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { X, Menu } from 'lucide-react';

interface NavItem {
  href: string;
  label: string;
  icon: React.ReactNode;
}

interface SidebarProps {
  role: 'admin' | 'teacher' | 'student' | 'parent';
}

export function Sidebar({ role }: SidebarProps) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [hasAssignedClasses, setHasAssignedClasses] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  useEffect(() => {
    if (role === 'teacher') {
      checkTeacherClasses();
    }
  }, [role]);

  async function checkTeacherClasses() {
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) return;

      const { data: teacherData, error: teacherError } = await supabase
        .from('teachers')
        .select('id')
        .eq('user_id', user.id)
        .single();

      if (teacherError || !teacherData?.id) return;

      const { data: classes, error: classesError } = await supabase
        .from('classes')
        .select('id')
        .eq('class_teacher_id', teacherData.id)
        .limit(1);

      if (!classesError && classes && classes.length > 0) {
        setHasAssignedClasses(true);
      }
    } catch (error) {
      console.error("Error checking teacher classes:", error);
    }
  }

  const adminNav: NavItem[] = [
    { href: '/admin', label: 'Dashboard', icon: <LayoutDashboard className="h-5 w-5" /> },
    { href: '/admin/manage-admins', label: 'Manage Admins', icon: <Users className="h-5 w-5" /> },
    { href: '/admin/sessions', label: 'Sessions & Terms', icon: <Calendar className="h-5 w-5" /> },
    { href: '/admin/classes', label: 'Classes', icon: <School className="h-5 w-5" /> },
    { href: '/admin/subjects', label: 'Subjects', icon: <BookOpen className="h-5 w-5" /> },
    { href: '/admin/timetable', label: 'Timetable', icon: <FileText className="h-5 w-5" /> },
    { href: '/admin/students', label: 'Students', icon: <Users className="h-5 w-5" /> },
    { href: '/admin/teachers', label: 'Teachers', icon: <GraduationCap className="h-5 w-5" /> },
    { href: '/admin/history', label: 'History', icon: <History className="h-5 w-5" /> },
    { href: '/admin/promotions', label: 'Promotions', icon: <TrendingUp className="h-5 w-5" /> },
    { href: '/admin/admissions', label: 'Admissions', icon: <ClipboardList className="h-5 w-5" /> },
    { href: '/admin/calendar', label: 'Calendar', icon: <Calendar className="h-5 w-5" /> },
    { href: '/admin/settings', label: 'Settings', icon: <Settings className="h-5 w-5" /> },

  ];

  const teacherNav: NavItem[] = [
    { href: '/teacher', label: 'Dashboard', icon: <LayoutDashboard className="h-5 w-5" /> },
    ...(hasAssignedClasses ? [{ href: '/teacher/classes', label: 'Class', icon: <School className="h-5 w-5" /> }] : []),
    { href: '/teacher/students', label: 'Students', icon: <Users className="h-5 w-5" /> },
    { href: '/teacher/subjects', label: 'Subjects', icon: <BookOpen className="h-5 w-5" /> },
    { href: '/teacher/results', label: 'Results', icon: <GraduationCap className="h-5 w-5" /> },
    { href: '/teacher/assignments', label: 'Assignments', icon: <FileText className="h-5 w-5" /> },
    { href: '/teacher/timetable', label: 'Timetable', icon: <CalendarDays className="h-5 w-5" /> },
    { href: '/teacher/calendar', label: 'Calendar', icon: <Calendar className="h-5 w-5" /> },
    { href: '/teacher/settings', label: 'Settings', icon: <Settings className="h-5 w-5" /> },
  ];
 
  const studentNav: NavItem[] = [
    { href: '/student', label: 'Dashboard', icon: <LayoutDashboard className="h-5 w-5" /> },
    { href: '/student/timetable', label: 'Timetable', icon: <Calendar className="h-5 w-5" /> },
    { href: '/student/subjects', label: 'Subjects', icon: <BookOpen className="h-5 w-5" /> },
    { href: '/student/results', label: 'Results', icon: <GraduationCap className="h-5 w-5" /> },
    { href: '/student/assignments', label: 'Assignments', icon: <FileText className="h-5 w-5" /> },
    { href: '/student/attendance', label: 'Attendance', icon: <ClipboardList className="h-5 w-5" /> },
    { href: '/student/calendar', label: 'Calendar', icon: <Calendar className="h-5 w-5" /> },
    { href: '/student/settings', label: 'Settings', icon: <Settings className="h-5 w-5" /> },
  ];

  const parentNav: NavItem[] = [
    { href: '/parent/dashboard', label: 'Dashboard', icon: <LayoutDashboard className="h-5 w-5" /> },
    { href: '/parent/children', label: 'My Children', icon: <Users className="h-5 w-5" /> },
    { href: '/parent/calendar', label: 'Calendar', icon: <Calendar className="h-5 w-5" /> },
    { href: '/parent/settings', label: 'Settings', icon: <Settings className="h-5 w-5" /> },
  ];

  const navItems = 
    role === 'admin' ? adminNav : 
    role === 'teacher' ? teacherNav : 
    role === 'parent' ? parentNav :
    studentNav;

  return (
    <TooltipProvider>
      {/* Mobile Menu Button */}
      <button
        onClick={() => setIsMobileOpen(!isMobileOpen)}
        className="fixed top-16 left-4 z-50 md:hidden bg-white p-2 rounded-lg shadow-lg border border-slate-200"
      >
        {isMobileOpen ? (
          <X className="h-6 w-6" />
        ) : (
          <Menu className="h-6 w-6" />
        )}
      </button>

      {/* Mobile Overlay */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 z-30 bg-black opacity-50 md:hidden"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      <aside
        className={cn(
          "fixed left-0 top-0 z-40 h-screen transition-all duration-300 ease-in-out",
          "bg-white",
          "border-r border-slate-200 shadow-lg",
          "md:translate-x-0",
          isMobileOpen ? "translate-x-0" : "-translate-x-full",
          collapsed ? "w-20" : "w-64"
        )}
      >
        <div className="flex h-full flex-col">
          {/* Header */}
          <div className="flex h-16 items-center justify-between border-b border-slate-200 px-4 gap-2">
            {!collapsed && (
              <div className="flex items-center gap-3 min-w-0">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 shadow-md flex-shrink-0">
                  <School className="h-6 w-6 text-white" />
                </div>
                <div className="hidden sm:block min-w-0">
                  <span className="block font-bold text-slate-900 text-sm truncate">School MS</span>
                  <span className="block text-xs text-slate-500 truncate">Management</span>
                </div>
              </div>
            )}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setCollapsed(!collapsed)}
                  className={cn(
                    "h-9 w-9 rounded-lg transition-all duration-200 hidden md:flex",
                    "hover:bg-slate-100 text-slate-600 hover:text-slate-900"
                  )}
                >
                  {collapsed ? (
                    <ChevronRight className="h-5 w-5" />
                  ) : (
                    <ChevronLeft className="h-5 w-5" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right" className="text-xs">
                {collapsed ? 'Expand' : 'Collapse'}
              </TooltipContent>
            </Tooltip>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsMobileOpen(false)}
              className={cn(
                "h-9 w-9 rounded-lg transition-all duration-200 md:hidden",
                "hover:bg-slate-100 text-slate-600 hover:text-slate-900"
              )}
            >
              <X className="h-5 w-5" />
            </Button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 overflow-y-auto px-3 py-6">
            <ul className="space-y-1">
              {navItems.map((item) => {
                const isActive = pathname === item.href;
                return (
                  <li key={item.href}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Link
                          href={item.href}
                          onClick={() => setIsMobileOpen(false)}
                          className={cn(
                            "group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200",
                            "relative overflow-hidden",
                            isActive
                              ? "bg-gradient-to-r from-blue-600 to-blue-500 text-white shadow-lg shadow-blue-500/30"
                              : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                          )}
                        >
                          {isActive && (
                            <div className="absolute inset-y-0 left-0 w-1 bg-gradient-to-b from-blue-300 to-blue-500" />
                          )}
                          <span className={cn(
                            "flex h-5 w-5 items-center justify-center transition-transform duration-200 flex-shrink-0",
                            "group-hover:scale-110",
                            isActive ? "scale-110" : ""
                          )}>
                            {item.icon}
                          </span>
                          {!collapsed && <span className="truncate">{item.label}</span>}
                          {!collapsed && isActive && (
                            <div className="ml-auto h-1.5 w-1.5 rounded-full bg-white opacity-75 flex-shrink-0" />
                          )}
                        </Link>
                      </TooltipTrigger>
                      {collapsed && (
                        <TooltipContent side="right" className="text-xs font-medium">
                          {item.label}
                        </TooltipContent>
                      )}
                    </Tooltip>
                  </li>
                );
              })}
            </ul>
          </nav>

          {/* Footer spacer */}
          <div className="border-t border-slate-200 p-4">
            {!collapsed && (
              <p className="text-xs text-slate-500 text-center">School Hub v1.0</p>
            )}
          </div>
        </div>
      </aside>
    </TooltipProvider>
  );
}
