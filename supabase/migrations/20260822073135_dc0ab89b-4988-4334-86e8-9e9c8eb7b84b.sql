DROP POLICY IF EXISTS "vendor mappings readable in my hospital" ON public.vendor_identity_mappings;

CREATE POLICY "vendor mappings readable by admins"
ON public.vendor_identity_mappings
FOR SELECT
TO authenticated
USING (
  public.is_my_hospital(hospital_id)
  AND (
    public.has_role(auth.uid(), 'admin')
    OR public.has_governance_role(auth.uid(), hospital_id, 'compliance_officer')
  )
);