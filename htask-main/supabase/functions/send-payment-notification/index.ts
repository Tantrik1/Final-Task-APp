import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "npm:resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

type NotificationType =
  | "payment_submitted"
  | "payment_submitted_confirmation"
  | "payment_approved"
  | "payment_rejected"
  | "subscription_activated"
  | "subscription_expiring"
  | "subscription_expired"
  | "trial_ending";

interface NotificationRequest {
  type: NotificationType;
  workspaceId: string;
  paymentSubmissionId?: string;
  rejectionReason?: string;
  daysUntilExpiry?: number;
  planName?: string;
  amountNpr?: number;
  expiryDate?: string;
}

const BASE_URL = "https://htask.lovable.app";

// Email template generator
function generateEmailHtml(
  headerColor: string,
  headerTitle: string,
  badgeColor: string,
  badgeText: string,
  mainMessage: string,
  details: { label: string; value: string }[],
  ctaText: string,
  ctaUrl: string,
  footerNote?: string
): string {
  const detailsHtml = details
    .map(
      (d) => `
      <tr>
        <td style="padding: 8px 0; color: #64748b; font-size: 14px;">${d.label}</td>
        <td style="padding: 8px 0; color: #1e293b; font-size: 14px; font-weight: 500; text-align: right;">${d.value}</td>
      </tr>
    `
    )
    .join("");

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);">
  <table width="100%" cellpadding="0" cellspacing="0" style="min-height: 100vh; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 520px;">
          <!-- Header -->
          <tr>
            <td style="background: ${headerColor}; border-radius: 16px 16px 0 0; padding: 32px; text-align: center;">
              <h1 style="margin: 0 0 8px 0; color: white; font-size: 24px; font-weight: 700;">✨ Hamro Task</h1>
              <p style="margin: 0; color: rgba(255,255,255,0.9); font-size: 16px;">${headerTitle}</p>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="background: white; padding: 32px;">
              <!-- Badge -->
              <div style="text-align: center; margin-bottom: 24px;">
                <span style="display: inline-block; background: ${badgeColor}; color: white; padding: 6px 16px; border-radius: 20px; font-size: 13px; font-weight: 600;">
                  ${badgeText}
                </span>
              </div>
              
              <!-- Main Message -->
              <p style="margin: 0 0 24px 0; color: #1e293b; font-size: 16px; line-height: 1.6; text-align: center;">
                ${mainMessage}
              </p>
              
              <!-- Details Table -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background: #f8fafc; border-radius: 12px; padding: 16px; margin-bottom: 24px;">
                ${detailsHtml}
              </table>
              
              <!-- CTA Button -->
              <div style="text-align: center;">
                <a href="${ctaUrl}" style="display: inline-block; background: linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%); color: white; text-decoration: none; padding: 14px 32px; border-radius: 12px; font-weight: 600; font-size: 15px;">
                  🚀 ${ctaText}
                </a>
              </div>
              
              ${
                footerNote
                  ? `<p style="margin: 24px 0 0 0; color: #64748b; font-size: 13px; text-align: center;">${footerNote}</p>`
                  : ""
              }
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background: #f1f5f9; border-radius: 0 0 16px 16px; padding: 24px; text-align: center;">
              <p style="margin: 0; color: #64748b; font-size: 12px;">
                © 2026 Hamro Task. Built with ❤️ for productive teams.
              </p>
              <p style="margin: 8px 0 0 0; color: #94a3b8; font-size: 11px;">
                <a href="${BASE_URL}" style="color: #8b5cf6; text-decoration: none;">Visit Dashboard</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body: NotificationRequest = await req.json();
    const {
      type,
      workspaceId,
      paymentSubmissionId,
      rejectionReason,
      daysUntilExpiry,
      planName,
      amountNpr,
      expiryDate,
    } = body;

    console.log("Processing notification:", type, "for workspace:", workspaceId);

    // Get workspace details
    const { data: workspace, error: wsError } = await supabase
      .from("workspaces")
      .select("name, created_by")
      .eq("id", workspaceId)
      .single();

    if (wsError || !workspace) {
      throw new Error("Workspace not found");
    }

    // Get workspace owner email
    const { data: ownerProfile } = await supabase
      .from("profiles")
      .select("email, full_name")
      .eq("id", workspace.created_by)
      .single();

    if (!ownerProfile?.email) {
      throw new Error("Owner email not found");
    }

    let emailHtml = "";
    let subject = "";
    let recipients: string[] = [ownerProfile.email];

    // Get payment details if needed
    let paymentDetails: any = null;
    if (paymentSubmissionId) {
      const { data } = await supabase
        .from("payment_submissions")
        .select(`
          *,
          plan:subscription_plans(name, price_npr),
          payment_method:payment_methods(name)
        `)
        .eq("id", paymentSubmissionId)
        .single();
      paymentDetails = data;
    }

    // Get subscription details
    const { data: subscription } = await supabase
      .from("workspace_subscriptions")
      .select(`
        *,
        plan:subscription_plans(name)
      `)
      .eq("workspace_id", workspaceId)
      .single();

    switch (type) {
      case "payment_submitted": {
        // Notify super admins about new payment
        const { data: superAdmins } = await supabase
          .from("super_admins")
          .select("user_id");

        if (superAdmins && superAdmins.length > 0) {
          const adminIds = superAdmins.map((sa) => sa.user_id);
          const { data: adminProfiles } = await supabase
            .from("profiles")
            .select("email")
            .in("id", adminIds);

          recipients = adminProfiles?.map((p) => p.email) || [];
        }

        subject = `New Payment Requires Verification - ${workspace.name}`;
        emailHtml = generateEmailHtml(
          "linear-gradient(135deg, #f97316 0%, #ea580c 100%)",
          "New Payment Submission",
          "#f97316",
          "⏳ Pending Review",
          `A new payment has been submitted by <strong>${workspace.name}</strong> and requires your verification.`,
          [
            { label: "Workspace", value: workspace.name },
            { label: "Plan", value: paymentDetails?.plan?.name || planName || "N/A" },
            { label: "Amount", value: `NPR ${(paymentDetails?.amount_npr || amountNpr || 0).toLocaleString()}` },
            { label: "Duration", value: `${paymentDetails?.months_paid || 1} month(s)` },
            { label: "Submitted by", value: ownerProfile.full_name || ownerProfile.email },
          ],
          "Review Payment",
          `${BASE_URL}/admin/payments`,
          "Please review and verify this payment as soon as possible."
        );
        break;
      }

      case "payment_submitted_confirmation": {
        subject = "Payment Submitted - Awaiting Verification";
        emailHtml = generateEmailHtml(
          "linear-gradient(135deg, #f97316 0%, #ea580c 100%)",
          "Payment Received",
          "#f97316",
          "📤 Submitted",
          `Thank you! Your payment for <strong>${workspace.name}</strong> has been submitted and is awaiting verification.`,
          [
            { label: "Plan", value: paymentDetails?.plan?.name || planName || "N/A" },
            { label: "Amount", value: `NPR ${(paymentDetails?.amount_npr || amountNpr || 0).toLocaleString()}` },
            { label: "Duration", value: `${paymentDetails?.months_paid || 1} month(s)` },
            { label: "Payment Method", value: paymentDetails?.payment_method?.name || "N/A" },
          ],
          "View Billing",
          `${BASE_URL}/workspace/${workspaceId}/billing`,
          "Our team will verify your payment within 24 hours."
        );
        break;
      }

      case "payment_approved": {
        // Get workspace admins to notify
        const { data: workspaceAdmins } = await supabase
          .from("workspace_members")
          .select("user_id")
          .eq("workspace_id", workspaceId)
          .in("role", ["owner", "admin"]);

        if (workspaceAdmins && workspaceAdmins.length > 0) {
          const adminIds = workspaceAdmins.map((a) => a.user_id);
          const { data: adminProfiles } = await supabase
            .from("profiles")
            .select("email")
            .in("id", adminIds);

          recipients = [...new Set([ownerProfile.email, ...(adminProfiles?.map((p) => p.email) || [])])];
        }

        const expiresAt = subscription?.expires_at
          ? new Date(subscription.expires_at).toLocaleDateString("en-US", {
              year: "numeric",
              month: "long",
              day: "numeric",
            })
          : "N/A";

        subject = "🎉 Payment Verified - Subscription Activated!";
        emailHtml = generateEmailHtml(
          "linear-gradient(135deg, #22c55e 0%, #16a34a 100%)",
          "Payment Verified",
          "#22c55e",
          "✅ Confirmed",
          `Great news! Your payment for <strong>${workspace.name}</strong> has been verified and your subscription is now active.`,
          [
            { label: "Plan", value: paymentDetails?.plan?.name || subscription?.plan?.name || "N/A" },
            { label: "Amount Paid", value: `NPR ${(paymentDetails?.amount_npr || 0).toLocaleString()}` },
            { label: "Duration", value: `${paymentDetails?.months_paid || 1} month(s)` },
            { label: "Valid Until", value: expiresAt },
          ],
          "Go to Dashboard",
          `${BASE_URL}/workspace/${workspaceId}`,
          "Enjoy your premium features! 🚀"
        );
        break;
      }

      case "payment_rejected": {
        subject = "Payment Could Not Be Verified";
        emailHtml = generateEmailHtml(
          "linear-gradient(135deg, #ef4444 0%, #dc2626 100%)",
          "Payment Rejected",
          "#ef4444",
          "❌ Not Verified",
          `Unfortunately, your payment for <strong>${workspace.name}</strong> could not be verified.`,
          [
            { label: "Plan Requested", value: paymentDetails?.plan?.name || planName || "N/A" },
            { label: "Amount", value: `NPR ${(paymentDetails?.amount_npr || amountNpr || 0).toLocaleString()}` },
            { label: "Reason", value: rejectionReason || "Payment details could not be verified" },
          ],
          "Submit New Payment",
          `${BASE_URL}/workspace/${workspaceId}/billing`,
          "Please ensure your payment screenshot clearly shows the transaction details and try again."
        );
        break;
      }

      case "subscription_activated": {
        const expiresAt = subscription?.expires_at
          ? new Date(subscription.expires_at).toLocaleDateString("en-US", {
              year: "numeric",
              month: "long",
              day: "numeric",
            })
          : "N/A";

        subject = "🎉 Subscription Activated!";
        emailHtml = generateEmailHtml(
          "linear-gradient(135deg, #22c55e 0%, #16a34a 100%)",
          "Subscription Active",
          "#22c55e",
          "✨ Active",
          `Your <strong>${subscription?.plan?.name || planName}</strong> subscription for <strong>${workspace.name}</strong> is now active!`,
          [
            { label: "Plan", value: subscription?.plan?.name || planName || "N/A" },
            { label: "Workspace", value: workspace.name },
            { label: "Valid Until", value: expiresAt },
          ],
          "Explore Features",
          `${BASE_URL}/workspace/${workspaceId}`,
          "Thank you for choosing Hamro Task!"
        );
        break;
      }

      case "subscription_expiring": {
        const days = daysUntilExpiry || 7;
        const expDate = expiryDate
          ? new Date(expiryDate).toLocaleDateString("en-US", {
              year: "numeric",
              month: "long",
              day: "numeric",
            })
          : subscription?.expires_at
          ? new Date(subscription.expires_at).toLocaleDateString("en-US", {
              year: "numeric",
              month: "long",
              day: "numeric",
            })
          : "Soon";

        subject = `⚠️ Subscription Expiring in ${days} Days`;
        emailHtml = generateEmailHtml(
          "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)",
          "Subscription Expiring Soon",
          "#f59e0b",
          `⏰ ${days} Days Left`,
          `Your subscription for <strong>${workspace.name}</strong> will expire soon. Renew now to continue enjoying all features.`,
          [
            { label: "Current Plan", value: subscription?.plan?.name || planName || "N/A" },
            { label: "Expires On", value: expDate },
            { label: "Workspace", value: workspace.name },
          ],
          "Renew Now",
          `${BASE_URL}/workspace/${workspaceId}/billing`,
          "Renew before expiry to avoid any service interruption."
        );
        break;
      }

      case "subscription_expired": {
        subject = "🔴 Subscription Expired";
        emailHtml = generateEmailHtml(
          "linear-gradient(135deg, #ef4444 0%, #dc2626 100%)",
          "Subscription Expired",
          "#ef4444",
          "⚠️ Expired",
          `Your subscription for <strong>${workspace.name}</strong> has expired. Some features are now limited.`,
          [
            { label: "Previous Plan", value: subscription?.plan?.name || planName || "N/A" },
            { label: "Workspace", value: workspace.name },
            { label: "Status", value: "Limited Access" },
          ],
          "Reactivate Now",
          `${BASE_URL}/workspace/${workspaceId}/billing`,
          "Reactivate your subscription to regain full access to all features."
        );
        break;
      }

      case "trial_ending": {
        const days = daysUntilExpiry || 3;
        subject = `Trial Ending in ${days} Days`;
        emailHtml = generateEmailHtml(
          "linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)",
          "Trial Ending Soon",
          "#3b82f6",
          `🕐 ${days} Days Left`,
          `Your trial for <strong>${workspace.name}</strong> is ending soon. Upgrade now to keep your premium features.`,
          [
            { label: "Current Status", value: "Trial" },
            { label: "Trial Ends", value: expiryDate || "In " + days + " days" },
            { label: "Workspace", value: workspace.name },
          ],
          "Upgrade Now",
          `${BASE_URL}/workspace/${workspaceId}/billing`,
          "Upgrade before your trial ends to continue without interruption."
        );
        break;
      }

      default:
        throw new Error(`Unknown notification type: ${type}`);
    }

    // Send emails
    const emailPromises = recipients.map((email) =>
      resend.emails.send({
        from: "Hamro Task <info@saipalregmi.com.np>",
        to: [email],
        subject: subject,
        html: emailHtml,
      })
    );

    const results = await Promise.allSettled(emailPromises);
    const successCount = results.filter((r) => r.status === "fulfilled").length;
    const failCount = results.filter((r) => r.status === "rejected").length;

    console.log(`Emails sent: ${successCount} success, ${failCount} failed`);

    return new Response(
      JSON.stringify({
        success: true,
        sent: successCount,
        failed: failCount,
        type,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("Error in send-payment-notification:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
