import { useState, useMemo } from "react";
import { Markdown } from "../challenges/Markdown";
import { VerificationService } from "../challenges/verificationService";
import { parsePrimRecProgram } from "../../primrecLanguage";
import type { NormalizedFunction } from "../../primrecLanguage/types";
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

  const parseResult = useMemo(() => parsePrimRecProgram(source), [source]);
  const availableFunctions = parseResult.program?.functions ?? [];

  const handleCreate = async () => {
    if (!title || !description || !targetFunctionName || !source) return;

    setIsVerifying(true);
    setError(null);

    try {
      if (parseResult.diagnostics.length > 0) {
        setError("Solution has syntax errors.");
        setIsVerifying(false);
        return;
      }

      if (!parseResult.program) {
        setError("Failed to parse program.");
        setIsVerifying(false);
        return;
      }

      const targetFn = parseResult.program.functions.find(f => f.name === targetFunctionName);
      if (!targetFn) {
        setError(`Target function '${targetFunctionName}' not found.`);
        setIsVerifying(false);
        return;
      }

      if (!targetFn.postcondition) {
        setError(`Target function '${targetFunctionName}' must have a postcondition.`);
        setIsVerifying(false);
        return;
      }

      // Check if all functions have postconditions
      const missingPost = parseResult.program.functions.find((f: NormalizedFunction) => !f.postcondition);
      if (missingPost) {
        setError(`Function '${missingPost.name}' is missing a postcondition.`);
        setIsVerifying(false);
        return;
      }

      // Verify the solution
      const verificationService = VerificationService.getInstance();
      verificationService.reset();
      
      const result = await verificationService.verifyFunction(targetFunctionName, parseResult.program, () => {});

      if (result.status !== 'verified') {
        setError(`Verification failed: ${result.message || 'Unknown error'}`);
        setIsVerifying(false);
        return;
      }

      await challengeService.createChallenge({
        title,
        description,
        postcondition: targetFn.postcondition,
        suggestedSolution: source,
        templateFunc: `// Implement ${targetFunctionName}\n`,
        testCases: [],
      });

      onSuccess();
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred.");
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
                {f.name} {f.postcondition ? '✓' : '(needs postcondition)'}
              </option>
            ))}
          </select>
          {targetFunctionName && availableFunctions.find(f => f.name === targetFunctionName)?.postcondition && (
            <div style={{ fontSize: '11px', color: 'var(--accent)', marginTop: '4px' }}>
              Goal: {availableFunctions.find(f => f.name === targetFunctionName)?.postcondition}
            </div>
          )}
        </div>

        {error && (
          <div style={{ color: '#f48771', fontSize: '11px', padding: '8px', background: 'rgba(244, 135, 113, 0.1)', borderRadius: '6px', border: '1px solid #f48771' }}>
            {error}
          </div>
        )}

        <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontStyle: 'italic' }}>
          Tip: Use the editor to write the full solution with postconditions. The 'Publish' step will verify it.
        </div>
      </div>
    </section>
  );
}
