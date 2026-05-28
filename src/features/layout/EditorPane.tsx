import type { Dispatch, SetStateAction } from 'react'

import { InsertButtons } from '../editor/InsertButtons'
import { PrimrecEditor } from '../editor/PrimrecEditor'

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n))
}

export function EditorPane({
  source,
  setSource,
  editorFontSize,
  setEditorFontSize,
}: {
  source: string
  setSource: Dispatch<SetStateAction<string>>
  editorFontSize: number
  setEditorFontSize: Dispatch<SetStateAction<number>>
}) {
  return (
    <section className="editorPane" aria-label="Editor">
      <div className="paneHeader">
        <div className="paneHeaderRow">
          <div className="paneTitle">Editor</div>
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
