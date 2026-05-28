import { useMemo, useState } from 'react'
import './App.css'
import { PrimrecEditor } from './features/editor/PrimrecEditor'
import { useLocalStorageState } from './features/editor/useLocalStorageState'
import { discoverFunctions, type PrimrecFunction } from './features/primrec/functionDiscovery'

const DEFAULT_SOURCE = `# PrimRec playground (design stub)

# Example-like definitions (syntax TBD)
add(x, y) = ...
mult(x, y) = ...
fac(n) = ...
`

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n))
}

function App() {
  const [source, setSource] = useLocalStorageState('primrec.source', DEFAULT_SOURCE)
  const [editorFontSize, setEditorFontSize] = useLocalStorageState('primrec.editorFontSize', 14)
  const [selectedName, setSelectedName] = useState<string>('fac')

  const functions = useMemo(() => discoverFunctions(source), [source])

  // Keep selection stable without "fixing" state in an effect.
  // If the selected function disappears (e.g. user edits the name), we fall back to the first entry.
  const effectiveSelectedName = useMemo(() => {
    if (functions.length === 0) return undefined
    return functions.some((f) => f.name === selectedName) ? selectedName : functions[0].name
  }, [functions, selectedName])

  const selectedFn: PrimrecFunction | undefined = useMemo(() => {
    if (!effectiveSelectedName) return undefined
    return functions.find((f) => f.name === effectiveSelectedName) ?? functions[0]
  }, [functions, effectiveSelectedName])

  return (
    <div className="appRoot">
      <main className="workspace">
        <section className="editorPane" aria-label="Editor">
          <div className="paneHeader">
            <div className="paneHeaderRow">
              <div className="paneTitle">Editor</div>
            </div>
            <div className="paneSubRow">
              <div className="paneHint">Funktionen werden automatisch erkannt (derzeit Heuristik + Dummy-Fallback)</div>
              <div className="zoomControls" aria-label="Editor font size">
                <button
                  className="iconBtn"
                  type="button"
                  onClick={() => setEditorFontSize((s) => clamp(s - 1, 10, 28))}
                  aria-label="Decrease editor font size"
                  title="Decrease editor font size"
                >
                  A-
                </button>
                <div className="zoomValue" title="Editor font size">
                  {editorFontSize}px
                </div>
                <button
                  className="iconBtn"
                  type="button"
                  onClick={() => setEditorFontSize((s) => clamp(s + 1, 10, 28))}
                  aria-label="Increase editor font size"
                  title="Increase editor font size"
                >
                  A+
                </button>
                <button
                  className="iconBtn"
                  type="button"
                  onClick={() => setEditorFontSize(14)}
                  aria-label="Reset editor font size"
                  title="Reset editor font size"
                >
                  Reset
                </button>
              </div>
            </div>
          </div>
          <div className="paneBody">
            <PrimrecEditor value={source} onChange={setSource} fontSize={editorFontSize} />
          </div>
        </section>

        <aside className="sidePane" aria-label="Tools">
          <FunctionsPanel
            functions={functions}
            selectedName={effectiveSelectedName}
            onSelect={(name) => setSelectedName(name)}
          />
          <RunnerPanel fn={selectedFn} />
          <VerifierPanel fn={selectedFn} />
        </aside>
      </main>
    </div>
  )
}

function FunctionsPanel({
  functions,
  selectedName,
  onSelect,
}: {
  functions: PrimrecFunction[]
  selectedName?: string
  onSelect: (name: string) => void
}) {
  const [q, setQ] = useState('')
  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase()
    if (!needle) return functions
    return functions.filter((f) => f.name.toLowerCase().includes(needle))
  }, [functions, q])

  return (
    <section className="panel functionsPanel">
      <div className="panelHeader">
        <div className="panelTitle">Functions</div>
        <input
          className="input"
          placeholder="Search…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          aria-label="Search functions"
        />
      </div>

      <div className="list" role="list">
        {filtered.length === 0 ? (
          <div className="empty">Keine Treffer</div>
        ) : (
          filtered.map((f) => {
            const active = f.name === selectedName
            return (
              <button
                key={f.name}
                className={active ? 'listItem active' : 'listItem'}
                onClick={() => onSelect(f.name)}
                type="button"
              >
                <div className="listItemMain">
                  <div className="fnName">{f.name}</div>
                  <div className="fnMeta">arity: {f.arity ?? '—'}</div>
                </div>
                {f.location ? <div className="fnLoc">L{f.location.line}</div> : null}
              </button>
            )
          })
        )}
      </div>
    </section>
  )
}

function RunnerPanel({ fn }: { fn?: PrimrecFunction }) {
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

function VerifierPanel({ fn }: { fn?: PrimrecFunction }) {
  const [post, setPost] = useState('result >= 0')
  const [result, setResult] = useState<string>('')

  function verify() {
    setResult(fn ? `Verified (stub): ${fn.name} satisfies “${post}”` : 'No function selected.')
  }

  return (
    <section className="panel verifierPanel">
      <div className="panelHeader">
        <div className="panelTitle">Verify</div>
        <button className="btn" type="button" onClick={verify} disabled={!fn}>
          Verify
        </button>
      </div>

      <div className="verifierBody">
        <div className="field verifierPost">
          <div className="label">Postcondition</div>
          {/* Only this textarea should scroll; the result is pinned at the bottom. */}
          <textarea className="textarea postTextarea" value={post} onChange={(e) => setPost(e.target.value)} />
        </div>

        <div className="field verifierResult">
          <div className="label">Result</div>
          <pre className="output">{result || '—'}</pre>
        </div>
      </div>
    </section>
  )
}

export default App
