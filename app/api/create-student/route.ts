import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY! // MUST BE SERVICE KEY
);

export async function POST(req:any) {
    const body = await req.json();
    const { email, student_id } = body;

    const { data, error } = await supabase.auth.admin.createUser({
        email,
        email_confirm: false,
        user_metadata: {
            role: "student",
            student_id,
        },
    });

    if (error) return NextResponse.json({ error }, { status: 400 });

    // Send invite email
    await supabase.auth.admin.generateLink({
        type: "invite",
        email,
    });

    return NextResponse.json({ success: true });
}
