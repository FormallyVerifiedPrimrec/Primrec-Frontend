import type { Challenge, CreateChallengePayload } from './types'
import {
  createChallenge as apiCreateChallenge,
  getChallengeById as apiGetChallengeById,
  getChallenges as apiGetChallenges,
  voteChallenge as apiVoteChallenge,
} from '../../api/challengesApi'

export class ChallengeService {
  async getSorted(by: 'votes' | 'date', query: string = '', limit?: number, offset?: number): Promise<Challenge[]> {
    return apiGetChallenges({ sort: by, query, limit, offset })
  }

  async vote(challengeId: string, voteType: -1 | 0 | 1) {
    return apiVoteChallenge(challengeId, voteType)
  }

  async getById(id: string): Promise<Challenge | undefined> {
    try {
      return await apiGetChallengeById(id)
    } catch {
      return undefined
    }
  }

  async createChallenge(challenge: CreateChallengePayload) {
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
