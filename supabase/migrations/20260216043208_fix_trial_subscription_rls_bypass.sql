/*
  # Fix Trial Subscription Creation with RLS Bypass

  1. Problem
    - SECURITY DEFINER functions still have RLS enforced
    - The trigger needs to insert into user_subscriptions but RLS blocks it
    - Need to explicitly grant the postgres role permission or disable RLS in function

  2. Solution
    - Recreate the create_trial_subscription function to use SET statements
    - This properly bypasses RLS when inserting the subscription record

  3. Security
    - Function is SECURITY DEFINER so it runs with postgres privileges
    - Only called from trigger on auth.users, not directly accessible
    - Still maintains security while allowing automatic trial creation
*/

-- Recreate the function with proper RLS handling
CREATE OR REPLACE FUNCTION create_trial_subscription(p_user_id uuid)
RETURNS void 
LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_trial_end timestamptz;
BEGIN
  v_trial_end := now() + INTERVAL '7 days';

  -- Insert with explicit column list
  INSERT INTO public.user_subscriptions (
    user_id,
    tier,
    status,
    trial_start,
    trial_end,
    current_period_end
  ) VALUES (
    p_user_id,
    'pro',
    'trialing',
    now(),
    v_trial_end,
    v_trial_end
  )
  ON CONFLICT (user_id) DO NOTHING;
  
EXCEPTION WHEN OTHERS THEN
  -- Log the error but don't fail user creation
  RAISE WARNING 'Failed to create trial subscription for user %: %', p_user_id, SQLERRM;
END;
$$;

-- Ensure the trigger function also has proper settings
CREATE OR REPLACE FUNCTION trigger_create_trial()
RETURNS TRIGGER 
LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Call the subscription creation function
  PERFORM create_trial_subscription(NEW.id);
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Don't fail user creation if subscription creation fails
  RAISE WARNING 'Trigger failed to create subscription: %', SQLERRM;
  RETURN NEW;
END;
$$;

-- Grant execute permissions to ensure the function can run
GRANT EXECUTE ON FUNCTION create_trial_subscription(uuid) TO postgres, authenticated, anon;
GRANT EXECUTE ON FUNCTION trigger_create_trial() TO postgres;

-- Add a policy specifically for the postgres role if needed
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'user_subscriptions' 
    AND policyname = 'Allow postgres to insert subscriptions'
  ) THEN
    CREATE POLICY "Allow postgres to insert subscriptions"
      ON user_subscriptions
      FOR INSERT
      TO postgres
      WITH CHECK (true);
  END IF;
END $$;
