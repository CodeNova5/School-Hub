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
    let form: FormData | null = null;
    let body: Record<string, any> = {};

    const contentType = req.headers.get("content-type") || "";

    if (contentType.includes("multipart/form-data")) {
      form = await req.formData();
    } else if (contentType.includes("application/json")) {
      body = await req.json();
    } else {
      return NextResponse.json(
        { error: "Unsupported Content-Type" },
        { status: 400 }
      );
    }

    const school_name = form?.get("school_name") || body.school_name;
    const school_address = form?.get("school_address") || body.school_address;
    const school_email = form?.get("school_email") || body.school_email;
    const school_phone = form?.get("school_phone") || body.school_phone;
    const logoFile = form?.get("school_logo") as File | null;
    const signatureFile = form?.get("principal_signature") as File | null;
    const existingLogoUrl = form?.get("school_logo_url") || body.school_logo_url;
    const existingSignatureUrl = form?.get("principal_signature_url") || body.principal_signature_url;

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    let school_logo = existingLogoUrl || "";
    let principal_signature = existingSignatureUrl || "";

    console.log("Content-Type:", contentType);
    if (logoFile) {
      console.log("Logo file details:", {
        name: logoFile.name,
        size: logoFile.size,
        type: logoFile.type,
      });
    } else {
      console.log("No logo file provided. Using existing URL if available.");
    }

    // Upload logo to GitHub if new file provided
    if (logoFile && logoFile.size > 0) {
      try {
        const base64Content = await fileToBase64(logoFile);
        school_logo = await uploadFile({
          path: `school/logo.jpeg`,
          content: base64Content,
          commitMessage: "Upload school logo",
        });
        console.log("Logo uploaded successfully. URL:", school_logo);
      } catch (uploadError) {
        console.error("Error uploading logo to GitHub:", uploadError);
      }
    }

    // Upload principal signature to GitHub if new file provided
    if (signatureFile && signatureFile.size > 0) {
      try {
        const base64Content = await fileToBase64(signatureFile);
        principal_signature = await uploadFile({
          path: `school/principal_signature.jpeg`,
          content: base64Content,
          commitMessage: "Upload principal signature",
        });
        console.log("Principal signature uploaded successfully. URL:", principal_signature);
      } catch (uploadError) {
        console.error("Error uploading principal signature to GitHub:", uploadError);
      }
    }

    // Update or insert settings
    const settingsToUpdate = [
      { key: "school_name", value: school_name || "" },
      { key: "school_address", value: school_address || "" },
      { key: "school_email", value: school_email || "" },
      { key: "school_phone", value: school_phone || "" },
      ...(school_logo && school_logo.trim() ? [{ key: "school_logo", value: school_logo }] : []),
      ...(principal_signature && principal_signature.trim() ? [{ key: "principal_signature", value: principal_signature }] : []),
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
