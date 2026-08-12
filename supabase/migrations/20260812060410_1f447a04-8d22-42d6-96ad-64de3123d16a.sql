-- 1) Re-validate tenancy on UPDATE via explicit WITH CHECK clauses

DROP POLICY IF EXISTS "Clinicians can update appointments" ON public.appointments;
CREATE POLICY "Clinicians can update appointments" ON public.appointments
FOR UPDATE TO authenticated
USING (provider_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
WITH CHECK (
  public.has_role(auth.uid(), 'admin')
  OR (provider_id = auth.uid() AND EXISTS (
    SELECT 1 FROM public.hospital_users hu
    WHERE hu.user_id = auth.uid() AND hu.hospital_id = appointments.hospital_id))
);

DROP POLICY IF EXISTS "Providers can update their encounters" ON public.encounters;
CREATE POLICY "Providers can update their encounters" ON public.encounters
FOR UPDATE TO authenticated
USING (provider_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
WITH CHECK (
  public.has_role(auth.uid(), 'admin')
  OR (provider_id = auth.uid() AND EXISTS (
    SELECT 1 FROM public.hospital_users hu
    WHERE hu.user_id = auth.uid() AND hu.hospital_id = encounters.hospital_id))
);

DROP POLICY IF EXISTS "Authors can update clinical notes" ON public.clinical_notes;
CREATE POLICY "Authors can update clinical notes" ON public.clinical_notes
FOR UPDATE TO authenticated
USING (author_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
WITH CHECK (
  public.has_role(auth.uid(), 'admin')
  OR (author_id = auth.uid() AND EXISTS (
    SELECT 1 FROM public.patients p
    JOIN public.hospital_users hu ON hu.hospital_id = p.hospital_id
    WHERE p.id = clinical_notes.patient_id AND hu.user_id = auth.uid()))
);

DROP POLICY IF EXISTS "Prescribers can update their prescriptions" ON public.prescriptions;
CREATE POLICY "Prescribers can update their prescriptions" ON public.prescriptions
FOR UPDATE TO authenticated
USING (prescriber_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
WITH CHECK (
  public.has_role(auth.uid(), 'admin')
  OR (prescriber_id = auth.uid() AND EXISTS (
    SELECT 1 FROM public.patients p
    JOIN public.hospital_users hu ON hu.hospital_id = p.hospital_id
    WHERE p.id = prescriptions.patient_id AND hu.user_id = auth.uid()))
);

DROP POLICY IF EXISTS "Referring providers can update referrals" ON public.referrals;
CREATE POLICY "Referring providers can update referrals" ON public.referrals
FOR UPDATE TO authenticated
USING (referring_provider_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
WITH CHECK (
  public.has_role(auth.uid(), 'admin')
  OR (referring_provider_id = auth.uid() AND EXISTS (
    SELECT 1 FROM public.patients p
    JOIN public.hospital_users hu ON hu.hospital_id = p.hospital_id
    WHERE p.id = referrals.patient_id AND hu.user_id = auth.uid()))
);

DROP POLICY IF EXISTS "Users can update own staged orders" ON public.staged_orders;
CREATE POLICY "Users can update own staged orders" ON public.staged_orders
FOR UPDATE TO authenticated
USING (created_by = auth.uid() OR public.has_role(auth.uid(), 'admin'))
WITH CHECK (
  public.has_role(auth.uid(), 'admin')
  OR (created_by = auth.uid() AND EXISTS (
    SELECT 1 FROM public.patients p
    JOIN public.hospital_users hu ON hu.hospital_id = p.hospital_id
    WHERE p.id = staged_orders.patient_id AND hu.user_id = auth.uid()))
);

DROP POLICY IF EXISTS "Channel creators can update" ON public.team_channels;
CREATE POLICY "Channel creators can update" ON public.team_channels
FOR UPDATE TO authenticated
USING (created_by = auth.uid() OR public.has_role(auth.uid(), 'admin'))
WITH CHECK (
  public.has_role(auth.uid(), 'admin')
  OR (created_by = auth.uid() AND EXISTS (
    SELECT 1 FROM public.hospital_users hu
    WHERE hu.user_id = auth.uid() AND hu.hospital_id = team_channels.hospital_id))
);

-- 2) Role lookup no longer needs elevated privileges (user_roles RLS already allows self-reads)
CREATE OR REPLACE FUNCTION public.get_user_role(_user_id uuid)
RETURNS app_role
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path TO 'public'
AS $function$
  SELECT role FROM public.user_roles
  WHERE user_id = _user_id
  ORDER BY
    CASE role
      WHEN 'admin' THEN 1
      WHEN 'clinician' THEN 2
      WHEN 'viewer' THEN 3
    END
  LIMIT 1
$function$;
