import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

// Use auth-helpers client for proper cookie-based session management
export const supabase = createClientComponentClient();
