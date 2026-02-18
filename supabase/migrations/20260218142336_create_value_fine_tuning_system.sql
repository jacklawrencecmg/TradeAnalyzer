/*
  # Create Value Fine-Tuning System

  ## Overview
  Adds four tables to support granular player value fine-tuning in the admin UI:

  ## New Tables

  ### 1. `format_multiplier_overrides`
  Stores admin-editable multipliers per league format and position.
  - `format` (text) - League format key (dynasty_sf, dynasty_1qb, dynasty_tep)
  - `position` (text) - Player position (QB, RB, WR, TE, DL, LB, DB)
  - `multiplier` (numeric) - The override multiplier value (0.5 - 3.0)
  - `is_active` (boolean) - Whether this override is live
  - `notes` (text) - Admin notes on why this override exists
  - Unique constraint on (format, position)

  ### 2. `position_tier_adjustments`
  Stores percentage-based adjustments applied to an entire value tier within a position group.
  - `position` (text) - QB, RB, WR, TE, DL, LB, DB
  - `tier` (text) - elite, high, mid, low
  - `format` (text) - League format, or 'all' to apply across formats
  - `adjustment_pct` (numeric) - Percentage shift, e.g. 5.0 = +5%, -8.0 = -8%
  - `is_active` (boolean) - Toggle without deleting
  - `notes` (text)

  ### 3. `situation_modifiers`
  Stores situation/context-based flat value modifiers (e.g. weak OL penalty, target share leader bonus).
  - `label` (text) - Human-readable label (e.g. "Weak OL Penalty")
  - `position` (text) - Which position(s) this applies to, comma-separated, or 'ALL'
  - `modifier_value` (integer) - Flat point adjustment (+/-), e.g. -200
  - `condition_type` (text) - Category: team_context, usage_trend, contract, injury, scheme
  - `is_active` (boolean)
  - `notes` (text)

  ### 4. `bulk_adjustments`
  Stores rules for bulk value shifts applied to player segments (position + age range + optional format).
  - `label` (text) - Description, e.g. "Aging RB Discount 26+"
  - `position` (text) - Position to apply to, or 'ALL'
  - `min_age` (integer) - Minimum age (inclusive), null = no lower bound
  - `max_age` (integer) - Maximum age (inclusive), null = no upper bound
  - `format` (text) - Which format to apply, or 'all'
  - `adjustment_pct` (numeric) - Percentage adjustment
  - `adjustment_flat` (integer) - Flat adjustment (applied after pct)
  - `is_active` (boolean)
  - `priority` (integer) - Order of application when multiple rules match
  - `notes` (text)

  ## Security
  - RLS enabled on all tables
  - Only authenticated users can read
  - Only service_role can insert/update/delete (admin-only via edge functions)
    Actually for admin UI (authenticated admin users), we allow authenticated users full access
    since admin auth is enforced at the application layer via requireAdminSecret.
*/

-- Format Multiplier Overrides
CREATE TABLE IF NOT EXISTS format_multiplier_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  format text NOT NULL,
  position text NOT NULL,
  multiplier numeric(5,3) NOT NULL CHECK (multiplier >= 0.1 AND multiplier <= 5.0),
  is_active boolean NOT NULL DEFAULT true,
  notes text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  updated_by text DEFAULT '',
  UNIQUE (format, position)
);

ALTER TABLE format_multiplier_overrides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read format multiplier overrides"
  ON format_multiplier_overrides FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert format multiplier overrides"
  ON format_multiplier_overrides FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update format multiplier overrides"
  ON format_multiplier_overrides FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete format multiplier overrides"
  ON format_multiplier_overrides FOR DELETE
  TO authenticated
  USING (true);

-- Position Tier Adjustments
CREATE TABLE IF NOT EXISTS position_tier_adjustments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  position text NOT NULL,
  tier text NOT NULL CHECK (tier IN ('elite', 'high', 'mid', 'low')),
  format text NOT NULL DEFAULT 'all',
  adjustment_pct numeric(6,2) NOT NULL DEFAULT 0 CHECK (adjustment_pct >= -50 AND adjustment_pct <= 50),
  is_active boolean NOT NULL DEFAULT true,
  notes text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  updated_by text DEFAULT '',
  UNIQUE (position, tier, format)
);

ALTER TABLE position_tier_adjustments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read position tier adjustments"
  ON position_tier_adjustments FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert position tier adjustments"
  ON position_tier_adjustments FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update position tier adjustments"
  ON position_tier_adjustments FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete position tier adjustments"
  ON position_tier_adjustments FOR DELETE
  TO authenticated
  USING (true);

-- Situation Modifiers
CREATE TABLE IF NOT EXISTS situation_modifiers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label text NOT NULL,
  position text NOT NULL DEFAULT 'ALL',
  modifier_value integer NOT NULL DEFAULT 0,
  condition_type text NOT NULL DEFAULT 'team_context' CHECK (condition_type IN ('team_context', 'usage_trend', 'contract', 'injury', 'scheme')),
  is_active boolean NOT NULL DEFAULT true,
  notes text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  updated_by text DEFAULT ''
);

ALTER TABLE situation_modifiers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read situation modifiers"
  ON situation_modifiers FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert situation modifiers"
  ON situation_modifiers FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update situation modifiers"
  ON situation_modifiers FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete situation modifiers"
  ON situation_modifiers FOR DELETE
  TO authenticated
  USING (true);

-- Bulk Adjustments
CREATE TABLE IF NOT EXISTS bulk_adjustments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label text NOT NULL,
  position text NOT NULL DEFAULT 'ALL',
  min_age integer,
  max_age integer,
  format text NOT NULL DEFAULT 'all',
  adjustment_pct numeric(6,2) NOT NULL DEFAULT 0 CHECK (adjustment_pct >= -80 AND adjustment_pct <= 80),
  adjustment_flat integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  priority integer NOT NULL DEFAULT 10,
  notes text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  updated_by text DEFAULT ''
);

ALTER TABLE bulk_adjustments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read bulk adjustments"
  ON bulk_adjustments FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert bulk adjustments"
  ON bulk_adjustments FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update bulk adjustments"
  ON bulk_adjustments FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete bulk adjustments"
  ON bulk_adjustments FOR DELETE
  TO authenticated
  USING (true);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_format_multiplier_overrides_format_pos ON format_multiplier_overrides(format, position);
CREATE INDEX IF NOT EXISTS idx_format_multiplier_overrides_active ON format_multiplier_overrides(is_active);
CREATE INDEX IF NOT EXISTS idx_position_tier_adj_pos_tier ON position_tier_adjustments(position, tier);
CREATE INDEX IF NOT EXISTS idx_position_tier_adj_active ON position_tier_adjustments(is_active);
CREATE INDEX IF NOT EXISTS idx_situation_modifiers_active ON situation_modifiers(is_active);
CREATE INDEX IF NOT EXISTS idx_bulk_adjustments_position ON bulk_adjustments(position);
CREATE INDEX IF NOT EXISTS idx_bulk_adjustments_active ON bulk_adjustments(is_active);

-- Seed default format multiplier overrides from current hardcoded values
INSERT INTO format_multiplier_overrides (format, position, multiplier, notes) VALUES
  ('dynasty_sf',  'QB', 1.35, 'Superflex QB scarcity premium'),
  ('dynasty_sf',  'RB', 1.15, 'SF RB slight premium'),
  ('dynasty_sf',  'WR', 1.00, 'WR baseline'),
  ('dynasty_sf',  'TE', 1.10, 'SF TE premium'),
  ('dynasty_1qb', 'QB', 1.00, '1QB no scarcity premium'),
  ('dynasty_1qb', 'RB', 1.18, '1QB RB workhorse premium'),
  ('dynasty_1qb', 'WR', 1.00, 'WR baseline'),
  ('dynasty_1qb', 'TE', 1.10, '1QB TE premium'),
  ('dynasty_tep', 'QB', 1.35, 'TEP SF QB premium'),
  ('dynasty_tep', 'RB', 1.15, 'TEP RB premium'),
  ('dynasty_tep', 'WR', 1.00, 'TEP WR baseline'),
  ('dynasty_tep', 'TE', 1.25, 'TEP TE elevated premium')
ON CONFLICT (format, position) DO NOTHING;
