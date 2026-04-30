"use client";

import { useState } from "react";

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
  | "academics"
  | "alumni"
  | "alumni-profile"
  | "alumni-apply"
  | "admissions"
  | "contact";

interface SchoolDomainHeaderProps {
  siteSettings: SchoolDomainSiteSettings;
  basePath: string;
  currentPage: SchoolDomainCurrentPage;
  preview?: boolean;
  contextLinks?: SchoolDomainNavLink[];
  ctaHref?: string;
  ctaLabel?: string;
}

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
  ctaHref,
  ctaLabel = "Apply for Admission",
}: SchoolDomainHeaderProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  const homeHref = getPath(basePath);
  const hallOfFameHref = getPath(basePath, "/hall-of-fame");
  const academicsHref = getPath(basePath, "/academics");
  const alumniHref = getPath(basePath, "/alumni");
  const contactHref = getPath(basePath, "/contact");
  const admissionsHref = getPath(basePath, "/admissions/apply");
  const applyHref = ctaHref || admissionsHref;

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

  const academicsLinkClass =
    currentPage === "academics"
      ? "text-white"
      : "text-white/80 transition hover:text-white";

  const alumniLinkClass = isAlumniActive
    ? "text-white"
    : "text-white/80 transition hover:text-white";

  const contactLinkClass =
    currentPage === "contact" ? "text-white" : "text-white/80 transition hover:text-white";

  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-slate-950 text-white">
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
          <a href={academicsHref} className={academicsLinkClass}>Academics</a>
          <a href={contactHref} className={contactLinkClass}>Contact</a>
          <a href={alumniHref} className={alumniLinkClass}>Alumni</a>

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
        <div id="school-domain-mobile-menu" className="border-t border-white/10 bg-slate-950 px-4 pb-4 pt-3 md:hidden">
          <div className="grid gap-2">
            <a href={homeHref} onClick={() => setMobileOpen(false)} className="rounded-xl border border-white/10 px-3 py-2 text-sm text-white/90">Home</a>
            <a href={hallOfFameHref} onClick={() => setMobileOpen(false)} className="rounded-xl border border-white/10 px-3 py-2 text-sm text-white/90">Hall of Fame</a>
            <a href={academicsHref} onClick={() => setMobileOpen(false)} className="rounded-xl border border-white/10 px-3 py-2 text-sm text-white/90">Academics</a>
            <a href={contactHref} onClick={() => setMobileOpen(false)} className="rounded-xl border border-white/10 px-3 py-2 text-sm text-white/90">Contact</a>
            <a href={alumniHref} onClick={() => setMobileOpen(false)} className="rounded-xl border border-white/10 px-3 py-2 text-sm text-white/90">Alumni</a>
          </div>

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
