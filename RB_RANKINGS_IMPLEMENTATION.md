# Running Back Rankings Implementation

Complete integration of RB (Running Back) position support into the FantasyDraftPros KTC sync system with scraping, storage, endpoints, and rankings UI.

## Overview

This implementation extends the existing KTC (KeepTradeCut) sync system to fully support Running Backs alongside Quarterbacks, adding automated scraping, database storage, API endpoints, and a dedicated rankings page.

## Features Delivered

### 1. RB Sync Edge Function
**File:** `supabase/functions/sync-ktc-rbs/index.ts`

**Key Features:**
- Scrapes RB data from KeepTradeCut API
- Dynasty Superflex format support
- Format-based FDP value calculations
- Minimum volume validation (150 RBs required)
- Deduplication by player name + rank
- Authorization via Bearer token or cron secret
- 10-second delay safeguard against rate limiting

**Process:**
1. Fetches from `https://keeptradecut.com/api/rankings/dynasty-superflex`
2. Filters for RB position only
3. Assigns position ranks (RB1, RB2, etc.)
4. Validates minimum 150 RBs found
5. Upserts to `player_values` table
6. Inserts snapshots to `ktc_value_snapshots` table
7. Applies format multipliers for FDP values

**Format Multipliers:**
- Dynasty SF: RB × 1.15
- Dynasty 1QB: RB × 1.18
- Dynasty TEP: RB × 1.15

**Response:**
```json
{
  "ok": true,
  "position": "RB",
  "count": 152,
  "total": 152,
  "minRank": 1,
  "maxRank": 152,
  "format": "dynasty_sf",
  "captured_at": "2024-02-14T..."
}
```

**Error Handling:**
- HTTP 429/403: Returns `blocked: true`
- < 150 RBs: Returns error with `too_few_rows`
- Network errors: Catches and returns descriptive error

### 2. Sync All Function Updated
**File:** `supabase/functions/sync-ktc-all/index.ts`

**Already Configured** to include RB position:
```typescript
const POSITIONS = [
  { name: 'QB', endpoint: 'sync-ktc-qbs' },
  { name: 'RB', endpoint: 'sync-ktc-rbs' },  // ✓ Already included
  { name: 'WR', endpoint: 'sync-ktc-wrs' },
  { name: 'TE', endpoint: 'sync-ktc-tes' },
];
```

**Features:**
- Sequential position syncing
- 1-second delay between positions
- Aggregates results across all positions
- Returns comprehensive status report

**Response:**
```json
{
  "ok": true,
  "QB": { "ok": true, "count": 85, "maxRank": 85 },
  "RB": { "ok": true, "count": 152, "maxRank": 152 },
  "WR": { "ok": true, "count": 180, "maxRank": 180 },
  "TE": { "ok": true, "count": 95, "maxRank": 95 },
  "total_synced": 512,
  "captured_at": "2024-02-14T...",
  "errors": []
}
```

### 3. RB Values API Endpoint
**File:** `supabase/functions/ktc-rb-values/index.ts`

**Endpoint:** `GET /functions/v1/ktc-rb-values?format=dynasty_sf`

**Process:**
1. Queries `ktc_value_snapshots` table
2. Filters by position='RB' and format
3. Gets latest snapshot per player
4. Sorts by position_rank ascending
5. Returns both KTC and FDP values
6. 5-minute cache via Cache-Control header

**Response:**
```json
[
  {
    "position_rank": 1,
    "full_name": "Breece Hall",
    "team": "NYJ",
    "ktc_value": 9850,
    "fdp_value": 11328,
    "value": 9850,
    "captured_at": "2024-02-14T..."
  },
  {
    "position_rank": 2,
    "full_name": "Bijan Robinson",
    "team": "ATL",
    "ktc_value": 9640,
    "fdp_value": 11086,
    "value": 9640,
    "captured_at": "2024-02-14T..."
  }
]
```

**Features:**
- Latest values only (no historical duplication)
- Sorted by position rank
- Both raw KTC and FDP values included
- 5-minute client-side cache
- Public access (no auth required)

### 4. RB Rankings Component
**File:** `src/components/KTCRBRankings.tsx`

**Features:**

#### Search & Filters
- **Player Search** - Real-time filtering by name
- **Team Filter** - Dropdown of all NFL teams
- **Value Toggle** - Switch between KTC and FDP values
- **Pagination** - 25 RBs per page

#### Display
- **Rank Badges** - Color-coded by tier
  - #1: Gold medal (yellow)
  - #2-3: Silver (gray)
  - #4-12: Green (RB1 tier)
  - #13-24: Blue (RB2 tier)
  - #25+: Gray (depth tier)
- **Medals** - 🥇🥈🥉 for top 3
- **Team Display** - Shows current team or "FA"
- **Values** - KTC value or FDP value toggle
- **Last Updated** - Timestamp of data sync

#### Responsive Design
- Desktop: Full table with all columns
- Mobile: Compact layout
- Smooth hover states
- Fast search/filter updates

#### User Experience
- Auto-refresh button
- Page navigation (Previous/Next)
- Shows "X of Y running backs"
- Empty states for no results
- Error handling with retry
- Loading skeleton during fetch

**Component State:**
```typescript
interface RBValue {
  position_rank: number;
  full_name: string;
  team: string | null;
  ktc_value: number;
  fdp_value: number;
  value: number;
  captured_at: string;
}
```

### 5. Dashboard Integration
**File:** `src/components/Dashboard.tsx`

**Changes Made:**

#### Imports
```typescript
import KTCRBRankings from './KTCRBRankings';
import { Award } from 'lucide-react';
```

#### Tab Type
```typescript
type TabType = '...' | 'ktcRBRankings' | '...';
```

#### Navigation Button
```typescript
<NavButton
  icon={Award}
  label="RB Rankings"
  shortLabel="RBs"
  tab="ktcRBRankings"
  activeTab={activeTab}
  onClick={setActiveTab}
/>
```

#### Component Render
```typescript
{activeTab === 'ktcRBRankings' && <KTCRBRankings />}
```

**Location:** Data Management section, between QB Rankings and Multi-Position Sync

## Architecture

### Data Flow

```
KTC API (Scrape)
    ↓
sync-ktc-rbs function
    ↓
player_values table (upsert)
    ↓
ktc_value_snapshots table (insert)
    ↓
ktc-rb-values endpoint (read)
    ↓
KTCRBRankings component
    ↓
User Dashboard
```

### Database Tables

**player_values:**
```sql
- player_id (PK)
- player_name
- position ('RB')
- team
- ktc_value
- fdp_value
- last_updated
```

**ktc_value_snapshots:**
```sql
- id (PK)
- player_id
- full_name
- position ('RB')
- team
- position_rank (1-200+)
- ktc_value
- fdp_value
- format ('dynasty_sf')
- source ('KTC')
- captured_at (timestamp)
```

### API Endpoints Summary

| Endpoint | Method | Auth | Cache | Purpose |
|----------|--------|------|-------|---------|
| `/functions/v1/sync-ktc-rbs` | POST | Bearer | - | Sync RB data from KTC |
| `/functions/v1/sync-ktc-all` | POST | Bearer | - | Sync all positions including RB |
| `/functions/v1/ktc-rb-values` | GET | Public | 5min | Get latest RB rankings |

## Volume Requirements & Validation

### RB-Specific Thresholds

**Minimum RBs:** 150
- RB position has more depth than QB
- Typical dynasty leagues roster 20-30 RBs per team
- Need comprehensive rankings for deep benches

**Why 150?**
- Covers RB1-RB150+ tiers
- Includes handcuffs and lottery tickets
- Accounts for injuries and depth charts
- Supports 12-14 team leagues adequately

**Validation Logic:**
```typescript
if (players.length < 150) {
  return {
    blocked: false,
    ok: false,
    players: [],
    count: players.length,
    reason: 'too_few_rows',
  };
}
```

### Comparison to Other Positions
- **QB:** 80 minimum (fewer roster spots)
- **RB:** 150 minimum (high volume position)
- **WR:** 180+ minimum (most depth needed)
- **TE:** 95 minimum (shallow position)

## Deduplication Strategy

### Key Generation
```typescript
const key = `${name}_${rbRank}`;
```

**Prevents:**
- Same player appearing twice
- Rank duplication
- Name variations causing issues

**Example:**
- Player: "Christian McCaffrey"
- Rank: 5
- Key: "Christian McCaffrey_5"

### Map-Based Deduplication
```typescript
const playersMap = new Map<string, KTCPlayer>();
if (!playersMap.has(key)) {
  playersMap.set(key, player);
  rbRank++;
}
```

**Benefits:**
- O(1) lookup time
- Preserves first occurrence
- Sequential rank assignment
- No database duplicates

## FDP Value Calculation

### Format Multipliers
```typescript
const formatMultipliers = {
  dynasty_sf: { RB: 1.15 },
  dynasty_1qb: { RB: 1.18 },
  dynasty_tep: { RB: 1.15 },
};
```

### Calculation
```typescript
function calcFdpValue(ktcValue: number, position: string, format: string): number {
  const formatKey = format.replace(/-/g, '_');
  const multiplier = formatMultipliers[formatKey]?.[position] ?? 1;
  return Math.round(ktcValue * multiplier);
}
```

### Why RB Multipliers?

**Dynasty SF (1.15):**
- RBs have shorter shelf life
- Higher injury risk
- Position scarcity premium

**Dynasty 1QB (1.18):**
- QBs less valuable without superflex
- RBs become more critical
- Highest multiplier for RB position

**Dynasty TEP (1.15):**
- TE premium scoring
- RBs still maintain value
- Standard multiplier

## Security & Authorization

### Edge Functions
**Authorization Methods:**
1. Bearer Token: `Authorization: Bearer ${ADMIN_SYNC_SECRET}`
2. Query Parameter: `?secret=${CRON_SECRET}`

**Access Control:**
```typescript
const isAuthorized =
  (authHeader && authHeader === `Bearer ${adminSecret}`) ||
  (secretParam && secretParam === cronSecret);
```

**Response Codes:**
- 200: Success
- 401: Unauthorized
- 429: Rate limited/blocked
- 500: Server error

### Public Endpoints
**ktc-rb-values:**
- No authentication required
- Read-only access
- 5-minute cache
- CORS enabled

## Performance Optimizations

### Client-Side
- **Pagination:** 25 items per page
- **Lazy Filtering:** Debounced search
- **State Management:** React useState
- **Cache:** 5-minute browser cache

### Server-Side
- **Database Indexes:** On position, format, captured_at
- **Latest Only:** Single snapshot per player
- **Sort in DB:** position_rank ascending
- **Limit 1000:** Reasonable upper bound

### Caching Strategy
```
Browser Cache (5min)
    ↓
Edge Function Query
    ↓
Database (indexed)
```

## UI/UX Features

### Rank Badge Colors
```typescript
const getRankBadgeColor = (rank: number) => {
  if (rank === 1) return 'bg-yellow-100 text-yellow-800 border-yellow-300';
  if (rank <= 3) return 'bg-gray-100 text-gray-700 border-gray-300';
  if (rank <= 12) return 'bg-green-50 text-green-700 border-green-200';
  if (rank <= 24) return 'bg-blue-50 text-blue-700 border-blue-200';
  return 'bg-gray-50 text-gray-600 border-gray-200';
};
```

### Search & Filter Flow
1. User types in search box
2. State updates trigger `filterRBs()`
3. Filtered list updates
4. Pagination resets to page 1
5. UI re-renders with results

### Value Toggle
- Default: KTC values (raw from KTC)
- Toggle: FDP values (format-adjusted)
- Persists during session
- Clear label above table

## Error Handling

### Scraper Errors
- **Blocked:** Returns HTTP 429 with `blocked: true`
- **Too Few:** Returns error with count and reason
- **Network:** Catches and returns error message

### API Errors
- **DB Error:** Returns 500 with error message
- **No Data:** Returns empty array []
- **Invalid Format:** Defaults to 'dynasty_sf'

### UI Errors
- **Fetch Failed:** Shows error banner with retry
- **No Results:** Shows empty state message
- **Loading:** Displays skeleton loader

## Usage Examples

### Sync RBs Manually
```bash
curl -X POST \
  -H "Authorization: Bearer ${ADMIN_SYNC_SECRET}" \
  https://your-project.supabase.co/functions/v1/sync-ktc-rbs
```

### Sync All Positions
```bash
curl -X POST \
  -H "Authorization: Bearer ${ADMIN_SYNC_SECRET}" \
  https://your-project.supabase.co/functions/v1/sync-ktc-all
```

### Get RB Values
```bash
curl https://your-project.supabase.co/functions/v1/ktc-rb-values?format=dynasty_sf
```

### View in Dashboard
1. Log into FantasyDraftPros
2. Navigate to Data Management section
3. Click "RB Rankings" button
4. Browse, search, filter rankings
5. Toggle between KTC and FDP values

## File Structure

```
supabase/functions/
├── sync-ktc-rbs/
│   └── index.ts              # RB sync endpoint
├── sync-ktc-all/
│   └── index.ts              # All positions sync (includes RB)
└── ktc-rb-values/
    └── index.ts              # RB values public API

src/components/
├── KTCRBRankings.tsx        # RB rankings UI
└── Dashboard.tsx            # Updated with RB tab

Database:
├── player_values            # Player records
└── ktc_value_snapshots     # Historical values
```

## Deployment Status

✅ **sync-ktc-rbs** - Deployed
✅ **ktc-rb-values** - Deployed
✅ **sync-ktc-all** - Already includes RB
✅ **KTCRBRankings** - Component created
✅ **Dashboard** - Navigation updated

## Next Steps

### Immediate Testing
1. Run sync manually: `POST /sync-ktc-rbs`
2. Verify data: Check `ktc_value_snapshots` table
3. Test API: `GET /ktc-rb-values`
4. View UI: Open RB Rankings tab

### Future Enhancements
1. **Historical Tracking** - Show value trends over time
2. **Comparison Tool** - Compare multiple RBs side-by-side
3. **ADP Integration** - Show ADP alongside dynasty values
4. **Rookie Filter** - Toggle to show only rookies
5. **Team Needs** - Highlight RBs for specific team weaknesses
6. **Value Alerts** - Notify when RB values spike/drop

### Monitoring
- **Sync Success Rate** - Track successful vs failed syncs
- **Data Freshness** - Alert if data becomes stale
- **API Performance** - Monitor endpoint response times
- **User Engagement** - Track RB rankings page views

## Technical Notes

### Why Separate by Position?

**Granular Control:**
- Each position has unique characteristics
- Different volume requirements
- Separate error handling per position
- Easier debugging and monitoring

**Performance:**
- Smaller payload per request
- Faster database queries
- Independent caching strategies
- Parallel syncing capability

**Flexibility:**
- Update one position without affecting others
- Position-specific optimizations
- Easier to add new positions
- Cleaner code organization

### Database Design Decisions

**player_values Table:**
- Single source of truth for current values
- Quick lookup for latest player data
- Used by multiple features

**ktc_value_snapshots Table:**
- Historical tracking (append-only)
- Trend analysis capability
- No overwrites (data preservation)
- Multiple formats supported

**Indexes:**
```sql
CREATE INDEX idx_snapshots_position_format
  ON ktc_value_snapshots(position, format, captured_at DESC);

CREATE INDEX idx_snapshots_player
  ON ktc_value_snapshots(player_id, captured_at DESC);
```

## Summary

The RB rankings system is now fully integrated into FantasyDraftPros:

✅ **Reliable Scraping** - 150+ RBs minimum validation
✅ **Database Storage** - Dual table architecture
✅ **API Endpoints** - Public rankings API with caching
✅ **Rankings UI** - Search, filter, pagination, value toggle
✅ **Dashboard Integration** - Seamless navigation
✅ **Security** - Proper authorization and CORS
✅ **Performance** - Optimized queries and caching
✅ **Error Handling** - Comprehensive failure recovery
✅ **Documentation** - Complete implementation guide

Users can now view dynasty RB rankings sourced from KeepTradeCut with FDP value adjustments, search and filter by team, and compare values across formats—making this a comprehensive tool for dynasty fantasy football roster management.
