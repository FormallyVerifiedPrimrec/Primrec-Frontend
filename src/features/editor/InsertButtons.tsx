import React from 'react'

export function InsertButtons({
  setSource,
  source,
}: {
  setSource: React.Dispatch<React.SetStateAction<string>>
  source: string
}) {
  const items = [
    { name: 'add', label: 'add', code: 'add(x, y) = x + y' },
    { name: 'mult', label: 'mult', code: 'mult(x, y) = x * y' },
    { name: 'fac', label: 'fac', code: 'fac(n) = if n == 0 then 1 else n * fac(n - 1)' },
  ]

  function existsInSource(name: string) {
    // Match function definitions like "add(x, y) = ..." or "add(x, y) := ..."
    // but not if it's just "= ..." (incomplete/stub)
    const re = new RegExp(`(^|\\n)\\s*${name}\\s*\\([^)]*\\)\\s*(?::=|=)\\s*[^.\\s]`, 'm')
    return re.test(source)
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

