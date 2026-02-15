# FantasyPros CSV Import System

## Overview

The FantasyPros Import System downloads rankings directly from FantasyPros web pages, normalizes player data across multiple lists (dynasty offense, superflex, IDP), and generates a unified Top 1000 CSV file with consistent value scaling.

## Features

- **Direct Download** - Fetches CSVs from FantasyPros pages (no manual downloads)
- **Multi-List Support** - Dynasty Overall, Superflex, IDP, DL, LB, DB
- **Smart Normalization** - Handles player name variations, team changes, position differences
- **Unified Rankings** - Merges offense (top 750) + IDP (top 250) into one list
- **Value Curve** - Converts ranks to 0-10,000 dynasty values using exponential decay
- **CSV Export** - Generates downloadable top1000.csv
- **Database Sync** - Optional sync to player_values table

## Architecture

### Core Modules

#### `src/lib/import/fantasypros/downloadCsv.ts`
Downloads and parses CSV files from FantasyPros pages.

**Key Functions:**
- `downloadAllFantasyProsCsvs()` - Fetches all lists
- `downloadFantasyProsList(type)` - Fetches single list
- `parseCsvText(csvText)` - Parses CSV into rows

**Supported Lists:**
```typescript
- dynasty_overall (top overall players)
- dynasty_superflex (superflex rankings)
- idp (overall IDP)
- dl (defensive linemen)
- lb (linebackers)
- db (defensive backs)
```

#### `src/lib/import/fantasypros/normalizeRows.ts`
Normalizes raw CSV data into consistent schema.

**Output Schema:**
```typescript
{
  source: 'fantasypros',
  list_type: string,
  rank: number,
  full_name: string,
  team: string,
  pos: string, // QB/RB/WR/TE/DL/LB/DB
  bye_week?: number
}
```

**Key Functions:**
- `normalizeFantasyProsRows(rows, listType)` - Converts CSV to normalized format
- `deduplicatePlayers(players)` - Removes duplicates (keeps highest rank)
- `sortByRank(players)` - Sorts by rank ascending

**Normalization Features:**
- Cleans player names (removes notes, parentheses)
- Extracts teams from combined fields
- Normalizes positions (DE/DT → DL, CB/S → DB)
- Detects headers automatically
- Handles missing columns gracefully

#### `src/lib/values/rankToValue.ts`
Converts rankings to dynasty values using curves.

**Dynasty Value Formula:**
```
value = 10,000 * exp(-0.0045 * (rank - 1))
```

**Value Examples:**
| Rank | Dynasty Value |
|------|---------------|
| 1 | 10,000 |
| 10 | 9,560 |
| 50 | 8,004 |
| 100 | 6,397 |
| 200 | 4,092 |
| 500 | 906 |
| 1000 | 82 |

**IDP Value Scaling:**
- IDP base multiplier: 0.4
- LB multiplier: 0.45 (more consistent)
- DL/DB multiplier: 0.35 (more volatile)

**Key Functions:**
- `rankToValue(rank)` - Dynasty value from rank
- `rankToRedraftValue(rank)` - Steeper curve for redraft
- `rankToIdpValue(rank, pos)` - IDP-specific scaling
- `applyPositionMultiplier(value, pos, format)` - Format adjustments (SF, TE-premium)

#### `src/lib/build/buildTop1000FromFantasyPros.ts`
Orchestrates the complete import process.

**Process Flow:**
```
1. Download all CSVs from FantasyPros
2. Parse and normalize each list
3. Separate offense and IDP players
4. Deduplicate within categories
5. Take top 750 offense + top 250 IDP
6. Assign overall ranks 1-1000
7. Calculate dynasty values from ranks
8. Save to fantasypros_top1000_cache
9. Generate CSV export
```

**Key Functions:**
- `buildTop1000FromFantasyPros()` - Main import function
- `getCachedTop1000()` - Retrieve cached rankings
- `exportTop1000ToCsv(players)` - Generate CSV text
- `syncTop1000ToPlayerValues()` - Sync to database

**Build Result:**
```typescript
{
  success: boolean,
  total_players: number,
  offense_players: number,
  idp_players: number,
  lists_processed: { [listType]: count },
  duplicates_removed: number,
  errors: string[]
}
```

### Edge Function

#### `/functions/v1/export-top1000-csv` (deployed)
Public endpoint for downloading Top 1000 CSV.

**Usage:**
```bash
curl "https://your-project.supabase.co/functions/v1/export-top1000-csv" -o top1000.csv
```

**Response:**
- Content-Type: text/csv
- Filename: top1000.csv
- Columns: rank_overall, player_name, team, pos, subpos, value_dynasty, value_redraft, value_source, as_of_date, bye_week

### Database Schema

#### `fantasypros_top1000_cache`
Stores imported rankings for quick access.

```sql
- id (uuid) - Primary key
- rank_overall (integer) - Overall rank 1-1000
- player_name (text) - Player full name
- team (text) - Team abbreviation
- pos (text) - Position (QB/RB/WR/TE/DL/LB/DB)
- subpos (text) - Sub-position (for IDP)
- value_dynasty (integer) - Dynasty value 0-10000
- value_redraft (integer) - Redraft value 0-10000
- value_source (text) - 'fantasypros_rank_curve'
- as_of_date (date) - Import date
- bye_week (integer) - Optional bye week
- created_at (timestamptz) - Creation timestamp
```

## Admin UI Component

### `FantasyProsImport`
Admin interface for running imports.

**Features:**
- One-click import from FantasyPros
- Real-time status updates
- Detailed import results
- Error reporting
- CSV download button
- Database sync button

**Import Stages:**
1. **Idle** - Ready to import
2. **Downloading** - Fetching CSVs from FantasyPros
3. **Processing** - Normalizing and merging data
4. **Saving** - Writing to cache table
5. **Complete** - Success with results
6. **Error** - Failed with error messages

**Usage in Admin Dashboard:**
```tsx
import FantasyProsImport from '@/components/FantasyProsImport';

function AdminPage() {
  return (
    <div>
      <FantasyProsImport />
    </div>
  );
}
```

## Usage Examples

### Run Full Import

```typescript
import { buildTop1000FromFantasyPros } from '@/lib/build/buildTop1000FromFantasyPros';

const result = await buildTop1000FromFantasyPros();

if (result.success) {
  console.log(`Imported ${result.total_players} players`);
  console.log(`Offense: ${result.offense_players}`);
  console.log(`IDP: ${result.idp_players}`);
  console.log(`Duplicates removed: ${result.duplicates_removed}`);

  Object.entries(result.lists_processed).forEach(([list, count]) => {
    console.log(`${list}: ${count} players`);
  });
} else {
  console.error('Import failed:', result.errors);
}
```

### Download Single List

```typescript
import { downloadFantasyProsList } from '@/lib/import/fantasypros/downloadCsv';

const { rows, error } = await downloadFantasyProsList('dynasty_superflex');

if (!error) {
  console.log(`Downloaded ${rows.length} rows`);
}
```

### Generate CSV Export

```typescript
import { getCachedTop1000, exportTop1000ToCsv } from '@/lib/build/buildTop1000FromFantasyPros';

const players = await getCachedTop1000();
const csvText = exportTop1000ToCsv(players);

// Download in browser
const blob = new Blob([csvText], { type: 'text/csv' });
const url = URL.createObjectURL(blob);
const a = document.createElement('a');
a.href = url;
a.download = 'top1000.csv';
a.click();
```

### Sync to Database

```typescript
import { syncTop1000ToPlayerValues } from '@/lib/build/buildTop1000FromFantasyPros';

const result = await syncTop1000ToPlayerValues();

console.log(`Synced ${result.synced} players`);
if (result.errors.length > 0) {
  console.error(`${result.errors.length} errors:`, result.errors);
}
```

## Value Curve Details

### Why Exponential Decay?

Linear scaling doesn't reflect reality:
- Rank 1 vs Rank 2: Small difference
- Rank 50 vs Rank 51: Smaller difference
- Rank 500 vs Rank 501: Tiny difference

Exponential decay captures this:
- Top players worth significantly more
- Middle tier compressed but meaningful
- Deep bench minimal but not zero

### Curve Visualization

```
10,000 |●
        |  ●
 8,000  |    ●
        |      ●●
 6,000  |         ●●
        |            ●●●
 4,000  |                ●●●●
        |                     ●●●●●●
 2,000  |                            ●●●●●●●●●●
        |                                        ●●●●●●●●●●●●●●●●●
     0  |________________________________________________
        0    100   200   300   400   500   600   700   800   900  1000
```

### Format Adjustments

**Superflex (2QB):**
- QB multiplier: 1.4x
- Reflects increased scarcity

**1QB (Standard):**
- QB multiplier: 0.7x
- Lower relative value

**TE Premium:**
- TE multiplier: 1.2x
- Rewards premium scoring

## Deduplication Strategy

### When Duplicates Occur

Players can appear in multiple lists:
- Dynasty Overall AND Superflex
- IDP overall AND position-specific (DL/LB/DB)

### Resolution

**Keep highest rank (lowest number):**
```typescript
// Example: Player appears in multiple lists
Dynasty Overall: Rank 45
Dynasty Superflex: Rank 52

// Keep: Rank 45 from Dynasty Overall
```

**Deduplication key:**
```typescript
key = `${full_name.toLowerCase()}_${pos}_${team}`
```

**Benefits:**
- Uses most optimistic ranking
- Prevents value deflation
- Maintains consistency

## Error Handling

### Common Issues

**1. Network Failures**
- Timeout after 30 seconds
- Retry with exponential backoff
- Show specific list that failed

**2. HTML Parsing Failures**
- CSV link not found
- Alternative link patterns tried
- Fallback to manual URL if needed

**3. Data Quality Issues**
- Missing player names → skip row
- Invalid ranks → use row index
- Unknown positions → use FLEX

**4. Player Resolution**
- Name doesn't match database → log error
- Multiple matches → use first match
- No match → still import (assign temp ID)

### Error Messages

All errors include:
- List type that failed
- Specific error reason
- Number of rows affected
- Suggested fix (when applicable)

## Performance

### Import Speed

**Typical import time:** 30-60 seconds

**Breakdown:**
- CSV downloads: 15-30s (6 lists × 2-5s each)
- Parsing: 2-5s
- Normalization: 2-5s
- Deduplication: 1-2s
- Database write: 5-10s

**Optimization:**
- Parallel downloads (when possible)
- Batch database inserts (100 at a time)
- Minimal HTTP requests
- Efficient CSV parsing

### Caching Strategy

**Cache duration:** Until next import

**Cache invalidation:**
- Manual import clears old cache
- New data replaces previous
- Old exports remain available (timestamped)

## Best Practices

### When to Import

**Recommended frequency:**
- Weekly during season
- Bi-weekly in offseason
- After major news (trades, injuries)

**Avoid:**
- Multiple imports per day (rate limiting)
- During FantasyPros maintenance
- Peak traffic hours

### Validating Results

**Sanity checks:**
1. Total players near 1000 (990-1000 acceptable)
2. Top player value near 10,000
3. Rank 1000 player value > 0
4. Offense > 700, IDP > 200
5. All positions represented

**Red flags:**
- < 900 total players (lists incomplete)
- Rank 1 value ≠ 10,000 (curve broken)
- Missing entire position (parsing failed)
- > 100 duplicates (dedup broken)

### Troubleshooting

**Import fails completely:**
1. Check internet connection
2. Verify FantasyPros.com is accessible
3. Check browser console for errors
4. Try individual list downloads

**Missing players:**
1. Check which lists failed
2. Verify player exists on FantasyPros
3. Check position mapping
4. Review normalization logs

**Value seems wrong:**
1. Check rank assigned
2. Verify curve formula
3. Review position multipliers
4. Check for format adjustments

## Future Enhancements

### Planned Features

1. **Multiple Sources** - Add FantasyCalc, DynastyLeagueFootball
2. **Consensus Rankings** - Average across sources
3. **Scheduled Imports** - Automatic weekly updates
4. **Historical Tracking** - Value change over time
5. **ADP Integration** - Merge with real ADP data
6. **Custom Curves** - User-defined value formulas

### API Improvements

1. **Webhooks** - Notify on import completion
2. **Incremental Updates** - Only changed players
3. **Diff Reports** - Show what changed
4. **Version Control** - Roll back to previous import

## CSV Export Format

### Column Definitions

| Column | Type | Description | Example |
|--------|------|-------------|---------|
| rank_overall | integer | Overall rank 1-1000 | 1 |
| player_name | text | Full name | Patrick Mahomes |
| team | text | Team abbreviation | KC |
| pos | text | Position | QB |
| subpos | text | Sub-position (IDP) | null |
| value_dynasty | integer | Dynasty value 0-10000 | 10000 |
| value_redraft | integer | Redraft value 0-10000 | 9500 |
| value_source | text | Data source | fantasypros_rank_curve |
| as_of_date | date | Import date | 2026-02-15 |
| bye_week | integer | Bye week (optional) | 7 |

### Sample Export

```csv
rank_overall,player_name,team,pos,subpos,value_dynasty,value_redraft,value_source,as_of_date,bye_week
1,"Patrick Mahomes",KC,QB,,10000,10000,fantasypros_rank_curve,2026-02-15,12
2,"Ja'Marr Chase",CIN,WR,,9955,9920,fantasypros_rank_curve,2026-02-15,7
3,"Brock Purdy",SF,QB,,9911,9840,fantasypros_rank_curve,2026-02-15,9
4,"Justin Jefferson",MIN,WR,,9866,9761,fantasypros_rank_curve,2026-02-15,6
5,"Tyreek Hill",MIA,WR,,9821,9682,fantasypros_rank_curve,2026-02-15,6
```

## Integration with Existing Systems

### Compatibility

**Works with:**
- Player Values System (player_values table)
- Top 1000 Builder (buildTop1000.ts)
- Trade Analyzer (uses same dynasty values)
- Rankings Pages (unified value system)

**Replaces:**
- Manual CSV uploads
- Hardcoded rankings
- Outdated value lists

**Extends:**
- ADP system (complementary data)
- KTC integration (alternative source)
- Custom value models (fallback data)

## Conclusion

The FantasyPros Import System provides automated, reliable access to professional dynasty rankings with consistent value scaling. It handles the complexity of multiple lists, position variations, and data quality issues while providing transparency and error reporting throughout the process.
