DROP POLICY IF EXISTS erx_outbox_select_members ON public.erx_outbox;
CREATE POLICY erx_outbox_select_members
ON public.erx_outbox FOR SELECT TO authenticated
USING (
  public.is_my_hospital(hospital_id)
  AND (public.has_role(auth.uid(), 'clinician') OR public.has_role(auth.uid(), 'admin'))
);