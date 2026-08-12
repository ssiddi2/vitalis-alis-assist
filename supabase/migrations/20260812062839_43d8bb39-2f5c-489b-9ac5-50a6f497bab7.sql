-- appointments -------------------------------------------------------------
DROP POLICY IF EXISTS "Clinicians can create appointments" ON public.appointments;
CREATE POLICY "Clinicians can create appointments"
ON public.appointments FOR INSERT TO authenticated
WITH CHECK (
  (public.has_role(auth.uid(), 'clinician') OR public.has_role(auth.uid(), 'admin'))
  AND EXISTS (SELECT 1 FROM public.hospital_users hu
              WHERE hu.user_id = auth.uid() AND hu.hospital_id = appointments.hospital_id)
  AND EXISTS (SELECT 1 FROM public.patients p
              WHERE p.id = appointments.patient_id AND p.hospital_id = appointments.hospital_id)
  AND EXISTS (SELECT 1 FROM public.hospital_users hp
              WHERE hp.user_id = appointments.provider_id AND hp.hospital_id = appointments.hospital_id)
  AND (appointments.encounter_id IS NULL OR EXISTS (
        SELECT 1 FROM public.encounters e
        WHERE e.id = appointments.encounter_id
          AND e.hospital_id = appointments.hospital_id
          AND e.patient_id = appointments.patient_id))
);

-- consult_requests ----------------------------------------------------------
DROP POLICY IF EXISTS "Clinicians can create consult requests" ON public.consult_requests;
CREATE POLICY "Clinicians can create consult requests"
ON public.consult_requests FOR INSERT TO authenticated
WITH CHECK (
  (public.has_role(auth.uid(), 'clinician') OR public.has_role(auth.uid(), 'admin'))
  AND consult_requests.requesting_user_id = auth.uid()
  AND EXISTS (SELECT 1 FROM public.hospital_users hu
              WHERE hu.user_id = auth.uid() AND hu.hospital_id = consult_requests.hospital_id)
  AND EXISTS (SELECT 1 FROM public.patients p
              WHERE p.id = consult_requests.patient_id AND p.hospital_id = consult_requests.hospital_id)
  AND (consult_requests.consultant_id IS NULL OR EXISTS (
        SELECT 1 FROM public.consultants c
        WHERE c.id = consult_requests.consultant_id AND c.hospital_id = consult_requests.hospital_id))
  AND (consult_requests.channel_id IS NULL OR EXISTS (
        SELECT 1 FROM public.team_channels tc
        WHERE tc.id = consult_requests.channel_id AND tc.hospital_id = consult_requests.hospital_id))
);

DROP POLICY IF EXISTS "Involved parties can update consults" ON public.consult_requests;
CREATE POLICY "Involved parties can update consults"
ON public.consult_requests FOR UPDATE TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.hospital_users hu
          WHERE hu.user_id = auth.uid() AND hu.hospital_id = consult_requests.hospital_id)
  OR public.has_role(auth.uid(), 'admin')
)
WITH CHECK (
  EXISTS (SELECT 1 FROM public.hospital_users hu
          WHERE hu.user_id = auth.uid() AND hu.hospital_id = consult_requests.hospital_id)
  AND EXISTS (SELECT 1 FROM public.patients p
              WHERE p.id = consult_requests.patient_id AND p.hospital_id = consult_requests.hospital_id)
);

-- encounters ----------------------------------------------------------------
DROP POLICY IF EXISTS "Clinicians can create encounters" ON public.encounters;
CREATE POLICY "Clinicians can create encounters"
ON public.encounters FOR INSERT TO authenticated
WITH CHECK (
  (public.has_role(auth.uid(), 'clinician') OR public.has_role(auth.uid(), 'admin'))
  AND encounters.provider_id = auth.uid()
  AND EXISTS (SELECT 1 FROM public.hospital_users hu
              WHERE hu.user_id = auth.uid() AND hu.hospital_id = encounters.hospital_id)
  AND EXISTS (SELECT 1 FROM public.patients p
              WHERE p.id = encounters.patient_id AND p.hospital_id = encounters.hospital_id)
);

-- consultation_threads ------------------------------------------------------
DROP POLICY IF EXISTS "Clinicians can create threads" ON public.consultation_threads;
CREATE POLICY "Clinicians can create threads"
ON public.consultation_threads FOR INSERT TO authenticated
WITH CHECK (
  (public.has_role(auth.uid(), 'clinician') OR public.has_role(auth.uid(), 'admin'))
  AND consultation_threads.primary_clinician_id = auth.uid()
  AND EXISTS (SELECT 1 FROM public.hospital_users hu
              WHERE hu.user_id = auth.uid() AND hu.hospital_id = consultation_threads.hospital_id)
  AND EXISTS (SELECT 1 FROM public.patients p
              WHERE p.id = consultation_threads.patient_id AND p.hospital_id = consultation_threads.hospital_id)
  AND (consultation_threads.specialist_id IS NULL OR EXISTS (
        SELECT 1 FROM public.consultants c
        WHERE c.id = consultation_threads.specialist_id AND c.hospital_id = consultation_threads.hospital_id))
  AND (consultation_threads.consult_request_id IS NULL OR EXISTS (
        SELECT 1 FROM public.consult_requests cr
        WHERE cr.id = consultation_threads.consult_request_id
          AND cr.hospital_id = consultation_threads.hospital_id))
);

DROP POLICY IF EXISTS "Thread creator can update" ON public.consultation_threads;
CREATE POLICY "Thread creator can update"
ON public.consultation_threads FOR UPDATE TO authenticated
USING (primary_clinician_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
WITH CHECK (
  EXISTS (SELECT 1 FROM public.hospital_users hu
          WHERE hu.user_id = auth.uid() AND hu.hospital_id = consultation_threads.hospital_id)
  AND (consultation_threads.primary_clinician_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  AND EXISTS (SELECT 1 FROM public.patients p
              WHERE p.id = consultation_threads.patient_id AND p.hospital_id = consultation_threads.hospital_id)
  AND (consultation_threads.specialist_id IS NULL OR EXISTS (
        SELECT 1 FROM public.consultants c
        WHERE c.id = consultation_threads.specialist_id AND c.hospital_id = consultation_threads.hospital_id))
);

-- team_channels -------------------------------------------------------------
DROP POLICY IF EXISTS "Clinicians can create channels" ON public.team_channels;
CREATE POLICY "Clinicians can create channels"
ON public.team_channels FOR INSERT TO authenticated
WITH CHECK (
  (public.has_role(auth.uid(), 'clinician') OR public.has_role(auth.uid(), 'admin'))
  AND team_channels.created_by = auth.uid()
  AND EXISTS (SELECT 1 FROM public.hospital_users hu
              WHERE hu.user_id = auth.uid() AND hu.hospital_id = team_channels.hospital_id)
  AND (team_channels.patient_id IS NULL OR EXISTS (
        SELECT 1 FROM public.patients p
        WHERE p.id = team_channels.patient_id AND p.hospital_id = team_channels.hospital_id))
);

DROP POLICY IF EXISTS "Channel creators can update" ON public.team_channels;
CREATE POLICY "Channel creators can update"
ON public.team_channels FOR UPDATE TO authenticated
USING (created_by = auth.uid() OR public.has_role(auth.uid(), 'admin'))
WITH CHECK (
  EXISTS (SELECT 1 FROM public.hospital_users hu
          WHERE hu.user_id = auth.uid() AND hu.hospital_id = team_channels.hospital_id)
  AND (team_channels.created_by = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  AND (team_channels.patient_id IS NULL OR EXISTS (
        SELECT 1 FROM public.patients p
        WHERE p.id = team_channels.patient_id AND p.hospital_id = team_channels.hospital_id))
);

-- appointments UPDATE: prevent cross-hospital patient reassignment ----------
DROP POLICY IF EXISTS "Clinicians can update appointments" ON public.appointments;
CREATE POLICY "Clinicians can update appointments"
ON public.appointments FOR UPDATE TO authenticated
USING (provider_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
WITH CHECK (
  EXISTS (SELECT 1 FROM public.hospital_users hu
          WHERE hu.user_id = auth.uid() AND hu.hospital_id = appointments.hospital_id)
  AND (appointments.provider_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  AND EXISTS (SELECT 1 FROM public.patients p
              WHERE p.id = appointments.patient_id AND p.hospital_id = appointments.hospital_id)
);