-- ============================================================================
-- FINANCE MODULE FOUNDATION
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- Reference and settings tables
-- ----------------------------------------------------------------------------

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

-- ----------------------------------------------------------------------------
-- Billing and transactions
-- ----------------------------------------------------------------------------

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

-- ----------------------------------------------------------------------------
-- Trigger helpers
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION update_finance_updated_at()
RETURNS trigger AS $$
BEGIN
	NEW.updated_at = now();
	RETURN NEW;
END;
$$ LANGUAGE plpgsql;

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
RETURNS void AS $$
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
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION sync_finance_bill_balance_from_items()
RETURNS trigger AS $$
BEGIN
	PERFORM recalculate_finance_bill_balance(COALESCE(NEW.bill_id, OLD.bill_id));
	RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION sync_finance_bill_balance_from_transactions()
RETURNS trigger AS $$
BEGIN
	PERFORM recalculate_finance_bill_balance(COALESCE(NEW.bill_id, OLD.bill_id));
	RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

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

-- ----------------------------------------------------------------------------
-- RLS
-- ----------------------------------------------------------------------------

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

COMMIT;
