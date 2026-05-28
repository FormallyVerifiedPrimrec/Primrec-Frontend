import { useMemo, useState } from 'react'
import { preprocessProgram } from '../../primrecLanguage/interpreter'
import type { ParseResult } from '../../primrecLanguage'
import type { PrimrecFunction } from '../primrec/functionDiscovery'

export function RunnerPanel({ fn, parseResult }: { fn?: PrimrecFunction; parseResult: ParseResult }) {
  // Preserve per-function input values while switching between functions.
  const [inputsByFn, setInputsByFn] = useState<Record<string, string[]>>({})

  const paramNames = useMemo(() => {
    if (!fn) return [] as string[]
    return fn.params.length > 0 ? fn.params : Array.from({ length: fn.arity }, (_, i) => `arg${i + 1}`)
  }, [fn])

  const values = useMemo(() => {
    if (!fn) return [] as string[]
    const existing = inputsByFn[fn.name] ?? []
    const normalized = existing.slice(0, paramNames.length)
    while (normalized.length < paramNames.length) normalized.push('')
    return normalized
  }, [fn, inputsByFn, paramNames.length])

  const compiledProgram = useMemo(() => {
    if (!parseResult.program) return undefined
    return preprocessProgram(parseResult.program, { memoize: true })
  }, [parseResult.program])

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

  const output = useMemo(() => {
    if (!fn) return ''

    const renderedArgs = paramNames
      .map((param, index) => {
        const trimmed = values[index].trim()
        return `${param}=${/^\d+$/.test(trimmed) ? trimmed : '?'}`
      })
      .join(', ')
    const preview = `${fn.name}(${renderedArgs}) =`

    if (!parseResult.program) {
      const firstError = parseResult.diagnostics.find((item) => item.severity === 'error')
      return firstError ? `Program is invalid: ${firstError.message}` : 'Program is invalid.'
    }

    const parsedArgs: number[] = []
    let hasMissingInput = false

    for (let index = 0; index < values.length; index += 1) {
      const trimmed = values[index].trim()
      if (trimmed === '') {
        hasMissingInput = true
        continue
      }

      if (!/^\d+$/.test(trimmed)) {
        return `Input '${paramNames[index]}' must be a natural number.`
      }
      parsedArgs.push(Number(trimmed))
    }

    if (hasMissingInput) return preview

    if (parsedArgs.some((value) => !Number.isSafeInteger(value))) {
      return 'Inputs must be safe natural numbers.'
    }

    try {
      const result = compiledProgram!.evaluate(fn.name, parsedArgs)
      return `${fn.name}(${renderedArgs}) = ${result}`
    } catch (error) {
      return error instanceof Error ? error.message : 'Evaluation failed.'
    }
  }, [compiledProgram, fn, paramNames, parseResult.diagnostics, parseResult.program, values])

  return (
    <section className="panel runnerPanel">
      <div className="panelHeader">
        <div className="panelTitle">Run</div>
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
          <pre className="output" aria-label="Output" aria-live="polite">{output}</pre>
        </div>
      </div>
    </section>
  )
}
