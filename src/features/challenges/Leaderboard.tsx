import { useState, useMemo } from 'react';
import type { User } from './types';

export function Leaderboard({ users }: { users: User[] }) {
  const [searchTerm, setSearchTerm] = useState('');

  const rankMap = useMemo(() => {
    const map = new Map<string, number>();
    users.forEach((u, i) => map.set(u.id, i + 1));
    return map;
  }, [users]);

  const filteredUsers = useMemo(
    () =>
      searchTerm
        ? users.filter((u) =>
            u.name.toLowerCase().includes(searchTerm.toLowerCase()),
          )
        : users,
    [users, searchTerm],
  );

  return (
    <div className="leaderboard">
      <div className="leaderboardHeader" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <h2 style={{ margin: 0 }}>Leaderboard</h2>
        <input
          type="text"
          placeholder="Search users..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={{
            padding: '8px 12px',
            background: 'var(--code-bg)',
            border: '1px solid var(--border)',
            borderRadius: '8px',
            color: 'var(--text-h)',
            fontSize: '13px',
          }}
        />
      </div>
      <table>
        <thead>
          <tr>
            <th>Rank</th>
            <th>Name</th>
            <th>Score</th>
          </tr>
        </thead>
        <tbody>
          {filteredUsers.length === 0 ? (
            <tr>
              <td colSpan={3} style={{ textAlign: 'center', padding: '20px', color: 'var(--text)' }}>
                No users found.
              </td>
            </tr>
          ) : (
            filteredUsers.map((user) => {
              const rank = rankMap.get(user.id) ?? 0;
              return (
                <tr key={user.id}>
                  <td>{rank}</td>
                  <td>{user.name}</td>
                  <td>{user.score}</td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}
