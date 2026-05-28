import { useState, useMemo } from "react";
import { ChallengeCard } from "./ChallengeCard";
import { Leaderboard } from "./Leaderboard";
import { challengeService } from "./challengeService";
import { rankedSystem } from "./rankedSystem";
import { CreateChallengeModal } from "./CreateChallengeModal";
import type { Challenge } from "./types";

export function Dashboard({ onSolve }: { onSolve: (id: string) => void }) {
  const [query, setQuery] = useState("");
  const [sortBy, setSortBy] = useState<"votes" | "date">("votes");
  const [voted, setVoted] = useState<Record<string, number>>({});
  const [isModalOpen, setIsModalOpen] = useState(false);

  const challenges = useMemo(
    () => challengeService.getSorted(sortBy, query),
    [sortBy, query, voted, isModalOpen],
  );
  const users = useMemo(() => rankedSystem.getUsersSorted(), []);

  const handleUpvote = (id: string) => {
    challengeService.upvote(id);
    setVoted((prev) => ({ ...prev, [id]: (prev[id] || 0) + 1 }));
  };

  const handleDownvote = (id: string) => {
    challengeService.downvote(id);
    setVoted((prev) => ({ ...prev, [id]: (prev[id] || 0) - 1 }));
  };

  const handleCreateChallenge = (
    challenge: Omit<Challenge, "id" | "votes" | "createdAt">,
  ) => {
    challengeService.createChallenge(challenge);
    setIsModalOpen(false);
  };

  return (
    <div className="dashboard">
      <header className="dashboardHeader">
        <h1>Primrec Challenges</h1>
        <div className="dashboardControls">
          <input
            type="text"
            placeholder="Search challenges..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as "votes" | "date")}
          >
            <option value="votes">Top Voted</option>
            <option value="date">Newest</option>
          </select>
        </div>
      </header>

      <div className="dashboardContent">
        <section className="challengeList">
          <button
            className="addChallengeBtn"
            onClick={() => setIsModalOpen(true)}
          >
            + Create Challenge
          </button>
          {challenges.map((challenge) => (
            <ChallengeCard
              key={challenge.id}
              challenge={challenge}
              onSolve={onSolve}
              onUpvote={handleUpvote}
              onDownvote={handleDownvote}
            />
          ))}
        </section>
        <aside className="leaderboardSection">
          <Leaderboard users={users} />
        </aside>
      </div>

      <CreateChallengeModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onCreate={handleCreateChallenge}
      />
    </div>
  );
}
