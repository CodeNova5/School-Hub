// ── Finance Types (extracted from app/admin/finance/page.tsx) ─────────────

export interface FinanceOverview {
  stats: {
    totalDue: number;
    totalCollected: number;
    totalOutstanding: number;
    overdueCount: number;
    totalBills: number;
    paidCount: number;
    partialCount: number;
  };
  recentTransactions: FinanceTransactionRow[];
  outstandingByClass: Array<{ className: string; outstanding: number }>;
}

export interface FinanceSettings {
  paystack_subaccount_code?: string | null;
  enable_paystack_checkout?: boolean;
  default_currency?: string;
  invoice_prefix?: string;
  receipt_prefix?: string;
}

export interface ClassAmount {
  class_id: string;
  class_amount: number;
  classes?: { name?: string };
}

export interface FeeTemplate {
  id: string;
  name: string;
  category: string;
  frequency: string;
  amount: number;
  is_active: boolean;
  finance_fee_template_classes?: ClassAmount[];
}

export interface FinanceBill {
  id: string;
  student_id: string;
  status: string;
  total_amount: number;
  amount_paid: number;
  balance_amount: number;
  due_date?: string;
  students?: { first_name?: string; last_name?: string; student_id?: string };
  finance_bill_items?: Array<{ title: string; amount: number; frequency: string }>;
}

export interface FinanceTransactionRow {
  id: string;
  reference: string;
  amount: number;
  status: string;
  payment_method: string;
  created_at: string;
  students?: { first_name?: string; last_name?: string; student_id?: string };
}

export interface FinanceReceipt {
  id: string;
  receipt_number: string;
  issued_at: string;
  students?: { first_name?: string; last_name?: string; student_id?: string };
  finance_transactions?: { amount?: number; payment_method?: string; reference?: string };
}

export interface StudentOption {
  id: string;
  student_id: string;
  first_name: string;
  last_name: string;
  class_id?: string;
}

export interface ClassOption {
  id: string;
  name: string;
}

export interface SubaccountForm {
  businessName: string;
  settlementBank: string;
  accountNumber: string;
}
