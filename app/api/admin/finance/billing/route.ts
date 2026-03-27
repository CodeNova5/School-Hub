import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { NextRequest } from "next/server";
import { cookies } from "next/headers";
import { checkIsAdminWithSchool, errorResponse, successResponse } from "@/lib/api-helpers";

interface BillItemInput {
  feeTemplateId?: string;
  title: string;
  frequency: "per_term" | "per_session" | "one_time";
  amount: number;
  originalAmount?: number;
  overrideType?: "none" | "discount" | "waiver" | "custom";
  notes?: string;
}

interface CreateBillPayload {
  studentId: string;
  classId?: string;
  sessionId?: string;
  termId?: string;
  dueDate?: string;
  billingCycle: "per_term" | "per_session" | "one_time";
  items: BillItemInput[];
}

export async function GET(req: NextRequest) {
  const permission = await checkIsAdminWithSchool();
  if (!permission.authorized || !permission.schoolId) {
    return errorResponse(permission.error || "Unauthorized", permission.status || 401);
  }

  const searchParams = req.nextUrl.searchParams;
  const status = searchParams.get("status");
  const studentId = searchParams.get("studentId");

  const supabase = createRouteHandlerClient({ cookies });

  let query = supabase
    .from("finance_student_bills")
    .select(`
      *,
      students(first_name, last_name, student_id),
      classes(name),
      finance_bill_items(*)
    `)
    .eq("school_id", permission.schoolId)
    .order("created_at", { ascending: false })
    .limit(100);

  if (status) {
    query = query.eq("status", status);
  }

  if (studentId) {
    query = query.eq("student_id", studentId);
  }

  const { data, error } = await query;
  if (error) {
    return errorResponse(error.message, 500);
  }

  return successResponse(data || []);
}

export async function POST(req: NextRequest) {
  const permission = await checkIsAdminWithSchool();
  if (!permission.authorized || !permission.schoolId) {
    return errorResponse(permission.error || "Unauthorized", permission.status || 401);
  }

  const body = (await req.json()) as CreateBillPayload;
  if (!body.studentId || !body.billingCycle || !Array.isArray(body.items) || body.items.length === 0) {
    return errorResponse("Missing billing payload fields", 400);
  }

  const supabase = createRouteHandlerClient({ cookies });
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: bill, error: billError } = await supabase
    .from("finance_student_bills")
    .insert({
      school_id: permission.schoolId,
      student_id: body.studentId,
      class_id: body.classId || null,
      session_id: body.sessionId || null,
      term_id: body.termId || null,
      due_date: body.dueDate || null,
      billing_cycle: body.billingCycle,
      created_by: user?.id || null,
    })
    .select("*")
    .single();

  if (billError || !bill) {
    return errorResponse(billError?.message || "Failed to create bill", 500);
  }

  const itemRows = body.items.map((item) => ({
    school_id: permission.schoolId,
    bill_id: bill.id,
    fee_template_id: item.feeTemplateId || null,
    title: item.title,
    frequency: item.frequency,
    original_amount: item.originalAmount ?? item.amount,
    amount: item.amount,
    override_type: item.overrideType || "none",
    notes: item.notes || "",
  }));

  const { error: itemError } = await supabase
    .from("finance_bill_items")
    .insert(itemRows);

  if (itemError) {
    return errorResponse(itemError.message, 500);
  }

  const { data: finalBill, error: finalError } = await supabase
    .from("finance_student_bills")
    .select(`
      *,
      students(first_name, last_name, student_id),
      finance_bill_items(*)
    `)
    .eq("id", bill.id)
    .single();

  if (finalError) {
    return errorResponse(finalError.message, 500);
  }

  return successResponse(finalBill, 201);
}
