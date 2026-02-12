import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export interface UserLeague {
  id: string;
  user_id: string;
  league_id: string;
  league_name: string;
  team_name?: string;
  is_superflex: boolean;
  is_active: boolean;
  created_at: string;
}

export interface DraftPickData {
  id: string;
  year: number;
  round: number;
  displayName: string;
}

export interface TradeItemData {
  type: 'player' | 'pick';
  id: string;
  name: string;
  position?: string;
  value: number;
}

export interface SavedTrade {
  id: string;
  user_id: string;
  league_id: string;
  trade_data?: {
    team_a_gives?: string[];
    team_a_gets?: string[];
    team_a_gives_picks?: DraftPickData[];
    team_a_gets_picks?: DraftPickData[];
  };
  trade_result?: {
    team_a_value?: number;
    team_b_value?: number;
    difference?: number;
    winner?: string;
    fairness?: string;
    team_a_items?: TradeItemData[];
    team_b_items?: TradeItemData[];
  };
  team_a_gives?: string[];
  team_a_gets?: string[];
  team_a_value?: number;
  team_b_value?: number;
  difference?: number;
  winner?: string;
  fairness?: string;
  notes?: string;
  created_at: string;
}
