// ── Types ─────────────────────────────────────────────────────────────────

export interface Subscription {
  id: string;
  school_id: string;
  plan_id: string;
  billing_interval: "termly" | "yearly";
  status: "active" | "past_due" | "cancelled" | "expired" | "trialing";
  current_period_start: string | null;
  current_period_end: string | null;
  next_billing_date: string | null;
  grace_period_ends_at: string | null;
  auth_code: string | null;
  customer_email: string | null;
  customer_code: string | null;
  current_term_id: string | null;
  plan_key: string;
  plan_name: string;
  monthly_price: number;
  yearly_price: number;
  termly_price: number;
}

export interface School {
  plan: string;
  name: string;
}

export interface Plan {
  id: string;
  plan_key: string;
  name: string;
  description: string;
  termly_price: number;
  yearly_price: number;
  monthly_price: number;
  features: any[];
}

export interface Transaction {
  id: string;
  school_id: string;
  plan_id: string;
  billing_interval: string;
  reference: string;
  amount: number;
  status: "pending" | "success" | "failed" | "abandoned";
  auth_code: string | null;
  paid_at: string | null;
  metadata: any;
  created_at: string;
}

export interface StatusResult {
  status: string;
  should_degrade: boolean;
  degrade_reason: string;
  grace_period_ends_at: string | null;
}

export interface NextTermInfo {
  id: string;
  name: string;
  session_name: string;
  start_date: string;
  end_date: string;
  weeks: number;
}

export interface CurrentTermInfo {
  id: string;
  name: string;
  session_name: string;
  start_date: string;
  end_date: string;
  is_current: boolean;
  weeks: number;
  next_term?: NextTermInfo | null;
}

export interface YearlyCoveredTerm {
  id: string;
  name: string;
  session_name: string;
  start_date: string;
  end_date: string;
  weeks: number;
}

export interface UpcomingTerm {
  id: string;
  name: string;
  session_name: string;
  start_date: string;
  end_date: string;
  weeks: number;
}

export interface TermWithStatus extends UpcomingTerm {
  is_current: boolean;
  status: "paid" | "past" | "unpaid";
}

export interface TermsBySessionGroup {
  session_name: string;
  terms: TermWithStatus[];
}

export interface ActiveGrant {
  id: string;
  school_id: string;
  school_name: string;
  plan_key: string;
  grant_type: "term" | "session" | "custom";
  start_date: string;
  end_date: string;
  include_holidays: boolean;
  notes: string;
  granted_by_name: string;
  is_active: boolean;
  expires_at: string;
  created_at: string;
  term_name: string | null;
  session_name: string | null;
}

export interface ApiResponse {
  subscription: Subscription | null;
  school: School | null;
  plans: Plan[];
  transactions: Transaction[];
  status: StatusResult | null;
  current_term: CurrentTermInfo | null;
  yearly_covered_terms: YearlyCoveredTerm[] | null;
  upcoming_terms: UpcomingTerm[] | null;
  terms_by_session: TermsBySessionGroup[];
  active_grants: ActiveGrant[] | null;
}
