import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

const ingestOne = async (resource: any, patient_id?: string, hospital_id?: string) => {
  if (!resource?.resourceType) throw new Error('resourceType required');
  const resource_id = resource.id ?? crypto.randomUUID();
  resource.id = resource_id;
  resource.meta = { ...(resource.meta ?? {}), lastUpdated: new Date().toISOString() };
  const pid = patient_id ?? resource.subject?.reference?.split('/').pop();
  const { error } = await supabase.from('fhir_resources').insert({
    patient_id: pid ?? null,
    hospital_id: hospital_id ?? null,
    resource_type: resource.resourceType,
    resource_id,
    payload: resource,
  });
  if (error) throw error;
  return { resourceType: resource.resourceType, id: resource_id };
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    if (req.method === 'GET') {
      const url = new URL(req.url);
      const patient_id = url.searchParams.get('patient_id');
      const resource_type = url.searchParams.get('resource_type');
      let q = supabase.from('fhir_resources').select('*').order('created_at', { ascending: false }).limit(50);
      if (patient_id) q = q.eq('patient_id', patient_id);
      if (resource_type) q = q.eq('resource_type', resource_type);
      const { data, error } = await q;
      if (error) throw error;
      return json({ entry: data });
    }

    const body = await req.json();
    const { resource, bundle, patient_id, hospital_id } = body ?? {};
    if (bundle?.entry) {
      const results = [];
      for (const e of bundle.entry) results.push(await ingestOne(e.resource ?? e, patient_id, hospital_id));
      return json({ status: 'written', count: results.length, results });
    }
    const result = await ingestOne(resource, patient_id, hospital_id);
    return json({ status: 'written', ...result });
  } catch (e) {
    return json({ status: 'error', message: (e as Error).message }, 400);
  }
});
