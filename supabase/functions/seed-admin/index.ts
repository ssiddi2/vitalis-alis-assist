import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const { email, password, role = 'admin' } = await req.json();
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Check existing
    const { data: list } = await supabase.auth.admin.listUsers();
    let user = list.users.find((u) => u.email === email);

    if (!user) {
      const { data, error } = await supabase.auth.admin.createUser({
        email, password, email_confirm: true,
        user_metadata: { full_name: 'Zain Safdar' },
      });
      if (error) throw error;
      user = data.user!;
    } else {
      await supabase.auth.admin.updateUserById(user.id, { password, email_confirm: true });
    }

    // Ensure profile
    await supabase.from('profiles').upsert({ user_id: user!.id, full_name: 'Zain Safdar' }, { onConflict: 'user_id' });

    // Set role
    await supabase.from('user_roles').delete().eq('user_id', user!.id);
    await supabase.from('user_roles').insert({ user_id: user!.id, role });

    // Attach to first hospital
    const { data: hospitals } = await supabase.from('hospitals').select('id').limit(1);
    if (hospitals?.[0]) {
      await supabase.from('hospital_users').upsert(
        { user_id: user!.id, hospital_id: hospitals[0].id, role: 'admin' },
        { onConflict: 'user_id,hospital_id' }
      );
    }

    return new Response(JSON.stringify({ ok: true, user_id: user!.id, email: user!.email }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e?.message ?? e) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
