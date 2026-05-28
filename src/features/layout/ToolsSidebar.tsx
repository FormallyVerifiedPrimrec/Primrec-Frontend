import type { PrimrecFunction } from '../primrec/functionDiscovery'
import { FunctionsPanel } from '../sidebar/FunctionsPanel'
import { RunnerPanel } from '../sidebar/RunnerPanel'
import { VerifierPanel } from '../sidebar/VerifierPanel'

export function ToolsSidebar({
  functions,
  selectedName,
  onSelect,
  selectedFn,
}: {
  functions: PrimrecFunction[]
  selectedName?: string
  onSelect: (name: string) => void
  selectedFn?: PrimrecFunction
}) {
  return (
    <aside className="sidePane" aria-label="Tools">
      <FunctionsPanel functions={functions} selectedName={selectedName} onSelect={onSelect} />
      <RunnerPanel fn={selectedFn} />
      <VerifierPanel fn={selectedFn} />
    </aside>
  )
}
