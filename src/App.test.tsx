import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import App from './App'

vi.mock('@monaco-editor/react', () => ({
  default: ({ value }: { value: string }) => (
    <textarea aria-label="Monaco editor" readOnly value={value} />
  ),
}))

describe('App', () => {
  it('renders the functional PrimRec workspace', () => {
    render(<App />)

    expect(screen.getByLabelText('Monaco editor')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Run' })).toBeInTheDocument()
    expect(screen.getByText('Diagnostics')).toBeInTheDocument()
    expect(screen.getAllByText(/plus\(x, y\)/).length).toBeGreaterThan(0)
  })
})
