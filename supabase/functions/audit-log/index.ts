import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders as buildCors } from '../_shared/cors.ts';
import { adminClient } from '../_shared/supabase.ts';



interface AuditLogRequest {
  action_type: 'view' | 'create' | 'update' | 'delete' | 'export' | 'sign' | 'approve' | 'login' | 'logout';
  resource_type: string;
  resource_id?: string;
  /**
   * Patient UUID (preferred). If your app uses external/non-UUID identifiers (e.g. EMR MRN like "pt-001"),
   * send it here anyway — the function will safely store it in metadata and set patient_id to null.
   */
  patient_id?: string;
  hospital_id?: string;
  metadata?: Record<string, unknown>;
  session_id?: string;
}

Deno.serve(async (req) => {
  const corsHeaders = buildCors(req);
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    // Get auth token from request
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Extract client info for audit
    const ipAddress = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 
                      req.headers.get('x-real-ip') || 
                      null;
    const userAgent = req.headers.get('user-agent') || null;

    // Parse request body
    const body: AuditLogRequest = await req.json();
    
    // Validate required fields
    if (!body.action_type || !body.resource_type) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: action_type, resource_type' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create Supabase client with user's auth token
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: { Authorization: authHeader }
      }
    });

    // Verify user is authenticated
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Coerce IDs to match DB function signature
    const isUuid = (value: string | null | undefined): value is string => {
      if (!value) return false;
      return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
    };

    const patientIdUuid = isUuid(body.patient_id) ? body.patient_id : null;
    const hospitalIdUuid = isUuid(body.hospital_id) ? body.hospital_id : null;

    const metadata: Record<string, unknown> = {
      ...(body.metadata ?? {}),
      ...(body.patient_id && !patientIdUuid ? { external_patient_id: body.patient_id } : {}),
      ...(body.hospital_id && !hospitalIdUuid ? { external_hospital_id: body.hospital_id } : {}),
    };

    // Insert with the service-role client (the SECURITY DEFINER routine is backend-only).
    // user_id comes from the verified JWT, never from the request body.
    const { data, error } = await adminClient()
      .from('audit_logs')
      .insert({
        user_id: user.id,
        action_type: body.action_type,
        resource_type: body.resource_type,
        resource_id: body.resource_id || null,
        patient_id: patientIdUuid,
        hospital_id: hospitalIdUuid,
        metadata,
        ip_address: ipAddress,
        user_agent: userAgent,
        session_id: body.session_id || null,
      })
      .select('id')
      .single();

    if (error) {
      console.error('Error logging audit event:', error);
      return new Response(
        JSON.stringify({ error: 'Failed to log audit event' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, log_id: data?.id }),

      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
