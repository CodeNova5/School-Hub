import type { SupabaseClient } from "@supabase/supabase-js";
import { PLATFORM_NAME } from "./email";

export async function resolveSchoolName(
  supabase: SupabaseClient,
  schoolId?: string | null
): Promise<string> {
  if (!schoolId) {
    return PLATFORM_NAME;
  }

  const { data } = await supabase
    .from("schools")
    .select("name")
    .eq("id", schoolId)
    .maybeSingle();

  return data?.name?.trim() || PLATFORM_NAME;
}
