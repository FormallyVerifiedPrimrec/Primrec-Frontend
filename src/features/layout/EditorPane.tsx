import type { Dispatch, SetStateAction } from 'react'
import { useMemo } from 'react'

import { parseSyntax } from '../../primrecLanguage/primrecParsing/parser'
import { InsertButtons } from '../editor/InsertButtons'
import { PrimrecEditor } from '../editor/PrimrecEditor'
import type { Challenge } from '../challenges/types'
import { checkChallengeIntegrity } from '../editor/integrityCheck'

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n))
}

export function EditorPane({
  source,
  setSource,
  editorFontSize,
  setEditorFontSize,
  onSubmit,
  currentChallenge,
  isCreating,
  isCreator,
  themeVariant,
  hasSubmitted,
}: {
  source: string
  setSource: Dispatch<SetStateAction<string>>
  editorFontSize: number
  setEditorFontSize: Dispatch<SetStateAction<number>>
  onSubmit?: () => void
  currentChallenge?: Challenge
  isCreating?: boolean
  isCreator?: boolean
  themeVariant: 'dark' | 'light'
  hasSubmitted?: boolean
}) {
  const definedNames = useMemo(() => {
    const parsed = parseSyntax(source)
    return new Set(
      parsed.ast.definitions
        .filter((d) => d.kind === 'FunctionDefinition')
        .map((d) => d.name),
    )
  }, [source])

  const integrity = useMemo(() => {
    if (!currentChallenge || isCreating || hasSubmitted) return { isValid: true }
    return checkChallengeIntegrity(source, currentChallenge)
  }, [source, currentChallenge, isCreating, hasSubmitted])

  const submitDisabled = isCreator || hasSubmitted || !integrity.isValid

  const submitTitle = isCreator
    ? 'You cannot submit to your own challenge'
    : hasSubmitted
      ? 'Already submitted'
      : 'Submit Solution'

  return (
    <section className="editorPane" aria-label="Editor">
      <div className="paneHeader">
        <div className="paneHeaderRow">
          <div className="paneTitle">{isCreating ? 'Create Challenge' : 'Editor'}</div>
          <div className="editorActions" style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            {!integrity.isValid && !hasSubmitted && (
              <div className="integrityWarning" style={{ color: 'var(--danger-bright)', fontSize: '12px' }}>
                <span>⚠ {integrity.error}</span>
              </div>
            )}
            {hasSubmitted && (
              <div style={{ color: 'var(--success)', fontSize: '12px' }}>
                ✓ Solved
              </div>
            )}
            {isCreating && (
              <div style={{ color: 'var(--text-muted)', fontSize: '12px' }}>
                Mode: Solution Designer
              </div>
            )}
            {currentChallenge && onSubmit && !isCreating && (
              <button
                className="submitBtn"
                onClick={onSubmit}
                disabled={submitDisabled}
                title={submitTitle}
                style={{ opacity: submitDisabled ? 0.5 : 1, cursor: submitDisabled ? 'not-allowed' : 'pointer' }}
              >
                {isCreator ? 'Your Challenge' : hasSubmitted ? 'Submitted' : 'Submit Solution'}
              </button>
            )}
          </div>
        </div>
        <div className="paneSubRow">
          <InsertButtons setSource={setSource} definedNames={definedNames} />
          <div className="toolbarGroup" aria-label="Editor font size">
            <button
              className="iconBtn"
              type="button"
              onClick={() => setEditorFontSize((s) => clamp(s - 1, 10, 28))}
              aria-label="Decrease editor font size"
              title="Decrease editor font size"
            >
              A-
            </button>
            <div className="zoomValue" title="Editor font size">
              {editorFontSize}px
            </div>
            <button
              className="iconBtn"
              type="button"
              onClick={() => setEditorFontSize((s) => clamp(s + 1, 10, 28))}
              aria-label="Increase editor font size"
              title="Increase editor font size"
            >
              A+
            </button>
            <button
              className="iconBtn"
              type="button"
              onClick={() => setEditorFontSize(14)}
              aria-label="Reset editor font size"
              title="Reset editor font size"
            >
              Reset
            </button>
          </div>
        </div>
      </div>

      <div className="paneBody">
        <PrimrecEditor value={source} onChange={setSource} fontSize={editorFontSize} themeVariant={themeVariant} />
      </div>
    </section>
  )
}
