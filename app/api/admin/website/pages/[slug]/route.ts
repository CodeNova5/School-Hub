import { NextRequest } from "next/server";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { checkIsAdminWithSchool, errorResponse, successResponse } from "@/lib/api-helpers";
import {
  WEBSITE_DEFAULT_SITE_SETTINGS,
  getWebsiteGlobalSettingsQualification,
  getWebsiteSectionTemplatesForPage,
  isWebsiteSectionCustomized,
  type WebsitePageSlug,
} from "@/lib/website-builder";

interface WebsiteSectionRow {
  id: string;
  school_id: string;
  page_id: string;
  section_key: string;
  section_label: string;
  is_visible: boolean;
  order_sequence: number;
  content: Record<string, any>;
}

function resolvePageSlug(rawSlug: string | undefined): WebsitePageSlug {
  return rawSlug === "hall-of-fame" ? "hall-of-fame" : "home";
}

function getPageTitle(pageSlug: WebsitePageSlug) {
  return pageSlug === "hall-of-fame" ? "Hall of Fame" : "Home";
}

function normalizeSiteSettings(settings?: Record<string, any>) {
  return {
    site_title: typeof settings?.site_title === "string" ? settings.site_title : WEBSITE_DEFAULT_SITE_SETTINGS.site_title,
    site_tagline: typeof settings?.site_tagline === "string" ? settings.site_tagline : WEBSITE_DEFAULT_SITE_SETTINGS.site_tagline,
    logo_url: typeof settings?.logo_url === "string" ? settings.logo_url : WEBSITE_DEFAULT_SITE_SETTINGS.logo_url,
    hero_background_url:
      typeof settings?.hero_background_url === "string"
        ? settings.hero_background_url
        : WEBSITE_DEFAULT_SITE_SETTINGS.hero_background_url,
    primary_color:
      typeof settings?.primary_color === "string" ? settings.primary_color : WEBSITE_DEFAULT_SITE_SETTINGS.primary_color,
    secondary_color:
      typeof settings?.secondary_color === "string"
        ? settings.secondary_color
        : WEBSITE_DEFAULT_SITE_SETTINGS.secondary_color,
    contact_email:
      typeof settings?.contact_email === "string" ? settings.contact_email : WEBSITE_DEFAULT_SITE_SETTINGS.contact_email,
    contact_phone:
      typeof settings?.contact_phone === "string" ? settings.contact_phone : WEBSITE_DEFAULT_SITE_SETTINGS.contact_phone,
    contact_address:
      typeof settings?.contact_address === "string"
        ? settings.contact_address
        : WEBSITE_DEFAULT_SITE_SETTINGS.contact_address,
    is_website_enabled:
      typeof settings?.is_website_enabled === "boolean"
        ? settings.is_website_enabled
        : WEBSITE_DEFAULT_SITE_SETTINGS.is_website_enabled,
  };
}

async function ensurePageBySlug(supabase: any, schoolId: string, pageSlug: WebsitePageSlug) {
  let { data: page, error } = await supabase
    .from("website_pages")
    .select("*")
    .eq("school_id", schoolId)
    .eq("slug", pageSlug)
    .maybeSingle();

  if (error) throw error;

  if (!page) {
    const created = await supabase
      .from("website_pages")
      .insert({
        school_id: schoolId,
        title: getPageTitle(pageSlug),
        slug: pageSlug,
        status: "draft",
      })
      .select("*")
      .single();

    if (created.error) throw created.error;
    page = created.data;
  }

  let { data: sections, error: sectionsError } = await supabase
    .from("website_sections")
    .select("*")
    .eq("page_id", page.id)
    .order("order_sequence", { ascending: true });

  if (sectionsError) throw sectionsError;

  const templates = getWebsiteSectionTemplatesForPage(pageSlug);
  const existingKeys = new Set((sections || []).map((section: WebsiteSectionRow) => section.section_key));
  const missingTemplates = templates.filter((template) => !existingKeys.has(template.key));

  if (missingTemplates.length > 0) {
    const insertPayload = missingTemplates.map((template) => ({
      school_id: schoolId,
      page_id: page.id,
      section_key: template.key,
      section_label: template.label,
      order_sequence: template.order,
      is_visible: template.visible,
      content: template.content,
    }));

    const { error: insertError } = await supabase.from("website_sections").insert(insertPayload);
    if (insertError) throw insertError;

    const refreshed = await supabase
      .from("website_sections")
      .select("*")
      .eq("page_id", page.id)
      .order("order_sequence", { ascending: true });

    if (refreshed.error) throw refreshed.error;
    sections = refreshed.data || [];
  }

  return {
    page,
    sections: sections || [],
  };
}

export async function GET(_req: NextRequest, context: { params: { slug: string } }) {
  const permission = await checkIsAdminWithSchool();
  if (!permission.authorized || !permission.schoolId) {
    return errorResponse(permission.error || "Unauthorized", permission.status || 401);
  }

  const pageSlug = resolvePageSlug(context.params.slug);
  const supabase = createRouteHandlerClient({ cookies });

  try {
    const [{ data: settings, error: settingsError }, pageResult, mediaResult, schoolResult] = await Promise.all([
      supabase
        .from("website_site_settings")
        .select("*")
        .eq("school_id", permission.schoolId)
        .maybeSingle(),
      ensurePageBySlug(supabase, permission.schoolId, pageSlug),
      supabase
        .from("website_media")
        .select("id, file_name, public_url, mime_type, created_at, page_id")
        .eq("school_id", permission.schoolId)
        .order("created_at", { ascending: false })
        .limit(100),
      supabase
        .from("schools")
        .select("id, name, subdomain")
        .eq("id", permission.schoolId)
        .maybeSingle(),
    ]);

    if (settingsError) throw settingsError;
    if (mediaResult.error) throw mediaResult.error;
    if (schoolResult.error) throw schoolResult.error;

    return successResponse({
      settings: settings || null,
      page: pageResult.page,
      sections: pageResult.sections,
      media: mediaResult.data || [],
      school: schoolResult.data || null,
      pageSlug,
    });
  } catch (error: any) {
    return errorResponse(error.message || "Failed to load website builder page", 500);
  }
}

export async function PATCH(req: NextRequest, context: { params: { slug: string } }) {
  const permission = await checkIsAdminWithSchool();
  if (!permission.authorized || !permission.schoolId) {
    return errorResponse(permission.error || "Unauthorized", permission.status || 401);
  }

  const pageSlug = resolvePageSlug(context.params.slug);
  const supabase = createRouteHandlerClient({ cookies });

  try {
    const body = await req.json();
    const { settings, page, sections } = body as {
      settings?: Record<string, any>;
      page?: Record<string, any>;
      sections?: Array<Partial<WebsiteSectionRow> & { id: string }>;
    };

    const wantsPublish = page?.status === "published";

    // Keep strict readiness lock only for homepage.
    if (wantsPublish && pageSlug === "home") {
      const [homepageState, existingSettingsResult] = await Promise.all([
        ensurePageBySlug(supabase, permission.schoolId, "home"),
        supabase
          .from("website_site_settings")
          .select("*")
          .eq("school_id", permission.schoolId)
          .maybeSingle(),
      ]);

      if (existingSettingsResult.error) throw existingSettingsResult.error;

      const incomingSectionMap = new Map((sections || []).map((item) => [item.id, item]));
      const effectiveSections = homepageState.sections.map((existing: WebsiteSectionRow) => {
        const incoming = incomingSectionMap.get(existing.id);
        if (!incoming) return existing;

        return {
          ...existing,
          section_label:
            typeof incoming.section_label === "string" ? incoming.section_label : existing.section_label,
          is_visible:
            typeof incoming.is_visible === "boolean" ? incoming.is_visible : existing.is_visible,
          order_sequence:
            typeof incoming.order_sequence === "number" ? incoming.order_sequence : existing.order_sequence,
          content: incoming.content ?? existing.content,
        };
      });

      const uncustomizedSections = effectiveSections.filter(
        (section: WebsiteSectionRow) => !isWebsiteSectionCustomized(section.section_key, section.content, "home")
      );

      const effectiveSettings = normalizeSiteSettings({
        ...(existingSettingsResult.data || {}),
        ...(settings || {}),
      });
      const globalSettingsQualification = getWebsiteGlobalSettingsQualification(effectiveSettings);

      if (uncustomizedSections.length > 0 || !globalSettingsQualification.ready) {
        const sectionLabels = uncustomizedSections.map((item: WebsiteSectionRow) => item.section_label || item.section_key);
        const sectionMessage =
          sectionLabels.length > 0
            ? `Customize these sections first: ${sectionLabels.join(", ")}.`
            : "";
        const settingsMessage =
          globalSettingsQualification.missingLabels.length > 0
            ? `Complete these global settings: ${globalSettingsQualification.missingLabels.join(", ")}.`
            : "";

        return errorResponse(
          [
            "Publishing is locked until every section is customized and global settings are completed.",
            sectionMessage,
            settingsMessage,
          ]
            .filter(Boolean)
            .join(" "),
          400
        );
      }
    }

    if (settings) {
      const normalizedSettings = normalizeSiteSettings(settings);
      const payload = {
        school_id: permission.schoolId,
        site_title: normalizedSettings.site_title,
        site_tagline: normalizedSettings.site_tagline,
        logo_url: normalizedSettings.logo_url,
        hero_background_url: normalizedSettings.hero_background_url,
        primary_color: normalizedSettings.primary_color,
        secondary_color: normalizedSettings.secondary_color,
        contact_email: normalizedSettings.contact_email,
        contact_phone: normalizedSettings.contact_phone,
        contact_address: normalizedSettings.contact_address,
        is_website_enabled: normalizedSettings.is_website_enabled,
      };

      const { error } = await supabase
        .from("website_site_settings")
        .upsert(payload, { onConflict: "school_id" });

      if (error) throw error;
    }

    if (page?.id) {
      const updates: Record<string, any> = {};
      if (typeof page.title === "string") updates.title = page.title;
      if (typeof page.status === "string") updates.status = page.status;
      if (typeof page.seo_title === "string") updates.seo_title = page.seo_title;
      if (typeof page.seo_description === "string") updates.seo_description = page.seo_description;
      if (page.status === "published") updates.published_at = new Date().toISOString();
      if (page.status === "draft") updates.published_at = null;

      if (Object.keys(updates).length > 0) {
        const { error } = await supabase
          .from("website_pages")
          .update(updates)
          .eq("id", page.id)
          .eq("school_id", permission.schoolId)
          .eq("slug", pageSlug);

        if (error) throw error;
      }
    }

    if (sections && sections.length > 0) {
      const updates = sections.map((section) => {
        const updatePayload: Record<string, any> = {
          is_visible: typeof section.is_visible === "boolean" ? section.is_visible : undefined,
          section_label: typeof section.section_label === "string" ? section.section_label : undefined,
          order_sequence:
            typeof section.order_sequence === "number" ? section.order_sequence : undefined,
          content: section.content,
        };

        Object.keys(updatePayload).forEach((key) => {
          if (updatePayload[key] === undefined) delete updatePayload[key];
        });

        return supabase
          .from("website_sections")
          .update(updatePayload)
          .eq("id", section.id)
          .eq("school_id", permission.schoolId);
      });

      const results = await Promise.all(updates);
      const firstError = results.find((result) => result.error)?.error;
      if (firstError) throw firstError;
    }

    return successResponse({ saved: true, pageSlug });
  } catch (error: any) {
    return errorResponse(error.message || "Failed to save website content", 500);
  }
}
