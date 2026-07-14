import { createServerSupabaseClient } from "@/lib/supabase-server";
import { NextRequest } from "next/server";
import { checkIsAdminWithSchool, errorResponse, successResponse } from "@/lib/api-helpers";

interface BulkBillPayload {
  classId: string;
  feeTemplateId?: string;
  dueDate?: string;
  billingCycle: "per_term" | "per_session" | "one_time";
  amount?: number; // optional override
}

export async function POST(req: NextRequest) {
  const permission = await checkIsAdminWithSchool();
  if (!permission.authorized || !permission.schoolId) {
    return errorResponse(permission.error || "Unauthorized", permission.status || 401);
  }

  const body = (await req.json()) as BulkBillPayload;
  if (!body.classId || !body.billingCycle) {
    return errorResponse("Class ID and billing cycle are required", 400);
  }

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // 1. Fetch all active students in this class
  const { data: students, error: studentsError } = await supabase
    .from("students")
    .select("id, student_id, first_name, last_name, class_id")
    .eq("school_id", permission.schoolId)
    .eq("class_id", body.classId)
    .eq("status", "active");

  if (studentsError) {
    return errorResponse(studentsError.message, 500);
  }

  if (!students || students.length === 0) {
    return errorResponse("No active students found in this class", 404);
  }

  // 2. Resolve fee template pricing
  let feeTitle = "Tuition Fee";
  let feeAmount = body.amount || 0;
  let feeFrequency = body.billingCycle;
  let feeTemplateId: string | null = body.feeTemplateId || null;

  if (body.feeTemplateId) {
    const { data: feeTemplate } = await supabase
      .from("finance_fee_templates")
      .select("id, name, amount, frequency, finance_fee_template_classes(class_id, class_amount)")
      .eq("id", body.feeTemplateId)
      .eq("school_id", permission.schoolId)
      .single();

    if (feeTemplate) {
      feeTitle = feeTemplate.name;
      feeFrequency = feeTemplate.frequency || body.billingCycle;

      // Check for per-class pricing override
      const classOverride = (feeTemplate.finance_fee_template_classes || []).find(
        (c: any) => c.class_id === body.classId
      );
      if (classOverride) {
        feeAmount = Number(classOverride.class_amount);
      } else {
        feeAmount = Number(feeTemplate.amount);
      }
    }
  }

  if (feeAmount <= 0) {
    return errorResponse(
      body.feeTemplateId
        ? "Fee template has no valid amount for this class"
        : "An amount is required to create bills",
      400
    );
  }

  // 3. Check for existing bills to avoid duplicates
  const { data: existingBills } = await supabase
    .from("finance_student_bills")
    .select("student_id, billing_cycle")
    .eq("school_id", permission.schoolId)
    .eq("class_id", body.classId)
    .eq("billing_cycle", body.billingCycle)
    .in("status", ["pending", "partial", "overdue"]);

  const existingStudentIds = new Set((existingBills || []).map((b: any) => b.student_id));

  const studentsToBill = students.filter((s) => !existingStudentIds.has(s.id));
  const skippedCount = students.length - studentsToBill.length;

  if (studentsToBill.length === 0) {
    return successResponse({
      created: 0,
      skipped: skippedCount,
      message: `All ${students.length} student(s) in this class already have active bills for this cycle.`,
    });
  }

  // 4. Create bills
  const billRows = studentsToBill.map((student) => ({
    school_id: permission.schoolId,
    student_id: student.id,
    class_id: body.classId,
    due_date: body.dueDate || null,
    billing_cycle: body.billingCycle,
    created_by: user?.id || null,
    status: "pending",
    total_amount: feeAmount,
    amount_paid: 0,
    balance_amount: feeAmount,
  }));

  const { data: createdBills, error: billError } = await supabase
    .from("finance_student_bills")
    .insert(billRows)
    .select("id");

  if (billError) {
    return errorResponse(billError.message, 500);
  }

  // 5. Create bill items
  if (createdBills && createdBills.length > 0) {
    const itemRows = createdBills.map((bill: any) => ({
      school_id: permission.schoolId,
      bill_id: bill.id,
      fee_template_id: feeTemplateId,
      title: feeTitle,
      frequency: feeFrequency,
      original_amount: feeAmount,
      amount: feeAmount,
      override_type: "none" as const,
      notes: `Auto-created from class billing`,
    }));

    const { error: itemError } = await supabase
      .from("finance_bill_items")
      .insert(itemRows);

    if (itemError) {
      return errorResponse(itemError.message, 500);
    }
  }

  return successResponse(
    {
      created: createdBills?.length || 0,
      skipped: skippedCount,
      message: `Created bills for ${createdBills?.length || 0} student(s)${
        skippedCount > 0 ? ` (${skippedCount} already had active bills)` : ""
      }.`,
    },
    201
  );
}
