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
  image_url: string;
  profile_slug: string;
}

function getBasePath(requestedSubdomain: string, hostSubdomain: string | null) {
  return hostSubdomain ? "" : `/site/${requestedSubdomain}`;
}

export default async function AlumniDirectoryPage({
  params,
}: {
  params: { subdomain: string };
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

  const [siteSettings, profilesResult] = await Promise.all([
    getPublicSiteSettings(school.id),
    getPublicSupabaseAnonClient()
      .from("website_alumni_profiles")
      .select("id, full_name, occupation, image_url, profile_slug")
      .eq("school_id", school.id)
      .eq("is_visible", true)
      .order("created_at", { ascending: false }),
  ]);

  const profiles = (profilesResult.data || []) as AlumniProfile[];
  const basePath = getBasePath(requestedSubdomain, hostSubdomain);

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-4">
          <div>
            <p className="text-xs uppercase tracking-[0.25em] text-slate-500">{siteSettings.site_tagline}</p>
            <h1 className="text-xl font-bold text-slate-900">{siteSettings.site_title}</h1>
          </div>
          <nav className="flex items-center gap-4 text-sm font-medium text-slate-600">
            <Link href={basePath || "/"} className="hover:text-slate-900">Home</Link>
            <Link href={`${basePath}/hall-of-fame`} className="hover:text-slate-900">Hall of Fame</Link>
            <Link href={`${basePath}/alumni`} className="text-slate-900">Alumni</Link>
            <Link href={`${basePath}/alumni/apply`} className="rounded-full px-4 py-2 text-white" style={{ backgroundColor: siteSettings.secondary_color }}>
              Apply as Alumni
            </Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-12">
        <div className="mb-10 text-center">
          <h2 className="text-4xl font-black tracking-tight text-slate-900">Alumni Directory</h2>
          <p className="mx-auto mt-3 max-w-2xl text-sm leading-7 text-slate-600">
            Meet graduates who continue to make an impact in different careers and communities.
          </p>
        </div>

        {profiles.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center text-slate-500">
            No alumni profiles have been published yet.
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {profiles.map((profile) => (
              <article key={profile.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-lg">
                <div className="h-64 w-full bg-slate-100">
                  <img src={profile.image_url} alt={profile.full_name} className="h-full w-full object-cover" />
                </div>
                <div className="p-5">
                  <h3 className="text-lg font-bold text-slate-900">{profile.full_name}</h3>
                  <p className="mt-1 text-sm text-slate-600">{profile.occupation}</p>
                  <Link
                    href={`${basePath}/alumni/${profile.profile_slug}`}
                    className="mt-4 inline-flex items-center rounded-full px-4 py-2 text-sm font-semibold text-white"
                    style={{ backgroundColor: siteSettings.primary_color }}
                  >
                    View Profile
                  </Link>
                </div>
              </article>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
