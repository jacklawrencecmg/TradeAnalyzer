import { supabase } from '../lib/supabase';
import { sportsDataAPI } from './sportsdataApi';

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
  age?: number | null;
  years_experience?: number | null;
  injury_status?: string | null;
  bye_week?: number | null;
  college?: string | null;
  draft_year?: number | null;
  draft_round?: number | null;
  draft_pick?: number | null;
  contract_years_remaining?: number | null;
  tier?: string | null;
  volatility_score?: number | null;
}

export interface PlayerValueHistory {
  id: string;
  player_id: string;
  value: number;
  source: 'ktc' | 'fdp';
  snapshot_date: string;
  created_at: string;
}

export interface PlayerValueChange {
  player_id: string;
  change_7d: number;
  change_30d: number;
  change_season: number;
  percent_7d: number;
  percent_30d: number;
  percent_season: number;
  last_calculated: string;
}

export interface DynastyDraftPick {
  id: string;
  pick_id: string;
  year: number;
  round: number;
  pick_number: number;
  value: number;
  display_name: string;
  last_updated: string;
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
  async fetchSportsDataPlayers(): Promise<SportsDataPlayer[]> {
    try {
      const players = await sportsDataAPI.getAllPlayers();
      const projections = await sportsDataAPI.getPlayerProjections();

      return players.map(player => {
        const projection = projections.find(p => p.PlayerID === player.PlayerID);
        return {
          PlayerID: player.PlayerID,
          Name: player.Name,
          Team: player.Team,
          Position: player.Position,
          FantasyPoints: projection?.FantasyPointsPPR || 0,
          AverageDraftPosition: 0,
          LastGameFantasyPoints: 0,
          ProjectedFantasyPoints: projection?.FantasyPointsPPR || 0,
        };
      });
    } catch (error) {
      console.error('Error fetching SportsData.io values:', error);
      return [];
    }
  }

  async getPlayerDetailsFromSportsData(playerName: string): Promise<any> {
    try {
      const [playerInfo, projection, news, injuries] = await Promise.all([
        sportsDataAPI.getPlayerByName(playerName),
        sportsDataAPI.getPlayerProjection(playerName),
        sportsDataAPI.getPlayerNews(playerName),
        sportsDataAPI.getInjuries(),
      ]);

      const injury = injuries.find(i =>
        i.Name?.toLowerCase() === playerName.toLowerCase()
      );

      return {
        info: playerInfo,
        projection,
        news: news.slice(0, 5),
        injury,
      };
    } catch (error) {
      console.error('Error fetching player details:', error);
      return null;
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
      const [sleeperPlayers, projections, injuries, playerInfo, recentStats] = await Promise.all([
        this.fetchSleeperPlayers(),
        sportsDataAPI.getPlayerProjections().catch(() => []),
        sportsDataAPI.getInjuries().catch(() => []),
        sportsDataAPI.getAllPlayers().catch(() => []),
        sportsDataAPI.getPlayerStats().catch(() => []),
      ]);

      if (projections.length === 0) {
        throw new Error('No SportsData.io projections fetched');
      }

      const playerValues: any[] = [];
      const sleeperNameMap = new Map(sleeperPlayers.map(p => [p.full_name.toLowerCase(), p.player_id]));

      projections.forEach((projection) => {
        if (!projection.Position || !['QB', 'RB', 'WR', 'TE'].includes(projection.Position)) return;

        const playerNameLower = projection.Name.toLowerCase();
        const sleeperId = sleeperNameMap.get(playerNameLower);

        if (!sleeperId) {
          console.log(`No Sleeper ID found for: ${projection.Name}`);
          return;
        }

        const injury = injuries.find(i => i.Name?.toLowerCase() === playerNameLower);
        const info = playerInfo.find(p => p.PlayerID === projection.PlayerID);
        const stats = recentStats.find(s => s.PlayerID === projection.PlayerID);

        const baseValue = this.calculateProjectionBasedValue(
          projection,
          stats,
          injury,
          info,
          isSuperflex
        );

        const factors: Partial<ValueAdjustmentFactors> = {
          superflex_boost: isSuperflex && projection.Position === 'QB' ? 0.5 : 0,
          recent_performance: stats ? this.calculateRecentPerformance(stats, projection) : 0,
          playoff_schedule: 0,
          injury_risk: this.calculateInjuryRisk(injury?.Status),
          age_factor: info?.Experience ? this.calculateAgeFactor(info.Experience, projection.Position) : 0,
          team_situation: 0,
        };

        const fdpValue = this.calculateFDPValue(baseValue, factors, isSuperflex);

        let trend: 'up' | 'down' | 'stable' = 'stable';
        if (stats && projection.FantasyPointsPPR) {
          const recentPPG = stats.Games > 0 ? stats.FantasyPointsPPR / stats.Games : 0;
          const projectedPPG = projection.Games > 0 ? projection.FantasyPointsPPR / projection.Games : 0;
          if (recentPPG > projectedPPG * 1.1) trend = 'up';
          else if (recentPPG < projectedPPG * 0.9) trend = 'down';
        }

        playerValues.push({
          player_id: sleeperId,
          player_name: projection.Name,
          position: projection.Position,
          team: projection.Team || null,
          ktc_value: Math.round(baseValue * 0.8),
          fdp_value: fdpValue,
          trend: trend,
          last_updated: new Date().toISOString(),
          injury_status: injury?.Status?.toLowerCase() || null,
          years_experience: info?.Experience || null,
          metadata: {
            is_superflex: isSuperflex,
            source: 'sportsdata_projections',
            injury_body_part: injury?.InjuryBodyPart || null,
            injury_notes: injury?.InjuryNotes || null,
            projected_points: projection.FantasyPointsPPR || null,
            projected_games: projection.Games || null,
            passing_yards: projection.PassingYards || null,
            passing_tds: projection.PassingTouchdowns || null,
            rushing_yards: projection.RushingYards || null,
            rushing_tds: projection.RushingTouchdowns || null,
            receptions: projection.Receptions || null,
            receiving_yards: projection.ReceivingYards || null,
            receiving_tds: projection.ReceivingTouchdowns || null,
            experience: info?.Experience || null,
          },
        });
      });

      if (playerValues.length > 0) {
        const { error } = await supabase
          .from('player_values')
          .upsert(playerValues, { onConflict: 'player_id' });

        if (error) throw error;
        console.log(`Synced ${playerValues.length} player values from SportsData.io projections`);
      }

      return playerValues.length;
    } catch (error) {
      console.error('Error syncing player values:', error);
      return 0;
    }
  }

  private async fetchSleeperPlayers(): Promise<any[]> {
    try {
      const response = await fetch('https://api.sleeper.app/v1/players/nfl');
      if (!response.ok) throw new Error('Failed to fetch Sleeper players');
      const data = await response.json();

      return Object.entries(data).map(([id, player]: [string, any]) => ({
        player_id: id,
        full_name: player.full_name || `${player.first_name} ${player.last_name}`,
        position: player.position,
        team: player.team,
      }));
    } catch (error) {
      console.error('Error fetching Sleeper players:', error);
      return [];
    }
  }

  private calculateProjectionBasedValue(
    projection: any,
    stats: any,
    injury: any,
    info: any,
    isSuperflex: boolean
  ): number {
    const ppr = projection.FantasyPointsPPR || 0;
    const games = projection.Games || 16;

    const ppg = games > 0 ? ppr / games : 0;

    const positionMultipliers: Record<string, number> = {
      'QB': isSuperflex ? 85 : 50,
      'RB': 75,
      'WR': 65,
      'TE': 55,
    };

    const multiplier = positionMultipliers[projection.Position] || 50;

    let baseValue = ppg * multiplier;

    if (ppg > 20) baseValue *= 1.3;
    else if (ppg > 15) baseValue *= 1.2;
    else if (ppg > 10) baseValue *= 1.1;
    else if (ppg < 5) baseValue *= 0.7;

    return Math.round(baseValue);
  }

  private calculateRecentPerformance(stats: any, projection: any): number {
    if (!stats.Games || stats.Games === 0) return 0;

    const recentPPG = stats.FantasyPointsPPR / stats.Games;
    const projectedPPG = projection.Games > 0 ? projection.FantasyPointsPPR / projection.Games : 0;

    if (projectedPPG === 0) return 0;

    const performanceRatio = recentPPG / projectedPPG;

    if (performanceRatio > 1.2) return 0.15;
    if (performanceRatio > 1.1) return 0.10;
    if (performanceRatio < 0.8) return -0.15;
    if (performanceRatio < 0.9) return -0.10;

    return 0;
  }

  private calculateAgeFactor(experience: number, position: string): number {
    if (position === 'RB') {
      if (experience <= 2) return 0.10;
      if (experience <= 4) return 0.05;
      if (experience >= 7) return -0.15;
      if (experience >= 6) return -0.10;
    } else if (position === 'WR' || position === 'TE') {
      if (experience <= 2) return 0.05;
      if (experience >= 10) return -0.10;
      if (experience >= 8) return -0.05;
    } else if (position === 'QB') {
      if (experience <= 3) return 0.05;
      if (experience >= 12) return -0.05;
    }

    return 0;
  }

  private calculateInjuryRisk(status?: string): number {
    if (!status) return 0;
    const statusLower = status.toLowerCase();
    if (statusLower.includes('out') || statusLower.includes('ir')) return -0.3;
    if (statusLower.includes('doubtful')) return -0.15;
    if (statusLower.includes('questionable')) return -0.05;
    return 0;
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

    if (factors.age_factor) {
      adjustedValue *= (1 + factors.age_factor);
    }

    if (factors.team_situation) {
      adjustedValue *= (1 + factors.team_situation);
    }

    if (factors.injury_risk) {
      adjustedValue *= (1 + factors.injury_risk);
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

  async getPlayerValueHistory(playerId: string, days: number = 30): Promise<PlayerValueHistory[]> {
    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const { data, error } = await supabase
        .from('player_value_history')
        .select('*')
        .eq('player_id', playerId)
        .gte('snapshot_date', startDate.toISOString().split('T')[0])
        .order('snapshot_date', { ascending: true });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching player value history:', error);
      return [];
    }
  }

  async getPlayerValueChanges(playerIds?: string[]): Promise<PlayerValueChange[]> {
    try {
      let query = supabase
        .from('player_value_changes')
        .select('*');

      if (playerIds && playerIds.length > 0) {
        query = query.in('player_id', playerIds);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching player value changes:', error);
      return [];
    }
  }

  async getBiggestMovers(period: '7d' | '30d' | 'season' = '7d', limit: number = 10): Promise<{risers: PlayerValue[], fallers: PlayerValue[]}> {
    try {
      const changeColumn = period === '7d' ? 'change_7d' : period === '30d' ? 'change_30d' : 'change_season';

      const { data: changes, error: changesError } = await supabase
        .from('player_value_changes')
        .select('player_id, ' + changeColumn)
        .order(changeColumn, { ascending: false })
        .limit(limit * 2);

      if (changesError) throw changesError;

      const playerIds = changes?.map(c => c.player_id) || [];
      if (playerIds.length === 0) return { risers: [], fallers: [] };

      const { data: players, error: playersError } = await supabase
        .from('player_values')
        .select('*')
        .in('player_id', playerIds);

      if (playersError) throw playersError;

      const playerMap = new Map(players?.map(p => [p.player_id, p]) || []);

      const risers = changes
        ?.filter(c => (c as any)[changeColumn] > 0)
        .slice(0, limit)
        .map(c => playerMap.get(c.player_id))
        .filter(p => p !== undefined) as PlayerValue[] || [];

      const fallers = changes
        ?.filter(c => (c as any)[changeColumn] < 0)
        .slice(-limit)
        .reverse()
        .map(c => playerMap.get(c.player_id))
        .filter(p => p !== undefined) as PlayerValue[] || [];

      return { risers, fallers };
    } catch (error) {
      console.error('Error fetching biggest movers:', error);
      return { risers: [], fallers: [] };
    }
  }

  async getDynastyDraftPicks(year?: number): Promise<DynastyDraftPick[]> {
    try {
      let query = supabase
        .from('dynasty_draft_picks')
        .select('*')
        .order('year', { ascending: true })
        .order('round', { ascending: true })
        .order('pick_number', { ascending: true });

      if (year) {
        query = query.eq('year', year);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching dynasty draft picks:', error);
      return [];
    }
  }

  async getRookies(year?: number): Promise<PlayerValue[]> {
    try {
      const currentYear = year || new Date().getFullYear();

      const { data, error } = await supabase
        .from('player_values')
        .select('*')
        .eq('draft_year', currentYear)
        .order('fdp_value', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching rookies:', error);
      return [];
    }
  }

  async saveValueSnapshot(): Promise<boolean> {
    try {
      const { data: players, error: playersError } = await supabase
        .from('player_values')
        .select('player_id, fdp_value');

      if (playersError) throw playersError;

      const today = new Date().toISOString().split('T')[0];
      const snapshots = players?.map(p => ({
        player_id: p.player_id,
        value: p.fdp_value,
        source: 'fdp',
        snapshot_date: today,
      })) || [];

      if (snapshots.length > 0) {
        const { error } = await supabase
          .from('player_value_history')
          .upsert(snapshots, { onConflict: 'player_id,source,snapshot_date', ignoreDuplicates: true });

        if (error) throw error;
      }

      return true;
    } catch (error) {
      console.error('Error saving value snapshot:', error);
      return false;
    }
  }

  getInjuryBadgeColor(status: string | null | undefined): string {
    switch (status) {
      case 'out':
      case 'ir':
        return 'bg-red-500/20 text-red-400 border-red-500/30';
      case 'doubtful':
        return 'bg-orange-500/20 text-orange-400 border-orange-500/30';
      case 'questionable':
        return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
      default:
        return 'bg-green-500/20 text-green-400 border-green-500/30';
    }
  }

  getTierBadgeColor(tier: string | null | undefined): string {
    switch (tier) {
      case 'elite':
        return 'bg-purple-500/20 text-purple-300 border-purple-500/30';
      case 'tier1':
        return 'bg-blue-500/20 text-blue-300 border-blue-500/30';
      case 'tier2':
        return 'bg-teal-500/20 text-teal-300 border-teal-500/30';
      case 'tier3':
        return 'bg-green-500/20 text-green-300 border-green-500/30';
      case 'flex':
        return 'bg-gray-500/20 text-gray-300 border-gray-500/30';
      case 'depth':
        return 'bg-slate-500/20 text-slate-400 border-slate-500/30';
      default:
        return 'bg-gray-500/20 text-gray-300 border-gray-500/30';
    }
  }
}

export const playerValuesApi = new PlayerValuesApi();
