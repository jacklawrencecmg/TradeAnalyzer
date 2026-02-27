/*
  # Grant permanent Pro/Admin access to specified accounts

  ## Summary
  Sets all four admin accounts to active Pro tier with a 10-year period end.
  Also creates a subscription record for theprez@yahoo.com if the account exists,
  or upserts for the others to ensure they are fully active.

  ## Accounts
  - jacklawrence713@gmail.com (trial expired — upgrade to active pro)
  - jlawrence@cmgfi.com (already active — extend/confirm)
  - theprez@yahoo.com (no subscription — create if user exists)
  - modgy28@hotmail.com (already active — extend/confirm)
*/

UPDATE user_subscriptions
SET
  tier = 'pro',
  status = 'active',
  current_period_start = now(),
  current_period_end = now() + interval '10 years',
  cancel_at_period_end = false,
  updated_at = now()
WHERE user_id IN (
  SELECT id FROM auth.users
  WHERE email IN (
    'jacklawrence713@gmail.com',
    'jlawrence@cmgfi.com',
    'modgy28@hotmail.com'
  )
);

INSERT INTO user_subscriptions (user_id, tier, status, current_period_start, current_period_end, cancel_at_period_end, created_at, updated_at)
SELECT
  id,
  'pro',
  'active',
  now(),
  now() + interval '10 years',
  false,
  now(),
  now()
FROM auth.users
WHERE email = 'theprez@yahoo.com'
ON CONFLICT (user_id) DO UPDATE
  SET
    tier = 'pro',
    status = 'active',
    current_period_start = now(),
    current_period_end = now() + interval '10 years',
    cancel_at_period_end = false,
    updated_at = now();
