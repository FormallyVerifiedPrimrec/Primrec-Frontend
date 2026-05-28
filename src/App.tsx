import { useMemo, useState } from 'react'
import './App.css'
import { PrimrecEditor } from './features/editor/PrimrecEditor'
import { useLocalStorageState } from './features/editor/useLocalStorageState'
import { discoverFunctions, type PrimrecFunction } from './features/primrec/functionDiscovery'
import { FunctionsPanel } from './features/sidebar/FunctionsPanel'
import { RunnerPanel } from './features/sidebar/RunnerPanel'
import { VerifierPanel } from './features/sidebar/VerifierPanel'

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

export default App
