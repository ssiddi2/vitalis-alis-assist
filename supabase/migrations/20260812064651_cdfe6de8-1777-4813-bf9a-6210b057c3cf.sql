-- ============================================================
-- Immutable communication + accountable consult workflow
-- ============================================================

-- ---------- 1. consult_requests ----------
ALTER TABLE public.consult_requests
  ADD COLUMN IF NOT EXISTS accepted_by uuid,
  ADD COLUMN IF NOT EXISTS accepted_at timestamptz;

CREATE OR REPLACE FUNCTION public.enforce_consult_request_integrity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_is_admin boolean := public.has_role(v_actor, 'admin');
BEGIN
  -- Immutable identity / clinical content of the request.
  IF NEW.hospital_id IS DISTINCT FROM OLD.hospital_id
     OR NEW.patient_id IS DISTINCT FROM OLD.patient_id
     OR NEW.requesting_user_id IS DISTINCT FROM OLD.requesting_user_id
     OR NEW.specialty IS DISTINCT FROM OLD.specialty
     OR NEW.reason IS DISTINCT FROM OLD.reason
     OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'consult request origin and clinical content are immutable';
  END IF;

  -- Urgency may only be revised by the requester or an admin, and only while pending.
  IF NEW.urgency IS DISTINCT FROM OLD.urgency
     AND NOT (OLD.status = 'pending' AND (v_actor = OLD.requesting_user_id OR v_is_admin)) THEN
    RAISE EXCEPTION 'consult urgency can only be revised by the requester while pending';
  END IF;

  -- Legal status transitions only.
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF NOT (
      (OLD.status = 'pending'  AND NEW.status IN ('accepted', 'cancelled')) OR
      (OLD.status = 'accepted' AND NEW.status IN ('completed', 'cancelled'))
    ) THEN
      RAISE EXCEPTION 'illegal consult status transition % -> %', OLD.status, NEW.status;
    END IF;
  ELSIF OLD.status IN ('completed', 'cancelled') THEN
    RAISE EXCEPTION 'closed consult requests are immutable';
  END IF;

  -- Only the requester, the accepting clinician or an admin may act after acceptance.
  IF OLD.status <> 'pending'
     AND NOT (v_actor = OLD.requesting_user_id OR v_actor = OLD.accepted_by OR v_is_admin) THEN
    RAISE EXCEPTION 'only involved parties may update this consult request';
  END IF;

  -- Accepting stamps the actor server-side; it can never be reassigned afterwards.
  IF NEW.status = 'accepted' AND OLD.status = 'pending' THEN
    NEW.accepted_by := COALESCE(v_actor, OLD.accepted_by);
    NEW.accepted_at := now();
  ELSIF NEW.accepted_by IS DISTINCT FROM OLD.accepted_by
     OR NEW.accepted_at IS DISTINCT FROM OLD.accepted_at THEN
    RAISE EXCEPTION 'consult acceptance attribution is immutable';
  END IF;

  -- Referenced consultant / channel must stay inside the request's hospital.
  IF NEW.consultant_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.consultants c
    WHERE c.id = NEW.consultant_id AND c.hospital_id = NEW.hospital_id
  ) THEN
    RAISE EXCEPTION 'consultant must belong to the consult hospital';
  END IF;

  IF NEW.channel_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.team_channels tc
    WHERE tc.id = NEW.channel_id AND tc.hospital_id = NEW.hospital_id
  ) THEN
    RAISE EXCEPTION 'channel must belong to the consult hospital';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_consult_request_integrity ON public.consult_requests;
CREATE TRIGGER enforce_consult_request_integrity
  BEFORE UPDATE ON public.consult_requests
  FOR EACH ROW EXECUTE FUNCTION public.enforce_consult_request_integrity();

DROP POLICY IF EXISTS "Involved parties can update consults" ON public.consult_requests;
CREATE POLICY "Involved parties can update consults"
ON public.consult_requests FOR UPDATE TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.hospital_users hu
          WHERE hu.user_id = auth.uid() AND hu.hospital_id = consult_requests.hospital_id)
  AND (
    consult_requests.requesting_user_id = auth.uid()
    OR consult_requests.accepted_by = auth.uid()
    OR public.has_role(auth.uid(), 'admin')
    -- an unclaimed consult may be picked up by a clinician at that hospital
    OR (consult_requests.status = 'pending' AND public.has_role(auth.uid(), 'clinician'))
  )
)
WITH CHECK (
  EXISTS (SELECT 1 FROM public.hospital_users hu
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

-- ---------- 2. direct_messages ----------
ALTER TABLE public.direct_messages
  ADD COLUMN IF NOT EXISTS read_at timestamptz;

CREATE OR REPLACE FUNCTION public.enforce_direct_message_integrity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.sender_id := COALESCE(auth.uid(), NEW.sender_id);
    NEW.is_read := false;
    NEW.read_at := NULL;
    RETURN NEW;
  END IF;

  -- Everything except the read acknowledgement is immutable.
  IF NEW.id IS DISTINCT FROM OLD.id
     OR NEW.conversation_id IS DISTINCT FROM OLD.conversation_id
     OR NEW.sender_id IS DISTINCT FROM OLD.sender_id
     OR NEW.content IS DISTINCT FROM OLD.content
     OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'direct messages are immutable once sent';
  END IF;

  -- Idempotent no-op (bulk "mark thread read" over already-read rows).
  IF NEW.is_read = OLD.is_read THEN
    NEW.read_at := OLD.read_at;
    RETURN NEW;
  END IF;

  IF OLD.is_read AND NOT NEW.is_read THEN
    RAISE EXCEPTION 'a read receipt cannot be withdrawn';
  END IF;

  IF auth.uid() IS NOT NULL AND auth.uid() = OLD.sender_id THEN
    RAISE EXCEPTION 'senders cannot acknowledge their own messages';
  END IF;

  NEW.read_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_direct_message_integrity ON public.direct_messages;
CREATE TRIGGER enforce_direct_message_integrity
  BEFORE INSERT OR UPDATE ON public.direct_messages
  FOR EACH ROW EXECUTE FUNCTION public.enforce_direct_message_integrity();

DROP TRIGGER IF EXISTS direct_messages_no_delete ON public.direct_messages;
CREATE TRIGGER direct_messages_no_delete
  BEFORE DELETE ON public.direct_messages
  FOR EACH ROW EXECUTE FUNCTION public.deny_mutation();

DROP POLICY IF EXISTS "Participants can send messages" ON public.direct_messages;
CREATE POLICY "Participants can send messages"
ON public.direct_messages FOR INSERT TO authenticated
WITH CHECK (
  direct_messages.sender_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.direct_conversations dc
    JOIN public.hospital_users hu
      ON hu.hospital_id = dc.hospital_id AND hu.user_id = auth.uid()
    WHERE dc.id = direct_messages.conversation_id
      AND (dc.participant_1 = auth.uid() OR dc.participant_2 = auth.uid())
  )
);

DROP POLICY IF EXISTS "Participants can view messages" ON public.direct_messages;
CREATE POLICY "Participants can view messages"
ON public.direct_messages FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.direct_conversations dc
  WHERE dc.id = direct_messages.conversation_id
    AND (dc.participant_1 = auth.uid() OR dc.participant_2 = auth.uid())
));

DROP POLICY IF EXISTS "Recipients can mark as read" ON public.direct_messages;
CREATE POLICY "Recipients can mark as read"
ON public.direct_messages FOR UPDATE TO authenticated
USING (
  direct_messages.sender_id <> auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.direct_conversations dc
    WHERE dc.id = direct_messages.conversation_id
      AND (dc.participant_1 = auth.uid() OR dc.participant_2 = auth.uid())
  )
)
WITH CHECK (
  direct_messages.sender_id <> auth.uid()
  AND direct_messages.is_read = true
  AND EXISTS (
    SELECT 1 FROM public.direct_conversations dc
    WHERE dc.id = direct_messages.conversation_id
      AND (dc.participant_1 = auth.uid() OR dc.participant_2 = auth.uid())
  )
);

-- ---------- 3. team_messages (append-only) ----------
CREATE OR REPLACE FUNCTION public.stamp_team_message_sender()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  NEW.sender_id := COALESCE(auth.uid(), NEW.sender_id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS stamp_team_message_sender ON public.team_messages;
CREATE TRIGGER stamp_team_message_sender
  BEFORE INSERT ON public.team_messages
  FOR EACH ROW EXECUTE FUNCTION public.stamp_team_message_sender();

DROP TRIGGER IF EXISTS team_messages_append_only ON public.team_messages;
CREATE TRIGGER team_messages_append_only
  BEFORE UPDATE OR DELETE ON public.team_messages
  FOR EACH ROW EXECUTE FUNCTION public.deny_mutation();

DROP POLICY IF EXISTS "Users can update read status" ON public.team_messages;

DROP POLICY IF EXISTS "Channel members can send messages" ON public.team_messages;
CREATE POLICY "Channel members can send messages"
ON public.team_messages FOR INSERT TO authenticated
WITH CHECK (
  team_messages.sender_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.channel_members cm
    JOIN public.team_channels tc ON tc.id = cm.channel_id
    JOIN public.hospital_users hu ON hu.hospital_id = tc.hospital_id AND hu.user_id = auth.uid()
    WHERE cm.channel_id = team_messages.channel_id AND cm.user_id = auth.uid()
  )
  AND (team_messages.reply_to_id IS NULL OR EXISTS (
    SELECT 1 FROM public.team_messages parent
    WHERE parent.id = team_messages.reply_to_id AND parent.channel_id = team_messages.channel_id))
);

DROP POLICY IF EXISTS "Users can view messages in their channels" ON public.team_messages;
CREATE POLICY "Users can view messages in their channels"
ON public.team_messages FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.channel_members cm
    JOIN public.team_channels tc ON tc.id = cm.channel_id
    JOIN public.hospital_users hu ON hu.hospital_id = tc.hospital_id AND hu.user_id = auth.uid()
    WHERE cm.channel_id = team_messages.channel_id AND cm.user_id = auth.uid()
  )
  OR (public.has_role(auth.uid(), 'admin') AND EXISTS (
    SELECT 1 FROM public.team_channels tc
    JOIN public.hospital_users hu ON hu.hospital_id = tc.hospital_id AND hu.user_id = auth.uid()
    WHERE tc.id = team_messages.channel_id))
);

-- ---------- 4. acuity_scores / acuity_feedback ----------
CREATE OR REPLACE FUNCTION public.stamp_acuity_actor()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF TG_TABLE_NAME = 'acuity_scores' THEN
    NEW.created_by := COALESCE(auth.uid(), NEW.created_by);
  ELSE
    NEW.recorded_by := COALESCE(auth.uid(), NEW.recorded_by);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS stamp_acuity_actor ON public.acuity_scores;
CREATE TRIGGER stamp_acuity_actor
  BEFORE INSERT ON public.acuity_scores
  FOR EACH ROW EXECUTE FUNCTION public.stamp_acuity_actor();

DROP TRIGGER IF EXISTS stamp_acuity_actor ON public.acuity_feedback;
CREATE TRIGGER stamp_acuity_actor
  BEFORE INSERT ON public.acuity_feedback
  FOR EACH ROW EXECUTE FUNCTION public.stamp_acuity_actor();

DROP TRIGGER IF EXISTS acuity_scores_append_only ON public.acuity_scores;
CREATE TRIGGER acuity_scores_append_only
  BEFORE UPDATE OR DELETE ON public.acuity_scores
  FOR EACH ROW EXECUTE FUNCTION public.deny_mutation();

DROP TRIGGER IF EXISTS acuity_feedback_append_only ON public.acuity_feedback;
CREATE TRIGGER acuity_feedback_append_only
  BEFORE UPDATE OR DELETE ON public.acuity_feedback
  FOR EACH ROW EXECUTE FUNCTION public.deny_mutation();

DROP POLICY IF EXISTS "Members can insert acuity scores" ON public.acuity_scores;
CREATE POLICY "Members can insert acuity scores"
ON public.acuity_scores FOR INSERT TO authenticated
WITH CHECK (
  acuity_scores.created_by = auth.uid()
  AND EXISTS (SELECT 1 FROM public.hospital_users hu
              WHERE hu.hospital_id = acuity_scores.hospital_id AND hu.user_id = auth.uid())
  AND (acuity_scores.patient_id IS NULL OR EXISTS (
        SELECT 1 FROM public.patients p
        WHERE p.id = acuity_scores.patient_id AND p.hospital_id = acuity_scores.hospital_id))
);

DROP POLICY IF EXISTS "Members can insert acuity feedback" ON public.acuity_feedback;
CREATE POLICY "Members can insert acuity feedback"
ON public.acuity_feedback FOR INSERT TO authenticated
WITH CHECK (
  acuity_feedback.recorded_by = auth.uid()
  AND EXISTS (SELECT 1 FROM public.hospital_users hu
              WHERE hu.hospital_id = acuity_feedback.hospital_id AND hu.user_id = auth.uid())
  AND (acuity_feedback.acuity_id IS NULL OR EXISTS (
        SELECT 1 FROM public.acuity_scores s
        WHERE s.id = acuity_feedback.acuity_id AND s.hospital_id = acuity_feedback.hospital_id))
);

DROP POLICY IF EXISTS "Members can view acuity scores" ON public.acuity_scores;
CREATE POLICY "Members can view acuity scores"
ON public.acuity_scores FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.hospital_users hu
               WHERE hu.hospital_id = acuity_scores.hospital_id AND hu.user_id = auth.uid()));

DROP POLICY IF EXISTS "Members can view acuity feedback" ON public.acuity_feedback;
CREATE POLICY "Members can view acuity feedback"
ON public.acuity_feedback FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.hospital_users hu
               WHERE hu.hospital_id = acuity_feedback.hospital_id AND hu.user_id = auth.uid()));