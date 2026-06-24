import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
// Nueva "secret key" de Supabase (reemplaza service_role, deshabilitada el
// 2026-06-22). Fallback a la legacy mientras dure la transición.
const serviceRoleKey = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.warn(
    '[Supabase Server] NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY no están configuradas.'
  );
}

export const supabaseServer = createClient(
  supabaseUrl ?? 'https://placeholder.supabase.co',
  serviceRoleKey ?? 'placeholder-key',
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  }
);
