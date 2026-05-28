import { useCallback } from 'react'
import Editor from '@monaco-editor/react'
import type { BeforeMount, OnMount } from '@monaco-editor/react'
import {
  LANGUAGE_ID,
  registerPrimRecLanguage,
  updatePrimRecMarkers,
} from './monaco/primRecMonaco'

export function PrimrecEditor({
  value,
  onChange,
  fontSize,
}: {
  value: string
  onChange: (next: string) => void
  fontSize: number
}) {
  const handleBeforeMount: BeforeMount = useCallback((monaco) => {
    registerPrimRecLanguage(monaco)
  }, [])

  const handleMount: OnMount = useCallback((editor, monaco) => {
    updatePrimRecMarkers(monaco, editor.getModel())
    editor.onDidChangeModelContent(() => {
      updatePrimRecMarkers(monaco, editor.getModel())
    })
  }, [])

  return (
    <Editor
      height="100%"
      beforeMount={handleBeforeMount}
      language={LANGUAGE_ID}
      theme="primrec-dark"
      value={value}
      onChange={(v: string | undefined) => onChange(v ?? '')}
      onMount={handleMount}
      options={{
        minimap: { enabled: false },
        fontSize,
        fontFamily:
          "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
        scrollBeyondLastLine: false,
        tabSize: 4,
        wordWrap: 'on',
        automaticLayout: true,
        'semanticHighlighting.enabled': true,
      }}
    />
  )
}
