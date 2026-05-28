import type { ParseResult } from '../../primrecLanguage'
import type { PrimrecFunction } from '../primrec/functionDiscovery'

export function DiagnosticsPanel({
  fn,
  parseResult,
}: {
  fn?: PrimrecFunction
  parseResult: ParseResult
}) {
  const selectedDefinition = fn
    ? parseResult.program?.functions.find((definition) => definition.name === fn.name)
    : undefined

  const diagnostics = parseResult.diagnostics

  return (
    <section className="panel diagnosticsPanel">
      <div className="panelHeader">
        <div className="panelTitle">Diagnostics</div>
        <div className={diagnostics.length === 0 ? 'statusBadge ok' : 'statusBadge error'}>
          {diagnostics.length === 0 ? 'valid' : `${diagnostics.length} issue${diagnostics.length === 1 ? '' : 's'}`}
        </div>
      </div>

      <div className="diagnosticsBody">
        <div className="field diagnosticsList">
          <div className="label">Parser and validation</div>
          {diagnostics.length === 0 ? (
            <div className="empty">No diagnostics</div>
          ) : (
            <div className="issueList">
              {diagnostics.map((diagnostic, index) => (
                <div className="issueItem" key={`${diagnostic.code}:${index}`}>
                  <div className="issueHeader">
                    <span className="issueCode">{diagnostic.code}</span>
                    <span>
                      L{diagnostic.range.start.line}:C{diagnostic.range.start.column}
                    </span>
                  </div>
                  <div className="issueMessage">{diagnostic.message}</div>
                </div>
              ))}
            </div>
          )}
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
