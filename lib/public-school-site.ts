import { createClient } from "@supabase/supabase-js";

export interface PublicSiteSettings {
  site_title: string;
  site_tagline: string;
  logo_url: string;
  primary_color: string;
  secondary_color: string;
  contact_email: string;
  contact_phone: string;
}

export interface PublicSchoolRecord {
  id: string;
  name: string;
  is_active: boolean;
  subdomain: string | null;
}

export const PUBLIC_SITE_DEFAULTS: PublicSiteSettings = {
  site_title: "School Website",
  site_tagline: "Excellence in education",
  logo_url: "",
  primary_color: "#1e3a8a",
  secondary_color: "#059669",
  contact_email: "",
  contact_phone: "",
};

export function getPublicSupabaseAnonClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new Error("Supabase public env vars are required for public website rendering");
  }

  return createClient(url, key);
}

export async function resolveSchoolBySubdomain(subdomain: string) {
  const supabase = getPublicSupabaseAnonClient();
  const { data, error } = await supabase.rpc("get_school_by_subdomain", { p_subdomain: subdomain });
  if (error) throw error;
  const school = Array.isArray(data) ? data[0] : data;
  return (school as PublicSchoolRecord | null) || null;
}

export async function getPublicSiteSettings(schoolId: string): Promise<PublicSiteSettings> {
  const supabase = getPublicSupabaseAnonClient();
  const { data } = await supabase
    .from("website_site_settings")
    .select("site_title, site_tagline, logo_url, primary_color, secondary_color, contact_email, contact_phone")
    .eq("school_id", schoolId)
    .maybeSingle();

  return {
    site_title: data?.site_title || PUBLIC_SITE_DEFAULTS.site_title,
    site_tagline: data?.site_tagline || PUBLIC_SITE_DEFAULTS.site_tagline,
    logo_url: data?.logo_url || PUBLIC_SITE_DEFAULTS.logo_url,
    primary_color: data?.primary_color || PUBLIC_SITE_DEFAULTS.primary_color,
    secondary_color: data?.secondary_color || PUBLIC_SITE_DEFAULTS.secondary_color,
    contact_email: data?.contact_email || PUBLIC_SITE_DEFAULTS.contact_email,
    contact_phone: data?.contact_phone || PUBLIC_SITE_DEFAULTS.contact_phone,
  };
}

export function extractSubdomainFromHost(hostname: string) {
  const host = hostname.split(":")[0].toLowerCase();
  const parts = host.split(".");

  if (host.includes("localhost")) {
    return parts.length > 1 ? parts[0] : null;
  }

  return parts.length >= 3 ? parts[0] : null;
}
