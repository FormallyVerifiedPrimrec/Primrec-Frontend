#!/bin/sh
set -eu

escape_js_string() {
  printf '%s' "$1" | sed 's/\\/\\\\/g; s/"/\\"/g'
}

cat > /srv/runtime-config.js <<EOF
window.__PRIMREC_ENV__ = {
  VITE_SUPABASE_URL: "$(escape_js_string "${VITE_SUPABASE_URL:-}")",
  VITE_SUPABASE_ANON_KEY: "$(escape_js_string "${VITE_SUPABASE_ANON_KEY:-}")",
  VITE_CHALLENGES_API_URL: "$(escape_js_string "${VITE_CHALLENGES_API_URL:-/api}")",
  VITE_SOLVER_API_URL: "$(escape_js_string "${VITE_SOLVER_API_URL:-/solver}")"
};
EOF

exec "$@"
