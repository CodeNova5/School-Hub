"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
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
  IdCard,
  History,
  TrendingUp,
  Wallet,
  X,
  Bell,
  Clock,
  Sparkles,
  Layers,
  QrCode,
  ChevronLeft,

} from "lucide-react";
// import periods time icon from lucide-react (if available) or use a suitable alternative

import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

interface NavItem {
  href: string;
  label: string;
  icon: React.ReactNode;
}

interface SidebarProps {
  role: "admin" | "teacher" | "student" | "parent";
  collapsed: boolean;
  setCollapsed: (val: boolean) => void;
  mobileOpen: boolean;
  setMobileOpen: (val: boolean) => void;
}

export function Sidebar({
  role,
  collapsed,
  setCollapsed,
  mobileOpen,
  setMobileOpen,
}: SidebarProps) {
  const pathname = usePathname();
  const [hasAssignedClasses, setHasAssignedClasses] = useState(false);

  useEffect(() => {
    if (role === "teacher") {
      checkTeacherClasses();
    }
  }, [role]);

  async function checkTeacherClasses() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: teacherData } = await supabase
        .from("teachers")
        .select("id")
        .eq("user_id", user.id)
        .single();

      if (!teacherData?.id) return;

      const { data: classes } = await supabase
        .from("classes")
        .select("id")
        .eq("class_teacher_id", teacherData.id)
        .limit(1);

      if (classes && classes.length > 0) {
        setHasAssignedClasses(true);
      }
    } catch (error) {
      console.error("Error checking teacher classes:", error);
    }
  }

  /* ---------------- NAV CONFIG ---------------- */

  const adminNav: NavItem[] = [
    { href: "/admin", label: "Dashboard", icon: <LayoutDashboard className="h-5 w-5" /> },
    { href: "/admin/ai-assistant", label: "AI Assistant", icon: <Sparkles className="h-5 w-5" /> },
    { href: "/admin/sessions", label: "Sessions & Terms", icon: <Calendar className="h-5 w-5" /> },
    { href: "/admin/classes", label: "Classes", icon: <School className="h-5 w-5" /> },
    { href: "/admin/attendance/qr-scanner", label: "QR Attendance Scanner", icon: <QrCode className="h-5 w-5" /> },
    { href: "/admin/subjects", label: "Subjects", icon: <BookOpen className="h-5 w-5" /> },
    { href: "/admin/periods", label: "Periods", icon: <Clock className="h-5 w-5" /> },
    { href: "/admin/timetable", label: "Timetable", icon: <FileText className="h-5 w-5" /> },
    { href: "/admin/students", label: "Students", icon: <Users className="h-5 w-5" /> },
    { href: "/admin/students/id-cards", label: "ID Card Generator", icon: <IdCard className="h-5 w-5" /> },
    { href: "/admin/teachers", label: "Teachers", icon: <GraduationCap className="h-5 w-5" /> },
    { href: "/admin/finance", label: "Finance", icon: <Wallet className="h-5 w-5" /> },
    { href: "/admin/history", label: "History", icon: <History className="h-5 w-5" /> },
    { href: "/admin/promotions", label: "Promotions", icon: <TrendingUp className="h-5 w-5" /> },
    { href: "/admin/admissions", label: "Admissions", icon: <ClipboardList className="h-5 w-5" /> },
    { href: "/admin/school-config", label: "School Structure", icon: <Layers className="h-5 w-5" /> },
    { href: "/admin/notifications", label: "Notifications", icon: <Bell className="h-5 w-5" /> },
    { href: "/admin/calendar", label: "Calendar", icon: <Calendar className="h-5 w-5" /> },
    { href: "/admin/settings", label: "Settings", icon: <Settings className="h-5 w-5" /> },
  ];

  const teacherNav: NavItem[] = [
    { href: "/teacher", label: "Dashboard", icon: <LayoutDashboard className="h-5 w-5" /> },
    ...(hasAssignedClasses
      ? [{ href: "/teacher/classes", label: "Class", icon: <School className="h-5 w-5" /> }]
      : []),
    { href: "/teacher/students", label: "Students", icon: <Users className="h-5 w-5" /> },
    { href: "/teacher/ai-assistant", label: "AI Assistant", icon: <Sparkles className="h-5 w-5" /> },
    { href: "/teacher/subjects", label: "Subjects", icon: <BookOpen className="h-5 w-5" /> },
    { href: "/teacher/results", label: "Results", icon: <GraduationCap className="h-5 w-5" /> },
    { href: "/teacher/assignments", label: "Assignments", icon: <FileText className="h-5 w-5" /> },
    { href: "/teacher/timetable", label: "Timetable", icon: <CalendarDays className="h-5 w-5" /> }, { href: "/teacher/notifications", label: "Notifications", icon: <Bell className="h-5 w-5" /> },
    { href: "/teacher/calendar", label: "Calendar", icon: <Calendar className="h-5 w-5" /> },
    { href: "/teacher/settings", label: "Settings", icon: <Settings className="h-5 w-5" /> },
  ];

  const studentNav: NavItem[] = [
    { href: "/student", label: "Dashboard", icon: <LayoutDashboard className="h-5 w-5" /> },
    { href: "/student/ai-assistant", label: "AI Assistant", icon: <Sparkles className="h-5 w-5" /> },
    { href: "/student/finance", label: "Finance", icon: <Wallet className="h-5 w-5" /> },
    { href: "/student/timetable", label: "Timetable", icon: <Calendar className="h-5 w-5" /> },
    { href: "/student/subjects", label: "Subjects", icon: <BookOpen className="h-5 w-5" /> },
    { href: "/student/results", label: "Results", icon: <GraduationCap className="h-5 w-5" /> },
    { href: "/student/assignments", label: "Assignments", icon: <FileText className="h-5 w-5" /> },
    { href: "/student/attendance", label: "Attendance", icon: <ClipboardList className="h-5 w-5" /> },
    { href: "/student/notifications", label: "Notifications", icon: <Bell className="h-5 w-5" /> },
    { href: "/student/calendar", label: "Calendar", icon: <Calendar className="h-5 w-5" /> },
    { href: "/student/settings", label: "Settings", icon: <Settings className="h-5 w-5" /> },
  ];

  const parentNav: NavItem[] = [
    { href: "/parent", label: "Dashboard", icon: <LayoutDashboard className="h-5 w-5" /> },
    { href: "/parent/children", label: "My Children", icon: <Users className="h-5 w-5" /> },
    { href: "/parent/finance", label: "Finance", icon: <Wallet className="h-5 w-5" /> },
    { href: "/parent/ai-assistant", label: "AI Assistant", icon: <Sparkles className="h-5 w-5" /> },
    { href: "/parent/notifications", label: "Notifications", icon: <Bell className="h-5 w-5" /> },
    { href: "/parent/calendar", label: "Calendar", icon: <Calendar className="h-5 w-5" /> },
    { href: "/parent/settings", label: "Settings", icon: <Settings className="h-5 w-5" /> },
  ];

  const navItems =
    role === "admin"
      ? adminNav
      : role === "teacher"
        ? teacherNav
        : role === "parent"
          ? parentNav
          : studentNav;

  /* ---------------- UI ---------------- */

  return (
    <TooltipProvider>
      {/* Mobile Overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/50 md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <aside
        className={cn(
          // Desktop behavior (UNCHANGED)
          "md:fixed md:translate-x-0",

          // Mobile behavior
          "fixed top-0 left-0 z-40 h-screen bg-white border-r border-slate-200 shadow-lg transition-transform duration-300 ease-in-out",

          collapsed ? "md:w-20" : "md:w-64",

          // Mobile slide logic
          mobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0",

          // Mobile width
          "w-64"
        )}
      >

        <div className="flex h-full flex-col">
          {/* Header with Logo and Name */}
          <div className="flex items-center justify-between h-16 px-4 border-b border-slate-200">
            <div className={cn(
              "flex items-center gap-3 transition-all",
              collapsed && "justify-center"
            )}>
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-white font-bold">
                <School className="h-5 w-5" />
              </div>
              {!collapsed && (
                <div className="flex flex-col">
                  <span className="text-sm font-bold text-slate-900">School Deck</span>
                  <span className="text-xs text-slate-500">Management</span>
                </div>
              )}
            </div>

            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setCollapsed(!collapsed)}
                className="hidden md:flex"
              >
                <ChevronLeft
                  className={cn(
                    "h-5 w-5 transition-transform",
                    collapsed && "rotate-180"
                  )}
                />
              </Button>

              {/* Mobile Close */}
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setMobileOpen(false)}
                className="md:hidden"
              >
                <X className="h-5 w-5" />
              </Button>
            </div>
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
                          onClick={() => setMobileOpen(false)}
                          className={cn(
                            "group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all",
                            isActive
                              ? "bg-blue-600 text-white shadow-md"
                              : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                          )}
                        >
                          <span className="flex h-5 w-5 items-center justify-center">
                            {item.icon}
                          </span>
                          {!collapsed && (
                            <span className="truncate">{item.label}</span>
                          )}
                        </Link>
                      </TooltipTrigger>

                      {collapsed && (
                        <TooltipContent side="right">
                          {item.label}
                        </TooltipContent>
                      )}
                    </Tooltip>
                  </li>
                );
              })}
            </ul>
          </nav>

          {/* Footer */}
          {!collapsed && (
            <div className="border-t border-slate-200 p-4 text-xs text-slate-500 text-center">
              School Deck v1.0
            </div>
          )}
        </div>
      </aside>
    </TooltipProvider>
  );
}
