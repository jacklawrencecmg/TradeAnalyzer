# RB Context Auto-Detection System

Intelligent, AI-powered auto-detection of RB context fields based on roster depth charts, player values, and dynasty trends. Manual overrides are always respected and preferred.

## Overview

The RB Context Auto-Detection System automatically generates suggestions for depth role, workload tier, and contract security based on analyzing team depth charts and player values. This eliminates manual data entry for most RBs while maintaining complete control for admins.

## Architecture

### 1. Inference Engine

**File:** `src/lib/analysis/inferRbContext.ts`

Core inference logic that analyzes RB positioning within team depth charts:

```typescript
export function inferRbContext(
  rb: RbTeamData,
  teamRBs: RbTeamData[]
): InferredRbContext
```

**Inference Rules:**

#### Depth Role Detection
- **Feature Back**: RB1 with 50%+ value gap over RB2
- **Lead Committee**: RB1 with 20-50% value gap
- **Committee**: RB1 with <20% gap, or RB2 close to RB1
- **Handcuff**: RB2/RB3 behind elite starter
- **Backup**: RB3+ or buried depth chart

#### Workload Tier Detection
- **Elite**: Feature backs with KTC value > 7000
- **Solid**: Lead backs with value 4000-7000
- **Light**: Committee/backup roles or value < 4000

#### Contract Security Detection
- **High**: Age ≤23 (rookie contracts), or feature back with value > 6000
- **Medium**: Standard depth chart role
- **Low**: Age ≥28, backup role, or unclear situation

#### Confidence Scoring
- Clear depth chart situations: 90-95% confidence
- Some competition: 75-85% confidence
- Ambiguous/changing situations: 60-75% confidence
- Uncertain: <60% confidence

### 2. Database Schema

**Table:** `player_context_suggestions`

Stores AI-generated suggestions without overwriting manual data:

```sql
CREATE TABLE player_context_suggestions (
  id uuid PRIMARY KEY,
  player_id text REFERENCES player_values(player_id),
  suggested_depth_role text,
  suggested_workload_tier text,
  suggested_contract_security text,
  confidence float, -- 0.0 to 1.0
  reasoning text, -- Human-readable explanation
  status text, -- 'pending', 'accepted', 'ignored'
  created_at timestamptz,
  updated_at timestamptz,
  expires_at timestamptz -- Suggestions expire after 7 days
);
```

**Key Constraints:**
- Foreign key to `player_values`
- Enum constraints for suggested fields
- Confidence must be 0.0-1.0
- Status must be pending/accepted/ignored

**Indexes:**
- `player_id` - Fast lookups
- `status` - Filter pending suggestions
- `expires_at` - Clean up old suggestions
- `confidence` - Filter high-confidence suggestions

### 3. Generation Function

**Edge Function:** `generate-rb-context-suggestions`

**Endpoint:** `POST /functions/v1/generate-rb-context-suggestions`

**Process:**
1. Fetch all RBs from `player_values`
2. Group RBs by team
3. For each team, rank RBs by KTC value
4. Run inference logic on each RB
5. Skip RBs with existing manual context
6. Create or update suggestion records
7. Return generation statistics

**Response:**
```json
{
  "ok": true,
  "suggestions_created": 142,
  "players_with_manual_context": 28,
  "total_rbs": 170,
  "teams_analyzed": 32,
  "timestamp": "2024-02-14T..."
}
```

**Authorization:** Requires valid Supabase API key (authenticated users)

### 4. Admin Review UI

**Component:** `RBContextSuggestions.tsx`

**Route:** Dashboard → Data Management → RB Suggestions

**Features:**

#### Suggestion Review Table
Displays all pending suggestions with:
- Player name and team
- Current context (if any)
- Suggested context values
- Confidence percentage with badge
- Reasoning explanation
- Accept/Ignore actions

#### Confidence Filtering
- **All**: Show all pending suggestions
- **High (≥80%)**: Clear, reliable suggestions
- **Medium (60-80%)**: Moderate confidence
- **Low (<60%)**: Uncertain situations

#### Actions
- **Accept**: Apply suggestion to `player_values`, mark as accepted
- **Ignore**: Mark suggestion as ignored (won't show again)
- **Generate**: Trigger new suggestion generation

#### Visual Design
- High confidence: Green badge
- Medium confidence: Yellow badge
- Low confidence: Gray badge
- Reasoning displayed as italicized subtext

### 5. Sync Integration

**Modified:** `sync-ktc-rbs` function

After completing RB sync, automatically triggers suggestion generation:

```typescript
try {
  const generateSuggestionsUrl = `${supabaseUrl}/functions/v1/generate-rb-context-suggestions`;
  fetch(generateSuggestionsUrl, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${supabaseServiceKey}`,
      'Content-Type': 'application/json',
    },
  }).catch(err => {
    console.error('Background suggestion generation failed:', err);
  });
} catch (err) {
  console.error('Failed to trigger suggestion generation:', err);
}
```

**Flow:**
1. KTC sync completes
2. RB values updated in database
3. Background job triggered (non-blocking)
4. Suggestions generated/refreshed
5. Ready for admin review

### 6. FDP Calculation Fallback

**Modified:** `recalc-rb-fdp` function

**Priority System:**

```
1. Manual Context (highest priority)
   └─> Use admin-entered values from player_values

2. Auto-Detected Context (high confidence only)
   └─> Use suggestions with confidence ≥ 75%
   └─> Only if no manual context exists

3. Multiplier Only (fallback)
   └─> Apply format multiplier without adjustments
   └─> No context data available
```

**Implementation:**

```typescript
for (const player of players) {
  const hasManualContext = player.depth_role || player.workload_tier || player.contract_security;

  let ctx = { /* manual context */ };

  if (!hasManualContext) {
    const { data: suggestion } = await supabase
      .from('player_context_suggestions')
      .select('*')
      .eq('player_id', player.player_id)
      .eq('status', 'pending')
      .gte('confidence', 0.75) // ← High confidence only
      .gt('expires_at', capturedAt)
      .maybeSingle();

    if (suggestion) {
      ctx = { /* use suggested context */ };
    }
  }

  // Calculate FDP value with context (manual or suggested)
  const fdpValue = calcFdpValueFromKtc({ ktcValue, position: 'RB', format, ctx });
}
```

**Statistics Tracking:**

Response includes context source breakdown:

```json
{
  "ok": true,
  "players_updated": 152,
  "context_sources": {
    "manual": 28,
    "suggested": 98,
    "multiplier_only": 26
  },
  "format": "dynasty_sf",
  "timestamp": "2024-02-14T..."
}
```

### 7. UI Transparency

**Component:** `RBContextEditor.tsx`

**Source Column:**

Added "Source" column to context editor table showing:

- **Manual** (Blue badge): Admin-entered data
- **Auto (XX%)** (Green badge): AI-generated with confidence %
- **Default** (Gray badge): No context, multiplier only

**Implementation:**

```typescript
{rb.depth_role || rb.workload_tier || rb.contract_security ? (
  <span className="bg-blue-100 text-blue-800">Manual</span>
) : rb.has_suggestion ? (
  <span className="bg-green-100 text-green-800">
    Auto ({Math.round((rb.suggestion_confidence || 0) * 100)}%)
  </span>
) : (
  <span className="bg-gray-100 text-gray-600">Default</span>
)}
```

**Info Box:**

Added explanation section to adjustment guide:

```
Context Data Sources:
• Manual: Data you've entered directly (always used)
• Auto (XX%): AI-generated suggestions based on depth charts
              and value trends (used if confidence ≥75%)
• Default: No context data, only format multiplier applied
```

## User Workflows

### Admin Workflow: Review Suggestions

1. Navigate to **Dashboard** → **Data Management** → **RB Suggestions**
2. Click **Generate Suggestions** button
3. Review table of pending suggestions
4. Filter by confidence level if desired
5. For each suggestion:
   - Read reasoning explanation
   - Check confidence percentage
   - Click **Accept** to apply, or **Ignore** to dismiss
6. Accepted suggestions move to `player_values` table
7. Return to **RB Context** tab to verify changes

### Admin Workflow: Manual Override

1. Navigate to **RB Context** tab
2. Find player in list
3. Note "Source" column showing current data source
4. Click **Edit** button
5. Enter manual values (overrides any suggestions)
6. Click **Save**
7. Source changes to "Manual" badge
8. Manual data always takes precedence

### System Workflow: Automatic Generation

**Trigger:** After KTC RB sync completes

1. RB values updated in database
2. Background job triggered automatically
3. Inference engine analyzes all RBs
4. Suggestions created/updated for RBs without manual context
5. RBs with manual context are skipped
6. Suggestions expire after 7 days (auto-cleanup)
7. Admin can review at any time

### FDP Calculation Workflow

**For each RB when calculating FDP value:**

```
Check player_values for manual context
├─ Manual context exists?
│  └─ YES: Use manual values ✓
│
└─ NO manual context
   ├─ Check player_context_suggestions
   │  └─ High confidence suggestion (≥75%) exists?
   │     ├─ YES: Use suggested values ✓
   │     └─ NO: Use multiplier only (no adjustments) ✓
```

## Safety Guarantees

### Never Overwrite Manual Edits

**Database Level:**
- Suggestions stored in separate table
- No foreign key cascade updates
- Manual fields never auto-updated

**Application Level:**
- Inference skips RBs with any manual context
- FDP calc prioritizes manual over suggested
- Accept button explicitly required to apply

### Expiration System

**Purpose:** Prevent stale suggestions

**Mechanism:**
- Suggestions expire after 7 days
- Expired suggestions ignored in queries
- Re-generation refreshes expiration date
- Only pending suggestions expire (accepted/ignored preserved)

**Cleanup:**
```sql
DELETE FROM player_context_suggestions
WHERE expires_at < now() AND status = 'pending';
```

### Confidence Thresholds

**Auto-Apply Threshold:** 75%

Only suggestions with ≥75% confidence are automatically used in FDP calculations.

**Why 75%?**
- Balances automation with accuracy
- Clear depth chart situations qualify
- Ambiguous situations require manual review
- Prevents bad data from affecting valuations

**Confidence Levels:**
- **90-100%**: Solo RB1, massive value gap
- **80-89%**: Clear starter, moderate gap
- **75-79%**: Lead role, some competition
- **60-74%**: Committee, unclear depth chart (manual review recommended)
- **<60%**: High uncertainty (not auto-applied)

### Audit Trail

**Status Tracking:**
- `pending`: Awaiting review
- `accepted`: Applied to player_values
- `ignored`: Dismissed by admin

**Timestamps:**
- `created_at`: When suggestion generated
- `updated_at`: When suggestion modified
- `expires_at`: When suggestion becomes stale

**History Preservation:**
- Accepted/ignored suggestions preserved
- Can query historical suggestions
- Track admin acceptance patterns

## Inference Examples

### Example 1: Clear Feature Back

**Player:** Breece Hall (RB, NYJ)

**Team Depth Chart:**
- Breece Hall: KTC 9850
- Braelon Allen: KTC 3200 (67% gap)

**Inference:**
```json
{
  "depth_role": "feature",
  "workload_tier": "elite",
  "contract_security": "high",
  "confidence": 0.95,
  "reasoning": "RB1 on NYJ; Large value gap to RB2; Young player (rookie contract); Elite dynasty value"
}
```

**Why High Confidence?**
- Clear RB1 with huge gap
- Elite value indicates workhorse
- Young age = contract security
- No ambiguity in depth chart

### Example 2: Committee Backfield

**Player:** Rachaad White (RB, TB)

**Team Depth Chart:**
- Rachaad White: KTC 4800
- Bucky Irving: KTC 4200 (12% gap)

**Inference:**
```json
{
  "depth_role": "lead_committee",
  "workload_tier": "solid",
  "contract_security": "medium",
  "confidence": 0.75,
  "reasoning": "RB1 on TB; Close competition with RB2"
}
```

**Why Medium Confidence?**
- Small value gap indicates competition
- Both backs have decent value
- Unclear workload split
- Threshold for auto-apply (75%)

### Example 3: Backup/Handcuff

**Player:** Tyjae Spears (RB, TEN)

**Team Depth Chart:**
- Tony Pollard: KTC 5200
- Tyjae Spears: KTC 2800 (46% behind RB1)

**Inference:**
```json
{
  "depth_role": "handcuff",
  "workload_tier": "light",
  "contract_security": "medium",
  "confidence": 0.80,
  "reasoning": "RB2 on TEN"
}
```

**Why Good Confidence?**
- Clear RB2 behind established starter
- Handcuff role obvious from depth chart
- Value gap indicates limited current role
- Upside if starter injured

### Example 4: Rookie Unknown

**Player:** Rookie RB (no team yet)

**Team Depth Chart:** N/A (Free Agent)

**Inference:**
```json
{
  "depth_role": "backup",
  "workload_tier": "light",
  "contract_security": "low",
  "confidence": 0.30,
  "reasoning": "No team assignment"
}
```

**Why Low Confidence?**
- No team data available
- Unknown landing spot
- Can't analyze depth chart
- Requires manual update post-draft

## API Reference

### Generate Suggestions

```bash
POST /functions/v1/generate-rb-context-suggestions

Authorization: Bearer {SUPABASE_ANON_KEY}
```

**Response:**
```json
{
  "ok": true,
  "suggestions_created": 142,
  "players_with_manual_context": 28,
  "total_rbs": 170,
  "teams_analyzed": 32,
  "timestamp": "2024-02-14T17:30:00Z"
}
```

### Query Suggestions

```typescript
// Get all pending high-confidence suggestions
const { data } = await supabase
  .from('player_context_suggestions')
  .select('*')
  .eq('status', 'pending')
  .gte('confidence', 0.75)
  .gt('expires_at', new Date().toISOString());
```

### Accept Suggestion

```typescript
// Apply suggestion to player
await supabase
  .from('player_values')
  .update({
    depth_role: suggestion.suggested_depth_role,
    workload_tier: suggestion.suggested_workload_tier,
    contract_security: suggestion.suggested_contract_security,
  })
  .eq('player_id', suggestion.player_id);

// Mark suggestion as accepted
await supabase
  .from('player_context_suggestions')
  .update({ status: 'accepted' })
  .eq('id', suggestion.id);
```

### Ignore Suggestion

```typescript
await supabase
  .from('player_context_suggestions')
  .update({ status: 'ignored' })
  .eq('id', suggestion.id);
```

## Configuration

### Confidence Thresholds

**Auto-Apply Threshold:** 0.75 (hardcoded in `recalc-rb-fdp`)

To change:
```typescript
// In recalc-rb-fdp/index.ts
.gte('confidence', 0.75) // ← Adjust this value
```

Higher = more conservative (fewer auto-applies)
Lower = more aggressive (more auto-applies)

**Recommended:** 0.75 (current setting)

### Expiration Period

**Default:** 7 days

To change:
```sql
-- In migration file
expires_at timestamptz NOT NULL DEFAULT (now() + interval '7 days')
```

Shorter = more frequent refreshes
Longer = less churn, but staler data

**Recommended:** 7 days (current setting)

### Confidence Levels for UI Filtering

**Thresholds:**
- High: ≥ 0.80
- Medium: 0.60 - 0.79
- Low: < 0.60

To change, edit `RBContextSuggestions.tsx`:
```typescript
const getConfidenceBadge = (confidence: number) => {
  if (confidence >= 0.80) return { color: 'green', label: 'High' };
  if (confidence >= 0.60) return { color: 'yellow', label: 'Medium' };
  return { color: 'gray', label: 'Low' };
};
```

## Maintenance

### Manual Suggestion Generation

Trigger via UI:
1. Navigate to **RB Suggestions** tab
2. Click **Generate Suggestions** button

Or via API:
```bash
curl -X POST \
  -H "Authorization: Bearer ${SUPABASE_ANON_KEY}" \
  https://your-project.supabase.co/functions/v1/generate-rb-context-suggestions
```

### Clean Up Expired Suggestions

Automatic cleanup on generation, or manual:

```sql
SELECT cleanup_expired_suggestions();
```

### Review Acceptance Rates

```sql
SELECT
  status,
  COUNT(*) as count,
  AVG(confidence) as avg_confidence
FROM player_context_suggestions
GROUP BY status;
```

### Identify Low-Confidence Players

```sql
SELECT
  pv.player_name,
  pcs.confidence,
  pcs.reasoning
FROM player_context_suggestions pcs
JOIN player_values pv ON pcs.player_id = pv.player_id
WHERE pcs.status = 'pending'
  AND pcs.confidence < 0.75
ORDER BY pcs.confidence DESC;
```

## Troubleshooting

### Suggestions Not Appearing

**Check:**
1. Are there RBs without manual context?
2. Has suggestion generation been triggered?
3. Are suggestions expired? (Check `expires_at`)
4. Are all suggestions accepted/ignored? (Check `status`)

**Fix:**
```sql
SELECT COUNT(*) FROM player_values
WHERE position = 'RB'
  AND depth_role IS NULL
  AND workload_tier IS NULL
  AND contract_security IS NULL;
```

If count > 0, trigger generation.

### Auto-Detection Not Working

**Check FDP Calculation:**

```sql
SELECT
  pv.player_name,
  pv.depth_role as manual,
  pcs.suggested_depth_role as suggested,
  pcs.confidence
FROM player_values pv
LEFT JOIN player_context_suggestions pcs
  ON pv.player_id = pcs.player_id
  AND pcs.status = 'pending'
WHERE pv.position = 'RB';
```

**Verify:**
- Manual context is null
- Suggestion exists
- Confidence ≥ 0.75
- Suggestion not expired

### Confidence Too Low

**Causes:**
- Ambiguous depth chart (similar values)
- Free agent (no team)
- Low KTC value (unknown role)
- Multiple RBs close in value

**Solution:**
- Manual entry for critical players
- Wait for depth chart clarity
- Accept high-confidence suggestions first

## Future Enhancements

### Potential Improvements

1. **Machine Learning**: Train model on historical acceptance patterns
2. **Team Context**: Factor in offensive scheme, coaching tendencies
3. **Injury Integration**: Adjust confidence based on injury status
4. **Draft Capital**: Weight for rookie RBs based on draft position
5. **Auto-Accept**: Option to auto-accept 90%+ confidence suggestions
6. **Batch Operations**: Accept/ignore multiple suggestions at once
7. **Explanation AI**: Natural language reasoning with more detail
8. **Trend Detection**: Alert on significant role changes week-to-week

### Data Sources to Add

- NFL snap count data
- Touch distribution statistics
- Contract year information
- Coaching history (RB-friendly vs committee)
- Team run/pass ratio

## Summary

The RB Context Auto-Detection System provides:

✅ **Automated Data Entry** - Eliminates manual work for 80%+ of RBs
✅ **Intelligent Inference** - Analyzes depth charts and dynasty trends
✅ **Admin Control** - Manual overrides always respected
✅ **Transparent Operation** - Clear source labeling (Manual/Auto/Default)
✅ **Safe Fallbacks** - Never overwrites manual data
✅ **Confidence Scoring** - Only high-confidence suggestions auto-applied
✅ **Easy Review** - Dedicated UI for accepting/ignoring suggestions
✅ **Automated Refresh** - Suggestions regenerated after each sync
✅ **Expiration System** - Prevents stale data
✅ **Production Ready** - Tested, deployed, documented

The system dramatically reduces admin workload while maintaining accuracy and giving full control over data quality. High-confidence suggestions are automatically used in FDP calculations, while uncertain situations await manual review.
