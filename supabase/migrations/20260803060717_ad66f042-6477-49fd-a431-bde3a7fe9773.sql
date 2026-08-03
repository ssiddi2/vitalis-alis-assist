
-- hospitals
DROP POLICY IF EXISTS "Authenticated users can view hospitals" ON public.hospitals;
CREATE POLICY "Members can view their hospitals" ON public.hospitals FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.hospital_users hu WHERE hu.user_id = auth.uid() AND hu.hospital_id = hospitals.id)
       OR public.has_role(auth.uid(), 'admin'));

-- fhir_resources
DROP POLICY IF EXISTS "Demo: anyone can read fhir mirror" ON public.fhir_resources;
CREATE POLICY "Hospital members can read fhir mirror" ON public.fhir_resources FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.hospital_users hu WHERE hu.user_id = auth.uid() AND hu.hospital_id = fhir_resources.hospital_id)
       OR public.has_role(auth.uid(), 'admin'));

-- imaging_studies (patient-scoped)
DROP POLICY IF EXISTS "Users can view imaging studies" ON public.imaging_studies;
DROP POLICY IF EXISTS "Authenticated users can insert imaging studies" ON public.imaging_studies;
DROP POLICY IF EXISTS "Authenticated users can update imaging studies" ON public.imaging_studies;
CREATE POLICY "Hospital members can view imaging studies" ON public.imaging_studies FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.patients p JOIN public.hospital_users hu ON hu.hospital_id = p.hospital_id
               WHERE p.id = imaging_studies.patient_id AND hu.user_id = auth.uid())
       OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Hospital members can insert imaging studies" ON public.imaging_studies FOR INSERT TO authenticated
WITH CHECK (EXISTS (SELECT 1 FROM public.patients p JOIN public.hospital_users hu ON hu.hospital_id = p.hospital_id
               WHERE p.id = imaging_studies.patient_id AND hu.user_id = auth.uid())
       OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Hospital members can update imaging studies" ON public.imaging_studies FOR UPDATE TO authenticated
USING (EXISTS (SELECT 1 FROM public.patients p JOIN public.hospital_users hu ON hu.hospital_id = p.hospital_id
               WHERE p.id = imaging_studies.patient_id AND hu.user_id = auth.uid())
       OR public.has_role(auth.uid(), 'admin'))
WITH CHECK (EXISTS (SELECT 1 FROM public.patients p JOIN public.hospital_users hu ON hu.hospital_id = p.hospital_id
               WHERE p.id = imaging_studies.patient_id AND hu.user_id = auth.uid())
       OR public.has_role(auth.uid(), 'admin'));

-- patient_insurance
DROP POLICY IF EXISTS "Authenticated can manage insurance" ON public.patient_insurance;
CREATE POLICY "Hospital members can manage insurance" ON public.patient_insurance FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.patients p JOIN public.hospital_users hu ON hu.hospital_id = p.hospital_id
               WHERE p.id = patient_insurance.patient_id AND hu.user_id = auth.uid())
       OR public.has_role(auth.uid(), 'admin'))
WITH CHECK (EXISTS (SELECT 1 FROM public.patients p JOIN public.hospital_users hu ON hu.hospital_id = p.hospital_id
               WHERE p.id = patient_insurance.patient_id AND hu.user_id = auth.uid())
       OR public.has_role(auth.uid(), 'admin'));

-- superbills
DROP POLICY IF EXISTS "Authenticated can manage superbills" ON public.superbills;
CREATE POLICY "Hospital members can manage superbills" ON public.superbills FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.hospital_users hu WHERE hu.user_id = auth.uid() AND hu.hospital_id = superbills.hospital_id)
       OR public.has_role(auth.uid(), 'admin'))
WITH CHECK (EXISTS (SELECT 1 FROM public.hospital_users hu WHERE hu.user_id = auth.uid() AND hu.hospital_id = superbills.hospital_id)
       OR public.has_role(auth.uid(), 'admin'));

-- fee_schedule
DROP POLICY IF EXISTS "Authenticated can manage fee schedule" ON public.fee_schedule;
CREATE POLICY "Hospital members can view fee schedule" ON public.fee_schedule FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.hospital_users hu WHERE hu.user_id = auth.uid() AND hu.hospital_id = fee_schedule.hospital_id)
       OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can manage fee schedule" ON public.fee_schedule FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- notifications insert
DROP POLICY IF EXISTS "Authenticated users can insert notifications" ON public.notifications;
CREATE POLICY "Scoped notification creation" ON public.notifications FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid()
       OR (hospital_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.hospital_users hu WHERE hu.user_id = auth.uid() AND hu.hospital_id = notifications.hospital_id))
       OR public.has_role(auth.uid(), 'admin'));

-- consult_requests update
DROP POLICY IF EXISTS "Involved parties can update consults" ON public.consult_requests;
CREATE POLICY "Involved parties can update consults" ON public.consult_requests FOR UPDATE TO authenticated
USING (requesting_user_id = auth.uid()
       OR EXISTS (SELECT 1 FROM public.hospital_users hu WHERE hu.user_id = auth.uid() AND hu.hospital_id = consult_requests.hospital_id)
       OR public.has_role(auth.uid(), 'admin'))
WITH CHECK (requesting_user_id = auth.uid()
       OR EXISTS (SELECT 1 FROM public.hospital_users hu WHERE hu.user_id = auth.uid() AND hu.hospital_id = consult_requests.hospital_id)
       OR public.has_role(auth.uid(), 'admin'));

-- SECURITY DEFINER function exposure
REVOKE ALL ON FUNCTION public.audit_phi_changes() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.update_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.reset_demo_data() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_user_role(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.log_audit_event(public.audit_action_type, text, text, uuid, uuid, jsonb, inet, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_user_role(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.log_audit_event(public.audit_action_type, text, text, uuid, uuid, jsonb, inet, text, text) TO authenticated, service_role;
