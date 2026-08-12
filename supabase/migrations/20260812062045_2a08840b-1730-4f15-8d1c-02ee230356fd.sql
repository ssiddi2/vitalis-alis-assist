-- 1) clinical_notes: author-owned, hospital-scoped DRAFT delete only ----------
DROP POLICY IF EXISTS "Authors can delete draft clinical notes" ON public.clinical_notes;
CREATE POLICY "Authors can delete draft clinical notes"
ON public.clinical_notes FOR DELETE TO authenticated
USING (
  status = 'draft'
  AND signed_at IS NULL
  AND signed_by IS NULL
  AND content_hash IS NULL
  AND cosigned_at IS NULL
  AND author_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.patients p
    JOIN public.hospital_users hu ON hu.hospital_id = p.hospital_id
    WHERE p.id = clinical_notes.patient_id AND hu.user_id = auth.uid()
  )
);

-- Defense in depth: only pure drafts may ever be deleted, for every role.
CREATE OR REPLACE FUNCTION public.enforce_note_integrity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.status <> 'draft' OR OLD.signed_at IS NOT NULL OR OLD.content_hash IS NOT NULL THEN
      RAISE EXCEPTION 'signed clinical notes cannot be deleted';
    END IF;
    RETURN OLD;
  END IF;

  IF OLD.status IN ('signed', 'amended') THEN
    IF NEW.content IS DISTINCT FROM OLD.content
       OR NEW.status IS DISTINCT FROM OLD.status
       OR NEW.content_hash IS DISTINCT FROM OLD.content_hash
       OR NEW.signed_at IS DISTINCT FROM OLD.signed_at
       OR NEW.signed_by IS DISTINCT FROM OLD.signed_by
       OR NEW.patient_id IS DISTINCT FROM OLD.patient_id
       OR NEW.author_id IS DISTINCT FROM OLD.author_id THEN
      RAISE EXCEPTION 'signed clinical notes are immutable; record an addendum instead';
    END IF;
  END IF;

  IF NEW.status = 'signed' AND OLD.status <> 'signed' THEN
    IF NEW.signed_by IS NULL OR NEW.signed_at IS NULL OR NEW.content_hash IS NULL THEN
      RAISE EXCEPTION 'signing requires signed_by, signed_at and content_hash';
    END IF;
  END IF;

  NEW.lock_version := OLD.lock_version + 1;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.enforce_note_integrity() FROM PUBLIC, anon, authenticated;

-- PHI-safe audit for draft deletion: identifiers only, never note content.
CREATE OR REPLACE FUNCTION public.audit_note_draft_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_hospital_id uuid;
BEGIN
  SELECT hospital_id INTO v_hospital_id FROM public.patients WHERE id = OLD.patient_id;
  INSERT INTO public.audit_logs (
    user_id, hospital_id, action_type, resource_type, resource_id, patient_id, metadata
  ) VALUES (
    auth.uid(), v_hospital_id, 'delete', 'clinical_notes', OLD.id::text, OLD.patient_id,
    jsonb_build_object('event', 'note.draft_deleted', 'note_type', OLD.note_type, 'author_id', OLD.author_id)
  );
  RETURN OLD;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.audit_note_draft_delete() FROM PUBLIC, anon, authenticated;

-- Generic PHI audit writes the whole deleted row; keep it off clinical_notes deletes.
DROP TRIGGER IF EXISTS audit_clinical_notes_changes ON public.clinical_notes;
CREATE TRIGGER audit_clinical_notes_changes
AFTER INSERT OR UPDATE ON public.clinical_notes
FOR EACH ROW EXECUTE FUNCTION public.audit_phi_changes();

DROP TRIGGER IF EXISTS audit_clinical_notes_draft_delete ON public.clinical_notes;
CREATE TRIGGER audit_clinical_notes_draft_delete
AFTER DELETE ON public.clinical_notes
FOR EACH ROW EXECUTE FUNCTION public.audit_note_draft_delete();

-- 2) consultation_notes: scoped INSERT --------------------------------------
ALTER TABLE public.consultation_notes
  ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users(id);

DROP POLICY IF EXISTS "Clinicians can create consultation notes" ON public.consultation_notes;
CREATE POLICY "Clinicians can create consultation notes"
ON public.consultation_notes FOR INSERT TO authenticated
WITH CHECK (
  (public.has_role(auth.uid(), 'clinician') OR public.has_role(auth.uid(), 'admin'))
  AND created_by = auth.uid()
  AND EXISTS (
    SELECT 1
    FROM public.consultation_threads ct
    JOIN public.patients p ON p.id = ct.patient_id
    JOIN public.hospital_users hu ON hu.hospital_id = ct.hospital_id
    WHERE ct.id = consultation_notes.thread_id
      AND ct.patient_id = consultation_notes.patient_id
      AND p.hospital_id = ct.hospital_id
      AND hu.user_id = auth.uid()
  )
);

-- Signing must not re-point a note at another thread/patient.
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
  EXISTS (
    SELECT 1
    FROM public.consultation_threads ct
    JOIN public.hospital_users hu ON hu.hospital_id = ct.hospital_id
    WHERE ct.id = consultation_notes.thread_id
      AND ct.patient_id = consultation_notes.patient_id
      AND hu.user_id = auth.uid()
  )
);

-- 3) patient_vitals: hospital/patient-scoped writes, no clinician delete -----
DROP POLICY IF EXISTS "Admins can manage patient vitals" ON public.patient_vitals;
CREATE POLICY "Admins can manage same-hospital patient vitals"
ON public.patient_vitals FOR ALL TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  AND EXISTS (
    SELECT 1 FROM public.patients p
    JOIN public.hospital_users hu ON hu.hospital_id = p.hospital_id
    WHERE p.id = patient_vitals.patient_id AND hu.user_id = auth.uid()
  )
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin')
  AND EXISTS (
    SELECT 1 FROM public.patients p
    JOIN public.hospital_users hu ON hu.hospital_id = p.hospital_id
    WHERE p.id = patient_vitals.patient_id AND hu.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Clinicians insert own hospital vitals" ON public.patient_vitals;
CREATE POLICY "Clinicians insert own hospital vitals"
ON public.patient_vitals FOR INSERT TO authenticated
WITH CHECK (
  (public.has_role(auth.uid(), 'clinician') OR public.has_role(auth.uid(), 'admin'))
  AND EXISTS (
    SELECT 1 FROM public.patients p
    JOIN public.hospital_users hu ON hu.hospital_id = p.hospital_id
    WHERE p.id = patient_vitals.patient_id AND hu.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Clinicians update own hospital vitals" ON public.patient_vitals;
CREATE POLICY "Clinicians update own hospital vitals"
ON public.patient_vitals FOR UPDATE TO authenticated
USING (
  (public.has_role(auth.uid(), 'clinician') OR public.has_role(auth.uid(), 'admin'))
  AND EXISTS (
    SELECT 1 FROM public.patients p
    JOIN public.hospital_users hu ON hu.hospital_id = p.hospital_id
    WHERE p.id = patient_vitals.patient_id AND hu.user_id = auth.uid()
  )
)
WITH CHECK (
  (public.has_role(auth.uid(), 'clinician') OR public.has_role(auth.uid(), 'admin'))
  AND EXISTS (
    SELECT 1 FROM public.patients p
    JOIN public.hospital_users hu ON hu.hospital_id = p.hospital_id
    WHERE p.id = patient_vitals.patient_id AND hu.user_id = auth.uid()
  )
);