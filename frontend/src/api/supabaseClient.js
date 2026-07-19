/**
 * Supabase client.
 *
 * Replaces axiosInstance.js -- there is no separate Flask API anymore.
 * The anon key is safe to expose in the browser: it identifies your
 * project, not a privileged user. Row Level Security (see schema.sql)
 * is what actually decides what each signed-in user can read/write.
 */

import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY. Copy .env.example to .env and fill in your project's values from Project Settings > API."
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
});
