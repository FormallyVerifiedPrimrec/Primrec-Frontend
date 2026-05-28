import type { PrimrecFunction } from '../primrec/functionDiscovery'
import type { ParseResult } from '../../primrecLanguage'
import { FunctionsPanel } from '../sidebar/FunctionsPanel'
import { RunnerPanel } from '../sidebar/RunnerPanel'
import { DiagnosticsPanel } from '../sidebar/DiagnosticsPanel'

export function ToolsSidebar({
  functions,
  selectedName,
  onSelect,
  selectedFn,
  parseResult,
}: {
  functions: PrimrecFunction[]
  selectedName?: string
  onSelect: (name: string) => void
  selectedFn?: PrimrecFunction
  parseResult: ParseResult
}) {
  return (
    <aside className="sidePane" aria-label="Tools">
      <FunctionsPanel
        functions={functions}
        selectedName={selectedName}
        onSelect={onSelect}
        parseResult={parseResult}
      />
      <RunnerPanel fn={selectedFn} parseResult={parseResult} />
      <DiagnosticsPanel fn={selectedFn} parseResult={parseResult} />
    </aside>
  )
}
