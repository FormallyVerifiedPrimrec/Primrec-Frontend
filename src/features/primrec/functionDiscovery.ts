export type PrimrecFunction = {
  name: string
  arity?: number
  location?: { line: number }
}

const DUMMY_FUNCTIONS: PrimrecFunction[] = [
  { name: 'add', arity: 2 },
  { name: 'mult', arity: 2 },
  { name: 'fac', arity: 1 },
  { name: 'pow', arity: 2 },
]

// Temporary heuristic until the real PrimRec grammar exists.
// Supports patterns like:
//   f(x, y) = ...
//   f = ...
//   f := ...
export function discoverFunctions(source: string): PrimrecFunction[] {
  const found: PrimrecFunction[] = []

  const re = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*(?:\(([^)]*)\))?\s*(?::=|=)/gm
  let m: RegExpExecArray | null

  while ((m = re.exec(source)) !== null) {
    const name = m[1]
    const args = (m[2] ?? '').trim()

    const prefix = source.slice(0, m.index)
    const line = prefix.split(/\r\n|\r|\n/).length

    const arity = args
      ? args
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean).length
      : undefined

    if (!found.some((f) => f.name === name)) {
      found.push({ name, arity, location: { line } })
    }
  }

  return found.length ? found : DUMMY_FUNCTIONS
}
