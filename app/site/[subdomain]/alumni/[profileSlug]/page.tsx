import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import {
  extractSubdomainFromHost,
  getPublicSiteSettings,
  getPublicSupabaseAnonClient,
  resolveSchoolBySubdomain,
} from "@/lib/public-school-site";

interface AlumniProfile {
  id: string;
  full_name: string;
  occupation: string;
  story: string;
  image_url: string;
  linkedin_url: string;
  x_url: string;
  tiktok_url: string;
  instagram_url: string;
  facebook_url: string;
  website_url: string;
}

function getBasePath(requestedSubdomain: string, hostSubdomain: string | null) {
  return hostSubdomain ? "" : `/site/${requestedSubdomain}`;
}

function buildLinks(profile: AlumniProfile) {
  return [
    { label: "LinkedIn", href: profile.linkedin_url },
    { label: "X", href: profile.x_url },
    { label: "TikTok", href: profile.tiktok_url },
    { label: "Instagram", href: profile.instagram_url },
    { label: "Facebook", href: profile.facebook_url },
    { label: "Website", href: profile.website_url },
  ].filter((item) => item.href);
}

export default async function AlumniProfilePage({
  params,
}: {
  params: { subdomain: string; profileSlug: string };
}) {
  const requestedSubdomain = params.subdomain;
  const headerStore = headers();
  const host = headerStore.get("x-forwarded-host") || headerStore.get("host") || "";
  const hostSubdomain = extractSubdomainFromHost(host);
  const subdomain = hostSubdomain || requestedSubdomain;

  const school = await resolveSchoolBySubdomain(subdomain);
  if (!school || !school.is_active) {
    notFound();
  }

  const [siteSettings, profileResult] = await Promise.all([
    getPublicSiteSettings(school.id),
    getPublicSupabaseAnonClient()
      .from("website_alumni_profiles")
      .select("id, full_name, occupation, story, image_url, linkedin_url, x_url, tiktok_url, instagram_url, facebook_url, website_url")
      .eq("school_id", school.id)
      .eq("is_visible", true)
      .eq("profile_slug", params.profileSlug)
      .maybeSingle(),
  ]);

  const profile = (profileResult.data || null) as AlumniProfile | null;
  if (!profile) {
    notFound();
  }

  const basePath = getBasePath(requestedSubdomain, hostSubdomain);
  const links = buildLinks(profile);

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-4">
          <h1 className="text-lg font-bold text-slate-900">{siteSettings.site_title}</h1>
          <div className="flex items-center gap-4 text-sm">
            <Link href={`${basePath}/alumni`} className="font-medium text-slate-700 hover:text-slate-900">
              Back to Alumni
            </Link>
            <Link
              href={`${basePath}/alumni/apply`}
              className="rounded-full px-4 py-2 text-white"
              style={{ backgroundColor: siteSettings.secondary_color }}
            >
              Apply as Alumni
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto grid max-w-5xl gap-8 px-4 py-12 lg:grid-cols-[340px_1fr]">
        <aside>
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="h-96 w-full bg-slate-100">
              <img src={profile.image_url} alt={profile.full_name} className="h-full w-full object-cover" />
            </div>
            <div className="p-5">
              <h2 className="text-2xl font-bold text-slate-900">{profile.full_name}</h2>
              <p className="mt-2 text-slate-600">{profile.occupation}</p>
            </div>
          </div>
        </aside>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="text-xl font-bold text-slate-900">Story</h3>
          <p className="mt-4 whitespace-pre-line leading-8 text-slate-700">{profile.story}</p>

          {links.length > 0 ? (
            <div className="mt-8 border-t pt-6">
              <h4 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">Connect</h4>
              <div className="mt-4 flex flex-wrap gap-2">
                {links.map((item) => (
                  <a
                    key={item.label}
                    href={item.href}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-full border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
                  >
                    {item.label}
                  </a>
                ))}
              </div>
            </div>
          ) : null}
        </section>
      </main>
    </div>
  );
}
