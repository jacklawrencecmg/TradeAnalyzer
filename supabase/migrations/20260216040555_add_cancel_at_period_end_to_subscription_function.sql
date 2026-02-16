/*
  # Update get_user_subscription Function to Include cancel_at_period_end

  This migration updates the get_user_subscription function to return the cancel_at_period_end field,
  which is needed for proper subscription cancellation management in the UI.

  ## Changes
  - Adds cancel_at_period_end boolean field to the function return type
  - Updates the function logic to return this field from the user_subscriptions table
*/

-- Drop the existing function
DROP FUNCTION IF EXISTS get_user_subscription(uuid);

-- Recreate with cancel_at_period_end field
CREATE OR REPLACE FUNCTION get_user_subscription(p_user_id uuid)
RETURNS TABLE (
  tier text,
  status text,
  is_pro boolean,
  is_trial boolean,
  trial_days_left int,
  period_end timestamptz,
  cancel_at_period_end boolean
) AS $$
DECLARE
  v_subscription RECORD;
  v_is_pro boolean := false;
  v_is_trial boolean := false;
  v_trial_days int := 0;
BEGIN
  SELECT * INTO v_subscription
  FROM user_subscriptions
  WHERE user_id = p_user_id;

  IF NOT FOUND THEN
    -- No subscription found, return default free tier
    RETURN QUERY SELECT 
      'free'::text,
      'active'::text,
      false,
      false,
      0,
      NULL::timestamptz,
      false;
    RETURN;
  END IF;

  -- Check if user is in trial
  IF v_subscription.status = 'trialing' 
     AND v_subscription.trial_end > now() THEN
    v_is_trial := true;
    v_is_pro := true;
    v_trial_days := EXTRACT(day FROM (v_subscription.trial_end - now()));
  END IF;

  -- Check if user is pro
  IF v_subscription.tier = 'pro' 
     AND v_subscription.status IN ('active', 'trialing')
     AND (v_subscription.current_period_end IS NULL OR v_subscription.current_period_end > now()) THEN
    v_is_pro := true;
  END IF;

  RETURN QUERY SELECT
    v_subscription.tier,
    v_subscription.status,
    v_is_pro,
    v_is_trial,
    v_trial_days,
    v_subscription.current_period_end,
    COALESCE(v_subscription.cancel_at_period_end, false);
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;
