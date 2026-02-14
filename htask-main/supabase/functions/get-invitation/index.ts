import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

type GetInvitationRequest = {
  token?: string;
};

const isLikelyToken = (token: string) => {
  // Stored tokens are hex via encode(gen_random_bytes(32),'hex') => 64 chars
  return /^[a-f0-9]{32,128}$/i.test(token);
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }

  try {
    const body = (await req.json().catch(() => ({}))) as GetInvitationRequest;
    const token = (body.token || "").trim();

    if (!token || !isLikelyToken(token)) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !serviceRoleKey) {
      console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
      return new Response(JSON.stringify({ error: "Server configuration error" }), {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });

    const { data: invitation, error: inviteError } = await admin
      .from("workspace_invitations")
      .select("id,email,role,workspace_id,expires_at")
      .eq("token", token)
      .maybeSingle();

    if (inviteError) {
      console.error("Invite fetch error:", inviteError);
      return new Response(JSON.stringify({ error: "Failed to load invitation" }), {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    if (!invitation) {
      return new Response(JSON.stringify({ error: "Invitation not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const { data: workspace, error: wsError } = await admin
      .from("workspaces")
      .select("id,name,description")
      .eq("id", invitation.workspace_id)
      .maybeSingle();

    if (wsError) {
      console.error("Workspace fetch error:", wsError);
    }

    return new Response(
      JSON.stringify({
        invitation,
        workspace: workspace ?? null,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      },
    );
  } catch (e) {
    console.error("get-invitation error:", e);
    const msg = e instanceof Error ? e.message : "Unknown error";
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});
