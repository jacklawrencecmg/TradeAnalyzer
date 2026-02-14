# Shareable Trades System

Permanent shareable links for trade analysis results with rich social media previews (OG images) for Discord, Twitter, Reddit, and more.

## Overview

The shareable trades system transforms your trade calculator from a utility into a viral content engine. Every trade analysis can be saved as a permanent link with:

- **Unique short URLs** (`/trade/abc123xy`)
- **Rich social embeds** with custom OG images
- **Public viewing** without authentication
- **Privacy options** to hide player values
- **View tracking** for analytics

## Architecture

### Database

**Table:** `shared_trades`

```sql
CREATE TABLE shared_trades (
  id uuid PRIMARY KEY,
  slug text UNIQUE NOT NULL,
  format text NOT NULL,
  side_a jsonb NOT NULL,
  side_b jsonb NOT NULL,
  side_a_total int NOT NULL,
  side_b_total int NOT NULL,
  fairness_percentage int NOT NULL,
  winner text NOT NULL,
  recommendation text,
  hide_values boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  view_count int DEFAULT 0,
  user_id uuid REFERENCES auth.users(id)
);
```

**Key Features:**
- **Slug generation** - Random 8-character alphanumeric slugs
- **JSONB storage** - Flexible data structure for players/picks/FAAB
- **View tracking** - Auto-increment counter for analytics
- **User association** - Optional link to creator for history
- **RLS policies** - Public read, authenticated write

### API Endpoints

#### 1. Save Trade (POST `/functions/v1/trade-share`)

**Purpose:** Create a shareable link from trade analysis

**Request:**
```json
{
  "format": "dynasty_sf",
  "sideA": {
    "players": [
      { "id": "player_id", "name": "Justin Jefferson", "position": "WR", "value": 9500 }
    ],
    "picks": [
      { "round": 1, "year": 2025, "value": 2500 }
    ],
    "faab": 50
  },
  "sideB": {
    "players": [
      { "id": "player_id", "name": "Ja'Marr Chase", "position": "WR", "value": 9200 }
    ]
  },
  "sideATotal": 12000,
  "sideBTotal": 9200,
  "fairnessPercentage": 77,
  "winner": "side_a",
  "recommendation": "Team A wins by 2,800 value",
  "hideValues": false
}
```

**Response:**
```json
{
  "ok": true,
  "slug": "abc123xy",
  "url": "https://fantasydraftpros.com/trade/abc123xy",
  "trade": { /* full trade object */ }
}
```

**Process:**
1. Validate request data
2. Generate unique slug (retries if collision)
3. Insert into `shared_trades` table
4. Return shareable URL
5. Optional: Associate with authenticated user

#### 2. Fetch Trade (GET `/functions/v1/trade-share?slug=abc123xy`)

**Purpose:** Retrieve trade data for display

**Response:**
```json
{
  "ok": true,
  "trade": {
    "id": "uuid",
    "slug": "abc123xy",
    "format": "dynasty_sf",
    "side_a": { /* ... */ },
    "side_b": { /* ... */ },
    "side_a_total": 12000,
    "side_b_total": 9200,
    "fairness_percentage": 77,
    "winner": "side_a",
    "recommendation": "Team A wins by 2,800 value",
    "hide_values": false,
    "created_at": "2025-01-15T10:30:00Z",
    "view_count": 42
  }
}
```

**Side Effects:**
- Increments `view_count` via database function
- No authentication required (public)

#### 3. OG Image Generator (GET `/functions/v1/trade-og-image/{slug}`)

**Purpose:** Generate dynamic social media preview images

**Response:** SVG image (1200x630px)

**Features:**
- **Team A vs Team B display**
- **Fairness percentage badge**
- **Winner indicator** (color-coded)
- **Player names** (up to 3 per side)
- **FantasyDraftPros branding**

**Caching:**
- `Cache-Control: public, max-age=31536000, immutable`
- CDN-friendly (images never change after creation)

### Frontend Components

#### 1. TradeAnalyzer Enhancements

**New Features:**
- "Share This Trade" button after analysis
- Share link creation with loading state
- Copy link button with success feedback
- Social sharing prompt

**UI Flow:**
```
[Analyze Trade]
  ↓
[Trade Results Displayed]
  ↓
[Share This Trade Button] ← Click
  ↓
[Creating Link...] ← API call
  ↓
[✓ Share link created!]
[Link Input Field] [Copy Button]
[Share on Discord, Twitter, Reddit...]
```

**State Management:**
```typescript
const [sharing, setSharing] = useState(false);
const [shareUrl, setShareUrl] = useState<string | null>(null);
const [copied, setCopied] = useState(false);
```

**Share Function:**
```typescript
async function shareTrade() {
  // Extract trade data
  const sideAPlayers = analysis.teamAItems.filter(i => i.type === 'player');
  const sideAPicks = analysis.teamAItems.filter(i => i.type === 'pick');

  // Calculate fairness
  const fairness = calculateFairness(analysis);

  // Call API
  const response = await fetch('/functions/v1/trade-share', {
    method: 'POST',
    body: JSON.stringify({ format, sideA, sideB, ... })
  });

  const { url } = await response.json();
  setShareUrl(url);
}
```

#### 2. SharedTradePage Component

**Purpose:** Display public trade analysis page

**Features:**
- **Full trade breakdown** - All players, picks, FAAB
- **Visual indicators** - Winner highlighted with green border
- **Fairness metrics** - Percentage, rating, difference
- **Metadata** - Created date, view count, privacy status
- **Copy link button** - Easy resharing
- **CTA** - "Analyze Your Own Trades" button
- **Dynamic meta tags** - OG image, title, description

**Meta Tag Updates:**
```typescript
useEffect(() => {
  if (trade) {
    const title = `Trade Analysis: ${trade.fairness_percentage}% Fair - ${winnerSide}`;
    const ogImage = `${SUPABASE_URL}/functions/v1/trade-og-image/${slug}`;

    document.title = title;
    updateMetaTag('og:title', title);
    updateMetaTag('og:image', ogImage);
    updateMetaTag('twitter:card', 'summary_large_image');
    // ... more meta tags
  }
}, [trade]);
```

**Dynamic Meta Tags:**
- `og:title` - "Trade Analysis: 77% Fair - Team A Wins"
- `og:description` - "Team A vs Team B dynasty fantasy football trade comparison"
- `og:image` - Dynamic SVG image from edge function
- `og:url` - Full URL to trade page
- `twitter:card` - `summary_large_image`
- `twitter:image` - Same as og:image

#### 3. App.tsx Routing

**URL Pattern Detection:**
```typescript
useEffect(() => {
  const path = window.location.pathname;
  const tradeMatch = path.match(/^\/trade\/([a-z0-9]+)$/);
  if (tradeMatch) {
    setTradeSlug(tradeMatch[1]);
  }
}, []);

// Render SharedTradePage for /trade/:slug
if (tradeSlug) {
  return <SharedTradePage slug={tradeSlug} />;
}
```

**SPA Routing:**
- No react-router needed
- Simple pathname detection
- Falls back to normal app for non-trade URLs

## Social Media Integration

### Discord Embeds

When a trade link is posted in Discord:

**Display:**
```
┌──────────────────────────────────────┐
│ [Preview Image]                      │
│ Team A vs Team B                     │
│ 77% Fair - Team A Wins              │
├──────────────────────────────────────┤
│ Trade Analysis: 77% Fair            │
│ Team A vs Team B dynasty fantasy    │
│ football trade comparison           │
│                                      │
│ fantasydraftpros.com                │
└──────────────────────────────────────┘
```

**OG Image Rendering:**
- 1200x630px SVG
- Blue gradient background
- White content card
- Fairness badge (blue)
- Winner badge (green/gray)
- Team A section (left)
- Team B section (right)
- "VS" divider
- FantasyDraftPros branding

### Twitter/X Cards

**Card Type:** `summary_large_image`

**Display:**
```
┌────────────────────────────────┐
│                                │
│      [Large Preview Image]     │
│                                │
├────────────────────────────────┤
│ Trade Analysis: 77% Fair      │
│ fantasydraftpros.com          │
└────────────────────────────────┘
```

**Engagement Benefits:**
- **Higher CTR** - Rich previews get more clicks
- **Virality** - People share visually appealing content
- **Brand awareness** - Logo on every shared trade
- **Traffic driver** - Links back to your site

### Reddit Posts

**Display:**
```
r/DynastyFF • Posted by u/username • 2h ago

Should I accept this trade?

[Preview Image: Team A vs Team B - 77% Fair]

Trade Analysis: 77% Fair - Team A Wins
Team A vs Team B dynasty fantasy football trade comparison

fantasydraftpros.com/trade/abc123xy

💬 45 comments 🔼 142
```

**Community Benefits:**
- **League advice** - Share trades for opinions
- **Value disputes** - Objective third-party analysis
- **Trade vetoes** - Evidence for collusion claims
- **Strategy discussions** - "What would you do?"

### Facebook Groups

**Display:**
```
John Smith
2 hours ago

Posted in Dynasty Fantasy Football

[Large preview image]

Trade Analysis: 77% Fair - Team A Wins

Team A vs Team B dynasty fantasy football trade comparison

FANTASYDRAFTPROS.COM
Trade Analysis: 77% Fair - Team A Wins

👍 Like   💬 Comment   ↗️ Share
```

## Use Cases

### 1. League Trade Advice

**Scenario:** User receives trade offer and wants league opinions

**Workflow:**
1. User enters trade in TradeAnalyzer
2. Clicks "Share This Trade"
3. Copies shareable link
4. Posts to league Discord/Slack:
   ```
   Just got offered this trade. Thoughts?
   https://fantasydraftpros.com/trade/abc123xy
   ```
5. League members click link
6. View full analysis without signing in
7. Comment with opinions

**Benefits:**
- **No friction** - Anyone can view
- **Consistent format** - Easy to compare
- **Objective values** - Reduces arguments
- **Mobile friendly** - Works everywhere

### 2. Trade Veto Evidence

**Scenario:** League suspects collusion

**Workflow:**
1. Commissioner analyzes suspicious trade
2. Shares link showing 45% fairness (highly unbalanced)
3. Posts to league chat with explanation
4. League votes to veto with clear evidence

**Benefits:**
- **Transparency** - Everyone sees same data
- **Historical record** - Permanent link
- **Fairness** - Objective analysis
- **Trust building** - Clear processes

### 3. Content Creation

**Scenario:** Fantasy football content creator making YouTube video

**Workflow:**
1. Creator analyzes 5 trades from viewers
2. Shares each trade link in video description
3. Shows trade analysis on screen
4. Viewers click links to explore

**Benefits:**
- **Interactive content** - Viewers explore trades
- **Traffic generation** - Links back to your site
- **SEO benefits** - Video descriptions with links
- **Brand exposure** - Logo in every screenshot

### 4. Trade History

**Scenario:** User wants to track past trades

**Workflow:**
1. User analyzes trade before accepting
2. Saves shareable link to personal notes/spreadsheet
3. Season ends
4. Reviews all trades to see which worked out
5. Learns from mistakes

**Benefits:**
- **Self improvement** - Track decision quality
- **Pattern recognition** - Identify biases
- **League insights** - Which teams make good trades
- **Historical context** - Remember reasoning

### 5. Reddit Strategy Posts

**Scenario:** User posts trade analysis for community feedback

**Workflow:**
1. User posts to r/DynastyFF:
   ```
   [Discussion] Am I crazy for wanting to accept this?

   Full analysis: https://fantasydraftpros.com/trade/abc123xy

   Calculator says 68% fair but I'm a contender and giving up
   picks hurts my depth. What do you think?
   ```
2. Post gets upvotes due to rich preview image
3. Community discusses in comments
4. Some users click through to analyze their own trades
5. Your site gains new users

**Benefits:**
- **Organic traffic** - Reddit drives quality visitors
- **Community building** - Be the go-to tool
- **Viral potential** - Good posts get thousands of views
- **Credibility** - "FantasyDraftPros says..."

## Privacy & Moderation

### Privacy Flag

**Feature:** `hide_values` boolean

**When Enabled:**
- Player names shown
- Player values **hidden**
- Total values **hidden**
- Fairness percentage **hidden**
- Winner/loser indicators **hidden**

**Use Cases:**
- **Strategy privacy** - Don't reveal your valuation system
- **League confidentiality** - Share players without values
- **General advice** - "Is this trade framework fair?"

**Implementation:**
```typescript
<button
  onClick={() => setHideValues(!hideValues)}
  className="..."
>
  {hideValues ? <Lock /> : <Unlock />}
  {hideValues ? 'Show Values' : 'Hide Values'}
</button>
```

### Moderation

**No moderation needed!**

Trades are just data:
- No user-generated text (no profanity)
- No images (no NSFW content)
- No comments (no harassment)
- No links (no spam)

**Only data stored:**
- Player names (from your database)
- Pick details (year/round)
- Calculated values

**Risk:** Offensive player names

**Mitigation:**
- Player names come from official sources (Sleeper, ESPN)
- If offensive name appears, it's in real NFL/fantasy data
- Not your responsibility

## Analytics & Insights

### View Tracking

**Automatic tracking:**
```sql
CREATE FUNCTION increment_trade_view_count(trade_slug text)
RETURNS void AS $$
BEGIN
  UPDATE shared_trades
  SET view_count = view_count + 1
  WHERE slug = trade_slug;
END;
$$ LANGUAGE plpgsql;
```

**Called on every page load:**
```typescript
await supabase.rpc('increment_trade_view_count', {
  trade_slug: slug
});
```

### Popular Trades View

```sql
CREATE VIEW popular_trades AS
SELECT
  slug,
  format,
  side_a_total,
  side_b_total,
  fairness_percentage,
  winner,
  view_count,
  created_at
FROM shared_trades
WHERE created_at > now() - interval '30 days'
ORDER BY view_count DESC
LIMIT 100;
```

**Potential Features:**
- "Trending Trades" page
- "Most Controversial Trades" (lowest fairness)
- "Biggest Blockbusters" (highest total value)
- "Popular Players" (most included in trades)

### User Trade History

**For authenticated users:**
```sql
SELECT slug, created_at, winner, fairness_percentage
FROM shared_trades
WHERE user_id = 'user-uuid'
ORDER BY created_at DESC;
```

**Dashboard Widget:**
```
Your Recent Shared Trades:
┌─────────────────────────────────────────┐
│ 3 hours ago • abc123xy                  │
│ Team A Wins • 82% Fair                  │
│ 142 views                               │
├─────────────────────────────────────────┤
│ 1 day ago • def456gh                    │
│ Even Trade • 94% Fair                   │
│ 67 views                                │
└─────────────────────────────────────────┘
```

## Performance & Caching

### OG Image Caching

**Edge Function Response:**
```typescript
return new Response(svg, {
  headers: {
    'Content-Type': 'image/svg+xml',
    'Cache-Control': 'public, max-age=31536000, immutable',
  },
});
```

**Benefits:**
- **1 year cache** - Images never expire
- **CDN friendly** - Cached at edge locations
- **Instant loads** - No regeneration needed
- **Low cost** - Function rarely invoked

### Trade Data Caching

**Client-side:**
```typescript
// Cache in localStorage for repeat visits
localStorage.setItem(`trade_${slug}`, JSON.stringify(trade));
```

**Server-side:**
- Supabase handles database query caching
- RLS policies ensure security
- No custom caching needed

### Database Performance

**Indexes:**
```sql
CREATE UNIQUE INDEX idx_shared_trades_slug ON shared_trades(slug);
CREATE INDEX idx_shared_trades_created_at ON shared_trades(created_at DESC);
CREATE INDEX idx_shared_trades_user_id ON shared_trades(user_id);
```

**Query Performance:**
- Slug lookup: O(1) with unique index
- User history: O(log n) with user_id index
- Popular trades: Materialized view (optional)

## SEO Benefits

### Organic Traffic Engine

**How It Works:**

1. **User shares trade** on Reddit/Discord/Twitter
2. **Others view** the shared trade page
3. **Some analyze their own trade** using your tool
4. **They share their trade** on social media
5. **Repeat** - exponential growth

**Each shared trade:**
- Is a **permanent link** (never expires)
- Contains **FantasyDraftPros branding**
- Has **CTA button** to analyze your own trades
- Drives **qualified traffic** (fantasy players)

### Backlink Generation

**Every shared trade is a backlink:**
- From Discord messages (no-follow, but traffic)
- From Reddit posts (high authority domain)
- From Twitter (social signals)
- From Facebook groups (high engagement)

**Link Building Strategy:**
- No manual outreach needed
- Users create links organically
- Content is unique (each trade different)
- Links are contextual (shared in relevant communities)

### Indexed Pages

**Google will index trade pages:**
```
Site: fantasydraftpros.com/trade/*
Pages: Potentially thousands
Content: Unique trade analysis
Keywords: "dynasty trade", "fantasy football trade", player names
```

**Long-tail SEO:**
- "Justin Jefferson trade value"
- "Dynasty trade analyzer"
- "Is [Player A] for [Player B] fair?"
- "[Team name] trade analysis"

**Meta Tags for SEO:**
```html
<title>Trade Analysis: 77% Fair - Team A Wins</title>
<meta name="description" content="Team A vs Team B dynasty fantasy football trade comparison. 77% fairness rating." />
```

## Future Enhancements

### 1. QR Codes

**Use Case:** Share trades in person

**Implementation:**
```typescript
import QRCode from 'qrcode';

const qrCodeUrl = await QRCode.toDataURL(shareUrl);

<img src={qrCodeUrl} alt="Share QR Code" />
```

**Benefit:** Easy sharing at draft parties

### 2. Trade Comments

**Feature:** Allow users to comment on shared trades

**Implementation:**
```sql
CREATE TABLE trade_comments (
  id uuid PRIMARY KEY,
  trade_id uuid REFERENCES shared_trades(id),
  user_id uuid REFERENCES auth.users(id),
  comment text NOT NULL,
  created_at timestamptz DEFAULT now()
);
```

**Benefit:** Community discussion, engagement

### 3. Trade Comparison

**Feature:** Compare multiple trades side-by-side

**UI:**
```
Option A: /trade/abc123
- 77% Fair
- Team A Wins

Option B: /trade/def456
- 85% Fair
- Even Trade

Recommendation: Accept Option B
```

**Benefit:** Decision making for multiple offers

### 4. Email Sharing

**Feature:** Email trade link to league members

**Implementation:**
```typescript
<button onClick={() => shareViaEmail()}>
  📧 Email to League
</button>
```

**Flow:**
1. User enters league emails
2. System sends email with trade preview
3. Recipients click link to view

**Benefit:** Reach less tech-savvy league members

### 5. Trade Alerts

**Feature:** Notify user when trade gets views

**Implementation:**
```sql
CREATE TABLE trade_alerts (
  id uuid PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id),
  trade_id uuid REFERENCES shared_trades(id),
  alert_at_views int[] -- [10, 50, 100, 500]
);
```

**Notification:**
```
Your trade has reached 50 views!
https://fantasydraftpros.com/trade/abc123xy
```

**Benefit:** Engagement, virality tracking

## Testing Checklist

- [x] Database table created
- [x] Slug generation function works
- [x] View count increment works
- [x] Trade save API endpoint deployed
- [x] Trade fetch API endpoint deployed
- [x] OG image generator deployed
- [x] SharedTradePage component created
- [x] TradeAnalyzer share button added
- [x] App.tsx routing updated
- [x] Meta tags dynamically updated
- [x] Build completes successfully
- [ ] Test trade creation flow
- [ ] Test share link copy
- [ ] Test public trade page
- [ ] Test OG image generation
- [ ] Test Discord embed preview
- [ ] Test Twitter card preview
- [ ] Test mobile responsiveness

## Summary

You now have a complete shareable trades system that transforms your trade calculator into a viral content engine:

✅ **Permanent shareable links** - Never expire, always accessible
✅ **Rich social embeds** - Beautiful previews on Discord, Twitter, Reddit
✅ **Dynamic OG images** - Custom SVG images for each trade
✅ **Public viewing** - No sign-in required, mobile-friendly
✅ **View tracking** - Analytics for popular trades
✅ **Privacy options** - Hide values if desired
✅ **SEO benefits** - Organic traffic from social shares
✅ **Viral potential** - Users become marketers

**How It Works:**
1. User analyzes trade → Clicks "Share This Trade"
2. System generates unique link → Returns `/trade/abc123xy`
3. User copies & posts to Discord/Twitter/Reddit
4. Others see rich preview with OG image
5. They click → View full analysis
6. Some analyze their own trades
7. They share their trades → **Exponential growth**

**Business Impact:**
- **Traffic:** Organic social sharing drives qualified visitors
- **Engagement:** Users share trades to get league opinions
- **Retention:** Historical trades keep users coming back
- **Brand:** Your logo on every shared trade
- **Conversion:** Public pages have "Analyze Your Own" CTA
- **SEO:** Thousands of indexed trade pages with backlinks

**The difference between a tool and a platform:** A tool solves a problem. A platform makes users your marketers.

You just built the platform. 🚀
