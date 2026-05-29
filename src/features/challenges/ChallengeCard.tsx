import type { Challenge } from './types';
import { Markdown } from './Markdown';

export function ChallengeCard({ 
  challenge, 
  currentUserId,
  onSolve, 
  onVote,
  onClick
}: { 
  challenge: Challenge; 
  currentUserId: string | null;
  onSolve: (id: string) => void;
  onVote: (id: string, voteType: -1 | 0 | 1) => void;
  onClick: (id: string) => void;
}) {
  const isCreator = currentUserId === challenge.creatorId;

  return (
    <div className="challengeCard clickable" onClick={() => onClick(challenge.id)}>
      <div className="challengeCardHeader">
        <h3>{challenge.title}</h3>
        <div className="voteButtons" onClick={(e) => e.stopPropagation()}>
          <button 
            onClick={() => onVote(challenge.id, challenge.userVote === 1 ? 0 : 1)} 
            disabled={isCreator}
            title={isCreator ? "Creators cannot vote on their own challenges" : "Upvote"}
            style={{
              ...(isCreator ? { opacity: 0.5, cursor: 'not-allowed' } : {}),
              ...(challenge.userVote === 1 ? { color: 'var(--accent)', fontWeight: 'bold' } : {})
            }}
          >
            ▲
          </button>
          <span>{challenge.votes}</span>
          <button 
            onClick={() => onVote(challenge.id, challenge.userVote === -1 ? 0 : -1)} 
            disabled={isCreator}
            title={isCreator ? "Creators cannot vote on their own challenges" : "Downvote"}
            style={{
              ...(isCreator ? { opacity: 0.5, cursor: 'not-allowed' } : {}),
              ...(challenge.userVote === -1 ? { color: 'var(--accent)', fontWeight: 'bold' } : {})
            }}
          >
            ▼
          </button>
        </div>
      </div>
      <div className="challengeDescriptionPreview">
        <Markdown content={challenge.description} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div className="cardActions" onClick={(e) => e.stopPropagation()}>
          <button 
            className="solveBtn" 
            onClick={() => onSolve(challenge.id)}
            style={{ cursor: 'pointer' }}
          >
            {isCreator ? 'Open Editor' : challenge.isSolved ? 'Review Solve' : 'Solve Challenge'}
          </button>
          {challenge.isSolved && <span className="solvedBadge">✅ Solved</span>}
          {isCreator && <span className="creatorBadge">Your Challenge</span>}
        </div>
        {isCreator && <span style={{ fontSize: '12px', color: 'var(--text)', fontStyle: 'italic' }}>Created by you</span>}
      </div>
    </div>
  );
}
