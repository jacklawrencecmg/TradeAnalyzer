# Doctor System - Automated Audit & Repair

The **Doctor System** is a comprehensive audit and auto-repair tool that ensures zero data inconsistencies across your entire Fantasy Draft Pros platform. It automatically detects and fixes issues that could cause player/value drift.

---

## 🎯 Overview

The Doctor System performs 10 critical checks to validate data integrity and automatically repairs safe issues. It's designed to catch problems before they affect users.

### Key Features

✅ **One-Click Audit** - Run comprehensive checks across all tables
✅ **Auto-Repair** - Safely fix detected issues automatically
✅ **Safe Mode** - Automatically disables writes when critical issues detected
✅ **Audit Trail** - All repairs logged to `doctor_fixes` table
✅ **Real-Time Monitoring** - Safe mode state syncs in real-time
✅ **Admin UI** - Beautiful dashboard to view results and trigger actions

---

## 📊 Architecture

```
┌─────────────────────────────────────────────────────────┐
│                     Admin Triggers                       │
│  /admin/doctor  →  Run Audit  |  Auto-Repair Issues    │
└──────────────────────┬──────────────────────────────────┘
                       │
            ┌──────────┴──────────┐
            │                     │
            ▼                     ▼
    ┌───────────────┐    ┌────────────────┐
    │ doctor-audit  │    │ doctor-repair  │
    │ Edge Function │    │ Edge Function  │
    └───────┬───────┘    └────────┬───────┘
            │                     │
            │  Runs 10 Checks     │  Applies Safe Fixes
            │                     │
            ▼                     ▼
    ┌──────────────────────────────────────┐
    │      Database Integrity Layer         │
    │  • nfl_players (canonical source)     │
    │  • ktc_value_snapshots (values)       │
    │  • player_aliases (resolver)          │
    │  • system_safe_mode (protection)      │
    │  • doctor_fixes (audit trail)         │
    └──────────────────────────────────────┘
            │
            ▼
    If Critical → Enable Safe Mode
    All Fixed   → Disable Safe Mode
```

---

## 🔍 The 10 Audit Checks

### 1. Canonical Source Enforcement

**What it checks:**
- Required tables exist: `nfl_players`, `player_aliases`, `player_team_history`, `ktc_value_snapshots`, `unresolved_entities`
- Downstream tables use `player_id` (not names)
- No name-based joins

**Why it matters:**
- Name-based joins cause mismatches when players change names
- Missing canonical tables break the entire system

**Auto-fix:**
- Add missing FK columns
- Migrate name-based references to `player_id`

---

### 2. Latest Values Consistency

**What it checks:**
- No duplicate "latest" snapshots per (player_id, format)
- Values are fresh (captured within 48 hours)
- All components use same values source

**Why it matters:**
- Duplicate values cause rankings to show different data than trade calculator
- Stale values mean users see outdated player worth

**Auto-fix:**
- Remove exact duplicates (keep newest)
- Trigger sync if values > 48 hours old

---

### 3. Format & Position Validation

**What it checks:**
- All format strings match canonical enum: `dynasty_sf`, `dynasty_1qb`, `dynasty_tep`, etc.
- All positions match canonical enum: `QB`, `RB`, `WR`, `TE`, `DL`, `LB`, `DB`, `K`
- No variants like "Dynasty_SF", "HB", "DEF"

**Why it matters:**
- Format/position mismatches break queries and lookups
- Case sensitivity causes "not found" errors

**Auto-fix:**
- Normalize to canonical values using mapping dictionary

---

### 4. Snapshot Integrity

**What it checks:**
- No snapshots with null `player_id`, `format`, or `captured_at`
- No orphaned snapshots (player doesn't exist in `nfl_players`)
- No snapshots with missing required data

**Why it matters:**
- Null fields cause database errors
- Orphaned snapshots waste storage and pollute queries

**Auto-fix:**
- Delete snapshots with missing required fields
- Delete orphaned snapshots older than 30 days
- Attempt to resolve recent orphans

---

### 5. Cache Drift

**What it checks:**
- Consistent cache TTL across all endpoints (5-10 min)
- Cache invalidation happens after sync
- No endpoints caching stale data

**Why it matters:**
- Different TTLs cause widgets to show different values
- Stale caches persist after sync completes

**Auto-fix:**
- Code-level check (passes if using centralized cache module)

---

### 6. Resolver + Aliases Health

**What it checks:**
- Unresolved entities count < 100 (warning if > 50)
- All active players have at least one alias
- Top repeated unresolved names identified

**Why it matters:**
- High unresolved count = many "player not found" errors
- Missing aliases break name lookups

**Auto-fix:**
- Auto-generate aliases from `full_name` for players missing them
- Suggest manual resolution for top repeated unresolved names

---

### 7. Team History Correctness

**What it checks:**
- Each player has exactly one `is_current=true` row (or none if FA)
- Snapshots have `team` populated (not null)
- Team changes don't rewrite history

**Why it matters:**
- Multiple current teams cause UI confusion
- Missing team data breaks filters and searches

**Auto-fix:**
- Keep only most recent `is_current=true` entry
- Backfill missing team from `nfl_players.team`

---

### 8. Coverage By Position

**What it checks:**
- Minimum player counts per position:
  - QB >= 60
  - RB >= 150
  - WR >= 200
  - TE >= 80
  - DL/LB/DB >= 80 (if IDP enabled)

**Why it matters:**
- Low coverage = rankings look incomplete
- Users can't find their players

**Auto-fix:**
- Trigger full sync if below thresholds
- Log "scraper blocked" if still low after sync

---

### 9. Sync Pipeline Correctness

**What it checks:**
- Cron endpoints exist and are configured
- Pipeline runs in correct order:
  1. Player sync
  2. Values sync
  3. Trends/reports

**Why it matters:**
- Out-of-order sync causes data corruption
- Missing cron jobs mean stale data forever

**Auto-fix:**
- Verify edge functions deployed
- Log if cron not configured (manual step required)

---

### 10. Cross-Endpoint Value Equality

**What it checks:**
- Sample 20 random players per position
- Compare values from:
  - Rankings endpoint
  - Player detail endpoint
  - Trade eval lookup
- Values must match exactly

**Why it matters:**
- Value drift = rankings show 5000 but trade calc shows 4800
- Inconsistency erodes user trust

**Auto-fix:**
- Identify which endpoint uses wrong query
- Log for manual refactor to use canonical helper

---

## 🔧 Auto-Repair Actions

All repairs are:
- **Idempotent** - Safe to run multiple times
- **Logged** - Every fix written to `doctor_fixes` table
- **Reversible** - Where possible (deletes are permanent)

### Repair Examples

```sql
-- Fix 1: Remove duplicate snapshots
DELETE FROM ktc_value_snapshots
WHERE id IN (
  SELECT id FROM (
    SELECT id,
      ROW_NUMBER() OVER (
        PARTITION BY player_id, format, captured_at
        ORDER BY created_at DESC
      ) as rn
    FROM ktc_value_snapshots
  ) ranked
  WHERE rn > 1
);

-- Fix 2: Generate missing aliases
INSERT INTO player_aliases (player_id, alias, alias_normalized, source)
SELECT np.id, np.full_name,
       LOWER(REGEXP_REPLACE(np.full_name, '[^a-z0-9]', '', 'g')),
       'auto_generated'
FROM nfl_players np
LEFT JOIN player_aliases pa ON pa.player_id = np.id
WHERE pa.id IS NULL
  AND np.status IN ('Active', 'Rookie');

-- Fix 3: Correct multiple current teams
WITH ranked AS (
  SELECT id,
    ROW_NUMBER() OVER (
      PARTITION BY player_id
      ORDER BY from_date DESC, created_at DESC
    ) as rn
  FROM player_team_history
  WHERE is_current = true
)
UPDATE player_team_history
SET is_current = false
WHERE id IN (SELECT id FROM ranked WHERE rn > 1);
```

---

## 🛡️ Safe Mode

When critical issues are detected, Safe Mode automatically activates to prevent data corruption.

### What Safe Mode Does

**Enabled When:**
- Any check has severity = `critical`
- Examples:
  - Missing canonical tables
  - Values stale > 48 hours
  - Orphaned snapshots > 50
  - Position coverage below thresholds

**Effects:**
- ✅ **Read-only operations work** - Users can view rankings, player pages, etc.
- ❌ **Write operations disabled** - Cannot share trades, generate reports, create suggestions
- 🔔 **Banner displayed** - Admin sees prominent alert with reason
- 📋 **Critical issues listed** - All problems shown in UI

**Disabled When:**
- All critical issues resolved
- Audit passes with 0 critical findings

### Safe Mode State

Stored in `system_safe_mode` table (single row):

```sql
{
  "id": "00000000-0000-0000-0000-000000000001",
  "enabled": true,
  "reason": "5 critical issues detected by Doctor audit",
  "critical_issues": [
    {
      "id": "values_stale",
      "title": "Values Are Stale",
      "details": "Last capture 52.3 hours ago (threshold: 48h)"
    },
    ...
  ],
  "enabled_at": "2024-02-14T10:30:00Z",
  "updated_at": "2024-02-14T10:30:00Z"
}
```

---

## 🖥️ Admin UI

Access the Doctor admin page at `/admin/doctor`.

### Features

**Authorization:**
- Requires `ADMIN_SYNC_SECRET` to access
- Secret verified on every request
- No session persistence (enter each time)

**Audit Results Display:**
- Summary cards: Passed / Warnings / Critical
- Color-coded findings: 🟢 Pass | 🟡 Warning | 🔴 Critical
- "Auto-Fixable" badge for repairable issues
- Detailed metadata for each finding

**Repair Results Display:**
- List of fixes applied
- Rows affected per fix
- Success/failure status
- Error messages if fix failed

**Safe Mode Banner:**
- Shows when critical issues exist
- Displays reason and time activated
- Dismissible (reappears on page reload if still active)

---

## 📡 API Endpoints

### POST /functions/v1/doctor-audit

Run full audit (10 checks).

**Authorization:**
```
Authorization: Bearer {ADMIN_SYNC_SECRET}
```

**Response:**
```json
{
  "ok": true,
  "summary": {
    "critical": 0,
    "warning": 2,
    "passed": 8
  },
  "findings": [
    {
      "id": "canonical_tables_exist",
      "severity": "pass",
      "title": "All Canonical Tables Exist",
      "details": "All required tables are present",
      "fix_available": false
    },
    {
      "id": "moderate_unresolved",
      "severity": "warning",
      "title": "Moderate Unresolved Count",
      "details": "67 entities unresolved",
      "fix_available": true
    }
  ],
  "timestamp": "2024-02-14T10:30:00Z"
}
```

---

### POST /functions/v1/doctor-repair

Apply auto-repairs for fixable issues.

**Authorization:**
```
Authorization: Bearer {ADMIN_SYNC_SECRET}
```

**Response:**
```json
{
  "success": true,
  "fixes_applied": [
    {
      "fix_id": "remove_duplicates",
      "description": "Removed duplicate value snapshots",
      "rows_affected": 12,
      "success": true
    },
    {
      "fix_id": "generate_missing_aliases",
      "description": "Generated missing player aliases",
      "rows_affected": 43,
      "success": true
    }
  ],
  "total_fixes": 6,
  "timestamp": "2024-02-14T10:35:00Z"
}
```

---

## 🚀 Usage

### Running Locally (Dev)

```bash
# 1. Get your ADMIN_SYNC_SECRET
echo $ADMIN_SYNC_SECRET

# 2. Run audit
curl -X POST "${SUPABASE_URL}/functions/v1/doctor-audit" \
  -H "Authorization: Bearer ${ADMIN_SYNC_SECRET}"

# 3. Run repair (if issues found)
curl -X POST "${SUPABASE_URL}/functions/v1/doctor-repair" \
  -H "Authorization: Bearer ${ADMIN_SYNC_SECRET}"
```

### Using Admin UI

1. Navigate to `/admin/doctor`
2. Enter `ADMIN_SYNC_SECRET`
3. Click "Run Full Audit"
4. Review findings
5. Click "Auto-Repair Issues" if needed
6. Verify issues resolved

### Scheduling Regular Audits

Add to Supabase cron:

```yaml
# Run Doctor audit daily at 6 AM
- name: doctor-daily-audit
  schedule: "0 6 * * *"
  function: doctor-audit
  secret: CRON_SECRET
```

---

## 📋 Database Schema

### doctor_fixes

```sql
CREATE TABLE doctor_fixes (
  id uuid PRIMARY KEY,
  fix_id text NOT NULL,
  description text NOT NULL,
  severity text CHECK (severity IN ('critical', 'warning', 'info')),
  rows_affected int DEFAULT 0,
  metadata jsonb DEFAULT '{}'::jsonb,
  applied_at timestamptz DEFAULT NOW(),
  applied_by text
);
```

**Purpose:** Audit trail of all repairs applied.

---

### system_safe_mode

```sql
CREATE TABLE system_safe_mode (
  id uuid PRIMARY KEY,
  enabled bool NOT NULL DEFAULT false,
  reason text,
  critical_issues jsonb DEFAULT '[]'::jsonb,
  enabled_at timestamptz,
  updated_at timestamptz DEFAULT NOW()
);
```

**Purpose:** Single-row table storing current safe mode state.

**ID:** Always `00000000-0000-0000-0000-000000000001`

---

## 🧪 Testing

### Manual Test Scenarios

**Test 1: Duplicate Values**
```sql
-- Create duplicate
INSERT INTO ktc_value_snapshots (player_id, format, position, ktc_value, captured_at)
SELECT player_id, format, position, ktc_value, captured_at
FROM ktc_value_snapshots
LIMIT 10;

-- Run audit (should detect duplicates)
-- Run repair (should remove them)
```

**Test 2: Stale Values**
```sql
-- Make values stale
UPDATE ktc_value_snapshots
SET captured_at = NOW() - INTERVAL '72 hours';

-- Run audit (should trigger critical and enable safe mode)
```

**Test 3: Orphaned Snapshots**
```sql
-- Create orphan
INSERT INTO ktc_value_snapshots (player_id, format, position, ktc_value, captured_at)
VALUES ('FAKE_PLAYER_ID', 'dynasty_sf', 'QB', 5000, NOW());

-- Run audit (should detect orphan)
-- Run repair (should delete if old)
```

---

## 📊 Monitoring

### Key Metrics

Monitor these to ensure system health:

1. **Doctor Fixes Applied** - `SELECT COUNT(*) FROM doctor_fixes WHERE applied_at >= NOW() - INTERVAL '7 days'`
2. **Safe Mode Activations** - Track how often safe mode enables
3. **Critical Issues Count** - Should always be 0
4. **Repair Success Rate** - % of fixes that succeed
5. **Unresolved Entities** - Should stay < 50

### Alerts

Set up alerts for:
- ⚠️ Safe mode enabled
- ⚠️ Audit finds 5+ critical issues
- ⚠️ Repair fails
- ⚠️ Unresolved entities > 100

---

## 🔒 Security

**Authorization:**
- All endpoints require `ADMIN_SYNC_SECRET`
- Secret validated on every request
- No rate limiting (admin only)

**RLS Policies:**
- `doctor_fixes`: Service role can read/insert
- `system_safe_mode`: Anyone can read (for safe mode checks), service role can update

**Edge Function Security:**
- `verify_jwt: false` (uses Bearer token instead)
- CORS enabled for admin UI
- Service role used for database access

---

## 🎯 Success Criteria

Your system is healthy when:

✅ Audit runs with 0 critical, <5 warnings
✅ All repairs succeed
✅ Safe mode stays disabled
✅ Unresolved entities < 50
✅ Position coverage meets thresholds
✅ Values fresh (<24 hours)
✅ No orphaned snapshots
✅ All players have aliases
✅ Team history correct

---

## 📖 Related Documentation

- `CANONICAL_DATA_ARCHITECTURE.md` - Complete architecture guide
- `UNIFIED_DATA_SYSTEM.md` - System overview
- `IMPLEMENTATION_COMPLETE.md` - Success summary
- `SETUP_QUICK_START.md` - 10-minute setup

---

**Your Doctor System is live and ready to ensure zero data inconsistencies!** 🏥✅
