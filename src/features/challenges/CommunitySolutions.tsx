import { useState, useEffect } from 'react';
import { getSolutions } from '../../api/challengesApi';
import type { Solution } from './types';

export function CommunitySolutions({ challengeId }: { challengeId: string }) {
  const [solutions, setSolutions] = useState<Solution[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    getSolutions(challengeId, { limit: 50, offset: 0 })
      .then(s => {
        setSolutions(s);
        setLoading(false);
      })
      .catch(err => {
        setError(err.message);
        setLoading(false);
      });
  }, [challengeId]);

  if (loading) return <div className="solutionsLoading">Loading solutions...</div>;
  if (error) return <div className="solutionsError">Error loading solutions: {error}</div>;
  if (solutions.length === 0) return <div className="solutionsEmpty">No solutions found.</div>;

  const current = solutions[currentIndex];

  const handleNext = () => {
    setCurrentIndex(prev => (prev + 1) % solutions.length);
  };

  const handlePrev = () => {
    setCurrentIndex(prev => (prev - 1 + solutions.length) % solutions.length);
  };

  return (
    <div className="communitySolutions">
      <div className="solutionsHeader">
        <h4>Community Solutions ({solutions.length})</h4>
        <div className="solutionNav">
          <button className="navBtn" onClick={handlePrev}>&larr; Prev</button>
          <span className="pageCounter">{currentIndex + 1} / {solutions.length}</span>
          <button className="navBtn" onClick={handleNext}>Next &rarr;</button>
        </div>
      </div>

      <div className="solutionCard">
        <div className="solutionUser">
          {current.avatarData ? (
            <img src={current.avatarData} alt="" className="avatarSmall" />
          ) : (
            <div className="avatarPlaceholder small">{current.username[0]?.toUpperCase()}</div>
          )}
          <span className="username">{current.username}</span>
          {current.isCreator && <span className="creatorBadge">Creator</span>}
          <span className="solveDate">{new Date(current.solvedAt).toLocaleDateString()}</span>
        </div>
        
        <div className="solutionCode">
          <pre>
            <code>{current.source}</code>
          </pre>
        </div>
      </div>
    </div>
  );
}
