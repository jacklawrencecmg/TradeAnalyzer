# KTC QB Value Database Integration

This document describes the KeepTradeCut (KTC) dynasty QB value database and sync pipeline integrated into FantasyDraftPros.

## Overview

The KTC integration adds a server-side scraping pipeline that fetches the latest dynasty superflex QB rankings from KeepTradeCut, stores them in Supabase, and provides both admin tools and public-facing rankings display.

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
  "count": 50,
  "total": 50,
  "timestamp": "2026-02-14T12:00:00Z"
}
```

**Error Responses:**
- 401: Unauthorized (invalid token)
- 429: Rate limited / blocked by KTC
- 500: Scraping error

#### 2. ktc-qb-values
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

## Environment Variables

Add these to your `.env` file:

```bash
# Required: Supabase connection (already configured)
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key

# Required: Admin sync secret (SERVER-SIDE ONLY)
# Generate a strong random secret for production
ADMIN_SYNC_SECRET=your-secure-admin-secret-here
```

The `ADMIN_SYNC_SECRET` is automatically configured in Supabase Edge Functions and should match the token you use in the admin UI.

## UI Components

### KTC Admin Sync
Located at: `src/components/KTCAdminSync.tsx`

Admin interface for triggering manual syncs:
- Secure token input (stored only in memory)
- One-click sync trigger
- Success/error status display
- Last sync timestamp tracking
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

## Automation Options

### Cron Job Setup

For automated daily syncs, set up a cron job or scheduled task:

**Linux/macOS (crontab):**
```bash
# Run daily at 3 AM
0 3 * * * curl -X POST \
  -H "Authorization: Bearer YOUR_ADMIN_SECRET" \
  https://your-project.supabase.co/functions/v1/sync-ktc-qbs
```

**Supabase Cron (pg_cron extension):**
```sql
SELECT cron.schedule(
  'sync-ktc-daily',
  '0 3 * * *',
  $$
  SELECT net.http_post(
    url:='https://your-project.supabase.co/functions/v1/sync-ktc-qbs',
    headers:=jsonb_build_object(
      'Authorization', 'Bearer ' || current_setting('app.admin_sync_secret')
    )
  );
  $$
);
```

**GitHub Actions:**
```yaml
name: Sync KTC Values
on:
  schedule:
    - cron: '0 3 * * *'
  workflow_dispatch:

jobs:
  sync:
    runs-on: ubuntu-latest
    steps:
      - name: Trigger Sync
        run: |
          curl -X POST \
            -H "Authorization: Bearer ${{ secrets.ADMIN_SYNC_SECRET }}" \
            ${{ secrets.SUPABASE_URL }}/functions/v1/sync-ktc-qbs
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
KTC Website
    ↓ (scrape)
Edge Function (sync-ktc-qbs)
    ↓ (validate & store)
Supabase Database (ktc_value_snapshots)
    ↓ (query)
Edge Function (ktc-qb-values)
    ↓ (cache 5min)
UI Components (KTCQBRankings)
```

## Future Enhancements

Potential improvements:
- Support for other positions (RB, WR, TE)
- Dynasty 1QB format support
- Historical trend charts
- Value change alerts
- Comparison with other sources
- Export to CSV/JSON
- Mobile app integration

## Files Reference

### Database
- `supabase/migrations/add_ktc_value_snapshots_table.sql` - Schema migration

### Edge Functions
- `supabase/functions/sync-ktc-qbs/index.ts` - Scraper function
- `supabase/functions/ktc-qb-values/index.ts` - Public API function

### UI Components
- `src/components/KTCAdminSync.tsx` - Admin sync interface
- `src/components/KTCQBRankings.tsx` - Rankings viewer
- `src/components/Dashboard.tsx` - Main navigation integration

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
