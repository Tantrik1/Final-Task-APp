import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "npm:resend@2.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface InvitationRequest {
  email: string;
  workspaceId: string;
  workspaceName: string;
  inviterName: string;
  role: string;
  // New optional fields for advanced invite
  fullName?: string;
  password?: string;
  credentialEmail?: string;
}

// Default password for new invited users
const DEFAULT_PASSWORD = "Hamrotask123!";

// Modern, vibrant email template for new user invitation with credentials
const getNewUserEmailTemplate = (inviterName: string, workspaceName: string, role: string, email: string, password: string, loginUrl: string, userName: string) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="light">
  <meta name="supported-color-schemes" content="light">
  <!--[if mso]>
  <noscript>
    <xml>
      <o:OfficeDocumentSettings>
        <o:PixelsPerInch>96</o:PixelsPerInch>
      </o:OfficeDocumentSettings>
    </xml>
  </noscript>
  <![endif]-->
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background: linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #0f172a 100%); min-height: 100vh;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background: linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #0f172a 100%); padding: 48px 20px;">
    <tr>
      <td align="center">
        <!-- Main card -->
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; background: rgba(255, 255, 255, 0.05); backdrop-filter: blur(10px); border-radius: 24px; overflow: hidden; border: 1px solid rgba(255, 255, 255, 0.1); box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);">
          
          <!-- Header with gradient -->
          <tr>
            <td style="background: linear-gradient(135deg, #f97316 0%, #ea580c 50%, #c2410c 100%); padding: 48px 40px; text-align: center; position: relative;">
              <!-- Logo/Brand -->
              <table cellpadding="0" cellspacing="0" style="margin: 0 auto;">
                <tr>
                  <td style="background: rgba(255, 255, 255, 0.2); border-radius: 16px; padding: 12px 24px;">
                    <h1 style="margin: 0; color: #ffffff; font-size: 32px; font-weight: 800; letter-spacing: -0.5px; text-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                      🔑 Hamro Task
                    </h1>
                  </td>
                </tr>
              </table>
              <p style="margin: 16px 0 0; color: rgba(255, 255, 255, 0.9); font-size: 14px; font-weight: 500; text-transform: uppercase; letter-spacing: 2px;">
                Your Login Credentials
              </p>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 48px 40px; background: #ffffff;">
              <!-- Welcome badge -->
              <table cellpadding="0" cellspacing="0" style="margin-bottom: 24px;">
                <tr>
                  <td style="background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%); border-radius: 100px; padding: 8px 16px;">
                    <span style="color: #92400e; font-size: 14px; font-weight: 600;">🎉 Welcome to the team, ${userName}!</span>
                  </td>
                </tr>
              </table>
              
              <h2 style="margin: 0 0 24px; color: #0f172a; font-size: 28px; font-weight: 700; line-height: 1.3;">
                You've been invited to join ${workspaceName}
              </h2>
              
              <p style="margin: 0 0 24px; color: #475569; font-size: 16px; line-height: 1.7;">
                <strong style="color: #0f172a;">${inviterName}</strong> has invited you to collaborate. Your account has been created with the following credentials:
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
                          <p style="margin: 0 0 4px; color: #64748b; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px;">Temporary Password</p>
                          <p style="margin: 0; color: #0f172a; font-size: 16px; font-weight: 600; font-family: monospace; background: #ffffff; padding: 8px 12px; border-radius: 8px; border: 1px solid #e2e8f0;">${password}</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
              
              <!-- Role badge -->
              <table cellpadding="0" cellspacing="0" style="margin-bottom: 24px;">
                <tr>
                  <td style="background: linear-gradient(135deg, #f97316 0%, #ea580c 100%); border-radius: 8px; padding: 12px 20px;">
                    <span style="color: #ffffff; font-size: 14px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px;">
                      Your Role: ${role}
                    </span>
                  </td>
                </tr>
              </table>
              
              <!-- Security Warning -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 32px;">
                <tr>
                  <td style="background: #fef2f2; border-radius: 12px; padding: 16px 20px; border-left: 4px solid #ef4444;">
                    <p style="margin: 0; color: #991b1b; font-size: 14px; font-weight: 600; line-height: 1.5;">
                      ⚠️ Security Notice: For your protection, please change your password immediately after your first login.
                    </p>
                  </td>
                </tr>
              </table>
              
              <!-- CTA Button -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center">
                    <a href="${loginUrl}" style="display: inline-block; background: linear-gradient(135deg, #f97316 0%, #ea580c 50%, #dc2626 100%); color: #ffffff; text-decoration: none; padding: 18px 56px; border-radius: 14px; font-size: 16px; font-weight: 700; letter-spacing: 0.5px; box-shadow: 0 10px 40px rgba(249, 115, 22, 0.4), 0 4px 6px rgba(0, 0, 0, 0.1); transition: all 0.3s ease;">
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
                If you didn't expect this invitation, you can safely ignore this email.
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

// Modern email template for existing user being added to workspace
const getExistingUserEmailTemplate = (userName: string, inviterName: string, workspaceName: string, role: string, workspaceUrl: string) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="light">
  <meta name="supported-color-schemes" content="light">
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background: linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #0f172a 100%); min-height: 100vh;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background: linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #0f172a 100%); padding: 48px 20px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; background: rgba(255, 255, 255, 0.05); backdrop-filter: blur(10px); border-radius: 24px; overflow: hidden; border: 1px solid rgba(255, 255, 255, 0.1); box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);">
          
          <!-- Header with gradient -->
          <tr>
            <td style="background: linear-gradient(135deg, #10b981 0%, #059669 50%, #047857 100%); padding: 48px 40px; text-align: center; position: relative;">
              <table cellpadding="0" cellspacing="0" style="margin: 0 auto;">
                <tr>
                  <td style="background: rgba(255, 255, 255, 0.2); border-radius: 16px; padding: 12px 24px;">
                    <h1 style="margin: 0; color: #ffffff; font-size: 32px; font-weight: 800; letter-spacing: -0.5px;">
                      🎊 Hamro Task
                    </h1>
                  </td>
                </tr>
              </table>
              <p style="margin: 16px 0 0; color: rgba(255, 255, 255, 0.9); font-size: 14px; font-weight: 500; text-transform: uppercase; letter-spacing: 2px;">
                New Workspace Access
              </p>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 48px 40px; background: #ffffff;">
              <!-- Success badge -->
              <table cellpadding="0" cellspacing="0" style="margin-bottom: 24px;">
                <tr>
                  <td style="background: linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%); border-radius: 100px; padding: 8px 16px;">
                    <span style="color: #065f46; font-size: 14px; font-weight: 600;">✅ You're in!</span>
                  </td>
                </tr>
              </table>
              
              <h2 style="margin: 0 0 24px; color: #0f172a; font-size: 28px; font-weight: 700; line-height: 1.3;">
                Hey ${userName}! 👋
              </h2>
              
              <p style="margin: 0 0 24px; color: #475569; font-size: 16px; line-height: 1.7;">
                Great news! <strong style="color: #0f172a;">${inviterName}</strong> has added you to <strong style="color: #0f172a;">${workspaceName}</strong>.
              </p>
              
              <!-- Role badge -->
              <table cellpadding="0" cellspacing="0" style="margin-bottom: 32px;">
                <tr>
                  <td style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); border-radius: 8px; padding: 12px 20px;">
                    <span style="color: #ffffff; font-size: 14px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px;">
                      Your Role: ${role}
                    </span>
                  </td>
                </tr>
              </table>
              
              <p style="margin: 0 0 32px; color: #64748b; font-size: 15px; line-height: 1.7;">
                You can now access this workspace in your Hamro Task account. Click below to jump straight in!
              </p>
              
              <!-- CTA Button -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center">
                    <a href="${workspaceUrl}" style="display: inline-block; background: linear-gradient(135deg, #10b981 0%, #059669 50%, #047857 100%); color: #ffffff; text-decoration: none; padding: 18px 56px; border-radius: 14px; font-size: 16px; font-weight: 700; letter-spacing: 0.5px; box-shadow: 0 10px 40px rgba(16, 185, 129, 0.4), 0 4px 6px rgba(0, 0, 0, 0.1);">
                      🏠 Go to Workspace
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
                You're receiving this because ${inviterName} added you to ${workspaceName}.
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
  console.log("send-invitation function called");

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

    // Robust Bearer parsing
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

    // Verify caller using admin client (service role can verify any JWT)
    const { data: { user: caller }, error: authError } = await adminClient.auth.getUser(token);
    if (authError || !caller) {
      console.error("Auth error:", authError);
      return new Response(JSON.stringify({ success: false, error: "Unauthorized", code: "INVALID_TOKEN" }), {
        status: 401,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const callerId = caller.id;

    const { email, workspaceId, workspaceName, inviterName, role, fullName, password, credentialEmail }: InvitationRequest = await req.json();
    console.log("Invitation request:", { email, workspaceId, workspaceName, inviterName, role, fullName: fullName ? "provided" : "not provided", password: password ? "custom" : "default", credentialEmail: credentialEmail || "same as account" });

    // Validate required fields
    if (!email || !workspaceId || !workspaceName || !inviterName || !role) {
      console.error("Missing required fields");
      return new Response(JSON.stringify({ success: false, error: "Missing required fields", code: "MISSING_FIELDS" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    if (role === "owner") {
      return new Response(JSON.stringify({ success: false, error: "Cannot invite users as owner", code: "INVALID_ROLE" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Enforce that caller can invite (owner/admin)
    const { data: callerMembership, error: membershipError } = await adminClient
      .from("workspace_members")
      .select("role")
      .eq("workspace_id", workspaceId)
      .eq("user_id", callerId)
      .maybeSingle();

    if (membershipError) {
      console.error("Error checking inviter role:", membershipError);
      return new Response(JSON.stringify({ success: false, error: "Server error", code: "DB_ERROR" }), {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    if (!callerMembership || (callerMembership.role !== "owner" && callerMembership.role !== "admin")) {
      return new Response(JSON.stringify({ success: false, error: "You don't have permission to invite members", code: "FORBIDDEN" }), {
        status: 403,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const trimmedEmail = email.toLowerCase().trim();
    const baseUrl = "https://htask.lovable.app";

    // Use provided fullName or fallback to email prefix
    const providedFullName = fullName?.trim() || trimmedEmail.split("@")[0];
    // Use provided password or default
    const userPassword = password?.trim() || DEFAULT_PASSWORD;
    // Credential email defaults to account email
    const emailForCredentials = credentialEmail?.trim() || trimmedEmail;

    // ======================================================================
    // Stage 1: Try to find existing user via profiles table
    // ======================================================================
    console.log("Looking up user in profiles table:", trimmedEmail);
    const { data: existingProfile, error: profileError } = await adminClient
      .from("profiles")
      .select("id, full_name")
      .ilike("email", trimmedEmail)
      .maybeSingle();

    if (profileError) {
      console.error("Error checking profiles:", profileError);
      return new Response(JSON.stringify({ success: false, error: "Server error", code: "PROFILE_LOOKUP_ERROR" }), {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    let userId: string;
    let userName: string;

    if (existingProfile) {
      // User exists
      console.log("Found existing user in profiles:", existingProfile.id);
      userId = existingProfile.id;
      userName = existingProfile.full_name || providedFullName;

      // Check if already a workspace member
      const { data: existingMember } = await adminClient
        .from("workspace_members")
        .select("id")
        .eq("workspace_id", workspaceId)
        .eq("user_id", userId)
        .maybeSingle();

      if (existingMember) {
        console.log("User is already a member");
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: "This user is already a member of the workspace",
            code: "ALREADY_MEMBER",
            isNewUser: false 
          }),
          { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      // Add existing user to workspace
      const { error: memberError } = await adminClient
        .from("workspace_members")
        .insert({
          workspace_id: workspaceId,
          user_id: userId,
          role: role,
          invited_by: callerId,
        });

      if (memberError) {
        // Handle unique constraint violation (race condition)
        if (memberError.code === "23505") {
          return new Response(
            JSON.stringify({ 
              success: false, 
              error: "This user is already a member of the workspace",
              code: "ALREADY_MEMBER",
              isNewUser: false 
            }),
            { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
          );
        }
        console.error("Error adding member:", memberError);
        return new Response(
          JSON.stringify({ success: false, error: "Failed to add member to workspace", code: "INSERT_ERROR" }),
          { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      // Send "You've been added" email to existing user
      console.log("Sending 'added to workspace' email to:", trimmedEmail);
      const workspaceUrl = `${baseUrl}/workspace/${workspaceId}`;

      await resend.emails.send({
        from: "Hamro Task <info@saipalregmi.com.np>",
        to: [trimmedEmail],
        subject: `🎊 You've been added to ${workspaceName}`,
        html: getExistingUserEmailTemplate(userName, inviterName, workspaceName, role, workspaceUrl),
      });

      console.log("Existing user added to workspace successfully");
      return new Response(
        JSON.stringify({ 
          success: true, 
          isNewUser: false, 
          message: "User has been added to the workspace" 
        }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // ======================================================================
    // Stage 2: No profile found - create new user with password
    // ======================================================================
    console.log("No profile found, creating new user for:", trimmedEmail);
    console.log("Using password:", userPassword === DEFAULT_PASSWORD ? "default" : "custom");
    console.log("Full name:", providedFullName);
    
    const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
      email: trimmedEmail,
      password: userPassword,
      email_confirm: true, // Auto-confirm email
      user_metadata: {
        full_name: providedFullName,
      },
    });

    // Handle "already registered" error by re-checking profiles (trigger may have created it)
    if (createError) {
      console.log("Create user error:", createError.message);
      
      // If user already exists, try fetching from profiles again (trigger may have just created it)
      if (createError.message?.includes("already") || createError.message?.includes("registered")) {
        console.log("User already registered, re-checking profiles...");
        
        // Brief delay to allow trigger to complete
        await new Promise(resolve => setTimeout(resolve, 500));
        
        const { data: retryProfile } = await adminClient
          .from("profiles")
          .select("id, full_name")
          .ilike("email", trimmedEmail)
          .maybeSingle();

        if (retryProfile) {
          userId = retryProfile.id;
          userName = retryProfile.full_name || providedFullName;

          // Check if already member
          const { data: existingMember } = await adminClient
            .from("workspace_members")
            .select("id")
            .eq("workspace_id", workspaceId)
            .eq("user_id", userId)
            .maybeSingle();

          if (existingMember) {
            return new Response(
              JSON.stringify({ 
                success: false, 
                error: "This user is already a member of the workspace",
                code: "ALREADY_MEMBER",
                isNewUser: false 
              }),
              { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
            );
          }

          // Add to workspace
          const { error: memberError } = await adminClient
            .from("workspace_members")
            .insert({
              workspace_id: workspaceId,
              user_id: userId,
              role: role,
              invited_by: callerId,
            });

          if (memberError && memberError.code !== "23505") {
            console.error("Error adding existing user as member:", memberError);
            return new Response(
              JSON.stringify({ success: false, error: "Failed to add member to workspace", code: "INSERT_ERROR" }),
              { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
            );
          }

          // Send "You've been added" email
          const workspaceUrl = `${baseUrl}/workspace/${workspaceId}`;
          await resend.emails.send({
            from: "Hamro Task <info@saipalregmi.com.np>",
            to: [trimmedEmail],
            subject: `🎊 You've been added to ${workspaceName}`,
            html: getExistingUserEmailTemplate(userName, inviterName, workspaceName, role, workspaceUrl),
          });

          console.log("Existing user (from retry) added to workspace successfully");
          return new Response(
            JSON.stringify({ 
              success: true, 
              isNewUser: false, 
              message: "User has been added to the workspace" 
            }),
            { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
          );
        }
      }

      // If we still can't find/create the user, return error
      console.error("Failed to create or find user:", createError);
      return new Response(
        JSON.stringify({ success: false, error: createError.message || "Failed to create user", code: "CREATE_USER_ERROR" }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    if (!newUser?.user) {
      console.error("No user returned from createUser");
      return new Response(
        JSON.stringify({ success: false, error: "Failed to create user", code: "NO_USER_RETURNED" }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    userId = newUser.user.id;
    userName = providedFullName;
    console.log("New user created:", userId, "with name:", userName);

    // Update profile with provided full name and mark for password reset
    console.log("Updating profile with full name and needs_password_reset = true");
    const { error: updateProfileError } = await adminClient
      .from("profiles")
      .update({ 
        full_name: providedFullName,
        needs_password_reset: true 
      })
      .eq("id", userId);

    if (updateProfileError) {
      console.error("Error updating profile:", updateProfileError);
      // Don't fail - user was created, this is non-critical
    }

    // Add new user to workspace
    const { error: memberInsertError } = await adminClient
      .from("workspace_members")
      .insert({
        workspace_id: workspaceId,
        user_id: userId,
        role: role,
        invited_by: callerId,
      });

    if (memberInsertError) {
      console.error("Error adding new user to workspace:", memberInsertError);
      // Don't fail completely - user was created, just membership failed
    }

    // Send credentials email to specified recipient (could be different from account email)
    const loginUrl = `${baseUrl}/auth`;
    console.log("Sending credentials email to:", emailForCredentials, "(account:", trimmedEmail, ")");

    await resend.emails.send({
      from: "Hamro Task <info@saipalregmi.com.np>",
      to: [emailForCredentials],
      subject: `🔑 Login Credentials for ${userName} - Welcome to ${workspaceName}`,
      html: getNewUserEmailTemplate(inviterName, workspaceName, role, trimmedEmail, userPassword, loginUrl, userName),
    });

    console.log("Credentials email sent successfully to:", emailForCredentials);

    // Build success message
    const successMessage = emailForCredentials !== trimmedEmail 
      ? `Invitation sent! Credentials sent to ${emailForCredentials}` 
      : `Invitation sent! ${userName} will receive an email with their login credentials.`;

    return new Response(
      JSON.stringify({ 
        success: true, 
        isNewUser: true, 
        message: successMessage,
        credentialsSentTo: emailForCredentials
      }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Error in send-invitation function:", error);
    return new Response(JSON.stringify({ success: false, error: errorMessage, code: "INTERNAL_ERROR" }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
};

serve(handler);
