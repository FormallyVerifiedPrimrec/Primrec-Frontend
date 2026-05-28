import { useMemo, useState } from 'react'
import './App.css'
import { useLocalStorageState } from './features/editor/useLocalStorageState'
import { discoverFunctions, type PrimrecFunction } from './features/primrec/functionDiscovery'
import { AppShell } from './features/layout/AppShell'
import { COMPLETION_EXAMPLE } from './primrecLanguage/constants'
import { parsePrimRecProgram } from './primrecLanguage'

const DEFAULT_SOURCE = COMPLETION_EXAMPLE


function App() {
  const [source, setSource] = useLocalStorageState('primrec.source', DEFAULT_SOURCE)
  const [editorFontSize, setEditorFontSize] = useLocalStorageState('primrec.editorFontSize', 14)
  const [selectedName, setSelectedName] = useState<string>('plus')

  const functions = useMemo(() => discoverFunctions(source), [source])
  const parseResult = useMemo(() => parsePrimRecProgram(source), [source])

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
    <AppShell
      source={source}
      setSource={setSource}
      editorFontSize={editorFontSize}
      setEditorFontSize={setEditorFontSize}
      functions={functions}
      effectiveSelectedName={effectiveSelectedName}
      setSelectedName={setSelectedName}
      selectedFn={selectedFn}
      parseResult={parseResult}
    />
  )
}

export default App
