import type { Challenge } from './types';

export function ChallengeCard({ 
  challenge, 
  onSolve, 
  onUpvote, 
  onDownvote 
}: { 
  challenge: Challenge; 
  onSolve: (id: string) => void;
  onUpvote: (id: string) => void;
  onDownvote: (id: string) => void;
}) {
  return (
    <div className="challengeCard">
      <div className="challengeCardHeader">
        <h3>{challenge.title}</h3>
        <div className="voteButtons">
          <button onClick={() => onUpvote(challenge.id)} title="Upvote">▲</button>
          <span>{challenge.votes}</span>
          <button onClick={() => onDownvote(challenge.id)} title="Downvote">▼</button>
        </div>
      </div>
      <p className="challengeDescription">{challenge.description}</p>
      <button className="solveBtn" onClick={() => onSolve(challenge.id)}>Solve Challenge</button>
    </div>
  );
}
