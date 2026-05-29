import { useState, useEffect, useCallback } from "react";
import { ChallengeCard } from "./ChallengeCard";
import { Leaderboard } from "./Leaderboard";
import { challengeService } from "./challengeService";
import { rankedSystem } from "./rankedSystem";
import type { Challenge, User } from "./types";
import { supabase } from "../../supabaseClient";

export function Dashboard({ onSolve, onCreate }: { onSolve: (id: string) => void, onCreate: () => void }) {
  const [activeTab, setActiveTab] = useState<"challenges" | "leaderboard">("challenges");
  const [query, setQuery] = useState("");
  const [sortBy, setSortBy] = useState<"votes" | "date">("votes");
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [pendingVoteIds, setPendingVoteIds] = useState<Record<string, boolean>>({});

  const [error, setError] = useState<string | null>(null);

  const sortChallenges = useCallback((items: Challenge[], sort: "votes" | "date") => {
    return [...items].sort((a, b) => {
      if (sort === "votes") {
        return b.votes - a.votes || b.createdAt - a.createdAt;
      }
      return b.createdAt - a.createdAt;
    });
  }, []);

  const applyVoteLocally = useCallback((
    items: Challenge[],
    challengeId: string,
    nextVote: -1 | 0 | 1
  ) => {
    return items.map((challenge) => {
      if (challenge.id !== challengeId) return challenge;

      const previousVote = challenge.userVote;
      const voteDelta = nextVote - previousVote;

      return {
        ...challenge,
        userVote: nextVote,
        votes: challenge.votes + voteDelta,
      };
    });
  }, []);

  const loadData = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      const [fetchedChallenges, fetchedUsers] = await Promise.all([
        challengeService.getSorted(sortBy, query),
        rankedSystem.getUsersSorted()
      ]);
      
      const authUser = await supabase.auth.getUser();
      
      setChallenges(sortChallenges(fetchedChallenges, sortBy));
      setUsers(fetchedUsers);
      setCurrentUserId(authUser.data.user?.id || null);
    } catch (err: any) {
      console.error("Dashboard data load error:", err);
      setError(err.message || "Failed to load data");
    } finally {
      setIsLoading(false);
    }
  }, [sortBy, query]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleVote = async (id: string, nextVote: -1 | 0 | 1) => {
    if (pendingVoteIds[id]) return;

    const snapshot = challenges;
    setPendingVoteIds((current) => ({ ...current, [id]: true }));

    const updated = applyVoteLocally(snapshot, id, nextVote);
    setChallenges(sortChallenges(updated, sortBy));

    try {
      await challengeService.vote(id, nextVote);
    } catch (err) {
      console.error("Vote error:", err);
      setChallenges(snapshot);
      setError(err instanceof Error ? err.message : "Vote failed");
    } finally {
      setPendingVoteIds((current) => {
        const { [id]: _ignored, ...rest } = current;
        return rest;
      });
    }
  };

  return (
    <div className="dashboard">
      <header className="dashboardHeader">
        <div className="dashboardTabs">
          <button 
            className={`tabBtn ${activeTab === 'challenges' ? 'active' : ''}`}
            onClick={() => setActiveTab('challenges')}
          >
            Challenges
          </button>
          <button 
            className={`tabBtn ${activeTab === 'leaderboard' ? 'active' : ''}`}
            onClick={() => setActiveTab('leaderboard')}
          >
            Leaderboard
          </button>
        </div>

        {activeTab === 'challenges' && (
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
        )}
      </header>

      <div className="dashboardContent singleColumn">
        {activeTab === 'challenges' ? (
          <section className="challengeList fullWidth">
            <button
              className="addChallengeBtn"
              onClick={onCreate}
            >
              + Create Challenge
            </button>
            {error && (
              <div className="empty" style={{ color: 'var(--danger)', background: 'var(--danger-bg)', padding: '12px', borderRadius: '8px' }}>
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
                  onVote={handleVote}
                />
              ))
            )}
          </section>
        ) : (
          <section className="leaderboardSection fullWidth">
            <Leaderboard users={users} />
          </section>
        )}
      </div>
    </div>
  );
}
