import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Verify the caller is an admin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const callerClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user: caller }, error: callerError } = await callerClient.auth.getUser();
    if (callerError || !caller) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    const { data: roleData } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", caller.id)
      .eq("role", "admin")
      .maybeSingle();

    if (!roleData) {
      return new Response(JSON.stringify({ error: "Forbidden: Admin access required" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Parse body once
    const body = await req.json();
    const { action } = body;

    // ---- LIST USERS ----
    if (action === "list_users") {
      const { data: profiles, error: profilesErr } = await adminClient
        .from("profiles")
        .select("user_id, full_name, avatar_url, created_at");

      if (profilesErr) throw profilesErr;

      const userIds = profiles?.map((p) => p.user_id) || [];

      const [rolesRes, hospitalUsersRes, hospitalsRes, authUsersRes] = await Promise.all([
        adminClient.from("user_roles").select("user_id, role").in("user_id", userIds),
        adminClient.from("hospital_users").select("user_id, hospital_id, access_level").in("user_id", userIds),
        adminClient.from("hospitals").select("id, name, code"),
        adminClient.auth.admin.listUsers({ perPage: 1000 }),
      ]);

      const hospitalMap = new Map(hospitalsRes.data?.map((h) => [h.id, h]) || []);
      const roleMap = new Map(rolesRes.data?.map((r) => [r.user_id, r.role]) || []);
      const emailMap = new Map(authUsersRes.data?.users?.map((u) => [u.id, u.email]) || []);

      const hospitalUserMap = new Map<string, Array<{ hospital_id: string; hospital_name: string; access_level: string }>>();
      for (const hu of hospitalUsersRes.data || []) {
        const existing = hospitalUserMap.get(hu.user_id) || [];
        const hospital = hospitalMap.get(hu.hospital_id);
        existing.push({
          hospital_id: hu.hospital_id,
          hospital_name: hospital?.name || "Unknown",
          access_level: hu.access_level,
        });
        hospitalUserMap.set(hu.user_id, existing);
      }

      const users = profiles?.map((p) => ({
        user_id: p.user_id,
        email: emailMap.get(p.user_id) || "Unknown",
        full_name: p.full_name,
        avatar_url: p.avatar_url,
        role: roleMap.get(p.user_id) || "viewer",
        hospitals: hospitalUserMap.get(p.user_id) || [],
        created_at: p.created_at,
      })) || [];

      return new Response(JSON.stringify({ users }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ---- CREATE USER (invite by email) ----
    if (action === "create_user") {
      const { email, full_name, role, hospital_id, avatar_url } = body;

      if (!email || !full_name || !role) {
        return new Response(JSON.stringify({ error: "Missing required fields: email, full_name, role" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Validate role
      if (!["admin", "clinician", "viewer"].includes(role)) {
        return new Response(JSON.stringify({ error: "Invalid role. Must be admin, clinician, or viewer." }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return new Response(JSON.stringify({ error: "Invalid email format" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Create user via admin API with invite
      const { data: newUser, error: createError } = await adminClient.auth.admin.inviteUserByEmail(email, {
        data: { full_name },
      });

      if (createError) {
        console.error("Error creating user:", createError);
        return new Response(JSON.stringify({ error: createError.message }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const userId = newUser.user.id;

      // Update profile with avatar if provided (profile is auto-created by trigger)
      if (avatar_url) {
        await adminClient
          .from("profiles")
          .update({ avatar_url, full_name })
          .eq("user_id", userId);
      }

      // Set the user role (trigger creates default 'viewer', update if different)
      if (role !== "viewer") {
        await adminClient
          .from("user_roles")
          .update({ role })
          .eq("user_id", userId);
      }

      // Assign to hospital if provided
      if (hospital_id) {
        const accessLevel = role === "admin" ? "admin" : role === "clinician" ? "write" : "view";
        await adminClient
          .from("hospital_users")
          .insert({
            user_id: userId,
            hospital_id,
            access_level: accessLevel,
          });
      }

      return new Response(
        JSON.stringify({
          success: true,
          message: `Invitation sent to ${email}`,
          user: { user_id: userId, email, full_name, role },
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(JSON.stringify({ error: "Invalid action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Admin user management error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
