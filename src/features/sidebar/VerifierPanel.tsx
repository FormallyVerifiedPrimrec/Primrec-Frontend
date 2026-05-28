import { useState } from 'react'
import type { PrimrecFunction } from '../primrec/functionDiscovery'

export function VerifierPanel({ fn }: { fn?: PrimrecFunction }) {
  const [post, setPost] = useState('result >= 0')
  const [result, setResult] = useState<string>('')

  function verify() {
    setResult(fn ? `Verified (stub): ${fn.name} satisfies “${post}”` : 'No function selected.')
  }

  return (
    <section className="panel verifierPanel">
      <div className="panelHeader">
        <div className="panelTitle">Verify</div>
        <button className="btn" type="button" onClick={verify} disabled={!fn}>
          Verify
        </button>
      </div>

      <div className="verifierBody">
        <div className="field verifierPost">
          <div className="label">Postcondition</div>
          {/* Only this textarea should scroll; the result is pinned at the bottom. */}
          <textarea className="textarea postTextarea" value={post} onChange={(e) => setPost(e.target.value)} />
        </div>

        <div className="field verifierResult">
          <div className="label">Result</div>
          <pre className="output">{result || '—'}</pre>
        </div>
      </div>
    </section>
  )
}
