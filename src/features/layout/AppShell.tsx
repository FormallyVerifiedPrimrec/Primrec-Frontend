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
  isCreating,
  submissionResult,
  onSubmit,
  onBack,
  isCreator,
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
  isCreating: boolean
  submissionResult?: SubmissionResult
  onSubmit?: () => void
  onBack?: () => void
  isCreator: boolean
}) {
  return (
    <main className="workspace">
      <EditorPane
        source={source}
        setSource={setSource}
        editorFontSize={editorFontSize}
        setEditorFontSize={setEditorFontSize}
        onSubmit={onSubmit}
        currentChallenge={currentChallenge}
        isCreating={isCreating}
        isCreator={isCreator}
      />
      <ToolsSidebar
        functions={functions}
        selectedName={effectiveSelectedName}
        onSelect={(name) => setSelectedName(name)}
        selectedFn={selectedFn}
        parseResult={parseResult}
        currentChallenge={currentChallenge}
        isCreating={isCreating}
        source={source}
        submissionResult={submissionResult}
        onBack={onBack}
      />
    </main>
  )
}
