"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  GraduationCap,
  BookOpen,
  Users,
  CalendarCheck,
  School,
  BarChart3,
  Shield,
  Bell,
  ChevronRight,
  Star,
  CheckCircle2,
  ArrowUpRight,
  Menu,
  X,
  ChevronDown,
  Layers,
  ClipboardList,
  UserCheck,
  Phone,
  Mail,
  MapPin,
  Sparkles,
  Rocket,
  Globe,
  Award,
  HeartHandshake,
  TrendingUp,
  Clock,
  FileText,
  MessageSquare,
  Database,
} from "lucide-react";

const features = [
  {
    icon: BookOpen,
    title: "Curriculum & Subjects",
    description:
      "Comprehensive subject management with flexible allocation, optional/compulsory tracking, and multi-level curriculum mapping.",
    gradient: "from-blue-600 to-blue-400",
  },
  {
    icon: Users,
    title: "Student Management",
    description:
      "End-to-end student lifecycle tracking — admissions, attendance, performance analytics, promotions, and behavioral records.",
    gradient: "from-emerald-600 to-emerald-400",
  },
  {
    icon: ClipboardList,
    title: "Assessments & Grading",
    description:
      "Flexible assessment engine supporting continuous assessment, terminal exams, GPA computation, and automated report cards.",
    gradient: "from-purple-600 to-purple-400",
  },
  {
    icon: CalendarCheck,
    title: "Timetable & Scheduling",
    description:
      "Intelligent timetable generation with teacher allocation, room management, period slots, and real-time conflict detection.",
    gradient: "from-orange-600 to-orange-400",
  },
  {
    icon: BarChart3,
    title: "Analytics & Reports",
    description:
      "Rich dashboards with performance trends, grade distribution charts, pass rate analysis, and exportable PDF reports.",
    gradient: "from-rose-600 to-rose-400",
  },
  {
    icon: Bell,
    title: "Notifications & Alerts",
    description:
      "Multi-channel communication via SMS, email, and push notifications — attendance alerts, exam reminders, and school broadcasts.",
    gradient: "from-cyan-600 to-cyan-400",
  },
  {
    icon: Shield,
    title: "Role-Based Access",
    description:
      "Granular permissions across Admin, Teacher, Student, and Parent portals with secure authentication and session management.",
    gradient: "from-violet-600 to-violet-400",
  },
  {
    icon: Database,
    title: "Multi-Tenant Architecture",
    description:
      "Purpose-built for school groups and districts — each school operates independently with isolated data on a unified platform.",
    gradient: "from-indigo-600 to-indigo-400",
  },
  {
    icon: FileText,
    title: "Finance & Payroll",
    description:
      "Tuition fee management, payment tracking, invoice generation, staff payroll processing, and financial reporting.",
    gradient: "from-amber-600 to-amber-400",
  },
];

const portals = [
  {
    role: "Admin",
    href: "/admin/login",
    description:
      "Full administrative control — manage users, configure academic structure, oversee operations, and generate institutional reports.",
    icon: School,
    stats: ["School Config", "Staff Management", "Finance", "Analytics"],
    gradient: "from-slate-900 to-slate-700",
  },
  {
    role: "Teacher",
    href: "/teacher/login",
    description:
      "Manage classes, record assessments, track attendance, communicate with parents, and monitor student progress daily.",
    icon: UserCheck,
    stats: ["Gradebook", "Attendance", "Lesson Plans", "Analytics"],
    gradient: "from-blue-700 to-blue-500",
  },
  {
    role: "Student",
    href: "/student/login",
    description:
      "View grades, check timetables, track attendance records, access learning materials, and receive school announcements.",
    icon: GraduationCap,
    stats: ["Results", "Timetable", "Assignments", "Progress"],
    gradient: "from-emerald-700 to-emerald-500",
  },
  {
    role: "Parent",
    href: "/parent/login",
    description:
      "Stay connected with your child's academic journey — monitor performance, attendance, fee status, and school communications.",
    icon: HeartHandshake,
    stats: ["Performance", "Attendance", "Payments", "Messages"],
    gradient: "from-amber-700 to-amber-500",
  },
];

const stats = [
  { value: "10,000+", label: "Students Managed", icon: Users },
  { value: "500+", label: "Schools Onboarded", icon: School },
  { value: "50,000+", label: "Reports Generated", icon: FileText },
  { value: "99.9%", label: "Platform Uptime", icon: TrendingUp },
];

function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled
          ? "bg-white/90 backdrop-blur-xl border-b border-gray-200/60 shadow-sm"
          : "bg-transparent"
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 sm:h-20">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="relative flex items-center justify-center w-9 h-9 rounded-xl bg-gradient-to-br from-blue-600 to-blue-400 shadow-md group-hover:shadow-lg transition-all duration-300 group-hover:scale-105">
              <GraduationCap className="h-5 w-5 text-white" />
            </div>
            <div className="flex flex-col">
              <span className="text-lg font-bold tracking-tight text-gray-900 leading-none">
                School Hub
              </span>
              <span className="text-[10px] font-medium text-blue-600 leading-none tracking-wider uppercase mt-0.5">
                Multi-Tenant Platform
              </span>
            </div>
          </Link>

          {/* Desktop Nav */}
          <nav className="hidden md:flex items-center gap-1">
            {[
              { label: "Features", href: "#features" },
              { label: "Portals", href: "#portals" },
              { label: "About", href: "#about" },
            ].map((item) => (
              <Link
                key={item.label}
                href={item.href}
                className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 rounded-lg hover:bg-gray-100/70 transition-all duration-200"
              >
                {item.label}
              </Link>
            ))}
            <div className="ml-3 flex items-center gap-2">
              <Link href="/admin/login">
                <Button variant="outline" size="sm" className="h-9 rounded-xl text-xs font-medium">
                  Sign In
                </Button>
              </Link>
              <Link href="/admin/login">
                <Button size="sm" className="h-9 rounded-xl text-xs font-medium bg-blue-600 hover:bg-blue-700 text-white shadow-sm">
                  Get Started
                </Button>
              </Link>
            </div>
          </nav>

          {/* Mobile Toggle */}
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="md:hidden flex items-center justify-center w-10 h-10 rounded-xl text-gray-600 hover:bg-gray-100 transition-colors"
            aria-label="Toggle navigation"
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      <div
        className={`md:hidden overflow-hidden transition-all duration-300 ease-in-out ${
          mobileOpen ? "max-h-96 opacity-100" : "max-h-0 opacity-0"
        }`}
      >
        <div className="bg-white border-t border-gray-100 px-4 py-4 space-y-1">
          {[
            { label: "Features", href: "#features" },
            { label: "Portals", href: "#portals" },
            { label: "About", href: "#about" },
          ].map((item) => (
            <Link
              key={item.label}
              href={item.href}
              onClick={() => setMobileOpen(false)}
              className="block px-4 py-2.5 text-sm font-medium text-gray-600 hover:text-gray-900 rounded-lg hover:bg-gray-100 transition-colors"
            >
              {item.label}
            </Link>
          ))}
          <div className="pt-3 space-y-2">
            <Link href="/admin/login" className="block">
              <Button variant="outline" className="w-full h-10 rounded-xl text-sm">
                Sign In
              </Button>
            </Link>
            <Link href="/admin/login" className="block">
              <Button className="w-full h-10 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm">
                Get Started
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </header>
  );
}

function FeatureCard({
  icon: Icon,
  title,
  description,
  gradient,
}: {
  icon: any;
  title: string;
  description: string;
  gradient: string;
}) {
  return (
    <div className="group relative bg-white rounded-2xl border border-gray-100 p-6 hover:shadow-xl hover:border-gray-200 transition-all duration-300 hover:-translate-y-1">
      <div className="relative z-10">
        <div
          className={`inline-flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-br ${gradient} shadow-sm mb-4`}
        >
          <Icon className="h-6 w-6 text-white" />
        </div>
        <h3 className="text-base font-semibold text-gray-900 mb-2 group-hover:text-blue-600 transition-colors">
          {title}
        </h3>
        <p className="text-sm text-gray-500 leading-relaxed">{description}</p>
      </div>
      <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-gray-50/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
    </div>
  );
}

function PortalCard({
  role,
  href,
  description,
  icon: Icon,
  stats,
  gradient,
}: {
  role: string;
  href: string;
  description: string;
  icon: any;
  stats: string[];
  gradient: string;
}) {
  return (
    <Link href={href} className="group block">
      <div className="relative bg-white rounded-2xl border border-gray-100 p-6 hover:shadow-xl hover:border-gray-200 transition-all duration-300 hover:-translate-y-1 overflow-hidden">
        {/* Gradient accent line */}
        <div className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${gradient} opacity-60 group-hover:opacity-100 transition-opacity`} />

        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-3">
            <div
              className={`inline-flex items-center justify-center w-11 h-11 rounded-xl bg-gradient-to-br ${gradient} shadow-sm`}
            >
              <Icon className="h-5 w-5 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-900 group-hover:text-blue-600 transition-colors">
                {role} Portal
              </h3>
              <Badge
                variant="outline"
                className="text-[10px] font-medium px-2 py-0 h-5 border-blue-200 text-blue-600 bg-blue-50/50"
              >
                {role === "Admin"
                  ? "Full Access"
                  : role === "Teacher"
                  ? "Instruction"
                  : role === "Student"
                  ? "Learning"
                  : "Guardian"}
              </Badge>
            </div>
            <ArrowUpRight className="h-4 w-4 text-gray-300 group-hover:text-blue-500 ml-auto transition-all duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
          </div>
          <p className="text-sm text-gray-500 leading-relaxed mb-4">{description}</p>
          <div className="flex flex-wrap gap-1.5">
            {stats.map((s) => (
              <span
                key={s}
                className="inline-flex items-center px-2.5 py-1 rounded-lg bg-gray-50 text-[11px] font-medium text-gray-600 border border-gray-100"
              >
                {s}
              </span>
            ))}
          </div>
        </div>
      </div>
    </Link>
  );
}

export default function LandingPage() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <div className="min-h-screen bg-white">
      <Navbar />

      {/* ── Hero Section ── */}
      <section className="relative pt-28 sm:pt-32 pb-20 sm:pb-28 overflow-hidden">
        {/* Background decorative elements */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 -right-40 w-[600px] h-[600px] rounded-full bg-gradient-to-br from-blue-50/80 to-purple-50/80 blur-3xl" />
          <div className="absolute -bottom-20 -left-40 w-[500px] h-[500px] rounded-full bg-gradient-to-tr from-emerald-50/80 to-cyan-50/80 blur-3xl" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] rounded-full bg-gradient-to-r from-blue-50/30 to-indigo-50/30 blur-3xl" />

          {/* Grid pattern overlay */}
          <div
            className="absolute inset-0 opacity-[0.015]"
            style={{
              backgroundImage: `radial-gradient(circle at 1px 1px, #000 1px, transparent 0)`,
              backgroundSize: "40px 40px",
            }}
          />
        </div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-4xl mx-auto text-center">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-blue-50 border border-blue-100 mb-6 animate-in fade-in duration-700">
              <Sparkles className="h-3.5 w-3.5 text-blue-500" />
              <span className="text-xs font-medium text-blue-700">
                Multi-Tenant School Management Platform
              </span>
            </div>

            {/* Headline */}
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-gray-900 leading-[1.1] mb-6">
              One Platform to{" "}
              <span className="bg-gradient-to-r from-blue-600 to-blue-400 bg-clip-text text-transparent">
                Manage Every School
              </span>
              <br />
              in Your Network
            </h1>

            {/* Subtitle */}
            <p className="text-lg sm:text-xl text-gray-500 max-w-2xl mx-auto leading-relaxed mb-10">
              A powerful, multi-tenant school management system designed for school groups,
              districts, and education organizations. Manage academics, operations, finance, and
              communications from a single unified dashboard.
            </p>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4">
              <Link href="/admin/login">
                <Button className="h-12 px-8 rounded-xl text-sm font-semibold bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-200 hover:shadow-xl hover:shadow-blue-300 transition-all duration-300">
                  Get Started Free
                  <Rocket className="ml-2 h-4 w-4" />
                </Button>
              </Link>
              <Link href="#features">
                <Button
                  variant="outline"
                  className="h-12 px-8 rounded-xl text-sm font-semibold border-gray-200 hover:bg-gray-50"
                >
                  Explore Features
                  <ChevronDown className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            </div>

            {/* Trust indicators */}
            <div className="mt-12 flex flex-wrap items-center justify-center gap-6 sm:gap-10 text-sm text-gray-400">
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                <span>No credit card required</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Shield className="h-4 w-4 text-emerald-500" />
                <span>Enterprise-grade security</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Clock className="h-4 w-4 text-emerald-500" />
                <span>99.9% uptime SLA</span>
              </div>
            </div>

            {/* Preview / Screenshot mockup */}
            <div className="mt-16 relative">
              <div className="absolute inset-0 bg-gradient-to-t from-white via-transparent to-transparent z-10 pointer-events-none" />
              <div className="relative bg-gradient-to-b from-gray-50 to-white rounded-2xl border border-gray-100 shadow-2xl overflow-hidden">
                <div className="flex items-center gap-1.5 px-4 py-3 bg-gray-50 border-b border-gray-100">
                  <div className="w-3 h-3 rounded-full bg-red-400" />
                  <div className="w-3 h-3 rounded-full bg-yellow-400" />
                  <div className="w-3 h-3 rounded-full bg-emerald-400" />
                  <span className="ml-3 text-[11px] text-gray-400 font-mono">schhub.app</span>
                </div>
                <div className="grid grid-cols-3 gap-px bg-gray-100">
                  {/* Dashboard mockup */}
                  <div className="col-span-2 bg-white p-6 space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="h-4 w-32 bg-gray-200 rounded-full" />
                      <div className="h-6 w-20 bg-blue-100 rounded-lg" />
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      {[60, 40, 80].map((pct, i) => (
                        <div key={i} className="h-20 rounded-xl bg-gradient-to-br from-gray-50 to-gray-100 p-3">
                          <div className="h-2 w-12 bg-gray-200 rounded-full mb-2" />
                          <div className="h-5 w-16 bg-gray-300 rounded-full" />
                        </div>
                      ))}
                    </div>
                    <div className="h-32 rounded-xl bg-gradient-to-br from-blue-50/50 to-purple-50/50 border border-blue-100/50 p-4">
                      <div className="flex items-center gap-4 h-full">
                        <div className="w-1/2 space-y-2">
                          <div className="h-2 w-20 bg-blue-200 rounded-full" />
                          <div className="h-2 w-full bg-blue-100 rounded-full" />
                          <div className="h-2 w-3/4 bg-blue-100 rounded-full" />
                          <div className="h-2 w-1/2 bg-blue-100 rounded-full" />
                        </div>
                        <div className="w-1/2 h-full rounded-lg bg-gradient-to-t from-blue-200/50 to-transparent" />
                      </div>
                    </div>
                  </div>
                  <div className="bg-white p-4 space-y-3 border-l border-gray-100">
                    <div className="h-3 w-16 bg-gray-200 rounded-full" />
                    {[
                      { width: "w-20" },
                      { width: "w-24" },
                      { width: "w-32" },
                      { width: "w-20" },
                      { width: "w-28" },
                    ].map((item, i) => (
                      <div key={i} className="h-6 rounded-lg bg-gray-50 flex items-center px-2">
                        <div className={`h-1.5 ${item.width} bg-gray-200 rounded-full`} />
                      </div>
                    ))}
                    <div className="h-8 rounded-lg bg-blue-600 mt-4" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Stats Section ── */}
      <section className="py-16 sm:py-20 bg-gradient-to-b from-gray-50 to-white border-y border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 sm:gap-10">
            {stats.map((stat) => (
              <div key={stat.label} className="text-center group">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-blue-50 mb-3 group-hover:bg-blue-100 transition-colors">
                  <stat.icon className="h-6 w-6 text-blue-600" />
                </div>
                <div className="text-3xl sm:text-4xl font-bold text-gray-900 mb-1">{stat.value}</div>
                <div className="text-sm text-gray-500 font-medium">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features Section ── */}
      <section id="features" className="py-20 sm:py-28">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl mx-auto text-center mb-14 sm:mb-16">
            <Badge
              variant="outline"
              className="mb-4 px-4 py-1.5 border-blue-200 text-blue-600 bg-blue-50/50 text-xs font-medium"
            >
              <Award className="h-3.5 w-3.5 mr-1.5" />
              Everything You Need
            </Badge>
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
              Powerful Features for Modern Schools
            </h2>
            <p className="text-gray-500 leading-relaxed">
              From curriculum planning to financial management, School Hub provides a complete
              toolkit to run your educational institution efficiently.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6">
            {features.map((feature) => (
              <FeatureCard key={feature.title} {...feature} />
            ))}
          </div>
        </div>
      </section>

      {/* ── Portal Access Section ── */}
      <section id="portals" className="py-20 sm:py-28 bg-gradient-to-b from-gray-50 to-white border-y border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl mx-auto text-center mb-14 sm:mb-16">
            <Badge
              variant="outline"
              className="mb-4 px-4 py-1.5 border-purple-200 text-purple-600 bg-purple-50/50 text-xs font-medium"
            >
              <Globe className="h-3.5 w-3.5 mr-1.5" />
              Role-Based Portals
            </Badge>
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
              One Platform, Four Perspectives
            </h2>
            <p className="text-gray-500 leading-relaxed">
              Every stakeholder gets a tailored experience — with the right tools, data, and
              permissions for their role.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {portals.map((portal) => (
              <PortalCard key={portal.role} {...portal} />
            ))}
          </div>
        </div>
      </section>

      {/* ── About Section ── */}
      <section id="about" className="py-20 sm:py-28">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
            <div>
              <Badge
                variant="outline"
                className="mb-4 px-4 py-1.5 border-emerald-200 text-emerald-600 bg-emerald-50/50 text-xs font-medium"
              >
                <Sparkles className="h-3.5 w-3.5 mr-1.5" />
                Why School Hub?
              </Badge>
              <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
                Built for School Groups &amp; Multi-Campus Networks
              </h2>
              <p className="text-gray-500 leading-relaxed mb-6">
                School Hub is purpose-built for education organizations that manage multiple schools.
                Each school gets its own isolated environment with shared oversight, centralized
                reporting, and consistent academic standards across the network.
              </p>

              <div className="space-y-4">
                {[
                  { icon: Layers, text: "Fully isolated multi-tenant data architecture" },
                  { icon: Shield, text: "Role-based permissions with granular access control" },
                  { icon: TrendingUp, text: "Cross-school analytics and comparative reporting" },
                  { icon: MessageSquare, text: "Unified communication across all stakeholders" },
                ].map((item) => (
                  <div key={item.text} className="flex items-start gap-3">
                    <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center mt-0.5">
                      <item.icon className="h-4 w-4 text-blue-600" />
                    </div>
                    <span className="text-sm text-gray-600 pt-1.5">{item.text}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="relative">
              {/* Decorative elements */}
              <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full bg-gradient-to-br from-blue-100 to-purple-100 blur-2xl opacity-60" />
              <div className="absolute -bottom-8 -left-8 w-32 h-32 rounded-full bg-gradient-to-tr from-emerald-100 to-cyan-100 blur-2xl opacity-60" />

              <div className="relative bg-gradient-to-br from-gray-50 to-white rounded-2xl border border-gray-100 p-8 shadow-lg">
                <div className="space-y-6">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-blue-600 shadow-md">
                      <GraduationCap className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-gray-900">Centralized Dashboard</div>
                      <div className="text-xs text-gray-400">Monitor all schools from one place</div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { label: "Total Schools", value: "12" },
                      { label: "Active Students", value: "8,450" },
                      { label: "Staff Members", value: "520" },
                      { label: "Avg. Pass Rate", value: "87%" },
                    ].map((d) => (
                      <div
                        key={d.label}
                        className="bg-white rounded-xl border border-gray-100 p-3.5"
                      >
                        <div className="text-xs text-gray-400 mb-0.5">{d.label}</div>
                        <div className="text-lg font-bold text-gray-900">{d.value}</div>
                      </div>
                    ))}
                  </div>

                  <div className="h-24 rounded-xl bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-100/50 p-4">
                    <div className="text-xs font-medium text-gray-500 mb-2">
                      Performance Trend
                    </div>
                    <div className="flex items-end gap-2 h-14">
                      {[35, 50, 45, 65, 55, 75, 70, 85, 80, 90, 88, 95].map((h, i) => (
                        <div
                          key={i}
                          className="flex-1 rounded-t bg-gradient-to-t from-blue-400 to-blue-300 transition-all duration-500"
                          style={{ height: `${h}%` }}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── CTA Section ── */}
      <section className="py-20 sm:py-28 bg-gradient-to-br from-gray-900 via-gray-900 to-gray-800 relative overflow-hidden">
        {/* Decorative dots */}
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage: `radial-gradient(circle at 1px 1px, #fff 1px, transparent 0)`,
            backgroundSize: "32px 32px",
          }}
        />
        <div className="absolute -top-40 -right-40 w-[500px] h-[500px] rounded-full bg-gradient-to-br from-blue-500/10 to-purple-500/10 blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-[500px] h-[500px] rounded-full bg-gradient-to-tr from-emerald-500/10 to-cyan-500/10 blur-3xl" />

        <div className="relative max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/10 border border-white/10 mb-6">
            <Rocket className="h-3.5 w-3.5 text-blue-300" />
            <span className="text-xs font-medium text-blue-200">Start your journey today</span>
          </div>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white mb-4">
            Ready to Transform Your School Network?
          </h2>
          <p className="text-gray-400 text-lg leading-relaxed mb-8 max-w-xl mx-auto">
            Join hundreds of schools already using School Hub to streamline operations, improve
            academic outcomes, and connect their entire community.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link href="/admin/login">
              <Button className="h-12 px-8 rounded-xl text-sm font-semibold bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-500/20 hover:shadow-xl hover:shadow-blue-500/30 transition-all duration-300">
                Start Free Trial
                <Rocket className="ml-2 h-4 w-4" />
              </Button>
            </Link>
            <Link href="/admin/login">
              <Button
                variant="outline"
                className="h-12 px-8 rounded-xl text-sm font-semibold border-white/10 text-gray-300 hover:bg-white/5 hover:text-white"
              >
                Schedule a Demo
                <ChevronRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="bg-gray-900 border-t border-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-12">
            {/* Brand */}
            <div className="sm:col-span-2 lg:col-span-1">
              <div className="flex items-center gap-2.5 mb-4">
                <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-gradient-to-br from-blue-600 to-blue-400">
                  <GraduationCap className="h-4 w-4 text-white" />
                </div>
                <span className="text-base font-bold text-white">School Hub</span>
              </div>
              <p className="text-sm text-gray-400 leading-relaxed mb-4 max-w-xs">
                A comprehensive multi-tenant school management platform for modern education
                organizations.
              </p>
              <div className="flex items-center gap-3">
                {[
                  { icon: Star, color: "text-yellow-400" },
                  { icon: Star, color: "text-yellow-400" },
                  { icon: Star, color: "text-yellow-400" },
                  { icon: Star, color: "text-yellow-400" },
                  { icon: Star, color: "text-gray-600" },
                ].map((s, i) => (
                  <s.icon key={i} className={`h-4 w-4 ${s.color}`} />
                ))}
                <span className="text-xs text-gray-500 ml-1">4.8/5</span>
              </div>
            </div>

            {/* Product */}
            <div>
              <h4 className="text-xs font-semibold text-gray-300 uppercase tracking-wider mb-4">
                Product
              </h4>
              <ul className="space-y-2.5">
                {["Features", "Pricing", "Integrations", "Changelog", "API Docs"].map((item) => (
                  <li key={item}>
                    <Link
                      href="#"
                      className="text-sm text-gray-500 hover:text-gray-300 transition-colors"
                    >
                      {item}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            {/* Company */}
            <div>
              <h4 className="text-xs font-semibold text-gray-300 uppercase tracking-wider mb-4">
                Company
              </h4>
              <ul className="space-y-2.5">
                {["About", "Blog", "Careers", "Press Kit", "Partners"].map((item) => (
                  <li key={item}>
                    <Link
                      href="#"
                      className="text-sm text-gray-500 hover:text-gray-300 transition-colors"
                    >
                      {item}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            {/* Contact */}
            <div>
              <h4 className="text-xs font-semibold text-gray-300 uppercase tracking-wider mb-4">
                Contact
              </h4>
              <ul className="space-y-3">
                <li className="flex items-start gap-2.5">
                  <Mail className="h-4 w-4 text-gray-500 mt-0.5 flex-shrink-0" />
                  <span className="text-sm text-gray-500">hello@schhub.app</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <Phone className="h-4 w-4 text-gray-500 mt-0.5 flex-shrink-0" />
                  <span className="text-sm text-gray-500">+1 (555) 123-4567</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <MapPin className="h-4 w-4 text-gray-500 mt-0.5 flex-shrink-0" />
                  <span className="text-sm text-gray-500">
                    123 Education Ave, Suite 200
                    <br />
                    San Francisco, CA 94105
                  </span>
                </li>
              </ul>
            </div>
          </div>

          <div className="mt-12 pt-8 border-t border-gray-800 flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-xs text-gray-600">
              &copy; {new Date().getFullYear()} School Hub. All rights reserved.
            </p>
            <div className="flex items-center gap-4">
              {["Privacy Policy", "Terms of Service", "Cookie Policy"].map((item) => (
                <Link
                  key={item}
                  href="#"
                  className="text-xs text-gray-600 hover:text-gray-400 transition-colors"
                >
                  {item}
                </Link>
              ))}
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
