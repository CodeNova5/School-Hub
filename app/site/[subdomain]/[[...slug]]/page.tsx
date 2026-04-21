import Link from "next/link";
import { notFound } from "next/navigation";
import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import type { CSSProperties } from "react";

type PageSection = {
  id?: string;
  type?: string;
  title?: string;
  body?: string;
  ctaLabel?: string;
  ctaHref?: string;
  imageUrl?: string;
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

      {page?.sections?.length ? (
        <section className="mx-auto max-w-6xl space-y-4 px-6 pb-12">
          {page.sections.map((section, idx) => (
            <article key={section.id || `${section.type || "section"}-${idx}`} className="rounded-2xl border border-slate-200 bg-white p-6">
              <h2 className="text-2xl font-bold text-slate-900">{section.title || "Section"}</h2>
              <p className="mt-2 whitespace-pre-line text-slate-600">{section.body || ""}</p>
              {section.ctaLabel && section.ctaHref && (
                <Link
                  href={section.ctaHref}
                  className="mt-4 inline-block rounded-lg px-4 py-2 text-sm font-semibold text-white"
                  style={{ background: settings.primary_color }}
                >
                  {section.ctaLabel}
                </Link>
              )}
            </article>
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
