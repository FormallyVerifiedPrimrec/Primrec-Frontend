import { useState, useEffect, useCallback } from "react";
import { ChallengeCard } from "./ChallengeCard";
import { Leaderboard } from "./Leaderboard";
import { challengeService } from "./challengeService";
import { rankedSystem } from "./rankedSystem";
import { CreateChallengeModal } from "./CreateChallengeModal";
import type { Challenge, User } from "./types";
import { supabase } from "../../supabaseClient";

export function Dashboard({ onSolve }: { onSolve: (id: string) => void }) {
  const [query, setQuery] = useState("");
  const [sortBy, setSortBy] = useState<"votes" | "date">("votes");
  const [voted, setVoted] = useState<Record<string, number>>({});
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      const [fetchedChallenges, fetchedUsers] = await Promise.all([
        challengeService.getSorted(sortBy, query),
        rankedSystem.getUsersSorted()
      ]);
      
      const authUser = await supabase.auth.getUser();
      
      setChallenges(fetchedChallenges);
      setUsers(fetchedUsers);
      setCurrentUserId(authUser.data.user?.id || null);
    } catch (err: any) {
      console.error("Dashboard data load error:", err);
      setError(err.message || "Failed to load challenges");
    } finally {
      setIsLoading(false);
    }
  }, [sortBy, query]);

  useEffect(() => {
    loadData();
  }, [loadData]); // Removed voted from deps to avoid extra reloads, handle re-load in vote handlers

  const handleUpvote = async (id: string) => {
    try {
      await challengeService.upvote(id);
      loadData();
    } catch (err) {
      console.error("Upvote error:", err);
    }
  };

  const handleDownvote = async (id: string) => {
    try {
      await challengeService.downvote(id);
      loadData();
    } catch (err) {
      console.error("Downvote error:", err);
    }
  };

  const handleCreateChallenge = async (
    challenge: Omit<Challenge, "id" | "votes" | "createdAt" | "creatorId">,
  ) => {
    await challengeService.createChallenge(challenge);
    setIsModalOpen(false);
    loadData(); // Immediate refresh
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
          {error && (
            <div className="empty" style={{ color: '#b42318', background: 'rgba(180, 35, 24, 0.1)', padding: '12px', borderRadius: '8px' }}>
              Error: {error}
            </div>
          )}
          {isLoading && challenges.length === 0 ? (
            <div className="empty">Loading challenges...</div>
          ) : challenges.length === 0 ? (
            <div className="empty">No challenges found.</div>
          ) : (
            challenges.map((challenge) => (
              <ChallengeCard
                key={challenge.id}
                challenge={challenge}
                currentUserId={currentUserId}
                onSolve={onSolve}
                onUpvote={handleUpvote}
                onDownvote={handleDownvote}
              />
            ))
          )}
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
