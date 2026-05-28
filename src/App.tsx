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

function App() {
  const [source, setSource] = useLocalStorageState('primrec.source', DEFAULT_SOURCE)
  const [selectedName, setSelectedName] = useState<string>('fac')

  const functions = useMemo(() => discoverFunctions(source), [source])
  const selectedFn: PrimrecFunction | undefined = functions.find((f) => f.name === selectedName) ?? functions[0]

  // Keep selection stable when list changes
  if (selectedFn && selectedFn.name !== selectedName) setSelectedName(selectedFn.name)

  return (
    <div className="appRoot">
      <header className="topBar">
        <div className="brand">
          <div className="brandTitle">PrimRec</div>
          <div className="brandSub">Interpreter & Verifier (UI stub)</div>
        </div>
        <div className="topBarActions">
          <a className="link" href="https://vite.dev" target="_blank" rel="noreferrer">
            Vite
          </a>
          <a className="link" href="https://react.dev" target="_blank" rel="noreferrer">
            React
          </a>
        </div>
      </header>

      <main className="workspace">
        <section className="editorPane" aria-label="Editor">
          <div className="paneHeader">
            <div className="paneTitle">Editor</div>
            <div className="paneHint">Funktionen werden automatisch erkannt (derzeit Heuristik + Dummy-Fallback)</div>
          </div>
          <div className="paneBody">
            <PrimrecEditor value={source} onChange={setSource} />
          </div>
        </section>

        <aside className="sidePane" aria-label="Tools">
          <FunctionsPanel
            functions={functions}
            selectedName={selectedFn?.name}
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
    <section className="panel">
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
  const [rawInputs, setRawInputs] = useState('[1, 2]')
  const [output, setOutput] = useState<string>('')

  function run() {
    setOutput(
      fn
        ? `Result (stub): ${fn.name}(${rawInputs}) = …`
        : 'No function selected.',
    )
  }

  return (
    <section className="panel">
      <div className="panelHeader">
        <div className="panelTitle">Run</div>
        <button className="btn" type="button" onClick={run} disabled={!fn}>
          Run
        </button>
      </div>
      <div className="field">
        <div className="label">Inputs (JSON array)</div>
        <input className="input" value={rawInputs} onChange={(e) => setRawInputs(e.target.value)} />
      </div>
      <div className="field">
        <div className="label">Output</div>
        <pre className="output">{output || '—'}</pre>
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
    <section className="panel">
      <div className="panelHeader">
        <div className="panelTitle">Verify</div>
        <button className="btn" type="button" onClick={verify} disabled={!fn}>
          Verify
        </button>
      </div>
      <div className="field">
        <div className="label">Postcondition</div>
        <textarea className="textarea" value={post} onChange={(e) => setPost(e.target.value)} rows={3} />
      </div>
      <div className="field">
        <div className="label">Result</div>
        <pre className="output">{result || '—'}</pre>
      </div>
    </section>
  )
}

export default App
