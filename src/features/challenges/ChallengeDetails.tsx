import type { Challenge, SubmissionResult } from './types';

export function ChallengeDetails({ 
  challenge, 
  submissionResult 
}: { 
  challenge: Challenge; 
  submissionResult?: SubmissionResult;
}) {
  return (
    <div className="challengeDetails">
      <h3 className="challengeTitle">{challenge.title}</h3>
      <div className="challengeDescriptionMarkdown">
        {challenge.description}
      </div>
      
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
    </div>
  );
}
