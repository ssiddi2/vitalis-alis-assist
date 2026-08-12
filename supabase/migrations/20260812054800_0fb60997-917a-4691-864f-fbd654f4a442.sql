-- 1. Hospital-scope patients
DROP POLICY IF EXISTS "Clinicians can view patients" ON public.patients;
CREATE POLICY "Clinicians can view patients in their hospitals"
ON public.patients FOR SELECT TO authenticated
USING (
  (has_role(auth.uid(),'clinician'::app_role) OR has_role(auth.uid(),'admin'::app_role))
  AND hospital_id IN (SELECT hospital_id FROM public.hospital_users WHERE user_id = auth.uid())
);

-- 2. Patient-owned clinical tables
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['patient_allergies','patient_problems','patient_medications','immunizations','patient_vitals']
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'Clinicians can view ' || replace(t,'_',' '), t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'Clinicians can insert ' || replace(t,'_',' '), t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'Clinicians can update ' || replace(t,'_',' '), t);
  END LOOP;
END $$;

DROP POLICY IF EXISTS "Clinicians can view patient allergies" ON public.patient_allergies;
DROP POLICY IF EXISTS "Clinicians can insert patient allergies" ON public.patient_allergies;
DROP POLICY IF EXISTS "Clinicians can update patient allergies" ON public.patient_allergies;
DROP POLICY IF EXISTS "Clinicians can view patient problems" ON public.patient_problems;
DROP POLICY IF EXISTS "Clinicians can insert patient problems" ON public.patient_problems;
DROP POLICY IF EXISTS "Clinicians can update patient problems" ON public.patient_problems;
DROP POLICY IF EXISTS "Clinicians can view patient medications" ON public.patient_medications;
DROP POLICY IF EXISTS "Clinicians can insert patient medications" ON public.patient_medications;
DROP POLICY IF EXISTS "Clinicians can update patient medications" ON public.patient_medications;
DROP POLICY IF EXISTS "Clinicians can view immunizations" ON public.immunizations;
DROP POLICY IF EXISTS "Clinicians can insert immunizations" ON public.immunizations;
DROP POLICY IF EXISTS "Clinicians can update immunizations" ON public.immunizations;
DROP POLICY IF EXISTS "Clinicians can view patient vitals" ON public.patient_vitals;

DO $$
DECLARE t text; scope text;
BEGIN
  scope := '(has_role(auth.uid(),''clinician''::app_role) OR has_role(auth.uid(),''admin''::app_role)) AND EXISTS (SELECT 1 FROM public.patients p JOIN public.hospital_users hu ON hu.hospital_id = p.hospital_id AND hu.user_id = auth.uid() WHERE p.id = %1$I.patient_id)';
  FOREACH t IN ARRAY ARRAY['patient_allergies','patient_problems','patient_medications','immunizations']
  LOOP
    EXECUTE format('CREATE POLICY "Clinicians view own hospital rows" ON public.%1$I FOR SELECT TO authenticated USING (' || scope || ')', t);
    EXECUTE format('CREATE POLICY "Clinicians insert own hospital rows" ON public.%1$I FOR INSERT TO authenticated WITH CHECK (' || scope || ')', t);
    EXECUTE format('CREATE POLICY "Clinicians update own hospital rows" ON public.%1$I FOR UPDATE TO authenticated USING (' || scope || ') WITH CHECK (' || scope || ')', t);
  END LOOP;
  EXECUTE format('CREATE POLICY "Clinicians view own hospital rows" ON public.%1$I FOR SELECT TO authenticated USING (' || scope || ')', 'patient_vitals');
END $$;

-- 3. Template tables: global (null hospital) or own hospital
DROP POLICY IF EXISTS "Clinicians can view note templates" ON public.note_templates;
CREATE POLICY "Clinicians can view note templates"
ON public.note_templates FOR SELECT TO authenticated
USING (
  (has_role(auth.uid(),'clinician'::app_role) OR has_role(auth.uid(),'admin'::app_role))
  AND (hospital_id IS NULL OR hospital_id IN (SELECT hospital_id FROM public.hospital_users WHERE user_id = auth.uid()))
);

DROP POLICY IF EXISTS "Clinicians can view order sets" ON public.order_sets;
CREATE POLICY "Clinicians can view order sets"
ON public.order_sets FOR SELECT TO authenticated
USING (
  (has_role(auth.uid(),'clinician'::app_role) OR has_role(auth.uid(),'admin'::app_role))
  AND (hospital_id IS NULL OR hospital_id IN (SELECT hospital_id FROM public.hospital_users WHERE user_id = auth.uid()))
);

-- 4. SECURITY DEFINER audit writer is backend-only
REVOKE EXECUTE ON FUNCTION public.log_audit_event(public.audit_action_type, text, text, uuid, uuid, jsonb, inet, text, text) FROM authenticated, anon, PUBLIC;