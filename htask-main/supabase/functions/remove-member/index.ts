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
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    // Get authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: 'Authorization required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create client with user's token for auth check
    const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    // Verify user and get their ID
    const { data: { user: callerUser }, error: authError } = await supabaseUser.auth.getUser();
    if (authError || !callerUser) {
      console.error('Auth error:', authError);
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid authentication' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { membershipId, workspaceId, userId: targetUserId } = await req.json();

    if (!membershipId || !workspaceId || !targetUserId) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing required fields: membershipId, workspaceId, userId' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Processing member removal: membershipId=${membershipId}, workspaceId=${workspaceId}, targetUserId=${targetUserId}`);

    // Check if caller has permission (owner or admin of the workspace)
    const { data: callerMembership, error: callerError } = await supabaseUser
      .from('workspace_members')
      .select('role')
      .eq('workspace_id', workspaceId)
      .eq('user_id', callerUser.id)
      .single();

    if (callerError || !callerMembership) {
      console.error('Caller membership error:', callerError);
      return new Response(
        JSON.stringify({ success: false, error: 'You are not a member of this workspace' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (callerMembership.role !== 'owner' && callerMembership.role !== 'admin') {
      return new Response(
        JSON.stringify({ success: false, error: 'Only owners and admins can remove members' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create admin client for privileged operations
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Check if target user is the owner of this workspace
    const { data: targetMembership, error: targetError } = await supabaseAdmin
      .from('workspace_members')
      .select('role')
      .eq('id', membershipId)
      .eq('user_id', targetUserId)
      .single();

    if (targetError || !targetMembership) {
      console.error('Target membership error:', targetError);
      return new Response(
        JSON.stringify({ success: false, error: 'Member not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (targetMembership.role === 'owner') {
      return new Response(
        JSON.stringify({ success: false, error: 'Cannot remove the workspace owner' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Remove from workspace_members first
    const { error: deleteError } = await supabaseAdmin
      .from('workspace_members')
      .delete()
      .eq('id', membershipId);

    if (deleteError) {
      console.error('Delete membership error:', deleteError);
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to remove member from workspace' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Member removed from workspace successfully`);

    // Check if user owns any workspace
    const { data: ownedWorkspaces, error: ownedError } = await supabaseAdmin
      .from('workspace_members')
      .select('id')
      .eq('user_id', targetUserId)
      .eq('role', 'owner');

    if (ownedError) {
      console.error('Error checking owned workspaces:', ownedError);
      // Don't fail the whole operation, member was already removed
      return new Response(
        JSON.stringify({ 
          success: true, 
          memberRemoved: true, 
          userDeleted: false,
          message: 'Member removed from workspace' 
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // If user owns any workspace, don't delete them
    if (ownedWorkspaces && ownedWorkspaces.length > 0) {
      console.log(`User owns ${ownedWorkspaces.length} workspace(s), not deleting user account`);
      return new Response(
        JSON.stringify({ 
          success: true, 
          memberRemoved: true, 
          userDeleted: false,
          message: 'Member removed from workspace (user has other workspaces)' 
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if user is a member of any other workspaces
    const { data: otherMemberships, error: membershipError } = await supabaseAdmin
      .from('workspace_members')
      .select('id')
      .eq('user_id', targetUserId);

    if (membershipError) {
      console.error('Error checking other memberships:', membershipError);
      return new Response(
        JSON.stringify({ 
          success: true, 
          memberRemoved: true, 
          userDeleted: false,
          message: 'Member removed from workspace' 
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // If user has other memberships, don't delete them
    if (otherMemberships && otherMemberships.length > 0) {
      console.log(`User is a member of ${otherMemberships.length} other workspace(s), not deleting user account`);
      return new Response(
        JSON.stringify({ 
          success: true, 
          memberRemoved: true, 
          userDeleted: false,
          message: 'Member removed from workspace (user has other memberships)' 
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // User has no workspaces - delete profile first (cascade will handle related data)
    console.log('User has no workspaces, proceeding with full account deletion');

    const { error: profileDeleteError } = await supabaseAdmin
      .from('profiles')
      .delete()
      .eq('id', targetUserId);

    if (profileDeleteError) {
      console.error('Error deleting profile:', profileDeleteError);
      // Don't fail - continue to try deleting auth user
    } else {
      console.log('Profile deleted successfully');
    }

    // Delete from auth.users
    const { error: authDeleteError } = await supabaseAdmin.auth.admin.deleteUser(targetUserId);

    if (authDeleteError) {
      console.error('Error deleting auth user:', authDeleteError);
      return new Response(
        JSON.stringify({ 
          success: true, 
          memberRemoved: true, 
          userDeleted: false,
          message: 'Member removed but could not delete user account',
          error: authDeleteError.message
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('User account deleted successfully');

    return new Response(
      JSON.stringify({ 
        success: true, 
        memberRemoved: true, 
        userDeleted: true,
        message: 'Member removed and user account deleted' 
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Unexpected error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
