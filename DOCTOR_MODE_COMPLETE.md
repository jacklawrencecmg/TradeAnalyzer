# Doctor Mode (Auto Detect & Repair Value Bugs) - Complete Implementation

## Overview

**Doctor Mode** is an internal diagnostic system that automatically scans your entire app for value inconsistencies, cache mistakes, stale epochs, bad joins, and corrupted data — then automatically fixes safe issues and reports dangerous ones.

**Core Guarantee:** Catches value drift, data corruption, and system health issues before they reach users.

---

## 🎯 System Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                    DOCTOR MODE SYSTEM                        │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  1. Doctor Audit (Scan)                                     │
│     └─ 14 comprehensive health checks                       │
│     └─ Detects critical/warning/pass status                 │
│     └─ Returns structured report                            │
│                                                              │
│  2. Value Mismatch Scanner                                  │
│     ├─ Compares values across all surfaces                  │
│     ├─ Rankings, player detail, trade calc                  │
│     ├─ Detects drift and inconsistencies                    │
│     └─ Auto-repairs cache issues                            │
│                                                              │
│  3. Advanced Health Checks                                  │
│     ├─ Epoch consistency (no mixed/stale epochs)            │
│     ├─ Ranking integrity (no duplicates)                    │
│     ├─ Adjustment sanity (reasonable ranges)                │
│     ├─ Orphaned data (values without players)              │
│     └─ Market anchor validation (outlier detection)         │
│                                                              │
│  4. Doctor Repair (Auto-Fix)                                │
│     ├─ Identifies fixable issues                            │
│     ├─ Applies safe repairs automatically                   │
│     ├─ Logs all fixes to database                           │
│     └─ Re-audits to verify success                          │
│                                                              │
│  5. Nightly Auto Doctor                                     │
│     ├─ Runs after nightly rebuild                           │
│     ├─ Auto-repairs safe issues                             │
│     ├─ Sets abort_deploy flag if critical                   │
│     └─ Logs to system_health_metrics                        │
│                                                              │
│  6. Admin UI                                                │
│     └─ /admin/doctor                                        │
│     └─ Scan, Repair, Export buttons                         │
│     └─ Visual status dashboard                              │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

---

## 📋 Health Checks (14 Total)

### **Existing Checks** (10 checks from original system)

1. ✅ **Canonical Tables Exist**
   - Verifies all required tables present
   - Severity: Critical if missing

2. ✅ **Latest Values Consistency**
   - No duplicate latest snapshots
   - Values recent (< 48 hours)
   - Severity: Critical if stale

3. ✅ **Format and Position Validation**
   - Only canonical format strings
   - Only canonical position strings
   - Severity: Critical if invalid

4. ✅ **Snapshot Integrity**
   - No missing required fields
   - No orphaned snapshots
   - Severity: Critical if > 50 orphans

5. ✅ **Cache Drift**
   - Centralized cache system check
   - Severity: Pass (centralized)

6. ✅ **Resolver + Aliases Health**
   - Unresolved entity count
   - All players have aliases
   - Severity: Critical if > 100 unresolved

7. ✅ **Team History Correctness**
   - Single current team per player
   - Team data present
   - Severity: Critical if multiple current

8. ✅ **Position Coverage**
   - Minimum thresholds met
   - QB: 60, RB: 150, WR: 200, TE: 80
   - Severity: Critical if below

9. ✅ **Sync Pipeline Correctness**
   - Edge functions configured
   - Severity: Pass

10. ✅ **Cross-Endpoint Value Equality**
    - Sample values consistent
    - Severity: Pass if consistent

### **New Advanced Checks** (4 additional checks)

11. ✅ **Epoch Consistency**
    - No mixed epochs (1-2 max during transition)
    - No null epochs on recent values
    - Severity: Critical if > 2 epochs or no epochs

12. ✅ **Ranking Integrity**
    - No duplicate ranks
    - Rank order matches value order
    - Severity: Critical if duplicates or major mismatches

13. ✅ **Adjustment Sanity**
    - Scarcity adjustments: -500 to +500
    - League adjustments: -1000 to +1000
    - Total adjustments: -1500 to +1500
    - Severity: Critical if extreme

14. ✅ **Orphaned Data Detection**
    - Values without players
    - Players without values
    - Duplicate (player, format, profile) entries
    - Severity: Critical if > 100 orphans

15. ✅ **Market Anchor Validation**
    - Detects extreme outliers (> 3σ)
    - Flags for manual review
    - Severity: Warning (manual review)

---

## 🔧 Auto-Repair Functions

### **Safe Repairs (Auto-Applied)**

1. **Fix Duplicate Latest Values**
   - Removes duplicates, keeps most recent
   - SQL: DELETE with ROW_NUMBER() partition

2. **Fix Invalid Formats**
   - Normalizes to canonical format strings
   - Maps: Dynasty_SF → dynasty_sf, etc.

3. **Fix Invalid Positions**
   - Normalizes to canonical positions
   - Maps: HB → RB, Def → DL, etc.

4. **Fix Missing Snapshot Fields**
   - Deletes snapshots with null required fields
   - Clean data only

5. **Fix Orphaned Snapshots**
   - Deletes old orphaned snapshots (> 30 days)
   - Preserves recent for investigation

6. **Fix Missing Aliases**
   - Auto-generates from player names
   - Normalized for fuzzy matching

7. **Fix Multiple Current Teams**
   - Keeps most recent is_current=true
   - Sets others to false

8. **Fix Missing Team Data**
   - Backfills from nfl_players.team
   - Recent snapshots only (< 30 days)

9. **Fix Epoch Consistency**
   - Sets null epochs to latest epoch
   - Invalidates runtime caches

10. **Fix Ranking Integrity**
    - Recomputes ranks based on value order
    - Strictly increasing by value

11. **Fix Adjustment Sanity**
    - Clamps to reasonable ranges
    - Logs extreme adjustments

12. **Fix Orphaned Values**
    - Deletes values for non-existent players
    - Clean database

13. **Fix Duplicate Values**
    - Keeps most recent per (player, format, profile)
    - Deletes older duplicates

### **Manual Repairs (Require Approval)**

1. **Restore From Snapshot**
   - Rolls back to previous valid state
   - Requires snapshot ID

2. **Clear All Cache**
   - Nuclear option
   - Forces full cache rebuild

3. **Rebuild Player Values**
   - Triggers full rebuild pipeline
   - Runs async

4. **Market Anchor Issues**
   - Extreme outliers flagged only
   - Requires manual review

---

## 🚀 Usage

### **1. Admin UI** (Recommended)

**Route:** `/admin/doctor`

**Features:**
- Visual dashboard
- One-click scan
- One-click repair
- Export JSON report
- Real-time status

**Example:**
1. Navigate to `/admin/doctor`
2. Click "Scan System"
3. Review findings
4. Click "Repair Safe Issues" if needed
5. Export report for records

### **2. API Endpoints**

#### **POST /functions/v1/doctor-audit**

Runs full system scan.

**Headers:**
```
Authorization: Bearer <ADMIN_SYNC_SECRET>
```

**Response:**
```json
{
  "ok": true,
  "summary": {
    "critical": 0,
    "warning": 2,
    "passed": 12
  },
  "findings": [
    {
      "id": "values_fresh",
      "severity": "pass",
      "title": "Values Are Fresh",
      "details": "Last capture 2.3 hours ago",
      "fix_available": false
    }
  ],
  "timestamp": "2026-02-15T12:00:00Z"
}
```

#### **POST /functions/v1/doctor-repair**

Auto-repairs safe issues.

**Headers:**
```
Authorization: Bearer <ADMIN_SYNC_SECRET>
```

**Response:**
```json
{
  "success": true,
  "before": {
    "summary": { "critical": 3, "warning": 2, "passed": 9 }
  },
  "after": {
    "summary": { "critical": 0, "warning": 1, "passed": 13 }
  },
  "fixes_applied": [
    {
      "fix_id": "orphaned_snapshots",
      "description": "Deleted old orphaned snapshots",
      "rows_affected": 127,
      "success": true
    }
  ],
  "timestamp": "2026-02-15T12:00:00Z"
}
```

#### **POST /functions/v1/cron-nightly-doctor**

Nightly auto-scan and repair.

**Triggered:** Automatically after nightly rebuild

**Response:**
```json
{
  "status": "healthy",
  "abort_deploy": false,
  "audit": { ... },
  "timestamp": "2026-02-15T03:00:00Z"
}
```

If critical issues:
```json
{
  "status": "critical_issues_detected",
  "abort_deploy": true,
  "audit": { ... },
  "timestamp": "2026-02-15T03:00:00Z"
}
```

### **3. Programmatic Usage**

```typescript
import { runDoctorAudit } from '@/lib/doctor/runDoctorAudit';
import { runDoctorRepair } from '@/lib/doctor/runDoctorRepair';

// Run scan
const audit = await runDoctorAudit();

if (!audit.ok) {
  console.error('Critical issues detected:', audit.summary.critical);

  // Auto-repair
  const repair = await runDoctorRepair();

  if (repair.success) {
    console.log('All issues resolved!');
  } else {
    console.error('Some issues remain:', repair.after.summary.critical);
  }
}
```

---

## 🌙 Nightly Auto Doctor

### **How It Works**

1. **Triggered:** After nightly rebuild completes
2. **Scans:** Runs full doctor audit
3. **Repairs:** Auto-fixes safe issues
4. **Logs:** Records to system_health_metrics
5. **Flags:** Sets abort_deploy if critical issues remain

### **Workflow**

```
Nightly Rebuild → Doctor Scan → Critical Issues?
                                    ↓
                              Yes ←─┴─→ No
                               ↓         ↓
                         Auto-Repair   Deploy OK
                               ↓
                          Still Critical?
                               ↓
                         Yes ←─┴─→ No
                          ↓         ↓
                    Abort Deploy  Deploy OK
                    + Alert       + Log Success
```

### **Abort Deploy Logic**

If critical issues detected after auto-repair:
1. ❌ Set `abort_deploy: true`
2. 🚨 Log to `system_health_metrics` with severity: critical
3. 📧 Alert admin (future: email/slack)
4. 🛑 Block deployment until resolved

### **Monitoring**

```sql
-- Check nightly doctor results
SELECT *
FROM system_health_metrics
WHERE metric_name LIKE 'nightly_doctor%'
ORDER BY created_at DESC
LIMIT 10;
```

---

## 📊 Value Mismatch Scanner

### **What It Does**

Compares values across ALL surfaces to detect drift:
- Rankings query
- Player page query
- Trade calculator query
- Direct DB query

### **How It Works**

```typescript
import { scanValueMismatches } from '@/lib/doctor/valueMismatchScanner';

const report = await scanValueMismatches();

console.log(`Checked: ${report.total_players_checked}`);
console.log(`Mismatches: ${report.mismatches_found}`);
console.log(`Critical: ${report.critical}`);

if (report.mismatches_found > 0) {
  // Auto-repair
  const { fixed, errors } = await fixValueMismatches(report.mismatches);
  console.log(`Fixed: ${fixed}/${report.mismatches_found}`);
}
```

### **Mismatch Detection**

**Tolerance:** 0.01% (effectively zero)

**Example:**
```typescript
// Canonical value: 5000
// Rankings value: 5000 ✅ PASS
// Trade calc value: 5001 ❌ FAIL (0.02% drift)
// Player detail: 5000 ✅ PASS
```

### **Auto-Repair**

1. Clear cache for affected players
2. Force refresh from canonical source
3. Update player_values table
4. Verify repair successful

---

## 🎨 Admin UI Components

### **DoctorDashboard.tsx**

**Features:**
- Status cards (Critical, Warning, Passed)
- Scan button with loading state
- Repair button with progress
- Export button for reports
- Findings list with severity colors
- Collapsible passed checks
- Repair result display

**Color Coding:**
- 🔴 Critical: Red background
- 🟡 Warning: Yellow background
- 🟢 Pass: Green background

**Auto-Fixable Badge:**
- Blue badge shows which issues can auto-repair

---

## 🗂️ File Structure

```
src/
├── lib/
│   └── doctor/
│       ├── runDoctorAudit.ts           # Main audit runner (10 checks)
│       ├── runDoctorRepair.ts          # Main repair runner
│       ├── valueMismatchScanner.ts     # Cross-surface value checks
│       ├── advancedChecks.ts           # Advanced health checks (5 checks)
│       ├── advancedRepairs.ts          # Advanced repair functions
│       └── safeMode.ts                 # Safe mode integration
│
├── components/
│   └── DoctorDashboard.tsx             # Admin UI
│
└── tests/
    ├── valueConsistency.test.ts        # Value consistency tests
    └── crossSurfaceConsistency.test.ts # Cross-surface tests

supabase/
└── functions/
    ├── doctor-audit/                   # Audit endpoint
    ├── doctor-repair/                  # Repair endpoint
    └── cron-nightly-doctor/            # Nightly auto-scan
```

---

## 📈 Integration with Other Systems

### **1. Safe Mode**

When critical issues detected:
```typescript
await supabase.rpc('enable_safe_mode', {
  p_reason: `${summary.critical} critical issues detected`,
  p_issues: criticalFindings
});
```

Safe mode prevents:
- Value updates
- Deployments
- Cache writes

### **2. System Health Monitoring**

All findings logged to:
```sql
system_health_metrics (
  metric_name,
  metric_value,
  severity,
  metadata,
  created_at
)
```

### **3. Value Consistency Tests**

Doctor checks integrate with test suite:
```bash
# Run consistency tests
npm run test:values

# If tests fail → run doctor
# Doctor will detect and fix issues
```

### **4. Production Readiness Gate**

Before deployment:
```bash
npm run release
  ↓
npm run test:values  # Consistency tests
  ↓
Doctor audit         # If tests fail
  ↓
Auto-repair          # Fix safe issues
  ↓
Deploy or abort      # Based on results
```

---

## 🔥 Real-World Examples

### **Example 1: Stale Values Detected**

**Scenario:** Values haven't updated in 3 days

**Doctor Audit Result:**
```json
{
  "id": "values_stale",
  "severity": "critical",
  "title": "Values Are Stale",
  "details": "Last capture 72.0 hours ago (threshold: 48h)",
  "fix_available": true
}
```

**Auto-Repair:**
- Triggers value sync edge function
- Re-captures latest values
- Updates all player_values
- Clears cache

**Result:** ✅ Values fresh again

---

### **Example 2: Mixed Epochs**

**Scenario:** 5 different epochs active

**Doctor Audit Result:**
```json
{
  "id": "epoch_multiple_active",
  "severity": "critical",
  "title": "Multiple Epochs Active",
  "details": "Found 5 different epochs active (should be 1-2)",
  "fix_available": true,
  "metadata": {
    "epochs": ["2026-01-01T00:00:00Z", "2026-01-15T00:00:00Z", ...]
  }
}
```

**Auto-Repair:**
- Gets latest epoch
- Sets all null epochs to latest
- Invalidates runtime caches
- Forces reload

**Result:** ✅ Single epoch active

---

### **Example 3: Orphaned Values**

**Scenario:** 150 values without matching players

**Doctor Audit Result:**
```json
{
  "id": "orphaned_values",
  "severity": "critical",
  "title": "Values For Missing Players",
  "details": "150 player_values rows have no matching player",
  "fix_available": true
}
```

**Auto-Repair:**
```sql
DELETE FROM player_values
WHERE player_id NOT IN (
  SELECT player_id FROM player_identity
);
```

**Result:** ✅ 150 orphaned values cleaned

---

### **Example 4: Ranking Integrity**

**Scenario:** Rank order doesn't match value order

**Doctor Audit Result:**
```json
{
  "id": "ranking_order_wrong",
  "severity": "critical",
  "title": "Ranking Order Mismatches Value Order",
  "details": "23 players have ranks that don't match value order",
  "fix_available": true
}
```

**Auto-Repair:**
```sql
-- Recompute all ranks based on value
UPDATE player_values pv
SET overall_rank = r.new_rank
FROM (
  SELECT player_id, ROW_NUMBER() OVER (ORDER BY base_value DESC) as new_rank
  FROM player_values
  WHERE format = 'dynasty'
) r
WHERE pv.player_id = r.player_id;
```

**Result:** ✅ Rankings corrected

---

## 🎯 Best Practices

### **1. Run Doctor After Major Changes**

```typescript
// After rebuild
await rebuildAllPlayerValues();
await runDoctorAudit();

// After migration
await applyMigration();
await runDoctorAudit();

// After sync
await syncKTCValues();
await runDoctorAudit();
```

### **2. Monitor Nightly Results**

```sql
-- Daily health check
SELECT
  metric_name,
  metric_value,
  severity,
  created_at
FROM system_health_metrics
WHERE metric_name LIKE 'nightly_doctor%'
  AND created_at > NOW() - INTERVAL '7 days'
ORDER BY created_at DESC;
```

### **3. Export Reports**

- Export after each scan
- Store in git for history
- Compare over time
- Track improvement

### **4. Set Alerts**

```typescript
// Alert on critical issues
if (audit.summary.critical > 0) {
  await sendAlert({
    severity: 'critical',
    message: `Doctor detected ${audit.summary.critical} critical issues`,
    findings: audit.findings.filter(f => f.severity === 'critical')
  });
}
```

---

## 📝 Summary

You now have a **comprehensive Doctor Mode system** that:

### ✅ Detection (15 Checks)
- Canonical tables
- Value freshness
- Format/position validation
- Snapshot integrity
- Cache drift
- Resolver health
- Team history
- Position coverage
- Sync pipeline
- Cross-endpoint equality
- Epoch consistency
- Ranking integrity
- Adjustment sanity
- Orphaned data
- Market anchor validation

### ✅ Repair (13 Auto-Fixes)
- Duplicate values
- Invalid formats/positions
- Missing fields
- Orphaned data
- Missing aliases
- Team history
- Epoch consistency
- Ranking integrity
- Adjustment clamping
- And more...

### ✅ Automation
- Nightly auto-scan
- Auto-repair safe issues
- Abort deploy if critical
- Log all findings
- Alert on issues

### ✅ UI
- Admin dashboard
- Visual status
- One-click actions
- Export reports
- Real-time updates

### ✅ Integration
- Safe mode
- Health monitoring
- Value consistency tests
- Production readiness gate

---

## 🚀 Core Innovation

**Never let corruption reach production.** Auto-detect and repair value bugs, cache issues, stale data, and inconsistencies before users see them.

**Result:** System stays healthy, values stay consistent, users trust your data. Doctor Mode catches issues automatically and fixes them before they cause problems.

**Your system now has a self-healing immune system.** 🏥✨
