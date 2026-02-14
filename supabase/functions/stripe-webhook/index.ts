import { createClient } from 'npm:@supabase/supabase-js@2';
import Stripe from 'npm:stripe@14';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey, Stripe-Signature',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
      apiVersion: '2023-10-16',
    });

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const signature = req.headers.get('stripe-signature');
    const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET');

    if (!signature || !webhookSecret) {
      throw new Error('Missing signature or webhook secret');
    }

    const body = await req.text();
    const event = stripe.webhooks.constructEvent(body, signature, webhookSecret);

    console.log('Stripe webhook event:', event.type);

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.metadata?.supabase_user_id;

        if (!userId) {
          console.error('No user ID in session metadata');
          break;
        }

        const subscription = await stripe.subscriptions.retrieve(
          session.subscription as string
        );

        await supabase.rpc('update_subscription_from_stripe', {
          p_user_id: userId,
          p_stripe_customer_id: session.customer as string,
          p_stripe_subscription_id: subscription.id,
          p_status: subscription.status,
          p_current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
          p_current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
          p_cancel_at_period_end: subscription.cancel_at_period_end,
        });

        console.log(`Subscription created for user ${userId}`);
        break;
      }

      case 'invoice.paid': {
        const invoice = event.data.object as Stripe.Invoice;
        const subscriptionId = invoice.subscription as string;

        if (!subscriptionId) break;

        const subscription = await stripe.subscriptions.retrieve(subscriptionId);
        const userId = subscription.metadata?.supabase_user_id;

        if (!userId) {
          console.error('No user ID in subscription metadata');
          break;
        }

        await supabase.rpc('update_subscription_from_stripe', {
          p_user_id: userId,
          p_stripe_customer_id: subscription.customer as string,
          p_stripe_subscription_id: subscription.id,
          p_status: subscription.status,
          p_current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
          p_current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
          p_cancel_at_period_end: subscription.cancel_at_period_end,
        });

        console.log(`Invoice paid for user ${userId}`);
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        const subscriptionId = invoice.subscription as string;

        if (!subscriptionId) break;

        const subscription = await stripe.subscriptions.retrieve(subscriptionId);
        const userId = subscription.metadata?.supabase_user_id;

        if (!userId) break;

        await supabase
          .from('user_subscriptions')
          .update({
            status: 'past_due',
            updated_at: new Date().toISOString(),
          })
          .eq('user_id', userId);

        console.log(`Payment failed for user ${userId}`);
        break;
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;
        const userId = subscription.metadata?.supabase_user_id;

        if (!userId) {
          console.error('No user ID in subscription metadata');
          break;
        }

        await supabase.rpc('update_subscription_from_stripe', {
          p_user_id: userId,
          p_stripe_customer_id: subscription.customer as string,
          p_stripe_subscription_id: subscription.id,
          p_status: subscription.status,
          p_current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
          p_current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
          p_cancel_at_period_end: subscription.cancel_at_period_end,
        });

        console.log(`Subscription updated for user ${userId}`);
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        const userId = subscription.metadata?.supabase_user_id;

        if (!userId) {
          console.error('No user ID in subscription metadata');
          break;
        }

        await supabase
          .from('user_subscriptions')
          .update({
            status: 'canceled',
            tier: 'free',
            updated_at: new Date().toISOString(),
          })
          .eq('user_id', userId);

        console.log(`Subscription canceled for user ${userId}`);
        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return new Response(
      JSON.stringify({ received: true }),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );

  } catch (error) {
    console.error('Webhook error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 400,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  }
});
