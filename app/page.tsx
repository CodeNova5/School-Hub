"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import {
  GraduationCap,
  CheckCircle2,
  Shield,
  Clock,
  ArrowRight,
  Menu,
  X,
  Palette,
  ChevronDown,
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
  ArrowUpRight,
  Zap,
  Lock,
  Activity,
} from "lucide-react";
import {
  APP_NAME,
  APP_TAGLINE,
  CONTACT_EMAIL,
  getCopyrightText,
} from "@/data";

/* ═══════════════════════════════════════
   ANIMATION HOOK
═══════════════════════════════════════ */

function useReveal(threshold = 0.12) {
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
      const eased = 1 - Math.pow(1 - progress, 3);
      setCount(Math.round(eased * end));
      if (progress < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [end, duration, startOn]);

  if (end >= 1000) return count.toLocaleString();
  if (end === 99.9) return count === 100 ? "99.9" : count.toString();
  return count.toString();
}

/* ═══════════════════════════════════════
   STAR FIELD
═══════════════════════════════════════ */

const STARS = Array.from({ length: 60 }, (_, i) => ({
  id: i,
  top: Math.random() * 80,
  left: Math.random() * 100,
  size: Math.random() > 0.7 ? 2 : 1.5,
  duration: 3 + Math.random() * 4,
  delay: Math.random() * 5,
}));

function StarField() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {STARS.map((s) => (
        <span
          key={s.id}
          className="absolute rounded-full bg-white"
          style={{
            top: `${s.top}%`,
            left: `${s.left}%`,
            width: s.size,
            height: s.size,
            opacity: 0,
            animation: `lp-star-twinkle ${s.duration}s ${s.delay}s ease-in-out infinite`,
          }}
        />
      ))}
      <style>{`
        @keyframes lp-star-twinkle {
          0%, 100% { opacity: 0; transform: scale(0.8); }
          50% { opacity: 0.7; transform: scale(1.2); }
        }
        @keyframes lp-float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-10px); }
        }
        @keyframes lp-pulse-dot {
          0%, 100% { opacity: 1; transform: scale(1); box-shadow: 0 0 0 0 rgba(74,222,128,0.4); }
          50% { opacity: 0.8; transform: scale(1.1); box-shadow: 0 0 0 6px rgba(74,222,128,0); }
        }
        @keyframes lp-glow-pulse {
          0%, 100% { opacity: 0.4; }
          50% { opacity: 0.7; }
        }
        @keyframes lp-slide-up {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes lp-fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes lp-bar-grow {
          from { width: 0; opacity: 0; }
          to { opacity: 1; }
        }
        @media (prefers-reduced-motion: reduce) {
          * { animation-duration: 0.01ms !important; transition-duration: 0.01ms !important; }
        }
      `}</style>
    </div>
  );
}

/* ═══════════════════════════════════════
   DARK BROWSER FRAME
═══════════════════════════════════════ */

function DarkFrame({
  label,
  gradient,
  icon: Icon,
  src,
  aspectRatio = "aspect-[16/10]",
}: {
  label: string;
  gradient: string;
  icon: any;
  src?: string;
  aspectRatio?: string;
}) {
  const [loaded, setLoaded] = useState(false);
  const [err, setErr] = useState(false);

  return (
    <div className="relative w-full overflow-hidden rounded-2xl border border-white/[0.08] bg-[#0c0c0f] shadow-[0_30px_80px_-20px_rgba(0,0,0,0.9)]">
      {/* Traffic lights */}
      <div className="flex items-center gap-1.5 border-b border-white/[0.06] bg-white/[0.02] px-4 py-3">
        <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]/80" />
        <span className="h-2.5 w-2.5 rounded-full bg-[#febc2e]/80" />
        <span className="h-2.5 w-2.5 rounded-full bg-[#28c840]/80" />
        <div className="mx-auto flex max-w-[55%] items-center gap-1.5 rounded-md border border-white/[0.06] bg-white/[0.03] px-3 py-1">
          <Lock className="h-2.5 w-2.5 text-green-400/70" />
          <span className="truncate font-mono text-[10px] text-white/30">
            app.{APP_NAME.toLowerCase()}.com
          </span>
        </div>
      </div>
      {/* Content */}
      <div className={`relative ${aspectRatio} overflow-hidden bg-[#0a0a0d]`}>
        {/* Loading placeholder - subtle gradient shimmer */}
        {src && !err && !loaded && (
          <div className="absolute inset-0 bg-gradient-to-br from-white/[0.03] to-transparent animate-pulse" />
        )}

        {/* Image */}
        {src && !err && (
          <img
            src={src}
            alt={label}
            loading="eager"
            decoding="async"
            onLoad={() => setLoaded(true)}
            className="absolute inset-0 h-full w-full object-cover object-top"
          />
        )}

        {/* Error/fallback state */}
        {(!src || err) && (
          <div
            className={`absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br ${gradient} p-8`}
          >
            <div className="mb-4 rounded-2xl bg-black/20 p-5 backdrop-blur-sm">
              <Icon className="h-10 w-10 text-white/80" />
            </div>
            <p className="text-center text-sm font-medium text-white/70">{label}</p>
            <p className="mt-1 font-mono text-center text-[11px] text-white/30">
              📸 Replace with your screenshot
            </p>
            <div className="mt-8 w-full max-w-xs space-y-2.5">
              <div className="h-2 w-3/4 rounded-full bg-white/10" />
              <div className="h-2 w-full rounded-full bg-white/[0.06]" />
              <div className="h-2 w-1/2 rounded-full bg-white/[0.06]" />
              <div className="mt-4 h-8 w-full rounded-lg bg-white/[0.06]" />
            </div>
          </div>
        )}
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
    const onScroll = () => setScrolled(window.scrollY > 30);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const navLinks = [
    { label: "Features", href: "#features" },
    { label: "Pricing", href: "/subscription" },
    { label: "Portals", href: "#portals" },
  ];

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 transition-all duration-300 ${scrolled
        ? "bg-black/80 backdrop-blur-xl border-b border-white/[0.07] shadow-lg shadow-black/20"
        : "bg-transparent"
        }`}
    >
      <div className="mx-auto max-w-6xl px-6 sm:px-10 lg:px-12">
        <div className="flex h-16 items-center justify-between sm:h-[70px]">
          {/* Logo */}
          <Link href="/" className="group flex flex-shrink-0 items-center gap-2.5">
            <div className="relative flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 shadow-lg shadow-blue-500/25 transition-all duration-200 group-hover:shadow-blue-500/40 group-hover:scale-105">
              <GraduationCap className="h-4 w-4 text-white" />
            </div>
            <span className="text-[17px] font-semibold tracking-tight text-white">
              {APP_NAME}
            </span>
          </Link>

          {/* Desktop nav */}
          <nav className="hidden items-center gap-1 md:flex">
            {navLinks.map((item) => (
              <Link
                key={item.label}
                href={item.href}
                className="rounded-md px-3 py-2 text-[13px] font-normal text-white/55 transition-colors duration-150 hover:text-white"
              >
                {item.label}
              </Link>
            ))}
          </nav>

          {/* Desktop CTA */}
          <div className="hidden items-center gap-2 md:flex">
            <Link href="/admin/login">
              <button className="rounded-md px-3 py-2 text-[13px] font-normal text-white/55 transition-colors duration-150 hover:text-white">
                Sign In
              </button>
            </Link>
            <Link href="/subscription">
              <button className="inline-flex h-9 items-center gap-2 rounded-full bg-white px-5 text-[13px] font-medium text-black shadow-[0_1px_0_rgba(255,255,255,0.3)_inset,0_4px_20px_rgba(0,0,0,0.4)] transition-all duration-150 hover:bg-white/90">
                Get Started
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </Link>
          </div>

          {/* Mobile toggle */}
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="flex h-10 w-10 items-center justify-center rounded-xl text-white/55 transition-colors hover:text-white md:hidden"
            aria-label="Toggle navigation"
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* Mobile drawer */}
      <div
        className={`overflow-hidden transition-all duration-250 ease-out md:hidden ${mobileOpen ? "max-h-80 opacity-100" : "max-h-0 opacity-0"
          }`}
        style={{ transitionTimingFunction: "cubic-bezier(0.4,0,0.2,1)" }}
      >
        <div className="border-t border-white/[0.06] bg-black/90 px-6 py-4 backdrop-blur-xl">
          {navLinks.map((item) => (
            <Link
              key={item.label}
              href={item.href}
              onClick={() => setMobileOpen(false)}
              className="block py-3 text-sm font-normal text-white/55 transition-colors hover:text-white"
            >
              {item.label}
            </Link>
          ))}
          <div className="mt-4 space-y-2 border-t border-white/[0.06] pt-4">
            <Link href="/admin/login" className="block" onClick={() => setMobileOpen(false)}>
              <button className="w-full rounded-xl border border-white/[0.08] bg-white/[0.03] py-2.5 text-sm text-white/70 transition-colors hover:bg-white/[0.06]">
                Sign In
              </button>
            </Link>
            <Link href="/subscription" className="block" onClick={() => setMobileOpen(false)}>
              <button className="w-full rounded-xl bg-white py-2.5 text-sm font-medium text-black transition-all hover:bg-white/90">
                Get Started
              </button>
            </Link>
          </div>
        </div>
      </div>
    </header>
  );
}

/* ═══════════════════════════════════════
   FEATURE SECTION
═══════════════════════════════════════ */

function FeatureSection({
  id,
  reversed,
  badge,
  title,
  description,
  bullets,
  media,
}: {
  id?: string;
  reversed?: boolean;
  badge: string;
  title: string;
  description: string;
  bullets: { icon: any; text: string }[];
  media: React.ReactNode;
}) {
  const { ref, visible } = useReveal(0.08);

  return (
    <section
      id={id}
      className="relative border-t border-white/[0.06] py-24 sm:py-32 overflow-hidden"
    >
      {/* Subtle radial glow */}
      <div className="pointer-events-none absolute inset-0 opacity-20">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `radial-gradient(circle at 1px 1px, rgba(255,255,255,0.05) 1px, transparent 0)`,
            backgroundSize: "48px 48px",
          }}
        />
      </div>

      <div className="relative mx-auto max-w-6xl px-6 sm:px-10 lg:px-12">
        <div
          ref={ref}
          className="grid items-center gap-12 lg:grid-cols-2 lg:gap-20"
        >
          {/* Text side */}
          <div
            className={`space-y-6 transition-all duration-[250ms] ease-out ${visible ? "translate-y-0 opacity-100" : "translate-y-6 opacity-0"
              } ${reversed ? "lg:order-2" : "lg:order-1"}`}
          >
            <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-500/30 bg-blue-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-blue-400">
              <Sparkles className="h-3 w-3" />
              {badge}
            </span>

            <h2 className="text-3xl font-bold leading-[1.1] tracking-tight text-white sm:text-4xl lg:text-5xl">
              {title}
            </h2>

            <p className="max-w-lg text-base leading-relaxed text-white/50 sm:text-[17px]">
              {description}
            </p>

            <ul className="space-y-3 pt-1">
              {bullets.map((b, i) => (
                <li
                  key={i}
                  className="flex items-start gap-3 transition-all duration-[250ms] ease-out"
                  style={{
                    transitionDelay: `${i * 60}ms`,
                    opacity: visible ? 1 : 0,
                    transform: visible ? "translateY(0)" : "translateY(12px)",
                  }}
                >
                  <div className="mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg bg-white/[0.06] border border-white/[0.08]">
                    <b.icon className="h-3.5 w-3.5 text-blue-400" />
                  </div>
                  <span className="pt-0.5 text-sm leading-relaxed text-white/60">{b.text}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Media side */}
          <div
            className={`transition-all duration-[250ms] ease-out ${visible ? "translate-y-0 opacity-100" : "translate-y-6 opacity-0"
              } ${reversed ? "lg:order-1" : "lg:order-2"}`}
            style={{ transitionDelay: "80ms" }}
          >
            {media}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════
   PORTAL CARD
═══════════════════════════════════════ */

function PortalCard({
  role,
  href,
  description,
  icon: Icon,
  stats,
  accentColor,
  delay,
}: {
  role: string;
  href: string;
  description: string;
  icon: any;
  stats: string[];
  accentColor: string;
  delay: number;
}) {
  const { ref, visible } = useReveal(0.08);

  return (
    <div
      ref={ref}
      style={{
        transform: visible ? "translateY(0)" : "translateY(20px)",
        opacity: visible ? 1 : 0,
        transitionDelay: `${delay}ms`,
        transition: "all 250ms cubic-bezier(0.4,0,0.2,1)",
      }}
    >
      <Link href={href} className="group block h-full">
        <div className="relative h-full overflow-hidden rounded-2xl border border-white/[0.07] bg-white/[0.03] p-6 transition-all duration-200 hover:border-white/[0.14] hover:bg-white/[0.06]">
          {/* Accent top line */}
          <div className={`absolute inset-x-0 top-0 h-px bg-gradient-to-r ${accentColor} opacity-0 transition-opacity duration-200 group-hover:opacity-100`} />

          <div className="flex items-start justify-between gap-3 mb-4">
            <div className={`flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br ${accentColor} shadow-lg`}>
              <Icon className="h-5 w-5 text-white" />
            </div>
            <ArrowUpRight className="h-4 w-4 text-white/20 transition-all duration-200 group-hover:text-white/60 group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
          </div>

          <h3 className="mb-1.5 text-[15px] font-semibold text-white/90 group-hover:text-white transition-colors duration-200">
            {role} Portal
          </h3>
          <p className="mb-5 text-[13px] leading-relaxed text-white/40">{description}</p>

          <div className="flex flex-wrap gap-1.5">
            {stats.map((s) => (
              <span
                key={s}
                className="rounded-lg border border-white/[0.06] bg-white/[0.04] px-2.5 py-1 font-mono text-[10px] text-white/35"
              >
                {s}
              </span>
            ))}
          </div>
        </div>
      </Link>
    </div>
  );
}

/* ═══════════════════════════════════════
   TESTIMONIAL CARD
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
  const { ref, visible } = useReveal(0.1);

  return (
    <div
      ref={ref}
      style={{
        transform: visible ? "translateY(0)" : "translateY(20px)",
        opacity: visible ? 1 : 0,
        transitionDelay: `${delay}ms`,
        transition: "all 250ms cubic-bezier(0.4,0,0.2,1)",
      }}
      className="rounded-2xl border border-white/[0.07] bg-white/[0.03] p-6 sm:p-8"
    >
      <div className="mb-4 text-blue-400/40">
        <svg width="24" height="18" viewBox="0 0 24 18" fill="currentColor">
          <path d="M0 18V10.8C0 4.8 3.6 1.2 10.8 0l1.2 2.4C8.4 3.6 6.6 5.4 6 8.4h4.8V18H0zm13.2 0V10.8C13.2 4.8 16.8 1.2 24 0l1.2 2.4c-3.6 1.2-5.4 3-6 6h4.8V18H13.2z" />
        </svg>
      </div>
      <p className="mb-6 text-[14px] leading-relaxed text-white/55 italic">
        &ldquo;{quote}&rdquo;
      </p>
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-sm font-bold text-white">
          {author.charAt(0)}
        </div>
        <div>
          <p className="text-[13px] font-semibold text-white/85">{author}</p>
          <p className="text-[12px] text-white/35">{role}</p>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════
   COUNTER STAT
═══════════════════════════════════════ */

function CounterStat({
  end,
  suffix,
  label,
  icon: Icon,
  delay,
}: {
  end: number;
  suffix: string;
  label: string;
  icon: any;
  delay: number;
}) {
  const { ref, visible } = useReveal(0.3);
  const val = useCountUp(end, 2000, visible);

  return (
    <div
      ref={ref}
      style={{
        transform: visible ? "translateY(0)" : "translateY(16px)",
        opacity: visible ? 1 : 0,
        transitionDelay: `${delay}ms`,
        transition: "all 250ms cubic-bezier(0.4,0,0.2,1)",
      }}
      className="text-center"
    >
      <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.04]">
        <Icon className="h-5 w-5 text-blue-400" />
      </div>
      <div className="font-mono text-3xl font-bold tabular-nums text-white sm:text-4xl">
        {val}{suffix}
      </div>
      <div className="mt-1 text-sm text-white/40">{label}</div>
    </div>
  );
}

/* ═══════════════════════════════════════
   MAIN PAGE
═══════════════════════════════════════ */

export default function LandingPage() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const stats = [
    { end: 10000, suffix: "+", label: "Students Managed", icon: Users },
    { end: 500, suffix: "+", label: "Schools Onboarded", icon: School },
    { end: 50000, suffix: "+", label: "Reports Generated", icon: FileText },
    { end: 99, suffix: ".9%", label: "Platform Uptime", icon: Activity },
  ];

  const testimonials = [
    {
      quote:
        "Prism transformed how we manage our three campuses. The multi-tenant architecture means each school has autonomy while I get a bird's-eye view of everything.",
      author: "Dr. Adebayo O.",
      role: "Executive Director, 3-Campus School Network",
    },
    {
      quote:
        "The JAMB CBT simulator alone was worth it. Our students went from struggling to scoring consistently above 280. The AI lesson notes saved our teachers hours every week.",
      author: "Mrs. Chidinma E.",
      role: "Principal, Premier Secondary School",
    },
    {
      quote:
        "Finance used to be our biggest headache. Now with Paystack integration and the billing module, we know exactly who has paid. Parent complaints about fees dropped by 80%.",
      author: "Mr. Ibrahim S.",
      role: "School Business Manager",
    },
  ];

  return (
    <div className="min-h-screen bg-[#050508] text-white">
      <Navbar />

      {/* ═══════════════════════════════════════
          HERO SECTION
      ═══════════════════════════════════════ */}
      <section className="relative isolate overflow-hidden">
        {/* Dark gradient bg */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "linear-gradient(to bottom, #03060a 0%, #060c12 24%, #0d1a20 44%, #121a1a 65%, #050508 86%, #050508 100%)",
          }}
        />

        {/* Star field */}
        <StarField />

        {/* Blue glow orb */}
        <div
          className="pointer-events-none absolute left-1/2 top-1/3 h-[600px] w-[700px] -translate-x-1/2 -translate-y-1/2 rounded-full"
          style={{
            background:
              "radial-gradient(ellipse at center, rgba(59,130,246,0.08) 0%, transparent 70%)",
            animation: "lp-glow-pulse 4s ease-in-out infinite",
          }}
        />

        {/* Hero content */}
        <div className="relative z-10 mx-auto flex max-w-4xl flex-col items-center px-6 pt-40 pb-0 text-center md:pt-48">
          <div
            style={{
              animation: mounted ? "lp-slide-up 0.6s cubic-bezier(0.4,0,0.2,1) both" : "none",
            }}
          >
            {/* Badge */}
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.04] px-4 py-1.5">
              <span
                className="h-2 w-2 rounded-full bg-green-400"
                style={{ animation: "lp-pulse-dot 2s ease-in-out infinite" }}
              />
              <span className="text-[12px] font-medium text-white/60">
                Nigeria&apos;s #1 School Management Platform
              </span>
            </div>

            {/* Headline */}
            <h1 className="mb-6 text-balance text-[40px] font-bold leading-[1.1] tracking-tight text-white sm:text-[56px] lg:text-[68px]">
              The Complete{" "}
              <span className="bg-gradient-to-r from-blue-400 via-blue-500 to-indigo-400 bg-clip-text text-transparent">
                School OS
              </span>
              <br />
              for Nigeria&apos;s Smartest Schools
            </h1>

            {/* Subtext */}
            <p className="mx-auto mb-10 max-w-2xl text-base leading-relaxed text-white/50 sm:text-[17px]">
              A powerful, multi-tenant school management system for school groups, districts, and
              education organizations. Manage academics, finance, AI tools, and communications —
              all from a single unified dashboard.
            </p>

            {/* CTA buttons */}
            <div className="mb-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link href="/subscription">
                <button className="inline-flex h-12 items-center gap-2 rounded-full bg-white px-8 text-[15px] font-semibold text-black shadow-[0_1px_0_rgba(255,255,255,0.4)_inset,0_8px_30px_rgba(0,0,0,0.4)] transition-all duration-200 hover:bg-white/90 hover:shadow-[0_8px_40px_rgba(0,0,0,0.5)]">
                  Get Started Free
                  <Rocket className="h-4 w-4" />
                </button>
              </Link>
              <Link href="#features">
                <button className="inline-flex h-12 items-center gap-2 rounded-full border border-white/[0.1] bg-white/[0.04] px-8 text-[15px] font-medium text-white/70 transition-all duration-200 hover:border-white/[0.18] hover:bg-white/[0.07] hover:text-white">
                  Explore Features
                  <ChevronDown className="h-4 w-4" />
                </button>
              </Link>
            </div>

            {/* Trust row */}
            <div className="mb-16 flex flex-wrap items-center justify-center gap-6 text-[13px] text-white/35">
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5 text-green-400/70" />
                <span>No credit card required</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Shield className="h-3.5 w-3.5 text-green-400/70" />
                <span>Enterprise-grade security</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5 text-green-400/70" />
                <span>99.9% uptime SLA</span>
              </div>
            </div>
          </div>
        </div>

        {/* Hero dashboard card */}
        <div
          className="relative z-10 mx-auto -mt-4 w-full max-w-5xl px-4 sm:px-6"
          style={{
            animation: mounted ? "lp-slide-up 0.7s 0.15s cubic-bezier(0.4,0,0.2,1) both" : "none",
          }}
        >
          {/* Live indicator */}
          <div className="mb-4 flex items-center justify-center gap-2 text-[13px] text-white/40">
            <span
              className="relative flex h-2 w-2"
            >
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-50" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-green-400" />
            </span>
            <span>
              <span className="font-semibold text-white/70">500+</span> schools managing operations live
            </span>
          </div>

          <div className="relative w-full overflow-hidden rounded-t-2xl border border-b-0 border-white/[0.08] bg-[#0b0c0e]/95 shadow-[0_50px_140px_-25px_rgba(0,0,0,0.9),0_0_0_1px_rgba(255,255,255,0.04)_inset]">
            {/* Traffic lights */}
            <div className="flex items-center gap-1.5 border-b border-white/[0.06] bg-white/[0.02] px-5 py-3.5">
              <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]/80" />
              <span className="h-2.5 w-2.5 rounded-full bg-[#febc2e]/80" />
              <span className="h-2.5 w-2.5 rounded-full bg-[#28c840]/80" />
              <span className="ml-3 font-mono text-[11px] text-white/30">
                app.{APP_NAME.toLowerCase()}.com — Admin Dashboard
              </span>
            </div>

            {/* Dashboard placeholder content */}
            <div className="relative flex min-h-[45vh] sm:min-h-[55vh] flex-col items-center justify-center bg-gradient-to-br from-blue-900/20 via-indigo-900/10 to-purple-900/20 px-6 py-10">
              {/* Grid pattern */}
              <div
                className="pointer-events-none absolute inset-0 opacity-[0.04]"
                style={{
                  backgroundImage: `radial-gradient(circle at 1px 1px, #fff 1px, transparent 0)`,
                  backgroundSize: "40px 40px",
                }}
              />
              <div className="relative z-10 mb-6 flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 shadow-xl shadow-blue-500/30">
                  <BarChart3 className="h-6 w-6 text-white" />
                </div>
                <div>
                  <p className="text-[15px] font-semibold text-white/80">Admin Dashboard Overview</p>
                  <p className="font-mono text-[11px] text-white/30">
                    📸 Replace with your dashboard screenshot
                  </p>
                </div>
              </div>
              {/* Mock stat row */}
              <div className="relative z-10 grid w-full max-w-xl grid-cols-3 gap-4">
                {[
                  { label: "Total Students", val: "2,481", color: "from-blue-500/20 to-blue-500/5" },
                  { label: "Active Teachers", val: "142", color: "from-indigo-500/20 to-indigo-500/5" },
                  { label: "Pending Fees", val: "₦4.2M", color: "from-violet-500/20 to-violet-500/5" },
                ].map((s) => (
                  <div
                    key={s.label}
                    className={`rounded-xl border border-white/[0.07] bg-gradient-to-br ${s.color} p-4 text-center`}
                  >
                    <div className="font-mono text-xl font-bold text-white/80">{s.val}</div>
                    <div className="mt-0.5 text-[10px] text-white/35">{s.label}</div>
                  </div>
                ))}
              </div>
              {/* Mock chart bar */}
              <div className="relative z-10 mt-8 w-full max-w-xl space-y-2">
                {[0.85, 0.6, 0.92, 0.45, 0.7].map((w, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <span className="w-16 text-right font-mono text-[9px] text-white/20">
                      Term {i + 1}
                    </span>
                    <div className="flex-1 rounded-full bg-white/[0.05]">
                      <div
                        className="h-2 rounded-full bg-gradient-to-r from-blue-500 to-indigo-500"
                        style={{ width: `${w * 100}%`, opacity: 0.6 + w * 0.3 }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════
          SOCIAL PROOF / LOGOS BAR
      ═══════════════════════════════════════ */}
      <section className="relative border-t border-white/[0.06] bg-black py-12">
        <div className="mx-auto max-w-6xl px-6 sm:px-10 lg:px-12">
          <p className="mb-8 text-center font-mono text-[11px] uppercase tracking-widest text-white/25">
            Trusted by 500+ schools across Nigeria
          </p>
          <div className="flex flex-wrap items-center justify-center gap-8 sm:gap-12">
            {[
              "Unity Schools",
              "Federal Colleges",
              "Private Networks",
              "Mission Schools",
              "State Boards",
              "WAEC Partners",
            ].map((name) => (
              <span
                key={name}
                className="text-[13px] font-medium text-white/20 transition-colors duration-200 hover:text-white/50"
              >
                {name}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════
          STATS SECTION
      ═══════════════════════════════════════ */}
      <section className="relative border-t border-white/[0.06] bg-[#050508] py-20 sm:py-24">
        <div className="mx-auto max-w-6xl px-6 sm:px-10 lg:px-12">
          <div className="grid grid-cols-2 gap-8 md:grid-cols-4 sm:gap-12">
            {stats.map((stat, i) => (
              <CounterStat key={stat.label} {...stat} delay={i * 100} />
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════
          FEATURE SECTIONS
      ═══════════════════════════════════════ */}

      {/* 1. School Website Builder */}
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
          <DarkFrame
            src="/landing/school-website.webp"
            gradient="from-emerald-800 via-teal-800 to-cyan-900"
            icon={Globe}
            label="Generated School Website"
          />

        }
      />

      {/* 2. AI-Powered Tools */}
      <FeatureSection
        reversed
        badge="AI-Powered Platform"
        title="AI That Works For Your School — From Lesson Notes to Chatbots"
        description="Leverage artificial intelligence to reduce teacher workload, generate question banks, create lesson notes, and provide instant answers to parents and students through an intelligent chatbot."
        bullets={[
          { icon: Bot, text: `${APP_NAME} AI — chat with your school data for instant insights` },
          { icon: BookOpen, text: "AI-powered question bank generator from any topic or subject" },
          { icon: FileText, text: "Automated lesson note creation aligned with your curriculum" },
          { icon: MessageSquare, text: "AI chatbot for student & parent inquiries — available 24/7" },
        ]}
        media={
          <DarkFrame
            src="/landing/ai-chat.webp"
            gradient="from-blue-900 via-indigo-900 to-purple-900"
            icon={Bot}
            label={`${APP_NAME} AI Chat Interface`}
          />
        }
      />

      {/* 3. JAMB CBT */}
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
          <DarkFrame
            src="/landing/jamb-cbt.webp"
            gradient="from-orange-900 via-red-900 to-rose-900"
            icon={GraduationCap}
            label="JAMB CBT Exam Interface"
          />
        }
      />

      {/* 4. Communication & Attendance */}
      <FeatureSection
        reversed
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
          <DarkFrame
            src="/landing/notifications.webp"
            gradient="from-cyan-900 via-blue-900 to-indigo-900"
            icon={Bell}
            label="Notification Center"
          />
        }
      />

      {/* 5. Finance & Payroll */}
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
          <DarkFrame
            src="/landing/finance.webp"
            gradient="from-amber-900 via-orange-900 to-yellow-900"
            icon={Wallet}
            label="Finance Dashboard"
          />
        }
      />


      {/* ═══════════════════════════════════════
          PORTAL CARDS
      ═══════════════════════════════════════ */}
      <section id="portals" className="relative border-t border-white/[0.06] py-24 sm:py-32">
        <div
          className="pointer-events-none absolute inset-0 opacity-10"
          style={{
            backgroundImage: `radial-gradient(circle at 1px 1px, rgba(255,255,255,0.08) 1px, transparent 0)`,
            backgroundSize: "48px 48px",
          }}
        />
        <div className="relative mx-auto max-w-6xl px-6 sm:px-10 lg:px-12">
          <div className="mx-auto mb-16 max-w-2xl text-center">
            <span className="mb-4 inline-flex items-center gap-1.5 rounded-full border border-indigo-500/30 bg-indigo-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-indigo-400">
              <Globe className="h-3 w-3" />
              Role-Based Portals
            </span>
            <h2 className="mt-4 text-3xl font-bold tracking-tight text-white sm:text-4xl">
              One Platform, Four Perspectives
            </h2>
            <p className="mt-4 text-[15px] leading-relaxed text-white/45">
              Every stakeholder gets a tailored experience — with the right tools, data, and
              permissions for their role.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              {
                role: "Admin",
                href: "/admin/login",
                description: "Full administrative control — manage users, configure academic structure, oversee operations, and generate institutional reports.",
                icon: School,
                stats: ["School Config", "Staff Mgmt", "Finance", "Analytics"],
                accentColor: "from-slate-600 to-slate-500",
              },
              {
                role: "Teacher",
                href: "/teacher/login",
                description: "Manage classes, record assessments, track attendance, communicate with parents, and monitor student progress daily.",
                icon: UserCheck,
                stats: ["Gradebook", "Attendance", "Lesson Plans", "Analytics"],
                accentColor: "from-blue-600 to-blue-500",
              },
              {
                role: "Student",
                href: "/student/login",
                description: "View grades, check timetables, track attendance records, access learning materials, and receive school announcements.",
                icon: GraduationCap,
                stats: ["Results", "Timetable", "Assignments", "Progress"],
                accentColor: "from-emerald-600 to-emerald-500",
              },
              {
                role: "Parent",
                href: "/parent/login",
                description: "Stay connected with your child's academic journey — monitor performance, attendance, fee status, and school communications.",
                icon: HeartHandshake,
                stats: ["Performance", "Attendance", "Payments", "Messages"],
                accentColor: "from-amber-600 to-amber-500",
              },
            ].map((portal, i) => (
              <PortalCard key={portal.role} {...portal} delay={i * 80} />
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════
          TESTIMONIALS
      ═══════════════════════════════════════ */}
      <section className="relative border-t border-white/[0.06] bg-black py-24 sm:py-32">
        <div className="mx-auto max-w-6xl px-6 sm:px-10 lg:px-12">
          {/* Hero quote */}
          <div className="mx-auto mb-16 max-w-3xl text-center">
            <blockquote className="text-balance text-[26px] font-light italic leading-[1.35] text-white/80 sm:text-[34px] lg:text-[40px]">
              &ldquo;Life-changing in making the dream of modern education management come true&rdquo;
            </blockquote>
            <figcaption className="mt-6 text-sm tracking-wide text-white/35">
              — School Director, Lagos State
            </figcaption>

            {/* Stars */}
            <div className="mt-5 flex items-center justify-center gap-1">
              {[1, 2, 3, 4, 5].map((s) => (
                <Star key={s} className="h-4 w-4 fill-yellow-400 text-yellow-400" />
              ))}
              <span className="ml-2 text-[13px] text-white/30">4.9 / 5 · 200+ reviews</span>
            </div>
          </div>

          {/* Cards */}
          <div className="grid gap-5 md:grid-cols-3">
            {testimonials.map((t, i) => (
              <TestimonialCard key={i} {...t} delay={i * 100} />
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════
          CTA SECTION
      ═══════════════════════════════════════ */}
      <section className="relative overflow-hidden border-t border-white/[0.06] py-24 sm:py-32">
        {/* Glow */}
        <div
          className="pointer-events-none absolute left-1/2 top-1/2 h-[500px] w-[700px] -translate-x-1/2 -translate-y-1/2 rounded-full"
          style={{
            background:
              "radial-gradient(ellipse at center, rgba(59,130,246,0.12) 0%, transparent 70%)",
          }}
        />
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: `radial-gradient(circle at 1px 1px, #fff 1px, transparent 0)`,
            backgroundSize: "40px 40px",
          }}
        />

        <div className="relative mx-auto max-w-3xl px-6 text-center sm:px-10">
          <span className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.04] px-4 py-1.5 text-[12px] font-medium text-white/50">
            <Zap className="h-3.5 w-3.5 text-blue-400" />
            Start your journey today
          </span>

          <h2 className="mb-4 text-4xl font-bold tracking-tight text-white sm:text-5xl lg:text-6xl">
            Ready to Transform Your{" "}
            <span className="bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">
              School Network?
            </span>
          </h2>

          <p className="mx-auto mb-10 max-w-xl text-[16px] leading-relaxed text-white/45">
            Join hundreds of schools already using {APP_NAME} to streamline operations, improve
            academic outcomes, and connect their entire community.
          </p>

          <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link href="/subscription">
              <button className="inline-flex h-12 items-center gap-2 rounded-full bg-white px-8 text-[15px] font-semibold text-black shadow-[0_1px_0_rgba(255,255,255,0.4)_inset,0_8px_30px_rgba(0,0,0,0.5)] transition-all duration-200 hover:bg-white/90">
                Start Free Trial
                <Rocket className="h-4 w-4" />
              </button>
            </Link>
            <Link href="/subscription">
              <button className="inline-flex h-12 items-center gap-2 rounded-full border border-white/[0.1] bg-white/[0.04] px-8 text-[15px] font-medium text-white/60 transition-all duration-200 hover:border-white/[0.18] hover:bg-white/[0.08] hover:text-white">
                View Plans
                <ArrowRight className="h-4 w-4" />
              </button>
            </Link>
          </div>

          <p className="mt-6 text-[12px] text-white/25">
            No credit card required · Free 14-day trial · Cancel anytime
          </p>
        </div>
      </section>

      {/* ═══════════════════════════════════════
          FOOTER
      ═══════════════════════════════════════ */}
      <footer className="border-t border-white/[0.07] bg-black">
        <div className="mx-auto max-w-6xl px-6 sm:px-10 lg:px-12 py-14 sm:py-16">
          <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4 lg:gap-14">
            {/* Brand */}
            <div className="sm:col-span-2 lg:col-span-1">
              <div className="mb-4 flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 shadow-lg shadow-blue-500/20">
                  <GraduationCap className="h-4 w-4 text-white" />
                </div>
                <span className="text-base font-semibold text-white">{APP_NAME}</span>
              </div>
              <p className="mb-5 max-w-xs text-[13px] leading-relaxed text-white/35">
                A comprehensive multi-tenant school management platform for modern education
                organizations across Nigeria.
              </p>
              <div className="flex items-center gap-1">
                {[1, 2, 3, 4, 5].map((s) => (
                  <Star
                    key={s}
                    className={`h-3.5 w-3.5 ${s <= 5 ? "fill-yellow-400 text-yellow-400" : "text-white/20"}`}
                  />
                ))}
                <span className="ml-2 text-[11px] text-white/25">4.9 / 5</span>
              </div>
            </div>

            {/* Product */}
            <div>
              <h4 className="mb-4 text-[10px] font-semibold uppercase tracking-widest text-white/30">
                Product
              </h4>
              <ul className="space-y-3">
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
                      className="text-[13px] text-white/35 transition-colors duration-150 hover:text-white/70"
                    >
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            {/* Company */}
            <div>
              <h4 className="mb-4 text-[10px] font-semibold uppercase tracking-widest text-white/30">
                Company
              </h4>
              <ul className="space-y-3">
                {["About", "Blog", "Careers", "Press Kit", "Partners"].map((item) => (
                  <li key={item}>
                    <Link
                      href="#"
                      className="text-[13px] text-white/35 transition-colors duration-150 hover:text-white/70"
                    >
                      {item}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            {/* Contact */}
            <div>
              <h4 className="mb-4 text-[10px] font-semibold uppercase tracking-widest text-white/30">
                Contact
              </h4>
              <ul className="space-y-3">
                <li className="flex items-start gap-2.5">
                  <Mail className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-white/20" />
                  <span className="text-[13px] text-white/35">{CONTACT_EMAIL}</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <Phone className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-white/20" />
                  <span className="text-[13px] text-white/35">+234 800 000 0000</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <MapPin className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-white/20" />
                  <span className="text-[13px] text-white/35">
                    Lagos, Nigeria
                  </span>
                </li>
              </ul>
            </div>
          </div>

          {/* Bottom bar */}
          <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t border-white/[0.06] pt-8 sm:flex-row">
            <p className="text-[11px] text-white/20">
              &copy; {new Date().getFullYear()} {APP_NAME}. All rights reserved.
            </p>
            <div className="flex items-center gap-5">
              {["Privacy Policy", "Terms of Service", "Cookie Policy"].map((item) => (
                <Link
                  key={item}
                  href="#"
                  className="text-[11px] text-white/20 transition-colors duration-150 hover:text-white/50"
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
