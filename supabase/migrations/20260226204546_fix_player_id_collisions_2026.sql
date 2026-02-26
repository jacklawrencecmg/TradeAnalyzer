
/*
  # Fix Player ID Collisions in 2026 Baseline Data

  ## Summary
  The previous migration reused player_ids that already belonged to other players,
  causing the get_latest_values function (which partitions by player_id) to collapse
  two different players into one record.

  ## Changes
  - Assigns unique player_ids to all wrongly-colliding new baseline rows
  - Affects: Travis Kelce (shared with Jalen Hurts), Sam Darnold (shared with Justin Herbert),
    Mike Evans (shared with Ja'Marr Chase), Amon-Ra St. Brown (shared with Breece Hall),
    Jahmyr Gibbs (shared with Puka Nacua), and others

  ## Safe
  - Only updates rows with source = 'fdp_2026_baseline' that have ID conflicts
*/

-- Fix Travis Kelce collision with Jalen Hurts (both had player_id '4866')
UPDATE ktc_value_snapshots
SET player_id = 'sleeper_travis_kelce'
WHERE full_name = 'Travis Kelce' AND source = 'fdp_2026_baseline';

-- Fix Sam Darnold collision with Justin Herbert (both had player_id '5849')
UPDATE ktc_value_snapshots
SET player_id = 'sleeper_sam_darnold_min'
WHERE full_name = 'Sam Darnold' AND source = 'fdp_2026_baseline';

-- Fix Mike Evans collision with Ja'Marr Chase (both had player_id '7564')
UPDATE ktc_value_snapshots
SET player_id = 'sleeper_mike_evans_tb'
WHERE full_name = 'Mike Evans' AND source = 'fdp_2026_baseline';

-- Fix Amon-Ra St. Brown collision with Breece Hall (both had player_id '8150')
UPDATE ktc_value_snapshots
SET player_id = 'sleeper_amon_ra_st_brown'
WHERE full_name = 'Amon-Ra St. Brown' AND source = 'fdp_2026_baseline';

-- Fix Jahmyr Gibbs collision with Puka Nacua (both had player_id '9493')
UPDATE ktc_value_snapshots
SET player_id = 'sleeper_jahmyr_gibbs_det'
WHERE full_name = 'Jahmyr Gibbs' AND source = 'fdp_2026_baseline';

-- Fix any other potential duplicate player_ids in fdp_2026_baseline
-- Ashton Jeanty - use a safe unique id
UPDATE ktc_value_snapshots
SET player_id = 'sleeper_ashton_jeanty_lv'
WHERE full_name = 'Ashton Jeanty' AND source = 'fdp_2026_baseline';

UPDATE ktc_value_snapshots
SET player_id = 'sleeper_caleb_williams_chi'
WHERE full_name = 'Caleb Williams' AND source = 'fdp_2026_baseline';

UPDATE ktc_value_snapshots
SET player_id = 'sleeper_jayden_daniels_was'
WHERE full_name = 'Jayden Daniels' AND source = 'fdp_2026_baseline';

UPDATE ktc_value_snapshots
SET player_id = 'sleeper_drake_maye_ne'
WHERE full_name = 'Drake Maye' AND source = 'fdp_2026_baseline';

UPDATE ktc_value_snapshots
SET player_id = 'sleeper_bo_nix_den'
WHERE full_name = 'Bo Nix' AND source = 'fdp_2026_baseline';

UPDATE ktc_value_snapshots
SET player_id = 'sleeper_michael_penix_atl'
WHERE full_name = 'Michael Penix Jr.' AND source = 'fdp_2026_baseline';

UPDATE ktc_value_snapshots
SET player_id = 'sleeper_jj_mccarthy_min'
WHERE full_name = 'J.J. McCarthy' AND source = 'fdp_2026_baseline';

UPDATE ktc_value_snapshots
SET player_id = 'sleeper_omarion_hampton_lac'
WHERE full_name = 'Omarion Hampton' AND source = 'fdp_2026_baseline';

UPDATE ktc_value_snapshots
SET player_id = 'sleeper_treveon_henderson_ne'
WHERE full_name = 'TreVeyon Henderson' AND source = 'fdp_2026_baseline';

UPDATE ktc_value_snapshots
SET player_id = 'sleeper_trey_benson_ari'
WHERE full_name = 'Trey Benson' AND source = 'fdp_2026_baseline';

UPDATE ktc_value_snapshots
SET player_id = 'sleeper_blake_corum_lar'
WHERE full_name = 'Blake Corum' AND source = 'fdp_2026_baseline';

UPDATE ktc_value_snapshots
SET player_id = 'sleeper_marshawn_lloyd_hou'
WHERE full_name = 'Marshawn Lloyd' AND source = 'fdp_2026_baseline';

UPDATE ktc_value_snapshots
SET player_id = 'sleeper_quinshon_judkins_cle'
WHERE full_name = 'Quinshon Judkins' AND source = 'fdp_2026_baseline';

UPDATE ktc_value_snapshots
SET player_id = 'sleeper_tyjae_spears_ten'
WHERE full_name = 'Tyjae Spears' AND source = 'fdp_2026_baseline';

UPDATE ktc_value_snapshots
SET player_id = 'sleeper_zamir_white_lv'
WHERE full_name = 'Zamir White' AND source = 'fdp_2026_baseline';

UPDATE ktc_value_snapshots
SET player_id = 'sleeper_marvin_harrison_jr'
WHERE full_name = 'Marvin Harrison Jr.' AND source = 'fdp_2026_baseline';

UPDATE ktc_value_snapshots
SET player_id = 'sleeper_brian_thomas_jr'
WHERE full_name = 'Brian Thomas Jr.' AND source = 'fdp_2026_baseline';

UPDATE ktc_value_snapshots
SET player_id = 'sleeper_jordan_addison_min'
WHERE full_name = 'Jordan Addison' AND source = 'fdp_2026_baseline';

UPDATE ktc_value_snapshots
SET player_id = 'sleeper_rome_odunze_chi'
WHERE full_name = 'Rome Odunze' AND source = 'fdp_2026_baseline';

UPDATE ktc_value_snapshots
SET player_id = 'sleeper_xavier_worthy_kc'
WHERE full_name = 'Xavier Worthy' AND source = 'fdp_2026_baseline';

UPDATE ktc_value_snapshots
SET player_id = 'sleeper_rashee_rice_kc'
WHERE full_name = 'Rashee Rice' AND source = 'fdp_2026_baseline';

UPDATE ktc_value_snapshots
SET player_id = 'sleeper_zay_flowers_bal'
WHERE full_name = 'Zay Flowers' AND source = 'fdp_2026_baseline';

UPDATE ktc_value_snapshots
SET player_id = 'sleeper_christian_watson_gb'
WHERE full_name = 'Christian Watson' AND source = 'fdp_2026_baseline';

UPDATE ktc_value_snapshots
SET player_id = 'sleeper_tank_dell_hou'
WHERE full_name = 'Tank Dell' AND source = 'fdp_2026_baseline';

UPDATE ktc_value_snapshots
SET player_id = 'sleeper_ladd_mcconkey_lac'
WHERE full_name = 'Ladd McConkey' AND source = 'fdp_2026_baseline';

UPDATE ktc_value_snapshots
SET player_id = 'sleeper_keon_coleman_buf'
WHERE full_name = 'Keon Coleman' AND source = 'fdp_2026_baseline';

UPDATE ktc_value_snapshots
SET player_id = 'sleeper_malik_nabers_nyg'
WHERE full_name = 'Malik Nabers' AND source = 'fdp_2026_baseline';

UPDATE ktc_value_snapshots
SET player_id = 'sleeper_josh_downs_ind'
WHERE full_name = 'Josh Downs' AND source = 'fdp_2026_baseline';

UPDATE ktc_value_snapshots
SET player_id = 'sleeper_wan_dale_robinson'
WHERE full_name = 'Wan''Dale Robinson' AND source = 'fdp_2026_baseline';

UPDATE ktc_value_snapshots
SET player_id = 'sleeper_luther_burden_chi'
WHERE full_name = 'Luther Burden III' AND source = 'fdp_2026_baseline';

UPDATE ktc_value_snapshots
SET player_id = 'sleeper_tetairoa_mcmillan_car'
WHERE full_name = 'Tetairoa McMillan' AND source = 'fdp_2026_baseline';

UPDATE ktc_value_snapshots
SET player_id = 'sleeper_quentin_johnston_lac'
WHERE full_name = 'Quentin Johnston' AND source = 'fdp_2026_baseline';

UPDATE ktc_value_snapshots
SET player_id = 'sleeper_dontayvion_wicks_gb'
WHERE full_name = 'Dontayvion Wicks' AND source = 'fdp_2026_baseline';

UPDATE ktc_value_snapshots
SET player_id = 'sleeper_treylon_burks_ten'
WHERE full_name = 'Treylon Burks' AND source = 'fdp_2026_baseline';

UPDATE ktc_value_snapshots
SET player_id = 'sleeper_matthew_golden_gb'
WHERE full_name = 'Matthew Golden' AND source = 'fdp_2026_baseline';

UPDATE ktc_value_snapshots
SET player_id = 'sleeper_emeka_egbuka_tb'
WHERE full_name = 'Emeka Egbuka' AND source = 'fdp_2026_baseline';

UPDATE ktc_value_snapshots
SET player_id = 'sleeper_skyy_moore_kc'
WHERE full_name = 'Skyy Moore' AND source = 'fdp_2026_baseline';

UPDATE ktc_value_snapshots
SET player_id = 'sleeper_jahan_dotson_phi'
WHERE full_name = 'Jahan Dotson' AND source = 'fdp_2026_baseline';

UPDATE ktc_value_snapshots
SET player_id = 'sleeper_trey_mcbride_ari'
WHERE full_name = 'Trey McBride' AND source = 'fdp_2026_baseline';

UPDATE ktc_value_snapshots
SET player_id = 'sleeper_tucker_kraft_gb'
WHERE full_name = 'Tucker Kraft' AND source = 'fdp_2026_baseline';

UPDATE ktc_value_snapshots
SET player_id = 'sleeper_dalton_kincaid_buf'
WHERE full_name = 'Dalton Kincaid' AND source = 'fdp_2026_baseline';

UPDATE ktc_value_snapshots
SET player_id = 'sleeper_jake_ferguson_dal'
WHERE full_name = 'Jake Ferguson' AND source = 'fdp_2026_baseline';

UPDATE ktc_value_snapshots
SET player_id = 'sleeper_luke_musgrave_gb'
WHERE full_name = 'Luke Musgrave' AND source = 'fdp_2026_baseline';

UPDATE ktc_value_snapshots
SET player_id = 'sleeper_colston_loveland_chi'
WHERE full_name = 'Colston Loveland' AND source = 'fdp_2026_baseline';

UPDATE ktc_value_snapshots
SET player_id = 'sleeper_tyler_warren_ind'
WHERE full_name = 'Tyler Warren' AND source = 'fdp_2026_baseline';

UPDATE ktc_value_snapshots
SET player_id = 'sleeper_isaiah_likely_bal'
WHERE full_name = 'Isaiah Likely' AND source = 'fdp_2026_baseline';

UPDATE ktc_value_snapshots
SET player_id = 'sleeper_michael_mayer_lv'
WHERE full_name = 'Michael Mayer' AND source = 'fdp_2026_baseline';

UPDATE ktc_value_snapshots
SET player_id = 'sleeper_evan_engram_jac'
WHERE full_name = 'Evan Engram' AND source = 'fdp_2026_baseline';
