import type { Dispatch, SetStateAction } from 'react'

import type { PrimrecFunction } from '../primrec/functionDiscovery'
import type { ParseResult } from '../../primrecLanguage'
import { EditorPane } from './EditorPane'
import { ToolsSidebar } from './ToolsSidebar'
import type { Challenge, SubmissionResult } from '../challenges/types'

export function AppShell({
  source,
  setSource,
  editorFontSize,
  setEditorFontSize,
  functions,
  effectiveSelectedName,
  setSelectedName,
  selectedFn,
  parseResult,
  currentChallenge,
  submissionResult,
  onSubmit,
  onBack,
  postcondition,
  setPostcondition,
}: {
  source: string
  setSource: Dispatch<SetStateAction<string>>
  editorFontSize: number
  setEditorFontSize: Dispatch<SetStateAction<number>>
  functions: PrimrecFunction[]
  effectiveSelectedName?: string
  setSelectedName: Dispatch<SetStateAction<string>>
  selectedFn?: PrimrecFunction
  parseResult: ParseResult
  currentChallenge?: Challenge
  submissionResult?: SubmissionResult
  onSubmit?: () => void
  onBack?: () => void
  postcondition: string
  setPostcondition: (val: string) => void
}) {
  return (
    <main className="workspace">
      <EditorPane
        source={source}
        setSource={setSource}
        editorFontSize={editorFontSize}
        setEditorFontSize={setEditorFontSize}
        onSubmit={onSubmit}
        isChallengeActive={!!currentChallenge}
      />
      <ToolsSidebar
        functions={functions}
        selectedName={effectiveSelectedName}
        onSelect={(name) => setSelectedName(name)}
        selectedFn={selectedFn}
        parseResult={parseResult}
        postcondition={postcondition}
        setPostcondition={setPostcondition}
        currentChallenge={currentChallenge}
        submissionResult={submissionResult}
        onBack={onBack}
      />
    </main>
  )
}
