-- ============================================================================
-- TEACHER PAYROLL MODULE
-- Adds payroll settings and payment tracking for teachers.
-- Each teacher can have a personal Paystack subaccount for receiving salary.
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. Add paystack_subaccount_code to teachers table
-- ----------------------------------------------------------------------------
ALTER TABLE teachers ADD COLUMN IF NOT EXISTS paystack_subaccount_code text;

-- ----------------------------------------------------------------------------
-- 2. Teacher Payroll Settings (salary configuration)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS teacher_payroll_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  teacher_id uuid NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
  salary_amount numeric(12,2) NOT NULL DEFAULT 0 CHECK (salary_amount >= 0),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(school_id, teacher_id)
);

CREATE INDEX IF NOT EXISTS idx_teacher_payroll_settings_school_id ON teacher_payroll_settings(school_id);
CREATE INDEX IF NOT EXISTS idx_teacher_payroll_settings_teacher_id ON teacher_payroll_settings(teacher_id);

-- ----------------------------------------------------------------------------
-- 3. Teacher Payroll Payments (payment records)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS teacher_payroll_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  teacher_id uuid NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
  amount numeric(12,2) NOT NULL CHECK (amount > 0),
  period_label text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'success', 'failed', 'cancelled', 'reversed')),
  reference text,
  subaccount_code text,
  payment_method text NOT NULL DEFAULT 'paystack' CHECK (payment_method IN ('paystack', 'bank_transfer', 'cash', 'manual')),
  paid_at timestamptz,
  notes text DEFAULT '',
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(school_id, reference)
);

CREATE INDEX IF NOT EXISTS idx_teacher_payroll_payments_school_id ON teacher_payroll_payments(school_id);
CREATE INDEX IF NOT EXISTS idx_teacher_payroll_payments_teacher_id ON teacher_payroll_payments(teacher_id);
CREATE INDEX IF NOT EXISTS idx_teacher_payroll_payments_status ON teacher_payroll_payments(school_id, status);
CREATE INDEX IF NOT EXISTS idx_teacher_payroll_payments_created_at ON teacher_payroll_payments(school_id, created_at DESC);

-- ----------------------------------------------------------------------------
-- 4. Trigger for updated_at
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION update_payroll_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_teacher_payroll_settings_updated_at ON teacher_payroll_settings;
CREATE TRIGGER trg_teacher_payroll_settings_updated_at
BEFORE UPDATE ON teacher_payroll_settings
FOR EACH ROW
EXECUTE FUNCTION update_payroll_updated_at();

DROP TRIGGER IF EXISTS trg_teacher_payroll_payments_updated_at ON teacher_payroll_payments;
CREATE TRIGGER trg_teacher_payroll_payments_updated_at
BEFORE UPDATE ON teacher_payroll_payments
FOR EACH ROW
EXECUTE FUNCTION update_payroll_updated_at();

-- ----------------------------------------------------------------------------
-- 5. RLS Policies
-- ----------------------------------------------------------------------------
ALTER TABLE teacher_payroll_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE teacher_payroll_payments ENABLE ROW LEVEL SECURITY;

-- Teacher Payroll Settings RLS
DROP POLICY IF EXISTS "School users can read payroll settings" ON teacher_payroll_settings;
CREATE POLICY "School users can read payroll settings"
  ON teacher_payroll_settings FOR SELECT
  TO authenticated
  USING (
    is_super_admin()
    OR school_id = get_my_school_id()
    OR teacher_id IN (SELECT id FROM teachers WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS "Admins can manage payroll settings" ON teacher_payroll_settings;
CREATE POLICY "Admins can manage payroll settings"
  ON teacher_payroll_settings FOR ALL
  TO authenticated
  USING (is_super_admin() OR (is_admin() AND school_id = get_my_school_id()))
  WITH CHECK (is_super_admin() OR (is_admin() AND school_id = get_my_school_id()));

-- Teacher Payroll Payments RLS
DROP POLICY IF EXISTS "School users can read payroll payments" ON teacher_payroll_payments;
CREATE POLICY "School users can read payroll payments"
  ON teacher_payroll_payments FOR SELECT
  TO authenticated
  USING (
    is_super_admin()
    OR school_id = get_my_school_id()
    OR teacher_id IN (SELECT id FROM teachers WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS "Admins can manage payroll payments" ON teacher_payroll_payments;
CREATE POLICY "Admins can manage payroll payments"
  ON teacher_payroll_payments FOR ALL
  TO authenticated
  USING (is_super_admin() OR (is_admin() AND school_id = get_my_school_id()))
  WITH CHECK (is_super_admin() OR (is_admin() AND school_id = get_my_school_id()));

-- Teachers can insert their own payroll payments (for future use)
DROP POLICY IF EXISTS "Teachers can read own payroll payments" ON teacher_payroll_payments;
CREATE POLICY "Teachers can read own payroll payments"
  ON teacher_payroll_payments FOR SELECT
  TO authenticated
  USING (teacher_id IN (SELECT id FROM teachers WHERE user_id = auth.uid()));

COMMIT;
