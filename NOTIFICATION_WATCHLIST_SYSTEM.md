## Notification & Watchlist Intelligence System

## Overview

The **Notification & Watchlist Intelligence System** transforms Dynasty Dominator from an occasional-use tool into a **daily habit platform**. Instead of users checking the app randomly, they receive proactive, personalized alerts about opportunities before they happen.

**Key Innovation:** Smart, rate-limited notifications that inform without spamming. Free users get 5/day (only critical updates), premium users get 50/day (early access to opportunities).

## Philosophy

### Before (Tool)
```
User workflow:
1. User thinks "I should check player values"
2. User opens app
3. User manually searches for updates
4. User might miss opportunities

Result: Occasional engagement
```

### After (Platform)
```
System workflow:
1. System detects opportunity (buy low, value spike, etc.)
2. System evaluates if user cares (watching player, rate limit OK)
3. System sends targeted notification
4. User acts immediately

Result: Daily engagement, competitive advantage
```

## Core Principle

**Every notification must be:**
1. **Relevant** - User is watching the player OR it affects their team
2. **Actionable** - User can do something about it NOW
3. **Non-spammy** - Rate limited, collapsed similar alerts
4. **Valuable** - Worth interrupting the user

**Bad notification:** "Player values updated" (too generic)
**Good notification:** "Garrett Wilson Buy Low (85%) — Market hasn't adjusted to increased target share" (specific, actionable, timely)

## Architecture

### Data Flow

```
Event Occurs
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. Value Change / Advice Update / Role Change
    ↓
2. Evaluate Alert Triggers
    - Is anyone watching this player?
    - Does it meet threshold? (300+ value change)
    - Is it actionable?
    ↓
3. Check Rate Limits
    - Free: 5/day
    - Premium: 50/day
    ↓
4. Smart Filtering
    - Deduplicate (same alert in last hour?)
    - Collapse (3+ alerts → summary)
    ↓
5. Dispatch Alert
    - Store in database
    - Send push/email (if enabled)
    - Real-time update (Supabase subscriptions)
    ↓
6. User Receives Notification
    - Bell icon shows badge
    - Push notification (mobile)
    - Email digest (morning)
```

### Database Schema

**user_subscription**
```sql
CREATE TABLE user_subscription (
  user_id uuid PRIMARY KEY,
  tier text DEFAULT 'free',  -- 'free' or 'premium'
  started_at timestamptz,
  expires_at timestamptz
);
```

**user_watchlists** (extends existing)
```sql
-- Existing table structure
-- Links to watchlist_players
```

**user_notifications**
```sql
CREATE TABLE user_notifications (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL,
  type text NOT NULL,  -- value_change, advice_buy_low, etc.
  player_id text,      -- Sleeper player ID
  league_id uuid,      -- League-specific alerts
  title text NOT NULL,
  message text NOT NULL,
  priority text NOT NULL,  -- low, normal, high, critical
  metadata jsonb,
  read_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz DEFAULT now()
);
```

## Alert Types

### 1. Value Change Alerts

**Triggers:**
- `abs(value_change) >= 300` → normal priority
- `abs(value_change) >= 700` → high priority
- `abs(value_change) >= 1200` → critical priority

**Example:**
```
📈 Garrett Wilson Value Increased
Garrett Wilson value increased by 820 points (5600 → 6420)

Priority: High
Type: value_change
```

**Who receives:**
- Users watching Garrett Wilson
- Respects rate limits

### 2. Advice Engine Alerts

**Triggers:**
- New Buy Low detected (confidence >= 75%)
- New Sell High detected (confidence >= 75%)
- Breakout alert (confidence >= 70%, expires 72h)
- Waiver target appears
- Stash candidate identified (dynasty)
- Avoid warning (confidence >= 75%)

**Premium Feature:**
- Free users: Only breakouts
- Premium users: All advice alerts

**Example:**
```
🟢 Garrett Wilson Buy Low Opportunity
Market hasn't adjusted to increased target share

Confidence: 85%
Priority: High
Type: advice_buy_low
Expires: Never
```

### 3. Role Change Alerts

**Triggers:**
- Player promoted to starter
- Injury return detected
- Depth chart change

**Premium Feature:**
- Free users: Only starter promotions
- Premium users: All role changes

**Example:**
```
⭐ Roschon Johnson Role Change
Roschon Johnson: Backup → Starter. Starting RB role due to injury

Priority: High
Type: role_change
```

### 4. Waiver Upgrade Alerts (Premium)

**Triggers:**
- Better player available on waivers than roster starter
- League-aware (checks user's actual team)

**Example:**
```
➕ Waiver Upgrade Available
Roschon Johnson (2,400 value) available. Better than RB3: Dameon Pierce (1,800)

Priority: Normal
Type: waiver_upgrade
League: My Dynasty League
```

### 5. Trade Opportunity Alerts (Premium)

**Triggers:**
- Fair trade now available (within fairness threshold)
- Team strategy alignment detected

**Example:**
```
🤝 Trade Opportunity
Fair trade available with Team B. Send: RB depth, Receive: WR1 upgrade

Priority: Normal
Type: trade_opportunity
League: My Dynasty League
```

### 6. Daily Digest

**Triggers:**
- Runs every morning at 6 AM
- Only if user has updates

**Example:**
```
🌅 Your Daily Fantasy Report
5 updates: 2 Buy Lows, 1 Sell High, 1 Waiver Target, 1 Value Change

Priority: Normal
Type: daily_digest
```

**Content:**
- Summary of all updates for watched players
- Top opportunities
- Team-specific recommendations

## Smart Filtering (Anti-Spam)

### Rate Limiting

**Free Tier:**
- 5 alerts per day
- Only critical/high priority alerts
- Hourly batch processing

**Premium Tier:**
- 50 alerts per day
- All priority levels
- Near real-time delivery

**Implementation:**
```typescript
// Check before sending
const canReceive = await can_receive_notification(userId);

if (!canReceive) {
  // Respect limit
  return { skipped: true, reason: 'Rate limit exceeded' };
}
```

### Deduplication

**Window:** 60 minutes (configurable)

**Logic:**
```typescript
// Check for same alert in last hour
const isDuplicate = await checkDuplicate(trigger, windowMinutes: 60);

if (isDuplicate) {
  return { skipped: true, reason: 'Duplicate alert' };
}
```

**Example:**
- 10:00 AM: "Player X value increased +500"
- 10:30 AM: "Player X value increased +200" ← BLOCKED (same player, same type, within 60 minutes)

### Alert Collapsing

**Trigger:** 3+ alerts for same user in batch

**Result:** Single summary alert

**Example:**

**Before (spam):**
```
Notification 1: Garrett Wilson value +350
Notification 2: Breece Hall value -280
Notification 3: Drake London value +420
Notification 4: CeeDee Lamb value +150
```

**After (collapsed):**
```
📊 4 Updates for Your Watchlist
3 Value Changes, 1 Buy Low

[Collapsed details available in notification center]
```

## Component Libraries

### 1. Alert Trigger Evaluation

**File:** `src/lib/notifications/evaluateAlertTriggers.ts`

```typescript
// Evaluate value change triggers
evaluateValueChangeTriggers(events: ValueChangeEvent[]): AlertTrigger[]

// Evaluate advice triggers
evaluateAdviceTriggers(events: AdviceEvent[]): AlertTrigger[]

// Evaluate role change triggers
evaluateRoleChangeTriggers(events: RoleChangeEvent[]): AlertTrigger[]

// Evaluate waiver upgrades (league-aware)
evaluateWaiverUpgradeTriggers(userId, leagueId): AlertTrigger[]

// Evaluate trade opportunities (league-aware)
evaluateTradeOpportunityTriggers(userId, leagueId): AlertTrigger[]

// Batch evaluate all triggers
evaluateAllTriggersForUser(userId, options): AlertTrigger[]
```

**Key Features:**
- Checks watchlist for relevance
- Respects rate limits
- Applies priority logic
- Premium feature gating

### 2. Alert Dispatcher

**File:** `src/lib/notifications/dispatchAlerts.ts`

```typescript
// Dispatch single alert
dispatchAlert(trigger: AlertTrigger, options?: DispatchOptions): DispatchResult

// Batch dispatch with smart collapsing
batchDispatchAlerts(triggers: AlertTrigger[], options?: DispatchOptions): {
  dispatched: number,
  skipped: number,
  collapsed: number,
  errors: number
}

// Daily digest dispatcher
dispatchDailyDigest(userId, summary): DispatchResult

// Mark alert as read
markAlertRead(alertId, userId): boolean

// Get unread count
getUnreadCount(userId): number
```

**Delivery Channels:**
- In-app (always)
- Email (critical + daily digest)
- Push (future)

**Priority Handling:**
- Critical → immediate
- High → near real-time
- Normal/Low → batched

### 3. Daily Digest Generator

**File:** `src/lib/notifications/generateDailyDigest.ts`

```typescript
// Generate digest for single user
generateUserDailyDigest(userId): DigestSummary | null

// Generate for all active users
generateAllDailyDigests(): {
  total: number,
  sent: number,
  skipped: number,
  errors: number
}

// Get digest preview (for UI)
getDigestPreview(userId): DigestSummary | null

// Schedule daily generation
scheduleDailyDigest(): void
```

**Digest Content:**
```typescript
interface DigestSummary {
  buyLows: number;
  sellHighs: number;
  breakouts: number;
  waiverTargets: number;
  valueChanges: number;
  teamAlerts: number;
  topOpportunities: Array<{
    type: string;
    playerName: string;
    message: string;
  }>;
}
```

### 4. Notifications API

**File:** `src/lib/notifications/notificationsApi.ts`

```typescript
// Get user notifications
getNotifications(options: {
  userId: string,
  unreadOnly?: boolean,
  limit?: number
}): Notification[]

// Get unread count
getUnreadCount(userId): number

// Mark notification as read
markNotificationRead(notificationId, userId): boolean

// Mark all as read
markAllNotificationsRead(userId): number

// Watchlist management
addToWatchlist(userId, playerId, leagueId?): boolean
removeFromWatchlist(userId, playerId): boolean
isInWatchlist(userId, playerId): boolean
getWatchlistPlayers(userId): WatchlistPlayer[]

// Real-time subscriptions
subscribeToNotifications(userId, callback): UnsubscribeFn
```

## UI Components

### 1. Notification Bell

**Component:** `src/components/NotificationBell.tsx`

**Purpose:** Header notification icon with dropdown

**Features:**
- Unread count badge
- Recent notifications dropdown
- Real-time updates
- Mark as read functionality
- Link to full notification center

**Display:**
```
[🔔 3]  ← Badge shows unread count

Dropdown:
┌────────────────────────────────────┐
│ Notifications            [Mark all]│
│ 3 unread                           │
├────────────────────────────────────┤
│ • 📈 Garrett Wilson Value +820     │
│   2h ago                    [Read] │
├────────────────────────────────────┤
│ • 🟢 Buy Low: Breece Hall          │
│   5h ago                    [Read] │
├────────────────────────────────────┤
│   🌅 Your Daily Report             │
│   Yesterday                 [Read] │
├────────────────────────────────────┤
│          View all notifications    │
└────────────────────────────────────┘
```

**Integration:**
```tsx
// Add to header/navigation
import { NotificationBell } from './components/NotificationBell';

<header>
  <nav>
    {/* ... other nav items ... */}
    <NotificationBell />
  </nav>
</header>
```

### 2. Watchlist Star

**Component:** `src/components/WatchlistStar.tsx`

**Purpose:** Toggle button to watch/unwatch players

**Features:**
- Filled star = watching
- Outline star = not watching
- Click to toggle
- Toast notification on change

**Display:**
```
[⭐] ← Watching (filled)
[☆]  ← Not watching (outline)
```

**Integration:**
```tsx
// Add to player cards/details
import { WatchlistStar } from './components/WatchlistStar';

<div className="player-card">
  <h3>{player.name}</h3>
  <WatchlistStar
    playerId={player.id}
    playerName={player.name}
    size="md"
    showLabel={false}
  />
</div>
```

### 3. Notification Center

**Component:** `src/components/NotificationCenter.tsx`

**Purpose:** Full-page notification management

**Features:**
- Search notifications
- Filter by priority/unread
- Group by Team/Watched/Market
- Bulk actions (mark all read)
- Detailed notification views

**Display:**
```
Notifications
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
15 unread                [Mark all read]

[Search...] [All][Team][Watched][Market]
[All Priority ▼] [Unread]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Watched Players (8 notifications)

• 📈 Garrett Wilson Value Increased
  Market hasn't adjusted to target share
  2 hours ago • [MARK READ]

• 🟢 Buy Low: Breece Hall
  Post-injury discount opportunity
  5 hours ago • [MARK READ]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Team Alerts (3 notifications)

• ➕ Waiver Upgrade Available
  Better RB available than roster starter
  My Dynasty League • 1 day ago
```

**Routes:**
```tsx
// Add route
import { NotificationCenter } from './components/NotificationCenter';

<Route path="/notifications" element={<NotificationCenter />} />
```

## Integration Examples

### 1. Daily Value Sync Job

**Scenario:** Nightly value sync completes

```typescript
// After sync, detect changes
import { evaluateValueChangeTriggers } from './lib/notifications/evaluateAlertTriggers';
import { batchDispatchAlerts } from './lib/notifications/dispatchAlerts';

// Get value changes from last 24h
const changes: ValueChangeEvent[] = await getValueChanges();

// Evaluate triggers
const triggers = await evaluateValueChangeTriggers(changes);

// Dispatch alerts
const result = await batchDispatchAlerts(triggers);

console.log(`Sent ${result.dispatched} alerts, collapsed ${result.collapsed}`);
```

### 2. Advice Engine Integration

**Scenario:** Daily advice generation completes

```typescript
import { evaluateAdviceTriggers } from './lib/notifications/evaluateAlertTriggers';
import { batchDispatchAlerts } from './lib/notifications/dispatchAlerts';

// Get new advice from today
const newAdvice: AdviceEvent[] = await getTodaysAdvice();

// Evaluate triggers
const triggers = await evaluateAdviceTriggers(newAdvice);

// Dispatch alerts (respects premium gating)
await batchDispatchAlerts(triggers);
```

### 3. Daily Digest Generation

**Scenario:** Morning digest job (6 AM cron)

```typescript
import { generateAllDailyDigests } from './lib/notifications/generateDailyDigest';

// Cron job: 0 6 * * * (6 AM daily)
export async function dailyDigestCron() {
  const result = await generateAllDailyDigests();

  console.log(`
Daily Digest Results:
- Total users: ${result.total}
- Digests sent: ${result.sent}
- Skipped (no updates): ${result.skipped}
- Errors: ${result.errors}
  `);
}
```

## Premium vs Free Features

### Free Tier

**Limits:**
- 5 alerts per day
- Only critical/high priority
- Hourly batch processing
- No early access alerts

**Alerts Available:**
- Value changes (700+ only)
- Breakout alerts
- Role changes (starter promotions only)
- Daily digest

**Experience:**
```
User gets:
- Critical opportunities only
- Prevents missing breakouts
- Basic value tracking
- Morning summary
```

### Premium Tier

**Limits:**
- 50 alerts per day
- All priority levels
- Near real-time delivery
- Early access to opportunities

**Alerts Available:**
- All value changes (300+)
- Buy Low opportunities (premium early access)
- Sell High alerts (premium early access)
- All role changes
- Waiver upgrades (league-aware)
- Trade opportunities (league-aware)
- Stash candidates
- Avoid warnings
- Daily digest

**Experience:**
```
User gets:
- Comprehensive opportunity tracking
- Act before market adjusts
- League-specific recommendations
- Competitive advantage
```

## Cron Jobs

### 1. Daily Digest (6 AM)

**Schedule:** `0 6 * * *`

**Purpose:** Morning report for all users

**Implementation:**
```typescript
import { generateAllDailyDigests } from './lib/notifications/generateDailyDigest';

export async function dailyDigestJob() {
  await generateAllDailyDigests();
}
```

### 2. Hourly Alert Batch (Free Users)

**Schedule:** `0 * * * *`

**Purpose:** Process pending alerts for free users

**Implementation:**
```typescript
export async function hourlyAlertBatch() {
  // Free users get batched alerts
  // Premium users get real-time
}
```

### 3. Cleanup Expired Notifications

**Schedule:** `0 0 * * *` (midnight)

**Purpose:** Delete old read notifications

**Implementation:**
```typescript
export async function cleanupNotifications() {
  // Delete read notifications older than 30 days
  await supabase
    .from('user_notifications')
    .delete()
    .not('read_at', 'is', null)
    .lt('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000));
}
```

## Engagement Metrics

### Key Metrics to Track

1. **Daily Active Users (DAU)**
   - Users who check notifications daily
   - Target: 50%+ of users with watchlists

2. **Notification Open Rate**
   - % of notifications clicked/read
   - Target: 60%+ (indicates relevance)

3. **Action Rate**
   - % of notifications that lead to action (view player, make trade)
   - Target: 30%+

4. **Watchlist Growth**
   - Average players watched per user
   - Target: 8-15 players

5. **Premium Conversion**
   - Users who upgrade after hitting free limit
   - Target: 15%+

6. **Retention Impact**
   - Day 7 retention: Users with notifications vs without
   - Expected: 2-3x higher

### Sample Cohort Analysis

```
Week 1:
- 1,000 users sign up
- 600 add players to watchlist (60%)
- 400 receive at least 1 notification

Week 2:
- Users with notifications: 320 return (80% retention)
- Users without notifications: 280 return (47% retention)
- Lift: +70% retention from notifications

Week 4:
- Notification users: 240 active (60% 4-week retention)
- Non-notification users: 150 active (25% 4-week retention)
- Lift: +140% retention from notifications
```

## Benefits

### For Users

**Competitive Advantage:**
- Act on opportunities before market adjusts
- Never miss a breakout alert
- Get waiver targets before others

**Time Savings:**
- No need to manually check for updates
- Curated opportunities delivered daily
- Focus on decisions, not research

**Daily Habits:**
- Morning digest creates routine
- Real-time alerts create urgency
- Watchlist creates personal connection

### For Product

**Engagement:**
- Daily return visits (digest)
- Multiple daily touches (real-time alerts)
- Increased time in app

**Retention:**
- Users rely on alerts
- FOMO prevents churn
- Watchlists create investment

**Monetization:**
- Clear premium value (50 vs 5 alerts/day)
- Early access creates urgency
- League-aware features justify upgrade

**Differentiation:**
- Only calculator with proactive alerts
- Transforms tool → platform
- Creates daily engagement loop

## Summary

The **Notification & Watchlist Intelligence System** completes Dynasty Dominator's evolution from occasional tool to daily habit platform.

**Key Innovation:** Smart, rate-limited notifications that inform without spamming, with clear free vs premium tiers.

**Core Value:** Users no longer ask "Should I check the app?" Instead, the app tells them "Here's what you need to know NOW."

**Files Created:**
- `src/lib/notifications/evaluateAlertTriggers.ts` - Alert evaluation logic
- `src/lib/notifications/dispatchAlerts.ts` - Smart delivery with filtering
- `src/lib/notifications/generateDailyDigest.ts` - Morning digest generator
- `src/lib/notifications/notificationsApi.ts` - Client API helpers
- `src/components/NotificationBell.tsx` - Header notification icon
- `src/components/WatchlistStar.tsx` - Player watch toggle
- `src/components/NotificationCenter.tsx` - Full notification management

**Database:**
- `user_subscription` - Premium tier tracking
- `user_notifications` - All alerts
- Helper functions for rate limiting and counts

**Result:** Dynasty Dominator transforms from "tool I check occasionally" to "platform I rely on daily" - creating retention through value delivery.
