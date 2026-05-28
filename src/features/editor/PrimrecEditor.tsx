import Editor from '@monaco-editor/react'

export function PrimrecEditor({
  value,
  onChange,
}: {
  value: string
  onChange: (next: string) => void
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
        fontSize: 14,
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
