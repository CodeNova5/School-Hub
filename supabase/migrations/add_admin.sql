-- First, verify the roles exist
SELECT * FROM roles;

-- Check if you're already in user_role_links
SELECT * FROM user_role_links WHERE user_id = '20b92bf4-1bb9-4694-a09e-57746987e05a';

-- If not, insert yourself as super_admin
INSERT INTO user_role_links (user_id, role_id)
VALUES (
  '20b92bf4-1bb9-4694-a09e-57746987e05a',
  (SELECT id FROM roles WHERE name = 'super_admin')
)
ON CONFLICT DO NOTHING;

-- Verify it was inserted
SELECT 
  url.user_id,
  r.name as role_name,
  au.email
FROM user_role_links url
JOIN roles r ON r.id = url.role_id
LEFT JOIN auth.users au ON au.id = url.user_id
WHERE url.user_id = '20b92bf4-1bb9-4694-a09e-57746987e05a';