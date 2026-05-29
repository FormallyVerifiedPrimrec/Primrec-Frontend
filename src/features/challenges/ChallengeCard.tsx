import type { Challenge } from './types';
import { Markdown } from './Markdown';

export function ChallengeCard({ 
  challenge, 
  currentUserId,
  onSolve, 
  onUpvote, 
  onDownvote 
}: { 
  challenge: Challenge; 
  currentUserId: string | null;
  onSolve: (id: string) => void;
  onUpvote: (id: string) => void;
  onDownvote: (id: string) => void;
}) {
  const isCreator = currentUserId === challenge.creatorId;

  return (
    <div className="challengeCard">
      <div className="challengeCardHeader">
        <h3>{challenge.title}</h3>
        <div className="voteButtons">
          <button 
            onClick={() => onUpvote(challenge.id)} 
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
            onClick={() => onDownvote(challenge.id)} 
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
      <Markdown className="challengeDescription" content={challenge.description} />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <button 
          className="solveBtn" 
          onClick={() => onSolve(challenge.id)}
          disabled={isCreator}
          style={{ opacity: isCreator ? 0.5 : 1, cursor: isCreator ? 'not-allowed' : 'pointer' }}
        >
          {isCreator ? 'Your Challenge' : 'Solve Challenge'}
        </button>
        {isCreator && <span style={{ fontSize: '12px', color: 'var(--text)', fontStyle: 'italic' }}>Created by you</span>}
      </div>
    </div>
  );
}
