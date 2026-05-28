import type { Challenge } from './types';
import { MOCK_CHALLENGES } from './mockData';

export class ChallengeService {
  private challenges: Challenge[] = [...MOCK_CHALLENGES];

  getSorted(by: 'votes' | 'date', query: string = ''): Challenge[] {
    let filtered = this.challenges.filter(c => 
      c.title.toLowerCase().includes(query.toLowerCase()) || 
      c.description.toLowerCase().includes(query.toLowerCase())
    );

    if (by === 'votes') {
      return filtered.sort((a, b) => b.votes - a.votes);
    } else {
      return filtered.sort((a, b) => b.createdAt - a.createdAt);
    }
  }

  upvote(id: string) {
    const challenge = this.challenges.find(c => c.id === id);
    if (challenge) challenge.votes++;
  }

  downvote(id: string) {
    const challenge = this.challenges.find(c => c.id === id);
    if (challenge) challenge.votes--;
  }

  getById(id: string): Challenge | undefined {
    return this.challenges.find(c => c.id === id);
  }

  createChallenge(challenge: Omit<Challenge, 'id' | 'votes' | 'createdAt'>) {
    const newChallenge: Challenge = {
      ...challenge,
      id: Math.random().toString(36).substr(2, 9),
      votes: 0,
      createdAt: Date.now(),
    };
    this.challenges.unshift(newChallenge);
    return newChallenge;
  }
}

export const challengeService = new ChallengeService();
