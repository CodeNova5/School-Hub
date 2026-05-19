-- =============================================================================
-- Finance And JAMB Structure (SQL)
-- Source: supabase/structure/03-finance-and-jamb.md
-- Depends on: 00-core-and-tenancy.sql and 01-academics-and-assessment.sql
-- Notes:
--   - Includes permanent table/function/RLS definitions for finance + JAMB.
--   - Excludes reset/backfill-only history scripts as canonical schema.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- FINANCE MODULE FOUNDATION
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS finance_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  paystack_subaccount_code text,
  enable_paystack_checkout boolean NOT NULL DEFAULT true,
  default_currency text NOT NULL DEFAULT 'NGN',
  invoice_prefix text NOT NULL DEFAULT 'INV',
  receipt_prefix text NOT NULL DEFAULT 'RCP',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(school_id)
);

CREATE INDEX IF NOT EXISTS idx_finance_settings_school_id ON finance_settings(school_id);

CREATE TABLE IF NOT EXISTS finance_fee_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  name text NOT NULL,
  category text NOT NULL CHECK (category IN ('tuition', 'uniform', 'exam', 'bus', 'custom')),
  frequency text NOT NULL CHECK (frequency IN ('per_term', 'per_session', 'one_time')),
  amount numeric(12,2) NOT NULL CHECK (amount >= 0),
  description text DEFAULT '',
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(school_id, name, category, frequency)
);

CREATE INDEX IF NOT EXISTS idx_finance_fee_templates_school_id ON finance_fee_templates(school_id);
CREATE INDEX IF NOT EXISTS idx_finance_fee_templates_active ON finance_fee_templates(school_id, is_active);

CREATE TABLE IF NOT EXISTS finance_fee_template_classes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  fee_template_id uuid NOT NULL REFERENCES finance_fee_templates(id) ON DELETE CASCADE,
  class_id uuid NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  class_amount numeric(12,2) NOT NULL CHECK (class_amount >= 0),
  created_at timestamptz DEFAULT now(),
  UNIQUE(fee_template_id, class_id)
);

CREATE INDEX IF NOT EXISTS idx_finance_fee_template_classes_school_id ON finance_fee_template_classes(school_id);
CREATE INDEX IF NOT EXISTS idx_finance_fee_template_classes_class_id ON finance_fee_template_classes(class_id);

CREATE TABLE IF NOT EXISTS finance_student_bills (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  class_id uuid REFERENCES classes(id) ON DELETE SET NULL,
  session_id uuid REFERENCES sessions(id) ON DELETE SET NULL,
  term_id uuid REFERENCES terms(id) ON DELETE SET NULL,
  billing_cycle text NOT NULL CHECK (billing_cycle IN ('per_term', 'per_session', 'one_time')),
  due_date date,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'partial', 'paid', 'waived', 'overdue', 'cancelled')),
  total_amount numeric(12,2) NOT NULL DEFAULT 0 CHECK (total_amount >= 0),
  amount_paid numeric(12,2) NOT NULL DEFAULT 0 CHECK (amount_paid >= 0),
  balance_amount numeric(12,2) NOT NULL DEFAULT 0 CHECK (balance_amount >= 0),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_finance_student_bills_school_id ON finance_student_bills(school_id);
CREATE INDEX IF NOT EXISTS idx_finance_student_bills_student_id ON finance_student_bills(school_id, student_id);
CREATE INDEX IF NOT EXISTS idx_finance_student_bills_status ON finance_student_bills(school_id, status);
CREATE INDEX IF NOT EXISTS idx_finance_student_bills_cycle ON finance_student_bills(school_id, session_id, term_id);

CREATE TABLE IF NOT EXISTS finance_bill_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  bill_id uuid NOT NULL REFERENCES finance_student_bills(id) ON DELETE CASCADE,
  fee_template_id uuid REFERENCES finance_fee_templates(id) ON DELETE SET NULL,
  title text NOT NULL,
  frequency text NOT NULL CHECK (frequency IN ('per_term', 'per_session', 'one_time')),
  original_amount numeric(12,2) NOT NULL CHECK (original_amount >= 0),
  amount numeric(12,2) NOT NULL CHECK (amount >= 0),
  override_type text NOT NULL DEFAULT 'none' CHECK (override_type IN ('none', 'discount', 'waiver', 'custom')),
  notes text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_finance_bill_items_school_id ON finance_bill_items(school_id);
CREATE INDEX IF NOT EXISTS idx_finance_bill_items_bill_id ON finance_bill_items(bill_id);

CREATE TABLE IF NOT EXISTS finance_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  bill_id uuid NOT NULL REFERENCES finance_student_bills(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  reference text NOT NULL,
  provider text NOT NULL DEFAULT 'manual' CHECK (provider IN ('paystack', 'manual')),
  payment_method text NOT NULL CHECK (payment_method IN ('paystack', 'bank_transfer', 'cash', 'card', 'manual')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'success', 'failed', 'abandoned', 'reversed')),
  amount numeric(12,2) NOT NULL CHECK (amount > 0),
  paid_at timestamptz,
  provider_reference text,
  idempotency_key text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(school_id, reference),
  UNIQUE(school_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_finance_transactions_school_id ON finance_transactions(school_id);
CREATE INDEX IF NOT EXISTS idx_finance_transactions_bill_id ON finance_transactions(bill_id);
CREATE INDEX IF NOT EXISTS idx_finance_transactions_student_id ON finance_transactions(school_id, student_id);
CREATE INDEX IF NOT EXISTS idx_finance_transactions_status ON finance_transactions(school_id, status);
CREATE INDEX IF NOT EXISTS idx_finance_transactions_created_at ON finance_transactions(school_id, created_at DESC);

CREATE TABLE IF NOT EXISTS finance_receipts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  bill_id uuid NOT NULL REFERENCES finance_student_bills(id) ON DELETE CASCADE,
  transaction_id uuid NOT NULL REFERENCES finance_transactions(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  receipt_number text NOT NULL,
  invoice_number text,
  issued_at timestamptz NOT NULL DEFAULT now(),
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  UNIQUE(school_id, receipt_number),
  UNIQUE(transaction_id)
);

CREATE INDEX IF NOT EXISTS idx_finance_receipts_school_id ON finance_receipts(school_id);
CREATE INDEX IF NOT EXISTS idx_finance_receipts_student_id ON finance_receipts(school_id, student_id);
CREATE INDEX IF NOT EXISTS idx_finance_receipts_issued_at ON finance_receipts(school_id, issued_at DESC);

-- Finance trigger helpers
CREATE OR REPLACE FUNCTION update_finance_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_finance_settings_updated_at ON finance_settings;
CREATE TRIGGER trg_finance_settings_updated_at
BEFORE UPDATE ON finance_settings
FOR EACH ROW
EXECUTE FUNCTION update_finance_updated_at();

DROP TRIGGER IF EXISTS trg_finance_fee_templates_updated_at ON finance_fee_templates;
CREATE TRIGGER trg_finance_fee_templates_updated_at
BEFORE UPDATE ON finance_fee_templates
FOR EACH ROW
EXECUTE FUNCTION update_finance_updated_at();

DROP TRIGGER IF EXISTS trg_finance_student_bills_updated_at ON finance_student_bills;
CREATE TRIGGER trg_finance_student_bills_updated_at
BEFORE UPDATE ON finance_student_bills
FOR EACH ROW
EXECUTE FUNCTION update_finance_updated_at();

DROP TRIGGER IF EXISTS trg_finance_bill_items_updated_at ON finance_bill_items;
CREATE TRIGGER trg_finance_bill_items_updated_at
BEFORE UPDATE ON finance_bill_items
FOR EACH ROW
EXECUTE FUNCTION update_finance_updated_at();

DROP TRIGGER IF EXISTS trg_finance_transactions_updated_at ON finance_transactions;
CREATE TRIGGER trg_finance_transactions_updated_at
BEFORE UPDATE ON finance_transactions
FOR EACH ROW
EXECUTE FUNCTION update_finance_updated_at();

CREATE OR REPLACE FUNCTION recalculate_finance_bill_balance(p_bill_id uuid)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  v_total numeric(12,2);
  v_paid numeric(12,2);
BEGIN
  SELECT COALESCE(SUM(amount), 0)
  INTO v_total
  FROM finance_bill_items
  WHERE bill_id = p_bill_id;

  SELECT COALESCE(SUM(amount), 0)
  INTO v_paid
  FROM finance_transactions
  WHERE bill_id = p_bill_id
    AND status = 'success';

  UPDATE finance_student_bills
  SET
    total_amount = v_total,
    amount_paid = v_paid,
    balance_amount = GREATEST(v_total - v_paid, 0),
    status = CASE
      WHEN v_total = 0 THEN 'pending'
      WHEN v_paid >= v_total THEN 'paid'
      WHEN v_paid > 0 THEN 'partial'
      ELSE 'pending'
    END,
    updated_at = now()
  WHERE id = p_bill_id;
END;
$$;

CREATE OR REPLACE FUNCTION sync_finance_bill_balance_from_items()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM recalculate_finance_bill_balance(COALESCE(NEW.bill_id, OLD.bill_id));
  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE OR REPLACE FUNCTION sync_finance_bill_balance_from_transactions()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM recalculate_finance_bill_balance(COALESCE(NEW.bill_id, OLD.bill_id));
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_bill_balance_from_items ON finance_bill_items;
CREATE TRIGGER trg_sync_bill_balance_from_items
AFTER INSERT OR UPDATE OR DELETE ON finance_bill_items
FOR EACH ROW
EXECUTE FUNCTION sync_finance_bill_balance_from_items();

DROP TRIGGER IF EXISTS trg_sync_bill_balance_from_transactions ON finance_transactions;
CREATE TRIGGER trg_sync_bill_balance_from_transactions
AFTER INSERT OR UPDATE OR DELETE ON finance_transactions
FOR EACH ROW
EXECUTE FUNCTION sync_finance_bill_balance_from_transactions();

-- Finance RLS
ALTER TABLE finance_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE finance_fee_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE finance_fee_template_classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE finance_student_bills ENABLE ROW LEVEL SECURITY;
ALTER TABLE finance_bill_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE finance_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE finance_receipts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "School users can read finance settings" ON finance_settings;
DROP POLICY IF EXISTS "Admins can manage finance settings" ON finance_settings;
CREATE POLICY "School users can read finance settings"
  ON finance_settings FOR SELECT
  TO authenticated
  USING (is_super_admin() OR school_id = get_my_school_id());
CREATE POLICY "Admins can manage finance settings"
  ON finance_settings FOR ALL
  TO authenticated
  USING (is_super_admin() OR (is_admin() AND school_id = get_my_school_id()))
  WITH CHECK (is_super_admin() OR (is_admin() AND school_id = get_my_school_id()));

DROP POLICY IF EXISTS "School users can read finance fee templates" ON finance_fee_templates;
DROP POLICY IF EXISTS "Admins can manage finance fee templates" ON finance_fee_templates;
CREATE POLICY "School users can read finance fee templates"
  ON finance_fee_templates FOR SELECT
  TO authenticated
  USING (is_super_admin() OR school_id = get_my_school_id());
CREATE POLICY "Admins can manage finance fee templates"
  ON finance_fee_templates FOR ALL
  TO authenticated
  USING (is_super_admin() OR (is_admin() AND school_id = get_my_school_id()))
  WITH CHECK (is_super_admin() OR (is_admin() AND school_id = get_my_school_id()));

DROP POLICY IF EXISTS "School users can read finance fee template classes" ON finance_fee_template_classes;
DROP POLICY IF EXISTS "Admins can manage finance fee template classes" ON finance_fee_template_classes;
CREATE POLICY "School users can read finance fee template classes"
  ON finance_fee_template_classes FOR SELECT
  TO authenticated
  USING (is_super_admin() OR school_id = get_my_school_id());
CREATE POLICY "Admins can manage finance fee template classes"
  ON finance_fee_template_classes FOR ALL
  TO authenticated
  USING (is_super_admin() OR (is_admin() AND school_id = get_my_school_id()))
  WITH CHECK (is_super_admin() OR (is_admin() AND school_id = get_my_school_id()));

DROP POLICY IF EXISTS "School users can read finance student bills" ON finance_student_bills;
DROP POLICY IF EXISTS "Admins can manage finance student bills" ON finance_student_bills;
CREATE POLICY "School users can read finance student bills"
  ON finance_student_bills FOR SELECT
  TO authenticated
  USING (
    is_super_admin()
    OR (is_admin() AND school_id = get_my_school_id())
    OR student_id IN (SELECT id FROM students WHERE user_id = auth.uid())
    OR student_id IN (
      SELECT id
      FROM students
      WHERE parent_email IN (SELECT email FROM parents WHERE user_id = auth.uid())
    )
  );
CREATE POLICY "Admins can manage finance student bills"
  ON finance_student_bills FOR ALL
  TO authenticated
  USING (is_super_admin() OR (is_admin() AND school_id = get_my_school_id()))
  WITH CHECK (is_super_admin() OR (is_admin() AND school_id = get_my_school_id()));

DROP POLICY IF EXISTS "School users can read finance bill items" ON finance_bill_items;
DROP POLICY IF EXISTS "Admins can manage finance bill items" ON finance_bill_items;
CREATE POLICY "School users can read finance bill items"
  ON finance_bill_items FOR SELECT
  TO authenticated
  USING (
    is_super_admin()
    OR (is_admin() AND school_id = get_my_school_id())
    OR bill_id IN (
      SELECT id
      FROM finance_student_bills
      WHERE student_id IN (SELECT id FROM students WHERE user_id = auth.uid())
         OR student_id IN (
           SELECT id
           FROM students
           WHERE parent_email IN (SELECT email FROM parents WHERE user_id = auth.uid())
         )
    )
  );
CREATE POLICY "Admins can manage finance bill items"
  ON finance_bill_items FOR ALL
  TO authenticated
  USING (is_super_admin() OR (is_admin() AND school_id = get_my_school_id()))
  WITH CHECK (is_super_admin() OR (is_admin() AND school_id = get_my_school_id()));

DROP POLICY IF EXISTS "School users can read finance transactions" ON finance_transactions;
DROP POLICY IF EXISTS "Admins can manage finance transactions" ON finance_transactions;
DROP POLICY IF EXISTS "Students and parents can insert finance transactions" ON finance_transactions;
CREATE POLICY "School users can read finance transactions"
  ON finance_transactions FOR SELECT
  TO authenticated
  USING (
    is_super_admin()
    OR (is_admin() AND school_id = get_my_school_id())
    OR student_id IN (SELECT id FROM students WHERE user_id = auth.uid())
    OR student_id IN (
      SELECT id
      FROM students
      WHERE parent_email IN (SELECT email FROM parents WHERE user_id = auth.uid())
    )
  );
CREATE POLICY "Admins can manage finance transactions"
  ON finance_transactions FOR ALL
  TO authenticated
  USING (is_super_admin() OR (is_admin() AND school_id = get_my_school_id()))
  WITH CHECK (is_super_admin() OR (is_admin() AND school_id = get_my_school_id()));
CREATE POLICY "Students and parents can insert finance transactions"
  ON finance_transactions FOR INSERT
  TO authenticated
  WITH CHECK (
    (
      student_id IN (SELECT id FROM students WHERE user_id = auth.uid())
      OR student_id IN (
        SELECT id
        FROM students
        WHERE parent_email IN (SELECT email FROM parents WHERE user_id = auth.uid())
      )
    )
    AND created_by = auth.uid()
  );

DROP POLICY IF EXISTS "School users can read finance receipts" ON finance_receipts;
DROP POLICY IF EXISTS "Admins can manage finance receipts" ON finance_receipts;
CREATE POLICY "School users can read finance receipts"
  ON finance_receipts FOR SELECT
  TO authenticated
  USING (
    is_super_admin()
    OR (is_admin() AND school_id = get_my_school_id())
    OR student_id IN (SELECT id FROM students WHERE user_id = auth.uid())
    OR student_id IN (
      SELECT id
      FROM students
      WHERE parent_email IN (SELECT email FROM parents WHERE user_id = auth.uid())
    )
  );
CREATE POLICY "Admins can manage finance receipts"
  ON finance_receipts FOR ALL
  TO authenticated
  USING (is_super_admin() OR (is_admin() AND school_id = get_my_school_id()))
  WITH CHECK (is_super_admin() OR (is_admin() AND school_id = get_my_school_id()));

-- -----------------------------------------------------------------------------
-- JAMB CBT FEATURE (Permanent schema)
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS jamb_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  exam_type text NOT NULL DEFAULT 'jamb' CHECK (exam_type = 'jamb'),
  subject_slug text NOT NULL,
  subject_name text NOT NULL,
  exam_year int NOT NULL,
  topic text,
  image_url text,
  question_text text NOT NULL,
  options jsonb NOT NULL DEFAULT '[]'::jsonb,
  correct_option text NOT NULL,
  explanation text,
  source_url text,
  external_question_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE jamb_questions ADD COLUMN IF NOT EXISTS image_url text;

CREATE INDEX IF NOT EXISTS idx_jamb_questions_school ON jamb_questions (school_id);
CREATE INDEX IF NOT EXISTS idx_jamb_questions_subject ON jamb_questions (school_id, subject_slug, exam_year);
CREATE INDEX IF NOT EXISTS idx_jamb_questions_topic ON jamb_questions (school_id, subject_slug, exam_year, topic);

CREATE TABLE IF NOT EXISTS jamb_subjects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_jamb_subjects_name ON jamb_subjects (name);

CREATE TABLE IF NOT EXISTS jamb_subject_years (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_slug text NOT NULL,
  subject_name text NOT NULL,
  exam_year int NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (subject_slug, exam_year)
);

CREATE INDEX IF NOT EXISTS idx_jamb_subject_years_subject_year
  ON jamb_subject_years (subject_slug, exam_year);

CREATE TABLE IF NOT EXISTS jamb_student_access (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  granted_by_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  granted_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  is_active boolean NOT NULL DEFAULT true,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (student_id)
);

CREATE INDEX IF NOT EXISTS idx_jamb_student_access_school ON jamb_student_access (school_id);
CREATE INDEX IF NOT EXISTS idx_jamb_student_access_student ON jamb_student_access (student_id);
CREATE INDEX IF NOT EXISTS idx_jamb_student_access_active ON jamb_student_access (school_id, is_active);

CREATE TABLE IF NOT EXISTS jamb_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  subject_slug text NOT NULL,
  subject_name text NOT NULL,
  exam_type text NOT NULL DEFAULT 'jamb' CHECK (exam_type = 'jamb'),
  exam_year int NOT NULL,
  topic text,
  total_questions int NOT NULL DEFAULT 0,
  correct_count int NOT NULL DEFAULT 0,
  score numeric(5, 2) NOT NULL DEFAULT 0,
  answers jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_jamb_attempts_school ON jamb_attempts (school_id);
CREATE INDEX IF NOT EXISTS idx_jamb_attempts_student ON jamb_attempts (student_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_jamb_attempts_subject ON jamb_attempts (school_id, subject_slug, exam_year);

-- Legacy-but-active helper: server-side exam session tracking
CREATE TABLE IF NOT EXISTS jamb_exam_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  school_id uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  subject_slug text NOT NULL,
  exam_year integer NOT NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  duration_minutes integer NOT NULL DEFAULT 40,
  expires_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'submitted', 'expired', 'cancelled')),
  submitted_at timestamptz,
  session_token text NOT NULL UNIQUE,
  client_clock_offset_ms integer DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION set_jamb_exam_session_expires_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.expires_at := NEW.started_at + (NEW.duration_minutes * INTERVAL '1 minute');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_jamb_exam_session_expires_at ON jamb_exam_sessions;
CREATE TRIGGER trg_set_jamb_exam_session_expires_at
BEFORE INSERT OR UPDATE OF started_at, duration_minutes
ON jamb_exam_sessions
FOR EACH ROW
EXECUTE FUNCTION set_jamb_exam_session_expires_at();

CREATE INDEX IF NOT EXISTS idx_jamb_sessions_student_active
  ON jamb_exam_sessions(student_id, status)
  WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_jamb_sessions_school_subject_year
  ON jamb_exam_sessions(school_id, subject_slug, exam_year, status);
CREATE INDEX IF NOT EXISTS idx_jamb_sessions_token ON jamb_exam_sessions(session_token);
CREATE INDEX IF NOT EXISTS idx_jamb_sessions_expires
  ON jamb_exam_sessions(expires_at)
  WHERE status = 'active';
CREATE UNIQUE INDEX IF NOT EXISTS idx_jamb_sessions_unique_active
  ON jamb_exam_sessions(student_id, school_id, subject_slug, exam_year)
  WHERE status = 'active';

CREATE OR REPLACE FUNCTION can_access_jamb_cbt()
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM jamb_student_access jsa
    JOIN students s ON s.id = jsa.student_id
    WHERE s.user_id = auth.uid()
      AND s.school_id = get_my_school_id()
      AND jsa.school_id = s.school_id
      AND jsa.is_active = true
  );
$$;

-- JAMB updated_at helpers
CREATE OR REPLACE FUNCTION update_jamb_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_jamb_questions_updated_at ON jamb_questions;
CREATE TRIGGER trg_jamb_questions_updated_at
BEFORE UPDATE ON jamb_questions
FOR EACH ROW
EXECUTE FUNCTION update_jamb_updated_at();

DROP TRIGGER IF EXISTS trg_jamb_subjects_updated_at ON jamb_subjects;
CREATE TRIGGER trg_jamb_subjects_updated_at
BEFORE UPDATE ON jamb_subjects
FOR EACH ROW
EXECUTE FUNCTION update_jamb_updated_at();

DROP TRIGGER IF EXISTS trg_jamb_subject_years_updated_at ON jamb_subject_years;
CREATE TRIGGER trg_jamb_subject_years_updated_at
BEFORE UPDATE ON jamb_subject_years
FOR EACH ROW
EXECUTE FUNCTION update_jamb_updated_at();

DROP TRIGGER IF EXISTS trg_jamb_student_access_updated_at ON jamb_student_access;
CREATE TRIGGER trg_jamb_student_access_updated_at
BEFORE UPDATE ON jamb_student_access
FOR EACH ROW
EXECUTE FUNCTION update_jamb_updated_at();

DROP TRIGGER IF EXISTS trg_jamb_exam_sessions_updated_at ON jamb_exam_sessions;
CREATE TRIGGER trg_jamb_exam_sessions_updated_at
BEFORE UPDATE ON jamb_exam_sessions
FOR EACH ROW
EXECUTE FUNCTION update_jamb_updated_at();

-- JAMB RLS
ALTER TABLE jamb_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE jamb_subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE jamb_subject_years ENABLE ROW LEVEL SECURITY;
ALTER TABLE jamb_student_access ENABLE ROW LEVEL SECURITY;
ALTER TABLE jamb_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE jamb_exam_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can manage JAMB questions" ON jamb_questions;
DROP POLICY IF EXISTS "Students can read accessible JAMB questions" ON jamb_questions;
CREATE POLICY "Admins can manage JAMB questions"
  ON jamb_questions FOR ALL
  TO authenticated
  USING (is_admin() AND school_id = get_my_school_id())
  WITH CHECK (is_admin() AND school_id = get_my_school_id());
CREATE POLICY "Students can read accessible JAMB questions"
  ON jamb_questions FOR SELECT
  TO authenticated
  USING (school_id = get_my_school_id() AND can_access_jamb_cbt());

DROP POLICY IF EXISTS "Admins can manage JAMB subjects" ON jamb_subjects;
DROP POLICY IF EXISTS "Students can read JAMB subjects" ON jamb_subjects;
CREATE POLICY "Admins can manage JAMB subjects"
  ON jamb_subjects FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());
CREATE POLICY "Students can read JAMB subjects"
  ON jamb_subjects FOR SELECT
  TO authenticated
  USING (can_access_jamb_cbt());

DROP POLICY IF EXISTS "Admins can manage JAMB subject years" ON jamb_subject_years;
DROP POLICY IF EXISTS "Students can read JAMB subject years" ON jamb_subject_years;
CREATE POLICY "Admins can manage JAMB subject years"
  ON jamb_subject_years FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());
CREATE POLICY "Students can read JAMB subject years"
  ON jamb_subject_years FOR SELECT
  TO authenticated
  USING (can_access_jamb_cbt());

DROP POLICY IF EXISTS "Admins can manage JAMB student access" ON jamb_student_access;
DROP POLICY IF EXISTS "Students can read own JAMB access" ON jamb_student_access;
CREATE POLICY "Admins can manage JAMB student access"
  ON jamb_student_access FOR ALL
  TO authenticated
  USING (is_admin() AND school_id = get_my_school_id())
  WITH CHECK (is_admin() AND school_id = get_my_school_id());
CREATE POLICY "Students can read own JAMB access"
  ON jamb_student_access FOR SELECT
  TO authenticated
  USING (
    school_id = get_my_school_id()
    AND student_id IN (SELECT id FROM students WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS "Admins can manage JAMB attempts" ON jamb_attempts;
DROP POLICY IF EXISTS "Students can read own JAMB attempts" ON jamb_attempts;
DROP POLICY IF EXISTS "Students can create their JAMB attempts" ON jamb_attempts;
CREATE POLICY "Admins can manage JAMB attempts"
  ON jamb_attempts FOR ALL
  TO authenticated
  USING (is_admin() AND school_id = get_my_school_id())
  WITH CHECK (is_admin() AND school_id = get_my_school_id());
CREATE POLICY "Students can read own JAMB attempts"
  ON jamb_attempts FOR SELECT
  TO authenticated
  USING (
    school_id = get_my_school_id()
    AND student_id IN (SELECT id FROM students WHERE user_id = auth.uid())
  );
CREATE POLICY "Students can create their JAMB attempts"
  ON jamb_attempts FOR INSERT
  TO authenticated
  WITH CHECK (
    school_id = get_my_school_id()
    AND student_id IN (SELECT id FROM students WHERE user_id = auth.uid())
    AND can_access_jamb_cbt()
  );

DROP POLICY IF EXISTS "students_can_view_own_sessions" ON jamb_exam_sessions;
DROP POLICY IF EXISTS "students_can_create_sessions" ON jamb_exam_sessions;
DROP POLICY IF EXISTS "students_can_update_own_sessions" ON jamb_exam_sessions;
CREATE POLICY "students_can_view_own_sessions"
  ON jamb_exam_sessions FOR SELECT
  TO authenticated
  USING (student_id = (SELECT id FROM students WHERE user_id = auth.uid() LIMIT 1));
CREATE POLICY "students_can_create_sessions"
  ON jamb_exam_sessions FOR INSERT
  TO authenticated
  WITH CHECK (student_id = (SELECT id FROM students WHERE user_id = auth.uid() LIMIT 1));
CREATE POLICY "students_can_update_own_sessions"
  ON jamb_exam_sessions FOR UPDATE
  TO authenticated
  USING (student_id = (SELECT id FROM students WHERE user_id = auth.uid() LIMIT 1))
  WITH CHECK (student_id = (SELECT id FROM students WHERE user_id = auth.uid() LIMIT 1));

COMMENT ON TABLE jamb_questions IS 'Imported JAMB question bank used by the CBT practice feature';
COMMENT ON TABLE jamb_subjects IS 'Imported JAMB subject catalog used by the CBT practice feature';
COMMENT ON TABLE jamb_subject_years IS 'Imported JAMB subject-year catalog used by the CBT practice feature';
COMMENT ON TABLE jamb_student_access IS 'Per-student access control for the JAMB CBT practice feature';
COMMENT ON TABLE jamb_attempts IS 'Stored JAMB CBT practice attempts and scores';
COMMENT ON TABLE jamb_exam_sessions IS 'Server-side JAMB CBT active/completed exam session tracking';
