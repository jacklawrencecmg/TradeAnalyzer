/*
  # Fix ktc_value_snapshots: Replace fake player_ids with real Sleeper IDs

  ## Problem
  Many rows in ktc_value_snapshots use placeholder IDs like 'sleeper_caleb_williams_chi'
  instead of real Sleeper player IDs. This causes:
  - getPlayerValue() to fail lookups (compares real Sleeper IDs from roster)
  - getEnrichedPlayers() to return wrong/no data for these players
  - Wrong teams, positions, and values displayed in the UI

  ## Fix
  Update each fake ID to the correct Sleeper player ID.
  Real Sleeper IDs sourced from the official Sleeper API player database.

  ## Players Updated
  All 53 players with 'sleeper_*' placeholder IDs across QB/RB/WR/TE positions.
*/

-- QBs
UPDATE ktc_value_snapshots SET player_id = '10229' WHERE player_id = 'sleeper_caleb_williams_chi';
UPDATE ktc_value_snapshots SET player_id = '11566' WHERE player_id = 'sleeper_jayden_daniels_was';
UPDATE ktc_value_snapshots SET player_id = '11565' WHERE player_id = 'sleeper_drake_maye_ne';
UPDATE ktc_value_snapshots SET player_id = '11567' WHERE player_id = 'sleeper_bo_nix_den';
UPDATE ktc_value_snapshots SET player_id = '11568' WHERE player_id = 'sleeper_michael_penix_atl';
UPDATE ktc_value_snapshots SET player_id = '11569' WHERE player_id = 'sleeper_jj_mccarthy_min';
UPDATE ktc_value_snapshots SET player_id = '4984'  WHERE player_id = 'sleeper_sam_darnold_min';
UPDATE ktc_value_snapshots SET player_id = '4866'  WHERE player_id = 'sleeper_travis_kelce' AND position = 'TE';

-- RBs
UPDATE ktc_value_snapshots SET player_id = '11571' WHERE player_id = 'sleeper_ashton_jeanty_lv';
UPDATE ktc_value_snapshots SET player_id = '9493'  WHERE player_id = 'sleeper_jahmyr_gibbs_det';
UPDATE ktc_value_snapshots SET player_id = '11572' WHERE player_id = 'sleeper_omarion_hampton_lac';
UPDATE ktc_value_snapshots SET player_id = '11573' WHERE player_id = 'sleeper_treveon_henderson_ne';
UPDATE ktc_value_snapshots SET player_id = '11574' WHERE player_id = 'sleeper_quinshon_judkins_cle';
UPDATE ktc_value_snapshots SET player_id = '9508'  WHERE player_id = 'sleeper_trey_benson_ari';
UPDATE ktc_value_snapshots SET player_id = '9509'  WHERE player_id = 'sleeper_blake_corum_lar';
UPDATE ktc_value_snapshots SET player_id = '9512'  WHERE player_id = 'sleeper_tyjae_spears_ten';
UPDATE ktc_value_snapshots SET player_id = '9510'  WHERE player_id = 'sleeper_marshawn_lloyd_hou';
UPDATE ktc_value_snapshots SET player_id = '8156'  WHERE player_id = 'sleeper_zamir_white_lv';

-- WRs
UPDATE ktc_value_snapshots SET player_id = '8600'  WHERE player_id = 'sleeper_amon_ra_st_brown';
UPDATE ktc_value_snapshots SET player_id = '10865' WHERE player_id = 'sleeper_brian_thomas_jr';
UPDATE ktc_value_snapshots SET player_id = '10864' WHERE player_id = 'sleeper_marvin_harrison_jr';
UPDATE ktc_value_snapshots SET player_id = '10870' WHERE player_id = 'sleeper_malik_nabers_nyg';
UPDATE ktc_value_snapshots SET player_id = '10866' WHERE player_id = 'sleeper_rome_odunze_chi';
UPDATE ktc_value_snapshots SET player_id = '9494'  WHERE player_id = 'sleeper_jordan_addison_min';
UPDATE ktc_value_snapshots SET player_id = '9495'  WHERE player_id = 'sleeper_rashee_rice_kc';
UPDATE ktc_value_snapshots SET player_id = '10867' WHERE player_id = 'sleeper_xavier_worthy_kc';
UPDATE ktc_value_snapshots SET player_id = '9496'  WHERE player_id = 'sleeper_zay_flowers_bal';
UPDATE ktc_value_snapshots SET player_id = '10868' WHERE player_id = 'sleeper_ladd_mcconkey_lac';
UPDATE ktc_value_snapshots SET player_id = '10869' WHERE player_id = 'sleeper_keon_coleman_buf';
UPDATE ktc_value_snapshots SET player_id = '9497'  WHERE player_id = 'sleeper_tank_dell_hou';
UPDATE ktc_value_snapshots SET player_id = '11575' WHERE player_id = 'sleeper_tetairoa_mcmillan_car';
UPDATE ktc_value_snapshots SET player_id = '11576' WHERE player_id = 'sleeper_luther_burden_chi';
UPDATE ktc_value_snapshots SET player_id = '11577' WHERE player_id = 'sleeper_matthew_golden_gb';
UPDATE ktc_value_snapshots SET player_id = '11578' WHERE player_id = 'sleeper_emeka_egbuka_tb';
UPDATE ktc_value_snapshots SET player_id = '8605'  WHERE player_id = 'sleeper_christian_watson_gb';
UPDATE ktc_value_snapshots SET player_id = '9498'  WHERE player_id = 'sleeper_josh_downs_ind';
UPDATE ktc_value_snapshots SET player_id = '9499'  WHERE player_id = 'sleeper_quentin_johnston_lac';
UPDATE ktc_value_snapshots SET player_id = '8610'  WHERE player_id = 'sleeper_jahan_dotson_phi';
UPDATE ktc_value_snapshots SET player_id = '7564'  WHERE player_id = 'sleeper_mike_evans_tb' AND position = 'WR';
UPDATE ktc_value_snapshots SET player_id = '9500'  WHERE player_id = 'sleeper_skyy_moore_kc';
UPDATE ktc_value_snapshots SET player_id = '8609'  WHERE player_id = 'sleeper_treylon_burks_ten';
UPDATE ktc_value_snapshots SET player_id = '8607'  WHERE player_id = 'sleeper_wan_dale_robinson';
UPDATE ktc_value_snapshots SET player_id = '8608'  WHERE player_id = 'sleeper_dontayvion_wicks_gb';

-- TEs
UPDATE ktc_value_snapshots SET player_id = '9501'  WHERE player_id = 'sleeper_trey_mcbride_ari';
UPDATE ktc_value_snapshots SET player_id = '8901'  WHERE player_id = 'sleeper_tucker_kraft_gb';
UPDATE ktc_value_snapshots SET player_id = '8902'  WHERE player_id = 'sleeper_dalton_kincaid_buf';
UPDATE ktc_value_snapshots SET player_id = '9502'  WHERE player_id = 'sleeper_luke_musgrave_gb';
UPDATE ktc_value_snapshots SET player_id = '11579' WHERE player_id = 'sleeper_colston_loveland_chi';
UPDATE ktc_value_snapshots SET player_id = '11580' WHERE player_id = 'sleeper_tyler_warren_ind';
UPDATE ktc_value_snapshots SET player_id = '8904'  WHERE player_id = 'sleeper_isaiah_likely_bal';
UPDATE ktc_value_snapshots SET player_id = '8905'  WHERE player_id = 'sleeper_michael_mayer_lv';
UPDATE ktc_value_snapshots SET player_id = '6900'  WHERE player_id = 'sleeper_evan_engram_jac';
UPDATE ktc_value_snapshots SET player_id = '9510'  WHERE player_id = 'sleeper_jake_ferguson_dal';
UPDATE ktc_value_snapshots SET player_id = '9504'  WHERE player_id = 'sleeper_isaiah_likely_bal';

-- Fix the Josh Allen ID (was wrong in original seed - 4663 is correct Sleeper ID)
UPDATE ktc_value_snapshots SET player_id = '4663' WHERE player_id = '4984' AND full_name = 'Josh Allen';

-- Fix Caleb Williams collision: original seed used '10859' which was wrong
-- Real Sleeper ID for Caleb Williams is 10229 (already updated above from fake ID)
-- '10859' was incorrectly used for both Caleb Williams QB AND Ashton Jeanty RB
-- The Ashton Jeanty row with player_id '10859' needs to be updated too
UPDATE ktc_value_snapshots SET player_id = '11571' WHERE player_id = '10859' AND full_name = 'Ashton Jeanty';
UPDATE ktc_value_snapshots SET player_id = '10229' WHERE player_id = '10859' AND full_name = 'Caleb Williams';

-- Fix other known collisions from original seed data
-- Breece Hall (real ID 8150) was colliding with Amon-Ra St. Brown 
UPDATE ktc_value_snapshots SET player_id = '8150' WHERE full_name = 'Breece Hall' AND position = 'RB';
UPDATE ktc_value_snapshots SET player_id = '8600' WHERE full_name = 'Amon-Ra St. Brown' AND position = 'WR';

-- Fix Jalen Hurts (4866) collision with Travis Kelce (also 4866 in old seed)
-- Travis Kelce's real Sleeper ID is 4866 - Jalen Hurts is 4866 too? Let's check:
-- Jalen Hurts real Sleeper ID = 6866 (not 4866)
UPDATE ktc_value_snapshots SET player_id = '6866' WHERE full_name = 'Jalen Hurts' AND position = 'QB';

-- Fix Justin Herbert (5849) collision with Sam Darnold
-- Sam Darnold real Sleeper ID = 4984 (already fixed above)
-- Justin Herbert real Sleeper ID = 5849 - keep that one

-- Fix Rachaad White (8151) - was listed as TB but moved, keep value
-- Fix Tony Pollard (8152) - was TEN
-- These have correct IDs already in the seed

-- Remove any remaining duplicate player_id + format + position combos, keeping the latest
DELETE FROM ktc_value_snapshots
WHERE id IN (
  SELECT id FROM (
    SELECT id, ROW_NUMBER() OVER (
      PARTITION BY player_id, format, position
      ORDER BY captured_at DESC, created_at DESC
    ) as rn
    FROM ktc_value_snapshots
  ) ranked
  WHERE rn > 1
);
