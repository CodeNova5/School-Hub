"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Loader2, Upload, CheckCircle2, FileText } from "lucide-react";
import Script from "next/script";
import { createClient } from "@supabase/supabase-js";
import { SchoolDomainHeader } from "@/app/site/components/school-domain-header";
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

interface ClassLevel {
  id: string;
  name: string;
  education_level_id: string;
  order_sequence: number;
}

interface EducationLevel {
  id: string;
  name: string;
  order_sequence: number;
}

interface HeaderSiteSettings {
  site_title: string;
  site_tagline: string;
  logo_url: string;
  primary_color: string;
  secondary_color: string;
}

interface SchoolConfig {
  has_religion_mode: boolean;
  religions: Array<{ id: string; name: string }>;
}

export default function SchoolAdmissionPage() {
  const params = useParams<{ subdomain: string }>();
  const captchaContainerRef = useRef<HTMLDivElement | null>(null);
  const captchaWidgetIdRef = useRef<number | null>(null);
  const captchaSiteKey = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY || "";
  const [captchaScriptLoaded, setCaptchaScriptLoaded] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [applicationNumber, setApplicationNumber] = useState("");
  const [error, setError] = useState("");
  const [captchaToken, setCaptchaToken] = useState("");
  const [schoolId, setSchoolId] = useState("");
  const [schoolDataLoading, setSchoolDataLoading] = useState(true);

  const [headerSiteSettings, setHeaderSiteSettings] = useState<HeaderSiteSettings>({
    site_title: "School Website",
    site_tagline: "Admissions",
    logo_url: "",
    primary_color: "#2563eb",
    secondary_color: "#059669",
  });

  const [schoolConfig, setSchoolConfig] = useState<SchoolConfig>({
    has_religion_mode: false,
    religions: [],
  });

  const [educationLevels, setEducationLevels] = useState<EducationLevel[]>([]);
  const [classLevelsByEducation, setClassLevelsByEducation] = useState<Record<string, ClassLevel[]>>({});
  const [selectedEducationLevel, setSelectedEducationLevel] = useState("");

  const [form, setForm] = useState({
    first_name: "",
    last_name: "",
    email: "",
    phone: "",
    date_of_birth: "",
    gender: "",
    address: "",
    parent_name: "",
    parent_email: "",
    parent_phone: "",
    desired_class: "",
    previous_school: "",
    religion: "",
    notes: "",
  });
  const [document, setDocument] = useState<File | null>(null);

  // Initialize reCAPTCHA
  useEffect(() => {
    if (!captchaSiteKey) return;
    if (!captchaContainerRef.current) return;
    if (!captchaScriptLoaded) return;
    if (!window.grecaptcha) return;
    if (captchaWidgetIdRef.current !== null) return;

    const renderCaptcha = () => {
      if (!window.grecaptcha || typeof window.grecaptcha.render !== "function") return;

      captchaWidgetIdRef.current = window.grecaptcha.render(captchaContainerRef.current as HTMLDivElement, {
        sitekey: captchaSiteKey,
        callback: (token: string) => setCaptchaToken(token),
        "expired-callback": () => setCaptchaToken(""),
      });
    };

    const grecaptcha = window.grecaptcha as typeof window.grecaptcha & { ready?: (callback: () => void) => void };
    if (typeof grecaptcha.ready === "function") {
      grecaptcha.ready(renderCaptcha);
      return;
    }

    renderCaptcha();
  }, [captchaSiteKey, captchaScriptLoaded]);

  // Load school settings, class levels, and config
  useEffect(() => {
    const requestedSubdomain = params.subdomain;
    if (!requestedSubdomain) {
      setSchoolDataLoading(false);
      return;
    }

    async function loadSchoolData() {
      try {
        const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
        if (!url || !key) return;

        const supabase = createClient(url, key);

        // Get school by subdomain
        const { data: schoolData, error: schoolError } = await supabase.rpc("get_school_by_subdomain", {
          p_subdomain: requestedSubdomain,
        });

        if (schoolError || !schoolData) return;
        const school = (Array.isArray(schoolData) ? schoolData[0] : schoolData) as
          | { id: string; name: string }
          | null;

        if (!school?.id) return;
        setSchoolId(school.id);

        // Get site settings
        const { data: settings } = await supabase
          .from("website_site_settings")
          .select("site_title, site_tagline, logo_url, primary_color, secondary_color")
          .eq("school_id", school.id)
          .maybeSingle();

        setHeaderSiteSettings((prev) => ({
          ...prev,
          site_title: settings?.site_title || school.name || prev.site_title,
          site_tagline: settings?.site_tagline || "Admissions Portal",
          logo_url: settings?.logo_url || prev.logo_url,
          primary_color: settings?.primary_color || prev.primary_color,
          secondary_color: settings?.secondary_color || prev.secondary_color,
        }));

        // Get education levels with their class levels
        const { data: educLevels } = await supabase
          .from("school_education_levels")
          .select("id, name, order_sequence")
          .eq("school_id", school.id)
          .eq("is_active", true)
          .order("order_sequence", { ascending: true });

        if (educLevels && educLevels.length > 0) {
          setEducationLevels(educLevels);

          // Get class levels for each education level
          const { data: classLevels } = await supabase
            .from("school_class_levels")
            .select("id, education_level_id, name, order_sequence")
            .eq("school_id", school.id)
            .eq("is_active", true)
            .in(
              "education_level_id",
              educLevels.map((el) => el.id)
            )
            .order("order_sequence", { ascending: true });

          if (classLevels) {
            const grouped: Record<string, ClassLevel[]> = {};
            educLevels.forEach((el) => {
              grouped[el.id] = classLevels.filter((cl) => cl.education_level_id === el.id);
            });
            setClassLevelsByEducation(grouped);

            // Pre-select first education level
            if (educLevels.length > 0) {
              setSelectedEducationLevel(educLevels[0].id);
            }
          }
        }

        // Get school religions if enabled
        const { data: religions } = await supabase
          .from("school_religions")
          .select("id, name")
          .eq("school_id", school.id)
          .eq("is_active", true)
          .order("name", { ascending: true });

        setSchoolConfig({
          has_religion_mode: (religions && religions.length > 0) || false,
          religions: religions || [],
        });
      } finally {
        setSchoolDataLoading(false);
      }
    }

    void loadSchoolData();
  }, [params.subdomain]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setDocument(e.target.files?.[0] || null);
  };

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    // Validation
    if (!form.first_name.trim()) {
      setError("Please enter student's first name");
      return;
    }
    if (!form.last_name.trim()) {
      setError("Please enter student's last name");
      return;
    }
    if (!form.date_of_birth) {
      setError("Please select date of birth");
      return;
    }
    if (!form.gender) {
      setError("Please select gender");
      return;
    }
    if (!form.address.trim()) {
      setError("Please enter residential address");
      return;
    }
    if (!form.parent_name.trim()) {
      setError("Please enter parent/guardian name");
      return;
    }
    if (!form.parent_email.trim()) {
      setError("Please enter parent/guardian email");
      return;
    }
    if (!form.parent_phone.trim()) {
      setError("Please enter parent/guardian phone");
      return;
    }
    if (!form.desired_class) {
      setError("Please select desired class level");
      return;
    }
    if (schoolConfig.has_religion_mode && !form.religion) {
      setError("Please select religion");
      return;
    }
    if (!document) {
      setError("Please upload student image");
      return;
    }
    if (!captchaToken) {
      setError("Please complete CAPTCHA verification");
      return;
    }

    setSubmitting(true);
    try {
      const payload = new FormData();
      payload.append("first_name", form.first_name);
      payload.append("last_name", form.last_name);
      payload.append("email", form.email);
      payload.append("phone", form.phone);
      payload.append("date_of_birth", form.date_of_birth);
      payload.append("gender", form.gender);
      payload.append("address", form.address);
      payload.append("parent_name", form.parent_name);
      payload.append("parent_email", form.parent_email);
      payload.append("parent_phone", form.parent_phone);
      payload.append("desired_class", form.desired_class);
      payload.append("previous_school", form.previous_school);
      payload.append("religion", form.religion);
      payload.append("notes", form.notes);
      payload.append("captcha_token", captchaToken);
      if (document) {
        payload.append("document", document);
      }

      const res = await fetch(`/api/admissions/submit-school`, {
        method: "POST",
        body: payload,
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to submit application");
      }

      setApplicationNumber(data.applicationNumber);
      setSubmitted(true);
    } catch (submitError: any) {
      setError(submitError.message || "Failed to submit application");
      if (captchaWidgetIdRef.current !== null && window.grecaptcha) {
        window.grecaptcha.reset(captchaWidgetIdRef.current);
      }
      setCaptchaToken("");
    } finally {
      setSubmitting(false);
    }
  }

  const basePath = getPublicBasePath(params.subdomain, null);
  const primaryColor = headerSiteSettings.primary_color;
  const secondaryColor = headerSiteSettings.secondary_color;

  // Normalize hex color to RGB for CSS variables
  const hexToRgb = (hex: string) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? `${parseInt(result[1], 16)} ${parseInt(result[2], 16)} ${parseInt(result[3], 16)}` : "37 99 235";
  };

  const themeStyle = {
    "--primary-color": primaryColor,
    "--primary-rgb": hexToRgb(primaryColor),
    "--secondary-color": secondaryColor,
    "--secondary-rgb": hexToRgb(secondaryColor),
  } as React.CSSProperties;

  if (schoolDataLoading) {
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
        <SchoolDomainHeader siteSettings={headerSiteSettings} basePath={basePath} currentPage="admissions" />
        <div className="px-4 py-12">
          <div className="mx-auto max-w-2xl rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
            <div
              className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full"
              style={{ backgroundColor: `rgb(var(--secondary-rgb) / 0.1)`, color: secondaryColor }}
            >
              <CheckCircle2 className="h-7 w-7" />
            </div>
            <h1 className="text-2xl font-bold text-slate-900">Application Submitted Successfully!</h1>
            <p className="mt-3 text-sm leading-7 text-slate-600">
              Your application has been received and is under review by our admissions team.
            </p>

            <div
              className="mt-6 rounded-xl border px-4 py-4"
              style={{ borderColor: `rgb(var(--primary-rgb) / 0.3)`, backgroundColor: `rgb(var(--primary-rgb) / 0.05)` }}
            >
              <p className="text-xs font-medium text-slate-600 mb-2">Application Number</p>
              <p className="text-2xl font-bold" style={{ color: primaryColor }}>
                {applicationNumber}
              </p>
              <p className="text-xs text-slate-600 mt-2">Please save this number for future reference.</p>
            </div>

            <div className="space-y-2 text-sm text-gray-600 mt-6 text-left">
              <p className="flex items-start gap-2">
                <span className="mt-1 flex-shrink-0" style={{ color: secondaryColor }}>
                  ✓
                </span>
                <span>
                  You will receive an email confirmation at <strong>{form.parent_email}</strong>
                </span>
              </p>
              <p className="flex items-start gap-2">
                <span className="mt-1 flex-shrink-0" style={{ color: secondaryColor }}>
                  ✓
                </span>
                <span>The admissions team will review your application within 3-5 business days.</span>
              </p>
              <p className="flex items-start gap-2">
                <span className="mt-1 flex-shrink-0" style={{ color: secondaryColor }}>
                  ✓
                </span>
                <span>You will be notified of the decision via email.</span>
              </p>
              <p className="flex items-start gap-2">
                <span className="mt-1 flex-shrink-0" style={{ color: secondaryColor }}>
                  ✓
                </span>
                <span>If approved, you will receive activation instructions for the parent portal.</span>
              </p>
            </div>

            <div className="pt-6 flex gap-3">
              <Link
                href={basePath}
                className="flex-1 rounded-full border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 text-center"
              >
                Return Home
              </Link>
              <button
                onClick={() => {
                  setSubmitted(false);
                  setForm({
                    first_name: "",
                    last_name: "",
                    email: "",
                    phone: "",
                    date_of_birth: "",
                    gender: "",
                    address: "",
                    parent_name: "",
                    parent_email: "",
                    parent_phone: "",
                    desired_class: "",
                    previous_school: "",
                    religion: "",
                    notes: "",
                  });
                  setDocument(null);
                }}
                className="flex-1 rounded-full px-4 py-2 text-sm font-semibold text-white"
                style={{ backgroundColor: primaryColor }}
              >
                Submit Another Application
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50" style={themeStyle}>
      <SchoolDomainHeader siteSettings={headerSiteSettings} basePath={basePath} currentPage="admissions" />
      {captchaSiteKey ? (
        <Script
          src="https://www.google.com/recaptcha/api.js?render=explicit"
          strategy="afterInteractive"
          onLoad={() => setCaptchaScriptLoaded(true)}
          onReady={() => setCaptchaScriptLoaded(true)}
        />
      ) : null}

      <div className="mx-auto max-w-4xl px-4 py-12">
        <div className="mb-8 text-center">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-full mb-4" style={{ backgroundColor: `rgb(var(--primary-rgb) / 0.1)` }}>
            <FileText className="h-7 w-7" style={{ color: primaryColor }} />
          </div>
          <h1 className="text-4xl font-bold tracking-tight text-gray-900">Student Admission Application</h1>
          <p className="mt-3 text-sm leading-7 text-gray-600">Complete the form below to apply for student admission at {headerSiteSettings.site_title}</p>
        </div>

        <form onSubmit={onSubmit} className="space-y-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          {/* Student Information Section */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900 border-b pb-2">Student Information</h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <label className="space-y-1">
                <span className="text-sm font-medium text-slate-700">First Name *</span>
                <input
                  required
                  type="text"
                  name="first_name"
                  value={form.first_name}
                  onChange={handleInputChange}
                  placeholder="Enter first name"
                  className="h-11 w-full rounded-xl border border-slate-200 px-3 outline-none focus:border-slate-400"
                  style={{ borderColor: submitted ? "rgb(var(--primary-rgb) / 0.3)" : "" }}
                />
              </label>

              <label className="space-y-1">
                <span className="text-sm font-medium text-slate-700">Last Name *</span>
                <input
                  required
                  type="text"
                  name="last_name"
                  value={form.last_name}
                  onChange={handleInputChange}
                  placeholder="Enter last name"
                  className="h-11 w-full rounded-xl border border-slate-200 px-3 outline-none focus:border-slate-400"
                />
              </label>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <label className="space-y-1">
                <span className="text-sm font-medium text-slate-700">Date of Birth *</span>
                <input
                  required
                  type="date"
                  name="date_of_birth"
                  value={form.date_of_birth}
                  onChange={handleInputChange}
                  className="h-11 w-full rounded-xl border border-slate-200 px-3 outline-none focus:border-slate-400"
                />
              </label>

              <label className="space-y-1">
                <span className="text-sm font-medium text-slate-700">Gender *</span>
                <select
                  required
                  name="gender"
                  value={form.gender}
                  onChange={handleInputChange}
                  className="h-11 w-full rounded-xl border border-slate-200 px-3 outline-none focus:border-slate-400"
                >
                  <option value="">Select gender</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                </select>
              </label>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <label className="space-y-1">
                <span className="text-sm font-medium text-slate-700">Student Email (Optional)</span>
                <input
                  type="email"
                  name="email"
                  value={form.email}
                  onChange={handleInputChange}
                  placeholder="student@email.com"
                  className="h-11 w-full rounded-xl border border-slate-200 px-3 outline-none focus:border-slate-400"
                />
              </label>

              <label className="space-y-1">
                <span className="text-sm font-medium text-slate-700">Student Phone (Optional)</span>
                <input
                  type="tel"
                  name="phone"
                  value={form.phone}
                  onChange={handleInputChange}
                  placeholder="+1234567890"
                  className="h-11 w-full rounded-xl border border-slate-200 px-3 outline-none focus:border-slate-400"
                />
              </label>
            </div>

            <label className="space-y-1">
              <span className="text-sm font-medium text-slate-700">Residential Address *</span>
              <textarea
                required
                name="address"
                value={form.address}
                onChange={handleInputChange}
                placeholder="Enter full residential address"
                rows={3}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 outline-none focus:border-slate-400"
              />
            </label>
          </div>

          {/* Parent/Guardian Information Section */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900 border-b pb-2">Parent/Guardian Information</h3>

            <label className="space-y-1">
              <span className="text-sm font-medium text-slate-700">Parent/Guardian Name *</span>
              <input
                required
                type="text"
                name="parent_name"
                value={form.parent_name}
                onChange={handleInputChange}
                placeholder="Enter parent/guardian full name"
                className="h-11 w-full rounded-xl border border-slate-200 px-3 outline-none focus:border-slate-400"
              />
            </label>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <label className="space-y-1">
                <span className="text-sm font-medium text-slate-700">Parent/Guardian Email *</span>
                <input
                  required
                  type="email"
                  name="parent_email"
                  value={form.parent_email}
                  onChange={handleInputChange}
                  placeholder="parent@email.com"
                  className="h-11 w-full rounded-xl border border-slate-200 px-3 outline-none focus:border-slate-400"
                />
              </label>

              <label className="space-y-1">
                <span className="text-sm font-medium text-slate-700">Parent/Guardian Phone *</span>
                <input
                  required
                  type="tel"
                  name="parent_phone"
                  value={form.parent_phone}
                  onChange={handleInputChange}
                  placeholder="+1234567890"
                  className="h-11 w-full rounded-xl border border-slate-200 px-3 outline-none focus:border-slate-400"
                />
              </label>
            </div>
          </div>

          {/* Academic Information Section */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900 border-b pb-2">Academic Information</h3>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">Education Level *</label>
              <p className="text-xs text-slate-500">Select the education level first</p>
              {educationLevels.length > 0 ? (
                <select
                  value={selectedEducationLevel}
                  onChange={(e) => {
                    setSelectedEducationLevel(e.target.value);
                    setForm((prev) => ({ ...prev, desired_class: "" }));
                  }}
                  className="h-11 w-full rounded-xl border border-slate-200 px-3 outline-none focus:border-slate-400"
                >
                  <option value="">Select education level</option>
                  {educationLevels.map((el) => (
                    <option key={el.id} value={el.id}>
                      {el.name}
                    </option>
                  ))}
                </select>
              ) : (
                <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-sm text-amber-700">
                  No education levels configured for this school.
                </div>
              )}
            </div>

            <div className="space-y-2">
              <label htmlFor="desired_class" className="text-sm font-medium text-slate-700">
                Desired Class Level *
              </label>
              {selectedEducationLevel && classLevelsByEducation[selectedEducationLevel]?.length > 0 ? (
                <select
                  id="desired_class"
                  required
                  name="desired_class"
                  value={form.desired_class}
                  onChange={handleInputChange}
                  className="h-11 w-full rounded-xl border border-slate-200 px-3 outline-none focus:border-slate-400"
                >
                  <option value="">Select class level</option>
                  {classLevelsByEducation[selectedEducationLevel].map((cl) => (
                    <option key={cl.id} value={cl.id}>
                      {cl.name}
                    </option>
                  ))}
                </select>
              ) : selectedEducationLevel ? (
                <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-sm text-amber-700">
                  No classes available for selected education level.
                </div>
              ) : (
                <div className="p-3 rounded-xl bg-slate-100 border border-slate-200 text-sm text-slate-600">
                  Please select an education level first.
                </div>
              )}
            </div>

            <label className="space-y-1">
              <span className="text-sm font-medium text-slate-700">Previous School (Optional)</span>
              <input
                type="text"
                name="previous_school"
                value={form.previous_school}
                onChange={handleInputChange}
                placeholder="Enter previous school name if applicable"
                className="h-11 w-full rounded-xl border border-slate-200 px-3 outline-none focus:border-slate-400"
              />
            </label>

            {schoolConfig.has_religion_mode && (
              <label className="space-y-1">
                <span className="text-sm font-medium text-slate-700">Religion *</span>
                <select
                  required
                  name="religion"
                  value={form.religion}
                  onChange={handleInputChange}
                  className="h-11 w-full rounded-xl border border-slate-200 px-3 outline-none focus:border-slate-400"
                >
                  <option value="">Select religion</option>
                  {schoolConfig.religions.map((rel) => (
                    <option key={rel.id} value={rel.id}>
                      {rel.name}
                    </option>
                  ))}
                </select>
              </label>
            )}

            <label className="space-y-1">
              <span className="text-sm font-medium text-slate-700">Student Image *</span>
              <p className="text-xs text-slate-500">Upload a clear passport-style student photo (JPG, PNG, WebP, GIF)</p>
              <div className="flex items-center justify-center rounded-xl border-2 border-dashed border-slate-300 p-6">
                <label className="cursor-pointer text-center w-full">
                  <div className="flex justify-center mb-2">
                    <Upload className="h-6 w-6 text-slate-400" />
                  </div>
                  <div className="text-sm">
                    <span className="font-medium" style={{ color: primaryColor }}>
                      Click to upload
                    </span>
                    <span className="text-slate-500"> or drag and drop</span>
                  </div>
                  <p className="text-xs text-slate-500">JPG, PNG, WebP, GIF up to 10MB</p>
                  <input
                    type="file"
                    required
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                </label>
              </div>
              {document && (
                <p className="text-sm text-slate-600">
                  📄 Selected: <span className="font-medium">{document.name}</span>
                </p>
              )}
            </label>

            <label className="space-y-1">
              <span className="text-sm font-medium text-slate-700">Additional Notes (Optional)</span>
              <textarea
                name="notes"
                value={form.notes}
                onChange={handleInputChange}
                placeholder="Any additional information you'd like to share..."
                rows={4}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 outline-none focus:border-slate-400"
              />
            </label>
          </div>

          {/* CAPTCHA Section */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">CAPTCHA Verification *</label>
            {captchaSiteKey ? (
              <div ref={captchaContainerRef} />
            ) : (
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">
                CAPTCHA is not configured yet.
              </div>
            )}
          </div>

          {/* Error Message */}
          {error ? (
            <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
          ) : null}

          {/* Submit Button */}
          <div className="flex gap-4 pt-4">
            <Link
              href={basePath}
              className="flex-1 h-11 flex items-center justify-center rounded-full border border-slate-200 text-sm font-medium text-slate-700"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 h-11 flex items-center justify-center rounded-full text-sm font-semibold text-white"
              style={{ backgroundColor: primaryColor, opacity: submitting ? 0.7 : 1 }}
            >
              {submitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Submitting...
                </>
              ) : (
                "Submit Application"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
