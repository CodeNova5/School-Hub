import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { NextRequest } from "next/server";
import { cookies } from "next/headers";
import { errorResponse, successResponse } from "@/lib/api-helpers";

function deriveBillTotals(row: any) {
  const currentStatus = String(row?.status || "pending");

  if (currentStatus === "waived" || currentStatus === "cancelled") {
    return row;
  }

  const successfulTransactions = Array.isArray(row?.finance_transactions)
    ? row.finance_transactions.filter((tx: any) => tx?.status === "success")
    : [];

  const computedPaid = successfulTransactions.reduce(
    (sum: number, tx: any) => sum + Number(tx?.amount || 0),
    0
  );
  const totalAmount = Number(row?.total_amount || 0);
  const computedBalance = Math.max(0, totalAmount - computedPaid);

  let computedStatus = currentStatus;
  if (computedBalance <= 0 && totalAmount > 0) {
    computedStatus = "paid";
  } else if (computedPaid > 0) {
    computedStatus = "partial";
  } else {
    computedStatus = "pending";
  }

  return {
    ...row,
    amount_paid: computedPaid,
    balance_amount: computedBalance,
    status: computedStatus,
  };
}

export async function GET(_req: NextRequest) {
  const supabase = createRouteHandlerClient({ cookies });

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return errorResponse("Unauthorized", 401);
  }

  const { data: parent, error: parentError } = await supabase
    .from("parents")
    .select("email")
    .eq("user_id", user.id)
    .single();

  if (parentError || !parent) {
    return errorResponse("Parent profile not found", 404);
  }

  const { data: children, error: childError } = await supabase
    .from("students")
    .select("id, school_id, first_name, last_name, student_id")
    .eq("parent_email", parent.email);

  if (childError) {
    return errorResponse(childError.message, 500);
  }

  const childRows = children || [];
  const childIds = childRows.map((row) => row.id);

  if (childIds.length === 0) {
    return successResponse({
      children: [],
      summary: {
        totalDue: 0,
        totalPaid: 0,
        totalOutstanding: 0,
        billCount: 0,
      },
      bills: [],
    });
  }

  const schoolId = childRows[0].school_id;

  const { data: bills, error: billsError } = await supabase
    .from("finance_student_bills")
    .select(`
      *,
      students(first_name, last_name, student_id),
      finance_bill_items(*),
      finance_transactions(*),
      finance_receipts(*)
    `)
    .eq("school_id", schoolId)
    .in("student_id", childIds)
    .order("created_at", { ascending: false });

  if (billsError) {
    return errorResponse(billsError.message, 500);
  }

  const rows = (bills || []).map(deriveBillTotals);
  const totalDue = rows.reduce((sum, row) => sum + Number(row.total_amount || 0), 0);
  const totalPaid = rows.reduce((sum, row) => sum + Number(row.amount_paid || 0), 0);
  const totalOutstanding = rows.reduce((sum, row) => sum + Number(row.balance_amount || 0), 0);

  return successResponse({
    children: childRows,
    summary: {
      totalDue,
      totalPaid,
      totalOutstanding,
      billCount: rows.length,
    },
    bills: rows,
  });
}
