import { createClient } from "@supabase/supabase-js";
import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";
import { cookies, headers } from "next/headers";
import { notFound } from "next/navigation";
import { WEBSITE_SECTION_TEMPLATES } from "@/lib/website-builder";

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
    { icon: "🔬", title: "Science Stream", description: "Physics, Chemistry, Biology, and Mathematics with strong lab-based learning." },
    { icon: "📖", title: "Arts Stream", description: "History, Literature, Geography, and Social Sciences with deep analysis." },
    { icon: "💼", title: "Commerce Stream", description: "Accounting, Economics, and Business Studies for professional readiness." },
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
  contact: {
    address: ["Presidency School, Education Avenue", "City Center, State 123456", "India"],
    phone: ["Main Office: +91 (123) 456-7890", "Admissions: +91 (123) 456-7891", "Support: +91 (123) 456-7892"],
    email: ["info@tosfebpresidency.edu", "admissions@tosfebpresidency.edu", "support@tosfebpresidency.edu"],
    hours: ["Monday - Friday: 8:00 AM - 4:00 PM", "Saturday: 9:00 AM - 1:00 PM", "Sunday: Closed"],
  },
};

const TEMPLATE_TESTIMONIAL_ITEMS =
  WEBSITE_SECTION_TEMPLATES.find((section) => section.key === "testimonials")?.content.testimonial_items || [];

const TEMPLATE_GALLERY_ITEMS =
  WEBSITE_SECTION_TEMPLATES.find((section) => section.key === "gallery")?.content.gallery_items || [];

function getSupabaseAnonClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new Error("Supabase public env vars are required for website rendering");
  }

  return createClient(url, key);
}

function makeSlugLabel(section: WebsiteSection) {
  return section.section_label || section.content.heading || section.section_key;
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
  const { data: isAdmin } = await supabase.rpc("is_admin");
  return Boolean(isAdmin);
}

function renderHeader(siteSettings: SiteSettings, sections: WebsiteSection[], preview: boolean) {
  return (
    <header className="sticky top-0 z-40 bg-slate-950/95 text-white backdrop-blur border-b border-white/10">
      <div className="mx-auto flex max-w-[1200px] items-center justify-between px-4 py-4 md:px-6">
        <a href="#home" className="flex items-center gap-3">
          {siteSettings.logo_url ? (
            <img src={siteSettings.logo_url} alt={siteSettings.site_title} className="h-10 w-10 rounded-full object-cover ring-2 ring-white/20" />
          ) : (
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-400 text-sm font-black text-slate-950 shadow-lg">
              {siteSettings.site_title.slice(0, 2).toUpperCase()}
            </div>
          )}
          <div>
            <p className="font-semibold tracking-wide text-white">{siteSettings.site_title}</p>
            <p className="text-xs text-white/70">{siteSettings.site_tagline}</p>
          </div>
        </a>

        <nav className="hidden gap-5 text-sm md:flex">
          {sections
            .filter((section) => section.is_visible)
            .map((section) => (
              <a key={section.id} href={`#${section.section_key}`} className="text-white/80 transition hover:text-amber-300">
                {makeSlugLabel(section)}
              </a>
            ))}
        </nav>
      </div>

      {preview ? (
        <div className="border-t border-amber-400/30 bg-amber-400/10 px-4 py-2 text-center text-xs font-medium text-amber-200">
          Preview mode. Draft content is visible to authenticated admins only.
        </div>
      ) : null}
    </header>
  );
}

function renderHero(siteSettings: SiteSettings, sections: WebsiteSection[]) {
  const section = sections.find((item) => item.section_key === "home");
  const heading = section?.content.heading || "Welcome to Tosfeb Presidency School";
  const subheading = section?.content.subheading || "Excellence in Education • Nurturing Future Leaders • Building Tomorrow's Dreams";
  const buttonLabel = section?.content.button_label || "Apply Now";
  const buttonLink = section?.content.button_link || "#admissions";
  const heroImage = section?.content.image_url || siteSettings.hero_background_url;
  const heroCardBadge = section?.content.hero_card_badge || "Student Focus";
  const heroCardTitle = section?.content.hero_card_title || "Modern learning. Strong values. Real outcomes.";
  const heroCardDescription =
    section?.content.hero_card_description ||
    "A school website built to communicate trust, clarity, and excellence from the first glance.";
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
          <div className="h-full w-full bg-[radial-gradient(circle_at_top_right,_rgba(245,158,11,0.25),_transparent_35%),linear-gradient(135deg,_#0f172a_0%,_#111827_50%,_#1f2937_100%)]" />
        )}
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(2,6,23,0.15),rgba(2,6,23,0.88))]" />
      </div>

      <div className="relative mx-auto grid max-w-[1200px] gap-10 px-4 py-24 md:grid-cols-[1.2fr_0.8fr] md:px-6 md:py-32">
        <div className="max-w-3xl">
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-xs uppercase tracking-[0.22em] text-amber-200 backdrop-blur">
            <span className="h-2 w-2 rounded-full bg-amber-400" />
            Your School Website
          </div>
          <h1 className="text-4xl font-black leading-[1.05] tracking-tight md:text-6xl">{heading}</h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-white/82 md:text-xl">{subheading}</p>
          <div className="mt-10 flex flex-wrap gap-4">
            <a href={buttonLink} className="inline-flex items-center rounded-full bg-amber-400 px-7 py-3.5 text-sm font-bold text-slate-950 shadow-[0_18px_50px_rgba(245,158,11,0.35)] transition hover:translate-y-[-1px] hover:bg-amber-300">
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
              <p className="text-xs uppercase tracking-[0.22em] text-amber-200/80">{heroCardBadge}</p>
              <p className="mt-3 text-2xl font-semibold text-white">{heroCardTitle}</p>
              <p className="mt-3 text-sm leading-6 text-white/70">{heroCardDescription}</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {heroStats.map(([value, label]) => (
                <div key={label} className="rounded-2xl border border-white/10 bg-slate-950/50 p-4 text-center">
                  <div className="text-2xl font-black text-amber-300">{value}</div>
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
          <p className="mb-3 text-sm font-bold uppercase tracking-[0.26em] text-amber-600">About</p>
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
          <div className="absolute -inset-4 rounded-[34px] bg-gradient-to-br from-amber-200 to-emerald-200 blur-2xl opacity-70" />
          <div className="relative flex h-[420px] items-center justify-center rounded-[34px] bg-[linear-gradient(135deg,#1e3a8a_0%,#0f766e_100%)] text-[5rem] shadow-2xl">
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
                    <div className={`flex h-full w-full items-center justify-center text-7xl text-white/90 ${
                      sectionId === "programs" 
                        ? "bg-[linear-gradient(135deg,#1e3a8a,#0f766e)]" 
                        : "bg-[linear-gradient(135deg,#047857,#059669)]"
                    }`}>
                      {item.icon}
                    </div>
                  )}
                  <div className={`absolute right-0 top-4 px-5 py-2 text-sm font-bold text-white shadow-md ${
                    sectionId === "programs" ? "bg-rose-700" : "bg-emerald-700"
                  }`}>
                    {item.title}
                  </div>
                </div>

                <div className="px-6 py-7">
                  <h3 className="text-[2rem] font-black leading-tight text-slate-900">{item.title}</h3>
                  <p className="mt-4 text-[1.65rem] leading-snug text-slate-600">{item.description}</p>
                </div>

                <div className="flex items-center justify-between border-t border-slate-200 px-6 py-4">
                  <div className="text-xl tracking-[0.15em] text-amber-400">★★★★</div>
                  <div className={`inline-flex items-center gap-2 text-[1.35rem] font-semibold text-slate-900 ${
                    sectionId === "programs" ? "text-rose-700" : "text-emerald-700"
                  }`}>
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
              <div className="flex h-64 items-center justify-center bg-[linear-gradient(135deg,#1e3a8a,#059669)] text-6xl text-white/35">
                {member.image_url ? (
                  <img src={member.image_url} alt={member.name} className="h-full w-full object-cover" />
                ) : (
                  member.avatar
                )}
              </div>
              <div className="p-6 text-center">
                <h3 className="text-lg font-bold text-slate-950">{member.name}</h3>
                <p className="mt-1 text-sm font-medium text-emerald-600">{member.role}</p>
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
              <div className="flex h-48 items-center justify-center bg-[linear-gradient(135deg,#f59e0b,#f97316)] text-5xl text-white">{item.icon}</div>
              <div className="p-6">
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-emerald-600">{item.date}</p>
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

function renderTestimonials(section: WebsiteSection | undefined) {
  const title = section?.content.heading || "Student & Parent Testimonials";
  const subtitle = section?.content.subheading || "Hear from our students and parents about their experience at Tosfeb Presidency School";
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
              <div className="text-amber-400">{item.stars}</div>
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

function renderGallery(section: WebsiteSection | undefined) {
  const title = section?.content.heading || "Campus Gallery";
  const subtitle = section?.content.subheading || "Explore moments and memories from Tosfeb Presidency School";
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
              "bg-[linear-gradient(135deg,#1e3a8a,#059669)]",
              "bg-[linear-gradient(135deg,#f59e0b,#f97316)]",
              "bg-[linear-gradient(135deg,#0f766e,#14b8a6)]",
              "bg-[linear-gradient(135deg,#10b981,#059669)]",
              "bg-[linear-gradient(135deg,#0ea5e9,#2563eb)]",
              "bg-[linear-gradient(135deg,#8b5cf6,#7c3aed)]",
              "bg-[linear-gradient(135deg,#0f172a,#334155)]",
              "bg-[linear-gradient(135deg,#ec4899,#db2777)]",
              "bg-[linear-gradient(135deg,#65a30d,#16a34a)]",
            ];
            return (
              <div key={`${item.image_url || item.fallbackIcon}-${index}`} className={`group relative flex h-52 items-center justify-center overflow-hidden rounded-[24px] text-5xl text-white shadow-lg ${palette[index % palette.length]}`}>
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

function renderAdmissions(section: WebsiteSection | undefined) {
  const title = section?.content.heading || "Admissions";
  const subtitle = section?.content.subheading || "Join our community of learners and leaders";

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
              We welcome students who demonstrate academic potential, leadership qualities, and a commitment to excellence.
            </p>
            <h4 className="mt-8 text-lg font-bold text-slate-950">Eligibility Criteria:</h4>
            <ul className="mt-4 space-y-3 text-sm leading-7 text-slate-600">
              {FALLBACK_CONTENT.admissions.requirements.map((item) => (
                <li key={item} className="flex gap-3">
                  <span className="mt-1 text-emerald-600">✓</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-[28px] bg-[linear-gradient(135deg,#1e3a8a,#059669)] p-8 text-white shadow-xl">
            <h3 className="text-2xl font-bold">Admission Process</h3>
            <div className="mt-8 space-y-5">
              {FALLBACK_CONTENT.admissions.steps.map((step, index) => (
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

  const address = siteSettings.contact_address
    ? siteSettings.contact_address.split(/\r?\n/).filter(Boolean)
    : FALLBACK_CONTENT.contact.address;
  const phones = siteSettings.contact_phone ? [siteSettings.contact_phone] : FALLBACK_CONTENT.contact.phone;
  const emails = siteSettings.contact_email ? [siteSettings.contact_email] : FALLBACK_CONTENT.contact.email;

  return (
    <section id="contact" className="bg-slate-50 px-4 py-20 md:px-6">
      <div className="mx-auto max-w-[1200px]">
        <div className="text-center">
          <h2 className="text-3xl font-black tracking-tight text-slate-950 md:text-5xl">{title}</h2>
          <p className="mx-auto mt-4 max-w-3xl text-base leading-8 text-slate-600 md:text-lg">{subtitle}</p>
        </div>

        <div className="mt-12 grid gap-8 lg:grid-cols-[0.95fr_1.05fr]">
          <div className="rounded-[28px] bg-white p-8 shadow-sm ring-1 ring-slate-200">
            <h3 className="text-2xl font-bold text-slate-950">Contact Information</h3>

            <div className="mt-8 space-y-6 text-sm text-slate-600">
              <div>
                <h4 className="font-bold text-slate-950">Location</h4>
                <p className="mt-2 whitespace-pre-line leading-7">{address.join("\n")}</p>
              </div>
              <div>
                <h4 className="font-bold text-slate-950">Phone</h4>
                <p className="mt-2 whitespace-pre-line leading-7">{phones.join("\n")}</p>
              </div>
              <div>
                <h4 className="font-bold text-slate-950">Email</h4>
                <p className="mt-2 whitespace-pre-line leading-7">{emails.join("\n")}</p>
              </div>
              <div>
                <h4 className="font-bold text-slate-950">Office Hours</h4>
                <p className="mt-2 whitespace-pre-line leading-7">{FALLBACK_CONTENT.contact.hours.join("\n")}</p>
              </div>
            </div>
          </div>

          <form className="rounded-[28px] border border-slate-200 bg-white p-8 shadow-sm">
            <h3 className="text-2xl font-bold text-slate-950">Send us a Message</h3>
            <div className="mt-6 grid gap-4">
              {[
                ["Full Name *", "text"],
                ["Email Address *", "email"],
                ["Phone Number", "tel"],
                ["Subject *", "text"],
              ].map(([label, type]) => (
                <div key={label} className="grid gap-2">
                  <label className="text-sm font-medium text-slate-700">{label}</label>
                  <input type={type} className="h-11 rounded-xl border border-slate-200 px-4 outline-none transition focus:border-emerald-500" />
                </div>
              ))}
              <div className="grid gap-2">
                <label className="text-sm font-medium text-slate-700">Message *</label>
                <textarea rows={6} className="rounded-2xl border border-slate-200 px-4 py-3 outline-none transition focus:border-emerald-500" />
              </div>
              <button type="submit" className="mt-2 inline-flex items-center justify-center rounded-full bg-slate-950 px-6 py-3.5 text-sm font-bold text-white transition hover:bg-emerald-600">
                Send Message
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
          <h4 className="text-lg font-bold text-amber-300">About School</h4>
          <ul className="mt-4 space-y-3 text-sm text-white/75">
            <li><a href="#about" className="hover:text-white">About Us</a></li>
            <li><a href="#programs" className="hover:text-white">Programs</a></li>
            <li><a href="#facilities" className="hover:text-white">Facilities</a></li>
            <li><a href="#faculty" className="hover:text-white">Faculty</a></li>
          </ul>
        </div>
        <div>
          <h4 className="text-lg font-bold text-amber-300">Quick Links</h4>
          <ul className="mt-4 space-y-3 text-sm text-white/75">
            <li><a href="#admissions" className="hover:text-white">Admissions</a></li>
            <li><a href="#news" className="hover:text-white">News</a></li>
            <li><a href="#gallery" className="hover:text-white">Gallery</a></li>
            <li><a href="#contact" className="hover:text-white">Contact</a></li>
          </ul>
        </div>
        <div>
          <h4 className="text-lg font-bold text-amber-300">Resources</h4>
          <ul className="mt-4 space-y-3 text-sm text-white/75">
            <li><a href="#" className="hover:text-white">Student Portal</a></li>
            <li><a href="#" className="hover:text-white">Parent Portal</a></li>
            <li><a href="#" className="hover:text-white">Faculty Login</a></li>
            <li><a href="#" className="hover:text-white">Downloads</a></li>
          </ul>
        </div>
        <div>
          <h4 className="text-lg font-bold text-amber-300">Connect</h4>
          <div className="mt-4 flex gap-3">
            {["📘", "🐦", "📷", "🎬"].map((icon) => (
              <a key={icon} href="#" className="flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-lg transition hover:bg-amber-400 hover:text-slate-950">
                {icon}
              </a>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-12 border-t border-white/10 py-6 text-center text-sm text-white/70">
        <p>
          &copy; 2026 {siteSettings.site_title}. All rights reserved. | {" "}
          <a href="#" className="text-amber-300">Privacy Policy</a> | {" "}
          <a href="#" className="text-amber-300">Terms of Service</a>
        </p>
      </div>
    </footer>
  );
}

function MobileMenu() {
  return (
    <button className="md:hidden rounded-full border border-white/20 bg-white/5 px-3 py-2 text-sm text-white/80">
      Menu
    </button>
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
  const isPreviewRequested = resolvePreviewMode(searchParams || {});

  if (slug.length > 0 && slug[0] !== "home") {
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

  let previewAllowed = false;
  if (isPreviewRequested) {
    const cookieStore = cookies();
    const hasAuthCookie = cookieStore
      .getAll()
      .some((item) => item.name.startsWith("sb-") || item.name.includes("supabase"));

    if (hasAuthCookie) {
      previewAllowed = await isAdminPreviewAllowed();
    }
  }

  const isPreview = isPreviewRequested && previewAllowed;

  const [{ data: settings }, { data: publishedPage }, { data: draftPage }, { data: publishedSections }, { data: draftSections }] = await Promise.all([
    supabase
      .from("website_site_settings")
      .select("*")
      .eq("school_id", school.id)
      .maybeSingle(),
    supabase
      .from("website_pages")
      .select("*")
      .eq("school_id", school.id)
      .eq("slug", "home")
      .eq("status", "published")
      .maybeSingle(),
    isPreview
      ? supabase
          .from("website_pages")
          .select("*")
          .eq("school_id", school.id)
          .eq("slug", "home")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    supabase
      .from("website_sections")
      .select("*")
      .eq("school_id", school.id)
      .order("order_sequence", { ascending: true }),
    isPreview
      ? supabase
          .from("website_sections")
          .select("*")
          .eq("school_id", school.id)
          .order("order_sequence", { ascending: true })
      : Promise.resolve({ data: [] }),
  ]);

  const page: PublishPage | null = (isPreview ? (draftPage || publishedPage) : publishedPage) || null;
  const sections = ((isPreview ? (draftSections || publishedSections) : publishedSections) || []) as WebsiteSection[];

  if (!page) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
        <div className="max-w-md rounded-[28px] border border-slate-200 bg-white p-8 text-center shadow-sm">
          <h1 className="text-3xl font-black text-slate-950">Website Not Published</h1>
          <p className="mt-3 text-slate-600">This school website is not live yet.</p>
        </div>
      </div>
    );
  }

  const siteSettings: SiteSettings = {
    site_title: settings?.site_title || school.name,
    site_tagline: settings?.site_tagline || "Excellence in education",
    logo_url: settings?.logo_url || "",
    hero_background_url: settings?.hero_background_url || "",
    primary_color: settings?.primary_color || "#1e3a8a",
    secondary_color: settings?.secondary_color || "#059669",
    contact_email: settings?.contact_email || "",
    contact_phone: settings?.contact_phone || "",
    contact_address: settings?.contact_address || "",
    is_website_enabled: settings?.is_website_enabled ?? true,
  };

  const visibleSections = sections.filter((section) => section.is_visible).sort((a, b) => a.order_sequence - b.order_sequence);
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
    <div className="min-h-screen bg-slate-50 text-slate-900">
      {renderHeader(siteSettings, visibleSections, isPreview)}
      <main>
        {renderHero(siteSettings, visibleSections)}
        {renderAbout(aboutSection || homeSection)}
        {renderCardGrid(programsSection, programCards, "programs", "bg-white")}
        {renderCardGrid(facilitiesSection, facilityCards, "facilities", "bg-slate-50")}
        {renderFaculty(facultySection)}
        {renderNews(newsSection)}
        {renderTestimonials(testimonialsSection)}
        {renderGallery(gallerySection)}
        {renderAdmissions(admissionsSection)}
        {renderContact(contactSection, siteSettings)}
      </main>
      {renderFooter(siteSettings)}
      <script dangerouslySetInnerHTML={{ __html: `
        (function() {
          var menu = document.querySelector('[data-website-menu]');
        })();
      `}} />
    </div>
  );
}
