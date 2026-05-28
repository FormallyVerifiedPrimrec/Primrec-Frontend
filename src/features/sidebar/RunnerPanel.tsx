import { useMemo, useState } from 'react'
import type { PrimrecFunction } from '../primrec/functionDiscovery'

export function RunnerPanel({ fn }: { fn?: PrimrecFunction }) {
  // Preserve per-function input values while switching between functions.
  const [inputsByFn, setInputsByFn] = useState<Record<string, string[]>>({})
  const [output, setOutput] = useState<string>('')

  const paramNames = useMemo(() => {
    if (!fn) return [] as string[]
    if (fn.params && fn.params.length) return fn.params
    const count = fn.arity ?? 0
    return Array.from({ length: count }, (_, i) => `arg${i + 1}`)
  }, [fn])

  const values = useMemo(() => {
    if (!fn) return [] as string[]
    const existing = inputsByFn[fn.name] ?? []
    const normalized = existing.slice(0, paramNames.length)
    while (normalized.length < paramNames.length) normalized.push('')
    return normalized
  }, [fn, inputsByFn, paramNames.length])

  function setAt(idx: number, next: string) {
    if (!fn) return
    setInputsByFn((prev) => {
      const current = prev[fn.name] ?? []
      const copy = current.slice()
      while (copy.length < paramNames.length) copy.push('')
      copy[idx] = next
      return { ...prev, [fn.name]: copy }
    })
  }

  function run() {
    if (!fn) {
      setOutput('No function selected.')
      return
    }

    const renderedArgs = paramNames
      .map((p, i) => `${p}=${values[i] === '' ? '…' : values[i]}`)
      .join(', ')

    setOutput(`Result (stub): ${fn.name}(${renderedArgs}) = …`)
  }

  return (
    <section className="panel runnerPanel">
      <div className="panelHeader">
        <div className="panelTitle">Run</div>
        <button className="btn" type="button" onClick={run} disabled={!fn}>
          Run
        </button>
      </div>

      {/* Inputs area scrolls; output stays pinned at the bottom of the panel. */}
      <div className="runnerBody">
        <div className="field runnerInputs">
          <div className="label">Inputs</div>
          {fn && paramNames.length > 0 ? (
            <div className="inputsGrid">
              {paramNames.map((p, i) => (
                <input
                  key={`${fn.name}:${p}:${i}`}
                  className="input"
                  placeholder={p}
                  value={values[i] ?? ''}
                  onChange={(e) => setAt(i, e.target.value)}
                  inputMode="numeric"
                  aria-label={`Input ${p}`}
                />
              ))}
            </div>
          ) : (
            <div className="empty">No inputs</div>
          )}
        </div>

        <div className="field runnerOutput">
          <div className="label">Output</div>
          <pre className="output">{output || '—'}</pre>
        </div>
      </div>
    </section>
  )
}
