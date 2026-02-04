-- Fix: Assign super_admin role to codenova02@gmail.com
-- Run this in your Supabase SQL Editor

-- First, let's see what user_id corresponds to this email
-- (You'll need to check in the Supabase dashboard under Authentication > Users)

-- Replace 'YOUR_USER_ID_HERE' with the actual UUID of the user
INSERT INTO user_role_links (user_id, role_id)
VALUES (
  '20b92bf4-1bb9-4694-a09e-57746987e05a',  -- Replace with actual user ID
  (SELECT id FROM roles WHERE name = 'super_admin')
)
ON CONFLICT DO NOTHING;

-- Or if you want to assign the 'admin' role instead:
-- INSERT INTO user_role_links (user_id, role_id)
-- VALUES (
--   'YOUR_USER_ID_HERE',
--   (SELECT id FROM roles WHERE name = 'admin')
-- )
-- ON CONFLICT DO NOTHING;
