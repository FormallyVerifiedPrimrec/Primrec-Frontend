import type { Dispatch, SetStateAction } from 'react'
import { useMemo } from 'react'

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
}: {
  source: string
  setSource: Dispatch<SetStateAction<string>>
  editorFontSize: number
  setEditorFontSize: Dispatch<SetStateAction<number>>
  onSubmit?: () => void
  currentChallenge?: Challenge
  isCreating?: boolean
  isCreator?: boolean
}) {
  const integrity = useMemo(() => {
    if (!currentChallenge || isCreating) return { isValid: true };
    return checkChallengeIntegrity(source, currentChallenge);
  }, [source, currentChallenge, isCreating]);

  const handleReAdd = () => {
    if (!currentChallenge) return;
    
    setSource(prev => {
      if (integrity.missingFunction) {
        return prev + "\n\n" + currentChallenge.templateFunc;
      }
      return prev;
    });
  };

  return (
    <section className="editorPane" aria-label="Editor">
      <div className="paneHeader">
        <div className="paneHeaderRow">
          <div className="paneTitle">{isCreating ? 'Create Challenge' : 'Editor'}</div>
          <div className="editorActions" style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            {!integrity.isValid && (
              <div className="integrityWarning" style={{ color: '#f48771', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span>⚠️ {integrity.error}</span>
                <button className="iconBtn" onClick={handleReAdd} style={{ padding: '2px 8px', borderColor: '#f48771', color: '#f48771' }}>
                  Re-add
                </button>
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
                disabled={isCreator || !integrity.isValid}
                title={isCreator ? "You cannot submit to your own challenge" : "Submit Solution"}
                style={{ opacity: (isCreator || !integrity.isValid) ? 0.5 : 1, cursor: (isCreator || !integrity.isValid) ? 'not-allowed' : 'pointer' }}
              >
                {isCreator ? 'Your Challenge' : 'Submit Solution'}
              </button>
            )}
          </div>
        </div>
        <div className="paneSubRow">
          <InsertButtons setSource={setSource} source={source} />
          <div className="zoomControls" aria-label="Editor font size">
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
        <PrimrecEditor value={source} onChange={setSource} fontSize={editorFontSize} />
      </div>
    </section>
  )
}
