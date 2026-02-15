# ADP-Based Redraft Value System

## Overview

The player value system now supports **two distinct economies**:

- **Dynasty Value**: Long-term talent value based on career longevity, age, and upside
- **Redraft Value**: Current season market demand based on real ADP (Average Draft Position) data

This separation provides accurate valuations for both dynasty and redraft trade scenarios.

---

## Value Sources

Each player's `redraft_value` is calculated using one of three sources:

### 1. ADP (Market Data) - Primary Source
- **Source**: Real market ADP from configured data feed
- **Formula**: `value = 10000 × e^(-0.018 × adp)`
- **Examples**:
  - Pick 1 → ~10,000 value (elite)
  - Pick 12 → ~8,000 value (top starter)
  - Pick 50 → ~4,000 value (flex)
  - Pick 100 → ~1,650 value (bench)
  - Pick 200 → ~280 value (waiver)

### 2. IDP Tier System - IDP Fallback
For defensive players (DL, LB, DB, DE, DT, CB, S):

**Base Values**:
- LB: 4,200
- DL: 3,900
- DB: 3,500
- DE: 3,900
- DT: 3,800
- CB: 3,600
- S: 3,400

**Adjustments**:
- Starter/Depth 1: +600
- Age ≤ 25: +250
- Age ≥ 30: -400
- High injury risk: -300
- Elevated injury risk: -150

### 3. Heuristic Model - Fallback
When ADP is unavailable for offensive players:
- Uses position-specific age curves
- Applies multipliers based on player age
- Falls back to existing base_value

---

## Database Schema

### New Table: `player_adp`
```sql
CREATE TABLE player_adp (
  player_id uuid REFERENCES nfl_players_registry(player_id),
  adp float CHECK (adp > 0),
  as_of_date date DEFAULT CURRENT_DATE,
  source text DEFAULT 'unknown',
  created_at timestamptz DEFAULT now(),
  PRIMARY KEY (player_id, as_of_date)
);
```

### Updated Table: `player_values`
```sql
ALTER TABLE player_values
ADD COLUMN dynasty_value numeric,
ADD COLUMN redraft_value numeric,
ADD COLUMN redraft_value_source text CHECK (
  redraft_value_source IN ('adp', 'heuristic', 'idp_tier')
);
```

---

## Sync Pipeline

The full sync pipeline now includes:

1. **Sync Sleeper Players** - Update player registry
2. **Sync ADP Data** - Fetch latest ADP from configured source (non-critical)
3. **Sync KTC Values** - Update dynasty values from KeepTradeCut
4. **Build Top-1000** - Calculate redraft values using ADP/fallbacks
5. **Compute Trends** - Calculate market movement
6. **Health Check** - Validate data freshness

### Configuration

Set the ADP data source via environment variable:
```bash
ADP_SOURCE_URL=https://your-adp-source.com/data.csv
```

Supported formats: CSV or JSON

---

## API Responses

All position ranking endpoints now return:

```json
{
  "position_rank": 1,
  "full_name": "Christian McCaffrey",
  "team": "SF",
  "value": 9500,
  "dynasty_value": 9200,
  "redraft_value": 9800,
  "value_source": "adp",
  "captured_at": "2026-02-15T13:00:00Z"
}
```

### Value Source Field
- `"adp"` - Calculated from real market ADP
- `"heuristic"` - Model-based estimation
- `"idp_tier"` - IDP fallback tier system

---

## Edge Functions

### New Functions
- `sync-adp` - Ingests ADP data with player resolution
- `build-top-1000` - Calculates all player values with ADP priority

### Updated Functions
- `sync-full-pipeline` - Now includes ADP sync step
- `player-value-detail` - Returns dynasty/redraft/source
- `ktc-qb-values` - Includes value source
- `ktc-wr-values` - Includes value source
- `ktc-te-values` - Includes value source

---

## Use Cases

### Dynasty Trade Example
**Trade**: Old RB for Young WR
- Use `dynasty_value` for both players
- Young WR has higher long-term value despite lower current production

### Redraft Trade Example
**Trade**: Injury-prone Vet for Consistent RB2
- Use `redraft_value` for both players
- Market ADP reflects current season demand
- Injury risk already priced into ADP

### Hybrid League Example
**Trade**: 2024 production + 2025 pick
- Use `redraft_value` for 2024 player
- Use `dynasty_value` for future assets

---

## Benefits

### Accuracy
- Real market data reflects true demand
- No more guessing at redraft values
- IDP players get proper tier-based values

### Transparency
- Users see if value is from market or model
- UI can display "Market Value" vs "Model Value"
- Trust through visibility

### Flexibility
- Works with any ADP source (FantasyPros, Underdog, ESPN)
- Graceful fallback when ADP unavailable
- Separate economies for different league types

---

## Export Format

CSV exports now include:

```csv
rank,name,pos,team,dynasty_value,redraft_value,value_source
1,Christian McCaffrey,RB,SF,9200,9800,adp
2,Breece Hall,RB,NYJ,9500,8900,adp
3,Ja'Marr Chase,WR,CIN,9800,8700,adp
```

---

## Future Enhancements

- Multiple ADP sources with weighted average
- Historical ADP tracking for trend analysis
- Position-specific ADP adjustments
- League-specific ADP (PPR vs Standard)
- Auction value calculations from ADP
