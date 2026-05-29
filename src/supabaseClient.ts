import { createClient } from '@supabase/supabase-js';
import { getRuntimeEnv } from './config/runtimeEnv';

const supabaseUrl = getRuntimeEnv('VITE_SUPABASE_URL');
const supabaseAnonKey = getRuntimeEnv('VITE_SUPABASE_ANON_KEY');

// Supabase validates constructor arguments eagerly. Keep the client importable
// while AuthContext blocks auth flows when the real runtime config is missing.
export const supabase = createClient(
  supabaseUrl || 'http://localhost',
  supabaseAnonKey || 'missing-anon-key',
);

export const isSupabaseConfigured = !!(supabaseUrl && supabaseAnonKey);
