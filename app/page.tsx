"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  GraduationCap,
  CheckCircle2,
  Shield,
  Clock,
  ArrowUpRight,
  Menu,
  X,
  Palette,
  ChevronDown,
  ChevronRight,
  Sparkles,
  Rocket,
  Globe,
  Users,
  School,
  FileText,
  TrendingUp,
  Star,
  Phone,
  Mail,
  MapPin,
  Bot,
  BookOpen,
  Smartphone,
  QrCode,
  CreditCard,
  CalendarCheck,
  BarChart3,
  Bell,
  HeartHandshake,
  MessageSquare,
  UserCheck,
  Wallet,
  Quote,
} from "lucide-react";

/* ═══════════════════════════════════════
   ANIMATION HOOK
═══════════════════════════════════════ */

function useReveal(threshold = 0.15) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.unobserve(el);
        }
      },
      { threshold }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [threshold]);

  return { ref, visible };
}

/* ═══════════════════════════════════════
   COUNTER HOOK
═══════════════════════════════════════ */

function useCountUp(end: number, duration = 2000, startOn = true) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!startOn) return;

    let startTime: number | null = null;
    let raf: number;

    const step = (ts: number) => {
      if (!startTime) startTime = ts;
      const elapsed = ts - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // ease-out quart
      const eased = 1 - Math.pow(1 - progress, 3);
      setCount(Math.round(eased * end));
      if (progress < 1) raf = requestAnimationFrame(step);
    };

    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [end, duration, startOn]);

  return end >= 1000 ? count.toLocaleString() : count + (end === 100 ? "%" : "+");
}

/* ═══════════════════════════════════════
   DEVICE MOCKUPS
═══════════════════════════════════════ */

function BrowserFrame({
  src,
  gradient,
  icon: Icon,
  label,
  aspectRatio = "aspect-[16/10]",
}: {
  src?: string;
  gradient: string;
  icon: any;
  label: string;
  aspectRatio?: string;
}) {
  const [imgLoaded, setImgLoaded] = useState(false);
  const [imgError, setImgError] = useState(false);

  return (
    <div className="relative w-full overflow-hidden rounded-xl border border-gray-200/80 bg-white shadow-xl shadow-gray-200/40 transition-all duration-500 hover:shadow-2xl hover:shadow-gray-300/40">
      {/* Browser chrome */}
      <div className="flex items-center gap-1.5 border-b border-gray-100 bg-gray-50/80 px-4 py-3">
        <div className="flex items-center gap-1.5">
          <div className="h-3 w-3 rounded-full bg-red-400" />
          <div className="h-3 w-3 rounded-full bg-yellow-400" />
          <div className="h-3 w-3 rounded-full bg-emerald-400" />
        </div>
        <div className="mx-auto flex max-w-[60%] items-center gap-2 rounded-md bg-white px-3 py-1.5 shadow-sm">
          <Shield className="h-3 w-3 text-emerald-500" />
          <span className="truncate text-[11px] font-medium text-gray-500">
            app.schoolhub.com
          </span>
        </div>
      </div>

      {/* Content */}
      <div className={`relative ${aspectRatio} overflow-hidden bg-gray-50`}>
        {/* Real image */}
        {src && !imgError && (
          <img
            src={src}
            alt={label}
            className={`absolute inset-0 h-full w-full object-cover object-top transition-opacity duration-500 ${
              imgLoaded ? "opacity-100" : "opacity-0"
            }`}
            onLoad={() => setImgLoaded(true)}
            onError={() => setImgError(true)}
          />
        )}

        {/* Gradient placeholder */}
        {(!src || imgError || !imgLoaded) && (
          <div
            className={`absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br ${gradient} p-6 transition-opacity duration-500`}
          >
            <div className="mb-3 rounded-2xl bg-white/20 p-4 backdrop-blur-sm">
              <Icon className="h-10 w-10 text-white" />
            </div>
            <p className="text-center text-sm font-medium text-white/80">
              {label}
            </p>
            <p className="mt-1 text-center text-xs text-white/50">
              Replace with your screenshot
            </p>

            {/* Skeleton UI elements for realistic feel */}
            <div className="mt-6 w-full max-w-xs space-y-3">
              <div className="h-2 w-3/4 rounded-full bg-white/20" />
              <div className="h-2 w-full rounded-full bg-white/10" />
              <div className="h-2 w-2/3 rounded-full bg-white/10" />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function PhoneFrame({
  src,
  gradient,
  icon: Icon,
  label,
}: {
  src?: string;
  gradient: string;
  icon: any;
  label: string;
}) {
  const [imgLoaded, setImgLoaded] = useState(false);
  const [imgError, setImgError] = useState(false);

  return (
    <div className="relative mx-auto w-[220px] sm:w-[260px]">
      {/* Phone body */}
      <div className="relative overflow-hidden rounded-[2.5rem] border-[3px] border-gray-800 bg-gray-900 shadow-2xl shadow-gray-300/30">
        {/* Notch */}
        <div className="absolute left-1/2 top-0 z-10 h-5 w-28 -translate-x-1/2 rounded-b-2xl bg-gray-800" />

        {/* Screen */}
        <div className="relative aspect-[9/19.5] overflow-hidden bg-gray-800">
          {src && !imgError && (
            <img
              src={src}
              alt={label}
              className={`absolute inset-0 h-full w-full object-cover object-top transition-opacity duration-500 ${
                imgLoaded ? "opacity-100" : "opacity-0"
              }`}
              onLoad={() => setImgLoaded(true)}
              onError={() => setImgError(true)}
            />
          )}

          {(!src || imgError || !imgLoaded) && (
            <div
              className={`flex h-full flex-col items-center justify-center bg-gradient-to-br ${gradient} p-6 transition-opacity duration-500`}
            >
              <div className="mb-3 rounded-2xl bg-white/20 p-4 backdrop-blur-sm">
                <Icon className="h-8 w-8 text-white" />
              </div>
              <p className="text-center text-sm font-medium text-white/80">
                {label}
              </p>
              <p className="mt-1 text-center text-xs text-white/50">
                Add screenshot
              </p>
              <div className="mt-6 w-full space-y-2">
                <div className="h-1.5 w-full rounded-full bg-white/20" />
                <div className="h-1.5 w-3/4 rounded-full bg-white/10" />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════
   NAVBAR
═══════════════════════════════════════ */

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
              { label: "Pricing", href: "/subscription" },
              { label: "Portals", href: "#portals" },
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
              <Link href="/register">
                <Button size="sm" className="h-9 rounded-xl text-xs font-medium bg-white text-gray-700 border border-gray-200 hover:bg-gray-50 hover:border-gray-300 shadow-sm">
                  Register your school
                </Button>
              </Link>
              <Link href="/subscription">
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
            { label: "Pricing", href: "/subscription" },
            { label: "Portals", href: "#portals" },
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
            <Link href="/register" className="block">
              <Button variant="outline" className="w-full h-10 rounded-xl text-sm border-gray-200 hover:bg-gray-50">
                Register your school
              </Button>
            </Link>
            <Link href="/subscription" className="block">
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

/* ═══════════════════════════════════════
   FEATURE SECTION WRAPPER
═══════════════════════════════════════ */

function FeatureSection({
  id,
  reversed,
  dark,
  badge,
  title,
  description,
  bullets,
  media,
}: {
  id?: string;
  reversed?: boolean;
  dark?: boolean;
  badge: string;
  title: string;
  description: string;
  bullets: { icon: any; text: string }[];
  media: React.ReactNode;
}) {
  const { ref, visible } = useReveal(0.1);

  return (
    <section
      id={id}
      className={`relative py-20 sm:py-28 overflow-hidden ${
        dark
          ? "bg-gradient-to-br from-gray-900 via-gray-900 to-gray-800"
          : "bg-white"
      }`}
    >
      {/* Background decoration */}
      {dark && (
        <div className="absolute inset-0 pointer-events-none">
          <div
            className="absolute inset-0 opacity-[0.03]"
            style={{
              backgroundImage: `radial-gradient(circle at 1px 1px, #fff 1px, transparent 0)`,
              backgroundSize: "32px 32px",
            }}
          />
          <div className="absolute -top-40 -right-40 w-[500px] h-[500px] rounded-full bg-gradient-to-br from-blue-500/10 to-purple-500/10 blur-3xl" />
          <div className="absolute -bottom-40 -left-40 w-[400px] h-[400px] rounded-full bg-gradient-to-tr from-emerald-500/10 to-cyan-500/10 blur-3xl" />
        </div>
      )}

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div
          ref={ref}
          className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center"
        >
          {/* Text side */}
          <div
            className={`space-y-6 transition-all duration-700 ease-out ${
              visible
                ? "translate-y-0 opacity-100"
                : "translate-y-8 opacity-0"
            } ${reversed ? "lg:order-2" : "lg:order-1"}`}
          >
            <Badge
              variant="outline"
              className={`px-4 py-1.5 text-xs font-medium ${
                dark
                  ? "border-blue-400/30 text-blue-300 bg-blue-500/10"
                  : "border-blue-200 text-blue-600 bg-blue-50/50"
              }`}
            >
              <Sparkles
                className={`h-3.5 w-3.5 mr-1.5 ${
                  dark ? "text-blue-300" : "text-blue-500"
                }`}
              />
              {badge}
            </Badge>

            <h2
              className={`text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight leading-[1.1] ${
                dark ? "text-white" : "text-gray-900"
              }`}
            >
              {title}
            </h2>

            <p
              className={`text-lg leading-relaxed max-w-lg ${
                dark ? "text-gray-400" : "text-gray-500"
              }`}
            >
              {description}
            </p>

            <ul className="space-y-3 pt-2">
              {bullets.map((b, i) => (
                <li
                  key={i}
                  className={`flex items-start gap-3 transition-all duration-500 ease-out ${
                    visible
                      ? "translate-y-0 opacity-100"
                      : "translate-y-4 opacity-0"
                  }`}
                  style={{ transitionDelay: `${i * 100}ms` }}
                >
                  <div
                    className={`flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center mt-0.5 ${
                      dark
                        ? "bg-blue-500/20 text-blue-300"
                        : "bg-blue-50 text-blue-600"
                    }`}
                  >
                    <b.icon className="h-4 w-4" />
                  </div>
                  <span
                    className={`text-sm leading-relaxed pt-1 ${
                      dark ? "text-gray-300" : "text-gray-600"
                    }`}
                  >
                    {b.text}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          {/* Media side */}
          <div
            className={`transition-all duration-700 ease-out delay-200 ${
              visible
                ? "translate-y-0 opacity-100"
                : "translate-y-8 opacity-0"
            } ${reversed ? "lg:order-1" : "lg:order-2"}`}
          >
            {media}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════
   PORTAL CARD COMPONENT
═══════════════════════════════════════ */

function PortalCard({
  role,
  href,
  description,
  icon: Icon,
  stats,
  gradient,
  delay,
}: {
  role: string;
  href: string;
  description: string;
  icon: any;
  stats: string[];
  gradient: string;
  delay: number;
}) {
  const { ref, visible } = useReveal(0.1);

  return (
    <div
      ref={ref}
      className="group block transition-all duration-700 ease-out"
      style={{
        transform: visible ? "translateY(0)" : "translateY(24px)",
        opacity: visible ? 1 : 0,
        transitionDelay: `${delay}ms`,
      }}
    >
      <Link href={href}>
        <div className="relative bg-white rounded-2xl border border-gray-100 p-6 hover:shadow-xl hover:border-gray-200 transition-all duration-300 hover:-translate-y-1 overflow-hidden h-full">
          <div className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${gradient} opacity-60 group-hover:opacity-100 transition-opacity`} />
          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-3">
              <div className={`inline-flex items-center justify-center w-11 h-11 rounded-xl bg-gradient-to-br ${gradient} shadow-sm`}>
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
                  {role === "Admin" ? "Full Access" : role === "Teacher" ? "Instruction" : role === "Student" ? "Learning" : "Guardian"}
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
    </div>
  );
}

/* ═══════════════════════════════════════
   TESTIMONIAL CARD COMPONENT
═══════════════════════════════════════ */

function TestimonialCard({
  quote,
  author,
  role,
  delay,
}: {
  quote: string;
  author: string;
  role: string;
  delay: number;
}) {
  const { ref, visible } = useReveal(0.15);

  return (
    <div
      ref={ref}
      className="relative bg-white rounded-2xl border border-gray-100 p-6 sm:p-8 transition-all duration-700 ease-out"
      style={{
        transform: visible ? "translateY(0)" : "translateY(24px)",
        opacity: visible ? 1 : 0,
        transitionDelay: `${delay}ms`,
      }}
    >
      <Quote className="h-6 w-6 text-blue-200 mb-4" />
      <p className="text-sm text-gray-600 leading-relaxed mb-6">
        &ldquo;{quote}&rdquo;
      </p>
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center text-white text-sm font-bold">
          {author.charAt(0)}
        </div>
        <div>
          <p className="text-sm font-semibold text-gray-900">{author}</p>
          <p className="text-xs text-gray-500">{role}</p>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════
   MAIN PAGE
═══════════════════════════════════════ */

export default function LandingPage() {
  const [mounted, setMounted] = useState(false);
  const statsVisible = useReveal(0.3);

  useEffect(() => {
    setMounted(true);
  }, []);

  /* ── Scrolling stats counter ── */
  const Counter = ({ end, suffix = "" }: { end: number; suffix?: string }) => {
    const { ref: countRef, visible } = useReveal(0.5);
    const val = useCountUp(end, 2200, visible);
    return (
      <span ref={countRef} className="text-3xl sm:text-4xl font-bold text-gray-900 mb-1">
        {val}{suffix}
      </span>
    );
  };

  const stats = [
    { end: 10000, suffix: "+", label: "Students Managed", icon: Users },
    { end: 500, suffix: "+", label: "Schools Onboarded", icon: School },
    { end: 50000, suffix: "+", label: "Reports Generated", icon: FileText },
    { end: 99.9, suffix: "%", label: "Platform Uptime", icon: TrendingUp },
  ];

  return (
    <div className="min-h-screen bg-white">
      <Navbar />

      {/* ═══════════════════════════════════════
          HERO SECTION
      ═══════════════════════════════════════ */}
      <section className="relative pt-28 sm:pt-32 pb-16 sm:pb-24 overflow-hidden">
        {/* Decorative bg */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 -right-40 w-[700px] h-[700px] rounded-full bg-gradient-to-br from-blue-50/80 to-purple-50/80 blur-3xl" />
          <div className="absolute -bottom-20 -left-40 w-[500px] h-[500px] rounded-full bg-gradient-to-tr from-emerald-50/80 to-cyan-50/80 blur-3xl" />
          <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[900px] h-[900px] rounded-full bg-gradient-to-r from-blue-50/30 to-indigo-50/30 blur-3xl" />
          <div
            className="absolute inset-0 opacity-[0.015]"
            style={{
              backgroundImage: `radial-gradient(circle at 1px 1px, #000 1px, transparent 0)`,
              backgroundSize: "40px 40px",
            }}
          />
        </div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-4xl mx-auto text-center mb-12">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-blue-50 border border-blue-100 mb-6 animate-in fade-in duration-700">
              <Sparkles className="h-3.5 w-3.5 text-blue-500" />
              <span className="text-xs font-medium text-blue-700">
                Multi-Tenant School Management Platform
              </span>
            </div>

            {/* Headline */}
            <h1 className="text-4xl sm:text-5xl lg:text-7xl font-bold tracking-tight text-gray-900 leading-[1.05] mb-6">
              One Platform to{" "}
              <span className="bg-gradient-to-r from-blue-600 via-blue-500 to-indigo-500 bg-clip-text text-transparent">
                Manage Every School
              </span>
              <br />
              in Your Network
            </h1>

            <p className="text-lg sm:text-xl text-gray-500 max-w-2xl mx-auto leading-relaxed mb-10">
              A powerful, multi-tenant school management system designed for school groups,
              districts, and education organizations. Manage academics, operations, finance, and
              communications from a single unified dashboard.
            </p>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4">
              <Link href="/subscription">
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
            <div className="mt-10 flex flex-wrap items-center justify-center gap-6 sm:gap-10 text-sm text-gray-400">
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
          </div>

          {/* Hero screenshot */}
          <div className="max-w-5xl mx-auto">
            <BrowserFrame
              src="/landing/hero-dashboard.png"
              gradient="from-blue-600 via-indigo-600 to-purple-700"
              icon={BarChart3}
              label="Admin Dashboard Overview"
              aspectRatio="aspect-[16/9.5]"
            />
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════
          STATS SECTION
      ═══════════════════════════════════════ */}
      <section className="py-16 sm:py-20 bg-gradient-to-b from-gray-50 to-white border-y border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div
            ref={statsVisible.ref}
            className="grid grid-cols-2 md:grid-cols-4 gap-6 sm:gap-10"
          >
            {stats.map((stat, i) => (
              <div
                key={stat.label}
                className={`text-center group transition-all duration-700 ease-out ${
                  statsVisible.visible
                    ? "translate-y-0 opacity-100"
                    : "translate-y-8 opacity-0"
                }`}
                style={{ transitionDelay: `${i * 150}ms` }}
              >
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-blue-50 mb-3 group-hover:bg-blue-100 transition-colors">
                  <stat.icon className="h-6 w-6 text-blue-600" />
                </div>
                <div className="text-3xl sm:text-4xl font-bold text-gray-900 mb-1">
                  <Counter end={stat.end} suffix={stat.suffix} />
                </div>
                <div className="text-sm text-gray-500 font-medium">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════
          FEATURE SECTIONS
      ═══════════════════════════════════════ */}

      {/* ── 1. School Website Builder ── */}
      <FeatureSection
        id="features"
        badge="No-Code Website Builder"
        title="Give Your School a Professional Online Presence in Minutes"
        description="Create stunning school websites without a single line of code. Showcase admissions, alumni achievements, facilities, faculty, and more — all managed from one dashboard."
        bullets={[
          { icon: Globe, text: "Fully customizable school website with drag-and-drop sections" },
          { icon: UserCheck, text: "Admissions portal, alumni showcase, faculty directory, and gallery" },
          { icon: MapPin, text: "Auto-generated contact pages with maps, hours, and social links" },
          { icon: Palette, text: "Multiple color themes, custom branding, and mobile-responsive design" },
        ]}
        media={
          <div className="flex items-end justify-center gap-4">
            <div className="flex-1">
              <BrowserFrame
                src="/landing/school-website.png"
                gradient="from-emerald-600 to-teal-600"
                icon={Globe}
                label="Generated School Website"
              />
            </div>
            <div className="hidden sm:block w-1/3 -mb-4">
              <PhoneFrame
                src="/landing/school-website.png"
                gradient="from-emerald-700 to-teal-700"
                icon={Smartphone}
                label="Mobile View"
              />
            </div>
          </div>
        }
      />

      {/* ── 2. AI-Powered Tools ── */}
      <FeatureSection
        reversed
        dark
        badge="AI-Powered Platform"
        title="AI That Works For Your School — From Lesson Notes to Chatbots"
        description="Leverage artificial intelligence to reduce teacher workload, generate question banks, create lesson notes, and provide instant answers to parents and students through an intelligent chatbot."
        bullets={[
          { icon: Bot, text: "School Deck AI — chat with your school data for instant insights" },
          { icon: BookOpen, text: "AI-powered question bank generator from any topic or subject" },
          { icon: FileText, text: "Automated lesson note creation aligned with your curriculum" },
          { icon: MessageSquare, text: "AI chatbot for student & parent inquiries — available 24/7" },
        ]}
        media={
          <BrowserFrame
            src="/landing/ai-chat.png"
            gradient="from-blue-700 via-indigo-700 to-purple-800"
            icon={Bot}
            label="School Deck AI Chat Interface"
          />
        }
      />

      {/* ── 3. JAMB CBT System ── */}
      <FeatureSection
        badge="JAMB CBT Simulator"
        title="The Most Comprehensive JAMB Practice Platform in Nigeria"
        description="Give your students access to 30,000+ past questions spanning from 1987 to date across all UTME subjects. Real exam simulation with timed tests, instant scoring, and performance analytics."
        bullets={[
          { icon: BookOpen, text: "Complete question bank: 1987 — present, all JAMB subjects" },
          { icon: Clock, text: "Realistic exam simulation with timer, navigation, and auto-submit" },
          { icon: BarChart3, text: "Detailed performance analytics by subject, topic, and difficulty" },
          { icon: Shield, text: "Admin-controlled access — grant/revoke practice permissions per student" },
        ]}
        media={
          <BrowserFrame
            src="/landing/jamb-cbt.png"
            gradient="from-orange-600 to-red-600"
            icon={GraduationCap}
            label="JAMB CBT Exam Interface"
          />
        }
      />

      {/* ── 4. Smart Communication & Attendance ── */}
      <FeatureSection
        reversed
        dark
        badge="Multi-Channel Communication"
        title="Reach Everyone, Everywhere — Instantly"
        description="Communicate with parents, teachers, and students through every channel imaginable. Push notifications, SMS, WhatsApp, and email — all from one dashboard. Plus, QR-based attendance that takes seconds."
        bullets={[
          { icon: Bell, text: "Multi-channel alerts: Push, SMS, WhatsApp, and Email — all unified" },
          { icon: MessageSquare, text: "Bulk broadcasts and targeted messages by class, level, or group" },
          { icon: QrCode, text: "QR code attendance scanning — paperless, 2-second check-in" },
          { icon: TrendingUp, text: "Real-time attendance analytics with auto-parent notifications" },
        ]}
        media={
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <BrowserFrame
                src="/landing/notifications.png"
                gradient="from-cyan-600 to-blue-600"
                icon={Bell}
                label="Notification Center"
              />
            </div>
            <div className="hidden sm:block w-1/3 -mb-8">
              <PhoneFrame
                src="/landing/attendance-qr.png"
                gradient="from-cyan-700 to-blue-700"
                icon={QrCode}
                label="QR Attendance"
              />
            </div>
          </div>
        }
      />

      {/* ── 5. Finance & Payroll ── */}
      <FeatureSection
        badge="Finance & Payroll"
        title="No More Confusion — Complete Financial Clarity"
        description="Powered by Paystack, our finance module eliminates payment confusion. Track who has paid, who hasn't, manage teacher payroll, generate invoices, and get real-time financial reports."
        bullets={[
          { icon: CreditCard, text: "Paystack-powered payment processing — secure, reliable, familiar" },
          { icon: Wallet, text: "Student fee management: track balances, due dates, and payment history" },
          { icon: Users, text: "Teacher payroll automation with deductions, bonuses, and payslips" },
          { icon: BarChart3, text: "Financial dashboards with revenue trends, expense tracking, and reports" },
        ]}
        media={
          <BrowserFrame
            src="/landing/finance.png"
            gradient="from-amber-600 to-orange-600"
            icon={Wallet}
            label="Finance Dashboard"
          />
        }
      />

      {/* ── 6. Smart Timetable + Parent Portal ── */}
      <FeatureSection
        reversed
        badge="AI Timetable & Parent Portal"
        title="AI-Powered Scheduling & Total Parental Involvement"
        description="Eliminate timetable clashes with our intelligent scheduling engine. Meanwhile, parents stay fully informed with instant attendance alerts, real-time result display, and downloadable report cards."
        bullets={[
          { icon: CalendarCheck, text: "AI timetable generation with automatic clash detection & resolution" },
          { icon: HeartHandshake, text: "Parent portal: attendance notifications, results, and report cards" },
          { icon: TrendingUp, text: "Real-time student performance tracking across all assessments" },
          { icon: FileText, text: "Automated PDF report cards with branding and term-by-term comparison" },
        ]}
        media={
          <BrowserFrame
            src="/landing/timetable.png"
            gradient="from-violet-600 to-indigo-600"
            icon={CalendarCheck}
            label="AI Timetable & Parent Dashboard"
          />
        }
      />

      {/* ═══════════════════════════════════════
          PORTAL CARDS SECTION (condensed)
      ═══════════════════════════════════════ */}
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
            {[
              {
                role: "Admin",
                href: "/admin/login",
                description: "Full administrative control — manage users, configure academic structure, oversee operations, and generate institutional reports.",
                icon: School,
                stats: ["School Config", "Staff Management", "Finance", "Analytics"],
                gradient: "from-slate-900 to-slate-700",
              },
              {
                role: "Teacher",
                href: "/teacher/login",
                description: "Manage classes, record assessments, track attendance, communicate with parents, and monitor student progress daily.",
                icon: UserCheck,
                stats: ["Gradebook", "Attendance", "Lesson Plans", "Analytics"],
                gradient: "from-blue-700 to-blue-500",
              },
              {
                role: "Student",
                href: "/student/login",
                description: "View grades, check timetables, track attendance records, access learning materials, and receive school announcements.",
                icon: GraduationCap,
                stats: ["Results", "Timetable", "Assignments", "Progress"],
                gradient: "from-emerald-700 to-emerald-500",
              },
              {
                role: "Parent",
                href: "/parent/login",
                description: "Stay connected with your child's academic journey — monitor performance, attendance, fee status, and school communications.",
                icon: HeartHandshake,
                stats: ["Performance", "Attendance", "Payments", "Messages"],
                gradient: "from-amber-700 to-amber-500",
              },
            ].map((portal, i) => (
              <PortalCard key={portal.role} {...portal} delay={i * 100} />
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════
          TESTIMONIAL SECTION
      ═══════════════════════════════════════ */}
      <section className="py-20 sm:py-28 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl mx-auto text-center mb-14 sm:mb-16">
            <Badge
              variant="outline"
              className="mb-4 px-4 py-1.5 border-amber-200 text-amber-600 bg-amber-50/50 text-xs font-medium"
            >
              <Quote className="h-3.5 w-3.5 mr-1.5" />
              Trusted by School Networks
            </Badge>
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
              What School Leaders Say
            </h2>
            <p className="text-gray-500 leading-relaxed">
              Schools across Nigeria trust School Hub to streamline operations and improve outcomes.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                quote: "School Hub transformed how we manage our three campuses. The multi-tenant architecture means each school has autonomy while I get a bird's-eye view of everything.",
                author: "Dr. Adebayo O.",
                role: "Executive Director, 3-Campus School Network",
              },
              {
                quote: "The JAMB CBT simulator alone was worth it. Our students went from struggling with the computer-based format to scoring consistently above 280. The AI lesson notes saved our teachers hours every week.",
                author: "Mrs. Chidinma E.",
                role: "Principal, Premier Secondary School",
              },
              {
                quote: "Finance used to be our biggest headache. Now with Paystack integration and the billing module, we know exactly who has paid and who hasn't. Parent complaints about fees dropped by 80%.",
                author: "Mr. Ibrahim S.",
                role: "School Business Manager",
              },
            ].map((t, i) => (
              <TestimonialCard key={i} {...t} delay={i * 150} />
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════
          CTA SECTION
      ═══════════════════════════════════════ */}
      <section className="py-20 sm:py-28 bg-gradient-to-br from-gray-900 via-gray-900 to-gray-800 relative overflow-hidden">
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
            <Link href="/subscription">
              <Button className="h-12 px-8 rounded-xl text-sm font-semibold bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-500/20 hover:shadow-xl hover:shadow-blue-500/30 transition-all duration-300">
                Start Free Trial
                <Rocket className="ml-2 h-4 w-4" />
              </Button>
            </Link>
            <Link href="/subscription">
              <Button
                variant="outline"
                className="h-12 px-8 rounded-xl text-sm font-semibold border-white/10 text-gray-300 hover:bg-white/5 hover:text-white"
              >
                View Plans
                <ChevronRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════
          FOOTER
      ═══════════════════════════════════════ */}
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
              <div className="flex items-center gap-1">
                {[1, 2, 3, 4, 5].map((s) => (
                  <Star key={s} className={`h-4 w-4 ${s <= 4 ? "text-yellow-400 fill-yellow-400" : "text-gray-600"}`} />
                ))}
                <span className="text-xs text-gray-500 ml-2">4.8/5</span>
              </div>
            </div>

            {/* Product */}
            <div>
              <h4 className="text-xs font-semibold text-gray-300 uppercase tracking-wider mb-4">
                Product
              </h4>
              <ul className="space-y-2.5">
                {[
                  { label: "Features", href: "#features" },
                  { label: "Pricing", href: "/subscription" },
                  { label: "Register your school", href: "/register" },
                  { label: "Integrations", href: "#" },
                  { label: "API Docs", href: "#" },
                ].map((item) => (
                  <li key={item.label}>
                    <Link
                      href={item.href}
                      className="text-sm text-gray-500 hover:text-gray-300 transition-colors"
                    >
                      {item.label}
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
