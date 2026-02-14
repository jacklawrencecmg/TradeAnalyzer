# Premium Subscription System

A complete monetization system with Stripe integration, feature gating, and trial management. Free users get core value while Pro members unlock advanced features for $7/month.

## Overview

This system transforms your dynasty fantasy platform from a free tool into a sustainable business with recurring revenue while keeping essential features accessible to all users.

### Pricing Model

**Free Tier** ($0/month):
- Player search and profiles ✅
- Dynasty rankings ✅
- Weekly market reports ✅
- Basic trade calculator (10/day) ✅
- 1 league import ✅
- Player value history ✅

**Pro Tier** ($7/month):
- Everything in Free, plus:
- Unlimited trade calculations
- Unlimited league imports
- AI trade suggestions
- Team strategy advice
- Market alerts & notifications
- Unlimited player watchlist
- Power rankings history
- Advanced IDP scoring presets
- Future draft pick projections
- Player trend analytics
- Priority support

**Trial:** 7-day free trial for all new users

## Architecture

### 1. Database Schema

**Table:** `user_subscriptions`

Stores subscription status and Stripe metadata:

```sql
CREATE TABLE user_subscriptions (
  id uuid PRIMARY KEY,
  user_id uuid REFERENCES auth.users UNIQUE,
  tier text CHECK (tier IN ('free', 'pro')),
  status text CHECK (status IN ('active', 'trialing', 'canceled', 'past_due', 'incomplete')),
  stripe_customer_id text,
  stripe_subscription_id text,
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean DEFAULT false,
  trial_start timestamptz,
  trial_end timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
```

**Table:** `usage_tracking`

Tracks daily feature usage for free tier limits:

```sql
CREATE TABLE usage_tracking (
  id uuid PRIMARY KEY,
  user_id uuid REFERENCES auth.users,
  feature text NOT NULL,
  count int DEFAULT 1,
  reset_at timestamptz NOT NULL,
  date date DEFAULT CURRENT_DATE,
  UNIQUE(user_id, feature, date)
);
```

**Table:** `feature_access_log`

Audit log of feature access attempts:

```sql
CREATE TABLE feature_access_log (
  id uuid PRIMARY KEY,
  user_id uuid REFERENCES auth.users,
  feature text NOT NULL,
  granted boolean NOT NULL,
  reason text,
  created_at timestamptz DEFAULT now()
);
```

### 2. SQL Functions

**get_user_subscription(user_id)**

Returns comprehensive subscription status:

```typescript
{
  tier: 'free' | 'pro',
  status: 'active' | 'trialing' | 'canceled' | 'past_due',
  is_pro: boolean,
  is_trial: boolean,
  trial_days_left: number,
  period_end: timestamp
}
```

**check_feature_access(user_id, feature)**

Checks if user can access a feature:

```sql
-- Returns: boolean

-- Free features (always accessible):
- player_search
- player_detail
- rankings
- dynasty_reports
- basic_trade_calc

-- Pro features (require subscription):
- trade_suggestions
- team_strategy
- market_alerts
- watchlist
- power_rankings_history
- advanced_idp_presets
- future_pick_projections
- player_trend_analytics
- unlimited_trades
- unlimited_leagues
```

**track_usage(user_id, feature)**

Increments usage counter and returns new count:

```sql
-- Automatically resets at midnight
-- Returns: int (current count)
```

**check_usage_limit(user_id, feature, limit)**

Checks if user is within daily limit:

```sql
-- Pro users: Always returns true (no limits)
-- Free users: Checks against limit

-- Limits:
trade_calc: 10/day
league_import: 1 total
```

**create_trial_subscription(user_id)**

Creates 7-day trial for new users:

```sql
-- Automatically called on signup via trigger
-- Sets:
  - tier: 'pro'
  - status: 'trialing'
  - trial_end: now() + 7 days
```

**expire_trials()**

Downgrades expired trials to free:

```sql
-- Run daily via cron
-- Updates all trials where trial_end < now()
-- Sets:
  - tier: 'free'
  - status: 'active'
  - trial_end: NULL
```

**update_subscription_from_stripe(...)**

Updates subscription from Stripe webhook data:

```sql
-- Called by webhook handler
-- Updates all Stripe-related fields
-- Handles subscription status changes
```

### 3. Stripe Integration

#### Checkout Session

**Endpoint:** `POST /functions/v1/create-checkout-session`

**Authentication:** Required (Bearer token)

**Request:**
```json
{
  "success_url": "https://app.com/dashboard?upgrade=success",
  "cancel_url": "https://app.com/dashboard?upgrade=canceled"
}
```

**Response:**
```json
{
  "url": "https://checkout.stripe.com/..."
}
```

**Flow:**
1. User clicks "Upgrade to Pro"
2. Frontend calls Edge Function with auth token
3. Function creates/retrieves Stripe customer
4. Creates Stripe checkout session
5. Returns checkout URL
6. Frontend redirects to Stripe
7. User completes payment
8. Stripe redirects to success_url
9. Webhook updates database

**Implementation:**

```typescript
const url = await createCheckoutSession(
  window.location.origin + '/dashboard?upgrade=success',
  window.location.origin + '/dashboard?upgrade=canceled'
);

if (url) {
  window.location.href = url;
}
```

#### Webhook Handler

**Endpoint:** `POST /functions/v1/stripe-webhook`

**Authentication:** Stripe signature verification

**Events Handled:**

1. **checkout.session.completed**
   - Creates subscription record
   - Upgrades user to Pro
   - Sets billing period

2. **invoice.paid**
   - Renews subscription
   - Updates period dates
   - Maintains Pro status

3. **invoice.payment_failed**
   - Sets status to 'past_due'
   - User retains access temporarily
   - Stripe retries payment

4. **customer.subscription.updated**
   - Updates subscription details
   - Handles plan changes
   - Updates billing period

5. **customer.subscription.deleted**
   - Downgrades to free tier
   - Sets status to 'canceled'
   - User loses Pro features

**Webhook URL:** `https://your-project.supabase.co/functions/v1/stripe-webhook`

**Configuration:**
1. Go to Stripe Dashboard
2. Developers → Webhooks
3. Add endpoint with URL above
4. Select all events or specific ones listed
5. Copy webhook signing secret
6. Add to Supabase secrets as `STRIPE_WEBHOOK_SECRET`

### 4. Frontend Integration

#### Feature Gating

**Library:** `src/lib/subscription.ts`

Core functions:

```typescript
// Get subscription status
const subscription = await getUserSubscription(userId);

// Check feature access
const hasAccess = await checkFeatureAccess(userId, 'trade_suggestions');

// Track usage
const count = await trackUsage(userId, 'trade_calc');

// Check usage limit
const canUse = await checkUsageLimit(userId, 'trade_calc', 10);

// Create checkout session
const url = await createCheckoutSession(successUrl, cancelUrl);
```

#### React Hook

**Hook:** `useSubscription()`

```typescript
const {
  subscription,     // Full subscription object
  loading,          // Loading state
  isPro,            // Is user Pro?
  isTrial,          // Is user on trial?
  trialDaysLeft,    // Days left in trial
  hasFeatureAccess, // Check feature access
  trackFeatureUsage, // Track usage
  getFeatureUsage,  // Get current usage
  canUseFeature,    // Check if can use
  refresh,          // Reload subscription
} = useSubscription();
```

**Usage:**

```typescript
import { useSubscription } from '../hooks/useSubscription';

function MyComponent() {
  const { isPro, canUseFeature } = useSubscription();

  const handleAction = async () => {
    const allowed = await canUseFeature('trade_calc');

    if (!allowed) {
      showUpgradeModal();
      return;
    }

    // Perform action
  };

  return (
    <div>
      {isPro ? (
        <ProFeature />
      ) : (
        <FeatureLock onUpgrade={showUpgradeModal} />
      )}
    </div>
  );
}
```

#### UI Components

**ProBadge**

Displays Pro badge:

```typescript
<ProBadge size="sm" | "md" | "lg" showText={true} />
```

**FeatureLock**

Locks feature with upgrade prompt:

```typescript
<FeatureLock
  feature="AI Trade Suggestions"
  onUpgrade={handleUpgrade}
>
  <LockedFeatureComponent />
</FeatureLock>
```

**UpgradeModal**

Full-screen upgrade modal:

```typescript
{showModal && (
  <UpgradeModal
    onClose={() => setShowModal(false)}
    feature="Optional feature name"
  />
)}
```

**SubscriptionBadge**

Header badge showing subscription status:

```typescript
<SubscriptionBadge onUpgrade={handleUpgrade} />
```

Shows:
- "Upgrade to Pro" (free users)
- "Pro Member" (pro users)
- "Trial: X days left" (trial users)
- "Payment Failed" (past_due)

**UsageMeter**

Shows daily usage and limits:

```typescript
<UsageMeter
  feature="trade_calc" | "league_import"
  onUpgrade={handleUpgrade}
/>
```

Displays:
- Progress bar
- "X of Y remaining"
- Upgrade button when near/at limit
- Color-coded (blue → orange → red)

**PricingPage**

Full pricing comparison page:

```typescript
<PricingPage onBack={handleBack} />
```

Features:
- Side-by-side comparison
- Free vs Pro features
- 7-day trial highlight
- FAQ section
- Upgrade button

### 5. Feature Implementation

#### Gating a Feature

**Backend (Edge Function):**

```typescript
import { createClient } from 'npm:@supabase/supabase-js@2';

Deno.serve(async (req) => {
  const supabase = createClient(url, key);

  // Get user from auth token
  const token = req.headers.get('Authorization')?.replace('Bearer ', '');
  const { data: { user } } = await supabase.auth.getUser(token);

  // Check access
  const { data: hasAccess } = await supabase.rpc('check_feature_access', {
    p_user_id: user.id,
    p_feature: 'trade_suggestions'
  });

  if (!hasAccess) {
    return new Response(
      JSON.stringify({ error: 'Pro feature required' }),
      { status: 403 }
    );
  }

  // Execute feature logic
  const result = await generateTradeSuggestions();

  return new Response(JSON.stringify(result));
});
```

**Frontend (React Component):**

```typescript
import { useSubscription } from '../hooks/useSubscription';

function TradeSuggestions() {
  const { isPro, canUseFeature } = useSubscription();
  const [locked, setLocked] = useState(!isPro);

  useEffect(() => {
    checkAccess();
  }, []);

  const checkAccess = async () => {
    const allowed = await canUseFeature('trade_suggestions');
    setLocked(!allowed);
  };

  if (locked) {
    return (
      <FeatureLock
        feature="AI Trade Suggestions"
        onUpgrade={() => setShowUpgradeModal(true)}
      >
        <TradeSuggestionsPreview />
      </FeatureLock>
    );
  }

  return <TradeSuggestionsContent />;
}
```

#### Usage Limiting

**Trade Calculator Example:**

```typescript
async function handleCalculateTrade() {
  const { user } = useAuth();
  const { isPro } = useSubscription();

  if (!isPro) {
    // Check limit
    const allowed = await checkUsageLimit(user.id, 'trade_calc', 10);

    if (!allowed) {
      showUpgradeModal('Unlimited Trade Calculations');
      return;
    }

    // Track usage
    const count = await trackUsage(user.id, 'trade_calc');
    console.log(`Usage: ${count}/10`);
  }

  // Perform calculation
  const result = await calculateTrade(trade);
  setResult(result);
}
```

#### League Import Limiting

```typescript
async function handleImportLeague(leagueId: string) {
  const { user } = useAuth();
  const { isPro } = useSubscription();

  if (!isPro) {
    // Check existing imports
    const { data: leagues } = await supabase
      .from('user_leagues')
      .select('id')
      .eq('user_id', user.id);

    if (leagues && leagues.length >= 1) {
      showUpgradeModal('Unlimited League Imports');
      return;
    }
  }

  // Import league
  await importLeague(leagueId);
}
```

### 6. Trial System

**Automatic Trial Creation:**

All new users automatically get 7-day Pro trial via database trigger:

```sql
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION trigger_create_trial();
```

**Trial Management:**

```typescript
// Check trial status
const { isTrial, trialDaysLeft } = useSubscription();

// Show trial banner
{isTrial && (
  <div className="trial-banner">
    {trialDaysLeft} days left in your Pro trial
    <button onClick={upgrade}>Upgrade Now</button>
  </div>
)}
```

**Trial Expiration:**

Cron job runs daily to expire trials:

```typescript
// supabase/functions/cron-expire-trials/index.ts
Deno.cron("expire_trials", "0 0 * * *", async () => {
  await supabase.rpc('expire_trials');
});
```

Users automatically downgraded to free when trial ends.

### 7. Conversion Funnel

**User Journey:**

```
1. Sign Up
   ↓
2. 7-Day Pro Trial (automatic)
   - Access all features
   - See value proposition
   - Get hooked on Pro features
   ↓
3. Trial Ending Reminders
   - 3 days left: Email + banner
   - 1 day left: Email + popup
   - Last day: Urgent email
   ↓
4. Trial Expires
   - Downgraded to Free
   - Features locked
   - "Upgrade to continue" prompts
   ↓
5. Conversion Triggers
   - Hit usage limit (10 trades)
   - Try to access Pro feature
   - See Pro badge on features
   - View pricing comparison
   ↓
6. Upgrade
   - Click any upgrade button
   - Redirect to Stripe checkout
   - Complete payment
   - Instant Pro access
```

**Optimization Points:**

1. **Trial Activation:**
   - Automatic = 100% activation
   - No friction

2. **Value Demonstration:**
   - Use Pro features during trial
   - Track which features used most
   - Email highlights

3. **Upgrade Prompts:**
   - Strategic placement
   - Usage meter warnings
   - Feature lock modals
   - Pricing page access

4. **Urgency:**
   - Trial countdown
   - "X days left" messaging
   - Loss aversion (lose Pro access)

5. **Simplicity:**
   - One-click Stripe checkout
   - No commitment (cancel anytime)
   - Low price ($7/month)

### 8. Revenue Projections

**Conservative Estimates:**

| Metric | Value |
|--------|-------|
| Monthly Signups | 1,000 |
| Trial Conversion Rate | 10% |
| Monthly Pro Subscribers | 100 |
| Revenue per Sub | $7/month |
| **Monthly Recurring Revenue** | **$700** |
| Annual Run Rate | $8,400 |

**Growth Scenario (12 months):**

| Month | Signups | Subs | MRR | ARR |
|-------|---------|------|-----|-----|
| 1 | 1,000 | 100 | $700 | $8,400 |
| 3 | 3,000 | 350 | $2,450 | $29,400 |
| 6 | 6,000 | 800 | $5,600 | $67,200 |
| 12 | 12,000 | 1,800 | $12,600 | $151,200 |

**Assumptions:**
- 10% trial conversion
- 5% monthly churn
- Organic growth from SEO + word of mouth

**Optimistic Scenario:**
- 15% conversion = $1,050 MRR
- With ads/marketing = 5,000 signups/month
- = $5,250 MRR = $63,000 ARR

### 9. Key Metrics to Track

**Acquisition:**
- Signups per day/week/month
- Traffic sources
- Signup conversion rate

**Activation:**
- Trial activation rate (should be 100%)
- Features used during trial
- Time to first value

**Engagement:**
- Daily/weekly active users
- Feature usage frequency
- Session duration

**Monetization:**
- Trial → Paid conversion rate
- Average revenue per user (ARPU)
- Monthly recurring revenue (MRR)
- Annual run rate (ARR)

**Retention:**
- Monthly churn rate
- Lifetime value (LTV)
- Upgrade/downgrade flows

**Feature Analytics:**
- Most-used Pro features
- Features that drive upgrades
- Free tier limits hit rates

### 10. Configuration

**Environment Variables:**

```env
# Stripe
STRIPE_SECRET_KEY=sk_live_...
STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_ID=price_...  # Pro plan price ID

# App
APP_URL=https://your-app.com
```

**Setting up Stripe:**

1. Create Stripe account
2. Create product: "Fantasy Draft Pros - Pro"
3. Create price: $7/month, recurring
4. Copy Price ID → `STRIPE_PRICE_ID`
5. Get API keys → `STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY`
6. Set up webhook → `STRIPE_WEBHOOK_SECRET`

**Supabase Secrets:**

```bash
# Set secrets in Supabase dashboard
# Settings → Edge Functions → Secrets

STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_ID=price_...
APP_URL=https://your-app.com
```

## Usage

### For Users

**Free Users:**
1. Sign up → Get 7-day Pro trial
2. Use all features during trial
3. Trial expires → Downgrade to Free
4. Hit limits → See upgrade prompts
5. Click upgrade → Stripe checkout
6. Become Pro member

**Pro Users:**
1. Unlimited access to all features
2. See "Pro Member" badge
3. No usage meters
4. Manage subscription in billing portal

### For Developers

**Check subscription in code:**

```typescript
import { useSubscription } from '../hooks/useSubscription';

const { isPro, hasFeatureAccess, trackFeatureUsage } = useSubscription();

// Check if Pro
if (isPro) {
  // Grant access
}

// Check specific feature
const allowed = await hasFeatureAccess('trade_suggestions');

// Track usage
const count = await trackFeatureUsage('trade_calc');
```

**Gate a feature:**

```typescript
import { FeatureLock } from './ProBadge';

{!isPro && (
  <FeatureLock
    feature="AI Trade Suggestions"
    onUpgrade={() => setShowUpgradeModal(true)}
  >
    <FeatureContent />
  </FeatureLock>
)}
```

**Show upgrade modal:**

```typescript
import UpgradeModal from './UpgradeModal';

const [showUpgrade, setShowUpgrade] = useState(false);

<UpgradeModal
  onClose={() => setShowUpgrade(false)}
  feature="Unlimited Trades"
/>
```

## Testing

**Test Accounts:**

1. **Free User:**
   - Sign up
   - Wait for trial to expire (or manually update DB)
   - Test usage limits
   - Test upgrade flow

2. **Trial User:**
   - Sign up
   - Verify trial access
   - Test all Pro features
   - Verify trial countdown

3. **Pro User:**
   - Complete upgrade
   - Verify unlimited access
   - Test subscription management
   - Test cancellation

**Stripe Test Mode:**

Use test credit cards:
- Success: 4242 4242 4242 4242
- Declined: 4000 0000 0000 0002
- Requires authentication: 4000 0025 0000 3155

**Database Testing:**

```sql
-- Check subscription
SELECT * FROM user_subscriptions WHERE user_id = 'user-id';

-- Check usage
SELECT * FROM usage_tracking WHERE user_id = 'user-id';

-- Manually expire trial
UPDATE user_subscriptions
SET trial_end = now() - INTERVAL '1 day'
WHERE user_id = 'user-id';

-- Manually upgrade to Pro
UPDATE user_subscriptions
SET tier = 'pro', status = 'active'
WHERE user_id = 'user-id';
```

## Deployment Checklist

- [ ] Database migration applied
- [ ] Edge Functions deployed
- [ ] Stripe product created
- [ ] Stripe price created
- [ ] Stripe webhook configured
- [ ] Environment variables set
- [ ] Test checkout flow
- [ ] Test webhook handling
- [ ] Test trial creation
- [ ] Test trial expiration
- [ ] Test usage limits
- [ ] Test Pro features
- [ ] Monitor Stripe dashboard
- [ ] Monitor usage metrics

## Troubleshooting

**"No authorization header" error:**
- User not logged in
- Auth token expired
- Check: `supabase.auth.getSession()`

**"Failed to create checkout session":**
- Stripe API key incorrect
- Network issue
- Check Supabase logs

**Webhook not firing:**
- Webhook URL incorrect
- Webhook secret mismatch
- Check Stripe webhook logs

**Trial not created:**
- Trigger not working
- Check `auth.users` permissions
- Manually call `create_trial_subscription()`

**Usage not tracking:**
- RLS policy issue
- Function not called
- Check `usage_tracking` table

**Features not locked:**
- `check_feature_access()` returning wrong value
- Feature name mismatch
- Check subscription status

## Summary

You now have a complete premium subscription system with:

✅ **Database** - Subscriptions, usage tracking, audit logs
✅ **Stripe Integration** - Checkout + webhooks
✅ **Trial System** - Automatic 7-day trials
✅ **Feature Gating** - SQL + React utilities
✅ **Usage Limits** - Daily tracking and enforcement
✅ **UI Components** - Badges, locks, modals, meters
✅ **Pricing Page** - Full comparison and FAQ
✅ **Revenue Model** - $7/month sustainable business

**Business Impact:**

- Free users get value → Word-of-mouth growth
- Pro users pay for premium → Recurring revenue
- Trial system → High conversion rates
- Low price point → Low barrier to entry
- No commitment → Reduced signup friction

**This is how you launch a real SaaS product!** 🚀💰

