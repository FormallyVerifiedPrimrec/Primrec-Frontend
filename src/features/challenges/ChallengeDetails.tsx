import type { Challenge, SubmissionResult } from './types';
import { Markdown } from './Markdown';
import { CommunitySolutions } from './CommunitySolutions';

export function ChallengeDetails({ 
  challenge, 
  submissionResult 
}: { 
  challenge: Challenge; 
  submissionResult?: SubmissionResult;
}) {
  const isSolved = challenge.isSolved || submissionResult?.success;

  return (
    <div className="challengeDetails">
      <h3 className="challengeTitle">{challenge.title}</h3>
      <div className="challengeDescriptionMarkdown">
        <Markdown content={challenge.description} />
      </div>

      {challenge.postcondition?.trim() && (
        <div className="challengePostconditions">
          <h4 className="challengePostconditionsTitle">Postconditions</h4>
          <p className="challengePostconditionsHint">
            These are fixed by the challenge and always checked when you verify — you cannot edit them.
          </p>
          <pre className="challengePostconditionsBody">{challenge.postcondition}</pre>
        </div>
      )}

      {submissionResult && (
        <div className={`submissionFeedback ${submissionResult.success ? 'success' : 'failure'}`}>
          <p>{submissionResult.message}</p>
          <div className="progress">
            <div 
              className="progressBar" 
              style={{ width: `${(submissionResult.passedCount / submissionResult.totalCount) * 100}%` }}
            />
          </div>
        </div>
      )}

      {isSolved && (
        <div className="communitySection">
          <hr className="divider" />
          <CommunitySolutions challengeId={challenge.id} />
        </div>
      )}
    </div>
  );
}
