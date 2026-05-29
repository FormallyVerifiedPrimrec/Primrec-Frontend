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
    {
      name: 'id', label: 'id',
      code: 'id(x) = x;\n',
    },
    {
      name: 'one', label: 'one',
      code: 'one() = succ(zero());\n',
    },
    {
      name: 'pred', label: 'pred',
      code: 'predBase() = zero();\n\npredStep(y, previous) = y;\n\npred(x) = primrec(predBase, predStep);\n',
    },
    {
      name: 'plus', label: 'plus',
      code: 'plusBase(x) = x;\n\nplusStep(x, y, previous) = succ(previous);\n\nplus(x, y) = primrec(plusBase, plusStep);\n',
    },
    {
      name: 'mult', label: 'mult',
      code: 'multBase(x) = zero();\n\nmultStep(x, y, previous) = plus(previous, x);\n\nmult(x, y) = primrec(multBase, multStep);\n',
    },
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
