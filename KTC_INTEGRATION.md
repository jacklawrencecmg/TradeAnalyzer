# KTC Multi-Position Rankings Integration

This document describes the KeepTradeCut (KTC) dynasty rankings database and sync pipeline integrated into FantasyDraftPros.

## Overview

The KTC integration provides a complete multi-position ranking system that fetches the latest dynasty rankings (QB, RB, WR, TE) from KeepTradeCut with support for multiple formats (Superflex, 1QB, TEP):
- **Multi-position sync** - Sync QB, RB, WR, and TE rankings in one click
- **Admin sync tools** with health monitoring and format selection
- **Automated cron-safe** sync endpoints for scheduled updates
- **Unified rankings viewer** with position and format toggles
- **Trade evaluation API** for programmatic value comparison

## Architecture

### Database Schema

**ktc_value_snapshots** table:
- `id` - UUID primary key
- `player_id` - References player_values.player_id
- `full_name` - Player name from KTC
- `position` - Position (QB)
- `team` - Team abbreviation
- `position_rank` - Rank within position (QB1, QB2, etc.)
- `ktc_value` - Raw value from KTC
- `format` - Dynasty format ('dynasty_sf' for superflex)
- `source` - Data source ('KTC')
- `captured_at` - Snapshot timestamp
- `created_at` - Record creation timestamp

Indexes optimize queries by player_id, date, position, and rank.

### Edge Functions

#### 1. sync-ktc-qbs
**Endpoint:** `/functions/v1/sync-ktc-qbs`
**Method:** POST
**Authentication:** Bearer token (ADMIN_SYNC_SECRET)

Server-only function that:
- Scrapes KTC dynasty QB rankings
- Upserts players into player_values table
- Creates historical snapshots in ktc_value_snapshots table
- Returns success count and timestamp

**Response Format:**
```json
{
  "ok": true,
  "count": 150,
  "total": 150,
  "minRank": 1,
  "maxRank": 150,
  "timestamp": "2026-02-14T12:00:00Z"
}
```

**Error Responses:**
- 401: Unauthorized (invalid token)
- 429: Rate limited / blocked by KTC
- 500: Scraping error (too_few_rows if < 80 QBs captured)

#### 2. cron-sync-ktc
**Endpoint:** `/functions/v1/cron-sync-ktc?secret=YOUR_CRON_SECRET`
**Method:** GET
**Authentication:** Query parameter secret (CRON_SECRET)

Cron-safe sync function for automated scheduling:
- Same scraping logic as sync-ktc-qbs
- GET method for easy cron integration
- Query parameter authentication for simplicity

**Response Format:**
```json
{
  "ok": true,
  "count": 150,
  "minRank": 1,
  "maxRank": 150,
  "captured_at": "2026-02-14T12:00:00Z"
}
```

**Error Responses:**
- 401: Unauthorized (invalid secret)
- 429: Blocked by KTC
- 500: too_few_rows or scraping error

#### 3. ktc-qb-values
**Endpoint:** `/functions/v1/ktc-qb-values?format=dynasty_sf`
**Method:** GET
**Authentication:** None (public)
**Cache:** 5 minutes

Public endpoint that returns the latest QB values:

```json
[
  {
    "position_rank": 1,
    "full_name": "Patrick Mahomes",
    "team": "KC",
    "value": 9500,
    "captured_at": "2026-02-14T12:00:00Z"
  }
]
```

#### 4. sync-ktc-rbs / sync-ktc-wrs / sync-ktc-tes
**Endpoints:**
- `/functions/v1/sync-ktc-rbs?format=dynasty-superflex`
- `/functions/v1/sync-ktc-wrs?format=dynasty-superflex`
- `/functions/v1/sync-ktc-tes?format=dynasty-superflex`

**Method:** POST or GET (with `?secret=`)
**Authentication:** Bearer token (ADMIN_SYNC_SECRET) or query param (CRON_SECRET)

Multi-position sync endpoints for RB, WR, and TE rankings:
- Same architecture as QB sync
- Format parameter supports: dynasty-superflex, dynasty-1qb, dynasty-tep
- Minimum thresholds: RB (50+), WR (60+), TE (30+)
- Returns position-specific health metrics

**Response Format:**
```json
{
  "ok": true,
  "position": "RB",
  "count": 95,
  "total": 95,
  "minRank": 1,
  "maxRank": 95,
  "format": "dynasty_superflex",
  "captured_at": "2026-02-14T12:00:00Z"
}
```

#### 5. sync-ktc-all
**Endpoint:** `/functions/v1/sync-ktc-all?format=dynasty-superflex`
**Method:** POST or GET (with `?secret=`)
**Authentication:** Bearer token (ADMIN_SYNC_SECRET) or query param (CRON_SECRET)

Unified sync endpoint that syncs all positions sequentially:
- Calls all position sync endpoints (QB, RB, WR, TE)
- Adds 1 second delay between positions to avoid rate limits
- Returns aggregate results for all positions

**Response Format:**
```json
{
  "ok": true,
  "QB": {"ok": true, "count": 150, "maxRank": 150},
  "RB": {"ok": true, "count": 95, "maxRank": 95},
  "WR": {"ok": true, "count": 120, "maxRank": 120},
  "TE": {"ok": true, "count": 50, "maxRank": 50},
  "captured_at": "2026-02-14T12:00:00Z",
  "total_synced": 415,
  "errors": []
}
```

#### 6. ktc-rankings
**Endpoint:** `/functions/v1/ktc-rankings?position=QB&format=dynasty_sf`
**Method:** GET
**Authentication:** None (public)
**Cache:** 5 minutes

Unified rankings endpoint for all positions:
- Query params: `position` (QB/RB/WR/TE), `format` (dynasty_sf/dynasty_1qb/dynasty_tep)
- Returns latest snapshot per player with both KTC and FDP values
- Sorted by position_rank

**Response Format:**
```json
[
  {
    "position_rank": 1,
    "full_name": "Patrick Mahomes",
    "position": "QB",
    "team": "KC",
    "ktc_value": 9500,
    "fdp_value": 12825,
    "captured_at": "2026-02-14T12:00:00Z"
  }
]
```

#### 7. trade-eval
**Endpoint:** `/functions/v1/trade-eval`
**Method:** POST
**Authentication:** None (public)

Evaluates trade value using latest snapshot values (all positions):
- Looks up players by name and position
- Returns total value for each side
- Provides recommendation and difference
- Suggests similar names if player not found

**Request Format:**
```json
{
  "format": "dynasty_sf",
  "sideA": ["Drake Maye", {"name": "Bijan Robinson", "pos": "RB"}, "early 1st"],
  "sideB": ["Joe Burrow", "2026 2nd"]
}
```

Supports:
- String format: "Player Name" (searches all positions)
- Object format: {"name": "Player Name", "pos": "QB"} (position-specific)
- Draft picks: "early 1st", "mid 1st", "late 1st", "1.01-1.12", "2nd", "3rd", "4th"

**Response Format:**
```json
{
  "ok": true,
  "sideA_total": 22895,
  "sideB_total": 9734,
  "difference": 13161,
  "fairness_percentage": 43,
  "recommendation": "Side A strongly favored - needs 13161 more value on Side B",
  "sideA_details": [
    {"name": "Drake Maye", "pos": "QB", "value": 9895, "isPick": false},
    {"name": "Bijan Robinson", "pos": "RB", "value": 8500, "isPick": false},
    {"name": "early 1st", "pos": "PICK", "value": 8500, "isPick": true}
  ],
  "sideB_details": [
    {"name": "Joe Burrow", "pos": "QB", "value": 7234, "isPick": false},
    {"name": "2026 2nd", "pos": "PICK", "value": 2500, "isPick": true}
  ],
  "sideA_not_found": [],
  "sideB_not_found": []
}
```

If a player is not found, the response includes suggestions:
```json
{
  "ok": true,
  "sideA_not_found": [
    {
      "name": "J. Daniels",
      "pos": "QB",
      "suggestions": ["Jayden Daniels", "Jordan Travis", "Jake Haener"]
    }
  ]
}
```

## Environment Variables

Add these to your `.env` file:

```bash
# Required: Supabase connection (already configured)
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key

# Required: Admin sync secret (SERVER-SIDE ONLY)
# Generate a strong random secret for production
ADMIN_SYNC_SECRET=your-secure-admin-secret-here

# Required: Cron sync secret (SERVER-SIDE ONLY)
# Generate a different strong secret for production
CRON_SECRET=your-secure-cron-secret-here
```

Both secrets are automatically configured in Supabase Edge Functions. The `ADMIN_SYNC_SECRET` is used for manual syncs via the admin UI, while `CRON_SECRET` is used for automated cron jobs.

## UI Components

### KTC Admin Sync
Located at: `src/components/KTCAdminSync.tsx`

Admin interface for triggering manual syncs with health monitoring:
- Secure token input (stored only in memory)
- One-click sync trigger
- Success/error status display
- **Health Metrics:**
  - Last sync timestamp
  - Total count pulled
  - QB rank range (min-max)
  - Warning banner if maxRank < 120
- Informational help text

**Access:** Dashboard → Data Management → KTC Admin Sync

### KTC QB Rankings
Located at: `src/components/KTCQBRankings.tsx`

Public viewer for latest dynasty QB rankings:
- Search by player name
- Filter by team
- Paginated results (20 per page)
- Color-coded rank badges
- Last updated timestamps
- Responsive design

**Access:** Dashboard → Data Management → QB Rankings

## How to Use

### Initial Setup

1. Ensure environment variables are configured in `.env`
2. The database migration runs automatically
3. Edge functions are already deployed

### Running a Sync

1. Navigate to **Data Management → KTC Admin Sync**
2. Enter your admin token (ADMIN_SYNC_SECRET value)
3. Click "Sync KTC QBs"
4. Wait for confirmation (typically 5-15 seconds)
5. View updated rankings in **Data Management → QB Rankings**

### Viewing Rankings

1. Navigate to **Data Management → QB Rankings**
2. Browse the latest dynasty superflex QB rankings
3. Use search to find specific players
4. Filter by team to see team-specific rankings
5. Rankings are cached for 5 minutes for performance

## API Integration

### Calling the Sync Function

```typescript
const response = await fetch(
  `${SUPABASE_URL}/functions/v1/sync-ktc-qbs`,
  {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${ADMIN_SYNC_SECRET}`,
      'Content-Type': 'application/json',
    },
  }
);

const result = await response.json();
if (result.ok) {
  console.log(`Synced ${result.count} players`);
}
```

### Fetching Latest Values

```typescript
const response = await fetch(
  `${SUPABASE_URL}/functions/v1/ktc-qb-values?format=dynasty_sf`
);

const qbs = await response.json();
console.log(`Loaded ${qbs.length} QB values`);
```

### Evaluating Trades

```typescript
const response = await fetch(
  `${SUPABASE_URL}/functions/v1/trade-eval`,
  {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      format: 'dynasty_sf',
      sideA: [
        { name: 'Patrick Mahomes', pos: 'QB' },
        { name: 'CeeDee Lamb', pos: 'WR' }
      ],
      sideB: [
        { name: 'Josh Allen', pos: 'QB' },
        { name: 'Ja\'Marr Chase', pos: 'WR' }
      ]
    })
  }
);

const result = await response.json();
console.log(`Side A: ${result.sideA_total}`);
console.log(`Side B: ${result.sideB_total}`);
console.log(`Recommendation: ${result.recommendation}`);
```

## Automation Options

### Automated Sync Setup

For automated daily syncs, use the **cron-sync-ktc** endpoint with a scheduled task:

**Linux/macOS (crontab):**
```bash
# Run daily at 3 AM
0 3 * * * curl "https://your-project.supabase.co/functions/v1/cron-sync-ktc?secret=YOUR_CRON_SECRET"
```

**GitHub Actions:**
```yaml
name: Sync KTC QB Values Daily
on:
  schedule:
    - cron: '0 3 * * *'  # Daily at 3 AM UTC
  workflow_dispatch:

jobs:
  sync:
    runs-on: ubuntu-latest
    steps:
      - name: Trigger KTC Sync
        run: |
          response=$(curl -s "${{ secrets.SUPABASE_URL }}/functions/v1/cron-sync-ktc?secret=${{ secrets.CRON_SECRET }}")
          echo "$response"
          if echo "$response" | grep -q '"ok":true'; then
            echo "Sync successful"
          else
            echo "Sync failed"
            exit 1
          fi
```

**Vercel Cron (vercel.json):**
```json
{
  "crons": [
    {
      "path": "/api/trigger-sync",
      "schedule": "0 3 * * *"
    }
  ]
}
```

Then create `/api/trigger-sync/route.ts`:
```typescript
export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const response = await fetch(
    `${process.env.VITE_SUPABASE_URL}/functions/v1/cron-sync-ktc?secret=${process.env.CRON_SECRET}`
  );

  return Response.json(await response.json());
}
```

## Troubleshooting

### Sync Returns "Blocked"

If KTC blocks the request:
- Wait 1-2 hours before retrying
- Consider using a VPN or different IP
- Check if KTC has implemented new anti-scraping measures

### No Data Returned

If the scraper returns no data:
- KTC may have changed their HTML structure
- Check browser console for errors
- Verify the scraper URL is still correct

### Authentication Errors

If you get 401 Unauthorized:
- Verify ADMIN_SYNC_SECRET matches in .env and Edge Function
- Check that the token is entered correctly in the UI
- Ensure no extra whitespace in the token

### Database Errors

If snapshots aren't saving:
- Verify the migration ran successfully
- Check Supabase logs for RLS policy issues
- Ensure player_values table exists

## Security Considerations

1. **Admin Secret**: Keep ADMIN_SYNC_SECRET secure and never commit to version control
2. **Server-Side Only**: Scraping happens only in Edge Functions, never client-side
3. **Rate Limiting**: Be respectful of KTC's servers, don't sync too frequently
4. **Data Validation**: All scraped data is validated before storage
5. **RLS Policies**: Database has proper Row Level Security configured

## Data Flow

```
KTC API
    ↓ (API request)
Edge Function (sync-ktc-qbs or cron-sync-ktc)
    ↓ (validate, deduplicate, sanity check)
Supabase Database (player_values + ktc_value_snapshots)
    ↓ (query latest snapshots)
Edge Function (ktc-qb-values)
    ↓ (cache 5min)
UI Components (KTCQBRankings)

Trade Evaluation Flow:
    ↓ (POST request with players)
Edge Function (trade-eval)
    ↓ (lookup in latest snapshots)
Response (values + recommendation)
```

## Key Features

### Reliability Improvements
- Uses KTC API directly (more reliable than HTML scraping)
- Deduplication with Map-based key tracking
- Sanity check: Rejects sync if < 80 QBs captured
- Detailed error responses (blocked, too_few_rows, etc.)
- Health metrics tracking (minRank, maxRank)

### Automation Ready
- Dedicated cron endpoint with GET method
- Query parameter authentication for easy scheduling
- Works with GitHub Actions, Vercel Cron, or standard crontab
- Returns structured JSON for monitoring

### Trade Evaluation
- Fast fuzzy name matching with similarity scoring
- Suggests alternative names if player not found
- Supports multi-player trades (all positions)
- Returns detailed breakdown per side

### Multi-Position Support
- **QB, RB, WR, TE rankings** all supported
- **Format toggles**: Superflex, 1QB, TE Premium
- **Unified rankings UI** with position and format filters
- **Multi-position admin sync** - sync all positions in one click
- Position-specific validation thresholds

### FDP Value System
FantasyDraftPros (FDP) values apply format-specific multipliers to KTC base values to better reflect positional scarcity in different league formats:

**Multipliers by Format:**
- **Superflex**: QB 1.35x, RB 1.15x, WR 1.0x, TE 1.10x
- **1QB**: QB 1.0x, RB 1.18x, WR 1.0x, TE 1.10x
- **TE Premium**: QB 1.35x, RB 1.15x, WR 1.0x, TE 1.25x

**Why Adjust Values?**
- In Superflex, QBs are more scarce → multiply by 1.35
- In 1QB, RBs gain relative value → multiply by 1.18
- In TEP, TEs are premium → multiply by 1.25

**Storage:**
- `ktc_value` - Raw KTC value (unchanged)
- `fdp_value` - FDP adjusted value (stored in snapshots)

**Trade Calculator:**
- Uses FDP values by default for more accurate evaluations
- Accounts for league format automatically

### Draft Pick Values
Built-in value chart for draft capital in trades:

| Pick | Value | Pick | Value |
|------|-------|------|-------|
| 1.01 | 9500 | Early 1st | 8500 |
| 1.02 | 9200 | Mid 1st | 6500 |
| 1.03 | 8900 | Late 1st | 4800 |
| 1.04-1.12 | 8600-6200 | 2nd | 2500 |
| Early 2nd | 3000 | 3rd | 1200 |
| Mid 2nd | 2500 | 4th | 500 |
| Late 2nd | 2000 | | |

## Future Enhancements

Potential improvements:
- Historical trend charts and value change tracking
- Value change alerts via notifications
- Comparison with other ranking sources (FantasyPros, DLF, etc.)
- Export rankings to CSV/JSON
- Mobile app integration
- Webhook notifications for sync failures
- Redraft format support
- Rookie-specific rankings and values
- DFS (daily fantasy) player pricing

## Files Reference

### Database
- `supabase/migrations/add_ktc_value_snapshots_table.sql` - Initial snapshot schema
- `supabase/migrations/add_fdp_value_column.sql` - FDP value column addition

### Edge Functions
- `supabase/functions/sync-ktc-qbs/index.ts` - QB sync with FDP calculations
- `supabase/functions/sync-ktc-rbs/index.ts` - RB sync with FDP calculations
- `supabase/functions/sync-ktc-wrs/index.ts` - WR sync with FDP calculations
- `supabase/functions/sync-ktc-tes/index.ts` - TE sync with FDP calculations
- `supabase/functions/sync-ktc-all/index.ts` - Unified multi-position sync
- `supabase/functions/cron-sync-ktc/index.ts` - Automated cron sync (QB only)
- `supabase/functions/ktc-qb-values/index.ts` - Public QB values API (legacy)
- `supabase/functions/ktc-rankings/index.ts` - Unified rankings API with FDP values
- `supabase/functions/trade-eval/index.ts` - Trade evaluation with picks & FDP values

### UI Components
- `src/components/KTCAdminSync.tsx` - QB-only admin sync interface
- `src/components/KTCMultiPositionSync.tsx` - Multi-position admin sync
- `src/components/KTCQBRankings.tsx` - QB rankings viewer (legacy)
- `src/components/UnifiedRankings.tsx` - All positions with KTC/FDP toggle
- `src/components/Dashboard.tsx` - Main navigation integration

### Utility Libraries
- `src/lib/fdp/formatMultipliers.ts` - Format multipliers and pick values
- `src/lib/fdp/calcFdpValue.ts` - FDP value calculation utilities

### Documentation
- `KTC_INTEGRATION.md` - This file
- `.env` - Environment variables (not committed)

## Support

For issues or questions:
1. Check the troubleshooting section above
2. Review Supabase Edge Function logs
3. Check browser console for client-side errors
4. Contact support via the Contact page

---

Built with ❤️ for FantasyDraftPros
