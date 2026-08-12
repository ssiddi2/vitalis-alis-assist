-- 1. Signature / integrity columns on clinical_notes
ALTER TABLE public.clinical_notes
  ADD COLUMN IF NOT EXISTS signed_by uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS content_hash text,
  ADD COLUMN IF NOT EXISTS cosign_required boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS cosigned_by uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS cosigned_at timestamptz,
  ADD COLUMN IF NOT EXISTS lock_version integer NOT NULL DEFAULT 1;

-- 2. Immutable signed snapshots
CREATE TABLE IF NOT EXISTS public.note_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  note_id uuid NOT NULL REFERENCES public.clinical_notes(id) ON DELETE CASCADE,
  version integer NOT NULL,
  content jsonb NOT NULL,
  content_hash text NOT NULL,
  author_id uuid,
  signed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (note_id, version)
);

GRANT SELECT ON public.note_versions TO authenticated;
GRANT ALL ON public.note_versions TO service_role;
ALTER TABLE public.note_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Hospital members can view note versions"
ON public.note_versions FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.clinical_notes n
    JOIN public.patients p ON p.id = n.patient_id
    JOIN public.hospital_users hu ON hu.hospital_id = p.hospital_id
    WHERE n.id = note_versions.note_id AND hu.user_id = auth.uid()
  ) OR public.has_role(auth.uid(), 'admin')
);

-- 3. Append-only addenda
CREATE TABLE IF NOT EXISTS public.note_addenda (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  note_id uuid NOT NULL REFERENCES public.clinical_notes(id) ON DELETE CASCADE,
  sequence integer NOT NULL,
  reason text NOT NULL CHECK (length(btrim(reason)) > 0),
  content jsonb NOT NULL,
  content_hash text NOT NULL,
  author_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (note_id, sequence)
);

GRANT SELECT ON public.note_addenda TO authenticated;
GRANT ALL ON public.note_addenda TO service_role;
ALTER TABLE public.note_addenda ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Hospital members can view note addenda"
ON public.note_addenda FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.clinical_notes n
    JOIN public.patients p ON p.id = n.patient_id
    JOIN public.hospital_users hu ON hu.hospital_id = p.hospital_id
    WHERE n.id = note_addenda.note_id AND hu.user_id = auth.uid()
  ) OR public.has_role(auth.uid(), 'admin')
);

-- 4. Clients may only mutate DRAFT notes; signing/addenda/cosign go through the
--    validated server path (service role), which is exempt from RLS.
DROP POLICY IF EXISTS "Authors can update clinical notes" ON public.clinical_notes;
CREATE POLICY "Authors can update draft clinical notes"
ON public.clinical_notes FOR UPDATE TO authenticated
USING (
  status IN ('draft', 'pending_signature')
  AND author_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.patients p
    JOIN public.hospital_users hu ON hu.hospital_id = p.hospital_id
    WHERE p.id = clinical_notes.patient_id AND hu.user_id = auth.uid()
  )
)
WITH CHECK (
  status IN ('draft', 'pending_signature')
  AND author_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.patients p
    JOIN public.hospital_users hu ON hu.hospital_id = p.hospital_id
    WHERE p.id = clinical_notes.patient_id AND hu.user_id = auth.uid()
  )
);

-- 5. Defense in depth: signed content is immutable for EVERY role
CREATE OR REPLACE FUNCTION public.enforce_note_integrity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.status IN ('signed', 'amended') THEN
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

DROP TRIGGER IF EXISTS enforce_note_integrity ON public.clinical_notes;
CREATE TRIGGER enforce_note_integrity
BEFORE UPDATE OR DELETE ON public.clinical_notes
FOR EACH ROW EXECUTE FUNCTION public.enforce_note_integrity();

-- 6. Snapshots and addenda are append-only for EVERY role
CREATE OR REPLACE FUNCTION public.deny_mutation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RAISE EXCEPTION '% records are append-only', TG_TABLE_NAME;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.deny_mutation() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS note_versions_append_only ON public.note_versions;
CREATE TRIGGER note_versions_append_only
BEFORE UPDATE OR DELETE ON public.note_versions
FOR EACH ROW EXECUTE FUNCTION public.deny_mutation();

DROP TRIGGER IF EXISTS note_addenda_append_only ON public.note_addenda;
CREATE TRIGGER note_addenda_append_only
BEFORE UPDATE OR DELETE ON public.note_addenda
FOR EACH ROW EXECUTE FUNCTION public.deny_mutation();

CREATE INDEX IF NOT EXISTS idx_note_versions_note ON public.note_versions(note_id);
CREATE INDEX IF NOT EXISTS idx_note_addenda_note ON public.note_addenda(note_id);