import type { Challenge } from './types'
import {
  createChallenge as apiCreateChallenge,
  getChallengeById as apiGetChallengeById,
  getChallenges as apiGetChallenges,
  voteChallenge as apiVoteChallenge,
} from '../../api/challengesApi'

export class ChallengeService {
  async getSorted(by: 'votes' | 'date', query: string = ''): Promise<Challenge[]> {
    return apiGetChallenges({ sort: by, query })
  }

  async upvote(challengeId: string) {
    await apiVoteChallenge(challengeId, 1)
  }

  async downvote(challengeId: string) {
    await apiVoteChallenge(challengeId, -1)
  }

  async getById(id: string): Promise<Challenge | undefined> {
    try {
      return await apiGetChallengeById(id)
    } catch {
      return undefined
    }
  }

  async createChallenge(challenge: Omit<Challenge, 'id' | 'votes' | 'createdAt' | 'creatorId'>) {
    return apiCreateChallenge({
      title: challenge.title,
      description: challenge.description,
      templateFunc: challenge.templateFunc,
      postcondition: challenge.postcondition,
      suggestedSolution: challenge.suggestedSolution,
    })
  }
}

export const challengeService = new ChallengeService()
