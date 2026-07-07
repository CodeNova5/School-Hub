-- =============================================================================
-- Inventory Management — Seed Data
-- =============================================================================
-- Run this in your Supabase SQL editor AFTER running 06-inventory-management.sql
-- It populates sample data so you can test the inventory UI immediately.
-- All items/transactions are created under the FIRST school found.
-- =============================================================================

DO $$
DECLARE
  v_school_id    uuid;
  v_school_name  text;
  v_item_id      uuid;
  v_asset_id     uuid;
  v_user_id      uuid;
  v_admin_id     uuid;
BEGIN
  -- First check that the inventory tables exist (migration 06 must be run first)
  IF to_regclass('public.inventory_items') IS NULL THEN
    RAISE EXCEPTION 'Inventory tables not found. Please run the 06-inventory-management.sql migration first.';
  END IF;

  -- Get the first school (or the one you want to demo with)
  SELECT id, name INTO v_school_id, v_school_name
  FROM schools
  ORDER BY created_at ASC
  LIMIT 1;

  IF v_school_id IS NULL THEN
    RAISE EXCEPTION 'No schools found. Create a school first.';
  END IF;

  RAISE NOTICE 'Seeding inventory for school: % (%)', v_school_name, v_school_id;

  -- Clear previous seed data for this school (allows safe re-runs)
  DELETE FROM inventory_transactions WHERE school_id = v_school_id;
  DELETE FROM admin_alerts          WHERE school_id = v_school_id;
  DELETE FROM inventory_assets      WHERE school_id = v_school_id;
  DELETE FROM inventory_items       WHERE school_id = v_school_id;

  RAISE NOTICE 'Cleared existing inventory data for this school.';

  -- Get an admin user from this school for transaction logging
  SELECT user_id INTO v_admin_id
  FROM admins
  WHERE school_id = v_school_id AND is_active = true
  LIMIT 1;

  -- ===========================================================================
  -- 1) INVENTORY ITEMS
  -- ===========================================================================

  -- Asset-type items
  INSERT INTO inventory_items (school_id, name, category, item_type, stock_count, low_stock_threshold, description, unit_price) VALUES
    (v_school_id, 'MacBook Pro 14"',    'Electronics', 'asset',       0, 5, 'School-issued laptop for teachers and staff', 249900),
    (v_school_id, 'Epson Projector',     'Electronics', 'asset',       0, 2, 'Classroom projector', 189500),
    (v_school_id, 'iPad Air',            'Electronics', 'asset',       0, 3, 'Tablet for classroom use', 159900),
    (v_school_id, 'Office Desk Chair',   'Furniture',   'asset',       0, 5, 'Ergonomic office chair', 85000)
  ON CONFLICT DO NOTHING;

  -- Consumable-type items
  INSERT INTO inventory_items (school_id, name, category, item_type, stock_count, low_stock_threshold, description, unit_price) VALUES
    (v_school_id, 'Whiteboard Markers (Box)', 'Stationery',  'consumable', 12,  10, 'Box of 12 assorted colour markers', 4500),
    (v_school_id, 'A4 Printer Paper (Ream)', 'Stationery',  'consumable', 5,   20, '500 sheets per ream', 3500),
    (v_school_id, 'Chalk (Box)',              'Stationery',  'consumable', 8,   10, 'Box of 100 white chalk sticks', 1200),
    (v_school_id, 'Hand Sanitizer (1L)',      'Hygiene',     'consumable', 3,   10, 'Alcohol-based hand sanitizer', 2500),
    (v_school_id, 'Mask (Box of 50)',         'Hygiene',     'consumable', 2,   5,  'Disposable face masks', 6000)
  ON CONFLICT DO NOTHING;

  -- Saleable-type items
  INSERT INTO inventory_items (school_id, name, category, item_type, stock_count, low_stock_threshold, description, unit_price) VALUES
    (v_school_id, 'School Uniform (Full Set)', 'Apparel', 'saleable', 25, 10, 'Complete school uniform set', 15000),
    (v_school_id, 'PE Kit (T-Shirt + Shorts)', 'Apparel', 'saleable', 18, 10, 'Physical education kit', 8500),
    (v_school_id, 'Exercise Book (64 pages)',   'Stationery', 'saleable', 100, 20, 'Standard 64-page exercise book', 800),
    (v_school_id, 'School Bag',                 'Apparel', 'saleable', 12, 5,  'Official school backpack', 22000)
  ON CONFLICT DO NOTHING;

  RAISE NOTICE 'Inserted inventory items.';

  -- ===========================================================================
  -- 2) INVENTORY ASSETS (for asset-type items only)
  -- ===========================================================================

  -- Get the laptop item
  SELECT id INTO v_item_id FROM inventory_items
  WHERE school_id = v_school_id AND name = 'MacBook Pro 14"' LIMIT 1;

  IF v_item_id IS NOT NULL THEN
    INSERT INTO inventory_assets (school_id, item_id, serial_number, status, assigned_user_role) VALUES
      (v_school_id, v_item_id, 'MBP-2024-001', 'available',   ''),
      (v_school_id, v_item_id, 'MBP-2024-002', 'checked_out', 'teacher'),
      (v_school_id, v_item_id, 'MBP-2024-003', 'available',   ''),
      (v_school_id, v_item_id, 'MBP-2024-004', 'maintenance', ''),
      (v_school_id, v_item_id, 'MBP-2024-005', 'available',   '')
    ON CONFLICT DO NOTHING;
  END IF;

  -- Get the projector item
  SELECT id INTO v_item_id FROM inventory_items
  WHERE school_id = v_school_id AND name = 'Epson Projector' LIMIT 1;

  IF v_item_id IS NOT NULL THEN
    INSERT INTO inventory_assets (school_id, item_id, serial_number, status, assigned_user_role) VALUES
      (v_school_id, v_item_id, 'EPS-PRO-101', 'available',   ''),
      (v_school_id, v_item_id, 'EPS-PRO-102', 'checked_out', 'student'),
      (v_school_id, v_item_id, 'EPS-PRO-103', 'lost',        '')
    ON CONFLICT DO NOTHING;
  END IF;

  -- Get the iPad item
  SELECT id INTO v_item_id FROM inventory_items
  WHERE school_id = v_school_id AND name = 'iPad Air' LIMIT 1;

  IF v_item_id IS NOT NULL THEN
    INSERT INTO inventory_assets (school_id, item_id, serial_number, status, assigned_user_role) VALUES
      (v_school_id, v_item_id, 'IPAD-2024-001', 'available',   ''),
      (v_school_id, v_item_id, 'IPAD-2024-002', 'checked_out', 'teacher'),
      (v_school_id, v_item_id, 'IPAD-2024-003', 'available',   '')
    ON CONFLICT DO NOTHING;
  END IF;

  -- Get the chair item
  SELECT id INTO v_item_id FROM inventory_items
  WHERE school_id = v_school_id AND name = 'Office Desk Chair' LIMIT 1;

  IF v_item_id IS NOT NULL THEN
    INSERT INTO inventory_assets (school_id, item_id, serial_number, status, assigned_user_role) VALUES
      (v_school_id, v_item_id, 'CHAIR-001', 'available',   ''),
      (v_school_id, v_item_id, 'CHAIR-002', 'checked_out', 'student'),
      (v_school_id, v_item_id, 'CHAIR-003', 'available',   ''),
      (v_school_id, v_item_id, 'CHAIR-004', 'maintenance', ''),
      (v_school_id, v_item_id, 'CHAIR-005', 'available',   '')
    ON CONFLICT DO NOTHING;
  END IF;

  RAISE NOTICE 'Inserted inventory assets.';

  -- ===========================================================================
  -- 3) INVENTORY TRANSACTIONS (audit trail)
  -- ===========================================================================

  -- Get some item IDs for transactions
  DECLARE
    v_laptop_id    uuid;
    v_projector_id uuid;
    v_paper_id     uuid;
    v_marker_id    uuid;
    v_uniform_id   uuid;
    v_book_id      uuid;
    v_chair_id     uuid;
  BEGIN
    SELECT id INTO v_laptop_id    FROM inventory_items WHERE school_id = v_school_id AND name = 'MacBook Pro 14"'     LIMIT 1;
    SELECT id INTO v_projector_id FROM inventory_items WHERE school_id = v_school_id AND name = 'Epson Projector'     LIMIT 1;
    SELECT id INTO v_paper_id     FROM inventory_items WHERE school_id = v_school_id AND name = 'A4 Printer Paper (Ream)' LIMIT 1;
    SELECT id INTO v_marker_id    FROM inventory_items WHERE school_id = v_school_id AND name = 'Whiteboard Markers (Box)' LIMIT 1;
    SELECT id INTO v_uniform_id   FROM inventory_items WHERE school_id = v_school_id AND name = 'School Uniform (Full Set)' LIMIT 1;
    SELECT id INTO v_book_id      FROM inventory_items WHERE school_id = v_school_id AND name = 'Exercise Book (64 pages)'  LIMIT 1;
    SELECT id INTO v_chair_id     FROM inventory_items WHERE school_id = v_school_id AND name = 'Office Desk Chair'         LIMIT 1;

    -- Purchase transactions (initial provisioning)
    INSERT INTO inventory_transactions (school_id, item_id, transaction_type, quantity, notes, created_at) VALUES
      (v_school_id, v_laptop_id,    'purchase', 5, 'Initial purchase of 5 MacBook Pros',          now() - interval '30 days'),
      (v_school_id, v_projector_id, 'purchase', 3, 'Initial purchase of 3 Epson Projectors',      now() - interval '28 days'),
      (v_school_id, v_paper_id,     'purchase', 20, 'Monthly paper supply',                       now() - interval '14 days'),
      (v_school_id, v_marker_id,    'purchase', 15, 'Termly marker box supply',                    now() - interval '10 days'),
      (v_school_id, v_uniform_id,   'purchase', 30, 'New stock for new term',                     now() - interval '7 days'),
      (v_school_id, v_book_id,      'purchase', 200, 'Bulk purchase for new session',             now() - interval '5 days'),
      (v_school_id, v_chair_id,     'purchase', 5,  'New office chairs for staff room',           now() - interval '3 days')
    ON CONFLICT DO NOTHING;

    -- Checkout transactions (asset assignments)
    -- Find specific asset IDs
    DECLARE
      v_asset1_id uuid;
      v_asset2_id uuid;
      v_asset3_id uuid;
      v_asset4_id uuid;
    BEGIN
      SELECT id INTO v_asset1_id FROM inventory_assets WHERE school_id = v_school_id AND serial_number = 'MBP-2024-002' LIMIT 1;
      SELECT id INTO v_asset2_id FROM inventory_assets WHERE school_id = v_school_id AND serial_number = 'EPS-PRO-102'  LIMIT 1;
      SELECT id INTO v_asset3_id FROM inventory_assets WHERE school_id = v_school_id AND serial_number = 'IPAD-2024-002' LIMIT 1;
      SELECT id INTO v_asset4_id FROM inventory_assets WHERE school_id = v_school_id AND serial_number = 'CHAIR-002'   LIMIT 1;

      IF v_asset1_id IS NOT NULL THEN
        INSERT INTO inventory_transactions (school_id, item_id, asset_id, user_id, user_role, transaction_type, quantity, notes, created_at)
        VALUES (v_school_id, v_laptop_id, v_asset1_id, v_admin_id, 'teacher', 'checkout', 1, 'Checked out to Head of Science', now() - interval '15 days')
        ON CONFLICT DO NOTHING;
      END IF;

      IF v_asset2_id IS NOT NULL THEN
        INSERT INTO inventory_transactions (school_id, item_id, asset_id, user_id, user_role, transaction_type, quantity, notes, created_at)
        VALUES (v_school_id, v_projector_id, v_asset2_id, v_admin_id, 'student', 'checkout', 1, 'Checked out for science fair project', now() - interval '8 days')
        ON CONFLICT DO NOTHING;
      END IF;

      IF v_asset3_id IS NOT NULL THEN
        INSERT INTO inventory_transactions (school_id, item_id, asset_id, user_id, user_role, transaction_type, quantity, notes, created_at)
        VALUES (v_school_id, v_laptop_id, v_asset3_id, v_admin_id, 'teacher', 'checkout', 1, 'Checked out to Art Department', now() - interval '5 days')
        ON CONFLICT DO NOTHING;
      END IF;

      IF v_asset4_id IS NOT NULL THEN
        INSERT INTO inventory_transactions (school_id, item_id, asset_id, user_id, user_role, transaction_type, quantity, notes, created_at)
        VALUES (v_school_id, v_chair_id, v_asset4_id, v_admin_id, 'student', 'checkout', 1, 'Checked out to student common room', now() - interval '2 days')
        ON CONFLICT DO NOTHING;
      END IF;
    END;

    -- Restock transactions
    INSERT INTO inventory_transactions (school_id, item_id, user_id, user_role, transaction_type, quantity, notes, created_at)
    VALUES
      (v_school_id, v_paper_id,  v_admin_id, 'admin', 'restock', 5,  'Restock - printer paper low',                 now() - interval '2 days'),
      (v_school_id, v_marker_id, v_admin_id, 'admin', 'restock', 3,  'Restock - whiteboard markers running low',     now() - interval '1 day')
    ON CONFLICT DO NOTHING;

    -- Sale transactions
    INSERT INTO inventory_transactions (school_id, item_id, user_id, user_role, transaction_type, quantity, notes, created_at)
    VALUES
      (v_school_id, v_uniform_id, v_admin_id, 'admin', 'damage_reported', 1, 'Sold to new student',           now() - interval '3 days'),
      (v_school_id, v_book_id,    v_admin_id, 'admin', 'damage_reported', 30, 'Sold to students in JSS 1',    now() - interval '1 day')
    ON CONFLICT DO NOTHING;
  END;

  RAISE NOTICE 'Inserted inventory transactions.';

  -- ===========================================================================
  -- 4) ADMIN ALERTS (some sample low-stock alerts)
  -- ===========================================================================

  INSERT INTO admin_alerts (school_id, alert_type, title, message, reference_type, reference_id, is_read, created_at)
  SELECT
    v_school_id,
    'low_stock',
    'Low stock: A4 Printer Paper (Ream)',
    'Stock count (5) has fallen below the threshold (20).',
    'inventory_items',
    id,
    false,
    now() - interval '1 day'
  FROM inventory_items
  WHERE school_id = v_school_id AND name = 'A4 Printer Paper (Ream)'
  LIMIT 1
  ON CONFLICT DO NOTHING;

  INSERT INTO admin_alerts (school_id, alert_type, title, message, reference_type, reference_id, is_read, created_at)
  SELECT
    v_school_id,
    'low_stock',
    'Low stock: Hand Sanitizer (1L)',
    'Stock count (3) has fallen below the threshold (10).',
    'inventory_items',
    id,
    false,
    now() - interval '12 hours'
  FROM inventory_items
  WHERE school_id = v_school_id AND name = 'Hand Sanitizer (1L)'
  LIMIT 1
  ON CONFLICT DO NOTHING;

  INSERT INTO admin_alerts (school_id, alert_type, title, message, reference_type, reference_id, is_read, created_at)
  SELECT
    v_school_id,
    'low_stock',
    'Low stock: Mask (Box of 50)',
    'Stock count (2) has fallen below the threshold (5).',
    'inventory_items',
    id,
    true,
    now() - interval '2 days'
  FROM inventory_items
  WHERE school_id = v_school_id AND name = 'Mask (Box of 50)'
  LIMIT 1
  ON CONFLICT DO NOTHING;

  INSERT INTO admin_alerts (school_id, alert_type, title, message, reference_type, reference_id, is_read, created_at)
  SELECT
    v_school_id,
    'maintenance_needed',
    'Asset in maintenance: MacBook Pro 14" (MBP-2024-004)',
    'A MacBook Pro has been flagged for maintenance.',
    'inventory_assets',
    id,
    false,
    now() - interval '1 day'
  FROM inventory_assets
  WHERE school_id = v_school_id AND serial_number = 'MBP-2024-004'
  LIMIT 1
  ON CONFLICT DO NOTHING;

  RAISE NOTICE 'Inserted admin alerts.';

  -- ===========================================================================
  -- Summary
  -- ===========================================================================

  RAISE NOTICE '==================================================';
  RAISE NOTICE 'Inventory seed data complete!';
  RAISE NOTICE 'School: %', v_school_name;
  RAISE NOTICE 'Items created: 12';
  RAISE NOTICE 'Assets created: 16';
  RAISE NOTICE 'Transactions created: 15+';
  RAISE NOTICE 'Alerts created: 4';
  RAISE NOTICE '==================================================';
  RAISE NOTICE '';
  RAISE NOTICE 'Visit /admin/inventory to see the dashboard.';
  RAISE NOTICE 'Visit /admin/inventory/items to manage items.';
END $$;
