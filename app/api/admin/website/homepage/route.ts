import { NextRequest } from "next/server";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { checkIsAdminWithSchool, errorResponse, successResponse } from "@/lib/api-helpers";
import { WEBSITE_SECTION_TEMPLATES, type WebsiteSectionTemplate } from "@/lib/website-builder";

interface WebsiteSectionRow {
  id: string;
  school_id: string;
  page_id: string;
  section_key: WebsiteSectionTemplate["key"];
  section_label: string;
  is_visible: boolean;
  order_sequence: number;
  content: Record<string, any>;
}

async function ensureHomepage(supabase: any, schoolId: string) {
  let { data: page, error } = await supabase
    .from("website_pages")
    .select("*")
    .eq("school_id", schoolId)
    .eq("slug", "home")
    .maybeSingle();

  if (error) throw error;

  if (!page) {
    const created = await supabase
      .from("website_pages")
      .insert({
        school_id: schoolId,
        title: "Home",
        slug: "home",
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

  const existingKeys = new Set((sections || []).map((section: WebsiteSectionRow) => section.section_key));
  const missingTemplates = WEBSITE_SECTION_TEMPLATES.filter((template) => !existingKeys.has(template.key));

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

export async function GET() {
  const permission = await checkIsAdminWithSchool();
  if (!permission.authorized || !permission.schoolId) {
    return errorResponse(permission.error || "Unauthorized", permission.status || 401);
  }

  const supabase = createRouteHandlerClient({ cookies });

  try {
    const [{ data: settings, error: settingsError }, homepageResult, mediaResult] = await Promise.all([
      supabase
        .from("website_site_settings")
        .select("*")
        .eq("school_id", permission.schoolId)
        .maybeSingle(),
      ensureHomepage(supabase, permission.schoolId),
      supabase
        .from("website_media")
        .select("id, file_name, public_url, created_at, page_id")
        .eq("school_id", permission.schoolId)
        .order("created_at", { ascending: false })
        .limit(100),
    ]);

    if (settingsError) throw settingsError;
    if (mediaResult.error) throw mediaResult.error;

    return successResponse({
      settings: settings || null,
      page: homepageResult.page,
      sections: homepageResult.sections,
      media: mediaResult.data || [],
    });
  } catch (error: any) {
    return errorResponse(error.message || "Failed to load website builder", 500);
  }
}

export async function PATCH(req: NextRequest) {
  const permission = await checkIsAdminWithSchool();
  if (!permission.authorized || !permission.schoolId) {
    return errorResponse(permission.error || "Unauthorized", permission.status || 401);
  }

  const supabase = createRouteHandlerClient({ cookies });

  try {
    const body = await req.json();
    const { settings, page, sections } = body as {
      settings?: Record<string, any>;
      page?: Record<string, any>;
      sections?: Array<Partial<WebsiteSectionRow> & { id: string }>;
    };

    if (settings) {
      const payload = {
        school_id: permission.schoolId,
        site_title: settings.site_title || "School Website",
        site_tagline: settings.site_tagline || "",
        logo_url: settings.logo_url || "",
        hero_background_url: settings.hero_background_url || "",
        primary_color: settings.primary_color || "#1e3a8a",
        secondary_color: settings.secondary_color || "#059669",
        contact_email: settings.contact_email || "",
        contact_phone: settings.contact_phone || "",
        contact_address: settings.contact_address || "",
        is_website_enabled: settings.is_website_enabled ?? true,
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
          .eq("school_id", permission.schoolId);

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

    return successResponse({ saved: true });
  } catch (error: any) {
    return errorResponse(error.message || "Failed to save website content", 500);
  }
}
