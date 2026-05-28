import type { Dispatch, SetStateAction } from 'react'

import type { PrimrecFunction } from '../primrec/functionDiscovery'
import type { ParseResult } from '../../primrecLanguage'
import { EditorPane } from './EditorPane'
import { ToolsSidebar } from './ToolsSidebar'

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
}) {
  return (
    <div className="appRoot">
      <main className="workspace">
        <EditorPane
          source={source}
          setSource={setSource}
          editorFontSize={editorFontSize}
          setEditorFontSize={setEditorFontSize}
        />
        <ToolsSidebar
          functions={functions}
          selectedName={effectiveSelectedName}
          onSelect={(name) => setSelectedName(name)}
          selectedFn={selectedFn}
          parseResult={parseResult}
        />
      </main>
    </div>
  )
}
