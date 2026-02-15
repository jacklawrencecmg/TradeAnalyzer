# Beta Feedback & Weekly Reports System

## Overview

Two powerful features to improve user engagement and enable rapid iteration after launch:

1. **Feedback Collection System** - Capture bugs, value complaints, and feature requests
2. **Weekly Team Reports** - Personalized summaries that build user habits

---

## 1. Feedback Collection System

### User-Facing Features

**Floating Feedback Button**
- Appears on all pages (bottom right corner)
- Opens modal for submitting feedback
- Blue circular button with message icon

**Feedback Types**
- Bug reports
- Wrong player values
- Confusing UI/UX
- Feature requests
- Other feedback

**Auto-Captured Context**
- Current page URL
- Player details (if on player page)
- Trade details (if on trade page)
- League context
- Value epoch
- Browser info
- Timestamp

**Quick Reactions**
- Thumbs up/down on trade results
- Thumbs up/down on advice cards
- Thumbs up/down on rankings
- Minimal friction - one click

### Admin Features

**Feedback Dashboard** (`/admin/feedback`)
- View all feedback sorted by type/status
- Filter by: all, open, bugs, wrong values
- Stats overview (total, open, bugs, value complaints)
- Click to see full details
- Update status: fixed, in progress, won't fix, duplicate
- Add admin notes

**Weekly Feedback Summary**
- Runs via edge function: `generate-feedback-summary`
- Call: `POST /functions/v1/generate-feedback-summary?days=7`
- Outputs:
  - Top complained pages
  - Most reported players (value issues)
  - Most confusing pages
  - Top feature requests
  - Reaction statistics

### Database Schema

```sql
user_feedback
- id: uuid
- user_id: uuid (nullable - allows anonymous)
- league_id: uuid (nullable)
- page: text (current page)
- type: bug | wrong_value | confusing | feature | other | reaction
- message: text
- metadata: jsonb (auto-captured context)
- created_at: timestamptz
- status: open | in_progress | fixed | wont_fix | duplicate
- admin_notes: text
```

### Integration Points

**Components Using Quick Reactions**
- Add to TradeAnalyzer results
- Add to TeamAdvice cards
- Add to UnifiedRankings
- Add to any confidence scores

Example:
```tsx
import { QuickReaction } from './QuickReaction';

<QuickReaction
  contentType="trade"
  contentId={tradeId}
  metadata={{ players, values }}
/>
```

---

## 2. Weekly Team Reports System

### User-Facing Features

**Weekly Report Widget**
- Shows latest weekly report on dashboard
- Summary of team performance
- Value change indicator
- Strengths and weaknesses
- Recommended moves
- Quick reaction buttons
- Link to view all reports

**Team Reports History** (`/team/reports`)
- Chronological list of all reports
- Click to expand full details
- Shows week, summary, value change
- Track team progress over time

### Report Contents

Each weekly report includes:

**Summary**
- Plain English explanation of team status
- Value change direction
- Position strength/weakness summary

**Strengths**
- Positions with good depth
- Top players in each position
- Reasons for strength rating

**Weaknesses**
- Positions lacking depth
- Areas needing improvement
- Specific suggestions

**Recommended Moves**
- Trade suggestions
- Waiver targets
- Lineup changes
- Priority indicators

**Missed Opportunities** (future)
- Bench players that outscored starters
- Ignored waiver suggestions
- Declined trades that became favorable

### Generation Logic

**Edge Function**: `cron-generate-weekly-reports`

Runs once per week after games finish:
```bash
POST /functions/v1/cron-generate-weekly-reports?week=1&season=2025
```

**Analysis Process**
1. Calculate total roster value change
2. Analyze position strength vs league average
3. Detect injuries and status changes
4. Compare starter vs bench performance
5. Generate recommendations from advice engine

**Frontend Generation**
```ts
import { generateWeeklyTeamReport } from './lib/reports/generateWeeklyTeamReport';

const report = await generateWeeklyTeamReport(
  userId,
  leagueId,
  week,
  season
);
```

### Database Schema

```sql
weekly_team_reports
- id: uuid
- user_id: uuid
- league_id: uuid
- week: int
- season: int
- summary: text (human readable)
- strengths: jsonb[]
- weaknesses: jsonb[]
- missed_moves: jsonb[]
- recommended_moves: jsonb[]
- value_change: numeric
- created_at: timestamptz
- UNIQUE(user_id, league_id, week, season)
```

---

## Usage

### For Users

**Submit Feedback**
1. Click blue feedback button (bottom right)
2. Select feedback type
3. Describe what you were trying to do
4. Explain what went wrong
5. Check "value looks wrong" if applicable
6. Submit

**View Weekly Report**
1. Go to dashboard
2. See latest report in widget
3. Click "View All Reports" for history
4. React with thumbs up/down

### For Admins

**Review Feedback**
1. Navigate to `/admin/feedback`
2. Filter by type or status
3. Click feedback to see details
4. Add notes and update status
5. Mark as fixed when resolved

**Generate Weekly Summary**
```bash
curl -X POST https://your-project.supabase.co/functions/v1/generate-feedback-summary?days=7 \
  -H "Authorization: Bearer YOUR_ANON_KEY"
```

**Generate Weekly Reports**
```bash
curl -X POST https://your-project.supabase.co/functions/v1/cron-generate-weekly-reports?week=1&season=2025 \
  -H "Authorization: Bearer YOUR_ANON_KEY"
```

---

## Why This Matters

### Without Feedback
- You guess what users need
- Value complaints go unheard
- No data on confusing features
- Slow iteration cycles

### With Feedback
- Users tell you exactly what's wrong
- Prioritize fixes by frequency
- Track which players need value corrections
- Rapid improvement cycles

### Without Weekly Reports
- Users check app sporadically
- No habit formation
- Low engagement

### With Weekly Reports
- Users return weekly for their report
- Builds attachment to the app
- Feels like personal team management
- Creates anticipation and routine

---

## Components Reference

### Feedback System
- `FeedbackButton` - Floating button on all pages
- `FeedbackModal` - Form for submitting feedback
- `QuickReaction` - Thumbs up/down component
- `FeedbackDashboard` - Admin review interface

### Weekly Reports
- `WeeklyReportWidget` - Dashboard widget showing latest report
- `TeamReportsHistory` - Full history page
- `generateWeeklyTeamReport()` - Generation function
- `generateFeedbackSummary()` - Summary generator

### Edge Functions
- `cron-generate-weekly-reports` - Generate all reports
- `generate-feedback-summary` - Weekly feedback analysis

---

## Next Steps

1. Add to Dashboard: Include `<WeeklyReportWidget />` in main dashboard
2. Schedule Cron: Set up weekly cron job for report generation
3. Email Notifications: Add email delivery for weekly reports
4. Push Notifications: Mobile notifications for new reports
5. Missed Moves Detection: Track actual vs suggested actions
6. Advanced Analytics: ML-powered insights in reports
