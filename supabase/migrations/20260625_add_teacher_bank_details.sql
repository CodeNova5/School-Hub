-- ============================================================================
-- ADD TEACHER BANK DETAILS COLUMNS
-- Adds bank account columns to the teachers table for Paystack subaccount
-- integration and salary payments.
-- ============================================================================

BEGIN;

-- Add bank detail columns to teachers table
ALTER TABLE teachers ADD COLUMN IF NOT EXISTS bank_name text;
ALTER TABLE teachers ADD COLUMN IF NOT EXISTS bank_code text;
ALTER TABLE teachers ADD COLUMN IF NOT EXISTS account_number text;
ALTER TABLE teachers ADD COLUMN IF NOT EXISTS account_name text;

COMMIT;
