import { supabase } from '../lib/supabase';

export interface PlayerValue {
  id: string;
  player_id: string;
  player_name: string;
  position: string;
  team: string | null;
  ktc_value: number;
  fdp_value: number;
  trend: 'up' | 'down' | 'stable';
  last_updated: string;
  metadata: Record<string, any>;
}

export interface ValueAdjustmentFactors {
  id: string;
  player_id: string;
  superflex_boost: number;
  playoff_schedule: number;
  recent_performance: number;
  injury_risk: number;
  age_factor: number;
  team_situation: number;
  calculated_at: string;
}

export interface UserCustomValue {
  id: string;
  user_id: string;
  player_id: string;
  custom_value: number;
  notes: string;
  created_at: string;
  updated_at: string;
}

export interface KTCPlayer {
  playerName: string;
  slug: string;
  position: string;
  team: string;
  value: number;
  trend: string;
}

class PlayerValuesApi {
  private readonly KTC_API_BASE = 'https://keeptradecut.com/dynasty-rankings';

  async fetchKTCValues(): Promise<KTCPlayer[]> {
    try {
      const response = await fetch(`${this.KTC_API_BASE}?format=json`);
      if (!response.ok) {
        throw new Error('Failed to fetch KTC values');
      }
      const data = await response.json();
      return data || [];
    } catch (error) {
      console.error('Error fetching KTC values:', error);
      return [];
    }
  }

  calculateFDPValue(
    ktcValue: number,
    factors: Partial<ValueAdjustmentFactors>,
    isSuperflex: boolean = false
  ): number {
    let adjustedValue = ktcValue;

    if (factors.superflex_boost && isSuperflex) {
      adjustedValue *= (1 + factors.superflex_boost);
    }

    if (factors.playoff_schedule) {
      adjustedValue *= (1 + factors.playoff_schedule);
    }

    if (factors.recent_performance) {
      adjustedValue *= (1 + factors.recent_performance);
    }

    if (factors.injury_risk) {
      adjustedValue *= (1 - Math.abs(factors.injury_risk));
    }

    if (factors.age_factor) {
      adjustedValue *= (1 + factors.age_factor);
    }

    if (factors.team_situation) {
      adjustedValue *= (1 + factors.team_situation);
    }

    return Math.round(adjustedValue);
  }

  async getPlayerValues(
    position?: string,
    limit: number = 100
  ): Promise<PlayerValue[]> {
    try {
      let query = supabase
        .from('player_values')
        .select('*')
        .order('fdp_value', { ascending: false })
        .limit(limit);

      if (position) {
        query = query.eq('position', position);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching player values:', error);
      return [];
    }
  }

  async getPlayerValue(playerId: string): Promise<PlayerValue | null> {
    try {
      const { data, error } = await supabase
        .from('player_values')
        .select('*')
        .eq('player_id', playerId)
        .maybeSingle();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error fetching player value:', error);
      return null;
    }
  }

  async getAdjustmentFactors(playerId: string): Promise<ValueAdjustmentFactors | null> {
    try {
      const { data, error } = await supabase
        .from('value_adjustment_factors')
        .select('*')
        .eq('player_id', playerId)
        .maybeSingle();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error fetching adjustment factors:', error);
      return null;
    }
  }

  async getUserCustomValue(userId: string, playerId: string): Promise<UserCustomValue | null> {
    try {
      const { data, error } = await supabase
        .from('user_custom_values')
        .select('*')
        .eq('user_id', userId)
        .eq('player_id', playerId)
        .maybeSingle();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error fetching user custom value:', error);
      return null;
    }
  }

  async setUserCustomValue(
    userId: string,
    playerId: string,
    customValue: number,
    notes: string = ''
  ): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('user_custom_values')
        .upsert({
          user_id: userId,
          player_id: playerId,
          custom_value: customValue,
          notes: notes,
          updated_at: new Date().toISOString(),
        });

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error setting user custom value:', error);
      return false;
    }
  }

  async searchPlayers(searchTerm: string, limit: number = 20): Promise<PlayerValue[]> {
    try {
      const { data, error } = await supabase
        .from('player_values')
        .select('*')
        .ilike('player_name', `%${searchTerm}%`)
        .order('fdp_value', { ascending: false })
        .limit(limit);

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error searching players:', error);
      return [];
    }
  }

  async getTopRisers(limit: number = 10): Promise<PlayerValue[]> {
    try {
      const { data, error } = await supabase
        .from('player_values')
        .select('*')
        .eq('trend', 'up')
        .order('fdp_value', { ascending: false })
        .limit(limit);

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching top risers:', error);
      return [];
    }
  }

  async getTopFallers(limit: number = 10): Promise<PlayerValue[]> {
    try {
      const { data, error } = await supabase
        .from('player_values')
        .select('*')
        .eq('trend', 'down')
        .order('fdp_value', { ascending: false })
        .limit(limit);

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching top fallers:', error);
      return [];
    }
  }

  async comparePlayerValues(playerIds: string[]): Promise<PlayerValue[]> {
    try {
      const { data, error } = await supabase
        .from('player_values')
        .select('*')
        .in('player_id', playerIds);

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error comparing player values:', error);
      return [];
    }
  }

  formatValue(value: number): string {
    if (value >= 10000) {
      return `${(value / 1000).toFixed(1)}k`;
    }
    return value.toString();
  }

  getValueDifference(value1: number, value2: number): {
    difference: number;
    percentage: number;
    direction: 'positive' | 'negative' | 'neutral';
  } {
    const difference = value1 - value2;
    const percentage = value2 !== 0 ? (difference / value2) * 100 : 0;
    const direction = difference > 0 ? 'positive' : difference < 0 ? 'negative' : 'neutral';

    return { difference, percentage, direction };
  }
}

export const playerValuesApi = new PlayerValuesApi();
