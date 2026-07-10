"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import {
  Search,
  Bell,
  Plus,
  School,
  User,
  Settings,
  LogOut,
  ChevronDown,
  Menu,
  LayoutDashboard,
  Users,
  BookOpen,
  GraduationCap,
  CalendarDays,
  FileText,
  Wallet,
  Sparkles,
  Command,
  Clock,
  ClipboardList,
  Radio,
  History,
  TrendingUp,
  QrCode,
  Globe,
  Layers,
  CreditCard,
  Banknote,
  UserCheck,
  School as SchoolIcon,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuGroup,
} from "@/components/ui/dropdown-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/components/auth-provider";
import { supabase } from "@/lib/supabase";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";

/* ───────────────────────────────────────────
   Types
   ─────────────────────────────────────────── */

interface AppHeaderProps {
  onMenuToggle: () => void;
  role: "admin" | "teacher" | "student" | "parent";
  schoolName?: string;
}

interface NotificationItem {
  id: string;
  title: string;
  body: string;
  createdAt: string;
  link?: string;
}

interface NavItem {
  href: string;
  label: string;
  icon: React.ReactNode;
  keywords?: string;
}

/* ───────────────────────────────────────────
   Navigation items (shared with search)
   ─────────────────────────────────────────── */

const NAV_ITEMS: Record<string, NavItem[]> = {
  admin: [
    { href: "/admin", label: "Dashboard", icon: <LayoutDashboard className="h-4 w-4" />, keywords: "home overview" },
    { href: "/admin/ai-assistant", label: "AI Assistant", icon: <Sparkles className="h-4 w-4" />, keywords: "ai help" },
    { href: "/admin/sessions", label: "Sessions & Terms", icon: <CalendarDays className="h-4 w-4" />, keywords: "academic session term" },
    { href: "/admin/classes", label: "Classes", icon: <SchoolIcon className="h-4 w-4" />, keywords: "class list" },
    { href: "/admin/attendance", label: "Attendance", icon: <ClipboardList className="h-4 w-4" />, keywords: "register" },
    { href: "/admin/attendance/qr-scanner", label: "QR Scanner", icon: <QrCode className="h-4 w-4" />, keywords: "qr scan" },
    { href: "/admin/subjects", label: "Subjects", icon: <BookOpen className="h-4 w-4" />, keywords: "subject course" },
    { href: "/admin/periods", label: "Periods", icon: <Clock className="h-4 w-4" />, keywords: "time slot" },
    { href: "/admin/timetable", label: "Timetable", icon: <FileText className="h-4 w-4" />, keywords: "schedule" },
    { href: "/admin/students", label: "Students", icon: <Users className="h-4 w-4" />, keywords: "pupil learner" },
    { href: "/admin/teachers", label: "Teachers", icon: <GraduationCap className="h-4 w-4" />, keywords: "staff tutor" },
    { href: "/admin/finance", label: "Finance", icon: <Wallet className="h-4 w-4" />, keywords: "fees payment" },
    { href: "/admin/payroll", label: "Payroll", icon: <Banknote className="h-4 w-4" />, keywords: "salary" },
    { href: "/admin/history", label: "History", icon: <History className="h-4 w-4" />, keywords: "audit log" },
    { href: "/admin/promotions", label: "Promotions", icon: <TrendingUp className="h-4 w-4" />, keywords: "promote upgrade" },
    { href: "/admin/admissions", label: "Admissions", icon: <ClipboardList className="h-4 w-4" />, keywords: "enroll new" },
    { href: "/admin/alumni", label: "Alumni", icon: <UserCheck className="h-4 w-4" />, keywords: "graduate" },
    { href: "/admin/website-builder", label: "Website Builder", icon: <Globe className="h-4 w-4" />, keywords: "site builder" },
    { href: "/admin/school-config", label: "School Structure", icon: <Layers className="h-4 w-4" />, keywords: "config setup" },
    { href: "/admin/notifications", label: "Notifications", icon: <Bell className="h-4 w-4" />, keywords: "alert notify" },
    { href: "/admin/calendar", label: "Calendar", icon: <CalendarDays className="h-4 w-4" />, keywords: "event date" },
    { href: "/admin/subscription", label: "Subscription", icon: <CreditCard className="h-4 w-4" />, keywords: "plan billing" },
    { href: "/admin/settings", label: "Settings", icon: <Settings className="h-4 w-4" />, keywords: "preferences config" },
  ],
  teacher: [
    { href: "/teacher", label: "Dashboard", icon: <LayoutDashboard className="h-4 w-4" />, keywords: "home" },
    { href: "/teacher/ai-assistant", label: "AI Assistant", icon: <Sparkles className="h-4 w-4" />, keywords: "ai help" },
    { href: "/teacher/students", label: "Students", icon: <Users className="h-4 w-4" />, keywords: "pupil" },
    { href: "/teacher/subjects", label: "Subjects", icon: <BookOpen className="h-4 w-4" />, keywords: "subject course" },
    { href: "/teacher/lesson-notes", label: "Lesson Notes", icon: <BookOpen className="h-4 w-4" />, keywords: "lesson plan" },
    { href: "/teacher/live-classes", label: "Live Classes", icon: <Radio className="h-4 w-4" />, keywords: "live stream" },
    { href: "/teacher/results", label: "Results", icon: <GraduationCap className="h-4 w-4" />, keywords: "scores grades" },
    { href: "/teacher/assignments", label: "Assignments", icon: <FileText className="h-4 w-4" />, keywords: "homework" },
    { href: "/teacher/timetable", label: "Timetable", icon: <CalendarDays className="h-4 w-4" />, keywords: "schedule" },
    { href: "/teacher/notifications", label: "Notifications", icon: <Bell className="h-4 w-4" />, keywords: "alert" },
    { href: "/teacher/calendar", label: "Calendar", icon: <CalendarDays className="h-4 w-4" />, keywords: "event" },
    { href: "/teacher/settings", label: "Settings", icon: <Settings className="h-4 w-4" />, keywords: "preferences" },
  ],
  student: [
    { href: "/student", label: "Dashboard", icon: <LayoutDashboard className="h-4 w-4" />, keywords: "home" },
    { href: "/student/ai-assistant", label: "AI Assistant", icon: <Sparkles className="h-4 w-4" />, keywords: "ai help" },
    { href: "/student/finance", label: "Finance", icon: <Wallet className="h-4 w-4" />, keywords: "fees payment" },
    { href: "/student/timetable", label: "Timetable", icon: <CalendarDays className="h-4 w-4" />, keywords: "schedule" },
    { href: "/student/subjects", label: "Subjects", icon: <BookOpen className="h-4 w-4" />, keywords: "course" },
    { href: "/student/results", label: "Results", icon: <GraduationCap className="h-4 w-4" />, keywords: "scores grades" },
    { href: "/student/assignments", label: "Assignments", icon: <FileText className="h-4 w-4" />, keywords: "homework" },
    { href: "/student/attendance", label: "Attendance", icon: <ClipboardList className="h-4 w-4" />, keywords: "register" },
    { href: "/student/notifications", label: "Notifications", icon: <Bell className="h-4 w-4" />, keywords: "alert" },
    { href: "/student/calendar", label: "Calendar", icon: <CalendarDays className="h-4 w-4" />, keywords: "event" },
    { href: "/student/settings", label: "Settings", icon: <Settings className="h-4 w-4" />, keywords: "preferences" },
  ],
  parent: [
    { href: "/parent", label: "Dashboard", icon: <LayoutDashboard className="h-4 w-4" />, keywords: "home" },
    { href: "/parent/children", label: "My Children", icon: <Users className="h-4 w-4" />, keywords: "kids wards" },
    { href: "/parent/finance", label: "Finance", icon: <Wallet className="h-4 w-4" />, keywords: "fees payment" },
    { href: "/parent/ai-assistant", label: "AI Assistant", icon: <Sparkles className="h-4 w-4" />, keywords: "ai help" },
    { href: "/parent/notifications", label: "Notifications", icon: <Bell className="h-4 w-4" />, keywords: "alert" },
    { href: "/parent/calendar", label: "Calendar", icon: <CalendarDays className="h-4 w-4" />, keywords: "event" },
    { href: "/parent/settings", label: "Settings", icon: <Settings className="h-4 w-4" />, keywords: "preferences" },
  ],
};

const ROLE_LABELS: Record<string, string> = {
  admin: "Administrator",
  teacher: "Teacher",
  student: "Student",
  parent: "Parent",
};

const QUICK_ACTIONS: Record<string, { label: string; href: string; icon: React.ReactNode }[]> = {
  admin: [
    { label: "Add Student", href: "/admin/students", icon: <User className="h-4 w-4" /> },
    { label: "Add Teacher", href: "/admin/teachers", icon: <GraduationCap className="h-4 w-4" /> },
    { label: "New Class", href: "/admin/classes", icon: <SchoolIcon className="h-4 w-4" /> },
    { label: "Record Attendance", href: "/admin/attendance", icon: <ClipboardList className="h-4 w-4" /> },
  ],
  teacher: [
    { label: "Take Attendance", href: "/teacher/students", icon: <ClipboardList className="h-4 w-4" /> },
    { label: "Add Result", href: "/teacher/results", icon: <GraduationCap className="h-4 w-4" /> },
    { label: "New Assignment", href: "/teacher/assignments/create", icon: <FileText className="h-4 w-4" /> },
  ],
  student: [
    { label: "View Results", href: "/student/results", icon: <GraduationCap className="h-4 w-4" /> },
    { label: "My Timetable", href: "/student/timetable", icon: <CalendarDays className="h-4 w-4" /> },
  ],
  parent: [
    { label: "My Children", href: "/parent/children", icon: <Users className="h-4 w-4" /> },
    { label: "Pay Fees", href: "/parent/finance", icon: <Wallet className="h-4 w-4" /> },
  ],
};

/* ───────────────────────────────────────────
   Sub-components
   ─────────────────────────────────────────── */

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function formatTimeAgo(date: string): string {
  const now = new Date();
  const then = new Date(date);
  const diffInSeconds = Math.floor((now.getTime() - then.getTime()) / 1000);
  if (diffInSeconds < 60) return "now";
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h`;
  if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}d`;
  return then.toLocaleDateString();
}

/* ───────────────────────────────────────────
   Search Command Palette
   ─────────────────────────────────────────── */

function SearchCommand({ role }: { role: AppHeaderProps["role"] }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  const navItems = NAV_ITEMS[role] || [];

  const runCommand = useCallback(
    (href: string) => {
      setOpen(false);
      router.push(href);
    },
    [router]
  );

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={cn(
          "group relative flex items-center gap-2 w-full max-w-md",
          "h-9 px-3 py-2 rounded-lg",
          "bg-slate-100 hover:bg-slate-200/80",
          "border border-slate-200 hover:border-slate-300",
          "text-sm text-slate-500 hover:text-slate-700",
          "transition-all duration-200",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1"
        )}
      >
        <Search className="h-4 w-4 shrink-0" />
        <span className="hidden sm:inline-flex flex-1 text-left">
          Search anything...
        </span>
        <span className="hidden sm:inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-slate-200/70 text-[10px] font-medium text-slate-500">
          <Command className="h-2.5 w-2.5" />
          <span>K</span>
        </span>
      </button>

      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput placeholder="Search pages, features..." />
        <CommandList>
          <CommandEmpty>
            <div className="py-8 text-center">
              <Search className="h-8 w-8 mx-auto mb-2 text-slate-300" />
              <p className="text-sm text-slate-500">No results found</p>
              <p className="text-xs text-slate-400 mt-1">
                Try a different search term
              </p>
            </div>
          </CommandEmpty>
          <CommandGroup heading="Navigation">
            {navItems.map((item) => (
              <CommandItem
                key={item.href}
                value={`${item.label} ${item.keywords || ""}`}
                onSelect={() => runCommand(item.href)}
                className="flex items-center gap-3"
              >
                <span className="flex h-6 w-6 items-center justify-center rounded-md bg-slate-100 text-slate-600">
                  {item.icon}
                </span>
                <span>{item.label}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </>
  );
}

/* ───────────────────────────────────────────
   Notification Bell + Dropdown
   ─────────────────────────────────────────── */

function NotificationBell({ role }: { role: AppHeaderProps["role"] }) {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const { user } = useAuth();

  useEffect(() => {
    if (!open) return;
    fetchNotifications();
  }, [open]);

  const fetchNotifications = async () => {
    try {
      setLoading(true);
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) return;

      const { data } = await supabase
        .from("notification_logs")
        .select("*")
        .or(
          `and(target.eq.all),and(target.eq.role,target_value.eq.${role}),and(target.eq.user,target_value.eq.${authUser.id})`
        )
        .order("created_at", { ascending: false })
        .limit(5);

      if (data) {
        setNotifications(
          data.map((n: any) => ({
            id: n.id,
            title: n.title,
            body: n.body || "",
            createdAt: n.created_at,
            link: n.link,
          }))
        );
      }
    } catch (err) {
      console.error("Error fetching notifications:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative h-9 w-9 rounded-lg hover:bg-slate-100 transition-colors"
        >
          <Bell className="h-[18px] w-[18px] text-slate-600" />
          {notifications.length > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white ring-2 ring-white">
              {notifications.length > 9 ? "9+" : notifications.length}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={8}
        className="w-80 p-0 overflow-hidden rounded-xl"
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
          <h3 className="text-sm font-semibold text-slate-900">Notifications</h3>
          <Link
            href={`/${role}/notifications`}
            onClick={() => setOpen(false)}
            className="text-xs font-medium text-blue-600 hover:text-blue-700 transition-colors"
          >
            View all
          </Link>
        </div>

        <div className="max-h-[320px] overflow-y-auto">
          {loading ? (
            <div className="p-4 space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex gap-3">
                  <Skeleton className="h-8 w-8 rounded-full shrink-0" />
                  <div className="flex-1 space-y-1.5">
                    <Skeleton className="h-3.5 w-3/4" />
                    <Skeleton className="h-3 w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          ) : notifications.length === 0 ? (
            <div className="p-8 text-center">
              <Bell className="h-8 w-8 mx-auto mb-2 text-slate-300" />
              <p className="text-sm text-slate-500 font-medium">No notifications</p>
              <p className="text-xs text-slate-400 mt-1">
                You&apos;re all caught up!
              </p>
            </div>
          ) : (
            <div>
              {notifications.map((notif, idx) => (
                <div key={notif.id}>
                  {idx > 0 && <Separator />}
                  <Link
                    href={notif.link || `/${role}/notifications`}
                    onClick={() => setOpen(false)}
                    className="flex items-start gap-3 px-4 py-3 hover:bg-slate-50 transition-colors group"
                  >
                    <div className="h-8 w-8 rounded-full bg-blue-50 flex items-center justify-center shrink-0 group-hover:bg-blue-100 transition-colors">
                      <Bell className="h-4 w-4 text-blue-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-900 truncate">
                        {notif.title}
                      </p>
                      {notif.body && (
                        <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">
                          {notif.body}
                        </p>
                      )}
                      <p className="text-[11px] text-slate-400 mt-1">
                        {formatTimeAgo(notif.createdAt)}
                      </p>
                    </div>
                    <ChevronRight className="h-4 w-4 text-slate-300 mt-2 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </Link>
                </div>
              ))}
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

/* ───────────────────────────────────────────
   useUserProfile — fetch real name & avatar from DB
   ─────────────────────────────────────────── */

interface UserProfile {
  fullName: string;
  avatarUrl: string | null;
  initials: string;
}

function useUserProfile(role: AppHeaderProps["role"]): {
  profile: UserProfile | null;
  loading: boolean;
} {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    if (!user?.id) {
      setProfile(null);
      setLoading(false);
      return;
    }

    const fetchUserProfile = async () => {
      try {
        setLoading(true);
        let fullName = user?.email?.split("@")[0] || "User";
        let avatarUrl: string | null = null;

        if (role === "teacher") {
          const { data } = await supabase
            .from("teachers")
            .select("first_name, last_name, photo_url")
            .eq("user_id", user!.id)
            .maybeSingle();
          if (data) {
            fullName = `${data.first_name} ${data.last_name}`;
            avatarUrl = data.photo_url || null;
          }          } else if (role === "student") {
          const { data } = await supabase
            .from("students")
            .select("first_name, last_name, image_url")
            .eq("user_id", user!.id)
            .maybeSingle();
          if (data) {
            fullName = `${data.first_name} ${data.last_name}`;
            avatarUrl = data.image_url || null;
          }
        } else if (role === "parent") {
          const { data } = await supabase
            .from("parents")
            .select("name")
            .eq("user_id", user!.id)
            .maybeSingle();
          if (data?.name) {
            fullName = data.name;
          }
        } else if (role === "admin") {
          const { data } = await supabase
            .from("admins")
            .select("name")
            .eq("user_id", user!.id)
            .maybeSingle();
          if (data?.name) {
            fullName = data.name;
          }
        }

        setProfile({
          fullName,
          avatarUrl,
          initials: getInitials(fullName),
        });
      } catch (err) {
        console.error("Error fetching user profile:", err);
        // Fallback to email prefix
        const fallback = user?.email?.split("@")[0] || "User";
        setProfile({
          fullName: fallback,
          avatarUrl: null,
          initials: getInitials(fallback),
        });
      } finally {
        setLoading(false);
      }
    };

    fetchUserProfile();
  }, [user?.id, role]);

  return { profile, loading };
}

/* ───────────────────────────────────────────
   Profile Dropdown
   ─────────────────────────────────────────── */

function ProfileDropdown({ role }: { role: AppHeaderProps["role"] }) {
  const { user } = useAuth();
  const { profile, loading } = useUserProfile(role);
  const router = useRouter();

  const displayName = profile?.fullName || user?.email?.split("@")[0] || "User";
  const initials = profile?.initials || getInitials(displayName);
  const avatarUrl = profile?.avatarUrl || null;
  const roleLabel = ROLE_LABELS[role] || role;

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push("/");
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className={cn(
            "flex items-center gap-2 h-9 px-2 rounded-lg",
            "hover:bg-slate-100 transition-colors",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1"
          )}
        >
          <Avatar className="h-7 w-7">
            {avatarUrl ? (
              <AvatarImage src={avatarUrl} alt={displayName} />
            ) : null}
            <AvatarFallback className="text-[11px] font-semibold bg-gradient-to-br from-blue-500 to-blue-600 text-white">
              {loading ? ".." : initials}
            </AvatarFallback>
          </Avatar>
          <div className="hidden md:flex flex-col items-start">
            <span className="text-sm font-medium text-slate-900 leading-tight max-w-[120px] truncate">
              {loading ? "..." : displayName}
            </span>
            <span className="text-[10px] text-slate-500 leading-tight uppercase tracking-wider font-medium">
              {roleLabel}
            </span>
          </div>
          <ChevronDown className="hidden md:block h-3.5 w-3.5 text-slate-400" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        sideOffset={6}
        className="w-56 rounded-xl p-1"
      >
        <DropdownMenuLabel className="font-normal p-3">
          <div className="flex items-center gap-3">
            <Avatar className="h-10 w-10">
              {avatarUrl ? (
                <AvatarImage src={avatarUrl} alt={displayName} />
              ) : null}
              <AvatarFallback className="bg-gradient-to-br from-blue-500 to-blue-600 text-white font-semibold">
                {loading ? ".." : initials}
              </AvatarFallback>
            </Avatar>
            <div className="flex flex-col">
              <span className="text-sm font-medium text-slate-900">
                {loading ? "Loading..." : displayName}
              </span>
              <span className="text-xs text-slate-500 truncate max-w-[150px]">
                {user?.email || ""}
              </span>
              <Badge
                variant="outline"
                className="mt-1 px-1.5 py-0 text-[10px] uppercase tracking-wider font-semibold w-fit text-blue-600 border-blue-200 bg-blue-50"
              >
                {roleLabel}
              </Badge>
            </div>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem
            onClick={() => router.push(`/${role}/settings`)}
            className="cursor-pointer rounded-lg"
          >
            <Settings className="h-4 w-4 mr-2 text-slate-500" />
            <span>Settings</span>
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={handleSignOut}
          className="cursor-pointer rounded-lg text-red-600 focus:text-red-600 focus:bg-red-50"
        >
          <LogOut className="h-4 w-4 mr-2" />
          <span>Sign out</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/* ───────────────────────────────────────────
   Quick Actions (role-specific)
   ─────────────────────────────────────────── */

function QuickActionsMenu({ role }: { role: AppHeaderProps["role"] }) {
  const router = useRouter();
  const actions = QUICK_ACTIONS[role] || [];

  if (actions.length === 0) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9 rounded-lg hover:bg-blue-50 hover:text-blue-600 transition-colors"
        >
          <Plus className="h-[18px] w-[18px]" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        sideOffset={6}
        className="w-48 rounded-xl p-1"
      >
        <DropdownMenuLabel className="text-xs font-medium text-slate-500 px-2 py-1.5">
          Quick Actions
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {actions.map((action) => (
          <DropdownMenuItem
            key={action.href}
            onClick={() => router.push(action.href)}
            className="cursor-pointer rounded-lg"
          >
            <span className="h-6 w-6 flex items-center justify-center rounded-md bg-slate-100 text-slate-600 mr-2">
              {action.icon}
            </span>
            <span>{action.label}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/* ───────────────────────────────────────────
   Main AppHeader Component
   ─────────────────────────────────────────── */

export function AppHeader({
  onMenuToggle,
  role,
  schoolName = "School Deck",
}: AppHeaderProps) {
  const pathname = usePathname();
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 8);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  /* Derive current page title from pathname */
  const currentPage = (() => {
    const segments = pathname.split("/").filter(Boolean);
    if (segments.length <= 1) return "Dashboard";
    const navItems = NAV_ITEMS[role] || [];
    const match = navItems.find((item) => item.href === pathname);
    if (match) return match.label;
    // Fallback: humanize the last segment
    const last = segments[segments.length - 1];
    return last
      .split("-")
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ");
  })();

  return (
    <header
      className={cn(
        "sticky top-0 z-40 w-full transition-all duration-200",
        isScrolled
          ? "bg-white/95 backdrop-blur-md shadow-[0_1px_3px_0_rgba(0,0,0,0.06)]"
          : "bg-white border-b border-slate-200"
      )}
    >
      <div className="flex items-center justify-between h-16 px-3 sm:px-4 md:px-6 gap-2">
        {/* ── Left: Menu toggle + Brand ── */}
        <div className="flex items-center gap-2 md:gap-3 min-w-0">
          {/* Mobile menu toggle */}
          <Button
            variant="ghost"
            size="icon"
            onClick={onMenuToggle}
            className="md:hidden h-9 w-9 rounded-lg hover:bg-slate-100"
            aria-label="Open menu"
          >
            <Menu className="h-[18px] w-[18px]" />
          </Button>

          {/* Logo + School name */}
          <Link href={`/${role}`} className="flex items-center gap-2.5 group">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-blue-600 to-blue-700 shadow-sm group-hover:shadow transition-shadow flex-shrink-0">
              <School className="h-[18px] w-[18px] text-white" />
            </div>
            <div className="hidden sm:flex flex-col">
              <span className="text-sm font-bold text-slate-900 leading-tight">
                {schoolName}
              </span>
              <span className="text-[10px] text-slate-500 leading-tight uppercase tracking-wider font-medium">
                {ROLE_LABELS[role] || "Portal"}
              </span>
            </div>
          </Link>

          {/* Current page indicator (mobile) */}
          <span className="md:hidden text-sm font-semibold text-slate-900 truncate max-w-[120px]">
            {currentPage}
          </span>
        </div>

        {/* ── Center: Search (desktop) ── */}
        <div className="hidden md:flex flex-1 items-center justify-center px-4 max-w-lg mx-auto">
          <SearchCommand role={role} />
        </div>

        {/* ── Right: Quick actions + Notifications + Profile ── */}
        <div className="flex items-center gap-0.5 sm:gap-1">
          {/* Mobile search trigger */}
          <div className="md:hidden">
            <SearchCommand role={role} />
          </div>

          {/* Quick Actions (desktop) */}
          <div className="hidden sm:block">
            <QuickActionsMenu role={role} />
          </div>

          <Separator orientation="vertical" className="h-6 mx-1 hidden sm:block" />

          {/* Notifications */}
          <NotificationBell role={role} />

          {/* Profile */}
          <ProfileDropdown role={role} />
        </div>
      </div>
    </header>
  );
}
