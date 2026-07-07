-- =============================================================================
-- Inventory Management Structure (SQL)
-- Source: supabase/structure/06-inventory-management.sql
-- Depends on: 00-core-and-tenancy.sql (for schools, students, teachers, classes, etc.)
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Custom ENUM types
-- -----------------------------------------------------------------------------

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'inventory_item_type') THEN
    CREATE TYPE inventory_item_type AS ENUM ('asset', 'consumable', 'saleable');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'inventory_asset_status') THEN
    CREATE TYPE inventory_asset_status AS ENUM ('available', 'checked_out', 'maintenance', 'lost');
  END IF;
END $$;

DO $$
BEGIN    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'inventory_transaction_type') THEN
    CREATE TYPE inventory_transaction_type AS ENUM ('checkout', 'return', 'purchase', 'restock', 'damage_reported', 'consumed');
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- 1) inventory_items — master catalog of everything the school tracks
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS inventory_items (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id           uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  name                text NOT NULL,
  category            text NOT NULL DEFAULT '',
  item_type           inventory_item_type NOT NULL DEFAULT 'consumable',
  stock_count         integer NOT NULL DEFAULT 0 CHECK (stock_count >= 0),
  low_stock_threshold integer NOT NULL DEFAULT 5 CHECK (low_stock_threshold >= 0),
  description         text DEFAULT '',
  unit_price          numeric(12,2) DEFAULT 0 CHECK (unit_price >= 0),
  is_active           boolean NOT NULL DEFAULT true,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE  inventory_items IS 'Master catalog of all inventoried items (assets, consumables, saleables)';
COMMENT ON COLUMN inventory_items.stock_count IS 'Aggregate quantity for consumables/saleables; not meaningful for assets';
COMMENT ON COLUMN inventory_items.low_stock_threshold IS 'When stock_count drops below this, the system flags an alert';

CREATE INDEX IF NOT EXISTS idx_inventory_items_school_id ON inventory_items(school_id);
CREATE INDEX IF NOT EXISTS idx_inventory_items_type     ON inventory_items(school_id, item_type);
CREATE INDEX IF NOT EXISTS idx_inventory_items_category ON inventory_items(school_id, category);
CREATE INDEX IF NOT EXISTS idx_inventory_items_active   ON inventory_items(school_id, is_active);
CREATE INDEX IF NOT EXISTS idx_inventory_items_low_stock
  ON inventory_items(school_id)
  WHERE item_type IN ('consumable', 'saleable') AND stock_count < low_stock_threshold;

-- -----------------------------------------------------------------------------
-- 2) inventory_assets — unique, serialised durable items
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS inventory_assets (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id         uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  item_id           uuid NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
  serial_number     text NOT NULL,
  status            inventory_asset_status NOT NULL DEFAULT 'available',
  assigned_user_id  uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  assigned_user_role text DEFAULT '' CHECK (assigned_user_role IN ('', 'student', 'teacher', 'admin')),
  purchase_date     date,
  purchase_price    numeric(12,2) DEFAULT 0 CHECK (purchase_price >= 0),
  notes             text DEFAULT '',
  is_active         boolean NOT NULL DEFAULT true,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE(school_id, serial_number)
);

COMMENT ON TABLE  inventory_assets IS 'Individual physical or digital unique assets (laptops, projectors, tablets, etc.)';
COMMENT ON COLUMN inventory_assets.assigned_user_id IS 'The auth.users ID of the person currently holding this asset';
COMMENT ON COLUMN inventory_assets.assigned_user_role IS 'Denormalised role hint for the assigned user';

CREATE INDEX IF NOT EXISTS idx_inventory_assets_school_id ON inventory_assets(school_id);
CREATE INDEX IF NOT EXISTS idx_inventory_assets_item_id   ON inventory_assets(item_id);
CREATE INDEX IF NOT EXISTS idx_inventory_assets_status     ON inventory_assets(school_id, status);
CREATE INDEX IF NOT EXISTS idx_inventory_assets_assigned   ON inventory_assets(assigned_user_id);
CREATE INDEX IF NOT EXISTS idx_inventory_assets_serial     ON inventory_assets(serial_number);

-- -----------------------------------------------------------------------------
-- 3) inventory_transactions — immutable audit ledger
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS inventory_transactions (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id         uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  item_id           uuid REFERENCES inventory_items(id) ON DELETE SET NULL,
  asset_id          uuid REFERENCES inventory_assets(id) ON DELETE SET NULL,
  user_id           uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  user_role         text DEFAULT '' CHECK (user_role IN ('', 'admin', 'teacher', 'student')),
  transaction_type  inventory_transaction_type NOT NULL,
  quantity          integer NOT NULL DEFAULT 1 CHECK (quantity > 0),
  notes             text DEFAULT '',
  created_at        timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE inventory_transactions IS 'Immutable audit ledger for every inventory-related action';

CREATE INDEX IF NOT EXISTS idx_inventory_transactions_school_id ON inventory_transactions(school_id);
CREATE INDEX IF NOT EXISTS idx_inventory_transactions_item_id   ON inventory_transactions(item_id);
CREATE INDEX IF NOT EXISTS idx_inventory_transactions_asset_id  ON inventory_transactions(asset_id);
CREATE INDEX IF NOT EXISTS idx_inventory_transactions_user_id   ON inventory_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_inventory_transactions_type      ON inventory_transactions(school_id, transaction_type);
CREATE INDEX IF NOT EXISTS idx_inventory_transactions_created   ON inventory_transactions(school_id, created_at DESC);

-- -----------------------------------------------------------------------------
-- 4) admin_alerts — low-stock and other system alerts (linked from Phase 5)
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS admin_alerts (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id         uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  alert_type        text NOT NULL CHECK (alert_type IN ('low_stock', 'maintenance_needed', 'asset_lost')),
  title             text NOT NULL,
  message           text NOT NULL DEFAULT '',
  reference_type    text DEFAULT '' CHECK (reference_type IN ('', 'inventory_items', 'inventory_assets')),
  reference_id      uuid,
  is_read           boolean NOT NULL DEFAULT false,
  is_dismissed      boolean NOT NULL DEFAULT false,
  created_at        timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE admin_alerts IS 'System-generated alerts for low stock, maintenance needs, lost items, etc.';

CREATE INDEX IF NOT EXISTS idx_admin_alerts_school_id   ON admin_alerts(school_id);
CREATE INDEX IF NOT EXISTS idx_admin_alerts_unread      ON admin_alerts(school_id, is_read) WHERE is_read = false;
CREATE INDEX IF NOT EXISTS idx_admin_alerts_type         ON admin_alerts(school_id, alert_type);

-- -----------------------------------------------------------------------------
-- 5) RLS policies
-- -----------------------------------------------------------------------------

ALTER TABLE inventory_items       ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_assets      ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_alerts          ENABLE ROW LEVEL SECURITY;

-- ── inventory_items ──────────────────────────────────────────────

DROP POLICY IF EXISTS "School users can read inventory items" ON inventory_items;
CREATE POLICY "School users can read inventory items"
  ON inventory_items FOR SELECT
  TO authenticated
  USING (is_super_admin() OR school_id = get_my_school_id());

DROP POLICY IF EXISTS "Admins can manage inventory items" ON inventory_items;
CREATE POLICY "Admins can manage inventory items"
  ON inventory_items FOR ALL
  TO authenticated
  USING (is_super_admin() OR (is_admin() AND school_id = get_my_school_id()))
  WITH CHECK (is_super_admin() OR (is_admin() AND school_id = get_my_school_id()));

-- ── inventory_assets ─────────────────────────────────────────────

DROP POLICY IF EXISTS "School users can read inventory assets" ON inventory_assets;
CREATE POLICY "School users can read inventory assets"
  ON inventory_assets FOR SELECT
  TO authenticated
  USING (
    is_super_admin()
    OR school_id = get_my_school_id()
  );

DROP POLICY IF EXISTS "Students can read own assigned assets" ON inventory_assets;
CREATE POLICY "Students can read own assigned assets"
  ON inventory_assets FOR SELECT
  TO authenticated
  USING (
    school_id = get_my_school_id()
    AND assigned_user_id = auth.uid()
  );

DROP POLICY IF EXISTS "Parents can read children's assigned assets" ON inventory_assets;
CREATE POLICY "Parents can read children's assigned assets"
  ON inventory_assets FOR SELECT
  TO authenticated
  USING (
    school_id = get_my_school_id()
    AND assigned_user_id IN (
      SELECT s.user_id
      FROM students s
      JOIN student_guardian_links sgl ON sgl.student_id = s.id
      JOIN parents p ON p.id = sgl.guardian_id
      WHERE p.user_id = auth.uid()
        AND s.user_id IS NOT NULL
    )
  );

DROP POLICY IF EXISTS "Admins can manage inventory assets" ON inventory_assets;
CREATE POLICY "Admins can manage inventory assets"
  ON inventory_assets FOR ALL
  TO authenticated
  USING (is_super_admin() OR (is_admin() AND school_id = get_my_school_id()))
  WITH CHECK (is_super_admin() OR (is_admin() AND school_id = get_my_school_id()));

-- ── inventory_transactions ───────────────────────────────────────

DROP POLICY IF EXISTS "School users can read inventory transactions" ON inventory_transactions;
CREATE POLICY "School users can read inventory transactions"
  ON inventory_transactions FOR SELECT
  TO authenticated
  USING (is_super_admin() OR school_id = get_my_school_id());

DROP POLICY IF EXISTS "Admins can manage inventory transactions" ON inventory_transactions;
CREATE POLICY "Admins can manage inventory transactions"
  ON inventory_transactions FOR ALL
  TO authenticated
  USING (is_super_admin() OR (is_admin() AND school_id = get_my_school_id()))
  WITH CHECK (is_super_admin() OR (is_admin() AND school_id = get_my_school_id()));

-- ── admin_alerts ──────────────────────────────────────────────────

DROP POLICY IF EXISTS "School users can read admin alerts" ON admin_alerts;
CREATE POLICY "School users can read admin alerts"
  ON admin_alerts FOR SELECT
  TO authenticated
  USING (is_super_admin() OR school_id = get_my_school_id());

DROP POLICY IF EXISTS "Admins can manage admin alerts" ON admin_alerts;
CREATE POLICY "Admins can manage admin alerts"
  ON admin_alerts FOR ALL
  TO authenticated
  USING (is_super_admin() OR (is_admin() AND school_id = get_my_school_id()))
  WITH CHECK (is_super_admin() OR (is_admin() AND school_id = get_my_school_id()));

-- -----------------------------------------------------------------------------
-- 6) Triggers for updated_at
-- -----------------------------------------------------------------------------

DROP TRIGGER IF EXISTS set_inventory_items_updated_at ON inventory_items;
CREATE TRIGGER set_inventory_items_updated_at
  BEFORE UPDATE ON inventory_items FOR EACH ROW EXECUTE FUNCTION set_updated_at_timestamp();

DROP TRIGGER IF EXISTS set_inventory_assets_updated_at ON inventory_assets;
CREATE TRIGGER set_inventory_assets_updated_at
  BEFORE UPDATE ON inventory_assets FOR EACH ROW EXECUTE FUNCTION set_updated_at_timestamp();

-- inventory_transactions and admin_alerts are append-only, no updated_at needed

-- -----------------------------------------------------------------------------
-- 7) Low-stock trigger function (authored in Phase 5, created here for schema completeness)
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION check_and_alert_low_stock()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only fires for consumable / saleable items when stock drops below threshold
  IF NEW.item_type IN ('consumable', 'saleable')
     AND NEW.stock_count < NEW.low_stock_threshold
     AND (OLD IS NULL OR OLD.stock_count >= OLD.low_stock_threshold)
  THEN
    INSERT INTO admin_alerts (school_id, alert_type, title, message, reference_type, reference_id)
    VALUES (
      NEW.school_id,
      'low_stock',
      'Low stock: ' || NEW.name,
      'Stock count (' || NEW.stock_count || ') has fallen below the threshold (' || NEW.low_stock_threshold || ').',
      'inventory_items',
      NEW.id
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_inventory_low_stock_alert ON inventory_items;
CREATE TRIGGER trg_inventory_low_stock_alert
  AFTER INSERT OR UPDATE OF stock_count
  ON inventory_items
  FOR EACH ROW
  EXECUTE FUNCTION check_and_alert_low_stock();

-- -----------------------------------------------------------------------------
-- 8) Prevent double-checkout trigger for assets
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION prevent_double_asset_checkout()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'checked_out' AND OLD.status = 'checked_out' THEN
    RAISE EXCEPTION 'Asset is already checked out' USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_inventory_prevent_double_checkout ON inventory_assets;
CREATE TRIGGER trg_inventory_prevent_double_checkout
  BEFORE UPDATE OF status
  ON inventory_assets
  FOR EACH ROW
  WHEN (NEW.status = 'checked_out')
  EXECUTE FUNCTION prevent_double_asset_checkout();
