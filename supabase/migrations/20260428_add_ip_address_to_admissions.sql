-- Add missing client IP address column used by admissions submission APIs
-- Safe to run multiple times

ALTER TABLE admissions
  ADD COLUMN IF NOT EXISTS ip_address text DEFAULT '';

COMMENT ON COLUMN admissions.ip_address IS 'Client IP captured at submission time for basic fraud/rate-limit analysis';
