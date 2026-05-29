type RuntimeEnvKey =
  | 'VITE_SUPABASE_URL'
  | 'VITE_SUPABASE_ANON_KEY'
  | 'VITE_CHALLENGES_API_URL'
  // Base path/URL of the solver backend used for formal verification. Defaults
  // to '/solver' (reverse-proxied to the solver-backend container by Caddy).
  | 'VITE_SOLVER_API_URL'

type RuntimeEnv = Partial<Record<RuntimeEnvKey, string>>

declare global {
  interface Window {
    __PRIMREC_ENV__?: RuntimeEnv
  }
}

const viteEnv = import.meta.env as Partial<Record<RuntimeEnvKey, string>>

function present(value: string | undefined): string | undefined {
  return value && value.length > 0 ? value : undefined
}

export function getRuntimeEnv(key: RuntimeEnvKey, fallback = ''): string {
  return present(window.__PRIMREC_ENV__?.[key]) ?? present(viteEnv[key]) ?? fallback
}
