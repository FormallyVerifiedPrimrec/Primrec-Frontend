import { afterEach, describe, expect, it, vi } from 'vitest';
import { solveSmt } from './solverClient';

function mockFetch(impl: typeof fetch) {
  vi.stubGlobal('fetch', vi.fn(impl));
}

afterEach(() => {
  vi.unstubAllGlobals();
});

function jsonResponse(body: unknown, ok = true, status = 200): Response {
  return {
    ok,
    status,
    text: async () => JSON.stringify(body),
  } as unknown as Response;
}

describe('solveSmt', () => {
  it('maps sat to verified', async () => {
    mockFetch(async () => jsonResponse({ status: 'sat', output: 'sat' }));
    const result = await solveSmt('(check-sat)', { baseUrl: '/solver' });
    expect(result.status).toBe('verified');
  });

  it('maps unsat to failed and keeps the counter-example', async () => {
    mockFetch(async () => jsonResponse({ status: 'unsat', output: 'unsat\n(model ...)' }));
    const result = await solveSmt('(check-sat)', { baseUrl: '/solver' });
    expect(result.status).toBe('failed');
    expect(result.counterExample).toContain('model');
  });

  it('maps timeout to unknown with a note', async () => {
    mockFetch(async () => jsonResponse({ status: 'timeout', output: '' }));
    const result = await solveSmt('(check-sat)', { baseUrl: '/solver' });
    expect(result.status).toBe('unknown');
    expect(result.message).toMatch(/timed out/i);
  });

  it('treats HTTP errors as solver errors', async () => {
    mockFetch(async () => jsonResponse({}, false, 500));
    const result = await solveSmt('(check-sat)', { baseUrl: '/solver' });
    expect(result.status).toBe('error');
  });

  it('falls back to classifying plain-text output', async () => {
    mockFetch(
      async () =>
        ({ ok: true, status: 200, text: async () => 'unsat' }) as unknown as Response,
    );
    const result = await solveSmt('(check-sat)', { baseUrl: '/solver' });
    expect(result.status).toBe('failed');
  });

  it('builds the /solve URL from the base and strips trailing slashes', async () => {
    const spy = vi.fn(async () => jsonResponse({ status: 'sat' }));
    mockFetch(spy as unknown as typeof fetch);
    await solveSmt('x', { baseUrl: '/solver/' });
    expect(spy).toHaveBeenCalledWith('/solver/solve', expect.objectContaining({ method: 'POST' }));
  });

  it('propagates abort errors', async () => {
    mockFetch(async () => {
      throw new DOMException('aborted', 'AbortError');
    });
    await expect(solveSmt('x', { baseUrl: '/solver' })).rejects.toBeInstanceOf(DOMException);
  });
});
