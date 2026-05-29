import { useState } from "react";
import type { CreateChallengePayload } from "./types";
import { Markdown } from "./Markdown";
import { VerificationService } from "./verificationService";
import { parsePrimRecProgram } from "../../primrecLanguage";
import type { NormalizedFunction } from "../../primrecLanguage/types";

interface CreateChallengeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (challenge: CreateChallengePayload) => void;
}

export function CreateChallengeModal({
  isOpen,
  onClose,
  onCreate,
}: CreateChallengeModalProps) {
  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newPostcondition, setNewPostcondition] = useState("");
  const [newSuggestedSolution, setNewSuggestedSolution] = useState("");
  const [showPreview, setShowPreview] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationError, setVerificationError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleVerifyAndSubmit = async () => {
    if (!newTitle || !newDescription || !newPostcondition || !newSuggestedSolution) return;

    setIsVerifying(true);
    setVerificationError(null);

    try {
      const parseResult = parsePrimRecProgram(newSuggestedSolution);
      if (parseResult.diagnostics.length > 0) {
        setVerificationError("Suggested solution has syntax errors.");
        setIsVerifying(false);
        return;
      }

      if (!parseResult.program) {
        setVerificationError("Failed to parse program.");
        setIsVerifying(false);
        return;
      }

      // Check if all functions have postconditions
      const missingPost = parseResult.program.functions.find((f: NormalizedFunction) => !f.postcondition);
      if (missingPost) {
        setVerificationError(`Function '${missingPost.name}' is missing a postcondition.`);
        setIsVerifying(false);
        return;
      }

      // Verify the solution
      const verificationService = VerificationService.getInstance();
      verificationService.reset();
      
      // Determine target function from postcondition or assume first function
      const match = newPostcondition.match(/^([a-zA-Z_][a-zA-Z0-9_]*)/);
      const targetName = match ? match[1] : parseResult.program.functions[0].name;

      const result = await verificationService.verifyFunction(targetName, parseResult.program, () => {});

      if (result.status !== 'verified') {
        setVerificationError(`Verification failed: ${result.message || 'Unknown error'}`);
        setIsVerifying(false);
        return;
      }

      onCreate({
        title: newTitle,
        description: newDescription,
        postcondition: newPostcondition,
        suggestedSolution: newSuggestedSolution,
        templateFunc: `// Implement ${targetName}\n`,
        testCases: [],
      });

      // Reset and close
      setNewTitle("");
      setNewDescription("");
      setNewPostcondition("");
      setNewSuggestedSolution("");
      setShowPreview(false);
      onClose();
    } catch (err) {
      setVerificationError("An unexpected error occurred during verification.");
    } finally {
      setIsVerifying(false);
    }
  };

  const isFormValid = newTitle && newDescription && newPostcondition && newSuggestedSolution;

  return (
    <div className="modalOverlay">
      <div className="modal">
        <h2>Create New Challenge</h2>
        <div className="modalField">
          <label>Challenge Name *</label>
          <input
            type="text"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="e.g., Square of a number"
            required
          />
        </div>
        <div className="modalField">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <label>Description / Message (Markdown & LaTeX support) *</label>
            <button 
              className="iconBtn" 
              style={{ fontSize: '11px', padding: '2px 8px' }}
              onClick={() => setShowPreview(!showPreview)}
            >
              {showPreview ? 'Edit' : 'Preview'}
            </button>
          </div>
          {showPreview ? (
            <div className="textarea" style={{ height: '300px', overflowY: 'auto', background: 'var(--bg)', resize: 'none' }}>
              <Markdown content={newDescription || "*No description provided*"} />
            </div>
          ) : (
            <textarea
              value={newDescription}
              onChange={(e) => setNewDescription(e.target.value)}
              placeholder="Describe what the user should implement... Use $x$ for inline math and $$...$$ for blocks."
              rows={4}
              style={{ resize: 'none' }}
              required
            />
          )}
        </div>
        <div className="modalField">
          <label>Postcondition *</label>
          <input
            type="text"
            value={newPostcondition}
            onChange={(e) => setNewPostcondition(e.target.value)}
            placeholder="e.g., f(x) = x * x"
            required
          />
        </div>
        <div className="modalField">
          <label>Suggested Solution (Internal use only) *</label>
          <textarea
            value={newSuggestedSolution}
            onChange={(e) => setNewSuggestedSolution(e.target.value)}
            placeholder="Implement your solution here. All functions must have { postconditions }."
            style={{ height: '120px', resize: 'none' }}
            required
          />
        </div>
        
        {verificationError && (
          <div className="verificationError" style={{ color: '#f48771', fontSize: '12px', padding: '8px', background: 'rgba(244, 135, 113, 0.1)', borderRadius: '8px', border: '1px solid #f48771' }}>
            ❌ {verificationError}
          </div>
        )}

        <div className="modalActions">
          <button className="cancelBtn" onClick={onClose} disabled={isVerifying}>
            Cancel
          </button>
          <button 
            className="saveBtn" 
            onClick={handleVerifyAndSubmit}
            disabled={!isFormValid || isVerifying}
            style={{ opacity: (isFormValid && !isVerifying) ? 1 : 0.5, cursor: (isFormValid && !isVerifying) ? 'pointer' : 'not-allowed' }}
          >
            {isVerifying ? 'Verifying Solution...' : 'Create Challenge'}
          </button>
        </div>
      </div>
    </div>
  );
}
