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

  if (computedPaid > 0 || computedStatus !== currentStatus) {
    console.log(`[Bill ${row.id}] Derived totals:`, {
      successfulTxCount: successfulTransactions.length,
      oldAmount: row.amount_paid,
      newAmount: computedPaid,
      oldBalance: row.balance_amount,
      newBalance: computedBalance,
      oldStatus: currentStatus,
      newStatus: computedStatus,
    });
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

  const { data: student, error: studentError } = await supabase
    .from("students")
    .select("id, school_id, first_name, last_name, student_id")
    .eq("user_id", user.id)
    .single();

  if (studentError || !student) {
    return errorResponse("Student profile not found", 404);
  }

  const { data: bills, error } = await supabase
    .from("finance_student_bills")
    .select(`
      *,
      finance_bill_items(*),
      finance_transactions(*),
      finance_receipts(*)
    `)
    .eq("school_id", student.school_id)
    .eq("student_id", student.id)
    .order("created_at", { ascending: false });

  if (error) {
    return errorResponse(error.message, 500);
  }

  console.log(`[Statement] Fetched ${bills?.length || 0} bills for student ${student.id}`);
  if (bills && bills.length > 0) {
    bills.forEach((bill: any) => {
      console.log(`[Statement] Bill ${bill.id}:`, {
        status: bill.status,
        total: bill.total_amount,
        paid: bill.amount_paid,
        balance: bill.balance_amount,
        transactions: Array.isArray(bill.finance_transactions) ? bill.finance_transactions.map((tx: any) => ({
          id: tx.id,
          status: tx.status,
          amount: tx.amount,
        })) : [],
      });
    });
  }

  const rows = (bills || []).map(deriveBillTotals);
  const totalDue = rows.reduce((sum, row) => sum + Number(row.total_amount || 0), 0);
  const totalPaid = rows.reduce((sum, row) => sum + Number(row.amount_paid || 0), 0);
  const totalOutstanding = rows.reduce((sum, row) => sum + Number(row.balance_amount || 0), 0);

  return successResponse({
    student,
    summary: {
      totalDue,
      totalPaid,
      totalOutstanding,
      billCount: rows.length,
    },
    bills: rows,
  });
}
