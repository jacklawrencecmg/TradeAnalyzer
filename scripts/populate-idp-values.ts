import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing Supabase credentials. Please check your .env file.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

interface IDPPlayer {
  full_name: string;
  position: 'DL' | 'LB' | 'DB';
  sub_position?: string;
  team: string;
  base_value: number;
  position_rank: number;
}

const idpPlayers: IDPPlayer[] = [
  { full_name: 'Micah Parsons', position: 'LB', sub_position: 'OLB', team: 'DAL', base_value: 5200, position_rank: 1 },
  { full_name: 'Fred Warner', position: 'LB', sub_position: 'ILB', team: 'SF', base_value: 4800, position_rank: 2 },
  { full_name: 'Roquan Smith', position: 'LB', sub_position: 'ILB', team: 'BAL', base_value: 4500, position_rank: 3 },
  { full_name: 'Bobby Wagner', position: 'LB', sub_position: 'ILB', team: 'WAS', base_value: 3200, position_rank: 4 },
  { full_name: 'C.J. Mosley', position: 'LB', sub_position: 'ILB', team: 'NYJ', base_value: 3100, position_rank: 5 },
  { full_name: 'Foye Oluokun', position: 'LB', sub_position: 'ILB', team: 'JAX', base_value: 3000, position_rank: 6 },
  { full_name: 'Zaire Franklin', position: 'LB', sub_position: 'ILB', team: 'IND', base_value: 2900, position_rank: 7 },
  { full_name: 'Patrick Queen', position: 'LB', sub_position: 'ILB', team: 'PIT', base_value: 2800, position_rank: 8 },
  { full_name: 'Tremaine Edmunds', position: 'LB', sub_position: 'ILB', team: 'CHI', base_value: 2700, position_rank: 9 },
  { full_name: 'Cole Holcomb', position: 'LB', sub_position: 'ILB', team: 'PIT', base_value: 2600, position_rank: 10 },
  { full_name: 'Jordyn Brooks', position: 'LB', sub_position: 'ILB', team: 'MIA', base_value: 2500, position_rank: 11 },
  { full_name: 'Lavonte David', position: 'LB', sub_position: 'OLB', team: 'TB', base_value: 2400, position_rank: 12 },
  { full_name: 'Dre Greenlaw', position: 'LB', sub_position: 'ILB', team: 'SF', base_value: 2300, position_rank: 13 },
  { full_name: 'Devin White', position: 'LB', sub_position: 'ILB', team: 'PHI', base_value: 2200, position_rank: 14 },
  { full_name: 'Ernest Jones', position: 'LB', sub_position: 'ILB', team: 'TEN', base_value: 2100, position_rank: 15 },
  { full_name: 'Demario Davis', position: 'LB', sub_position: 'ILB', team: 'NO', base_value: 2000, position_rank: 16 },
  { full_name: 'Alex Singleton', position: 'LB', sub_position: 'ILB', team: 'DEN', base_value: 1900, position_rank: 17 },
  { full_name: 'Foyesade Oluokun', position: 'LB', sub_position: 'ILB', team: 'JAX', base_value: 1850, position_rank: 18 },
  { full_name: 'Cody Barton', position: 'LB', sub_position: 'ILB', team: 'DEN', base_value: 1800, position_rank: 19 },
  { full_name: 'Jerome Baker', position: 'LB', sub_position: 'ILB', team: 'SEA', base_value: 1750, position_rank: 20 },

  { full_name: 'T.J. Watt', position: 'DL', sub_position: 'EDGE', team: 'PIT', base_value: 4800, position_rank: 1 },
  { full_name: 'Myles Garrett', position: 'DL', sub_position: 'EDGE', team: 'CLE', base_value: 4500, position_rank: 2 },
  { full_name: 'Nick Bosa', position: 'DL', sub_position: 'EDGE', team: 'SF', base_value: 4200, position_rank: 3 },
  { full_name: 'Maxx Crosby', position: 'DL', sub_position: 'EDGE', team: 'LV', base_value: 4000, position_rank: 4 },
  { full_name: 'Danielle Hunter', position: 'DL', sub_position: 'EDGE', team: 'HOU', base_value: 3800, position_rank: 5 },
  { full_name: 'Josh Allen', position: 'DL', sub_position: 'EDGE', team: 'JAX', base_value: 3600, position_rank: 6 },
  { full_name: 'Rashan Gary', position: 'DL', sub_position: 'EDGE', team: 'GB', base_value: 3400, position_rank: 7 },
  { full_name: 'Brian Burns', position: 'DL', sub_position: 'EDGE', team: 'NYG', base_value: 3300, position_rank: 8 },
  { full_name: 'Montez Sweat', position: 'DL', sub_position: 'EDGE', team: 'CHI', base_value: 3200, position_rank: 9 },
  { full_name: 'Josh Hines-Allen', position: 'DL', sub_position: 'EDGE', team: 'JAX', base_value: 3100, position_rank: 10 },
  { full_name: 'Chris Jones', position: 'DL', sub_position: 'DT', team: 'KC', base_value: 3000, position_rank: 11 },
  { full_name: 'Dexter Lawrence', position: 'DL', sub_position: 'DT', team: 'NYG', base_value: 2900, position_rank: 12 },
  { full_name: 'Quinnen Williams', position: 'DL', sub_position: 'DT', team: 'NYJ', base_value: 2800, position_rank: 13 },
  { full_name: 'Jeffery Simmons', position: 'DL', sub_position: 'DT', team: 'TEN', base_value: 2700, position_rank: 14 },
  { full_name: 'Jalen Carter', position: 'DL', sub_position: 'DT', team: 'PHI', base_value: 2600, position_rank: 15 },
  { full_name: 'DeForest Buckner', position: 'DL', sub_position: 'DT', team: 'IND', base_value: 2500, position_rank: 16 },
  { full_name: 'Vita Vea', position: 'DL', sub_position: 'DT', team: 'TB', base_value: 2400, position_rank: 17 },
  { full_name: 'Zach Allen', position: 'DL', sub_position: 'EDGE', team: 'DEN', base_value: 2300, position_rank: 18 },
  { full_name: 'Haason Reddick', position: 'DL', sub_position: 'EDGE', team: 'NYJ', base_value: 2200, position_rank: 19 },
  { full_name: 'Cameron Heyward', position: 'DL', sub_position: 'DT', team: 'PIT', base_value: 2100, position_rank: 20 },

  { full_name: 'Derwin James', position: 'DB', sub_position: 'S', team: 'LAC', base_value: 4200, position_rank: 1 },
  { full_name: 'Antoine Winfield Jr.', position: 'DB', sub_position: 'S', team: 'TB', base_value: 4000, position_rank: 2 },
  { full_name: 'Kyle Hamilton', position: 'DB', sub_position: 'S', team: 'BAL', base_value: 3800, position_rank: 3 },
  { full_name: 'Jessie Bates III', position: 'DB', sub_position: 'S', team: 'ATL', base_value: 3600, position_rank: 4 },
  { full_name: 'Minkah Fitzpatrick', position: 'DB', sub_position: 'S', team: 'PIT', base_value: 3400, position_rank: 5 },
  { full_name: 'Budda Baker', position: 'DB', sub_position: 'S', team: 'ARI', base_value: 3200, position_rank: 6 },
  { full_name: 'Justin Simmons', position: 'DB', sub_position: 'S', team: 'ATL', base_value: 3000, position_rank: 7 },
  { full_name: 'Kevin Byard', position: 'DB', sub_position: 'S', team: 'CHI', base_value: 2900, position_rank: 8 },
  { full_name: 'Jalen Ramsey', position: 'DB', sub_position: 'CB', team: 'MIA', base_value: 2800, position_rank: 9 },
  { full_name: 'Patrick Surtain II', position: 'DB', sub_position: 'CB', team: 'DEN', base_value: 2700, position_rank: 10 },
  { full_name: 'Sauce Gardner', position: 'DB', sub_position: 'CB', team: 'NYJ', base_value: 2600, position_rank: 11 },
  { full_name: 'Jaire Alexander', position: 'DB', sub_position: 'CB', team: 'GB', base_value: 2500, position_rank: 12 },
  { full_name: 'Trevon Diggs', position: 'DB', sub_position: 'CB', team: 'DAL', base_value: 2400, position_rank: 13 },
  { full_name: 'Marlon Humphrey', position: 'DB', sub_position: 'CB', team: 'BAL', base_value: 2300, position_rank: 14 },
  { full_name: 'Darius Slay', position: 'DB', sub_position: 'CB', team: 'PHI', base_value: 2200, position_rank: 15 },
  { full_name: 'Jaylon Johnson', position: 'DB', sub_position: 'CB', team: 'CHI', base_value: 2100, position_rank: 16 },
  { full_name: 'Denzel Ward', position: 'DB', sub_position: 'CB', team: 'CLE', base_value: 2000, position_rank: 17 },
  { full_name: 'Tariq Woolen', position: 'DB', sub_position: 'CB', team: 'SEA', base_value: 1900, position_rank: 18 },
  { full_name: 'Taron Johnson', position: 'DB', sub_position: 'CB', team: 'BUF', base_value: 1800, position_rank: 19 },
  { full_name: 'DaRon Bland', position: 'DB', sub_position: 'CB', team: 'DAL', base_value: 1750, position_rank: 20 },
];

async function populateIDPValues() {
  console.log('Starting IDP population...');

  const format = 'dynasty_sf';
  const scoringPreset = 'balanced';
  const capturedAt = new Date().toISOString();

  let successCount = 0;
  let errorCount = 0;

  for (const player of idpPlayers) {
    try {
      const playerId = `${player.full_name.toLowerCase().replace(/[^a-z0-9]/g, '_')}_${player.position.toLowerCase()}`;

      const fdpValue = Math.round(player.base_value * 1.1);

      const { error } = await supabase
        .from('ktc_value_snapshots')
        .insert({
          player_id: playerId,
          full_name: player.full_name,
          position: player.position,
          team: player.team,
          position_rank: player.position_rank,
          ktc_value: player.base_value,
          fdp_value: fdpValue,
          format,
          scoring_preset: scoringPreset,
          source: 'manual_seed',
          captured_at: capturedAt,
        });

      if (error) {
        console.error(`Error inserting ${player.full_name}:`, error.message);
        errorCount++;
      } else {
        console.log(`✓ ${player.full_name} (${player.position}) - ${fdpValue} FDP`);
        successCount++;
      }
    } catch (err) {
      console.error(`Error processing ${player.full_name}:`, err);
      errorCount++;
    }
  }

  console.log('\n=== IDP Population Complete ===');
  console.log(`Success: ${successCount}`);
  console.log(`Errors: ${errorCount}`);
  console.log(`Total: ${idpPlayers.length}`);
}

populateIDPValues();
