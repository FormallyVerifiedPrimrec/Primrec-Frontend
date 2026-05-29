import { supabase } from '../../supabaseClient';
import type { Challenge } from './types';

export class ChallengeService {
  async getSorted(by: 'votes' | 'date', query: string = ''): Promise<Challenge[]> {
    let supabaseQuery = supabase
      .from('challenges')
      .select('*');

    if (query) {
      supabaseQuery = supabaseQuery.or(`title.ilike.%${query}%,description.ilike.%${query}%`);
    }

    if (by === 'votes') {
      supabaseQuery = supabaseQuery.order('votes', { ascending: false });
    } else {
      supabaseQuery = supabaseQuery.order('created_at', { ascending: false });
    }

    const { data, error } = await supabaseQuery;

    if (error) {
      console.error('Error fetching challenges:', error);
      return [];
    }

    return (data || []).map(row => ({
      id: row.id,
      creatorId: row.creator_id,
      title: row.title,
      description: row.description,
      templateFunc: row.template_func,
      postcondition: row.postcondition,
      suggestedSolution: row.suggested_solution,
      votes: row.votes,
      createdAt: new Date(row.created_at).getTime(),
      testCases: [], // In a real app, these might be in a separate table or JSON column
    }));
  }

  async upvote(challengeId: string) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase
      .from('user_interactions')
      .upsert({ 
        user_id: user.id, 
        challenge_id: challengeId, 
        vote_type: 1 
      }, { onConflict: 'user_id,challenge_id' });

    if (error) console.error('Error upvoting:', error);
  }

  async downvote(challengeId: string) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase
      .from('user_interactions')
      .upsert({ 
        user_id: user.id, 
        challenge_id: challengeId, 
        vote_type: -1 
      }, { onConflict: 'user_id,challenge_id' });

    if (error) console.error('Error downvoting:', error);
  }

  async getById(id: string): Promise<Challenge | undefined> {
    const { data, error } = await supabase
      .from('challenges')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !data) return undefined;

    return {
      id: data.id,
      creatorId: data.creator_id,
      title: data.title,
      description: data.description,
      templateFunc: data.template_func,
      postcondition: data.postcondition,
      suggestedSolution: data.suggested_solution,
      votes: data.votes,
      createdAt: new Date(data.created_at).getTime(),
      testCases: [],
    };
  }

  async createChallenge(challenge: Omit<Challenge, 'id' | 'votes' | 'createdAt' | 'creatorId'>) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Must be logged in to create a challenge');

    const { data, error } = await supabase
      .from('challenges')
      .insert({
        creator_id: user.id,
        title: challenge.title,
        description: challenge.description,
        template_func: challenge.templateFunc,
        postcondition: challenge.postcondition,
        suggested_solution: challenge.suggestedSolution,
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }
}

export const challengeService = new ChallengeService();
