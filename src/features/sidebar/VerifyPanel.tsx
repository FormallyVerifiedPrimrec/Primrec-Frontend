import type { ParseResult } from '../../primrecLanguage'
import type { PrimrecFunction } from '../primrec/functionDiscovery'

export function VerifyPanel({
  fn,
  parseResult,
  postcondition,
  setPostcondition,
}: {
  fn?: PrimrecFunction
  parseResult: ParseResult
  postcondition: string
  setPostcondition: (val: string) => void
}) {
  const selectedDefinition = fn
    ? parseResult.program?.functions.find((definition) => definition.name === fn.name)
    : undefined

  return (
    <section className="panel verifyPanel">
      <div className="panelHeader">
        <div className="panelTitle">Verify</div>
      </div>

      <div className="panelContent">
        <div className="field">
          <div className="label">Postcondition</div>
          <textarea
            className="textarea"
            rows={2}
            placeholder="e.g. f(x, y) = x + y"
            value={postcondition}
            onChange={(e) => setPostcondition(e.target.value)}
          />
        </div>

        <div className="field selectedSummary">
          <div className="label">Selected function</div>
          {fn ? (
            <pre className="output">
              {selectedDefinition
                ? formatSelectedDefinition(selectedDefinition.name, selectedDefinition.dependencies)
                : `${fn.name}/${fn.arity}\nWaiting for a valid program.`}
            </pre>
          ) : (
            <div className="empty">No function selected</div>
          )}
        </div>
      </div>
    </section>
  )
}

function formatSelectedDefinition(name: string, dependencies: string[]) {
  const renderedDependencies = dependencies.length > 0 ? dependencies.join(', ') : 'none'
  return `${name}\ndependencies: ${renderedDependencies}`
}
