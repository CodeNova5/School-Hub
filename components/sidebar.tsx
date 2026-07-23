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
  Radio,
  FileText,
  Settings,
  ClipboardList,
  School,
  History,
  TrendingUp,
  Wallet,
  Banknote,
  X,
  Bell,
  Clock,
  Sparkles,
  Layers,
  QrCode,
  Globe,
  ChevronLeft,
  UserCheck,
  Target,
  ScrollText,
  CreditCard,
  Package,
  Shield,
  IdCard,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";

import { APP_NAME } from "@/data";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { AdminPermission } from "@/lib/types";

interface NavItem {
  href: string;
  label: string;
  icon: React.ReactNode;
  /** Required admin permission to show this item. Dashboard is always visible. */
  permission?: AdminPermission;
  /** Optional badge to show next to the label */
  badge?: string | number;
  /** Badge color variant */
  badgeVariant?: "new" | "count";
}

interface NavSection {
  title: string;
  items: NavItem[];
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
  const [hasJambAccess, setHasJambAccess] = useState(false);
  const [adminPermissions, setAdminPermissions] = useState<Set<AdminPermission>>(new Set());
  const [isPermissionsLoaded, setIsPermissionsLoaded] = useState(false);
  const [notificationCount, setNotificationCount] = useState(0);

  useEffect(() => {
    if (role === "teacher") {
      checkTeacherClasses();
    }
    if (role === "student") {
      checkStudentJambAccess();
    }
    if (role === "admin") {
      fetchAdminPermissions();
      fetchNotificationCount();
    }
  }, [role]);

  async function fetchNotificationCount() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await supabase
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("is_read", false);

      setNotificationCount(data ?? 0);
    } catch (error) {
      console.error("Error fetching notification count:", error);
    }
  }

  async function fetchAdminPermissions() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      if (user?.user_metadata?.role === "super_admin") {
        // Super admins have access to everything
        setIsPermissionsLoaded(true);
        return;
      }
      const { data } = await supabase.rpc("get_my_admin_permissions");
      if (Array.isArray(data)) {
        setAdminPermissions(new Set(data as AdminPermission[]));
      }
      setIsPermissionsLoaded(true);
    } catch (error) {
      console.error("Error fetching admin permissions:", error);
    } finally {
      setIsPermissionsLoaded(true);
    }
  }

  function hasAdminPermission(permission: AdminPermission): boolean {
    // Super admins bypass permission checks
    // For regular admins, check if they have the permission or a wildcard
    return adminPermissions.size === 0 || adminPermissions.has("*" as AdminPermission) || adminPermissions.has(permission);
  }

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

  async function checkStudentJambAccess() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: student } = await supabase
        .from("students")
        .select("id, school_id")
        .eq("user_id", user.id)
        .single();

      if (!student?.id || !student.school_id) return;

      const { data: jambAccess } = await supabase
        .from("jamb_student_access")
        .select("id")
        .eq("student_id", student.id)
        .eq("school_id", student.school_id)
        .eq("is_active", true)
        .maybeSingle();

      setHasJambAccess(Boolean(jambAccess));
    } catch (error) {
      console.error("Error checking JAMB access:", error);
    }
  }

  /* ---------------- NAV CONFIG ---------------- */

  const adminNavSections: NavSection[] = [
    {
      title: "",
      items: [
        { href: "/admin", label: "Dashboard", icon: <LayoutDashboard className="h-5 w-5" /> },
      ],
    },
    {
      title: "CORE MODULES",
      items: [
        { href: "/admin/ai-assistant", label: "AI Assistant", icon: <Sparkles className="h-5 w-5" />, badge: "New", badgeVariant: "new" },
        { href: "/admin/sessions", label: "Sessions & Terms", icon: <Calendar className="h-5 w-5" /> },
        { href: "/admin/classes", label: "Classes", icon: <School className="h-5 w-5" />, permission: "classes:read" },
        { href: "/admin/subjects", label: "Subjects", icon: <BookOpen className="h-5 w-5" />, permission: "subjects:read" },
        { href: "/admin/periods", label: "Periods", icon: <Clock className="h-5 w-5" /> },
        { href: "/admin/timetable", label: "Timetable", icon: <FileText className="h-5 w-5" />, permission: "timetable:read" },
      ],
    },
    {
      title: "PEOPLE MANAGEMENT",
      items: [
        { href: "/admin/students", label: "Students", icon: <Users className="h-5 w-5" />, permission: "students:read" },
        { href: "/admin/students/id-cards", label: "ID Card Generator", icon: <IdCard className="h-5 w-5" />, permission: "students:read" },
        { href: "/admin/families", label: "Families", icon: <Users className="h-5 w-5" />, permission: "students:read" },
        { href: "/admin/parents", label: "Parents & Guardians", icon: <UserCheck className="h-5 w-5" />, permission: "students:read" },
        { href: "/admin/teachers", label: "Teachers", icon: <GraduationCap className="h-5 w-5" />, permission: "teachers:read" },
        { href: "/admin/teachers/id-cards", label: "Teacher ID Cards", icon: <IdCard className="h-5 w-5" />, permission: "teachers:read" },
        { href: "/admin/admin-users", label: "Admin Management", icon: <Shield className="h-5 w-5" />, permission: "user_management:write" },
      ],
    },
    {
      title: "OPERATIONS",
      items: [
        { href: "/admin/attendance", label: "Attendance", icon: <ClipboardList className="h-5 w-5" /> },
        { href: "/admin/attendance/qr-scanner", label: "QR Attendance Scanner", icon: <QrCode className="h-5 w-5" /> },
        { href: "/admin/reports", label: "Reports", icon: <FileText className="h-5 w-5" />, permission: "results:read" },
        { href: "/admin/promotions", label: "Promotions", icon: <TrendingUp className="h-5 w-5" />, permission: "classes:write" },
        { href: "/admin/history", label: "History", icon: <History className="h-5 w-5" />, permission: "classes:read" },
        { href: "/admin/admissions", label: "Admissions", icon: <ClipboardList className="h-5 w-5" />, permission: "admissions:read" },
        { href: "/admin/alumni", label: "Alumni", icon: <UserCheck className="h-5 w-5" />, permission: "alumni:read" },
      ],
    },
    {
      title: "FINANCE & ASSETS",
      items: [
        { href: "/admin/finance", label: "Finance", icon: <Wallet className="h-5 w-5" />, permission: "finance:read" },
        { href: "/admin/payroll", label: "Payroll", icon: <Banknote className="h-5 w-5" />, permission: "finance:read" },
        { href: "/admin/inventory", label: "Inventory", icon: <Package className="h-5 w-5" />, permission: "inventory:read" },
      ],
    },
    {
      title: "SYSTEM & CONFIG",
      items: [
        { href: "/admin/notifications", label: "Notifications", icon: <Bell className="h-5 w-5" />, permission: "notifications:write", badge: notificationCount > 0 ? notificationCount : undefined, badgeVariant: "count" },
        { href: "/admin/calendar", label: "Calendar", icon: <Calendar className="h-5 w-5" /> },
        { href: "/admin/school-config", label: "School Structure", icon: <Layers className="h-5 w-5" />, permission: "structure:read" },
        { href: "/admin/settings", label: "Settings", icon: <Settings className="h-5 w-5" />, permission: "settings:read" },
        { href: "/admin/subscription", label: "Subscription", icon: <CreditCard className="h-5 w-5" />, permission: "settings:read" },
        { href: "/admin/audit-logs", label: "Audit Trail", icon: <ScrollText className="h-5 w-5" />, permission: "audit:read" },
      ],
    },
    {
      title: "ADVANCED FEATURES",
      items: [
        { href: "/admin/jamb", label: "JAMB CBT Access", icon: <Target className="h-5 w-5" />, permission: "question_bank:read" },
        { href: "/admin/question-bank", label: "Question Bank", icon: <ClipboardList className="h-5 w-5" />, permission: "question_bank:read" },
        { href: "/admin/website-builder", label: "Website Builder", icon: <Globe className="h-5 w-5" />, permission: "website:read" },
      ],
    },
  ];

  const teacherNavSections: NavSection[] = [
    {
      title: "",
      items: [
        { href: "/teacher", label: "Dashboard", icon: <LayoutDashboard className="h-5 w-5" /> },
      ],
    },
    {
      title: "TEACHING",
      items: [
        ...(hasAssignedClasses
          ? [{ href: "/teacher/classes", label: "Class", icon: <School className="h-5 w-5" /> }]
          : []),
        { href: "/teacher/students", label: "Students", icon: <Users className="h-5 w-5" /> },
        { href: "/teacher/ai-assistant", label: "AI Assistant", icon: <Sparkles className="h-5 w-5" />, badge: "New", badgeVariant: "new" },
        { href: "/teacher/subjects", label: "Subjects", icon: <BookOpen className="h-5 w-5" /> },
        { href: "/teacher/lesson-notes", label: "Lesson Notes", icon: <BookOpen className="h-5 w-5" /> },
        { href: "/teacher/question-bank", label: "Question Bank", icon: <ClipboardList className="h-5 w-5" /> },
        { href: "/teacher/live-classes", label: "Live Classes", icon: <Radio className="h-5 w-5" /> },
        { href: "/teacher/results", label: "Results", icon: <GraduationCap className="h-5 w-5" /> },
        { href: "/teacher/assignments", label: "Assignments", icon: <FileText className="h-5 w-5" /> },
        { href: "/teacher/timetable", label: "Timetable", icon: <CalendarDays className="h-5 w-5" /> },
      ],
    },
    {
      title: "OTHER",
      items: [
        { href: "/teacher/notifications", label: "Notifications", icon: <Bell className="h-5 w-5" /> },
        { href: "/teacher/calendar", label: "Calendar", icon: <Calendar className="h-5 w-5" /> },
        { href: "/teacher/payroll/subaccount", label: "Payroll", icon: <Banknote className="h-5 w-5" /> },
        { href: "/teacher/settings", label: "Settings", icon: <Settings className="h-5 w-5" /> },
      ],
    },
  ];

  const studentNavSections: NavSection[] = [
    {
      title: "",
      items: [
        { href: "/student", label: "Dashboard", icon: <LayoutDashboard className="h-5 w-5" /> },
      ],
    },
    {
      title: "LEARNING",
      items: [
        { href: "/student/ai-assistant", label: "AI Assistant", icon: <Sparkles className="h-5 w-5" />, badge: "New", badgeVariant: "new" },
        ...(hasJambAccess
          ? [{ href: "/student/jamb", label: "JAMB CBT", icon: <Target className="h-5 w-5" /> }]
          : []),
        { href: "/student/subjects", label: "Subjects", icon: <BookOpen className="h-5 w-5" /> },
        { href: "/student/live-classes", label: "Live Classes", icon: <Radio className="h-5 w-5" /> },
        { href: "/student/results", label: "Results", icon: <GraduationCap className="h-5 w-5" /> },
        { href: "/student/assignments", label: "Assignments", icon: <FileText className="h-5 w-5" /> },
        { href: "/student/timetable", label: "Timetable", icon: <Calendar className="h-5 w-5" /> },
        { href: "/student/attendance", label: "Attendance", icon: <ClipboardList className="h-5 w-5" /> },
      ],
    },
    {
      title: "OTHER",
      items: [
        { href: "/student/inventory", label: "My Assets", icon: <Package className="h-5 w-5" /> },
        { href: "/student/finance", label: "Finance", icon: <Wallet className="h-5 w-5" /> },
        { href: "/student/notifications", label: "Notifications", icon: <Bell className="h-5 w-5" /> },
        { href: "/student/calendar", label: "Calendar", icon: <Calendar className="h-5 w-5" /> },
        { href: "/student/settings", label: "Settings", icon: <Settings className="h-5 w-5" /> },
      ],
    },
  ];

  const parentNavSections: NavSection[] = [
    {
      title: "",
      items: [
        { href: "/parent", label: "Dashboard", icon: <LayoutDashboard className="h-5 w-5" /> },
      ],
    },
    {
      title: "FAMILY",
      items: [
        { href: "/parent/children", label: "My Children", icon: <Users className="h-5 w-5" /> },
        { href: "/parent/ai-assistant", label: "AI Assistant", icon: <Sparkles className="h-5 w-5" />, badge: "New", badgeVariant: "new" },
        { href: "/parent/inventory", label: "Assigned Property", icon: <Package className="h-5 w-5" /> },
        { href: "/parent/finance", label: "Finance", icon: <Wallet className="h-5 w-5" /> },
      ],
    },
    {
      title: "OTHER",
      items: [
        { href: "/parent/notifications", label: "Notifications", icon: <Bell className="h-5 w-5" /> },
        { href: "/parent/calendar", label: "Calendar", icon: <Calendar className="h-5 w-5" /> },
        { href: "/parent/settings", label: "Settings", icon: <Settings className="h-5 w-5" /> },
      ],
    },
  ];

  const navSections =
    role === "admin"
      ? adminNavSections.map((section) => ({
          ...section,
          items: section.items.filter((item) => {
            // Dashboard is always visible; items without a permission requirement are always visible
            if (item.href === "/admin" || !item.permission) return true;
            // Don't show permission-gated items until permissions have loaded
            if (!isPermissionsLoaded) return false;
            return hasAdminPermission(item.permission);
          }),
        }))
      : role === "teacher"
        ? teacherNavSections
        : role === "parent"
          ? parentNavSections
          : studentNavSections;

  // Flatten items for tooltip purposes
  const allNavItems = navSections.flatMap((section) => section.items);

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
          "fixed top-0 left-0 z-40 h-screen transition-transform duration-300 ease-in-out",

          // Dark navy background
          "bg-[#0f172a] text-white",

          collapsed ? "md:w-[72px]" : "md:w-[260px]",

          // Mobile slide logic
          mobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0",

          // Mobile width
          "w-[260px]"
        )}
      >
        <div className="flex h-full flex-col">
          {/* Header with Logo and Name */}
          <div className="flex items-center justify-between h-16 px-4 border-b border-slate-700/50">
            <div className={cn(
              "flex items-center gap-3 transition-all",
              collapsed && "justify-center"
            )}>
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 text-white font-bold">
                <School className="h-5 w-5" />
              </div>
              {!collapsed && (
                <div className="flex flex-col">
                  <span className="text-sm font-bold text-white">{APP_NAME}</span>
                  <span className="text-xs text-slate-400">School Hub</span>
                </div>
              )}
            </div>

            {/* Mobile Close */}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setMobileOpen(false)}
              className="md:hidden text-slate-400 hover:text-white hover:bg-slate-700"
            >
              <X className="h-5 w-5" />
            </Button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 overflow-y-auto px-3 py-4">
            {navSections.map((section, sectionIndex) => {
              // Filter items that have permission
              const visibleItems = section.items;
              if (visibleItems.length === 0) return null;

              return (
                <div key={section.title || "dashboard"} className={cn(sectionIndex > 0 && "mt-6")}>
                  {/* Section Header */}
                  {section.title && !collapsed && (
                    <div className="px-3 mb-2">
                      <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                        {section.title}
                      </span>
                    </div>
                  )}

                  {/* Section Items */}
                  <ul className="space-y-0.5">
                    {visibleItems.map((item) => {
                      const isActive = pathname === item.href;

                      return (
                        <li key={item.href}>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Link
                                href={item.href}
                                onClick={() => setMobileOpen(false)}
                                className={cn(
                                  "group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-150",
                                  isActive
                                    ? "bg-gradient-to-r from-blue-600 to-blue-500 text-white shadow-lg shadow-blue-500/25"
                                    : "text-slate-300 hover:bg-slate-700/50 hover:text-white",
                                  collapsed && "justify-center px-2"
                                )}
                              >
                                <span className={cn(
                                  "flex items-center justify-center",
                                  isActive ? "text-white" : "text-slate-400 group-hover:text-white"
                                )}>
                                  {item.icon}
                                </span>
                                {!collapsed && (
                                  <>
                                    <span className="truncate flex-1">{item.label}</span>
                                    {item.badge && (
                                      <span
                                        className={cn(
                                          "px-2 py-0.5 text-xs font-medium rounded-full",
                                          item.badgeVariant === "new"
                                            ? "bg-emerald-500 text-white"
                                            : "bg-red-500 text-white min-w-[20px] text-center"
                                        )}
                                      >
                                        {item.badge}
                                      </span>
                                    )}
                                  </>
                                )}
                              </Link>
                            </TooltipTrigger>

                            {collapsed && (
                              <TooltipContent side="right" className="bg-slate-800 text-white border-slate-700">
                                {item.label}
                                {item.badge && (
                                  <span className="ml-2 text-xs text-slate-400">({item.badge})</span>
                                )}
                              </TooltipContent>
                            )}
                          </Tooltip>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              );
            })}
          </nav>

          {/* Footer with Collapse Button */}
          <div className="border-t border-slate-700/50 p-3">
            <button
              onClick={() => setCollapsed(!collapsed)}
              className={cn(
                "flex items-center gap-3 w-full rounded-lg px-3 py-2.5 text-sm font-medium text-slate-400 hover:bg-slate-700/50 hover:text-white transition-all duration-150",
                collapsed && "justify-center px-2"
              )}
            >
              {collapsed ? (
                <ChevronsRight className="h-5 w-5" />
              ) : (
                <>
                  <ChevronsLeft className="h-5 w-5" />
                  <span>Collapse</span>
                </>
              )}
            </button>
          </div>
        </div>
      </aside>
    </TooltipProvider>
  );
}
