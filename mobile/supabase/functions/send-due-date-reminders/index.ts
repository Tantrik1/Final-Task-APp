import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log('Starting due date reminder check...');

    // Get current time in Nepal timezone
    const now = new Date();
    const nepalTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Kathmandu' }));
    const currentHour = nepalTime.getHours();
    
    console.log(`Current Nepal time: ${nepalTime.toISOString()}, Hour: ${currentHour}`);

    // Call the database function to send reminders
    const { data: reminderCount, error: dbError } = await supabase.rpc('send_due_date_reminders');

    if (dbError) {
      console.error('Error calling send_due_date_reminders:', dbError);
      throw dbError;
    }

    console.log(`Created ${reminderCount} due date reminder notifications`);

    // Now trigger push notifications for all unpushed due date reminders
    const { data: notifications, error: fetchError } = await supabase
      .from('notifications')
      .select('id, user_id, title, body, metadata, workspace_id')
      .eq('type', 'due_date_reminder')
      .eq('pushed', false)
      .order('created_at', { ascending: false })
      .limit(100);

    if (fetchError) {
      console.error('Error fetching unpushed notifications:', fetchError);
      throw fetchError;
    }

    let pushSuccessCount = 0;
    let pushFailCount = 0;

    // Send push notifications for each reminder
    for (const notification of notifications || []) {
      try {
        const { error: pushError } = await supabase.functions.invoke('send-push-notification', {
          body: {
            userId: notification.user_id,
            notification: {
              id: notification.id,
              title: notification.title,
              body: notification.body,
              url: `/workspace/${notification.workspace_id}/tasks`,
              tag: `due-date-${notification.id}`,
            },
          },
        });

        if (pushError) {
          console.error(`Push failed for notification ${notification.id}:`, pushError);
          pushFailCount++;
        } else {
          pushSuccessCount++;
        }
      } catch (err) {
        console.error(`Exception sending push for ${notification.id}:`, err);
        pushFailCount++;
      }
    }

    const summary = {
      success: true,
      remindersCreated: reminderCount || 0,
      pushNotificationsSent: pushSuccessCount,
      pushNotificationsFailed: pushFailCount,
      timestamp: nepalTime.toISOString(),
      hour: currentHour,
    };

    console.log('Due date reminder summary:', summary);

    return new Response(
      JSON.stringify(summary),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('Error in send-due-date-reminders:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
