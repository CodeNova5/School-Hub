-- Query to check if parents have school_id set
SELECT 
  id,
  user_id,
  name,
  email,
  school_id,
  created_at
FROM parents
LIMIT 10;

-- Also check notification_tokens to see what's being stored
SELECT 
  id,
  user_id,
  token,
  role,
  school_id,
  created_at
FROM notification_tokens
ORDER BY created_at DESC
LIMIT 10;
