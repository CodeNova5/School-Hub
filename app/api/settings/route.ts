import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { uploadFile, fileToBase64 } from "@/lib/github";

export async function GET(req: Request) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    const { data, error } = await supabase
      .from("school_settings")
      .select("key, value");

    if (error) {
      return NextResponse.json(
        { error: "Failed to fetch settings" },
        { status: 400 }
      );
    }

    // Convert array to object for easier access
    const settings: Record<string, string> = {};
    data.forEach((setting: any) => {
      settings[setting.key] = setting.value;
    });

    return NextResponse.json(settings);
  } catch (error) {
    console.error("Error fetching settings:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const form = await req.formData();
    const school_name = form.get("school_name") as string;
    const school_address = form.get("school_address") as string;
    const school_email = form.get("school_email") as string;
    const school_phone = form.get("school_phone") as string;
    const logoFile = form.get("school_logo") as File | null;

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    let school_logo = "";

    // Upload logo to GitHub if provided
    if (logoFile && logoFile.size > 0) {
      const base64Content = await fileToBase64(logoFile);
      school_logo = await uploadFile({
        path: `school/logo.jpg`,
        content: base64Content,
        commitMessage: "Upload school logo",
      });
    }

    // Update or insert settings
    const settingsToUpdate = [
      { key: "school_name", value: school_name || "" },
      { key: "school_address", value: school_address || "" },
      { key: "school_email", value: school_email || "" },
      { key: "school_phone", value: school_phone || "" },
      ...(school_logo ? [{ key: "school_logo", value: school_logo }] : []),
    ];

    for (const setting of settingsToUpdate) {
      const { error } = await supabase
        .from("school_settings")
        .upsert(
          { key: setting.key, value: setting.value, updated_at: new Date().toISOString() },
          { onConflict: "key" }
        );

      if (error) {
        console.error(`Error updating ${setting.key}:`, error);
        return NextResponse.json(
          { error: `Failed to update ${setting.key}` },
          { status: 400 }
        );
      }
    }

    return NextResponse.json({ success: true, message: "Settings updated successfully" });
  } catch (error) {
    console.error("Error updating settings:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
