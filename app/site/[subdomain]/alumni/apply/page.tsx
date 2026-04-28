"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Loader2, Send, CheckCircle2 } from "lucide-react";
import Script from "next/script";
import { createClient } from "@supabase/supabase-js";
import { SchoolDomainHeader } from "@/app/site/components/school-domain-header";
import { SchoolDomainFooter } from "@/app/site/components/school-domain-footer";
import { getPublicBasePath } from "@/lib/public-school-site";

declare global {
  interface Window {
    grecaptcha?: {
      render: (container: string | HTMLElement, options: Record<string, any>) => number;
      getResponse: (widgetId?: number) => string;
      reset: (widgetId?: number) => void;
    };
  }
}

const SOCIAL_FIELDS = [
  { key: "linkedin_url", label: "LinkedIn URL", placeholder: "https://linkedin.com/in/yourname" },
  { key: "x_url", label: "X URL", placeholder: "https://x.com/yourname" },
  { key: "tiktok_url", label: "TikTok URL", placeholder: "https://tiktok.com/@yourname" },
  { key: "instagram_url", label: "Instagram URL", placeholder: "https://instagram.com/yourname" },
  { key: "facebook_url", label: "Facebook URL", placeholder: "https://facebook.com/yourname" },
  { key: "website_url", label: "Website URL", placeholder: "https://yourportfolio.com" },
] as const;

interface HeaderSiteSettings {
  site_title: string;
  site_tagline: string;
  logo_url: string;
  primary_color: string;
  secondary_color: string;
}

export default function AlumniApplyPage() {
  const params = useParams<{ subdomain: string }>();
  const captchaContainerRef = useRef<HTMLDivElement | null>(null);
  const captchaWidgetIdRef = useRef<number | null>(null);
  const captchaSiteKey = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY || "";
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");
  const [captchaToken, setCaptchaToken] = useState("");
  const [headerLoading, setHeaderLoading] = useState(true);
  const [headerSiteSettings, setHeaderSiteSettings] = useState<HeaderSiteSettings>({
    site_title: "School Website",
    site_tagline: "Alumni Network",
    logo_url: "",
    primary_color: "#1e3a8a",
    secondary_color: "#059669",
  });

  const [form, setForm] = useState({
    full_name: "",
    occupation: "",
    email: "",
    phone: "",
    story: "",
    linkedin_url: "",
    x_url: "",
    tiktok_url: "",
    instagram_url: "",
    facebook_url: "",
    website_url: "",
  });
  const [image, setImage] = useState<File | null>(null);

  useEffect(() => {
    // Attempt to render the reCAPTCHA. The script may load after this effect
    // runs, so we both try immediately and poll until `grecaptcha` is available.
    const renderCaptcha = () => {
      if (!captchaSiteKey) return;
      if (!captchaContainerRef.current) return;
      if (!window.grecaptcha) return;
      if (captchaWidgetIdRef.current !== null) return;

      captchaWidgetIdRef.current = window.grecaptcha.render(captchaContainerRef.current, {
        sitekey: captchaSiteKey,
        callback: (token: string) => setCaptchaToken(token),
        "expired-callback": () => setCaptchaToken(""),
      });
    };

    renderCaptcha();

    let pollId: number | undefined;
    if (!captchaWidgetIdRef.current && captchaSiteKey) {
      pollId = window.setInterval(() => {
        renderCaptcha();
        if (captchaWidgetIdRef.current !== null && pollId) {
          clearInterval(pollId);
        }
      }, 500);
    }

    return () => {
      if (pollId) clearInterval(pollId);
    };
  }, [captchaSiteKey]);

  useEffect(() => {
    const requestedSubdomain = params.subdomain;
    if (!requestedSubdomain) {
      setHeaderLoading(false);
      return;
    }

    async function loadHeaderSettings() {
      try {
        const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
        if (!url || !key) return;

        const supabase = createClient(url, key);
        const { data: schoolData, error: schoolError } = await supabase.rpc("get_school_by_subdomain", {
          p_subdomain: requestedSubdomain,
        });

        if (schoolError) return;
        const school = (Array.isArray(schoolData) ? schoolData[0] : schoolData) as
          | { id: string; name: string }
          | null;

        if (!school?.id) return;

        const { data: settings } = await supabase
          .from("website_site_settings")
          .select("site_title, site_tagline, logo_url, primary_color, secondary_color")
          .eq("school_id", school.id)
          .maybeSingle();

        setHeaderSiteSettings((prev) => ({
          ...prev,
          site_title: settings?.site_title || school.name || prev.site_title,
          site_tagline: settings?.site_tagline || prev.site_tagline,
          logo_url: settings?.logo_url || prev.logo_url,
          primary_color: settings?.primary_color || prev.primary_color,
          secondary_color: settings?.secondary_color || prev.secondary_color,
        }));
      } finally {
        setHeaderLoading(false);
      }
    }

    void loadHeaderSettings();
  }, [params.subdomain]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (!image) {
      setError("Please upload your profile image.");
      return;
    }

    if (!captchaToken) {
      setError("Please complete CAPTCHA verification.");
      return;
    }

    setSubmitting(true);
    try {
      const payload = new FormData();
      payload.append("image", image);
      Object.entries(form).forEach(([key, value]) => {
        payload.append(key, value);
      });
      payload.append("captcha_token", captchaToken);

      const res = await fetch("/api/alumni/applications/submit", {
        method: "POST",
        body: payload,
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Unable to submit application");
      }

      setSubmitted(true);
    } catch (submitError: any) {
      setError(submitError.message || "Unable to submit application");
      if (captchaWidgetIdRef.current !== null && window.grecaptcha) {
        window.grecaptcha.reset(captchaWidgetIdRef.current);
      }
      setCaptchaToken("");
    } finally {
      setSubmitting(false);
    }
  }

  const basePath = getPublicBasePath(params.subdomain, null);

  if (headerLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
        <div className="rounded-xl border border-slate-200 bg-white px-6 py-4 text-sm text-slate-600 shadow-sm">
          Loading school details...
        </div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-slate-50">
        <SchoolDomainHeader siteSettings={headerSiteSettings} basePath={basePath} currentPage="alumni-apply" />
        <div className="px-4 py-12">
          <div className="mx-auto max-w-2xl rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
              <CheckCircle2 className="h-7 w-7" />
            </div>
            <h1 className="text-2xl font-bold text-slate-900">Application Submitted</h1>
            <p className="mt-3 text-sm leading-7 text-slate-600">
              Thank you for applying to be featured in our alumni directory. Our admin team will review your profile and publish it once approved.
            </p>
            <div className="mt-6 flex items-center justify-center gap-3">
              <Link href={`${basePath}/alumni`} className="rounded-full border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700">
                View Alumni Directory
              </Link>
              <Link href={basePath} className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white">
                Back Home
              </Link>
            </div>
          </div>
        </div>
        <SchoolDomainFooter siteSettings={headerSiteSettings} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <SchoolDomainHeader siteSettings={headerSiteSettings} basePath={basePath} currentPage="alumni-apply" />
      {captchaSiteKey ? (
        <Script src="https://www.google.com/recaptcha/api.js" strategy="afterInteractive" />
      ) : null}
      <div className="mx-auto max-w-3xl px-4 py-12">
        <div className="mb-8 text-center">
          <h1 className="text-4xl font-black tracking-tight text-slate-900">Apply as Alumni</h1>
          <p className="mt-3 text-sm leading-7 text-slate-600">
            Share your profile, what you do, and your story. Social links are optional.
          </p>
        </div>

        <form onSubmit={onSubmit} className="space-y-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-1">
              <span className="text-sm font-medium text-slate-700">Full Name</span>
              <input
                required
                value={form.full_name}
                onChange={(e) => setForm((prev) => ({ ...prev, full_name: e.target.value }))}
                className="h-11 w-full rounded-xl border border-slate-200 px-3 outline-none focus:border-slate-400"
              />
            </label>

            <label className="space-y-1">
              <span className="text-sm font-medium text-slate-700">Occupation / Job</span>
              <input
                required
                value={form.occupation}
                onChange={(e) => setForm((prev) => ({ ...prev, occupation: e.target.value }))}
                className="h-11 w-full rounded-xl border border-slate-200 px-3 outline-none focus:border-slate-400"
              />
            </label>

            <label className="space-y-1">
              <span className="text-sm font-medium text-slate-700">Email</span>
              <input
                required
                type="email"
                value={form.email}
                onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
                className="h-11 w-full rounded-xl border border-slate-200 px-3 outline-none focus:border-slate-400"
              />
            </label>

            <label className="space-y-1">
              <span className="text-sm font-medium text-slate-700">Phone</span>
              <input
                value={form.phone}
                onChange={(e) => setForm((prev) => ({ ...prev, phone: e.target.value }))}
                className="h-11 w-full rounded-xl border border-slate-200 px-3 outline-none focus:border-slate-400"
              />
            </label>
          </div>

          <label className="space-y-1">
            <span className="text-sm font-medium text-slate-700">Profile Image</span>
            <input
              required
              type="file"
              accept="image/*"
              onChange={(e) => setImage(e.target.files?.[0] || null)}
              className="w-full rounded-xl border border-slate-200 p-2 text-sm"
            />
          </label>

          <label className="space-y-1">
            <span className="text-sm font-medium text-slate-700">Your Story</span>
            <textarea
              required
              rows={8}
              value={form.story}
              onChange={(e) => setForm((prev) => ({ ...prev, story: e.target.value }))}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 outline-none focus:border-slate-400"
              placeholder="Tell your journey, impact, and advice for current students..."
            />
          </label>

          <div>
            <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">Optional social links</h2>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              {SOCIAL_FIELDS.map((field) => (
                <label key={field.key} className="space-y-1">
                  <span className="text-sm font-medium text-slate-700">{field.label}</span>
                  <input
                    value={form[field.key]}
                    onChange={(e) => setForm((prev) => ({ ...prev, [field.key]: e.target.value }))}
                    className="h-11 w-full rounded-xl border border-slate-200 px-3 outline-none focus:border-slate-400"
                    placeholder={field.placeholder}
                  />
                </label>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <span className="text-sm font-medium text-slate-700">CAPTCHA Verification</span>
            {captchaSiteKey ? (
              <div ref={captchaContainerRef} />
            ) : (
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">
                CAPTCHA is not configured yet.
              </div>
            )}
          </div>

          {error ? (
            <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
          ) : null}

          <button
            type="submit"
            disabled={submitting}
            className="inline-flex h-11 items-center justify-center rounded-full bg-slate-900 px-6 text-sm font-semibold text-white disabled:opacity-60"
          >
            {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
            Submit Application
          </button>
        </form>
      </div>

      <SchoolDomainFooter siteSettings={headerSiteSettings} />
    </div>
  );
}
