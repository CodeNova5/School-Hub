"use client";

import { useMemo, useState } from "react";

interface SchoolDomainSiteSettings {
  site_title: string;
  site_tagline: string;
  logo_url: string;
  primary_color: string;
  secondary_color: string;
}

interface SchoolDomainNavLink {
  label: string;
  href: string;
}

type SchoolDomainCurrentPage =
  | "home"
  | "hall-of-fame"
  | "alumni"
  | "alumni-profile"
  | "alumni-apply";

interface SchoolDomainHeaderProps {
  siteSettings: SchoolDomainSiteSettings;
  basePath: string;
  currentPage: SchoolDomainCurrentPage;
  preview?: boolean;
  contextLinks?: SchoolDomainNavLink[];
  ctaHref?: string;
  ctaLabel?: string;
}

const HOME_SECTION_LINKS: Array<{ key: string; label: string }> = [
  { key: "about", label: "About" },
  { key: "programs", label: "Programs" },
  { key: "facilities", label: "Facilities" },
  { key: "faculty", label: "Faculty" },
  { key: "news", label: "News" },
  { key: "testimonials", label: "Testimonials" },
  { key: "gallery", label: "Gallery" },
  { key: "admissions", label: "Admissions" },
  { key: "contact", label: "Contact" },
];

function getPath(basePath: string, suffix = "") {
  if (!suffix) {
    return basePath || "/";
  }

  if (basePath) {
    return `${basePath}${suffix}`;
  }

  return suffix;
}

export function SchoolDomainHeader({
  siteSettings,
  basePath,
  currentPage,
  preview = false,
  contextLinks = [],
  ctaHref,
  ctaLabel = "Apply as Alumni",
}: SchoolDomainHeaderProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  const homeHref = getPath(basePath);
  const hallOfFameHref = getPath(basePath, "/hall-of-fame");
  const alumniHref = getPath(basePath, "/alumni");
  const applyHref = ctaHref || getPath(basePath, "/alumni/apply");

  const homeSectionLinks = useMemo(
    () => HOME_SECTION_LINKS.map((item) => ({ label: item.label, href: `${homeHref}#${item.key}` })),
    [homeHref]
  );

  const normalizedContextLinks = useMemo(
    () => contextLinks.filter((item) => item.label.trim() && item.href.trim()),
    [contextLinks]
  );

  const isAlumniActive =
    currentPage === "alumni" || currentPage === "alumni-profile" || currentPage === "alumni-apply";

  const homeLinkClass =
    currentPage === "home"
      ? "text-white"
      : "text-white/80 transition hover:text-white";

  const hallLinkClass =
    currentPage === "hall-of-fame"
      ? "text-white"
      : "text-white/80 transition hover:text-white";

  const alumniLinkClass = isAlumniActive
    ? "text-white"
    : "text-white/80 transition hover:text-white";

  return (
    <header className="sticky top-0 z-50 border-b border-white/15 bg-slate-950/92 text-white backdrop-blur-xl">
      <div className="mx-auto flex w-full max-w-[1240px] items-center justify-between gap-3 px-4 py-3 md:px-6">
        <a href={homeHref} className="group flex min-w-0 items-center gap-3">
          {siteSettings.logo_url ? (
            <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white/10 ring-1 ring-white/30">
              <img
                src={siteSettings.logo_url}
                alt={siteSettings.site_title}
                className="h-full w-full origin-center scale-[1.45] object-contain"
              />
            </div>
          ) : (
            <div
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-sm font-black text-slate-950"
              style={{ backgroundColor: siteSettings.secondary_color || "#22c55e" }}
            >
              {siteSettings.site_title.slice(0, 2).toUpperCase()}
            </div>
          )}

          <div className="min-w-0">
            <p className="truncate text-sm font-bold tracking-wide text-white md:text-base">{siteSettings.site_title}</p>
            <p className="truncate text-xs text-white/70">{siteSettings.site_tagline}</p>
          </div>
        </a>

        <nav className="hidden items-center gap-6 md:flex">
          <a href={homeHref} className={homeLinkClass}>Home</a>
          <a href={hallOfFameHref} className={hallLinkClass}>Hall of Fame</a>
          <a href={alumniHref} className={alumniLinkClass}>Alumni</a>

          <div className="group relative">
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/5 px-3 py-1.5 text-sm font-medium text-white/90 transition hover:bg-white/10"
              aria-haspopup="true"
            >
              Explore
              <span className="text-xs">v</span>
            </button>

            <div className="pointer-events-none absolute right-0 top-[calc(100%+10px)] z-50 w-[340px] rounded-2xl border border-white/15 bg-slate-900/98 p-4 opacity-0 shadow-2xl transition duration-150 group-hover:pointer-events-auto group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:opacity-100">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/55">Home Sections</p>
              <div className="mt-3 grid grid-cols-2 gap-2">
                {homeSectionLinks.map((item) => (
                  <a
                    key={item.label}
                    href={item.href}
                    className="rounded-lg border border-white/10 px-3 py-2 text-xs font-medium text-white/80 transition hover:border-white/25 hover:bg-white/5 hover:text-white"
                  >
                    {item.label}
                  </a>
                ))}
              </div>

              {normalizedContextLinks.length > 0 ? (
                <>
                  <p className="mt-4 text-[11px] font-semibold uppercase tracking-[0.2em] text-white/55">This Page</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {normalizedContextLinks.map((item) => (
                      <a
                        key={`${item.label}-${item.href}`}
                        href={item.href}
                        className="rounded-full border border-white/10 px-3 py-1.5 text-xs text-white/80 transition hover:border-white/25 hover:bg-white/5 hover:text-white"
                      >
                        {item.label}
                      </a>
                    ))}
                  </div>
                </>
              ) : null}
            </div>
          </div>

          <a
            href={applyHref}
            className="inline-flex items-center rounded-full px-4 py-2 text-sm font-semibold text-slate-950 transition hover:opacity-90"
            style={{ backgroundColor: siteSettings.secondary_color || "#22c55e" }}
          >
            {ctaLabel}
          </a>
        </nav>

        <button
          type="button"
          onClick={() => setMobileOpen((prev) => !prev)}
          className="inline-flex items-center rounded-full border border-white/20 bg-white/5 px-3 py-2 text-sm text-white/90 md:hidden"
          aria-label="Toggle navigation menu"
          aria-expanded={mobileOpen}
          aria-controls="school-domain-mobile-menu"
        >
          Menu
        </button>
      </div>

      {mobileOpen ? (
        <div id="school-domain-mobile-menu" className="border-t border-white/10 bg-slate-950/98 px-4 pb-4 pt-3 md:hidden">
          <div className="grid gap-2">
            <a href={homeHref} onClick={() => setMobileOpen(false)} className="rounded-xl border border-white/10 px-3 py-2 text-sm text-white/90">Home</a>
            <a href={hallOfFameHref} onClick={() => setMobileOpen(false)} className="rounded-xl border border-white/10 px-3 py-2 text-sm text-white/90">Hall of Fame</a>
            <a href={alumniHref} onClick={() => setMobileOpen(false)} className="rounded-xl border border-white/10 px-3 py-2 text-sm text-white/90">Alumni</a>
          </div>

          <p className="mt-4 text-[11px] font-semibold uppercase tracking-[0.2em] text-white/55">Home Sections</p>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {homeSectionLinks.map((item) => (
              <a
                key={item.label}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className="rounded-lg border border-white/10 px-3 py-2 text-xs text-white/85"
              >
                {item.label}
              </a>
            ))}
          </div>

          {normalizedContextLinks.length > 0 ? (
            <>
              <p className="mt-4 text-[11px] font-semibold uppercase tracking-[0.2em] text-white/55">This Page</p>
              <div className="mt-2 grid gap-2">
                {normalizedContextLinks.map((item) => (
                  <a
                    key={`${item.label}-${item.href}`}
                    href={item.href}
                    onClick={() => setMobileOpen(false)}
                    className="rounded-lg border border-white/10 px-3 py-2 text-xs text-white/85"
                  >
                    {item.label}
                  </a>
                ))}
              </div>
            </>
          ) : null}

          <a
            href={applyHref}
            onClick={() => setMobileOpen(false)}
            className="mt-4 inline-flex w-full items-center justify-center rounded-full px-4 py-2 text-sm font-semibold text-slate-950"
            style={{ backgroundColor: siteSettings.secondary_color || "#22c55e" }}
          >
            {ctaLabel}
          </a>
        </div>
      ) : null}

      {preview ? (
        <div className="border-t border-amber-200/40 bg-amber-100/10 px-4 py-2 text-center text-xs font-medium text-amber-200">
          Preview mode. Draft content is visible to authenticated admins only.
        </div>
      ) : null}
    </header>
  );
}
