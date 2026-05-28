import { useMemo, useState } from 'react'
import type { PrimrecFunction } from '../primrec/functionDiscovery'

export function FunctionsPanel({
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
                  <div className="fnMeta">
                    {f.name}({f.params.join(', ')}) / arity {f.arity}
                  </div>
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
