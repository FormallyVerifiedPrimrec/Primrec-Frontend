import '@testing-library/jest-dom/vitest';

window.__PRIMREC_ENV__ = {
  VITE_SUPABASE_URL: 'http://localhost',
  VITE_SUPABASE_ANON_KEY: 'test-anon-key',
  VITE_CHALLENGES_API_URL: '/api',
};
