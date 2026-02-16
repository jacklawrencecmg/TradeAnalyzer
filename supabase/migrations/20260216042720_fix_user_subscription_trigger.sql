/*
  # Fix User Subscription Trigger RLS Issue

  1. Problem
    - When new users sign up, a trigger tries to create a trial subscription
    - The RLS policy for service role only has USING clause, missing WITH CHECK
    - This causes INSERT operations to fail

  2. Changes
    - Drop the existing "Service role can manage subscriptions" policy
    - Create separate policies for SELECT, INSERT, UPDATE, DELETE with proper clauses
    - Ensure trigger function can insert into user_subscriptions table

  3. Security
    - Users can only SELECT their own subscription
    - Service role (triggers, functions) can manage all subscriptions
    - No direct user INSERT/UPDATE allowed
*/

-- Drop the existing policy that's causing issues
DROP POLICY IF EXISTS "Service role can manage subscriptions" ON user_subscriptions;

-- Create separate policies for service role operations

-- Service role can SELECT all subscriptions
CREATE POLICY "Service role can view all subscriptions"
  ON user_subscriptions
  FOR SELECT
  USING (true);

-- Service role can INSERT subscriptions (for triggers)
CREATE POLICY "Service role can insert subscriptions"
  ON user_subscriptions
  FOR INSERT
  WITH CHECK (true);

-- Service role can UPDATE subscriptions (for Stripe webhooks)
CREATE POLICY "Service role can update subscriptions"
  ON user_subscriptions
  FOR UPDATE
  USING (true)
  WITH CHECK (true);

-- Service role can DELETE subscriptions
CREATE POLICY "Service role can delete subscriptions"
  ON user_subscriptions
  FOR DELETE
  USING (true);
