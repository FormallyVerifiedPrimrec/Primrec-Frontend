import type { Dispatch, SetStateAction } from 'react'

interface InsertButtonItem {
  name: string
  label: string
  code: string
}

const TEMPLATES: InsertButtonItem[] = [
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

export function InsertButtons({
  setSource,
  definedNames,
}: {
  setSource: Dispatch<SetStateAction<string>>
  definedNames: Set<string>
}) {
  const visibleItems = TEMPLATES.filter((it) => !definedNames.has(it.name))

  if (visibleItems.length === 0) {
    return null
  }

  function insertCode(code: string) {
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
        return code + '\n'
      }
      let insertIndex = lastContentIndex + 1
      for (let i = lastContentIndex + 1; i < lines.length; i++) {
        if (!lines[i].trim()) {
          insertIndex = i
          break
        }
      }
      lines.splice(insertIndex, 0, code)
      return lines.join('\n')
    })
  }

  return (
    <div className="toolbarGroup" aria-label="Insert text buttons">
      {visibleItems.map((it) => (
        <button
          key={it.name}
          className="iconBtn"
          type="button"
          onClick={() => insertCode(it.code)}
        >
          {it.label}
        </button>
      ))}
    </div>
  )
}
