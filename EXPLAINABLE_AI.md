# Explainable AI Layer

## Overview

The Explainable AI Layer transforms Dynasty Dominator from a "black box" calculator into a transparent, trustworthy system that explains every decision. Users don't just see numbers—they understand WHY values changed, WHY trades are fair or unfair, and WHAT factors drove the analysis.

**Key Innovation:** Never hallucinates. Every explanation references actual factors from the valuation pipeline: production changes, scarcity adjustments, league settings, availability modifiers, market anchoring, and real-time adjustments.

## Philosophy

### Before (Black Box)
```
Input: Player values
↓
[Magic happens]
↓
Output: Numbers
```
**Result:** Users trust or distrust based on gut feel

### After (Explainable)
```
Input: Player values
↓
Track: Production, Scarcity, Age, Availability, Market, Role
↓
Analyze: Primary reason + Secondary factors
↓
Render: Human-readable explanation
↓
Output: Numbers + WHY
```
**Result:** Users understand and trust decisions

## Core Principle

**Every explanation must reference ACTUAL pipeline factors:**
- ✅ "Value increased after strong production performance" (tracked production delta)
- ✅ "Value adjusted upward due to positional scarcity" (tracked scarcity adjustment)
- ✅ "Value decreased due to injury designation" (tracked availability modifier)

**Never hallucinate:**
- ❌ "Value increased due to team performance" (not tracked)
- ❌ "Value changed because of coaching change" (unless explicitly tracked)
- ❌ "Value adjusted for schedule strength" (not a factor)

## Architecture

### 1. Data Flow

```
Nightly Rebuild
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Load Previous Values
    ↓
Calculate New Values
    (track component deltas)
    ↓
For each significant change (≥150 points):
    ↓
Build Structured Reasoning
    {
      production: +420,
      scarcity: -110,
      age_curve: +80,
      availability: -350,
      market_anchor: +95
    }
    ↓
Identify Primary Reason
    (largest absolute delta)
    ↓
Render Explanation
    "Value decreased due to injury designation
     affecting short-term availability"
    ↓
Store Explanation
    player_value_explanations table
    ↓
Compute Daily Changes
    daily_value_changes table
    ↓
Update Weekly Report
    weekly_market_reports table
```

### 2. Database Schema

**player_value_explanations**
```sql
CREATE TABLE player_value_explanations (
  id uuid PRIMARY KEY,
  player_id uuid REFERENCES nfl_players,
  league_profile_id uuid,
  format text,  -- 'dynasty' or 'redraft'

  -- Values
  old_value integer,
  new_value integer,
  delta integer,

  -- Reasoning
  primary_reason text,
  primary_reason_delta integer,
  secondary_reasons jsonb,

  -- Output
  explanation_text text,
  confidence_change numeric,
  rank_change integer,

  -- Metadata
  epoch text,
  generated_at timestamptz,
  created_at timestamptz
);
```

**Purpose:** Store explanation for every significant value change

**Usage:**
- Player page: "Why did this change?"
- Value history: Chart with explanations
- API: Get recent explanations

**daily_value_changes**
```sql
CREATE TABLE daily_value_changes (
  change_date date,
  player_id uuid,
  format text,

  old_value integer,
  new_value integer,
  delta integer,
  percent_change numeric,

  old_rank integer,
  new_rank integer,
  rank_change integer,

  explanation_text text,
  primary_reason text,
  change_type text,  -- 'riser', 'faller', 'volatile'

  created_at timestamptz,
  UNIQUE (change_date, player_id, format)
);
```

**Purpose:** Pre-computed daily movers for homepage feed

**Usage:**
- Homepage: "Trending Players Today"
- API: `/api/changes/today`
- Widget: TrendingPlayersWidget component

**weekly_market_reports**
```sql
CREATE TABLE weekly_market_reports (
  week_start date,
  week_end date,
  format text,
  season integer,
  week_number integer,

  -- Content
  biggest_gainers jsonb,
  biggest_losers jsonb,
  most_volatile jsonb,
  position_trends jsonb,
  key_insights jsonb,

  -- Metrics
  market_sentiment text,
  total_value_changes integer,
  avg_volatility numeric,
  most_active_position text,

  -- Report
  report_title text,
  report_summary text,
  report_content text,

  published boolean,
  published_at timestamptz,

  UNIQUE (week_start, format, report_type)
);
```

**Purpose:** Weekly market recap reports

**Usage:**
- Blog/content page
- Email newsletter
- Social media content
- Historical analysis

**trade_explanations**
```sql
CREATE TABLE trade_explanations (
  id uuid PRIMARY KEY,
  trade_id uuid,
  session_id text,

  team_a_value integer,
  team_b_value integer,
  value_difference integer,
  fairness_score numeric,

  overall_assessment text,
  team_a_analysis jsonb,
  team_b_analysis jsonb,
  fairness_factors jsonb,
  warnings jsonb,
  recommendations jsonb,

  format text,
  league_profile_id uuid,
  created_at timestamptz
);
```

**Purpose:** Detailed trade evaluation explanations

**Usage:**
- Trade analyzer: Show WHY trade is fair/unfair
- Prevent league arguments
- Trade history with reasoning

## Component Libraries

### 1. Build Structured Reasoning

**File:** `src/lib/explanations/buildValueReasoning.ts`

```typescript
export function buildValueReasoning(context: ValueContext): ValueReasoning {
  // Build component map
  const components = {
    production: context.productionAdjustment,
    scarcity: context.scarcityAdjustment,
    age_curve: context.ageCurveAdjustment,
    availability: context.availabilityModifier,
    market_anchor: context.marketAnchorDelta,
    role_change: context.roleChangeImpact,
    // ... more factors
  };

  // Find primary reason (largest absolute delta)
  const primary = getLargestComponent(components);

  return {
    oldValue: context.previousValue,
    newValue: context.newValue,
    delta: context.newValue - context.previousValue,
    components,
    primaryReason: primary.reason,
    primaryReasonDelta: primary.delta,
    secondaryReasons: getTopSecondary(components, 3),
  };
}
```

**Key Functions:**
- `buildValueReasoning()` - Full reasoning with context
- `buildBasicReasoning()` - Simplified when context missing
- `categorizeReason()` - Map reason keys to display names
- `calculateComponentPercentages()` - Show % contribution
- `getReasoningConfidence()` - How complete is the reasoning?
- `validateReasoning()` - Check components sum to delta

### 2. Render Human-Readable Explanations

**File:** `src/lib/explanations/renderExplanation.ts`

```typescript
export function renderExplanation(
  reasoning: ValueReasoning,
  options?: ExplanationOptions
): string {
  const delta = reasoning.delta;
  const direction = delta > 0 ? 'increased' : 'decreased';
  const magnitude = getMagnitude(Math.abs(delta));

  return renderReasonText(
    reasoning.primaryReason,
    delta,
    reasoning.position,
    { direction, magnitude }
  );
}
```

**Templates by Reason:**

**Production:**
```
Positive: "Value increased after strong production performance"
Negative: "Value decreased due to declining production metrics"
```

**Breakout:**
```
"Value significantly increased after elite usage and production jump"
```

**Injury/Availability:**
```
"Value decreased due to injury designation affecting short-term availability"
```

**Scarcity:**
```
Positive: "Value adjusted upward due to positional scarcity in this league format"
Negative: "Value adjusted downward due to positional depth in this league format"
```

**Market:**
```
"Value corrected toward market consensus rankings"
```

**Role:**
```
Positive: "Value increased after promotion to starting role"
Negative: "Value decreased due to reduced role opportunity"
```

**Age:**
```
"Value adjusted for age-related decline projection"
```

**Trade:**
```
Positive: "Value increased after trade to improved situation"
Negative: "Value decreased after trade to worse situation"
```

**Opportunity:**
```
Positive: "Value increased due to increased opportunity share"
Negative: "Value decreased due to decreased opportunity share"
```

**Regression:**
```
"Value decreased projecting efficiency regression"
```

**Key Functions:**
- `renderExplanation()` - Primary explanation text
- `renderDetailedExplanation()` - With component breakdown
- `renderRankChangeExplanation()` - Focus on rank movement
- `renderConfidentExplanation()` - Add confidence qualifier
- `renderTradeExplanation()` - Trade-specific context
- `renderWeeklySummary()` - Short format for lists
- `renderPositionContextExplanation()` - Add position context

### 3. Track Value Changes

**File:** `src/lib/explanations/trackValueChanges.ts`

```typescript
export async function trackValueChanges(
  changes: ValueChangeRecord[],
  epoch: string
): Promise<number> {
  // Filter for significant changes (≥150 points)
  const significant = changes.filter(c => Math.abs(c.delta) >= 150);

  for (const change of significant) {
    // Build reasoning
    const reasoning = buildValueReasoning(change.context);

    // Render explanation
    const explanationText = renderExplanation(reasoning);

    // Store in database
    await supabase.from('player_value_explanations').insert({
      player_id: change.playerId,
      old_value: change.oldValue,
      new_value: change.newValue,
      delta: change.delta,
      primary_reason: reasoning.primaryReason,
      primary_reason_delta: reasoning.primaryReasonDelta,
      secondary_reasons: reasoning.secondaryReasons,
      explanation_text: explanationText,
      epoch
    });
  }

  return significant.length;
}
```

**Key Functions:**
- `trackValueChanges()` - Store explanations during rebuild
- `getPlayerExplanations()` - Fetch player history
- `getLatestExplanation()` - Most recent change
- `computeDailyChanges()` - Pre-compute daily movers
- `getTodaysMovers()` - Fetch today's risers/fallers
- `getExplanationStats()` - Dashboard statistics
- `getValueHistory()` - Chart data with explanations
- `detectTrendingPlayers()` - Consistent directional movement

### 4. Explain Trades

**File:** `src/lib/explanations/explainTrade.ts`

```typescript
export function explainTrade(
  teamAPlayers: TradePlayer[],
  teamBPlayers: TradePlayer[],
  format: 'dynasty' | 'redraft'
): TradeAnalysis {
  return {
    overallAssessment: "Fair trade with balanced value exchange",

    teamAAnalysis: [
      "Trading away the best player in the deal",
      "Losing positional advantage at RB",
      "Consolidating 3 players into 1 - upgrading quality"
    ],

    teamBAnalysis: [
      "Acquiring the best player in the deal",
      "Gaining positional strength at RB",
      "Trading down from elite tier"
    ],

    fairnessFactors: [
      "Value difference within fair range (≤10%)",
      "Equal number of players exchanged",
      "Best player represents 45% of total value"
    ],

    warnings: [
      "Team A trading elite tier player without receiving equivalent back"
    ],

    recommendations: [
      "Team B should add approximately 1500 value points",
      "Consider adding a flex-worthy player or early draft pick"
    ]
  };
}
```

**Analysis Components:**

**Overall Assessment:**
- Fair (≤10% difference)
- Slightly favors (10-20%)
- Significantly favors (20-35%)
- Very lopsided (>35%)

**Team Analysis:**
- Best player comparison
- Quantity vs quality
- Position strength changes
- Tier movement
- Dynasty considerations

**Fairness Factors:**
- Value difference %
- Player count balance
- Best player dominance
- Elite tier representation

**Warnings:**
- Lopsided trades
- Elite players without equivalent
- Package value insufficient

**Recommendations:**
- Specific value gaps to fill
- Suggested player tiers
- Strategic considerations

**Key Functions:**
- `explainTrade()` - Full trade analysis
- `generateTradeSummary()` - One-line summary

### 5. Generate Weekly Reports

**File:** `src/lib/explanations/generateWeeklyReport.ts`

```typescript
export async function generateWeeklyReport(
  weekStart: Date,
  weekEnd: Date,
  format: 'dynasty' | 'redraft'
): Promise<WeeklyReportData> {
  // Query all explanations for the week
  const explanations = await fetchWeeklyExplanations(weekStart, weekEnd, format);

  return {
    biggestGainers: getTopGainers(explanations, 10),
    biggestLosers: getTopLosers(explanations, 10),
    mostVolatile: getMostVolatile(explanations, 10),
    positionTrends: calculatePositionTrends(explanations),
    keyInsights: generateKeyInsights(explanations),
    marketSentiment: determineMarketSentiment(explanations)
  };
}
```

**Report Components:**

**Biggest Gainers/Losers:**
```
Player, Position, Delta, % Change, Explanation
```

**Most Volatile:**
```
Player, Position, Change Count, Total Swing, Trend Direction
```

**Position Trends:**
```
For each position (QB, RB, WR, TE):
- Average change
- Direction (up/down/stable)
- Volatility metric
- Top mover
- Insight text
```

**Key Insights:**
```
- "156 significant value changes tracked this week"
- "Puka Nacua led all gainers with +2,340 value due to breakout"
- "Dalvin Cook had largest decline with -1,890 value due to age curve"
- "RB, TE positions trending upward"
- "Injury was the most common factor (42 players affected)"
```

**Market Sentiment:**
- Bullish: 60%+ positive changes
- Bearish: 60%+ negative changes
- Neutral: Balanced

**Key Functions:**
- `generateWeeklyReport()` - Create full report
- `storeWeeklyReport()` - Save to database
- `generateReportTitle()` - Title generation
- `generateReportSummary()` - Short summary
- `generateReportContent()` - Full markdown content

## UI Components

### 1. Trending Players Widget

**Component:** `src/components/TrendingPlayersWidget.tsx`

**Purpose:** Homepage feed of today's biggest movers

**Features:**
- Tabs: Risers vs Fallers
- Player cards with explanations
- Value delta and % change
- Rank movement indicator
- Reason badges
- Real-time updates

**Usage:**
```tsx
<TrendingPlayersWidget format="dynasty" limit={10} />
```

### 2. Player Value History

**Integration:** Add to `src/components/PlayerDetail.tsx`

**Section:** "Why Did This Change?"

**Display:**
```
Latest Movement
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
↑ +450 value (8.5%)
Value increased after strong production performance

Last 7 Days
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Dec 15: +450 - Production
Dec 12: -120 - Market
Dec 10: +200 - Opportunity

Confidence Trend
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
85% → 88% → 90% (Improving)
```

### 3. Trade Explanation View

**Enhancement:** Integrate into `src/components/TradeAnalyzer.tsx`

**Display:**
```
Overall Assessment
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚠️ Slightly favors Team A

Team A receives approximately 12% more value.

Team A Analysis
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✓ Acquiring the best player in the deal
✓ Gaining positional strength at RB
⚠️ Consolidating 3 players into 1

Team B Analysis
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚠️ Trading away the best player
⚠️ Losing positional advantage at RB
✓ Adding depth across positions

Recommendations
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
• Team B should add approximately 800 value points
• Consider adding a bench player or mid-round pick
```

### 4. Weekly Report Page

**New Component:** `src/components/WeeklyMarketReport.tsx`

**Features:**
- Report title and date range
- Executive summary
- Top movers lists with explanations
- Position trend charts
- Key insights cards
- Market sentiment indicator
- Historical report archive

## API Endpoints

### GET /api/changes/today

**Purpose:** Today's biggest movers

**Query Params:**
- `format`: 'dynasty' | 'redraft'
- `type`: 'riser' | 'faller' | 'all'
- `limit`: number (default 10)

**Response:**
```json
[
  {
    "playerId": "uuid",
    "playerName": "Puka Nacua",
    "position": "WR",
    "delta": 2340,
    "percentChange": 28.5,
    "rankChange": -12,
    "explanationText": "Value significantly increased after elite usage and production jump",
    "primaryReason": "Breakout"
  }
]
```

### GET /api/player/:id/explanations

**Purpose:** Player value history with explanations

**Query Params:**
- `format`: 'dynasty' | 'redraft'
- `limit`: number (default 10)

**Response:**
```json
[
  {
    "oldValue": 5200,
    "newValue": 5650,
    "delta": 450,
    "explanationText": "Value increased after strong production performance",
    "primaryReason": "Production",
    "rankChange": -3,
    "generatedAt": "2024-12-15T06:00:00Z"
  }
]
```

### GET /api/reports/weekly

**Purpose:** Weekly market reports

**Query Params:**
- `format`: 'dynasty' | 'redraft'
- `limit`: number (default 10)

**Response:**
```json
[
  {
    "id": "uuid",
    "weekStart": "2024-12-09",
    "weekEnd": "2024-12-15",
    "reportTitle": "Dynasty Market Report: Week 14 2024",
    "reportSummary": "Weekly dynasty market movements...",
    "totalValueChanges": 156,
    "mostActivePosition": "RB",
    "marketSentiment": "bullish",
    "published": true
  }
]
```

### GET /api/reports/weekly/:id

**Purpose:** Full weekly report

**Response:**
```json
{
  "reportTitle": "Dynasty Market Report: Week 14 2024",
  "reportSummary": "...",
  "reportContent": "## Top Movers\n\n...",
  "biggestGainers": [...],
  "biggestLosers": [...],
  "positionTrends": {...},
  "keyInsights": [...],
  "marketSentiment": "bullish"
}
```

### POST /api/trade/explain

**Purpose:** Generate trade explanation

**Body:**
```json
{
  "teamAPlayers": [...],
  "teamBPlayers": [...],
  "format": "dynasty"
}
```

**Response:**
```json
{
  "overallAssessment": "Fair trade with balanced value exchange",
  "fairnessScore": 0.95,
  "teamAAnalysis": [...],
  "teamBAnalysis": [...],
  "fairnessFactors": [...],
  "warnings": [...],
  "recommendations": [...]
}
```

## Integration Points

### During Nightly Rebuild

**Location:** Value rebuild pipeline

**Add After:** New values calculated

**Add Before:** Write to database

```typescript
// In rebuild function
const changes: ValueChangeRecord[] = [];

for (const player of players) {
  const oldValue = await getPreviousValue(player.id, format);
  const newValue = calculatedValue;
  const delta = newValue - oldValue;

  if (Math.abs(delta) >= 150) {
    changes.push({
      playerId: player.id,
      playerName: player.name,
      position: player.position,
      format,
      oldValue,
      newValue,
      delta,
      oldRank: previousRank,
      newRank: newRank,
      context: {
        // Component deltas from pipeline
        productionAdjustment: productionDelta,
        scarcityAdjustment: scarcityDelta,
        ageCurveAdjustment: ageDelta,
        availabilityModifier: availabilityDelta,
        marketAnchorDelta: marketDelta,
        // ... more context
      }
    });
  }
}

// Generate explanations
await trackValueChanges(changes, epoch);

// Compute daily changes
await computeDailyChanges(changes, format);
```

### Weekly Report Generation

**Schedule:** Sunday nights after week completes

**Cron:** `0 0 * * 0` (Midnight Sunday)

```typescript
import { generateWeeklyReport, storeWeeklyReport } from './lib/explanations/generateWeeklyReport';

export async function weeklyReportJob() {
  const today = new Date();
  const weekEnd = today;
  const weekStart = new Date(today);
  weekStart.setDate(weekStart.getDate() - 7);

  // Generate for both formats
  for (const format of ['dynasty', 'redraft'] as const) {
    const report = await generateWeeklyReport(weekStart, weekEnd, format);
    await storeWeeklyReport(report);
  }
}
```

## Example Scenarios

### Scenario 1: Injury Update

**Event:** Player marked as OUT

**Pipeline:**
```
availabilityModifier: -1200 (injured, out 4+ weeks)
```

**Reasoning:**
```typescript
{
  components: {
    availability: -1200,
    injury: -1200
  },
  primaryReason: 'injury',
  primaryReasonDelta: -1200
}
```

**Explanation:**
```
"Value significantly decreased due to injury designation affecting short-term availability"
```

**Result:** User understands why value dropped and can plan accordingly

### Scenario 2: Breakout Performance

**Event:** Young WR has elite game

**Pipeline:**
```
productionAdjustment: +850 (elite production jump)
opportunityChange: +420 (target share increased)
scarcityAdjustment: +280 (WR scarce in format)
```

**Reasoning:**
```typescript
{
  components: {
    breakout: 1270,  // Production + opportunity
    production: 850,
    opportunity: 420,
    scarcity: 280
  },
  primaryReason: 'breakout',
  primaryReasonDelta: 1270
}
```

**Explanation:**
```
"Value significantly increased after elite usage and production jump,
 with additional positional scarcity adjustment"
```

**Result:** User sees it's not just "hype" but actual measured factors

### Scenario 3: Lopsided Trade

**Trade:**
- Team A gives: Christian McCaffrey (8500)
- Team B gives: Rachaad White (3200), 2024 1.08 (2400), 2025 2.04 (800)

**Analysis:**
```
Team A: 8500 total value
Team B: 6400 total value
Difference: 2100 (28% imbalance)

Overall: "Significantly favors Team A"

Team A Analysis:
- "Acquiring the best player in the deal"
- "Consolidating 3 players into 1 - upgrading quality"
- "Trading up to elite tier"

Team B Analysis:
- "Trading away the best player in the deal"
- "Losing positional advantage at RB"
- "Adding depth across positions"

Warnings:
- "Significantly imbalanced trade - consider additional compensation"
- "Package value does not sufficiently compensate for elite tier drop"

Recommendations:
- "Team B should add approximately 2100 value points"
- "Consider adding a starter-level player (Top 50)"
```

**Result:** Clear explanation prevents league argument, suggests specific fix

## Benefits

### For Users

**Trust:**
- Understand decisions, not just accept them
- See actual factors, not mystery calculations
- Verify reasoning makes sense

**Education:**
- Learn what drives values
- Understand positional scarcity
- See how injuries/age affect rankings

**Engagement:**
- Daily movers feed creates return visits
- Weekly reports build community
- Trade explanations reduce friction

### For Product

**Reduced Support:**
- "Why did this change?" → Automatic explanation
- "Calculator is wrong!" → Shows exact reasoning
- "Trade seems unfair" → Detailed fairness analysis

**Content Generation:**
- Weekly reports for blog/social
- Trending players for homepage
- Historical analysis for insights

**Competitive Advantage:**
- Unique transparency
- Trust through explainability
- Engaging daily content

## Summary

The Explainable AI Layer completes Dynasty Dominator's transformation from a calculator into an intelligent advisor that users understand and trust. Every value change, every trade evaluation, every ranking movement comes with clear reasoning grounded in actual pipeline factors.

**Key Files Created:**
- `src/lib/explanations/buildValueReasoning.ts` - Structured reasoning
- `src/lib/explanations/renderExplanation.ts` - Human-readable text
- `src/lib/explanations/trackValueChanges.ts` - Change tracking
- `src/lib/explanations/explainTrade.ts` - Trade analysis
- `src/lib/explanations/generateWeeklyReport.ts` - Weekly reports
- `src/components/TrendingPlayersWidget.tsx` - Homepage widget

**Database Tables:**
- `player_value_explanations` - All explanations
- `daily_value_changes` - Pre-computed movers
- `weekly_market_reports` - Weekly content
- `trade_explanations` - Trade reasoning

**Result:** Users don't just see numbers—they understand WHY, building trust and engagement while reducing support burden.
