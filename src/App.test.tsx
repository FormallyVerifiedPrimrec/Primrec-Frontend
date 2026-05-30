import { render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'

const sourceWithPlus = `plusBase(x) = x;

plusStep(x, y, previous) = succ(previous);

plus(x, y) = primrec(plusBase, plusStep);`

const localStorageMock = (() => {
  let store: Record<string, string> = {}
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => { store[key] = value },
    removeItem: (key: string) => { delete store[key] },
    clear: () => { store = {} },
  }
})()

Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock })

vi.mock('./features/auth/AuthContext', () => ({
  AuthProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
  useAuth: () => ({
    session: { user: { id: 'test-user' } },
    isSupabaseLoading: false,
    initError: null,
  }),
}))

vi.mock('@monaco-editor/react', () => ({
  default: ({ value }: { value: string }) => (
    <textarea aria-label="Monaco editor" readOnly value={value} />
  ),
}))

describe('App', () => {
  beforeEach(() => {
    localStorage.clear()
    localStorage.setItem('primrec.source', JSON.stringify(sourceWithPlus))
  })

  it('renders the functional PrimRec workspace', async () => {
    render(<App />)

    expect(await screen.findByLabelText('Monaco editor')).toBeInTheDocument()
    expect(screen.getByText('Run')).toBeInTheDocument()
    expect(screen.getByText('Verify')).toBeInTheDocument()
    expect(screen.getAllByText(/plus\(x, y\)/).length).toBeGreaterThan(0)
  })
})
