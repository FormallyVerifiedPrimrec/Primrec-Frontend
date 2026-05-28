import Editor from '@monaco-editor/react'

export function PrimrecEditor({
  value,
  onChange,
  fontSize,
}: {
  value: string
  onChange: (next: string) => void
  fontSize: number
}) {
  return (
    <Editor
      height="100%"
      defaultLanguage="plaintext"
      theme="vs-dark"
      value={value}
      onChange={(v: string | undefined) => onChange(v ?? '')}
      options={{
        minimap: { enabled: false },
        fontSize,
        fontFamily:
          "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
        scrollBeyondLastLine: false,
        tabSize: 2,
        wordWrap: 'on',
        automaticLayout: true,
      }}
    />
  )
}
