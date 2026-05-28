import type { Dispatch, SetStateAction } from 'react'
import { parseSyntax } from '../../primrecLanguage/parser'

export function InsertButtons({
  setSource,
  source,
}: {
  setSource: Dispatch<SetStateAction<string>>
  source: string
}) {
  const items = [
    { name: 'id', label: 'id', code: 'id(x) = x;' },
    { name: 'one', label: 'one', code: 'one() = 1;' },
    { name: 'double', label: 'double', code: 'double(x) = plus(x, x);' },
  ]

  function existsInSource(name: string) {
    return parseSyntax(source).ast.definitions.some((definition) => definition.name === name)
  }

  const visibleItems = items.filter((it) => !existsInSource(it.name))

  if (visibleItems.length === 0) {
    return null
  }

  return (
    <div className="insertButtons" aria-label="Insert text buttons">
      {visibleItems.map((it) => (
        <button
          key={it.name}
          className="iconBtn"
          type="button"
          onClick={() => {
            if (existsInSource(it.name)) return
            setSource((s) => {
              const lines = s.split('\n')
              let lastContentIndex = -1
              for (let i = lines.length - 1; i >= 0; i--) {
                if (lines[i].trim()) {
                  lastContentIndex = i
                  break
                }
              }
              if (lastContentIndex === -1) {
                return it.code + '\n'
              }
              let insertIndex = lastContentIndex + 1
              for (let i = lastContentIndex + 1; i < lines.length; i++) {
                if (!lines[i].trim()) {
                  insertIndex = i
                  break
                }
              }
              lines.splice(insertIndex, 0, it.code)
              return lines.join('\n')
            })
          }}
        >
          {it.label}
        </button>
      ))}
    </div>
  )
}
