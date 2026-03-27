import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { NextRequest } from "next/server";
import { cookies } from "next/headers";
import { checkIsAdminWithSchool, errorResponse, successResponse } from "@/lib/api-helpers";

interface FeeClassAmountInput {
  classId: string;
  amount: number;
}

interface CreateFeePayload {
  name: string;
  category: "tuition" | "uniform" | "exam" | "bus" | "custom";
  frequency: "per_term" | "per_session" | "one_time";
  amount: number;
  description?: string;
  isActive?: boolean;
  classAmounts?: FeeClassAmountInput[];
}

export async function GET(_req: NextRequest) {
  const permission = await checkIsAdminWithSchool();
  if (!permission.authorized || !permission.schoolId) {
    return errorResponse(permission.error || "Unauthorized", permission.status || 401);
  }

  const supabase = createRouteHandlerClient({ cookies });

  const { data, error } = await supabase
    .from("finance_fee_templates")
    .select(`
      *,
      finance_fee_template_classes(
        class_id,
        class_amount,
        classes(name)
      )
    `)
    .eq("school_id", permission.schoolId)
    .order("created_at", { ascending: false });

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

  const body = (await req.json()) as CreateFeePayload;

  if (!body.name || !body.category || !body.frequency || typeof body.amount !== "number") {
    return errorResponse("Missing required fee fields", 400);
  }

  const supabase = createRouteHandlerClient({ cookies });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const feePayload = {
    school_id: permission.schoolId,
    name: body.name.trim(),
    category: body.category,
    frequency: body.frequency,
    amount: body.amount,
    description: body.description || "",
    is_active: body.isActive ?? true,
    created_by: user?.id || null,
  };

  const { data: fee, error: feeError } = await supabase
    .from("finance_fee_templates")
    .insert(feePayload)
    .select("*")
    .single();

  if (feeError || !fee) {
    return errorResponse(feeError?.message || "Failed to create fee template", 500);
  }

  const classAmounts = body.classAmounts || [];
  if (classAmounts.length > 0) {
    const rows = classAmounts.map((entry) => ({
      school_id: permission.schoolId,
      fee_template_id: fee.id,
      class_id: entry.classId,
      class_amount: entry.amount,
    }));

    const { error: classError } = await supabase
      .from("finance_fee_template_classes")
      .insert(rows);

    if (classError) {
      return errorResponse(classError.message, 500);
    }
  }

  return successResponse(fee, 201);
}

export async function PATCH(req: NextRequest) {
  const permission = await checkIsAdminWithSchool();
  if (!permission.authorized || !permission.schoolId) {
    return errorResponse(permission.error || "Unauthorized", permission.status || 401);
  }

  const body = (await req.json()) as Partial<CreateFeePayload> & { id?: string };
  if (!body.id) {
    return errorResponse("Fee template id is required", 400);
  }

  const supabase = createRouteHandlerClient({ cookies });

  const updates = {
    ...(body.name ? { name: body.name.trim() } : {}),
    ...(body.category ? { category: body.category } : {}),
    ...(body.frequency ? { frequency: body.frequency } : {}),
    ...(typeof body.amount === "number" ? { amount: body.amount } : {}),
    ...(body.description !== undefined ? { description: body.description } : {}),
    ...(typeof body.isActive === "boolean" ? { is_active: body.isActive } : {}),
  };

  const { data, error } = await supabase
    .from("finance_fee_templates")
    .update(updates)
    .eq("id", body.id)
    .eq("school_id", permission.schoolId)
    .select("*")
    .single();

  if (error) {
    return errorResponse(error.message, 500);
  }

  if (body.classAmounts) {
    const { error: deleteError } = await supabase
      .from("finance_fee_template_classes")
      .delete()
      .eq("fee_template_id", body.id)
      .eq("school_id", permission.schoolId);

    if (deleteError) {
      return errorResponse(deleteError.message, 500);
    }

    if (body.classAmounts.length > 0) {
      const rows = body.classAmounts.map((entry) => ({
        school_id: permission.schoolId,
        fee_template_id: body.id,
        class_id: entry.classId,
        class_amount: entry.amount,
      }));

      const { error: insertError } = await supabase
        .from("finance_fee_template_classes")
        .insert(rows);

      if (insertError) {
        return errorResponse(insertError.message, 500);
      }
    }
  }

  return successResponse(data);
}
