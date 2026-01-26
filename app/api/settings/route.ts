import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

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
    const body = await req.json();
    const { school_name, school_address, school_email, school_phone, school_logo } = body;

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Update or insert settings
    const settingsToUpdate = [
      { key: "school_name", value: school_name || "" },
      { key: "school_address", value: school_address || "" },
      { key: "school_email", value: school_email || "" },
      { key: "school_phone", value: school_phone || "" },
      { key: "school_logo", value: school_logo || "" },
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
