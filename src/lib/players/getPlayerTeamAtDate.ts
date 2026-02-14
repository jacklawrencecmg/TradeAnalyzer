import { supabase } from '../supabase';

export interface TeamHistoryRecord {
  id: string;
  player_id: string;
  team: string;
  from_date: string;
  to_date: string | null;
  is_current: boolean;
  source: string;
}

export interface TransactionRecord {
  id: string;
  player_id: string;
  transaction_type: string;
  team_from: string | null;
  team_to: string | null;
  transaction_date: string;
  source: string;
  metadata: Record<string, any>;
}

export async function getPlayerTeamAtDate(
  playerId: string,
  date: Date | string = new Date()
): Promise<string | null> {
  try {
    const dateStr = typeof date === 'string' ? date : date.toISOString();

    const { data, error } = await supabase.rpc('get_player_team_at_date', {
      p_player_id: playerId,
      p_date: dateStr,
    });

    if (error) {
      console.error('Error getting player team at date:', error);
      return null;
    }

    return data;
  } catch (err) {
    console.error('Error:', err);
    return null;
  }
}

export async function getPlayerTeamHistory(playerId: string): Promise<TeamHistoryRecord[]> {
  try {
    const { data, error } = await supabase
      .from('player_team_history')
      .select('*')
      .eq('player_id', playerId)
      .order('from_date', { ascending: false });

    if (error) {
      console.error('Error fetching player team history:', error);
      return [];
    }

    return data || [];
  } catch (err) {
    console.error('Error:', err);
    return [];
  }
}

export async function getPlayerTransactions(playerId: string): Promise<TransactionRecord[]> {
  try {
    const { data, error } = await supabase
      .from('player_transactions')
      .select('*')
      .eq('player_id', playerId)
      .order('transaction_date', { ascending: false });

    if (error) {
      console.error('Error fetching player transactions:', error);
      return [];
    }

    return data || [];
  } catch (err) {
    console.error('Error:', err);
    return [];
  }
}

export async function getCurrentPlayerTeam(playerId: string): Promise<string | null> {
  try {
    const { data, error } = await supabase
      .from('player_team_history')
      .select('team')
      .eq('player_id', playerId)
      .eq('is_current', true)
      .maybeSingle();

    if (error) {
      console.error('Error fetching current player team:', error);
      return null;
    }

    if (data) {
      return data.team;
    }

    const { data: playerData, error: playerError } = await supabase
      .from('nfl_players')
      .select('team')
      .eq('id', playerId)
      .maybeSingle();

    if (playerError) {
      console.error('Error fetching player from nfl_players:', playerError);
      return null;
    }

    return playerData?.team || null;
  } catch (err) {
    console.error('Error:', err);
    return null;
  }
}

export async function getRecentTeamChanges(limit: number = 50): Promise<any[]> {
  try {
    const { data, error } = await supabase
      .from('player_transactions')
      .select(`
        *,
        nfl_players (
          full_name,
          player_position
        )
      `)
      .eq('transaction_type', 'team_changed')
      .order('transaction_date', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Error fetching recent team changes:', error);
      return [];
    }

    return data || [];
  } catch (err) {
    console.error('Error:', err);
    return [];
  }
}

export async function getPlayersByTeamAtDate(
  team: string,
  date: Date | string = new Date()
): Promise<any[]> {
  try {
    const dateStr = typeof date === 'string' ? date : date.toISOString();

    const { data, error } = await supabase
      .from('player_team_history')
      .select(`
        player_id,
        team,
        nfl_players (
          id,
          full_name,
          player_position,
          status
        )
      `)
      .eq('team', team)
      .lte('from_date', dateStr)
      .or(`to_date.is.null,to_date.gte.${dateStr}`);

    if (error) {
      console.error('Error fetching players by team at date:', error);
      return [];
    }

    return data || [];
  } catch (err) {
    console.error('Error:', err);
    return [];
  }
}

export async function recordManualTeamChange(
  playerId: string,
  newTeam: string,
  changeDate: Date | string = new Date()
): Promise<boolean> {
  try {
    const dateStr = typeof changeDate === 'string' ? changeDate : changeDate.toISOString();

    const { data, error } = await supabase.rpc('record_team_change', {
      p_player_id: playerId,
      p_new_team: newTeam,
      p_source: 'manual',
      p_change_date: dateStr,
    });

    if (error) {
      console.error('Error recording manual team change:', error);
      return false;
    }

    if (data && data.changed) {
      await supabase.from('player_events').insert({
        player_id: playerId,
        event_type: 'team_changed',
        metadata: {
          old_team: data.old_team,
          new_team: data.new_team,
          source: 'manual',
          changed_by: 'admin',
        },
      });
    }

    return true;
  } catch (err) {
    console.error('Error:', err);
    return false;
  }
}

export async function getTeamChangesInDateRange(
  startDate: Date | string,
  endDate: Date | string
): Promise<TransactionRecord[]> {
  try {
    const startStr = typeof startDate === 'string' ? startDate : startDate.toISOString();
    const endStr = typeof endDate === 'string' ? endDate : endDate.toISOString();

    const { data, error } = await supabase
      .from('player_transactions')
      .select(`
        *,
        nfl_players (
          full_name,
          player_position
        )
      `)
      .eq('transaction_type', 'team_changed')
      .gte('transaction_date', startStr)
      .lte('transaction_date', endStr)
      .order('transaction_date', { ascending: false });

    if (error) {
      console.error('Error fetching team changes in date range:', error);
      return [];
    }

    return data || [];
  } catch (err) {
    console.error('Error:', err);
    return [];
  }
}
