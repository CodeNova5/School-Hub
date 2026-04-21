import Link from "next/link";
import { notFound } from "next/navigation";
import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import type { CSSProperties } from "react";

type PageSection = {
  id?: string;
  type?:
    | "text"
    | "feature-grid"
    | "stats"
    | "gallery"
    | "faq"
    | "cta-banner"
    | "timeline";
  title?: string;
  body?: string;
  ctaLabel?: string;
  ctaHref?: string;
  imageUrl?: string;
  items?: string[];
  isVisible?: boolean;
};

type WebsitePage = {
  id: string;
  title: string;
  slug: string;
  sections: PageSection[];
  status: "draft" | "published" | "archived";
  is_homepage: boolean;
};

type WebsiteSettings = {
  template_key: "classic" | "sunrise" | "minimal";
  brand_name: string;
  primary_color: string;
  secondary_color: string;
  accent_color: string;
  heading_font: string;
  body_font: string;
  hero_title: string;
  hero_subtitle: string;
  cta_label: string;
  cta_href: string;
  show_news: boolean;
  show_events: boolean;
};

type WebsiteNews = {
  id: string;
  title: string;
  excerpt: string;
  slug: string | null;
  published_at: string | null;
};

type WebsiteEvent = {
  id: string;
  title: string;
  excerpt: string | null;
  location: string | null;
  start_date: string;
  slug: string | null;
};

function normalizeSections(raw: unknown): PageSection[] {
  if (!Array.isArray(raw)) {
    return [];
  }

  return raw
    .filter((section) => section && typeof section === "object")
    .map((section) => section as PageSection)
    .filter((section) => section.isVisible !== false);
}

function fallbackLandingSections(schoolName: string): PageSection[] {
  return [
    {
      type: "feature-grid",
      title: "Why Families Choose Us",
      body: "A balanced approach to academics, character, and creativity.",
      items: [
        "Highly Qualified Teachers",
        "Safe Campus and Student Welfare",
        "Strong Academic Performance",
        "Active Sports and Clubs",
      ],
      isVisible: true,
    },
    {
      type: "stats",
      title: "Our Impact in Numbers",
      body: "Quick facts about our school community.",
      items: ["1200|Students", "60|Teachers", "95|Graduation Rate", "25|Years of Excellence"],
      isVisible: true,
    },
    {
      type: "timeline",
      title: "Admissions Journey",
      body: "How your application moves from submission to enrollment.",
      items: [
        "Submit Application|Online application form",
        "Screening Review|Admissions team evaluates",
        "Assessment/Interview|Scheduled if needed",
        "Final Decision|Sent by email",
      ],
      isVisible: true,
    },
    {
      type: "faq",
      title: "Frequently Asked Questions",
      body: `Everything you need to know about joining ${schoolName}.`,
      items: [
        "How do I apply?|Use the admissions page and complete the application form.",
        "Do you offer extracurricular activities?|Yes, sports, clubs, arts, and leadership programs.",
      ],
      isVisible: true,
    },
    {
      type: "cta-banner",
      title: "Ready to Join Us?",
      body: "Take the first step toward an outstanding learning experience.",
      ctaLabel: "Apply Now",
      ctaHref: "/admission",
      isVisible: true,
    },
  ];
}

function parsePair(item: string) {
  const [left, ...rest] = item.split("|");
  return {
    left: (left || "").trim(),
    right: rest.join("|").trim(),
  };
}

function renderSection(section: PageSection, primaryColor: string, accentColor: string) {
  const items = Array.isArray(section.items) ? section.items : [];

  if (section.type === "feature-grid") {
    return (
      <article className="rounded-2xl border border-slate-200 bg-white p-6">
        <h2 className="text-2xl font-bold text-slate-900">{section.title || "Highlights"}</h2>
        <p className="mt-2 text-slate-600">{section.body || ""}</p>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {items.map((item, idx) => (
            <div key={`${item}-${idx}`} className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700">
              {item}
            </div>
          ))}
        </div>
      </article>
    );
  }

  if (section.type === "stats") {
    return (
      <article className="rounded-2xl border border-slate-200 bg-white p-6">
        <h2 className="text-2xl font-bold text-slate-900">{section.title || "Statistics"}</h2>
        <p className="mt-2 text-slate-600">{section.body || ""}</p>
        <div className="mt-5 grid gap-3 sm:grid-cols-2 md:grid-cols-4">
          {items.map((item, idx) => {
            const pair = parsePair(item);
            return (
              <div key={`${item}-${idx}`} className="rounded-xl border border-slate-100 bg-slate-50 p-4 text-center">
                <div className="text-2xl font-black" style={{ color: primaryColor }}>
                  {pair.left || item}
                </div>
                <div className="mt-1 text-xs font-semibold uppercase tracking-wide text-slate-500">{pair.right || "Metric"}</div>
              </div>
            );
          })}
        </div>
      </article>
    );
  }

  if (section.type === "faq") {
    return (
      <article className="rounded-2xl border border-slate-200 bg-white p-6">
        <h2 className="text-2xl font-bold text-slate-900">{section.title || "FAQ"}</h2>
        <p className="mt-2 text-slate-600">{section.body || ""}</p>
        <div className="mt-4 space-y-3">
          {items.map((item, idx) => {
            const pair = parsePair(item);
            return (
              <div key={`${item}-${idx}`} className="rounded-lg border border-slate-100 bg-slate-50 p-4">
                <p className="font-semibold text-slate-900">{pair.left || "Question"}</p>
                <p className="mt-1 text-sm text-slate-600">{pair.right || "Answer"}</p>
              </div>
            );
          })}
        </div>
      </article>
    );
  }

  if (section.type === "timeline") {
    return (
      <article className="rounded-2xl border border-slate-200 bg-white p-6">
        <h2 className="text-2xl font-bold text-slate-900">{section.title || "Timeline"}</h2>
        <p className="mt-2 text-slate-600">{section.body || ""}</p>
        <ol className="mt-4 space-y-3">
          {items.map((item, idx) => {
            const pair = parsePair(item);
            return (
              <li key={`${item}-${idx}`} className="rounded-lg border border-slate-100 bg-slate-50 p-4">
                <p className="font-semibold text-slate-900">{pair.left || `Step ${idx + 1}`}</p>
                <p className="mt-1 text-sm text-slate-600">{pair.right || ""}</p>
              </li>
            );
          })}
        </ol>
      </article>
    );
  }

  if (section.type === "gallery") {
    return (
      <article className="rounded-2xl border border-slate-200 bg-white p-6">
        <h2 className="text-2xl font-bold text-slate-900">{section.title || "Gallery"}</h2>
        <p className="mt-2 text-slate-600">{section.body || ""}</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 md:grid-cols-3">
          {items.map((item, idx) => (
            <div key={`${item}-${idx}`} className="overflow-hidden rounded-xl border border-slate-200 bg-slate-100">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={item} alt={`Gallery ${idx + 1}`} className="h-44 w-full object-cover" />
            </div>
          ))}
        </div>
      </article>
    );
  }

  if (section.type === "cta-banner") {
    return (
      <article className="rounded-2xl p-6 text-white" style={{ background: accentColor }}>
        <h2 className="text-2xl font-bold">{section.title || "Take the Next Step"}</h2>
        <p className="mt-2 text-sm text-white/90">{section.body || ""}</p>
        {section.ctaLabel && section.ctaHref && (
          <Link href={section.ctaHref} className="mt-4 inline-block rounded-lg bg-white px-4 py-2 text-sm font-semibold text-slate-900">
            {section.ctaLabel}
          </Link>
        )}
      </article>
    );
  }

  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-6">
      <h2 className="text-2xl font-bold text-slate-900">{section.title || "Section"}</h2>
      <p className="mt-2 whitespace-pre-line text-slate-600">{section.body || ""}</p>
      {section.ctaLabel && section.ctaHref && (
        <Link
          href={section.ctaHref}
          className="mt-4 inline-block rounded-lg px-4 py-2 text-sm font-semibold text-white"
          style={{ background: primaryColor }}
        >
          {section.ctaLabel}
        </Link>
      )}
    </article>
  );
}

function templateContainerClass(templateKey: WebsiteSettings["template_key"]) {
  if (templateKey === "sunrise") {
    return "bg-gradient-to-b from-orange-50 via-amber-50 to-white";
  }

  if (templateKey === "minimal") {
    return "bg-white";
  }

  return "bg-slate-50";
}

async function getSchoolAndSettings(subdomain: string) {
  const supabase = createServerComponentClient({ cookies });

  const { data: schoolRows, error: schoolError } = await supabase.rpc("get_school_by_subdomain", {
    p_subdomain: subdomain,
  });

  if (schoolError || !Array.isArray(schoolRows) || schoolRows.length === 0 || !schoolRows[0]?.is_active) {
    return null;
  }

  const school = schoolRows[0] as { id: string; name: string; is_active: boolean };

  const { data: settingsData } = await supabase
    .from("website_site_settings")
    .select("template_key, brand_name, primary_color, secondary_color, accent_color, heading_font, body_font, hero_title, hero_subtitle, cta_label, cta_href, show_news, show_events")
    .eq("school_id", school.id)
    .maybeSingle();

  const settings: WebsiteSettings = {
    template_key: (settingsData?.template_key ?? "classic") as WebsiteSettings["template_key"],
    brand_name: settingsData?.brand_name || school.name,
    primary_color: settingsData?.primary_color || "#0f766e",
    secondary_color: settingsData?.secondary_color || "#f8fafc",
    accent_color: settingsData?.accent_color || "#ea580c",
    heading_font: settingsData?.heading_font || "Poppins",
    body_font: settingsData?.body_font || "Open Sans",
    hero_title: settingsData?.hero_title || `Welcome to ${school.name}`,
    hero_subtitle: settingsData?.hero_subtitle || "An excellent place for learning, growth, and future leaders.",
    cta_label: settingsData?.cta_label || "Get Started",
    cta_href: settingsData?.cta_href || "/news",
    show_news: settingsData?.show_news ?? true,
    show_events: settingsData?.show_events ?? true,
  };

  return { school, settings, supabase };
}

async function getHomepageContent(supabase: ReturnType<typeof createServerComponentClient>, schoolId: string) {
  const { data: homepage } = await supabase
    .from("website_pages")
    .select("id, title, slug, sections, status, is_homepage")
    .eq("school_id", schoolId)
    .eq("status", "published")
    .eq("is_homepage", true)
    .maybeSingle();

  if (homepage) {
    return {
      page: {
        ...(homepage as Omit<WebsitePage, "sections">),
        sections: normalizeSections(homepage.sections),
      } as WebsitePage,
    };
  }

  const { data: homeBySlug } = await supabase
    .from("website_pages")
    .select("id, title, slug, sections, status, is_homepage")
    .eq("school_id", schoolId)
    .eq("status", "published")
    .eq("slug", "home")
    .maybeSingle();

  if (!homeBySlug) {
    return { page: null };
  }

  return {
    page: {
      ...(homeBySlug as Omit<WebsitePage, "sections">),
      sections: normalizeSections(homeBySlug.sections),
    } as WebsitePage,
  };
}

export default async function PublicSchoolSitePage({
  params,
}: {
  params: { subdomain: string; slug?: string[] };
}) {
  const resolved = await getSchoolAndSettings(params.subdomain);

  if (!resolved) {
    notFound();
  }

  const { school, settings, supabase } = resolved;
  const slug = params.slug?.length ? params.slug.join("/") : "home";

  const { data: navigationRows } = await supabase
    .from("website_navigation_items")
    .select("label, href, order_sequence")
    .eq("school_id", school.id)
    .eq("is_visible", true)
    .order("order_sequence", { ascending: true });

  const navItems = (navigationRows ?? []) as Array<{ label: string; href: string }>;

  if (slug === "news") {
    const { data: newsRows } = await supabase
      .from("news")
      .select("id, title, excerpt, slug, published_at")
      .eq("school_id", school.id)
      .eq("published", true)
      .order("published_at", { ascending: false })
      .limit(30);

    const news = (newsRows ?? []) as WebsiteNews[];

    return (
      <main className={`min-h-screen ${templateContainerClass(settings.template_key)} px-6 py-10`}>
        <div className="mx-auto max-w-5xl space-y-6">
          <header className="flex flex-wrap items-center justify-between gap-4">
            <h1 className="text-3xl font-bold" style={{ color: settings.primary_color }}>{settings.brand_name} News</h1>
            <Link href="/" className="text-sm font-semibold underline">Back Home</Link>
          </header>

          {news.length === 0 ? (
            <p className="text-slate-600">No news has been published yet.</p>
          ) : (
            <div className="grid gap-4">
              {news.map((item) => (
                <article key={item.id} className="rounded-xl border border-slate-200 bg-white p-5">
                  <h2 className="text-xl font-semibold">{item.title}</h2>
                  <p className="mt-2 text-sm text-slate-600">{item.excerpt || "No excerpt provided."}</p>
                  {item.published_at && (
                    <p className="mt-3 text-xs text-slate-500">
                      Published {new Date(item.published_at).toLocaleDateString()}
                    </p>
                  )}
                </article>
              ))}
            </div>
          )}
        </div>
      </main>
    );
  }

  if (slug === "events") {
    const { data: eventRows } = await supabase
      .from("events")
      .select("id, title, excerpt, location, start_date, slug")
      .eq("school_id", school.id)
      .eq("published", true)
      .order("start_date", { ascending: true })
      .limit(30);

    const events = (eventRows ?? []) as WebsiteEvent[];

    return (
      <main className={`min-h-screen ${templateContainerClass(settings.template_key)} px-6 py-10`}>
        <div className="mx-auto max-w-5xl space-y-6">
          <header className="flex flex-wrap items-center justify-between gap-4">
            <h1 className="text-3xl font-bold" style={{ color: settings.primary_color }}>{settings.brand_name} Events</h1>
            <Link href="/" className="text-sm font-semibold underline">Back Home</Link>
          </header>

          {events.length === 0 ? (
            <p className="text-slate-600">No events have been published yet.</p>
          ) : (
            <div className="grid gap-4">
              {events.map((item) => (
                <article key={item.id} className="rounded-xl border border-slate-200 bg-white p-5">
                  <h2 className="text-xl font-semibold">{item.title}</h2>
                  <p className="mt-2 text-sm text-slate-600">{item.excerpt || "No details available."}</p>
                  <p className="mt-3 text-sm text-slate-700">
                    {new Date(item.start_date).toLocaleString()} {item.location ? `• ${item.location}` : ""}
                  </p>
                </article>
              ))}
            </div>
          )}
        </div>
      </main>
    );
  }

  let page: WebsitePage | null = null;

  if (slug === "home") {
    const homeResult = await getHomepageContent(supabase, school.id);
    page = homeResult.page;
  } else {
    const { data: pageRow } = await supabase
      .from("website_pages")
      .select("id, title, slug, sections, status, is_homepage")
      .eq("school_id", school.id)
      .eq("status", "published")
      .eq("slug", slug)
      .maybeSingle();

    if (pageRow) {
      page = {
        ...(pageRow as Omit<WebsitePage, "sections">),
        sections: normalizeSections(pageRow.sections),
      };
    }
  }

  const { data: newsRows } = await supabase
    .from("news")
    .select("id, title, excerpt, slug, published_at")
    .eq("school_id", school.id)
    .eq("published", true)
    .order("published_at", { ascending: false })
    .limit(3);

  const { data: eventRows } = await supabase
    .from("events")
    .select("id, title, excerpt, location, start_date, slug")
    .eq("school_id", school.id)
    .eq("published", true)
    .order("start_date", { ascending: true })
    .limit(3);

  const news = (newsRows ?? []) as WebsiteNews[];
  const events = (eventRows ?? []) as WebsiteEvent[];
  const sectionsToRender =
    page?.sections?.length
      ? page.sections
      : slug === "home"
      ? fallbackLandingSections(settings.brand_name)
      : [];

  const siteStyle = {
    ["--wb-primary" as string]: settings.primary_color,
    ["--wb-secondary" as string]: settings.secondary_color,
    ["--wb-accent" as string]: settings.accent_color,
    ["--wb-heading-font" as string]: settings.heading_font,
    ["--wb-body-font" as string]: settings.body_font,
  } as CSSProperties;

  if (slug !== "home" && !page) {
    notFound();
  }

  return (
    <main style={siteStyle} className={`min-h-screen ${templateContainerClass(settings.template_key)}`}>
      <header className="border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-6 py-4">
          <Link href="/" className="text-xl font-bold" style={{ color: settings.primary_color }}>
            {settings.brand_name}
          </Link>

          <nav className="flex flex-wrap items-center gap-4 text-sm font-semibold text-slate-700">
            <Link href="/">Home</Link>
            {navItems.map((item) => (
              <Link key={`${item.label}-${item.href}`} href={item.href}>
                {item.label}
              </Link>
            ))}
            {settings.show_news && <Link href="/news">News</Link>}
            {settings.show_events && <Link href="/events">Events</Link>}
          </nav>
        </div>
      </header>

      <section className="px-6 pb-8 pt-16">
        <div className="mx-auto max-w-6xl rounded-3xl p-10" style={{ background: settings.secondary_color }}>
          <h1 className="text-4xl font-black leading-tight text-slate-900" style={{ fontFamily: "var(--wb-heading-font)" }}>
            {slug === "home" ? settings.hero_title : page?.title}
          </h1>
          <p className="mt-4 max-w-2xl text-base text-slate-600" style={{ fontFamily: "var(--wb-body-font)" }}>
            {slug === "home" ? settings.hero_subtitle : ""}
          </p>
          {slug === "home" && (
            <Link
              href={settings.cta_href || "/news"}
              className="mt-6 inline-block rounded-xl px-6 py-3 text-sm font-semibold text-white"
              style={{ background: settings.accent_color }}
            >
              {settings.cta_label || "Explore"}
            </Link>
          )}
        </div>
      </section>

      {sectionsToRender.length ? (
        <section className="mx-auto max-w-6xl space-y-4 px-6 pb-12">
          {sectionsToRender
            .filter((section) => section.isVisible !== false)
            .map((section, idx) => (
              <div key={section.id || `${section.type || "section"}-${idx}`}>
                {renderSection(section, settings.primary_color, settings.accent_color)}
              </div>
            ))}
        </section>
      ) : null}

      {slug === "home" && settings.show_news && news.length > 0 && (
        <section className="mx-auto max-w-6xl px-6 pb-12">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-2xl font-bold text-slate-900">Latest News</h2>
            <Link href="/news" className="text-sm font-semibold" style={{ color: settings.primary_color }}>
              View all
            </Link>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {news.map((item) => (
              <article key={item.id} className="rounded-xl border border-slate-200 bg-white p-5">
                <h3 className="font-semibold text-slate-900">{item.title}</h3>
                <p className="mt-2 text-sm text-slate-600">{item.excerpt || "No excerpt provided."}</p>
              </article>
            ))}
          </div>
        </section>
      )}

      {slug === "home" && settings.show_events && events.length > 0 && (
        <section className="mx-auto max-w-6xl px-6 pb-16">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-2xl font-bold text-slate-900">Upcoming Events</h2>
            <Link href="/events" className="text-sm font-semibold" style={{ color: settings.primary_color }}>
              View all
            </Link>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {events.map((item) => (
              <article key={item.id} className="rounded-xl border border-slate-200 bg-white p-5">
                <h3 className="font-semibold text-slate-900">{item.title}</h3>
                <p className="mt-2 text-sm text-slate-600">{item.excerpt || "No details available."}</p>
                <p className="mt-3 text-xs text-slate-500">{new Date(item.start_date).toLocaleString()}</p>
              </article>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
