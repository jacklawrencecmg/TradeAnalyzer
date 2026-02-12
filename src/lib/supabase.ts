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

export interface SavedTrade {
  id: string;
  user_id: string;
  league_id: string;
  team_a_gives: string[];
  team_a_gets: string[];
  team_a_value: number;
  team_b_value: number;
  difference: number;
  winner: string;
  fairness: string;
  notes?: string;
  created_at: string;
}
