import { createClient } from '@supabase/supabase-js';

// Publishable browser key. Database grants and row-level security protect history.
export const supabase = createClient(
  'https://tkuybjpgfmjzsbcpuaol.supabase.co',
  'sb_publishable_Uu-1D-PzLAfB8CcBseBJgA_hcr_OC5d',
  {
    auth: {
      storageKey: 'day-by-day-auth',
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      flowType: 'implicit',
    },
  },
);
