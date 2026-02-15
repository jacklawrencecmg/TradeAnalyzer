# League Power Rankings & Season Awards System

## Overview

Two social engagement features that create weekly excitement and end-of-season recognition:

1. **Weekly Power Rankings** - Data-driven team rankings with trends and explanations
2. **Season Awards** - Recognition for various achievements (Best GM, Trade King, etc.)

Both features are designed to be shareable, creating virality and bringing users back weekly.

---

## 1. Weekly Power Rankings

### Scoring Algorithm

Teams are ranked using a composite power score:

```
Power Score =
  roster_value × 0.45 +
  win_percentage × 0.30 +
  recent_performance × 0.15 +
  schedule_strength × 0.10
```

**Components:**
- **Roster Value (45%)** - Based on FDP player values
- **Win Percentage (30%)** - Season record
- **Recent Performance (15%)** - Points scored vs allowed
- **Schedule Strength (10%)** - Opponent difficulty (placeholder)

### Human Explanations

Each ranking includes a natural language reason:

- "Rising 3 spots • elite roster value • excellent win percentage"
- "Falling 2 spots • needs roster upgrades • struggling with losses"
- "Dominant league leader • strong roster depth • high scoring offense"
- "Steady middle-of-the-pack team"

### Trend Tracking

- Compares to previous week's rankings
- Shows up/down arrows
- Tracks rank changes over time
- Builds narrative around team trajectory

### Database Schema

```sql
league_power_rankings
- id: uuid
- league_id: text (Sleeper league ID)
- week: int
- season: int
- team_id: text (roster_id as string)
- team_name: text
- user_id: uuid (nullable)
- rank: int
- power_score: numeric (0-1 scale)
- roster_strength: numeric
- record_score: numeric
- schedule_strength: numeric
- recent_performance: numeric
- metadata: jsonb (trend, reason, stats)
- created_at: timestamptz
- UNIQUE(league_id, week, season, team_id)
```

### Edge Function

**`generate-power-rankings`**

Generates weekly power rankings for a league:

```bash
POST /functions/v1/generate-power-rankings?league_id=123&week=5&season=2025
```

Process:
1. Fetch rosters from Sleeper API
2. Calculate roster strength from player values
3. Extract record and performance stats
4. Compute composite power score
5. Rank teams by score
6. Compare to previous week for trends
7. Generate human-readable reasons
8. Store in database

### Frontend Usage

```tsx
import { generatePowerRankings, renderRankingReason } from './lib/rankings/generatePowerRankings';

// Generate rankings
const rankings = await generatePowerRankings(leagueId, week, season);

// Get reason text
const reason = renderRankingReason(ranking, trend);
```

---

## 2. Season Awards

### Award Categories

**Best GM** - Highest average power score across the season
- Consistent excellence in roster management

**Most Consistent** - Lowest rank variance throughout season
- Steady, reliable performance

**Dynasty Builder** - Largest roster value increase
- Smart acquisitions and roster improvement

**Biggest Riser** - Biggest improvement in rankings
- Climbed from bottom to top

**Trade King** - Most impactful trades
- Significant roster value gains through trading

**Future Awards:**
- Waiver Wizard - Best waiver pickups
- Unluckiest - Highest points missed
- Best Drafter - Late draft success
- Most Efficient - Points vs optimal lineup

### Database Schema

```sql
season_awards
- id: uuid
- league_id: text
- season: int
- award: text
- roster_id: int (nullable)
- team_name: text (nullable)
- user_id: uuid (nullable)
- details: text (human-readable explanation)
- stats: jsonb (supporting numbers)
- created_at: timestamptz
- UNIQUE(league_id, season, award)
```

### Generation Logic

```tsx
import { generateSeasonAwards } from './lib/awards/generateSeasonAwards';

// Generate all awards for a league
const awards = await generateSeasonAwards(leagueId, season);
```

**Algorithm:**
1. Fetch all power rankings for the season
2. Aggregate stats per team (avg power, rank changes, etc.)
3. Identify winner for each award category
4. Generate human-readable descriptions
5. Store awards with supporting stats

---

## 3. Shareable Images (OG Images)

### Power Ranking Cards

**Edge Function**: `power-ranking-og-image`

Generates SVG share cards for rankings:

```
https://yourproject.supabase.co/functions/v1/power-ranking-og-image?id={ranking_id}
```

**Displays:**
- Rank number in large circle
- Trend arrow (up/down/flat)
- Team name
- Power score
- Reason (truncated)
- Week number
- Branding

**Colors:**
- Blue gradient background
- Trend arrows: green (up), red (down), gray (flat)

### Award Cards

**Edge Function**: `award-og-image`

Generates SVG share cards for awards:

```
https://yourproject.supabase.co/functions/v1/award-og-image?id={award_id}
```

**Displays:**
- Award emoji icon
- Award name
- Winner team name
- Details text
- Key stats
- Season year
- Branding

**Award-Specific Colors:**
- Best GM: Yellow/gold gradient 👑
- Most Consistent: Blue gradient 🎯
- Dynasty Builder: Green gradient 📈
- Biggest Riser: Purple gradient ⚡
- Trade King: Orange gradient ⭐

---

## 4. UI Components

### PowerRankings Component (existing)

Located at: `src/components/PowerRankings.tsx`

Displays current rankings with:
- Rank badges
- Trend indicators
- Team names
- Power scores
- Expandable details

### SeasonAwards Component (new)

Located at: `src/components/SeasonAwards.tsx`

**Features:**
- Grid layout of award cards
- Color-coded by award type
- Trophy/icon for each award
- Winner name prominently displayed
- Details and supporting stats
- Hover effects

**Usage:**
```tsx
import { SeasonAwards } from './components/SeasonAwards';

<SeasonAwards leagueId={leagueId} season={2025} />
```

---

## 5. Integration Guide

### Generate Weekly Rankings

**Via Edge Function:**
```bash
curl -X POST "https://yourproject.supabase.co/functions/v1/generate-power-rankings?league_id=123&week=5&season=2025" \
  -H "Authorization: Bearer YOUR_ANON_KEY"
```

**Via Frontend:**
```tsx
const response = await fetch(
  `${supabaseUrl}/functions/v1/generate-power-rankings?league_id=${leagueId}&week=${week}&season=${season}`,
  {
    headers: {
      'Authorization': `Bearer ${supabaseAnonKey}`,
    },
  }
);
const result = await response.json();
```

### Generate Season Awards

**Via Frontend:**
```tsx
import { generateSeasonAwards } from './lib/awards/generateSeasonAwards';

const awards = await generateSeasonAwards(leagueId, 2025);
```

### Display in Dashboard

Add to league dashboard:

```tsx
import { SeasonAwards } from './components/SeasonAwards';

// In your league dashboard
<div>
  <PowerRankings leagueId={leagueId} />

  {/* Show awards after playoffs */}
  {isSeasonComplete && (
    <SeasonAwards leagueId={leagueId} season={currentSeason} />
  )}
</div>
```

### Social Sharing

**Power Rankings:**
```tsx
const shareUrl = `https://yourproject.supabase.co/functions/v1/power-ranking-og-image?id=${rankingId}`;

// Use in meta tags
<meta property="og:image" content={shareUrl} />
```

**Awards:**
```tsx
const shareUrl = `https://yourproject.supabase.co/functions/v1/award-og-image?id=${awardId}`;

// Use in meta tags
<meta property="og:image" content={shareUrl} />
```

---

## 6. Cron Schedule (Recommended)

### Weekly Rankings Generation

**Run every Tuesday at 2 AM EST** (after Monday Night Football)

```bash
# Generate for all leagues
for league_id in $(get_all_league_ids); do
  curl -X POST "...generate-power-rankings?league_id=$league_id&week=$week&season=$season"
done
```

### Season Awards Generation

**Run at end of regular season**

```bash
# Generate awards for all leagues
for league_id in $(get_all_league_ids); do
  # Call generateSeasonAwards via your frontend or edge function
done
```

---

## 7. Why This Drives Engagement

### Without Power Rankings
- Users only check scores
- No weekly anticipation
- Limited social sharing
- Boring regular season

### With Power Rankings
- Weekly "drop" creates routine
- Users debate rankings accuracy
- Share rankings on social media
- Compare with other leagues
- Creates rivalry and banter

### Without Season Awards
- Season ends anticlimactically
- No recognition for non-champions
- Limited offseason content

### With Season Awards
- Everyone gets recognition
- Creates offseason discussion
- Shareable achievement cards
- Drives league continuation
- Builds legacy and narrative

---

## 8. Future Enhancements

### Advanced Metrics
- Strength of schedule (real calculation)
- Luck factor (actual vs expected wins)
- Consistency score (week-to-week variance)
- Playoff probability integration

### Additional Awards
- Waiver Wizard (track pickup success)
- Unluckiest Team (points vs wins)
- Best Bench (bench points scored)
- Biggest Steal (late draft picks performance)
- Trade Deadline Winner (last-minute deals)

### Social Features
- League-wide award voting
- Fan favorite award
- Trash talk integration
- Weekly power ranking reactions
- Commissioner commentary

### Gamification
- Achievement badges
- Multi-season streaks
- Cross-league rankings
- Historical comparisons

---

## 9. API Reference

### Edge Functions

**generate-power-rankings**
- Method: POST
- Auth: None (public)
- Params: league_id, week, season
- Returns: { success, league_id, week, season, rankings }

**power-ranking-og-image**
- Method: GET
- Auth: None (public)
- Params: id (ranking uuid)
- Returns: SVG image

**award-og-image**
- Method: GET
- Auth: None (public)
- Params: id (award uuid)
- Returns: SVG image

### Frontend Functions

**generatePowerRankings(leagueId, week, season)**
- Generates and stores power rankings
- Returns: PowerRanking[]

**renderRankingReason(ranking, trend)**
- Creates human-readable explanation
- Returns: string

**generateSeasonAwards(leagueId, season)**
- Generates all season awards
- Returns: Award[]

---

## 10. Testing Checklist

- [ ] Generate rankings for test league
- [ ] Verify trend calculations
- [ ] Test reason generation for all scenarios
- [ ] Generate OG images for rankings
- [ ] Generate OG images for awards
- [ ] Create season awards at season end
- [ ] Verify social sharing meta tags
- [ ] Test ranking updates (idempotency)
- [ ] Verify RLS policies work correctly
- [ ] Test with multiple leagues
- [ ] Test with leagues of different sizes

---

## Summary

Power Rankings and Season Awards create **recurring engagement** and **social virality**. Users return weekly to check rankings, debate accuracy, and share results. Awards provide recognition and offseason content, keeping leagues active year-round.

The system uses real FDP data for credibility while presenting it in an entertaining, shareable format.
