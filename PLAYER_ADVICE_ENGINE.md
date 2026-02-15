## Player Advice Engine

## Overview

The **Player Advice Engine** transforms Dynasty Dominator from a ranking tool into an actionable recommendation system. Instead of just showing values, it identifies **specific opportunities**: buy low candidates, sell high targets, breakout players, waiver wire gems, stash candidates, and trap players to avoid.

**Key Innovation:** Compares model value (our calculation) vs market value (KTC/consensus) vs recent trends vs usage data to generate confidence-scored, actionable recommendations with clear reasoning.

## Philosophy

### Before (Rankings Only)
```
User sees:
- Player A: 5,200 value
- Player B: 4,800 value
- Player C: 4,600 value

User asks: "What should I do?"
```

### After (Actionable Advice)
```
User sees:
- Player A: BUY LOW (85% confidence)
  "Market hasn't adjusted to increased target share"

- Player B: SELL HIGH (78% confidence)
  "TD rate unsustainably high"

- Player C: BREAKOUT (82% confidence)
  "Classic year 2-3 WR breakout pattern"

User knows exactly what to do!
```

## Core Principle

**Every recommendation must have:**
1. **Confidence score** (50-95%) based on data quality
2. **Clear reasoning** explaining WHY
3. **Supporting factors** with specific metrics
4. **Actionability** - specific action to take

**Never recommend without rationale.**

## Architecture

### Data Flow

```
Daily Job (Morning)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. Get Top 500 Players
    ↓
2. For Each Player:
    ↓
   Evaluate Market Position
    - Model value (FDP)
    - Market value (KTC)
    - Value delta
    - Recent changes (7d, 24h)
    - Usage trends
    - Availability status
    ↓
   Detect Applicable Advice
    - Buy Low?
    - Sell High?
    - Breakout?
    - Waiver Target?
    - Stash Candidate?
    - Avoid/Trap?
    ↓
   Calculate Confidence
    - Data quality
    - Signal strength
    - Context factors
    ↓
   Generate Reasoning
    - Primary reason
    - Supporting factors
    ↓
3. Store in Database
    player_advice table
    ↓
4. Clean Up Expired
    (breakouts expire in 72h)
```

### Database Schema

**player_advice**
```sql
CREATE TABLE player_advice (
  id uuid PRIMARY KEY,
  player_id uuid REFERENCES nfl_players,
  league_profile_id uuid REFERENCES league_profiles,
  format text,  -- 'dynasty' or 'redraft'
  advice_type text CHECK (advice_type IN (
    'buy_low',
    'sell_high',
    'breakout',
    'waiver',
    'stash',
    'avoid'
  )),

  -- Recommendation
  confidence integer CHECK (confidence >= 1 AND confidence <= 100),
  score integer,  -- For sorting within type
  reason text,
  supporting_factors jsonb,

  -- Market context
  model_value integer,
  market_value integer,
  value_delta integer,
  recent_change_7d integer,
  recent_change_24h integer,
  usage_trend numeric,

  -- Expiration
  expires_at timestamptz,  -- NULL = doesn't expire
  created_at timestamptz DEFAULT now(),

  UNIQUE (player_id, league_profile_id, format, advice_type)
);
```

**Purpose:** Store all active player advice

**Key Features:**
- Unique constraint prevents duplicates
- Expires_at for time-sensitive advice (breakouts)
- Supporting_factors stores detailed reasoning
- Market context for transparency

## Advice Types

### 1. Buy Low

**Criteria:**
- `value_delta > +600` (model higher than market)
- `recent_change_7d <= 0` (price stable/declining)
- `availability != out_longterm` (not injured long-term)

**Confidence Formula:**
```typescript
confidence = 50 (base)
  + min(30, value_delta / 40)  // Value gap
  + (usage_trend * 15)          // If usage rising
  + 10 (if recent_change_7d < -200)  // Recent decline
  * (data_quality / 100)        // Quality multiplier
```

**Reason Templates:**
- "Usage rising but market price stagnant"
- "Market overreacted to recent decline"
- "Post-injury discount opportunity"
- "Market slow to react to underlying value"

**Example:**
```
Garrett Wilson — BUY LOW (85%)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Market hasn't adjusted to increased target share

Supporting Factors:
• Model value 820 points higher than market
• Usage trend improving
• Market value declined 150 in last 7 days
• Market rank #45 vs model rank #28
```

### 2. Sell High

**Criteria:**
- `value_delta < -600` (market higher than model)
- `recent_change_7d > 0` (price rising)

**Confidence Formula:**
```typescript
confidence = 50 (base)
  + min(30, abs(value_delta) / 40)  // Overvaluation
  + 15 (if recent_change_7d > 300)  // Recent spike
  + 10 (if usage_trend < -0.2)      // Usage declining
  * (data_quality / 100)
```

**Reason Templates:**
- "Recent spike likely unsustainable"
- "Usage declining but market hasn't adjusted"
- "Sell before age-related decline" (RB 29+)
- "Market hype exceeds real value"

**Example:**
```
Raheem Mostert — SELL HIGH (78%)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TD rate unsustainably high

Supporting Factors:
• Market value 950 points higher than model
• Market value increased 420 in last 7 days
• Usage trend declining
• Overranked: Market #18 vs Model #36
```

### 3. Breakout

**Criteria:**
- `usage_trend >= 0.25` (strong upward)
- `recent_change_24h > 150` (momentum)
- `model_rank improving`

**Expires:** 72 hours (time-sensitive)

**Confidence Formula:**
```typescript
confidence = 50 (base)
  + (usage_trend * 30)              // Usage surge
  + 15 (if recent_change_24h > 300) // Big momentum
  + 10 (if age <= 24)               // Youth upside
  * (data_quality / 100)
```

**Reason Templates:**
- "Classic year 2-3 WR breakout pattern"
- "Elite usage surge + production spike"
- "Opportunity expanding, production following"

**Example:**
```
Jordan Addison — BREAKOUT (82%) ⏰ Expires in 68h
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Classic year 2-3 WR breakout pattern

Supporting Factors:
• Strong usage trend (+35%)
• Value increased 340 in last 24h
• Young player (age 22) with upside
• Model projecting continued rise
```

### 4. Waiver Target

**Criteria:**
- `rostered_percent < 60` (widely available)
- `model_value > replacement_level + 400`

**Confidence Formula:**
```typescript
confidence = 50 (base)
  + min(25, (value_above_replacement) / 40)
  + 15 (if rostered_percent < 30)     // Hidden gem
  + 10 (if usage_trend > 0.2)         // Usage rising
  * (data_quality / 100)
```

**Reason Templates:**
- "Rising usage, likely available on waivers"
- "Opportunity opening due to injury ahead"
- "Emerging value before wider recognition"
- "Underrostered relative to projected value"

**Example:**
```
Roschon Johnson — WAIVER (74%)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Rising usage, likely available on waivers

Supporting Factors:
• Value 680 points above replacement level
• Only 38% rostered
• Usage trending upward
• Value rising, act quickly
```

### 5. Stash (Dynasty Only)

**Criteria:**
- `format == 'dynasty'`
- `age <= 24`
- `usage_trend > 0` (rising usage)
- `rank_delta > 5` (market underranking)

**Confidence Formula:**
```typescript
confidence = 50 (base)
  + 15 (if age <= 22)                 // Very young
  + (usage_trend * 20)                // Opportunity growth
  + 15 (if rank_delta > 20)           // Significant undervalue
  * (data_quality / 100)
```

**Reason Templates:**
- "Young talent with expanding role"
- "Opportunity growing, stash before breakout"
- "Market undervaluing long-term upside"

**Example:**
```
Jayden Reed — STASH (79%)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Young talent with expanding role

Supporting Factors:
• Young player (age 23)
• Usage trending upward (+28%)
• Market underranking by 18 spots
• Significant upside potential
```

### 6. Avoid/Trap

**Criteria:**
- `value_delta < -900` (significantly overvalued)
- `usage_trend < -0.2` (declining usage)

**Confidence Formula:**
```typescript
confidence = 50 (base)
  + min(25, abs(value_delta) / 50)   // Overvaluation
  + 15 (if usage_trend < -0.3)       // Strong decline
  + 10 (if age >= 29 && position == 'RB')  // Age cliff
  * (data_quality / 100)
```

**Reason Templates:**
- "Age cliff imminent, market hasn't adjusted"
- "Declining usage, market overvaluing past production"
- "Recent spike masking underlying decline"
- "Market inflated relative to projected production"

**Example:**
```
Dalvin Cook — AVOID (81%)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Age cliff imminent, market hasn't adjusted

Supporting Factors:
• Market overvaluing by 1,240 points
• Usage declining (-42%)
• Aging player (age 29)
• Model projecting significant decline
```

## Component Libraries

### 1. Market Position Evaluator

**File:** `src/lib/advice/evaluateMarketPosition.ts`

```typescript
export interface PlayerMarketPosition {
  // Player info
  playerId: string;
  playerName: string;
  position: string;
  age?: number;

  // Values
  modelValue: number;          // FDP calculated value
  marketValue: number;         // KTC consensus
  valueDelta: number;          // model - market (+ = undervalued)

  // Recent changes
  recentChange7d: number;
  recentChange24h: number;
  recentChangePercent7d: number;

  // Ranks
  modelRank?: number;
  marketRank?: number;
  rankDelta?: number;          // market - model (+ = overranked)

  // Trends
  usageTrend: number;          // -1 to 1 scale

  // Context
  availabilityStatus: string;
  rosteredPercent?: number;
  injuryStatus?: string;

  // Quality
  confidence: number;          // 0-100
  dataQuality: number;         // 0-100
}

// Evaluate single player
evaluatePlayerMarketPosition(playerId, leagueProfileId, format)

// Batch evaluate (more efficient)
batchEvaluateMarketPosition(playerIds, leagueProfileId, format)

// Get replacement level by position
getReplacementLevelValue(position, format)
```

**Key Functions:**
- Fetches model value (FDP)
- Fetches market value (KTC)
- Calculates value delta
- Tracks recent changes (7d, 24h)
- Estimates usage trends
- Scores confidence based on data availability

### 2. Advice Detectors

**File:** `src/lib/advice/detectAdvice.ts`

```typescript
export interface AdviceRecommendation {
  adviceType: 'buy_low' | 'sell_high' | 'breakout' | 'waiver' | 'stash' | 'avoid';
  confidence: number;         // 1-100
  score: number;              // Sortable score
  reason: string;
  supportingFactors: string[];
  expiresAt?: Date;           // For time-sensitive advice
}

// Individual detectors
detectBuyLow(position): AdviceRecommendation | null
detectSellHigh(position): AdviceRecommendation | null
detectBreakout(position): AdviceRecommendation | null
detectWaiverTarget(position, replacementLevel): AdviceRecommendation | null
detectStash(position): AdviceRecommendation | null
detectAvoid(position): AdviceRecommendation | null

// Detect all applicable
detectAllAdvice(position, replacementLevel): AdviceRecommendation[]
```

**Each detector:**
- Checks specific criteria
- Calculates confidence score
- Generates human-readable reason
- Collects supporting factors
- Returns null if criteria not met

### 3. Daily Advice Generator

**File:** `src/lib/advice/generateDailyAdvice.ts`

```typescript
export interface AdviceGenerationOptions {
  format: 'dynasty' | 'redraft';
  leagueProfileId?: string | null;
  playerLimit?: number;       // Default 500
  minConfidence?: number;     // Default 50
}

export interface AdviceGenerationResult {
  format: string;
  playersEvaluated: number;
  adviceGenerated: number;
  adviceByType: Record<string, number>;
  topOpportunities: Array<{
    adviceType: string;
    playerName: string;
    confidence: number;
  }>;
  duration: number;
  errors: string[];
}

// Generate advice for one format/profile
generateDailyAdvice(options): Promise<AdviceGenerationResult>

// Generate for all formats/profiles
generateAllDailyAdvice(formats, leagueProfileIds): Promise<AdviceGenerationResult[]>

// Get current stats
getAdviceStats(format, leagueProfileId): Promise<{...}>
```

**Process:**
1. Get top 500 players
2. Evaluate market position for each
3. Detect applicable advice types
4. Filter by minimum confidence
5. Store in database (upsert)
6. Clean up expired advice
7. Return summary statistics

**Runs Daily:** Cron job every morning

### 4. Get Advice API

**File:** `src/lib/advice/getAdvice.ts`

```typescript
export interface AdviceFilters {
  format: 'dynasty' | 'redraft';
  leagueProfileId?: string | null;
  adviceType?: 'buy_low' | 'sell_high' | ...;
  minConfidence?: number;
  limit?: number;
  offset?: number;
}

export interface AdviceResponse {
  playerId: string;
  playerName: string;
  position: string;
  adviceType: string;
  confidence: number;
  score: number;
  reason: string;
  supportingFactors: string[];
  modelValue: number | null;
  marketValue: number | null;
  valueDelta: number | null;
  // ... more fields
}

// Get filtered advice
getAdvice(filters): Promise<AdviceResponse[]>

// Get grouped by type
getGroupedAdvice(format, leagueProfileId, limitPerType): Promise<GroupedAdvice>

// Get top opportunity per type
getTopOpportunities(format, leagueProfileId): Promise<AdviceResponse[]>

// Get advice for specific player
getPlayerAdvice(playerId, format, leagueProfileId): Promise<AdviceResponse[]>

// Search by player name
searchAdvice(searchTerm, format, limit): Promise<AdviceResponse[]>

// Get summary stats
getAdviceSummary(format, leagueProfileId): Promise<{...}[]>

// Get counts by type
getAdviceCounts(format, leagueProfileId): Promise<Record<string, number>>
```

**Usage:**
- Edge Functions / API routes
- Frontend API calls
- Admin dashboards

## UI Components

### Today's Opportunities Card

**Component:** `src/components/TodaysOpportunities.tsx`

**Purpose:** Homepage widget showing top opportunities

**Features:**
- Filter tabs by advice type
- Confidence badges (color-coded)
- Expandable supporting factors
- Real-time refresh
- Responsive design

**Display:**
```
Today's Opportunities
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[All] [Buy Low (12)] [Sell High (8)] [Breakout (5)] ...

┌─────────────────────────────────────┐
│ 🟢 BUY LOW                    [85%] │
│ Garrett Wilson                      │
│ WR                            +820  │
│                                     │
│ Market hasn't adjusted to           │
│ increased target share              │
│                                     │
│ [Show details ▼]                    │
└─────────────────────────────────────┘
```

**Props:**
```typescript
<TodaysOpportunities
  format="dynasty"
  leagueProfileId={null}
  limit={6}
/>
```

### Player Advice Badge

**Integration:** Add to PlayerDetail component

**Display:**
```
Garrett Wilson

[🟢 BUY LOW - 85%] [⚡ BREAKOUT - 72%]

Market hasn't adjusted to increased target share
```

## API Endpoints (Implementation Needed)

### GET /api/advice

**Purpose:** Get all advice with filters

**Query Params:**
- `format`: 'dynasty' | 'redraft'
- `profile`: league profile ID (optional)
- `type`: advice type filter (optional)
- `min_confidence`: minimum confidence (default 50)
- `limit`: result limit (default 100)
- `offset`: pagination offset (default 0)

**Response:**
```json
{
  "format": "dynasty",
  "leagueProfileId": null,
  "advice": [
    {
      "playerId": "uuid",
      "playerName": "Garrett Wilson",
      "position": "WR",
      "adviceType": "buy_low",
      "confidence": 85,
      "score": 1320,
      "reason": "Market hasn't adjusted to increased target share",
      "supportingFactors": [
        "Model value 820 points higher than market",
        "Usage trend improving",
        "Market value declined 150 in last 7 days"
      ],
      "valueDelta": 820,
      "expiresAt": null,
      "createdAt": "2024-12-16T06:00:00Z"
    }
  ],
  "totalCount": 45,
  "page": 1,
  "hasMore": false
}
```

### GET /api/advice/grouped

**Purpose:** Get advice grouped by type

**Query Params:**
- `format`: 'dynasty' | 'redraft'
- `profile`: league profile ID (optional)
- `limit_per_type`: limit per category (default 10)

**Response:**
```json
{
  "format": "dynasty",
  "leagueProfileId": null,
  "generatedAt": "2024-12-16T06:00:00Z",
  "buy_low": [...],
  "sell_high": [...],
  "breakout": [...],
  "waiver": [...],
  "stash": [...],
  "avoid": [...],
  "totalCount": 67
}
```

### GET /api/advice/player/:playerId

**Purpose:** Get advice for specific player

**Query Params:**
- `format`: 'dynasty' | 'redraft'
- `profile`: league profile ID (optional)

**Response:**
```json
{
  "playerId": "uuid",
  "playerName": "Garrett Wilson",
  "advice": [
    {
      "adviceType": "buy_low",
      "confidence": 85,
      "reason": "...",
      // ... full advice
    }
  ]
}
```

### GET /api/advice/summary

**Purpose:** Get advice summary stats

**Query Params:**
- `format`: 'dynasty' | 'redraft'
- `profile`: league profile ID (optional)

**Response:**
```json
{
  "format": "dynasty",
  "summary": [
    {
      "adviceType": "buy_low",
      "playerCount": 12,
      "avgConfidence": 76,
      "topPlayerName": "Garrett Wilson",
      "topPlayerConfidence": 85
    },
    // ... other types
  ],
  "totalAdvice": 67,
  "lastGenerated": "2024-12-16T06:00:00Z"
}
```

## Cron Jobs

### Daily Advice Generation

**Schedule:** Every morning at 6:00 AM

**Cron:** `0 6 * * *`

**Implementation:**
```typescript
import { generateAllDailyAdvice } from './lib/advice/generateDailyAdvice';

export async function dailyAdviceJob() {
  console.log('Starting daily advice generation...');

  const results = await generateAllDailyAdvice(
    ['dynasty', 'redraft'],
    [] // Add league profile IDs if needed
  );

  for (const result of results) {
    console.log(`
${result.format} advice generation:
- Players evaluated: ${result.playersEvaluated}
- Advice generated: ${result.adviceGenerated}
- Buy Low: ${result.adviceByType.buy_low}
- Sell High: ${result.adviceByType.sell_high}
- Breakout: ${result.adviceByType.breakout}
- Waiver: ${result.adviceByType.waiver}
- Stash: ${result.adviceByType.stash}
- Avoid: ${result.adviceByType.avoid}
- Errors: ${result.errors.length}
    `);
  }

  console.log('Daily advice generation complete');
}
```

### Cleanup Expired Advice

**Schedule:** Every hour

**Cron:** `0 * * * *`

**Implementation:**
```typescript
import { supabase } from './lib/supabase';

export async function cleanupExpiredAdviceJob() {
  const { data: deleted } = await supabase.rpc('cleanup_expired_advice');
  console.log(`Cleaned up ${deleted || 0} expired advice records`);
}
```

## Example Scenarios

### Scenario 1: Buy Low Detection

**Player:** Garrett Wilson (WR)

**Market Position:**
```
Model Value: 6,420
Market Value (KTC): 5,600
Value Delta: +820 (undervalued)

Recent Change 7d: -150 (declining)
Recent Change 24h: -20
Usage Trend: +0.32 (rising)

Availability: Healthy
```

**Detection:**
```typescript
// Criteria check
value_delta (820) > 600 ✓
recent_change_7d (-150) <= 0 ✓
availability (Healthy) != out_longterm ✓

// Confidence calculation
confidence = 50
  + min(30, 820/40) = 50 + 20.5 = 70.5
  + (0.32 * 15) = 70.5 + 4.8 = 75.3
  + 10 (decline bonus) = 85.3
  * (80/100 data quality) = 68.2

Final confidence: 68%
```

**Generated Advice:**
```
BUY LOW — Garrett Wilson (68%)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Usage rising but market price stagnant

Supporting Factors:
• Model value 820 points higher than market
• Usage trend improving
• Market value declined 150 in last 7 days
```

### Scenario 2: Sell High Detection

**Player:** Raheem Mostert (RB)

**Market Position:**
```
Model Value: 3,250
Market Value (KTC): 4,200
Value Delta: -950 (overvalued)

Recent Change 7d: +420 (spiking)
Recent Change 24h: +180
Usage Trend: -0.18 (declining)

Age: 31
```

**Detection:**
```typescript
// Criteria check
value_delta (-950) < -600 ✓
recent_change_7d (420) > 0 ✓

// Confidence calculation
confidence = 50
  + min(30, 950/40) = 50 + 23.75 = 73.75
  + 15 (recent spike) = 88.75
  + 0 (usage not declining enough) = 88.75
  * (85/100 data quality) = 75.4

Final confidence: 75%
```

**Generated Advice:**
```
SELL HIGH — Raheem Mostert (75%)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Recent spike likely unsustainable

Supporting Factors:
• Market value 950 points higher than model
• Market value increased 420 in last 7 days
• Usage trend declining
```

### Scenario 3: Breakout Detection

**Player:** Jordan Addison (WR)

**Market Position:**
```
Model Value: 4,850
Market Value (KTC): 4,400
Value Delta: +450

Recent Change 7d: +680
Recent Change 24h: +340 (big momentum)
Usage Trend: +0.48 (strong upward)

Age: 22
```

**Detection:**
```typescript
// Criteria check
usage_trend (0.48) >= 0.25 ✓
recent_change_24h (340) > 150 ✓

// Confidence calculation
confidence = 50
  + (0.48 * 30) = 50 + 14.4 = 64.4
  + 15 (big momentum) = 79.4
  + 10 (age <= 24) = 89.4
  * (90/100 data quality) = 80.5

Final confidence: 81%

// Expiration
expires_at = now + 72 hours
```

**Generated Advice:**
```
BREAKOUT — Jordan Addison (81%) ⏰ Expires in 72h
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Classic year 2-3 WR breakout pattern

Supporting Factors:
• Strong usage trend (+48%)
• Value increased 340 in last 24h
• Young player (age 22) with upside
• Model projecting continued rise
```

## Benefits

### For Users

**Actionable Intel:**
- Know exactly what to do, not just rankings
- Confidence scores guide decision-making
- Clear reasoning builds trust

**Daily Engagement:**
- Check homepage for new opportunities
- Act on time-sensitive breakouts (72h)
- Stay ahead of market movements

**Competitive Edge:**
- Buy low before market catches up
- Sell high before decline
- Grab waiver gems early

### For Product

**Differentiation:**
- Only calculator with automated advice
- Transforms tool into daily habit
- Creates urgency (expiring breakouts)

**Engagement Metrics:**
- Daily return visits
- Homepage widget interaction
- Advice click-through rates

**Content Generation:**
- Weekly "Top Opportunities" reports
- Social media content
- Email newsletters

## Summary

The **Player Advice Engine** completes Dynasty Dominator's evolution from calculator to intelligent advisor. Users no longer ask "What are the values?" but instead receive "Here's what you should do and why."

**Key Files Created:**
- `src/lib/advice/evaluateMarketPosition.ts` - Market position analysis
- `src/lib/advice/detectAdvice.ts` - Rule-based detectors
- `src/lib/advice/generateDailyAdvice.ts` - Daily generation job
- `src/lib/advice/getAdvice.ts` - API helpers
- `src/components/TodaysOpportunities.tsx` - Homepage widget

**Database:**
- `player_advice` table with indexes and RLS
- Helper functions and views
- Expiration management

**Result:** Dynasty Dominator transforms from "here are the numbers" to "here's exactly what you should do and why" - creating daily engagement and competitive advantage for users.
