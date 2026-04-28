import { createClient } from "@supabase/supabase-js";
import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";
import { cookies, headers } from "next/headers";
import { notFound } from "next/navigation";
import {
  WEBSITE_DEFAULT_SITE_SETTINGS,
  WEBSITE_SECTION_TEMPLATES,
  type WebsitePageSlug,
  getWebsiteGlobalSettingsQualification,
  isWebsiteSectionCustomized,
} from "@/lib/website-builder";
import { SchoolDomainHeader } from "@/app/site/components/school-domain-header";

interface WebsiteSection {
  id: string;
  section_key: string;
  section_label: string;
  is_visible: boolean;
  order_sequence: number;
  content: {
    heading?: string;
    subheading?: string;
    description?: string;
    image_url?: string;
    button_label?: string;
    button_link?: string;
    items?: string[];
    hero_card_badge?: string;
    hero_card_title?: string;
    hero_card_description?: string;
    hero_stats?: string[];
    mission?: string;
    vision?: string;
    admissions_requirements?: string[];
    admissions_steps?: string[];
    contact_info_title?: string;
    contact_form_title?: string;
    contact_form_button_label?: string;
    contact_address_lines?: string[];
    contact_phone_lines?: string[];
    contact_email_lines?: string[];
    contact_hours_lines?: string[];
    program_items?: Array<{
      title: string;
      description: string;
      icon?: string;
      image_url?: string;
    }>;
    facility_items?: Array<{
      title: string;
      description: string;
      icon?: string;
      image_url?: string;
    }>;
    faculty_items?: Array<{
      title: string;
      position?: string;
      description: string;
      image_url?: string;
    }>;
    news_items?: Array<{
      title: string;
      description: string;
    }>;
    testimonial_items?: Array<{
      text: string;
      author: string;
      role?: string;
    }>;
    gallery_items?: Array<{
      image_url: string;
      caption?: string;
    }>;
    class_level_items?: Array<{
      title: string;
      description: string;
      grade_range?: string;
      icon?: string;
      image_url?: string;
    }>;
    curriculum_items?: Array<{
      subject: string;
      description: string;
      grade_levels?: string;
      skills?: string[];
      image_url?: string;
      icon?: string;
    }>;
  };
}

interface SiteSettings {
  site_title: string;
  site_tagline: string;
  logo_url: string;
  hero_background_url: string;
  primary_color: string;
  secondary_color: string;
  contact_email: string;
  contact_phone: string;
  contact_address: string;
  is_website_enabled: boolean;
}

interface SchoolRecord {
  id: string;
  name: string;
  is_active: boolean;
  subdomain: string | null;
}

interface PublishPage {
  id: string;
  title: string;
  slug: string;
  status: "draft" | "published";
  seo_title: string;
  seo_description: string;
}

interface AcademicsEducationLevel {
  id: string;
  name: string;
  code: string | null;
  description: string | null;
  order_sequence: number | null;
  school_class_levels?: Array<{
    id: string;
    name: string;
    code: string | null;
    order_sequence: number | null;
  }>;
}

interface AcademicsSubject {
  id: string;
  name: string;
  subject_code: string | null;
  education_level_id: string | null;
}

interface AcademicsMediaItem {
  id: string;
  file_name: string;
  public_url: string;
  mime_type?: string | null;
  created_at: string;
}

interface AcademicsShowcaseCard {
  id: string;
  title: string;
  description: string;
  image_url: string;
  classLabels: string[];
  subjects: string[];
  subjectCount: number;
}

function formatAcademicsSubjectLabel(subject: AcademicsSubject) {
  const name = subject.name.trim();
  const code = (subject.subject_code || "").trim();
  if (!name) return "";
  return code ? `${name} (${code})` : name;
}

function resolveRequestedPageSlug(slug: string[]): WebsitePageSlug | null {
  if (slug.length === 0 || slug[0] === "home") {
    return "home";
  }
  if (slug.length === 1 && slug[0] === "hall-of-fame") {
    return "hall-of-fame";
  }
  if (slug.length === 1 && slug[0] === "academics") {
    return "academics";
  }
  return null;
}

const FALLBACK_CONTENT = {
  about: {
    heading: "About Our School",
    description:
      "We are dedicated to academic excellence, character formation, and creating opportunities for every learner to thrive.",
    mission: "Our Mission\n\nTo provide quality education that develops critical thinking, creativity, and character while empowering students to become responsible global citizens.",
    vision: "Our Vision\n\nA learning community where every student achieves excellence, discovers their potential, and contributes meaningfully to society.",
    image: "📚",
  },
  programs: [
    { icon: "🔬", title: "Science Department", description: "Physics, Chemistry, Biology, and Mathematics with strong lab-based learning." },
    { icon: "📖", title: "Arts Department", description: "History, Literature, Geography, and Social Sciences with deep analysis." },
    { icon: "💼", title: "Commerce Department", description: "Accounting, Economics, and Business Studies for professional readiness." },
    { icon: "🖥️", title: "Computer Science", description: "Coding, algorithms, web development, and modern digital skills." },
    { icon: "🎨", title: "Co-Curricular", description: "Sports, arts, music, and leadership programs for holistic growth." },
    { icon: "🌍", title: "Skill Development", description: "Career guidance, communication, and life skills for future success." },
  ],
  facilities: [
    { icon: "🔬", title: "Modern Laboratories", description: "Well-equipped science and computer labs with the latest technology." },
    { icon: "📚", title: "Central Library", description: "Extensive books, digital resources, and reading areas." },
    { icon: "🏃", title: "Sports Complex", description: "Indoor and outdoor sports facilities for active development." },
    { icon: "🎭", title: "Auditorium", description: "A professional event space for presentations and performances." },
    { icon: "🍽️", title: "Cafeteria", description: "Hygienic, spacious, and nutritious meal service." },
    { icon: "🏫", title: "Smart Classrooms", description: "Interactive learning spaces with digital teaching tools." },
  ],
  faculty: [
    { avatar: "👨‍🎓", name: "Dr. Rajesh Kumar", role: "Principal", bio: "Experienced academic leader focused on institutional excellence." },
    { avatar: "👩‍🏫", name: "Ms. Priya Sharma", role: "Head of Science Department", bio: "Curriculum development and student mentorship specialist." },
    { avatar: "👨‍🏫", name: "Mr. Arun Verma", role: "Head of Humanities", bio: "Innovative teaching methodologies and cultural education." },
    { avatar: "👩‍💼", name: "Dr. Anjali Patel", role: "Counselor & Psychologist", bio: "Student welfare, career guidance, and holistic development." },
  ],
  news: [
    { icon: "🏆", date: "April 15, 2026", title: "National Science Olympiad Victory", description: "Students secured first position in the national science competition." },
    { icon: "🎓", date: "April 10, 2026", title: "Record Academic Results 2026", description: "Celebrating exceptional exam results with a 98% pass rate." },
    { icon: "📰", date: "April 5, 2026", title: "Environmental Conservation Drive", description: "Students launched a campus-wide tree planting initiative." },
  ],
  testimonials: [
    { stars: "⭐⭐⭐⭐⭐", text: "The faculty here is exceptional and the learning experience is inspiring.", name: "Arjun Kumar", role: "Class 11 Science Student" },
    { stars: "⭐⭐⭐⭐⭐", text: "Excellent infrastructure and countless opportunities to grow academically and personally.", name: "Sneha Patel", role: "Class 12 Commerce Student" },
    { stars: "⭐⭐⭐⭐⭐", text: "My son has grown tremendously here. The school truly develops character and life skills.", name: "Mrs. Sharma", role: "Parent" },
  ],
  gallery: ["🏫", "🎓", "📚", "🎪", "🏃‍♂️", "🎭", "🔬", "👥", "🌍"],
  admissions: {
    requirements: [
      "Age-appropriate for the applying class",
      "Previous academic records",
      "Entrance examination (if applicable)",
      "Personal interview and aptitude assessment",
      "Transfer certificate from previous institution",
      "Character certificate and health records",
    ],
    steps: [
      "Application Form — Submit complete application with required documents",
      "Entrance Test — Evaluate academic aptitude and learning capability",
      "Personal Interview — Meet admission counselors to assess fit",
      "Merit List — Selection based on comprehensive evaluation",
      "Admission Confirmation — Fee deposit and official enrollment",
    ],
  },
  achievements: {
    hero: {
      heading: "Hall of Fame & Achievements",
      subheading: "Celebrating excellence, impact, and milestone moments",
      description: "Explore standout achievements from our students, alumni, teams, and staff.",
      buttonLabel: "Submit an Achievement",
      buttonLink: "#achievements_cta",
    },
    timeline: [
      { year: "2026", detail: "National STEM Challenge Champions" },
      { year: "2025", detail: "Regional Debate League Gold Medal" },
      { year: "2024", detail: "Excellence in Community Impact Award" },
    ],
    hallOfFame: [
      {
        name: "Ada Chukwu",
        role: "Best Graduating Student 2025",
        description: "Graduated with distinction and represented the school nationally in mathematics.",
      },
      {
        name: "Coach Ibrahim Bello",
        role: "Sports Excellence Mentor",
        description: "Led the school athletics team to three consecutive state championships.",
      },
      {
        name: "Debate Team",
        role: "National Finalists",
        description: "Reached national finals with outstanding public speaking and policy analysis.",
      },
    ],
    awards: [
      {
        title: "Academic Excellence Award",
        description: "Recognized for exceptional performance in external examinations.",
      },
      {
        title: "Innovation in Education",
        description: "Awarded for introducing student-led project-based learning initiatives.",
      },
      {
        title: "Community Service Recognition",
        description: "Honored for sustained impact through local outreach and volunteering.",
      },
    ],
    cta: {
      heading: "Share the Next Great Story",
      description: "Know someone who deserves to be celebrated? Send us their story and achievement.",
      buttonLabel: "Nominate an Achiever",
      buttonLink: "#contact",
    },
  },
  contact: {
    address: ["Presidency School, Education Avenue", "City Center, State 123456", "India"],
    phone: ["Main Office: +91 (123) 456-7890", "Admissions: +91 (123) 456-7891", "Support: +91 (123) 456-7892"],
    email: ["info@school.edu", "admissions@school.edu", "support@school.edu"],
    hours: ["Monday - Friday: 8:00 AM - 4:00 PM", "Saturday: 9:00 AM - 1:00 PM", "Sunday: Closed"],
  },
};

const TEMPLATE_TESTIMONIAL_ITEMS =
  WEBSITE_SECTION_TEMPLATES.find((section) => section.key === "testimonials")?.content.testimonial_items || [];

const TEMPLATE_GALLERY_ITEMS =
  WEBSITE_SECTION_TEMPLATES.find((section) => section.key === "gallery")?.content.gallery_items || [];

const HEX_COLOR_PATTERN = /^#?([0-9a-fA-F]{6})$/;

function normalizeHexColor(value: string | undefined, fallback: string) {
  const candidate = (value || "").trim();
  const match = candidate.match(HEX_COLOR_PATTERN);
  if (!match) {
    return fallback;
  }
  return `#${match[1].toLowerCase()}`;
}

function hexToRgbString(hex: string) {
  const normalized = normalizeHexColor(hex, "#000000").slice(1);
  const r = parseInt(normalized.slice(0, 2), 16);
  const g = parseInt(normalized.slice(2, 4), 16);
  const b = parseInt(normalized.slice(4, 6), 16);
  return `${r} ${g} ${b}`;
}

function blendHexColors(hexA: string, hexB: string, weight = 0.5) {
  const a = normalizeHexColor(hexA, "#000000").slice(1);
  const b = normalizeHexColor(hexB, "#000000").slice(1);
  const mix = Math.min(1, Math.max(0, weight));

  const toChannel = (index: number) => {
    const channelA = parseInt(a.slice(index, index + 2), 16);
    const channelB = parseInt(b.slice(index, index + 2), 16);
    return Math.round(channelA * (1 - mix) + channelB * mix)
      .toString(16)
      .padStart(2, "0");
  };

  return `#${toChannel(0)}${toChannel(2)}${toChannel(4)}`;
}

function buildThemeStyleVariables(siteSettings: SiteSettings) {
  const primary = normalizeHexColor(siteSettings.primary_color, WEBSITE_DEFAULT_SITE_SETTINGS.primary_color);
  const secondary = normalizeHexColor(siteSettings.secondary_color, WEBSITE_DEFAULT_SITE_SETTINGS.secondary_color);
  const primarySoft = blendHexColors(primary, "#ffffff", 0.74);
  const secondarySoft = blendHexColors(secondary, "#ffffff", 0.74);
  const primaryDeep = blendHexColors(primary, "#0f172a", 0.2);
  const secondaryDeep = blendHexColors(secondary, "#0f172a", 0.2);

  return {
    "--wb-primary": primary,
    "--wb-secondary": secondary,
    "--wb-primary-rgb": hexToRgbString(primary),
    "--wb-secondary-rgb": hexToRgbString(secondary),
    "--wb-primary-soft": primarySoft,
    "--wb-secondary-soft": secondarySoft,
    "--wb-primary-deep": primaryDeep,
    "--wb-secondary-deep": secondaryDeep,
  } as any;
}

function getSupabaseAnonClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new Error("Supabase public env vars are required for website rendering");
  }

  return createClient(url, key);
}

function getHostSubdomain(hostname: string) {
  const host = hostname.split(":")[0].toLowerCase();
  const parts = host.split(".");
  if (host.includes("localhost")) {
    return parts.length > 1 ? parts[0] : null;
  }
  return parts.length >= 3 ? parts[0] : null;
}

async function resolveSchool(subdomain: string, supabase: ReturnType<typeof getSupabaseAnonClient>) {
  const { data, error } = await supabase.rpc("get_school_by_subdomain", { p_subdomain: subdomain });
  if (error) throw error;
  const school = Array.isArray(data) ? data[0] : data;
  return (school as SchoolRecord | null) || null;
}

function resolvePreviewMode(searchParams: { preview?: string }) {
  return searchParams.preview === "1" || searchParams.preview === "true";
}

async function isAdminPreviewAllowed() {
  const supabase = createServerComponentClient({ cookies });
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;
  const { data: canAccessAdmin } = await supabase.rpc("can_access_admin");
  return Boolean(canAccessAdmin);
}

function renderHero(siteSettings: SiteSettings, sections: WebsiteSection[]) {
  const section = sections.find((item) => item.section_key === "home");
  const heading = section?.content.heading || `Welcome to ${siteSettings.site_title}`;
  const subheading = section?.content.subheading || "Excellence in Education • Nurturing Future Leaders • Building Tomorrow's Dreams";
  const buttonLabel = section?.content.button_label || "Apply Now";
  const buttonLink = section?.content.button_link || "#admissions";
  const heroImage = section?.content.image_url || siteSettings.hero_background_url;
  const heroCardBadge = section?.content.hero_card_badge || "Student Focus";
  const heroCardTitle = section?.content.hero_card_title || "Modern learning. Strong values. Real outcomes.";
  const heroCardDescription =
    section?.content.hero_card_description ||
    "A school built to communicate trust, clarity, and excellence from the first glance.";
  const heroStats =
    section?.content.hero_stats
      ?.map((entry) => entry.split("|").map((value) => value.trim()))
      .filter((entry) => entry.length >= 2 && entry[0] && entry[1])
      .map(([value, label]) => [value, label] as [string, string]) || [
      ["850+", "Students"],
      ["95%", "Pass Rate"],
      ["25+", "Years"],
      ["50+", "Faculty"],
    ];

  return (
    <section id="home" className="relative overflow-hidden bg-slate-950 text-white">
      <div className="absolute inset-0">
        {heroImage ? (
          <img src={heroImage} alt="Hero background" className="h-full w-full object-cover opacity-30" />
        ) : (
          <div
            className="h-full w-full"
            style={{
              background:
                "radial-gradient(circle at top right, rgba(var(--wb-secondary-rgb),0.28), transparent 35%), linear-gradient(135deg, #0f172a 0%, #111827 50%, #1f2937 100%)",
            }}
          />
        )}
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(2,6,23,0.15),rgba(2,6,23,0.88))]" />
      </div>

      <div className="relative mx-auto grid max-w-[1200px] gap-10 px-4 py-24 md:grid-cols-[1.2fr_0.8fr] md:px-6 md:py-32">
        <div className="max-w-3xl">
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-xs uppercase tracking-[0.22em] backdrop-blur" style={{ color: "rgba(var(--wb-secondary-rgb),0.95)" }}>
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: "var(--wb-secondary)" }} />
            Official School Website
          </div>
          <h1 className="text-4xl font-black leading-[1.05] tracking-tight md:text-6xl">{heading}</h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-white/82 md:text-xl">{subheading}</p>
          <div className="mt-10 flex flex-wrap gap-4">
            <a
              href={buttonLink}
              className="inline-flex items-center rounded-full px-7 py-3.5 text-sm font-bold text-slate-950 transition hover:translate-y-[-1px] hover:opacity-90"
              style={{
                backgroundColor: "var(--wb-secondary)",
                boxShadow: "0 18px 50px rgba(var(--wb-secondary-rgb),0.35)",
              }}
            >
              {buttonLabel}
            </a>
            <a href="#contact" className="inline-flex items-center rounded-full border border-white/20 bg-white/5 px-7 py-3.5 text-sm font-semibold text-white/90 backdrop-blur transition hover:bg-white/10">
              Schedule a Tour
            </a>
          </div>
        </div>

        <div className="flex items-end justify-end">
          <div className="grid w-full max-w-md gap-4 rounded-[28px] border border-white/10 bg-white/8 p-4 shadow-2xl backdrop-blur-xl">
            <div className="rounded-[24px] bg-white/10 p-6">
              <p className="text-xs uppercase tracking-[0.22em]" style={{ color: "rgba(var(--wb-secondary-rgb),0.82)" }}>{heroCardBadge}</p>
              <p className="mt-3 text-2xl font-semibold text-white">{heroCardTitle}</p>
              <p className="mt-3 text-sm leading-6 text-white/70">{heroCardDescription}</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {heroStats.map(([value, label]) => (
                <div key={label} className="rounded-2xl border border-white/10 bg-slate-950/50 p-4 text-center">
                  <div className="text-2xl font-black" style={{ color: "var(--wb-secondary)" }}>{value}</div>
                  <div className="mt-1 text-xs uppercase tracking-[0.16em] text-white/60">{label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function renderAbout(section: WebsiteSection | undefined) {
  const fallback = FALLBACK_CONTENT.about;
  const mission = section?.content.mission || fallback.mission;
  const vision = section?.content.vision || fallback.vision;

  return (
    <section id="about" className="bg-slate-50 px-4 py-20 md:px-6">
      <div className="mx-auto grid max-w-[1200px] items-center gap-14 md:grid-cols-2">
        <div>
          <p className="mb-3 text-sm font-bold uppercase tracking-[0.26em]" style={{ color: "var(--wb-secondary)" }}>About</p>
          <h2 className="text-3xl font-black tracking-tight text-slate-950 md:text-5xl">{section?.content.heading || fallback.heading}</h2>
          <p className="mt-6 max-w-2xl text-base leading-8 text-slate-600 md:text-lg">{section?.content.description || fallback.description}</p>

          <div className="mt-8 space-y-4">
            <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
              <div className="whitespace-pre-line text-sm leading-7 text-slate-700">{mission}</div>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
              <div className="whitespace-pre-line text-sm leading-7 text-slate-700">{vision}</div>
            </div>
          </div>
        </div>

        <div className="relative">
          <div className="absolute -inset-4 rounded-[34px] blur-2xl opacity-70" style={{ background: "linear-gradient(135deg, var(--wb-secondary-soft), var(--wb-primary-soft))" }} />
          <div className="relative flex h-[420px] items-center justify-center rounded-[34px] text-[5rem] shadow-2xl" style={{ background: "linear-gradient(135deg, var(--wb-primary), var(--wb-secondary))" }}>
            {section?.content.image_url ? (
              <img src={section.content.image_url} alt={section.section_label || fallback.heading} className="h-full w-full rounded-[34px] object-cover" />
            ) : (
              fallback.image
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

function getProgramCardItems(section: WebsiteSection | undefined) {
  const structuredItems = (section?.content.program_items || [])
    .map((item, index) => {
      const fallback = FALLBACK_CONTENT.programs[index % FALLBACK_CONTENT.programs.length];
      return {
        title: (item.title || "").trim(),
        description: (item.description || fallback.description || "").trim(),
        icon: (item.icon || fallback.icon || "📘").trim() || "📘",
        image_url: (item.image_url || "").trim(),
      };
    })
    .filter((item) => item.title);

  if (structuredItems.length > 0) {
    return structuredItems;
  }

  const legacyItems = (section?.content.items || []).map((item) => item.trim()).filter(Boolean);
  if (legacyItems.length > 0) {
    return legacyItems.map((title, index) => {
      const matched = FALLBACK_CONTENT.programs.find((item) => item.title.toLowerCase() === title.toLowerCase());
      const fallback = matched || FALLBACK_CONTENT.programs[index % FALLBACK_CONTENT.programs.length];
      return {
        title,
        description: fallback?.description || "",
        icon: fallback?.icon || "📘",
        image_url: "",
      };
    });
  }

  return FALLBACK_CONTENT.programs;
}

function getFacilityCardItems(section: WebsiteSection | undefined) {
  const structuredItems = (section?.content.facility_items || [])
    .map((item, index) => {
      const fallback = FALLBACK_CONTENT.facilities[index % FALLBACK_CONTENT.facilities.length];
      return {
        title: (item.title || "").trim(),
        description: (item.description || fallback.description || "").trim(),
        icon: (item.icon || fallback.icon || "🏢").trim() || "🏢",
        image_url: (item.image_url || "").trim(),
      };
    })
    .filter((item) => item.title);

  if (structuredItems.length > 0) {
    return structuredItems;
  }

  const legacyItems = (section?.content.items || []).map((item) => item.trim()).filter(Boolean);
  if (legacyItems.length > 0) {
    return legacyItems.map((title, index) => {
      const matched = FALLBACK_CONTENT.facilities.find((item) => item.title.toLowerCase() === title.toLowerCase());
      const fallback = matched || FALLBACK_CONTENT.facilities[index % FALLBACK_CONTENT.facilities.length];
      return {
        title,
        description: fallback?.description || "",
        icon: fallback?.icon || "🏢",
        image_url: "",
      };
    });
  }

  return FALLBACK_CONTENT.facilities;
}

interface FacultyCardItem {
  avatar: string;
  name: string;
  role: string;
  bio: string;
  image_url: string;
}

function getFacultyCardItems(section: WebsiteSection | undefined): FacultyCardItem[] {
  const structuredItems = (section?.content.faculty_items || [])
    .map((item, index) => {
      const fallback = FALLBACK_CONTENT.faculty[index % FALLBACK_CONTENT.faculty.length];
      return {
        avatar: fallback.avatar,
        name: (item.title || "").trim(),
        role: (item.position || fallback.role || "").trim(),
        bio: (item.description || fallback.bio || "").trim(),
        image_url: (item.image_url || "").trim(),
      };
    })
    .filter((item) => item.name);

  if (structuredItems.length > 0) {
    return structuredItems;
  }

  return FALLBACK_CONTENT.faculty.map((item) => ({
    ...item,
    image_url: "",
  }));
}

function getNewsCardItems(section: WebsiteSection | undefined) {
  const structuredItems = (section?.content.news_items || [])
    .map((item, index) => {
      const fallback = FALLBACK_CONTENT.news[index % FALLBACK_CONTENT.news.length];
      return {
        icon: fallback.icon,
        date: fallback.date,
        title: (item.title || "").trim(),
        description: (item.description || fallback.description || "").trim(),
      };
    })
    .filter((item) => item.title);

  if (structuredItems.length > 0) {
    return structuredItems;
  }

  return FALLBACK_CONTENT.news;
}

function getTestimonialCardItems(section: WebsiteSection | undefined) {
  const structuredItems = (section?.content.testimonial_items || [])
    .map((item) => ({
      stars: "⭐⭐⭐⭐⭐",
      text: (item.text || "").trim(),
      name: (item.author || "").trim(),
      role: (item.role || "").trim(),
    }))
    .filter((item) => item.text && item.name);

  if (structuredItems.length > 0) {
    return structuredItems;
  }

  return TEMPLATE_TESTIMONIAL_ITEMS.map((item) => ({
    stars: "⭐⭐⭐⭐⭐",
    text: item.text,
    name: item.author,
    role: item.role || "",
  }));
}

function getGalleryItems(section: WebsiteSection | undefined) {
  const structuredItems = (section?.content.gallery_items || [])
    .map((item, index) => {
      const fallback = FALLBACK_CONTENT.gallery[index % FALLBACK_CONTENT.gallery.length];
      return {
        image_url: (item.image_url || "").trim(),
        caption: (item.caption || "").trim(),
        fallbackIcon: fallback,
      };
    })
    .filter((item) => item.image_url || item.fallbackIcon);

  if (structuredItems.length > 0) {
    return structuredItems;
  }

  return TEMPLATE_GALLERY_ITEMS.map((item, index) => {
    const fallbackIcon = FALLBACK_CONTENT.gallery[index % FALLBACK_CONTENT.gallery.length];
    return {
      image_url: item.image_url || "",
      caption: item.caption || "",
      fallbackIcon,
    };
  });
}

function renderCardGrid(
  section: WebsiteSection | undefined,
  items: Array<{ icon: string; title: string; description: string; image_url?: string }>,
  sectionId: string,
  accentClass: string
) {
  const title = section?.content.heading || (sectionId === "programs" ? "Academic Programs" : "Our Facilities");
  const subtitle = section?.content.subheading || (sectionId === "programs" ? "Comprehensive educational programs designed to develop critical thinking and academic excellence" : "State-of-the-art infrastructure designed for comprehensive student development");

  return (
    <section id={sectionId} className={`${accentClass} px-4 py-20 md:px-6`}>
      <div className="mx-auto max-w-[1200px]">
        <div className="text-center">
          <h2 className="text-3xl font-black tracking-tight text-slate-950 md:text-5xl">{title}</h2>
          <p className="mx-auto mt-4 max-w-3xl text-base leading-8 text-slate-600 md:text-lg">{subtitle}</p>
        </div>

        <div className={`mt-12 grid gap-6 ${sectionId === "programs" || sectionId === "facilities" ? "md:grid-cols-2 xl:grid-cols-3" : "md:grid-cols-2 xl:grid-cols-3"}`}>
          {items.map((item, index) =>
            sectionId === "programs" || sectionId === "facilities" ? (
              <article key={`${item.title}-${index}`} className="group overflow-hidden rounded-sm border border-slate-200 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-lg">
                <div className="relative h-56 w-full overflow-hidden bg-slate-900">
                  {item.image_url ? (
                    <img src={item.image_url} alt={item.title} className="h-full w-full object-cover transition duration-500 group-hover:scale-105" />
                  ) : (
                    <div
                      className="flex h-full w-full items-center justify-center text-7xl text-white/90"
                      style={{
                        background:
                          sectionId === "programs"
                            ? "linear-gradient(135deg, var(--wb-primary), var(--wb-secondary))"
                            : "linear-gradient(135deg, var(--wb-secondary-deep), var(--wb-secondary))",
                      }}
                    >
                      {item.icon}
                    </div>
                  )}
                  <div
                    className="absolute right-0 top-4 px-5 py-2 text-sm font-bold text-white shadow-md"
                    style={{ backgroundColor: sectionId === "programs" ? "var(--wb-primary-deep)" : "var(--wb-secondary-deep)" }}
                  >
                    {item.title}
                  </div>
                </div>

                <div className="px-6 py-7">
                  <h3 className="text-[2rem] font-black leading-tight text-slate-900">{item.title}</h3>
                  <p className="mt-4 text-[1.65rem] leading-snug text-slate-600">{item.description}</p>
                </div>

                <div className="flex items-center justify-between border-t border-slate-200 px-6 py-4">
                  <div className="text-xl tracking-[0.15em]" style={{ color: "var(--wb-secondary)" }}>★★★★</div>
                  <div
                    className="inline-flex items-center gap-2 text-[1.35rem] font-semibold text-slate-900"
                    style={{ color: sectionId === "programs" ? "var(--wb-primary-deep)" : "var(--wb-secondary-deep)" }}
                  >
                    <span>✧</span>
                    <span>{item.title}</span>
                  </div>
                </div>
              </article>
            ) : (
              <article key={`${item.title}-${index}`} className="group rounded-[28px] border border-slate-200 bg-white p-7 shadow-sm transition hover:-translate-y-1 hover:shadow-xl">
                <div className="mb-5 flex h-16 w-16 items-center justify-center overflow-hidden rounded-2xl bg-slate-950 text-3xl text-white shadow-lg shadow-slate-950/10">
                  <span>{item.icon}</span>
                </div>
                <h3 className="text-xl font-bold text-slate-950">{item.title}</h3>
                <p className="mt-3 text-sm leading-7 text-slate-600">{item.description}</p>
              </article>
            )
          )}
        </div>
      </div>
    </section>
  );
}

function renderFaculty(section: WebsiteSection | undefined) {
  const title = section?.content.heading || "Our Faculty";
  const subtitle = section?.content.subheading || "Distinguished educators committed to nurturing excellence and shaping future leaders";
  const facultyItems = getFacultyCardItems(section);

  return (
    <section id="faculty" className="bg-white px-4 py-20 md:px-6">
      <div className="mx-auto max-w-[1200px]">
        <div className="text-center">
          <h2 className="text-3xl font-black tracking-tight text-slate-950 md:text-5xl">{title}</h2>
          <p className="mx-auto mt-4 max-w-3xl text-base leading-8 text-slate-600 md:text-lg">{subtitle}</p>
        </div>
        <div className="mt-12 grid gap-6 md:grid-cols-2 xl:grid-cols-4">
          {facultyItems.map((member) => (
            <article key={member.name} className="overflow-hidden rounded-[28px] border border-slate-200 bg-slate-50 shadow-sm transition hover:-translate-y-1 hover:shadow-xl">
              <div className="flex h-64 items-center justify-center text-6xl text-white/35" style={{ background: "linear-gradient(135deg, var(--wb-primary), var(--wb-secondary))" }}>
                {member.image_url ? (
                  <img src={member.image_url} alt={member.name} className="h-full w-full object-cover" />
                ) : (
                  member.avatar
                )}
              </div>
              <div className="p-6 text-center">
                <h3 className="text-lg font-bold text-slate-950">{member.name}</h3>
                <p className="mt-1 text-sm font-medium" style={{ color: "var(--wb-secondary-deep)" }}>{member.role}</p>
                <p className="mt-3 text-sm leading-7 text-slate-600">{member.bio}</p>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function renderNews(section: WebsiteSection | undefined) {
  const title = section?.content.heading || "Latest News & Updates";
  const subtitle = section?.content.subheading || "Stay informed about school events, achievements, and important announcements";
  const newsItems = getNewsCardItems(section);

  return (
    <section id="news" className="bg-slate-50 px-4 py-20 md:px-6">
      <div className="mx-auto max-w-[1200px]">
        <div className="text-center">
          <h2 className="text-3xl font-black tracking-tight text-slate-950 md:text-5xl">{title}</h2>
          <p className="mx-auto mt-4 max-w-3xl text-base leading-8 text-slate-600 md:text-lg">{subtitle}</p>
        </div>

        <div className="mt-12 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {newsItems.map((item) => (
            <article key={item.title} className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-xl">
              <div className="flex h-48 items-center justify-center text-5xl text-white" style={{ background: "linear-gradient(135deg, var(--wb-secondary), var(--wb-primary))" }}>{item.icon}</div>
              <div className="p-6">
                <p className="text-xs font-semibold uppercase tracking-[0.24em]" style={{ color: "var(--wb-secondary-deep)" }}>{item.date}</p>
                <h3 className="mt-3 text-xl font-bold text-slate-950">{item.title}</h3>
                <p className="mt-3 text-sm leading-7 text-slate-600">{item.description}</p>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function renderTestimonials(section: WebsiteSection | undefined, siteSettings: SiteSettings) {
  const title = section?.content.heading || "Student & Parent Testimonials";
  const subtitle = section?.content.subheading || `Hear from our students and parents about their experience at ${siteSettings.site_title}`;
  const testimonialItems = getTestimonialCardItems(section);

  return (
    <section id="testimonials" className="bg-white px-4 py-20 md:px-6">
      <div className="mx-auto max-w-[1200px]">
        <div className="text-center">
          <h2 className="text-3xl font-black tracking-tight text-slate-950 md:text-5xl">{title}</h2>
          <p className="mx-auto mt-4 max-w-3xl text-base leading-8 text-slate-600 md:text-lg">{subtitle}</p>
        </div>

        <div className="mt-12 grid gap-6 md:grid-cols-2 xl:grid-cols-4">
          {testimonialItems.map((item) => (
            <article key={item.name} className="rounded-[28px] border border-slate-200 bg-slate-50 p-7 shadow-sm transition hover:-translate-y-1 hover:shadow-xl">
              <div style={{ color: "var(--wb-secondary)" }}>{item.stars}</div>
              <p className="mt-5 text-sm leading-7 text-slate-700 italic">{item.text}</p>
              <div className="mt-6 font-bold text-slate-950">{item.name}</div>
              <div className="text-sm text-slate-500">{item.role}</div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function renderGallery(section: WebsiteSection | undefined, siteSettings: SiteSettings) {
  const title = section?.content.heading || "Campus Gallery";
  const subtitle = section?.content.subheading || `Explore moments and memories from ${siteSettings.site_title}`;
  const galleryItems = getGalleryItems(section);

  return (
    <section id="gallery" className="bg-slate-50 px-4 py-20 md:px-6">
      <div className="mx-auto max-w-[1200px]">
        <div className="text-center">
          <h2 className="text-3xl font-black tracking-tight text-slate-950 md:text-5xl">{title}</h2>
          <p className="mx-auto mt-4 max-w-3xl text-base leading-8 text-slate-600 md:text-lg">{subtitle}</p>
        </div>
        <div className="mt-12 grid gap-4 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-3">
          {galleryItems.map((item, index) => {
            const palette = [
              "linear-gradient(135deg, var(--wb-primary), var(--wb-secondary))",
              "linear-gradient(135deg, rgba(var(--wb-secondary-rgb),0.95), rgba(var(--wb-primary-rgb),0.85))",
              "linear-gradient(135deg, var(--wb-secondary-deep), var(--wb-secondary))",
              "linear-gradient(135deg, var(--wb-primary-deep), var(--wb-primary))",
              "linear-gradient(135deg, rgba(var(--wb-primary-rgb),0.78), rgba(var(--wb-secondary-rgb),0.78))",
              "linear-gradient(135deg, var(--wb-secondary), var(--wb-primary-soft))",
              "linear-gradient(135deg, var(--wb-primary), var(--wb-secondary-soft))",
              "linear-gradient(135deg, rgba(var(--wb-secondary-rgb),0.88), rgba(var(--wb-primary-rgb),0.62))",
              "linear-gradient(135deg, var(--wb-primary-soft), var(--wb-secondary-soft))",
            ];
            return (
              <div
                key={`${item.image_url || item.fallbackIcon}-${index}`}
                className="group relative flex h-52 items-center justify-center overflow-hidden rounded-[24px] text-5xl text-white shadow-lg"
                style={{ background: palette[index % palette.length] }}
              >
                {item.image_url ? (
                  <img src={item.image_url} alt={item.caption || `Gallery ${index + 1}`} className="h-full w-full object-cover" />
                ) : (
                  <span className="relative z-10">{item.fallbackIcon}</span>
                )}
                <div className="absolute inset-0 bg-black/0 transition group-hover:bg-black/20" />
                {item.caption ? (
                  <div className="absolute bottom-0 left-0 right-0 bg-black/55 px-3 py-2 text-xs font-medium text-white">
                    {item.caption}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function isPreviewableAcademicsImage(mediaItem: AcademicsMediaItem) {
  const url = mediaItem.public_url.toLowerCase();
  const mime = (mediaItem.mime_type || "").toLowerCase();
  if (mime.startsWith("image/")) return true;
  return [".jpg", ".jpeg", ".png", ".webp", ".gif", ".svg"].some((ext) => url.includes(ext));
}

function buildAcademicsShowcaseCards(
  educationLevels: AcademicsEducationLevel[],
  subjects: AcademicsSubject[],
  media: AcademicsMediaItem[],
  siteSettings: SiteSettings
): AcademicsShowcaseCard[] {
  const imagePool = media.filter(isPreviewableAcademicsImage).map((item) => item.public_url);
  const fallbackImagePool = [siteSettings.hero_background_url, siteSettings.logo_url].filter(Boolean);
  const resolvedImagePool = imagePool.length > 0 ? imagePool : fallbackImagePool;

  return educationLevels.map((level, index) => {
    const classLabels = (level.school_class_levels || [])
      .sort((a, b) => (a.order_sequence || 0) - (b.order_sequence || 0))
      .map((item) => item.name.trim())
      .filter(Boolean);

    const levelSubjects = subjects
      .filter((subject) => subject.education_level_id === level.id)
      .map((subject) => formatAcademicsSubjectLabel(subject))
      .filter(Boolean);

    const image_url = resolvedImagePool.length > 0 ? resolvedImagePool[index % resolvedImagePool.length] : "";
    const description =
      (level.description || "").trim() ||
      (classLabels.length > 0
        ? `Offered through ${classLabels.slice(0, 2).join(", ")}${classLabels.length > 2 ? " and more" : ""}.`
        : "Offered as part of our school structure.");

    return {
      id: level.id,
      title: level.name.trim(),
      description,
      image_url,
      classLabels,
      subjects: levelSubjects.slice(0, 4),
      subjectCount: levelSubjects.length,
    };
  });
}

function renderAcademicsShowcase(
  heroSection: WebsiteSection | undefined,
  cards: AcademicsShowcaseCard[],
  siteSettings: SiteSettings
) {
  const heading = heroSection?.content.heading || `Academics at ${siteSettings.site_title}`;
  const subheading = heroSection?.content.subheading || "Explore the education levels we offer and the subjects that shape each level.";
  const description =
    heroSection?.content.description ||
    "This page is generated from the school database so visitors see the actual academic structure, not a heavy content editor.";
  const buttonLabel = heroSection?.content.button_label || "View Contact Details";
  const buttonLink = heroSection?.content.button_link || "#contact";

  const levelCount = cards.length;
  const subjectCount = cards.reduce((total, card) => total + card.subjectCount, 0);
  const classLevelCount = cards.reduce((total, card) => total + card.classLabels.length, 0);

  return (
    <section id="academics_overview" className="px-4 py-16 md:px-6">
      <div className="mx-auto max-w-[1200px]">
        <div className="overflow-hidden rounded-[32px] border border-slate-200 bg-white shadow-[0_24px_70px_rgba(15,23,42,0.08)]">
          <div className="relative overflow-hidden bg-slate-950 px-6 py-14 text-white md:px-10 md:py-16">
            <div className="absolute inset-0 opacity-95" style={{ background: "linear-gradient(135deg, #0f172a 0%, #1e293b 45%, rgba(var(--wb-secondary-rgb),0.28) 100%)" }} />
            <div className="relative mx-auto max-w-4xl text-center">
              <p className="text-xs font-semibold uppercase tracking-[0.28em]" style={{ color: "rgba(var(--wb-secondary-rgb),0.92)" }}>
                School Database Snapshot
              </p>
              <h1 className="mt-4 text-4xl font-black tracking-tight md:text-6xl">{heading}</h1>
              <p className="mx-auto mt-5 max-w-3xl text-base leading-8 text-white/85 md:text-lg">{subheading}</p>
              <p className="mx-auto mt-3 max-w-2xl text-sm leading-7 text-white/72">{description}</p>
              <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
                <a
                  href={buttonLink}
                  className="inline-flex rounded-full px-6 py-3 text-sm font-bold text-slate-950 transition hover:opacity-90"
                  style={{ backgroundColor: "var(--wb-secondary)" }}
                >
                  {buttonLabel}
                </a>
                <div className="rounded-full border border-white/15 bg-white/10 px-4 py-3 text-xs font-medium text-white/85 backdrop-blur">
                  {levelCount} education level{levelCount === 1 ? "" : "s"} · {subjectCount} subjects · {classLevelCount} class groups
                </div>
              </div>
            </div>
          </div>

          <div className="grid gap-4 px-6 py-6 md:grid-cols-3 md:px-10">
            {[
              { label: "Education Levels", value: levelCount },
              { label: "Subjects", value: subjectCount },
              { label: "Class Groups", value: classLevelCount },
            ].map((stat) => (
              <div key={stat.label} className="rounded-2xl border border-slate-200 bg-slate-50 px-5 py-4">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">{stat.label}</p>
                <p className="mt-2 text-3xl font-black text-slate-950">{stat.value}</p>
              </div>
            ))}
          </div>
        </div>

        {cards.length === 0 ? (
          <div className="mt-8 rounded-[28px] border border-dashed border-slate-300 bg-slate-50 px-6 py-12 text-center text-sm text-slate-500">
            No education levels were found in the school database yet.
          </div>
        ) : (
          <div className="mt-8 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {cards.map((card, index) => (
              <article
                key={card.id}
                id={`academics-level-${card.id}`}
                className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-xl"
              >
              <div className="relative h-56 overflow-hidden bg-slate-900">
                {card.image_url ? (
                  <img src={card.image_url} alt={card.title} className="h-full w-full object-cover transition duration-500 hover:scale-105" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-6xl text-white" style={{ background: "linear-gradient(135deg, var(--wb-primary), var(--wb-secondary))" }}>
                    {card.title.slice(0, 1).toUpperCase()}
                  </div>
                )}
                <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(2,6,23,0.08),rgba(2,6,23,0.68))]" />
                <div className="absolute left-4 top-4 rounded-full bg-white/90 px-3 py-1 text-xs font-bold text-slate-900 shadow-sm">
                  Level {index + 1}
                </div>
                <div className="absolute bottom-4 left-4 right-4 space-y-2 text-white">
                  <h2 className="text-2xl font-black tracking-tight">{card.title}</h2>
                  <p className="text-sm leading-6 text-white/80">{card.description}</p>
                </div>
              </div>

              <div className="space-y-4 p-6">
                {card.classLabels.length > 0 ? (
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Class groups</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {card.classLabels.slice(0, 4).map((label) => (
                        <span key={label} className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
                          {label}
                        </span>
                      ))}
                      {card.classLabels.length > 4 ? (
                        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
                          +{card.classLabels.length - 4} more
                        </span>
                      ) : null}
                    </div>
                  </div>
                ) : null}

                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Sample subjects</p>
                  {card.subjects.length > 0 ? (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {card.subjects.map((subject) => (
                        <span key={subject} className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-700">
                          {subject}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-2 text-sm text-slate-500">Subjects are configured in the school database.</p>
                  )}
                </div>
              </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function getAchievementTimeline(section: WebsiteSection | undefined) {
  const structured = (section?.content.items || [])
    .map((entry) => entry.split("|").map((value) => value.trim()))
    .filter((parts) => parts.length >= 2 && parts[0] && parts[1])
    .map(([year, detail]) => ({ year, detail }));

  if (structured.length > 0) {
    return structured;
  }

  return FALLBACK_CONTENT.achievements.timeline;
}

function getHallOfFameProfiles(section: WebsiteSection | undefined) {
  const structured = (section?.content.faculty_items || [])
    .map((item) => ({
      name: (item.title || "").trim(),
      role: (item.position || "").trim(),
      description: (item.description || "").trim(),
      image_url: (item.image_url || "").trim(),
    }))
    .filter((item) => item.name);

  if (structured.length > 0) {
    return structured;
  }

  return FALLBACK_CONTENT.achievements.hallOfFame.map((item) => ({
    ...item,
    image_url: "",
  }));
}

function getAchievementAwards(section: WebsiteSection | undefined) {
  const structured = (section?.content.news_items || [])
    .map((item) => ({
      title: (item.title || "").trim(),
      description: (item.description || "").trim(),
    }))
    .filter((item) => item.title);

  if (structured.length > 0) {
    return structured;
  }

  return FALLBACK_CONTENT.achievements.awards;
}

function renderHallOfFameHero(section: WebsiteSection | undefined, siteSettings: SiteSettings) {
  const fallback = FALLBACK_CONTENT.achievements.hero;
  const heading = section?.content.heading || fallback.heading;
  const subheading = section?.content.subheading || fallback.subheading;
  const description = section?.content.description || fallback.description;
  const heroImage = (section?.content.image_url || "").trim();
  const buttonLabel = section?.content.button_label || fallback.buttonLabel;
  const buttonLink = section?.content.button_link || fallback.buttonLink;

  return (
    <section id="achievements_hero" className="relative overflow-hidden bg-slate-950 px-4 py-24 text-white md:px-6 md:py-32">
      <div className="absolute inset-0">
        {heroImage ? (
          <img src={heroImage} alt="Hall of Fame hero background" className="h-full w-full object-cover object-center opacity-50" />
        ) : (
          <div
            className="h-full w-full"
            style={{
              background:
                "radial-gradient(circle at top right, rgba(var(--wb-secondary-rgb),0.28), transparent 35%), linear-gradient(135deg, #0f172a 0%, #111827 55%, #1f2937 100%)",
            }}
          />
        )}
        <div className="absolute inset-0 bg-slate-950/30" />
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(circle at center, rgba(2,6,23,0.16) 0%, rgba(2,6,23,0.48) 62%, rgba(2,6,23,0.72) 100%), linear-gradient(180deg, rgba(2,6,23,0.2), rgba(2,6,23,0.62))",
          }}
        />
      </div>
      <div className="relative mx-auto max-w-[1100px]">
        <div className="mx-auto max-w-4xl rounded-[30px] border border-white/20 bg-slate-950/26 px-5 py-8 text-center shadow-[0_24px_64px_rgba(2,6,23,0.42)] backdrop-blur-sm md:px-10 md:py-10">
          <p className="text-xs font-semibold uppercase tracking-[0.28em]" style={{ color: "rgba(var(--wb-secondary-rgb),0.92)" }}>
            {siteSettings.site_title}
          </p>
          <h1 className="mt-4 text-4xl font-black tracking-tight text-white drop-shadow-[0_8px_24px_rgba(2,6,23,0.7)] md:text-6xl">{heading}</h1>
          <p className="mx-auto mt-5 max-w-3xl text-base leading-8 text-white/88 md:text-lg">{subheading}</p>
          <p className="mx-auto mt-3 max-w-2xl text-sm leading-7 text-white/76">{description}</p>
          <a
            href={buttonLink}
            className="mt-8 inline-flex rounded-full px-7 py-3 text-sm font-bold text-slate-950"
            style={{ backgroundColor: "var(--wb-secondary)" }}
          >
            {buttonLabel}
          </a>
        </div>
      </div>
    </section>
  );
}

function renderAchievementTimeline(section: WebsiteSection | undefined) {
  const heading = section?.content.heading || "Milestone Timeline";
  const subheading = section?.content.subheading || "A quick look at our most memorable wins";
  const entries = getAchievementTimeline(section);

  return (
    <section id="achievements_timeline" className="bg-white px-4 py-20 md:px-6">
      <div className="mx-auto max-w-[1100px]">
        <h2 className="text-center text-3xl font-black tracking-tight text-slate-950 md:text-5xl">{heading}</h2>
        <p className="mx-auto mt-4 max-w-3xl text-center text-base leading-8 text-slate-600 md:text-lg">{subheading}</p>
        <div className="mt-12 space-y-4">
          {entries.map((entry) => (
            <div key={`${entry.year}-${entry.detail}`} className="grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-5 md:grid-cols-[140px_1fr] md:items-center">
              <div className="text-xl font-black" style={{ color: "var(--wb-primary)" }}>{entry.year}</div>
              <div className="text-sm leading-7 text-slate-700 md:text-base">{entry.detail}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function renderHallOfFameCards(section: WebsiteSection | undefined) {
  const heading = section?.content.heading || "Hall of Fame";
  const subheading = section?.content.subheading || "Students and staff who raised the bar";
  const profiles = getHallOfFameProfiles(section);

  return (
    <section id="hall_of_fame" className="bg-slate-50 px-4 py-20 md:px-6">
      <div className="mx-auto max-w-[1200px]">
        <h2 className="text-center text-3xl font-black tracking-tight text-slate-950 md:text-5xl">{heading}</h2>
        <p className="mx-auto mt-4 max-w-3xl text-center text-base leading-8 text-slate-600 md:text-lg">{subheading}</p>
        <div className="mt-12 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {profiles.map((profile) => (
            <article key={profile.name} className="overflow-hidden rounded-[26px] border border-slate-200 bg-white shadow-sm">
              <div className="flex h-52 items-center justify-center text-6xl text-white" style={{ background: "linear-gradient(135deg, var(--wb-primary), var(--wb-secondary))" }}>
                {profile.image_url ? (
                  <img src={profile.image_url} alt={profile.name} className="h-full w-full object-cover" />
                ) : (
                  <span>🏅</span>
                )}
              </div>
              <div className="p-6">
                <h3 className="text-xl font-bold text-slate-950">{profile.name}</h3>
                <p className="mt-1 text-sm font-medium" style={{ color: "var(--wb-secondary-deep)" }}>{profile.role}</p>
                <p className="mt-3 text-sm leading-7 text-slate-600">{profile.description}</p>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function renderAchievementAwards(section: WebsiteSection | undefined) {
  const heading = section?.content.heading || "Awards & Recognitions";
  const subheading = section?.content.subheading || "Notable honors earned by our school community";
  const awards = getAchievementAwards(section);

  return (
    <section id="achievements_awards" className="bg-white px-4 py-20 md:px-6">
      <div className="mx-auto max-w-[1200px]">
        <h2 className="text-center text-3xl font-black tracking-tight text-slate-950 md:text-5xl">{heading}</h2>
        <p className="mx-auto mt-4 max-w-3xl text-center text-base leading-8 text-slate-600 md:text-lg">{subheading}</p>
        <div className="mt-12 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {awards.map((award) => (
            <article key={award.title} className="rounded-[24px] border border-slate-200 bg-slate-50 p-6">
              <div className="inline-flex rounded-full px-3 py-1 text-xs font-bold uppercase tracking-[0.2em]" style={{ backgroundColor: "rgba(var(--wb-secondary-rgb),0.14)", color: "var(--wb-secondary-deep)" }}>
                Recognition
              </div>
              <h3 className="mt-4 text-xl font-bold text-slate-950">{award.title}</h3>
              <p className="mt-3 text-sm leading-7 text-slate-600">{award.description}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function renderAchievementCta(section: WebsiteSection | undefined) {
  const fallback = FALLBACK_CONTENT.achievements.cta;
  const heading = section?.content.heading || fallback.heading;
  const description = section?.content.description || fallback.description;
  const buttonLabel = section?.content.button_label || fallback.buttonLabel;
  const buttonLink = section?.content.button_link || fallback.buttonLink;

  return (
    <section id="achievements_cta" className="bg-slate-950 px-4 py-20 text-white md:px-6">
      <div className="mx-auto max-w-[1000px] rounded-[32px] border border-white/15 bg-white/5 p-10 text-center backdrop-blur">
        <h2 className="text-3xl font-black tracking-tight md:text-5xl">{heading}</h2>
        <p className="mx-auto mt-4 max-w-2xl text-sm leading-7 text-white/80 md:text-base">{description}</p>
        <a
          href={buttonLink}
          className="mt-7 inline-flex rounded-full px-7 py-3 text-sm font-bold text-slate-950"
          style={{ backgroundColor: "var(--wb-secondary)" }}
        >
          {buttonLabel}
        </a>
      </div>
    </section>
  );
}

function renderAdmissions(section: WebsiteSection | undefined) {
  const title = section?.content.heading || "Admissions";
  const subtitle = section?.content.subheading || "Join our community of learners and leaders";
  const description =
    section?.content.description ||
    "We welcome students who demonstrate academic potential, leadership qualities, and a commitment to excellence.";
  const requirements = (section?.content.admissions_requirements || [])
    .map((item) => item.trim())
    .filter(Boolean);
  const legacyRequirements = (section?.content.items || []).map((item) => item.trim()).filter(Boolean);
  const admissionRequirements =
    requirements.length > 0
      ? requirements
      : legacyRequirements.length > 0
        ? legacyRequirements
        : FALLBACK_CONTENT.admissions.requirements;
  const admissionSteps = (section?.content.admissions_steps || [])
    .map((step) => step.trim())
    .filter(Boolean);
  const processSteps = admissionSteps.length > 0 ? admissionSteps : FALLBACK_CONTENT.admissions.steps;

  return (
    <section id="admissions" className="bg-white px-4 py-20 md:px-6">
      <div className="mx-auto max-w-[1200px]">
        <div className="text-center">
          <h2 className="text-3xl font-black tracking-tight text-slate-950 md:text-5xl">{title}</h2>
          <p className="mx-auto mt-4 max-w-3xl text-base leading-8 text-slate-600 md:text-lg">{subtitle}</p>
        </div>

        <div className="mt-12 grid gap-8 lg:grid-cols-[1fr_0.9fr]">
          <div className="rounded-[28px] border border-slate-200 bg-slate-50 p-8 shadow-sm">
            <h3 className="text-2xl font-bold text-slate-950">Admission Requirements</h3>
            <p className="mt-4 text-base leading-8 text-slate-600">
              {description}
            </p>
            <h4 className="mt-8 text-lg font-bold text-slate-950">Eligibility Criteria:</h4>
            <ul className="mt-4 space-y-3 text-sm leading-7 text-slate-600">
              {admissionRequirements.map((item) => (
                <li key={item} className="flex gap-3">
                  <span className="mt-1" style={{ color: "var(--wb-secondary-deep)" }}>✓</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-[28px] p-8 text-white shadow-xl" style={{ background: "linear-gradient(135deg, var(--wb-primary), var(--wb-secondary))" }}>
            <h3 className="text-2xl font-bold">Admission Process</h3>
            <div className="mt-8 space-y-5">
              {processSteps.map((step, index) => (
                <div key={step} className="flex gap-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-sm font-black text-slate-950">
                    {index + 1}
                  </div>
                  <p className="pt-1 text-sm leading-7 text-white/90">{step}</p>
                </div>
              ))}
            </div>
            <div className="mt-8 border-t border-white/15 pt-5 text-sm text-white/85">
              <p><strong>Admission Deadline:</strong> May 30, 2026</p>
              <p><strong>Classes Offered:</strong> Class 6 to Class 12</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function renderContact(section: WebsiteSection | undefined, siteSettings: SiteSettings) {
  const title = section?.content.heading || "Get In Touch";
  const subtitle = section?.content.subheading || "We'd love to hear from you. Contact us for admissions, inquiries, or feedback";
  const introMessage = section?.content.description || subtitle;
  const infoTitle = section?.content.contact_info_title || "Contact Information";
  const formTitle = section?.content.contact_form_title || "Send us a Message";
  const formButtonLabel = section?.content.contact_form_button_label || "Send Message";

  const address = (section?.content.contact_address_lines || []).map((item) => item.trim()).filter(Boolean);
  const phones = (section?.content.contact_phone_lines || []).map((item) => item.trim()).filter(Boolean);
  const emails = (section?.content.contact_email_lines || []).map((item) => item.trim()).filter(Boolean);
  const hours = (section?.content.contact_hours_lines || []).map((item) => item.trim()).filter(Boolean);

  const resolvedAddress =
    address.length > 0
      ? address
      : siteSettings.contact_address
        ? siteSettings.contact_address.split(/\r?\n/).filter(Boolean)
        : FALLBACK_CONTENT.contact.address;
  const resolvedPhones =
    phones.length > 0
      ? phones
      : siteSettings.contact_phone
        ? [siteSettings.contact_phone]
        : FALLBACK_CONTENT.contact.phone;
  const resolvedEmails =
    emails.length > 0
      ? emails
      : siteSettings.contact_email
        ? [siteSettings.contact_email]
        : FALLBACK_CONTENT.contact.email;
  const resolvedHours = hours.length > 0 ? hours : FALLBACK_CONTENT.contact.hours;

  return (
    <section id="contact" className="bg-slate-50 px-4 py-20 md:px-6">
      <div className="mx-auto max-w-[1200px]">
        <div className="text-center">
          <h2 className="text-3xl font-black tracking-tight text-slate-950 md:text-5xl">{title}</h2>
          <p className="mx-auto mt-4 max-w-3xl text-base leading-8 text-slate-600 md:text-lg">{introMessage}</p>
        </div>

        <div className="mt-12 grid gap-8 lg:grid-cols-[0.95fr_1.05fr]">
          <div className="rounded-[28px] bg-white p-8 shadow-sm ring-1 ring-slate-200">
            <h3 className="text-2xl font-bold text-slate-950">{infoTitle}</h3>

            <div className="mt-8 space-y-6 text-sm text-slate-600">
              <div>
                <h4 className="font-bold text-slate-950">Location</h4>
                <p className="mt-2 whitespace-pre-line leading-7">{resolvedAddress.join("\n")}</p>
              </div>
              <div>
                <h4 className="font-bold text-slate-950">Phone</h4>
                <p className="mt-2 whitespace-pre-line leading-7">{resolvedPhones.join("\n")}</p>
              </div>
              <div>
                <h4 className="font-bold text-slate-950">Email</h4>
                <p className="mt-2 whitespace-pre-line leading-7">{resolvedEmails.join("\n")}</p>
              </div>
              <div>
                <h4 className="font-bold text-slate-950">Office Hours</h4>
                <p className="mt-2 whitespace-pre-line leading-7">{resolvedHours.join("\n")}</p>
              </div>
            </div>
          </div>

          <form className="rounded-[28px] border border-slate-200 bg-white p-8 shadow-sm">
            <h3 className="text-2xl font-bold text-slate-950">{formTitle}</h3>
            <div className="mt-6 grid gap-4">
              {[
                ["Full Name *", "text"],
                ["Email Address *", "email"],
                ["Phone Number", "tel"],
                ["Subject *", "text"],
              ].map(([label, type]) => (
                <div key={label} className="grid gap-2">
                  <label className="text-sm font-medium text-slate-700">{label}</label>
                  <input type={type} className="h-11 rounded-xl border border-slate-200 px-4 outline-none transition focus:border-[var(--wb-secondary)]" />
                </div>
              ))}
              <div className="grid gap-2">
                <label className="text-sm font-medium text-slate-700">Message *</label>
                <textarea rows={6} className="rounded-2xl border border-slate-200 px-4 py-3 outline-none transition focus:border-[var(--wb-secondary)]" />
              </div>
              <button
                type="submit"
                className="mt-2 inline-flex items-center justify-center rounded-full px-6 py-3.5 text-sm font-bold text-white transition hover:opacity-90"
                style={{ backgroundColor: "var(--wb-secondary-deep)" }}
              >
                {formButtonLabel}
              </button>
            </div>
          </form>
        </div>
      </div>
    </section>
  );
}

function renderFooter(siteSettings: SiteSettings) {
  return (
    <footer className="bg-slate-950 px-4 pt-16 text-white md:px-6">
      <div className="mx-auto grid max-w-[1200px] gap-10 md:grid-cols-2 xl:grid-cols-4">
        <div>
          <h4 className="text-lg font-bold" style={{ color: "var(--wb-secondary)" }}>About School</h4>
          <ul className="mt-4 space-y-3 text-sm text-white/75">
            <li><a href="#about" className="hover:text-white">About Us</a></li>
            <li><a href="#programs" className="hover:text-white">Programs</a></li>
            <li><a href="#facilities" className="hover:text-white">Facilities</a></li>
            <li><a href="#faculty" className="hover:text-white">Faculty</a></li>
          </ul>
        </div>
        <div>
          <h4 className="text-lg font-bold" style={{ color: "var(--wb-secondary)" }}>Quick Links</h4>
          <ul className="mt-4 space-y-3 text-sm text-white/75">
            <li><a href="#admissions" className="hover:text-white">Admissions</a></li>
            <li><a href="#news" className="hover:text-white">News</a></li>
            <li><a href="#gallery" className="hover:text-white">Gallery</a></li>
            <li><a href="#contact" className="hover:text-white">Contact</a></li>
          </ul>
        </div>
        <div>
          <h4 className="text-lg font-bold" style={{ color: "var(--wb-secondary)" }}>Resources</h4>
          <ul className="mt-4 space-y-3 text-sm text-white/75">
            <li><a href="#" className="hover:text-white">Student Portal</a></li>
            <li><a href="#" className="hover:text-white">Parent Portal</a></li>
            <li><a href="#" className="hover:text-white">Faculty Login</a></li>
            <li><a href="#" className="hover:text-white">Downloads</a></li>
          </ul>
        </div>
        <div>
          <h4 className="text-lg font-bold" style={{ color: "var(--wb-secondary)" }}>Connect</h4>
          <div className="mt-4 flex gap-3">
            {["📘", "🐦", "📷", "🎬"].map((icon) => (
              <a
                key={icon}
                href="#"
                className="flex h-11 w-11 items-center justify-center rounded-full text-lg text-slate-950 transition hover:opacity-90"
                style={{ backgroundColor: "var(--wb-secondary)" }}
              >
                {icon}
              </a>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-12 border-t border-white/10 py-6 text-center text-sm text-white/70">
        <p>
          &copy; 2026 {siteSettings.site_title}. All rights reserved. | {" "}
          <a href="#" style={{ color: "var(--wb-secondary)" }}>Privacy Policy</a> | {" "}
          <a href="#" style={{ color: "var(--wb-secondary)" }}>Terms of Service</a>
        </p>
      </div>
    </footer>
  );
}

function getClassLevelItems(section: WebsiteSection | undefined) {
  const items = (section?.content.class_level_items || [])
    .map((item) => ({
      title: (item.title || "").trim(),
      description: (item.description || "").trim(),
      grade_range: (item.grade_range || "").trim(),
      icon: (item.icon || "📚").trim(),
      image_url: (item.image_url || "").trim(),
    }))
    .filter((item) => item.title);
  return items;
}

function getCurriculumItems(section: WebsiteSection | undefined) {
  const items = (section?.content.curriculum_items || [])
    .map((item) => ({
      subject: (item.subject || "").trim(),
      description: (item.description || "").trim(),
      grade_levels: (item.grade_levels || "").trim(),
      skills: Array.isArray(item.skills) ? item.skills : (item.skills || "").split(",").map((s: string) => s.trim()).filter(Boolean),
      image_url: (item.image_url || "").trim(),
      icon: (item.icon || "📖").trim(),
    }))
    .filter((item) => item.subject);
  return items;
}

function renderAcademicsHero(section: WebsiteSection | undefined, siteSettings: SiteSettings) {
  const heading = section?.content.heading || "Our Academic Excellence";
  const subheading = section?.content.subheading || "Rigorous curriculum designed to inspire critical thinking";
  const description = section?.content.description || "Comprehensive programs across all grade levels.";
  const buttonLabel = section?.content.button_label || "Explore Programs";
  const buttonLink = section?.content.button_link || "#academics_curriculum";
  const image = (section?.content.image_url || "").trim();

  return (
    <section id="academics_hero" className="relative overflow-hidden bg-slate-950 px-4 py-24 text-white md:px-6 md:py-32">
      <div className="absolute inset-0">
        {image ? (
          <img src={image} alt="Academics hero" className="h-full w-full object-cover opacity-50" />
        ) : (
          <div
            className="h-full w-full"
            style={{
              background:
                "radial-gradient(circle at top right, rgba(var(--wb-secondary-rgb),0.28), transparent 35%), linear-gradient(135deg, #0f172a 0%, #111827 50%, #1f2937 100%)",
            }}
          />
        )}
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(2,6,23,0.15),rgba(2,6,23,0.88))]" />
      </div>
      <div className="relative mx-auto max-w-[1100px]">
        <div className="mx-auto max-w-4xl rounded-[30px] border border-white/20 bg-slate-950/26 px-5 py-8 text-center shadow-2xl backdrop-blur-sm md:px-10 md:py-10">
          <h1 className="text-4xl font-black tracking-tight text-white md:text-6xl">{heading}</h1>
          <p className="mt-4 text-base leading-8 text-white/88 md:text-lg">{subheading}</p>
          <p className="mx-auto mt-3 max-w-2xl text-sm leading-7 text-white/76">{description}</p>
          <a
            href={buttonLink}
            className="mt-8 inline-flex rounded-full px-7 py-3 text-sm font-bold text-slate-950"
            style={{ backgroundColor: "var(--wb-secondary)" }}
          >
            {buttonLabel}
          </a>
        </div>
      </div>
    </section>
  );
}

function renderClassLevelCards(section: WebsiteSection | undefined) {
  const heading = section?.content.heading || "Class Levels";
  const subheading = section?.content.subheading || "Programs organized by grade";
  const items = getClassLevelItems(section);

  return (
    <section id="academics_class_levels" className="bg-white px-4 py-20 md:px-6">
      <div className="mx-auto max-w-[1200px]">
        <div className="text-center">
          <h2 className="text-3xl font-black tracking-tight text-slate-950 md:text-5xl">{heading}</h2>
          <p className="mx-auto mt-4 max-w-3xl text-base leading-8 text-slate-600 md:text-lg">{subheading}</p>
        </div>
        <div className="mt-12 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {items.map((item) => (
            <article key={item.title} className="overflow-hidden rounded-[26px] border border-slate-200 bg-slate-50 p-8 shadow-sm transition hover:-translate-y-1 hover:shadow-lg">
              <div className="mb-4 text-5xl">{item.icon}</div>
              <h3 className="text-xl font-bold text-slate-950">{item.title}</h3>
              <p className="mt-2 text-sm font-medium text-slate-500">{item.grade_range}</p>
              <p className="mt-3 text-sm leading-7 text-slate-600">{item.description}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function renderCurriculumSubjects(section: WebsiteSection | undefined) {
  const heading = section?.content.heading || "Curriculum Offerings";
  const subheading = section?.content.subheading || "Diverse subjects designed for holistic growth";
  const items = getCurriculumItems(section);

  return (
    <section id="academics_curriculum" className="bg-slate-50 px-4 py-20 md:px-6">
      <div className="mx-auto max-w-[1200px]">
        <div className="text-center">
          <h2 className="text-3xl font-black tracking-tight text-slate-950 md:text-5xl">{heading}</h2>
          <p className="mx-auto mt-4 max-w-3xl text-base leading-8 text-slate-600 md:text-lg">{subheading}</p>
        </div>
        <div className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => (
            <article key={item.subject} className="overflow-hidden rounded-[26px] border border-slate-200 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-lg">
              <div
                className="flex h-40 items-center justify-center text-6xl"
                style={{
                  background: "linear-gradient(135deg, var(--wb-primary), var(--wb-secondary))",
                }}
              >
                {item.icon}
              </div>
              <div className="p-6">
                <h3 className="text-lg font-bold text-slate-950">{item.subject}</h3>
                <p className="mt-2 text-xs font-medium text-slate-500">{item.grade_levels}</p>
                <p className="mt-3 text-sm leading-6 text-slate-600">{item.description}</p>
                {item.skills.length > 0 && (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {item.skills.slice(0, 2).map((skill) => (
                      <span key={skill} className="rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-700">
                        {skill}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function renderAcademicsGallery(section: WebsiteSection | undefined, siteSettings: SiteSettings) {
  const heading = section?.content.heading || "Academic Moments";
  const subheading = section?.content.subheading || "Classroom activities and learning experiences";
  const galleryItems = getGalleryItems(section);

  return (
    <section id="academics_gallery" className="bg-white px-4 py-20 md:px-6">
      <div className="mx-auto max-w-[1200px]">
        <div className="text-center">
          <h2 className="text-3xl font-black tracking-tight text-slate-950 md:text-5xl">{heading}</h2>
          <p className="mx-auto mt-4 max-w-3xl text-base leading-8 text-slate-600 md:text-lg">{subheading}</p>
        </div>
        <div className="mt-12 grid gap-4 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-3">
          {galleryItems.map((item, index) => {
            const palette = [
              "linear-gradient(135deg, var(--wb-primary), var(--wb-secondary))",
              "linear-gradient(135deg, rgba(var(--wb-secondary-rgb),0.95), rgba(var(--wb-primary-rgb),0.85))",
              "linear-gradient(135deg, var(--wb-secondary-deep), var(--wb-secondary))",
              "linear-gradient(135deg, var(--wb-primary-deep), var(--wb-primary))",
              "linear-gradient(135deg, rgba(var(--wb-primary-rgb),0.78), rgba(var(--wb-secondary-rgb),0.78))",
              "linear-gradient(135deg, var(--wb-secondary), var(--wb-primary-soft))",
              "linear-gradient(135deg, var(--wb-primary), var(--wb-secondary-soft))",
              "linear-gradient(135deg, rgba(var(--wb-secondary-rgb),0.88), rgba(var(--wb-primary-rgb),0.62))",
              "linear-gradient(135deg, var(--wb-primary-soft), var(--wb-secondary-soft))",
            ];
            return (
              <div
                key={`${item.image_url || item.fallbackIcon}-${index}`}
                className="group relative flex h-52 items-center justify-center overflow-hidden rounded-[24px] text-5xl text-white shadow-lg"
                style={{ background: palette[index % palette.length] }}
              >
                {item.image_url ? (
                  <img src={item.image_url} alt={item.caption || `Gallery ${index + 1}`} className="h-full w-full object-cover" />
                ) : (
                  <span className="relative z-10">{item.fallbackIcon}</span>
                )}
                <div className="absolute inset-0 bg-black/0 transition group-hover:bg-black/20" />
                {item.caption ? (
                  <div className="absolute bottom-0 left-0 right-0 bg-black/55 px-3 py-2 text-xs font-medium text-white">
                    {item.caption}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function renderWebsiteNotPublished(message: string) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="max-w-md rounded-[28px] border border-slate-200 bg-white p-8 text-center shadow-sm">
        <h1 className="text-3xl font-black text-slate-950">Website Not Published</h1>
        <p className="mt-3 text-slate-600">{message}</p>
      </div>
    </div>
  );
}

export default async function PublicSchoolWebsite({
  params,
  searchParams,
}: {
  params: { subdomain: string; slug?: string[] };
  searchParams: { preview?: string };
}) {
  const requestedSubdomain = params.subdomain;
  const slug = params.slug || [];
  const requestedPageSlug = resolveRequestedPageSlug(slug);
  const isPreviewRequested = resolvePreviewMode(searchParams || {});

  if (!requestedPageSlug) {
    notFound();
  }

  const supabase = getSupabaseAnonClient();
  const headerStore = headers();
  const host = headerStore.get("x-forwarded-host") || headerStore.get("host") || "";
  const hostSubdomain = getHostSubdomain(host);
  const subdomain = hostSubdomain || requestedSubdomain;

  const school = await resolveSchool(subdomain, supabase);
  if (!school || !school.is_active) {
    notFound();
  }

  const cookieStore = cookies();
  const hasAuthCookie = cookieStore
    .getAll()
    .some((item) => item.name.startsWith("sb-") || item.name.includes("supabase"));

  let previewAllowed = false;
  if (hasAuthCookie) {
    previewAllowed = await isAdminPreviewAllowed();
  }

  const isPreview = isPreviewRequested && previewAllowed;

  const [{ data: settings }, { data: publishedPage }, { data: draftPage }] = await Promise.all([
    supabase
      .from("website_site_settings")
      .select("*")
      .eq("school_id", school.id)
      .maybeSingle(),
    supabase
      .from("website_pages")
      .select("*")
      .eq("school_id", school.id)
      .eq("slug", requestedPageSlug)
      .eq("status", "published")
      .maybeSingle(),
    isPreview
      ? supabase
          .from("website_pages")
          .select("*")
          .eq("school_id", school.id)
          .eq("slug", requestedPageSlug)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const page: PublishPage | null = (isPreview ? (draftPage || publishedPage) : publishedPage) || null;

  if (!page && !isPreview) {
    return renderWebsiteNotPublished("This school website page is not live yet.");
  }

  const sectionsResult = page
    ? await supabase
        .from("website_sections")
        .select("*")
        .eq("school_id", school.id)
        .eq("page_id", page.id)
        .order("order_sequence", { ascending: true })
    : { data: [] as WebsiteSection[] };

  const sections = (sectionsResult.data || []) as WebsiteSection[];

  const siteSettings: SiteSettings = {
    site_title: settings?.site_title || school.name || WEBSITE_DEFAULT_SITE_SETTINGS.site_title,
    site_tagline: settings?.site_tagline || WEBSITE_DEFAULT_SITE_SETTINGS.site_tagline,
    logo_url: settings?.logo_url || WEBSITE_DEFAULT_SITE_SETTINGS.logo_url,
    hero_background_url: settings?.hero_background_url || WEBSITE_DEFAULT_SITE_SETTINGS.hero_background_url,
    primary_color: settings?.primary_color || WEBSITE_DEFAULT_SITE_SETTINGS.primary_color,
    secondary_color: settings?.secondary_color || WEBSITE_DEFAULT_SITE_SETTINGS.secondary_color,
    contact_email: settings?.contact_email || WEBSITE_DEFAULT_SITE_SETTINGS.contact_email,
    contact_phone: settings?.contact_phone || WEBSITE_DEFAULT_SITE_SETTINGS.contact_phone,
    contact_address: settings?.contact_address || WEBSITE_DEFAULT_SITE_SETTINGS.contact_address,
    is_website_enabled: settings?.is_website_enabled ?? WEBSITE_DEFAULT_SITE_SETTINGS.is_website_enabled,
  };

  const themeStyleVariables = buildThemeStyleVariables(siteSettings);

  const sectionsNeedingCustomization = requestedPageSlug === "home"
    ? sections.filter((section) => !isWebsiteSectionCustomized(section.section_key, section.content, "home"))
    : [];
  const globalSettingsQualification = getWebsiteGlobalSettingsQualification(siteSettings);
  const isPublishReady = requestedPageSlug === "home"
    ? sectionsNeedingCustomization.length === 0 && globalSettingsQualification.ready
    : true;

  if (!isPreview && !isPublishReady) {
    return renderWebsiteNotPublished("This school website page is still being customized by the school admin.");
  }

  const visibleSections = sections.filter((section) => section.is_visible).sort((a, b) => a.order_sequence - b.order_sequence);
  const routeBasePath = hostSubdomain ? "" : `/site/${requestedSubdomain}`;

  const hallOfFameContextLinks = visibleSections
    .map((section) => ({
      label: section.section_label || section.content.heading || section.section_key,
      href: `#${section.section_key}`,
    }))
    .filter((section) => section.label.trim());

  if (requestedPageSlug === "hall-of-fame") {
    const achievementsHeroSection = visibleSections.find((section) => section.section_key === "achievements_hero");
    const achievementsTimelineSection = visibleSections.find((section) => section.section_key === "achievements_timeline");
    const hallOfFameSection = visibleSections.find((section) => section.section_key === "hall_of_fame");
    const awardsSection = visibleSections.find((section) => section.section_key === "achievements_awards");
    const achievementsCtaSection = visibleSections.find((section) => section.section_key === "achievements_cta");

    return (
      <div className="min-h-screen bg-slate-50 text-slate-900" style={themeStyleVariables}>
        <SchoolDomainHeader
          siteSettings={siteSettings}
          basePath={routeBasePath}
          currentPage="hall-of-fame"
          preview={isPreview}
          contextLinks={hallOfFameContextLinks}
        />
        <main>
          {renderHallOfFameHero(achievementsHeroSection, siteSettings)}
          {renderAchievementTimeline(achievementsTimelineSection)}
          {renderHallOfFameCards(hallOfFameSection)}
          {renderAchievementAwards(awardsSection)}
          {renderAchievementCta(achievementsCtaSection)}
          {renderContact(undefined, siteSettings)}
        </main>
        {renderFooter(siteSettings)}
      </div>
    );
  }

  if (requestedPageSlug === "academics") {
      const academicsHeroSection = visibleSections.find((section) => section.section_key === "academics_hero");

      const [educationLevelsResult, subjectsResult, mediaResult] = await Promise.all([
        supabase
          .from("school_education_levels")
          .select("id, name, code, description, order_sequence, school_class_levels(id, name, code, order_sequence)")
          .eq("school_id", school.id)
          .eq("is_active", true)
          .order("order_sequence", { ascending: true }),
        supabase
          .from("subjects")
          .select("id, name, subject_code, education_level_id")
          .eq("school_id", school.id)
          .eq("is_active", true)
          .order("name", { ascending: true }),
        supabase
          .from("website_media")
          .select("id, file_name, public_url, mime_type, created_at")
          .eq("school_id", school.id)
          .order("created_at", { ascending: false })
          .limit(50),
      ]);

      if (educationLevelsResult.error) throw educationLevelsResult.error;
      if (subjectsResult.error) throw subjectsResult.error;
      if (mediaResult.error) throw mediaResult.error;

      const educationLevels = ((educationLevelsResult.data || []) as AcademicsEducationLevel[]).map((level) => ({
        ...level,
        school_class_levels: Array.isArray(level.school_class_levels)
          ? [...level.school_class_levels].sort((a, b) => (a.order_sequence || 0) - (b.order_sequence || 0))
          : [],
      }));
      const subjects = (subjectsResult.data || []) as AcademicsSubject[];
      const media = (mediaResult.data || []) as AcademicsMediaItem[];
      const academicsCards = buildAcademicsShowcaseCards(educationLevels, subjects, media, siteSettings);
      const academicsContextLinks = academicsCards.map((card) => ({
        label: card.title,
        href: `#academics-level-${card.id}`,
      }));

    return (
      <div className="min-h-screen bg-slate-50 text-slate-900" style={themeStyleVariables}>
        <SchoolDomainHeader
          siteSettings={siteSettings}
          basePath={routeBasePath}
          currentPage="academics"
          preview={isPreview}
            contextLinks={academicsContextLinks}
        />
        <main>
            {renderAcademicsShowcase(academicsHeroSection, academicsCards, siteSettings)}
          {renderContact(undefined, siteSettings)}
        </main>
        {renderFooter(siteSettings)}
      </div>
    );
  }

  const homeSection = visibleSections.find((section) => section.section_key === "home");
  const aboutSection = visibleSections.find((section) => section.section_key === "about");
  const programsSection = visibleSections.find((section) => section.section_key === "programs");
  const facilitiesSection = visibleSections.find((section) => section.section_key === "facilities");
  const facultySection = visibleSections.find((section) => section.section_key === "faculty");
  const newsSection = visibleSections.find((section) => section.section_key === "news");
  const testimonialsSection = visibleSections.find((section) => section.section_key === "testimonials");
  const gallerySection = visibleSections.find((section) => section.section_key === "gallery");
  const admissionsSection = visibleSections.find((section) => section.section_key === "admissions");
  const contactSection = visibleSections.find((section) => section.section_key === "contact");
  const programCards = getProgramCardItems(programsSection);
  const facilityCards = getFacilityCardItems(facilitiesSection);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900" style={themeStyleVariables}>
      <SchoolDomainHeader
        siteSettings={siteSettings}
        basePath={routeBasePath}
        currentPage="home"
        preview={isPreview}
      />
      <main>
        {renderHero(siteSettings, visibleSections)}
        {renderAbout(aboutSection || homeSection)}
        {renderCardGrid(programsSection, programCards, "programs", "bg-white")}
        {renderCardGrid(facilitiesSection, facilityCards, "facilities", "bg-slate-50")}
        {renderFaculty(facultySection)}
        {renderNews(newsSection)}
        {renderTestimonials(testimonialsSection, siteSettings)}
        {renderGallery(gallerySection, siteSettings)}
        {renderAdmissions(admissionsSection)}
        {renderContact(contactSection, siteSettings)}
      </main>
      {renderFooter(siteSettings)}
    </div>
  );
}
