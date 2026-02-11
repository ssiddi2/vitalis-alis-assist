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
      const { email, full_name, role, hospital_ids, hospital_id, avatar_url } = body;

      if (!email || !full_name || !role) {
        return new Response(JSON.stringify({ error: "Missing required fields: email, full_name, role" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (!["admin", "clinician", "viewer"].includes(role)) {
        return new Response(JSON.stringify({ error: "Invalid role. Must be admin, clinician, or viewer." }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return new Response(JSON.stringify({ error: "Invalid email format" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

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

      if (avatar_url) {
        await adminClient.from("profiles").update({ avatar_url, full_name }).eq("user_id", userId);
      }

      if (role !== "viewer") {
        await adminClient.from("user_roles").update({ role }).eq("user_id", userId);
      }

      // Support multi-hospital assignment
      const hospitalList: string[] = hospital_ids || (hospital_id ? [hospital_id] : []);
      for (const hId of hospitalList) {
        const accessLevel = role === "admin" ? "admin" : role === "clinician" ? "write" : "view";
        await adminClient.from("hospital_users").insert({ user_id: userId, hospital_id: hId, access_level: accessLevel });
      }

      return new Response(
        JSON.stringify({ success: true, message: `Invitation sent to ${email}`, user: { user_id: userId, email, full_name, role } }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ---- UPDATE USER ----
    if (action === "update_user") {
      const { target_user_id, role, hospital_ids } = body;

      if (!target_user_id) {
        return new Response(JSON.stringify({ error: "Missing target_user_id" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Update role
      if (role && ["admin", "clinician", "viewer"].includes(role)) {
        await adminClient.from("user_roles").update({ role }).eq("user_id", target_user_id);
      }

      // Update hospital assignments - replace all
      if (Array.isArray(hospital_ids)) {
        // Remove existing assignments
        await adminClient.from("hospital_users").delete().eq("user_id", target_user_id);

        // Insert new assignments
        const accessLevel = role === "admin" ? "admin" : role === "clinician" ? "write" : "view";
        for (const hId of hospital_ids) {
          await adminClient.from("hospital_users").insert({ user_id: target_user_id, hospital_id: hId, access_level: accessLevel });
        }
      }

      return new Response(
        JSON.stringify({ success: true, message: "User updated" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ---- DEACTIVATE USER ----
    if (action === "deactivate_user") {
      const { target_user_id } = body;

      if (!target_user_id) {
        return new Response(JSON.stringify({ error: "Missing target_user_id" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Prevent self-deactivation
      if (target_user_id === caller.id) {
        return new Response(JSON.stringify({ error: "Cannot deactivate your own account" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { error: banError } = await adminClient.auth.admin.updateUserById(target_user_id, {
        ban_duration: "876600h", // ~100 years
      });

      if (banError) {
        return new Response(JSON.stringify({ error: banError.message }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(
        JSON.stringify({ success: true, message: "User deactivated" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ---- RESEND INVITE ----
    if (action === "resend_invite") {
      const { email } = body;

      if (!email) {
        return new Response(JSON.stringify({ error: "Missing email" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(email);

      if (inviteError) {
        return new Response(JSON.stringify({ error: inviteError.message }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(
        JSON.stringify({ success: true, message: `Invitation resent to ${email}` }),
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
