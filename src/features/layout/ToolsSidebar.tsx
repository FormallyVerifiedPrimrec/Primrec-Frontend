import type { PrimrecFunction } from '../primrec/functionDiscovery'
import type { ParseResult } from '../../primrecLanguage'
import { FunctionsPanel } from '../sidebar/FunctionsPanel'
import { RunnerPanel } from '../sidebar/RunnerPanel'
import { VerifyPanel } from '../sidebar/VerifyPanel'
import { ChallengeDetails } from '../challenges/ChallengeDetails'
import type { Challenge, SubmissionResult } from '../challenges/types'

export function ToolsSidebar({
  functions,
  selectedName,
  onSelect,
  selectedFn,
  parseResult,
  postcondition,
  setPostcondition,
  currentChallenge,
  submissionResult,
  onBack,
}: {
  functions: PrimrecFunction[]
  selectedName?: string
  onSelect: (name: string) => void
  selectedFn?: PrimrecFunction
  parseResult: ParseResult
  postcondition: string
  setPostcondition: (val: string) => void
  currentChallenge?: Challenge
  submissionResult?: SubmissionResult
  onBack?: () => void
}) {
  return (
    <aside className="sidePane" aria-label="Tools">
      {currentChallenge && onBack && (
        <section className="panel challengePanel">
          <div className="panelHeader">
            <div className="panelTitle">Challenge Info</div>
          </div>
          <div className="panelContent">
            <ChallengeDetails 
              challenge={currentChallenge} 
              submissionResult={submissionResult} 
            />
          </div>
        </section>
      )}
      <FunctionsPanel
        functions={functions}
        selectedName={selectedName}
        onSelect={onSelect}
        parseResult={parseResult}
      />
      <RunnerPanel fn={selectedFn} parseResult={parseResult} />
      <VerifyPanel 
        fn={selectedFn} 
        parseResult={parseResult} 
        postcondition={postcondition}
        setPostcondition={setPostcondition}
      />
    </aside>
  )
}
