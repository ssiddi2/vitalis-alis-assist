DROP POLICY IF EXISTS "Clinicians can sign notes" ON public.consultation_notes;
CREATE POLICY "Clinicians can sign notes"
ON public.consultation_notes FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.consultation_threads ct
    WHERE ct.id = consultation_notes.thread_id
      AND (ct.primary_clinician_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  )
)
WITH CHECK (
  (public.has_role(auth.uid(), 'clinician') OR public.has_role(auth.uid(), 'admin'))
  AND EXISTS (
    SELECT 1
    FROM public.consultation_threads ct
    JOIN public.hospital_users hu ON hu.hospital_id = ct.hospital_id
    WHERE ct.id = consultation_notes.thread_id
      AND ct.patient_id = consultation_notes.patient_id
      AND hu.user_id = auth.uid()
      AND (ct.primary_clinician_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  )
);