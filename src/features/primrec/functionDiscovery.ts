export type PrimrecFunction = {
  name: string
  arity?: number
  params?: string[]
  location?: { line: number }
}

const DUMMY_FUNCTIONS: PrimrecFunction[] = [
  { name: 'add', arity: 2, params: ['x', 'y'] },
  { name: 'mult', arity: 2, params: ['x', 'y'] },
  { name: 'fac', arity: 1, params: ['n'] },
  { name: 'pow', arity: 2, params: ['x', 'y'] },
]

// Temporary heuristic until the real PrimRec grammar exists.
// Supports patterns like:
//   f(x, y) = ...
//   f = ...
//   f := ...
export function discoverFunctions(source: string): PrimrecFunction[] {
  const found: PrimrecFunction[] = []

  // Very small, permissive regex to "discover" function headers without a real parser yet.
  // Captures:
  //   - function name
  //   - optional comma-separated parameter list in (...)
  // and accepts either "=" or ":=" as the definition operator.
  const re = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*(?:\(([^)]*)\))?\s*(?::=|=)/gm
  let m: RegExpExecArray | null

  while ((m = re.exec(source)) !== null) {
    const name = m[1]
    const args = (m[2] ?? '').trim()

    // Map match index -> 1-based line number (useful for showing "L42" in the UI).
    const prefix = source.slice(0, m.index)
    const line = prefix.split(/\r\n|\r|\n/).length

    const params = args
      ? args
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)
      : undefined

    const arity = params ? params.length : undefined

    if (!found.some((f) => f.name === name)) {
      found.push({ name, arity, params, location: { line } })
    }
  }

  return found.length ? found : DUMMY_FUNCTIONS
}
