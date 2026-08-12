-- 1) patient_vitals: replace broad admin ALL policy with scoped UPDATE + DELETE
DROP POLICY IF EXISTS "Admins can manage same-hospital patient vitals" ON public.patient_vitals;

CREATE POLICY "Admins update same-hospital patient vitals"
ON public.patient_vitals FOR UPDATE TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role) AND EXISTS (
    SELECT 1 FROM public.patients p
    JOIN public.hospital_users hu ON hu.hospital_id = p.hospital_id
    WHERE p.id = patient_vitals.patient_id AND hu.user_id = auth.uid()
  )
)
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) AND EXISTS (
    SELECT 1 FROM public.patients p
    JOIN public.hospital_users hu ON hu.hospital_id = p.hospital_id
    WHERE p.id = patient_vitals.patient_id AND hu.user_id = auth.uid()
  )
);

CREATE POLICY "Admins delete same-hospital patient vitals"
ON public.patient_vitals FOR DELETE TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role) AND EXISTS (
    SELECT 1 FROM public.patients p
    JOIN public.hospital_users hu ON hu.hospital_id = p.hospital_id
    WHERE p.id = patient_vitals.patient_id AND hu.user_id = auth.uid()
  )
);

-- Policies cannot compare OLD/NEW: block patient reassignment outright.
CREATE OR REPLACE FUNCTION public.prevent_vitals_reassignment()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.patient_id IS DISTINCT FROM OLD.patient_id THEN
    RAISE EXCEPTION 'patient_vitals cannot be reassigned to another patient';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.prevent_vitals_reassignment() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS prevent_vitals_reassignment ON public.patient_vitals;
CREATE TRIGGER prevent_vitals_reassignment
BEFORE UPDATE ON public.patient_vitals
FOR EACH ROW EXECUTE FUNCTION public.prevent_vitals_reassignment();

-- 2) team_channels: server-side actor stamping, no caller-supplied trust
CREATE OR REPLACE FUNCTION public.stamp_team_channel_actor()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.created_by := COALESCE(auth.uid(), NEW.created_by);
    RETURN NEW;
  END IF;
  IF NEW.created_by IS DISTINCT FROM OLD.created_by
     OR NEW.hospital_id IS DISTINCT FROM OLD.hospital_id THEN
    RAISE EXCEPTION 'team_channels creator and hospital are immutable';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.stamp_team_channel_actor() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS stamp_team_channel_actor ON public.team_channels;
CREATE TRIGGER stamp_team_channel_actor
BEFORE INSERT OR UPDATE ON public.team_channels
FOR EACH ROW EXECUTE FUNCTION public.stamp_team_channel_actor();

DROP POLICY IF EXISTS "Channel creators can update" ON public.team_channels;
CREATE POLICY "Channel creators can update"
ON public.team_channels FOR UPDATE TO authenticated
USING (
  (created_by = auth.uid() OR has_role(auth.uid(), 'admin'::app_role))
  AND EXISTS (
    SELECT 1 FROM public.hospital_users hu
    WHERE hu.user_id = auth.uid() AND hu.hospital_id = team_channels.hospital_id
  )
)
WITH CHECK (
  (created_by = auth.uid() OR has_role(auth.uid(), 'admin'::app_role))
  AND EXISTS (
    SELECT 1 FROM public.hospital_users hu
    WHERE hu.user_id = auth.uid() AND hu.hospital_id = team_channels.hospital_id
  )
  AND (patient_id IS NULL OR EXISTS (
    SELECT 1 FROM public.patients p
    WHERE p.id = team_channels.patient_id AND p.hospital_id = team_channels.hospital_id
  ))
);

DROP POLICY IF EXISTS "Users can view channels at their hospital" ON public.team_channels;
CREATE POLICY "Users can view channels at their hospital"
ON public.team_channels FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.hospital_users hu
    WHERE hu.user_id = auth.uid() AND hu.hospital_id = team_channels.hospital_id
  )
);