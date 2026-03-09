import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";

/**
 * Get the current admin's school_id using the get_my_school_id() RPC function.
 * This looks up the admin's school_id from the admins table or user_role_links.
 */
export async function getAdminSchoolId() {
  const supabase = createRouteHandlerClient({ cookies });

  try {
    // Use the RPC function from the database migration
    const { data: schoolId, error } = await supabase.rpc("get_my_school_id");

    if (error) {
      throw new Error(error.message);
    }

    if (!schoolId) {
      throw new Error("Unable to determine school - user may not be assigned to a school");
    }

    return schoolId;
  } catch (error: any) {
    throw new Error(`Failed to get school context: ${error.message}`);
  }
}

/**
 * Check if user is admin and get their school_id.
 * Returns { authorized: boolean, schoolId?: string, error?: string }
 */
export async function checkIsAdminWithSchool() {
  const supabase = createRouteHandlerClient({ cookies });

  try {
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

    // Get school_id using RPC function
    const schoolId = await getAdminSchoolId();

    return { authorized: true, schoolId };
  } catch (error: any) {
    return {
      authorized: false,
      error: error.message,
      status: 400,
    };
  }
}

/**
 * Error response helper
 */
export function errorResponse(message: string, status: number = 500) {
  return NextResponse.json({ error: message }, { status });
}

/**
 * Success response helper
 */
export function successResponse(data: any, status: number = 200) {
  return NextResponse.json({ success: true, data }, { status });
}

/**
 * Check if user is a student and get their school_id and user_id.
 * Returns { authorized: boolean, userId?: string, schoolId?: string, error?: string, status?: number }
 */
export async function getStudentContext() {
  const supabase = createRouteHandlerClient({ cookies });

  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { authorized: false, error: "Unauthorized", status: 401 };
    }

    // Get student's school_id from students table
    const { data: student, error: studentError } = await supabase
      .from('students')
      .select('school_id')
      .eq('user_id', user.id)
      .single();

    if (studentError || !student) {
      return { authorized: false, error: "Student record not found", status: 404 };
    }

    return {
      authorized: true,
      userId: user.id,
      schoolId: student.school_id,
    };
  } catch (error: any) {
    return {
      authorized: false,
      error: error.message,
      status: 400,
    };
  }
}
