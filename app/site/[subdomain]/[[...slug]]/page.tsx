import { createClient } from "@supabase/supabase-js";
import { headers } from "next/headers";
import { notFound } from "next/navigation";

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

function getSupabaseAnonClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new Error("Supabase public env vars are required for website rendering");
  }

  return createClient(url, key);
}

function renderSection(section: WebsiteSection, colors: { primary: string; secondary: string }) {
  if (!section.is_visible) return null;

  const items = section.content.items || [];

  return (
    <section key={section.id} id={section.section_key} className="px-4 py-14 md:px-8">
      <div className="mx-auto max-w-6xl">
        <h2 className="text-3xl font-bold" style={{ color: colors.primary }}>
          {section.content.heading || section.section_label}
        </h2>
        {section.content.subheading ? (
          <p className="mt-2 text-lg text-slate-600">{section.content.subheading}</p>
        ) : null}
        {section.content.description ? (
          <p className="mt-4 whitespace-pre-wrap text-slate-700">{section.content.description}</p>
        ) : null}

        {items.length > 0 ? (
          <div className="mt-6 grid gap-3 md:grid-cols-2">
            {items.map((item, index) => (
              <div
                key={`${section.id}-${index}`}
                className="rounded-lg border border-slate-200 bg-white px-4 py-3 text-slate-700 shadow-sm"
              >
                {item}
              </div>
            ))}
          </div>
        ) : null}

        {section.content.image_url ? (
          <div className="mt-6 overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
            <img
              src={section.content.image_url}
              alt={section.section_label}
              className="h-72 w-full object-cover"
            />
          </div>
        ) : null}

        {section.content.button_label ? (
          <div className="mt-6">
            <a
              href={section.content.button_link || "#contact"}
              className="inline-flex items-center rounded-md px-4 py-2 text-sm font-semibold text-white"
              style={{ backgroundColor: colors.secondary }}
            >
              {section.content.button_label}
            </a>
          </div>
        ) : null}
      </div>
    </section>
  );
}

export default async function PublicSchoolWebsite({
  params,
}: {
  params: { subdomain: string; slug?: string[] };
}) {
  const subdomain = params.subdomain;
  const slug = params.slug || [];

  if (slug.length > 0 && slug[0] !== "home") {
    notFound();
  }

  const supabase = getSupabaseAnonClient();
  const reqHeaders = headers();
  const schoolIdFromHeader = reqHeaders.get("x-school-id");

  let school: { id: string; name: string; is_active: boolean } | null = null;

  if (schoolIdFromHeader) {
    const { data: schoolResult, error: schoolError } = await supabase
      .rpc("get_school_by_subdomain", { p_subdomain: subdomain })
      .maybeSingle();

    if (schoolError) {
      throw new Error(schoolError.message);
    }

    school = (schoolResult as { id: string; name: string; is_active: boolean } | null) || null;
  } else {
    const { data: schoolResult, error: schoolError } = await supabase
      .rpc("get_school_by_subdomain", { p_subdomain: subdomain })
      .maybeSingle();

    if (schoolError) {
      throw new Error(schoolError.message);
    }

    school = (schoolResult as { id: string; name: string; is_active: boolean } | null) || null;
  }

  if (!school || !school.is_active) {
    notFound();
  }

  const [{ data: settings }, { data: page }, { data: sections }] = await Promise.all([
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
    supabase
      .from("website_sections")
      .select("*")
      .eq("school_id", school.id)
      .order("order_sequence", { ascending: true }),
  ]);

  if (!page) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
        <div className="rounded-lg border border-slate-200 bg-white p-8 text-center shadow-sm">
          <h1 className="text-2xl font-bold text-slate-900">Website Not Published</h1>
          <p className="mt-2 text-slate-600">This school website is not live yet.</p>
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

  const typedSections = ((sections || []) as WebsiteSection[])
    .filter((section) => section.is_visible)
    .sort((a, b) => a.order_sequence - b.order_sequence);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header
        className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur"
        style={{ borderBottomColor: `${siteSettings.primary_color}22` }}
      >
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 md:px-8">
          <a href="#home" className="flex items-center gap-3">
            {siteSettings.logo_url ? (
              <img src={siteSettings.logo_url} alt={siteSettings.site_title} className="h-10 w-10 rounded-full object-cover" />
            ) : (
              <div
                className="flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold text-white"
                style={{ backgroundColor: siteSettings.primary_color }}
              >
                {siteSettings.site_title.slice(0, 2).toUpperCase()}
              </div>
            )}
            <div>
              <p className="font-semibold" style={{ color: siteSettings.primary_color }}>
                {siteSettings.site_title}
              </p>
              <p className="text-xs text-slate-500">{siteSettings.site_tagline}</p>
            </div>
          </a>
          <nav className="hidden gap-4 text-sm md:flex">
            {typedSections.map((section) => (
              <a key={section.id} href={`#${section.section_key}`} className="text-slate-600 hover:text-slate-900">
                {section.section_label}
              </a>
            ))}
          </nav>
        </div>
      </header>

      {siteSettings.hero_background_url ? (
        <div className="h-60 w-full bg-cover bg-center" style={{ backgroundImage: `url('${siteSettings.hero_background_url}')` }} />
      ) : null}

      <main>{typedSections.map((section) => renderSection(section, { primary: siteSettings.primary_color, secondary: siteSettings.secondary_color }))}</main>

      <footer className="border-t border-slate-200 bg-white px-4 py-8 md:px-8">
        <div className="mx-auto max-w-6xl text-sm text-slate-600">
          <p className="font-semibold text-slate-900">{siteSettings.site_title}</p>
          {siteSettings.contact_email ? <p>Email: {siteSettings.contact_email}</p> : null}
          {siteSettings.contact_phone ? <p>Phone: {siteSettings.contact_phone}</p> : null}
          {siteSettings.contact_address ? <p>Address: {siteSettings.contact_address}</p> : null}
        </div>
      </footer>
    </div>
  );
}
