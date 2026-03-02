import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);


// Middleware to check if user is admin
async function checkIsAdmin(supabase: any) {
    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
        return { authorized: false, error: "Unauthorized", status: 401 };
    }

    const { data: isAdmin } = await supabase.rpc("is_admin");

    if (!isAdmin) {
        return { authorized: false, error: "Forbidden", status: 403 };
    }

    return { authorized: true };
}


export async function GET(req: Request) {
    try {
        // Initialize Supabase client inside the request handler
        const supabase = createRouteHandlerClient({ cookies });

        // Verify admin authentication
        const authCheck = await checkIsAdmin(supabase);
        if (!authCheck.authorized) {
            return NextResponse.json(
                { error: authCheck.error },
                { status: authCheck.status }
            );
        }

        const { searchParams } = new URL(req.url);
        const status = searchParams.get("status") || "all";

        // Build query - scoped to the admin's school
        const { data: schoolId } = await supabase.rpc("get_my_school_id");

        let query = supabaseAdmin
            .from("admissions")
            .select("*")
            .order("submitted_at", { ascending: false });

        if (schoolId) {
            query = query.eq("school_id", schoolId);
        }

        // Filter by status if not "all"
        if (status !== "all") {
            query = query.eq("status", status);
        }

        const { data: applications, error } = await query;

        if (error) throw error;

        return NextResponse.json({
            success: true,
            applications,
        });
    } catch (error: any) {
        console.error("Error fetching applications:", error);
        return NextResponse.json(
            { error: error.message || "Failed to fetch applications" },
            { status: 500 }
        );
    }
}