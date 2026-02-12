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

export interface SportsDataPlayer {
  PlayerID: number;
  Name: string;
  Team: string;
  Position: string;
  FantasyPoints: number;
  AverageDraftPosition: number;
  LastGameFantasyPoints: number;
  ProjectedFantasyPoints: number;
}

class PlayerValuesApi {
  private readonly SPORTS_DATA_API_KEY = '15f968f1d055437186750d24b8ced580';
  private readonly SPORTS_DATA_BASE = 'https://api.sportsdata.io/v3/nfl';

  async fetchSportsDataPlayers(): Promise<SportsDataPlayer[]> {
    try {
      const response = await fetch(
        `${this.SPORTS_DATA_BASE}/projections/json/FantasyPlayers?key=${this.SPORTS_DATA_API_KEY}`
      );
      if (!response.ok) {
        throw new Error('Failed to fetch SportsData.io player data');
      }
      const data = await response.json();
      return data || [];
    } catch (error) {
      console.error('Error fetching SportsData.io values:', error);
      return [];
    }
  }

  async fetchKTCValues(isSuperflex: boolean = false): Promise<Map<string, { value: number; playerName: string; position: string; team: string }>> {
    try {
      const currentYear = new Date().getFullYear();
      const targetYear = currentYear >= 2025 ? currentYear : 2025;
      const format = isSuperflex ? 2 : 1;

      const response = await fetch(`https://api.keeptradecut.com/bff/dynasty/players?season=${targetYear}&format=${format}`, {
        headers: {
          'Accept': 'application/json',
        },
      });

      if (!response.ok) {
        const fallbackResponse = await fetch(`https://api.keeptradecut.com/bff/dynasty/players?format=${format}`, {
          headers: {
            'Accept': 'application/json',
          },
        });

        if (!fallbackResponse.ok) {
          throw new Error('Failed to fetch KTC values');
        }

        const data = await fallbackResponse.json();
        return this.parseKTCData(data);
      }

      const data = await response.json();
      return this.parseKTCData(data);
    } catch (error) {
      console.error('Error fetching KTC values:', error);
      return new Map();
    }
  }

  private parseKTCData(data: any): Map<string, { value: number; playerName: string; position: string; team: string }> {
    const valueMap = new Map<string, { value: number; playerName: string; position: string; team: string }>();

    if (Array.isArray(data)) {
      data.forEach((item: any) => {
        if (item.sleeperId && item.value) {
          valueMap.set(item.sleeperId, {
            value: parseInt(item.value, 10),
            playerName: item.playerName || '',
            position: item.position || '',
            team: item.team || ''
          });
        }
      });
    }

    return valueMap;
  }

  convertSportsDataToPlayerValue(player: SportsDataPlayer, ktcValue: number = 0): Partial<PlayerValue> {
    const baseValue = player.FantasyPoints || player.ProjectedFantasyPoints || 0;
    const normalizedValue = Math.round(baseValue * 100);

    let trend: 'up' | 'down' | 'stable' = 'stable';
    if (player.LastGameFantasyPoints > player.FantasyPoints) {
      trend = 'up';
    } else if (player.LastGameFantasyPoints < player.FantasyPoints) {
      trend = 'down';
    }

    return {
      player_id: player.PlayerID.toString(),
      player_name: player.Name,
      position: player.Position,
      team: player.Team,
      ktc_value: ktcValue || normalizedValue,
      fdp_value: normalizedValue,
      trend,
      last_updated: new Date().toISOString(),
      metadata: {
        fantasy_points: player.FantasyPoints,
        projected_points: player.ProjectedFantasyPoints,
        adp: player.AverageDraftPosition,
        last_game_points: player.LastGameFantasyPoints,
      },
    };
  }

  async syncPlayerValuesFromSportsData(isSuperflex: boolean = false): Promise<number> {
    try {
      const ktcValueMap = await this.fetchKTCValues(isSuperflex);

      if (ktcValueMap.size === 0) {
        throw new Error('No KTC values fetched');
      }

      const playerValues: any[] = [];

      ktcValueMap.forEach((ktcData, sleeperId) => {
        if (!ktcData.position || !['QB', 'RB', 'WR', 'TE', 'PICK'].includes(ktcData.position)) return;

        const factors: Partial<ValueAdjustmentFactors> = {
          superflex_boost: isSuperflex && ktcData.position === 'QB' ? 0.05 : 0,
          recent_performance: 0,
          playoff_schedule: 0,
          injury_risk: 0,
          age_factor: 0,
          team_situation: 0,
        };

        const fdpValue = this.calculateFDPValue(ktcData.value, factors, isSuperflex);

        let trend: 'up' | 'down' | 'stable' = 'stable';

        playerValues.push({
          player_id: sleeperId,
          player_name: ktcData.playerName,
          position: ktcData.position,
          team: ktcData.team || null,
          ktc_value: ktcData.value,
          fdp_value: fdpValue,
          trend: trend,
          last_updated: new Date().toISOString(),
          metadata: {
            is_superflex: isSuperflex,
            source: 'ktc'
          },
        });
      });

      if (playerValues.length > 0) {
        const { error } = await supabase
          .from('player_values')
          .upsert(playerValues, { onConflict: 'player_id' });

        if (error) throw error;
        console.log(`Synced ${playerValues.length} player values from KTC`);
      }

      return playerValues.length;
    } catch (error) {
      console.error('Error syncing player values:', error);
      return 0;
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
