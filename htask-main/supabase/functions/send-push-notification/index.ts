import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Helper function to log notification events
async function logNotificationEvent(
  supabase: any,
  notificationId: string | null,
  eventType: string,
  eventData: Record<string, any> = {}
): Promise<void> {
  if (!notificationId) return;
  
  try {
    await supabase.rpc('log_notification_event', {
      p_notification_id: notificationId,
      p_event_type: eventType,
      p_event_data: eventData,
    });
  } catch (error) {
    console.error('Failed to log notification event:', error);
  }
}

// Web Push encryption and sending
async function sendWebPush(
  subscription: { endpoint: string; p256dh: string; auth: string },
  payload: string,
  vapidPublicKey: string,
  vapidPrivateKey: string,
  vapidSubject: string
): Promise<{ success: boolean; error?: string; statusCode?: number }> {
  try {
    // Import web-push dynamically
    const webpush = await import("npm:web-push@3.6.7");
    
    webpush.default.setVapidDetails(
      vapidSubject,
      vapidPublicKey,
      vapidPrivateKey
    );

    const pushSubscription = {
      endpoint: subscription.endpoint,
      keys: {
        p256dh: subscription.p256dh,
        auth: subscription.auth,
      },
    };

    await webpush.default.sendNotification(pushSubscription, payload);
    
    console.log('Push notification sent successfully to:', subscription.endpoint.substring(0, 50) + '...');
    return { success: true };
  } catch (error: any) {
    console.error('Web push error:', error);
    
    // Handle specific error codes
    const statusCode = error.statusCode;
    
    if (statusCode === 410 || statusCode === 404) {
      // Subscription expired or invalid
      return { success: false, error: 'subscription_expired', statusCode };
    }
    
    if (statusCode === 429) {
      // Rate limited
      return { success: false, error: 'rate_limited', statusCode };
    }
    
    return { success: false, error: error.message, statusCode };
  }
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const vapidPublicKey = Deno.env.get('VAPID_PUBLIC_KEY');
    const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY');
    const vapidSubject = Deno.env.get('VAPID_SUBJECT');
    
    if (!vapidPublicKey || !vapidPrivateKey || !vapidSubject) {
      console.error('VAPID keys not configured');
      return new Response(
        JSON.stringify({ error: 'VAPID keys not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { userId, notification } = await req.json();

    if (!userId || !notification) {
      return new Response(
        JSON.stringify({ error: 'userId and notification are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Processing push for user:', userId);

    // Get user's active push subscriptions
    const { data: subscriptions, error: subError } = await supabase
      .from('push_subscriptions')
      .select('*')
      .eq('user_id', userId)
      .eq('is_active', true);

    if (subError) {
      console.error('Error fetching subscriptions:', subError);
      throw subError;
    }

    if (!subscriptions || subscriptions.length === 0) {
      console.log('No active subscriptions for user:', userId);
      return new Response(
        JSON.stringify({ success: false, message: 'No active subscriptions' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check quiet hours
    const { data: prefs } = await supabase
      .from('notification_preferences')
      .select('quiet_hours_enabled, quiet_hours_start, quiet_hours_end, timezone')
      .eq('user_id', userId)
      .single();

    if (prefs?.quiet_hours_enabled) {
      const userTimezone = prefs.timezone || 'Asia/Kathmandu';
      const now = new Date();
      const userTime = new Date(now.toLocaleString('en-US', { timeZone: userTimezone }));
      const currentHour = userTime.getHours();
      
      const start = prefs.quiet_hours_start || 22;
      const end = prefs.quiet_hours_end || 7;
      
      let isQuietHours = false;
      if (start > end) {
        // Crosses midnight (e.g., 22:00 - 07:00)
        isQuietHours = currentHour >= start || currentHour < end;
      } else {
        isQuietHours = currentHour >= start && currentHour < end;
      }
      
      if (isQuietHours) {
        console.log('Quiet hours active, skipping push for user:', userId);
        return new Response(
          JSON.stringify({ success: false, message: 'Quiet hours active' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Prepare payload
    const payload = JSON.stringify({
      title: notification.title,
      body: notification.body,
      url: notification.url || '/',
      tag: notification.tag || (notification.id ? `notification-${notification.id}` : 'general'),
      notificationId: notification.id || undefined,
      actions: notification.actions || [],
    });

    // Send to all subscriptions
    const results = await Promise.all(
      subscriptions.map(async (sub) => {
        // Log push attempt
        await logNotificationEvent(supabase, notification.id, 'push_attempted', {
          subscription_id: sub.id,
          platform: sub.platform,
          endpoint_prefix: sub.endpoint.substring(0, 50),
        });

        const result = await sendWebPush(
          { endpoint: sub.endpoint, p256dh: sub.p256dh, auth: sub.auth },
          payload,
          vapidPublicKey,
          vapidPrivateKey,
          vapidSubject
        );

        // Handle failed subscriptions
        if (!result.success) {
          // Log the failure
          await logNotificationEvent(supabase, notification.id, 'push_failed', {
            subscription_id: sub.id,
            error: result.error,
            status_code: result.statusCode,
          });

          if (result.error === 'subscription_expired') {
            // Deactivate expired subscription
            await supabase
              .from('push_subscriptions')
              .update({ is_active: false })
              .eq('id', sub.id);
            console.log('Deactivated expired subscription:', sub.id);
          } else {
            // Increment fail count
            const newFailCount = (sub.failed_count || 0) + 1;
            
            if (newFailCount >= 3) {
              // Deactivate after 3 failures
              await supabase
                .from('push_subscriptions')
                .update({ is_active: false, failed_count: newFailCount })
                .eq('id', sub.id);
              console.log('Deactivated subscription after 3 failures:', sub.id);
            } else {
              await supabase
                .from('push_subscriptions')
                .update({ failed_count: newFailCount })
                .eq('id', sub.id);
            }
          }
        } else {
          // Log success
          await logNotificationEvent(supabase, notification.id, 'push_success', {
            subscription_id: sub.id,
            platform: sub.platform,
          });

          // Reset fail count and update last used
          await supabase
            .from('push_subscriptions')
            .update({ 
              failed_count: 0, 
              last_used_at: new Date().toISOString() 
            })
            .eq('id', sub.id);
        }

        return { subscriptionId: sub.id, ...result };
      })
    );

    // Mark notification as pushed (skip for test pushes without an ID)
    if (notification.id) {
      await supabase
        .from('notifications')
        .update({ 
          pushed: true, 
          pushed_at: new Date().toISOString() 
        })
        .eq('id', notification.id);
    }

    const successCount = results.filter(r => r.success).length;
    console.log(`Push sent: ${successCount}/${results.length} succeeded`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        sent: successCount, 
        total: results.length,
        results 
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('Error in send-push-notification:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
