import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "npm:resend@2.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface ResetPasswordRequest {
  userId: string;
  newPassword: string;
  sendCredentials: boolean;
  credentialEmail: string;
  memberName: string;
  workspaceName: string;
  adminName: string;
}

const getPasswordResetEmailTemplate = (memberName: string, adminName: string, workspaceName: string, email: string, password: string, loginUrl: string) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="light">
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background: linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #0f172a 100%); min-height: 100vh;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background: linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #0f172a 100%); padding: 48px 20px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; background: rgba(255, 255, 255, 0.05); backdrop-filter: blur(10px); border-radius: 24px; overflow: hidden; border: 1px solid rgba(255, 255, 255, 0.1); box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);">
          
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 50%, #6d28d9 100%); padding: 48px 40px; text-align: center;">
              <table cellpadding="0" cellspacing="0" style="margin: 0 auto;">
                <tr>
                  <td style="background: rgba(255, 255, 255, 0.2); border-radius: 16px; padding: 12px 24px;">
                    <h1 style="margin: 0; color: #ffffff; font-size: 32px; font-weight: 800; letter-spacing: -0.5px;">
                      🔐 Hamro Task
                    </h1>
                  </td>
                </tr>
              </table>
              <p style="margin: 16px 0 0; color: rgba(255, 255, 255, 0.9); font-size: 14px; font-weight: 500; text-transform: uppercase; letter-spacing: 2px;">
                Password Reset
              </p>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 48px 40px; background: #ffffff;">
              <!-- Badge -->
              <table cellpadding="0" cellspacing="0" style="margin-bottom: 24px;">
                <tr>
                  <td style="background: linear-gradient(135deg, #ede9fe 0%, #ddd6fe 100%); border-radius: 100px; padding: 8px 16px;">
                    <span style="color: #6d28d9; font-size: 14px; font-weight: 600;">🔑 New Password Set</span>
                  </td>
                </tr>
              </table>
              
              <h2 style="margin: 0 0 24px; color: #0f172a; font-size: 28px; font-weight: 700; line-height: 1.3;">
                Hi ${memberName}! 👋
              </h2>
              
              <p style="margin: 0 0 24px; color: #475569; font-size: 16px; line-height: 1.7;">
                <strong style="color: #0f172a;">${adminName}</strong> has reset your password for <strong style="color: #0f172a;">${workspaceName}</strong>. Here are your updated login credentials:
              </p>
              
              <!-- Credentials Box -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 24px; background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%); border-radius: 16px; border: 2px solid #e2e8f0;">
                <tr>
                  <td style="padding: 24px;">
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="padding-bottom: 16px; border-bottom: 1px solid #e2e8f0;">
                          <p style="margin: 0 0 4px; color: #64748b; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px;">Email</p>
                          <p style="margin: 0; color: #0f172a; font-size: 16px; font-weight: 600; font-family: monospace; background: #ffffff; padding: 8px 12px; border-radius: 8px; border: 1px solid #e2e8f0;">${email}</p>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding-top: 16px;">
                          <p style="margin: 0 0 4px; color: #64748b; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px;">New Password</p>
                          <p style="margin: 0; color: #0f172a; font-size: 16px; font-weight: 600; font-family: monospace; background: #ffffff; padding: 8px 12px; border-radius: 8px; border: 1px solid #e2e8f0;">${password}</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
              
              <!-- Security Warning -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 32px;">
                <tr>
                  <td style="background: #fef2f2; border-radius: 12px; padding: 16px 20px; border-left: 4px solid #ef4444;">
                    <p style="margin: 0; color: #991b1b; font-size: 14px; font-weight: 600; line-height: 1.5;">
                      ⚠️ Security Notice: For your protection, please change your password after logging in.
                    </p>
                  </td>
                </tr>
              </table>
              
              <!-- CTA Button -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center">
                    <a href="${loginUrl}" style="display: inline-block; background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 50%, #6d28d9 100%); color: #ffffff; text-decoration: none; padding: 18px 56px; border-radius: 14px; font-size: 16px; font-weight: 700; letter-spacing: 0.5px; box-shadow: 0 10px 40px rgba(139, 92, 246, 0.4), 0 4px 6px rgba(0, 0, 0, 0.1);">
                      🚀 Login Now
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%); padding: 32px 40px; text-align: center; border-top: 1px solid #e2e8f0;">
              <p style="margin: 0 0 8px; color: #64748b; font-size: 13px; line-height: 1.6;">
                If you didn't request this change, please contact your workspace admin immediately.
              </p>
              <p style="margin: 0; color: #94a3b8; font-size: 12px;">
                © ${new Date().getFullYear()} Hamro Task. Built with ❤️ for teams.
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

const handler = async (req: Request): Promise<Response> => {
  console.log("reset-member-password function called");

  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Verify auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      console.error("No authorization header");
      return new Response(JSON.stringify({ success: false, error: "Unauthorized", code: "NO_AUTH" }), {
        status: 401,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseServiceRoleKey) {
      console.error("Missing Supabase environment variables");
      return new Response(JSON.stringify({ success: false, error: "Server configuration error", code: "CONFIG_ERROR" }), {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const match = authHeader.match(/^Bearer\s+(.+)$/i);
    const token = match?.[1];
    if (!token) {
      console.error("Invalid authorization header format");
      return new Response(JSON.stringify({ success: false, error: "Unauthorized", code: "INVALID_TOKEN_FORMAT" }), {
        status: 401,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Admin client for privileged operations
    const adminClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // Verify caller
    const { data: { user: caller }, error: authError } = await adminClient.auth.getUser(token);
    if (authError || !caller) {
      console.error("Auth error:", authError);
      return new Response(JSON.stringify({ success: false, error: "Unauthorized", code: "INVALID_TOKEN" }), {
        status: 401,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const { userId, newPassword, sendCredentials, credentialEmail, memberName, workspaceName, adminName }: ResetPasswordRequest = await req.json();
    console.log("Reset password request for user:", userId);

    // Validate required fields
    if (!userId || !newPassword) {
      console.error("Missing required fields");
      return new Response(JSON.stringify({ success: false, error: "Missing required fields", code: "MISSING_FIELDS" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Validate password strength
    if (newPassword.length < 8 || !/[a-zA-Z]/.test(newPassword) || !/\d/.test(newPassword)) {
      return new Response(JSON.stringify({ success: false, error: "Password must be at least 8 characters with letters and numbers", code: "WEAK_PASSWORD" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Verify that the caller is an admin in at least one shared workspace with the target user
    const { data: callerWorkspaces } = await adminClient
      .from("workspace_members")
      .select("workspace_id, role")
      .eq("user_id", caller.id)
      .in("role", ["owner", "admin"]);

    if (!callerWorkspaces || callerWorkspaces.length === 0) {
      return new Response(JSON.stringify({ success: false, error: "You don't have permission to manage members", code: "FORBIDDEN" }), {
        status: 403,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const adminWorkspaceIds = callerWorkspaces.map(w => w.workspace_id);

    // Check if target user is in any of the caller's admin workspaces
    const { data: targetMembership } = await adminClient
      .from("workspace_members")
      .select("id, workspace_id")
      .eq("user_id", userId)
      .in("workspace_id", adminWorkspaceIds)
      .limit(1)
      .maybeSingle();

    if (!targetMembership) {
      return new Response(JSON.stringify({ success: false, error: "You can only manage members in your workspaces", code: "FORBIDDEN" }), {
        status: 403,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Get user's email
    const { data: userProfile } = await adminClient
      .from("profiles")
      .select("email")
      .eq("id", userId)
      .single();

    if (!userProfile) {
      return new Response(JSON.stringify({ success: false, error: "User not found", code: "USER_NOT_FOUND" }), {
        status: 404,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Reset the password using admin API
    console.log("Updating password for user:", userId);
    const { error: updateError } = await adminClient.auth.admin.updateUserById(userId, {
      password: newPassword,
    });

    if (updateError) {
      console.error("Error updating password:", updateError);
      return new Response(JSON.stringify({ success: false, error: updateError.message, code: "UPDATE_ERROR" }), {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Mark user as needing password reset
    await adminClient
      .from("profiles")
      .update({ needs_password_reset: true })
      .eq("id", userId);

    // Send credentials email if requested
    if (sendCredentials && credentialEmail) {
      console.log("Sending password reset email to:", credentialEmail);
      const loginUrl = "https://htask.lovable.app/auth";

      await resend.emails.send({
        from: "Hamro Task <info@saipalregmi.com.np>",
        to: [credentialEmail],
        subject: `🔐 Password Reset - ${memberName} - ${workspaceName}`,
        html: getPasswordResetEmailTemplate(memberName, adminName, workspaceName, userProfile.email, newPassword, loginUrl),
      });

      console.log("Password reset email sent successfully");
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: sendCredentials ? "Password reset and credentials sent" : "Password reset successfully"
      }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Error in reset-member-password function:", error);
    return new Response(JSON.stringify({ success: false, error: errorMessage, code: "INTERNAL_ERROR" }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
};

serve(handler);
