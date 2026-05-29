import { useState, useEffect, useCallback } from "react";
import { ChallengeCard } from "./ChallengeCard";
import { Leaderboard } from "./Leaderboard";
import { challengeService } from "./challengeService";
import { rankedSystem } from "./rankedSystem";
import type { Challenge, User } from "./types";
import { supabase } from "../../supabaseClient";
import { useDebounce } from "../editor/useDebounce";

const PAGE_SIZE = 50

function insertSorted(items: Challenge[], item: Challenge, sort: "votes" | "date"): Challenge[] {
  const result = items.filter((ch) => ch.id !== item.id)
  let lo = 0
  let hi = result.length
  while (lo < hi) {
    const mid = (lo + hi) >> 1
    const cmp = sort === "votes"
      ? item.votes !== result[mid].votes
        ? item.votes > result[mid].votes ? -1 : 1
        : item.createdAt > result[mid].createdAt ? -1 : 1
      : item.createdAt > result[mid].createdAt ? -1 : 1
    if (cmp < 0) hi = mid
    else lo = mid + 1
  }
  result.splice(lo, 0, item)
  return result
}

export function Dashboard({ onSolve, onCreate }: { onSolve: (id: string) => void, onCreate: () => void }) {
  const [activeTab, setActiveTab] = useState<"challenges" | "leaderboard">("challenges");
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebounce(query, 300)
  const [sortBy, setSortBy] = useState<"votes" | "date">("votes");
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [pendingVoteIds, setPendingVoteIds] = useState<Record<string, boolean>>({});
  const [page, setPage] = useState(0)
  const [hasMore, setHasMore] = useState(true)

  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async (resetPage: boolean) => {
    try {
      setIsLoading(true);
      setError(null);

      const currentPage = resetPage ? 0 : page
      const offset = currentPage * PAGE_SIZE

      const [fetchedChallenges, fetchedUsers] = await Promise.all([
        challengeService.getSorted(sortBy, debouncedQuery, PAGE_SIZE, offset),
        rankedSystem.getUsersSorted(PAGE_SIZE, offset)
      ]);

      const authUser = await supabase.auth.getUser();

      if (resetPage) {
        setChallenges(fetchedChallenges)
        setUsers(fetchedUsers)
        setPage(0)
      } else {
        setChallenges((prev) => [...prev, ...fetchedChallenges])
        setUsers((prev) => [...prev, ...fetchedUsers])
      }
      setHasMore(fetchedChallenges.length === PAGE_SIZE)
      setCurrentUserId(authUser.data.user?.id || null);
    } catch (err: any) {
      console.error("Dashboard data load error:", err);
      setError(err.message || "Failed to load data");
    } finally {
      setIsLoading(false);
    }
  }, [sortBy, debouncedQuery, page]);

  useEffect(() => {
    loadData(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sortBy, debouncedQuery]);

  const handleLoadMore = () => {
    setPage((p) => p + 1)
  }

  useEffect(() => {
    if (page > 0) {
      loadData(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page])

  const handleVote = async (id: string, nextVote: -1 | 0 | 1) => {
    if (pendingVoteIds[id]) return;

    const snapshot = challenges;
    setPendingVoteIds((current) => ({ ...current, [id]: true }));

    const target = snapshot.find((ch) => ch.id === id)
    if (!target) return

    const previousVote = target.userVote;
    const voteDelta = nextVote - previousVote;

    const updated = {
      ...target,
      userVote: nextVote,
      votes: target.votes + voteDelta,
    };

    setChallenges(insertSorted(snapshot, updated, sortBy));

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
              <>
                {challenges.map((challenge) => (
                  <ChallengeCard
                    key={challenge.id}
                    challenge={challenge}
                    currentUserId={currentUserId}
                    onSolve={onSolve}
                    onVote={handleVote}
                  />
                ))}
                {hasMore && (
                  <button className="loadMoreBtn" onClick={handleLoadMore} disabled={isLoading}>
                    {isLoading ? 'Loading...' : 'Load More'}
                  </button>
                )}
              </>
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
