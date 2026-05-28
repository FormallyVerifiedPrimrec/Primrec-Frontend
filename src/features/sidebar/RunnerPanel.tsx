import { useMemo, useState } from 'react'
import { evaluatePrimRecFunction } from '../../primrecLanguage/interpreter'
import type { ParseResult } from '../../primrecLanguage'
import type { PrimrecFunction } from '../primrec/functionDiscovery'

export function RunnerPanel({ fn, parseResult }: { fn?: PrimrecFunction; parseResult: ParseResult }) {
  // Preserve per-function input values while switching between functions.
  const [inputsByFn, setInputsByFn] = useState<Record<string, string[]>>({})
  const [output, setOutput] = useState<string>('')

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

    if (!parseResult.program) {
      const firstError = parseResult.diagnostics.find((item) => item.severity === 'error')
      setOutput(firstError ? `Program is invalid: ${firstError.message}` : 'Program is invalid.')
      return
    }

    const parsedArgs: number[] = []
    for (let index = 0; index < values.length; index += 1) {
      const trimmed = values[index].trim()
      if (!/^\d+$/.test(trimmed)) {
        setOutput(`Input '${paramNames[index]}' must be a natural number.`)
        return
      }
      parsedArgs.push(Number(trimmed))
    }

    if (parsedArgs.some((value) => !Number.isSafeInteger(value))) {
      setOutput('Inputs must be safe natural numbers.')
      return
    }

    try {
      const result = evaluatePrimRecFunction(parseResult.program, fn.name, parsedArgs)
      const renderedArgs = paramNames.map((p, i) => `${p}=${parsedArgs[i]}`).join(', ')
      setOutput(`${fn.name}(${renderedArgs}) = ${result}`)
    } catch (error) {
      setOutput(error instanceof Error ? error.message : 'Evaluation failed.')
    }
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
          <pre className="output">{output || 'No result yet'}</pre>
        </div>
      </div>
    </section>
  )
}
