// Sidebar panel for turning the current editor solution into a challenge. The
// solution is verified with the real solver before publishing.
import { useState, useMemo } from "react";
import { Markdown } from "../challenges/Markdown";
import {
  analyzeProgram,
  verifyProgramOnce,
} from "../verification";
import { challengeService } from "../challenges/challengeService";

interface CreateChallengePanelProps {
  source: string;
  onSuccess: () => void;
  onCancel: () => void;
}

export function CreateChallengePanel({
  source,
  onSuccess,
  onCancel,
}: CreateChallengePanelProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [targetFunctionName, setTargetFunctionName] = useState("");
  const [showPreview, setShowPreview] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const analysis = useMemo(() => analyzeProgram(source), [source]);
  const availableFunctions = analysis.functions;

  const handleCreate = async () => {
    if (!title || !description || !targetFunctionName || !source) return;

    setIsVerifying(true);
    setError(null);

    try {
      if (analysis.hasErrors || !analysis.program) {
        setError("Solution has syntax errors.");
        setIsVerifying(false);
        return;
      }

      const targetFn = analysis.functions.find(f => f.name === targetFunctionName);
      if (!targetFn) {
        setError(`Target function '${targetFunctionName}' not found.`);
        setIsVerifying(false);
        return;
      }

      if (!targetFn.hasPostcondition) {
        setError(`Target function '${targetFunctionName}' must have a postcondition.`);
        setIsVerifying(false);
        return;
      }

      // Verify the solution with the real solver (single-pipeline).
      const result = await verifyProgramOnce(source, targetFunctionName);

      if (result.status !== 'verified') {
        setError(`Verification failed: ${result.message || 'Unknown error'}`);
        setIsVerifying(false);
        return;
      }

      await challengeService.createChallenge({
        title,
        description,
        postcondition: targetFn.postconditionText ?? targetFunctionName,
        suggestedSolution: source,
        templateFunc: `# Implement ${targetFunctionName}\n`,
        testCases: [],
      });

      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : "An unexpected error occurred.");
    } finally {
      setIsVerifying(false);
    }
  };

  const isFormValid = title && description && targetFunctionName && source;

  return (
    <section className="panel createChallengePanel">
      <div className="panelHeader">
        <div className="panelTitle">Challenge Metadata</div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button className="btn" onClick={onCancel} disabled={isVerifying}>
            Cancel
          </button>
          <button 
            className="saveBtn" 
            onClick={handleCreate}
            disabled={!isFormValid || isVerifying}
            style={{ padding: '2px 12px', fontSize: '12px', opacity: isFormValid ? 1 : 0.5 }}
          >
            {isVerifying ? 'Saving...' : 'Publish'}
          </button>
        </div>
      </div>

      <div className="panelContent" style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <div className="field">
          <label className="label">Name *</label>
          <input
            className="input"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g., Square of a number"
          />
        </div>

        <div className="field">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
            <label className="label">Description (Markdown) *</label>
            <button 
              className="iconBtn" 
              style={{ fontSize: '10px', padding: '1px 6px' }}
              onClick={() => setShowPreview(!showPreview)}
            >
              {showPreview ? 'Edit' : 'Preview'}
            </button>
          </div>
          {showPreview ? (
            <div className="output" style={{ minHeight: '100px', background: 'var(--bg)' }}>
              <Markdown content={description || "*No description provided*"} />
            </div>
          ) : (
            <textarea
              className="textarea"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe the challenge..."
              rows={5}
            />
          )}
        </div>

        <div className="field">
          <label className="label">Target Function (Goal) *</label>
          <select 
            className="input" 
            value={targetFunctionName} 
            onChange={(e) => setTargetFunctionName(e.target.value)}
          >
            <option value="">Select entry function...</option>
            {availableFunctions.map(f => (
              <option key={f.name} value={f.name}>
                {f.name} {f.hasPostcondition ? '✓' : '(needs postcondition)'}
              </option>
            ))}
          </select>
          {targetFunctionName &&
            availableFunctions.find(f => f.name === targetFunctionName)?.postconditionText && (
              <pre style={{ fontSize: '11px', color: 'var(--accent)', marginTop: '4px', whiteSpace: 'pre-wrap' }}>
                {availableFunctions.find(f => f.name === targetFunctionName)?.postconditionText}
              </pre>
            )}
        </div>

        {error && (
          <div style={{ color: '#f48771', fontSize: '11px', padding: '8px', background: 'rgba(244, 135, 113, 0.1)', borderRadius: '6px', border: '1px solid #f48771' }}>
            {error}
          </div>
        )}

        <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontStyle: 'italic' }}>
          Tip: Write your solution using any helper functions. Only the selected target function needs a postcondition.
        </div>
      </div>
    </section>
  );
}
