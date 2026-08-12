CREATE TYPE public.compliance_status AS ENUM ('not_started','in_progress','internally_ready','ready_for_external_test','externally_verified','not_applicable');
CREATE TYPE public.compliance_applicability AS ENUM ('undetermined','applicable','not_applicable');
CREATE TYPE public.attestor_role AS ENUM ('independent_assessor','external_counsel','compliance_officer','medical_director','vendor');

CREATE TABLE public.compliance_requirements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hospital_id uuid NOT NULL REFERENCES public.hospitals(id) ON DELETE CASCADE,
  domain text NOT NULL,
  framework_ref text NOT NULL,
  criterion text NOT NULL,
  title text NOT NULL,
  description text,
  external_dependency boolean NOT NULL DEFAULT false,
  applicability public.compliance_applicability NOT NULL DEFAULT 'undetermined',
  applicability_rationale text,
  applicability_decided_by uuid,
  applicability_decided_at timestamptz,
  owner_user_id uuid,
  version integer NOT NULL DEFAULT 1,
  supersedes_id uuid REFERENCES public.compliance_requirements(id),
  retired boolean NOT NULL DEFAULT false,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (hospital_id, framework_ref, criterion, version)
);
GRANT SELECT, INSERT, UPDATE ON public.compliance_requirements TO authenticated;
GRANT ALL ON public.compliance_requirements TO service_role;
ALTER TABLE public.compliance_requirements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members read compliance requirements" ON public.compliance_requirements
  FOR SELECT TO authenticated USING (public.is_my_hospital(hospital_id));
CREATE POLICY "compliance creates requirements" ON public.compliance_requirements
  FOR INSERT TO authenticated WITH CHECK (
    public.is_my_hospital(hospital_id) AND created_by = auth.uid()
    AND (public.has_role(auth.uid(),'admin') OR public.has_governance_role(auth.uid(), hospital_id, 'compliance')));
CREATE POLICY "compliance updates requirements" ON public.compliance_requirements
  FOR UPDATE TO authenticated USING (
    public.is_my_hospital(hospital_id)
    AND (public.has_role(auth.uid(),'admin') OR public.has_governance_role(auth.uid(), hospital_id, 'compliance')));

CREATE TABLE public.compliance_assessments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hospital_id uuid NOT NULL REFERENCES public.hospitals(id) ON DELETE CASCADE,
  requirement_id uuid NOT NULL UNIQUE REFERENCES public.compliance_requirements(id) ON DELETE CASCADE,
  status public.compliance_status NOT NULL DEFAULT 'not_started',
  blocker text,
  target_date date,
  evidence_ref text,
  evidence_hash text,
  assessor_id uuid,
  assessor_org text,
  authority text,
  test_method text,
  test_version text,
  tested_at date,
  expires_at date,
  lock_version integer NOT NULL DEFAULT 0,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.compliance_assessments TO authenticated;
GRANT ALL ON public.compliance_assessments TO service_role;
ALTER TABLE public.compliance_assessments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members read compliance assessments" ON public.compliance_assessments
  FOR SELECT TO authenticated USING (public.is_my_hospital(hospital_id));
CREATE POLICY "compliance creates assessments" ON public.compliance_assessments
  FOR INSERT TO authenticated WITH CHECK (
    public.is_my_hospital(hospital_id) AND created_by = auth.uid()
    AND (public.has_role(auth.uid(),'admin') OR public.has_governance_role(auth.uid(), hospital_id, 'compliance')));
CREATE POLICY "compliance updates assessments" ON public.compliance_assessments
  FOR UPDATE TO authenticated USING (
    public.is_my_hospital(hospital_id)
    AND (public.has_role(auth.uid(),'admin') OR public.has_governance_role(auth.uid(), hospital_id, 'compliance')));

CREATE TABLE public.compliance_attestations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hospital_id uuid NOT NULL REFERENCES public.hospitals(id) ON DELETE CASCADE,
  assessment_id uuid NOT NULL REFERENCES public.compliance_assessments(id) ON DELETE CASCADE,
  attestor_id uuid NOT NULL,
  attestor_role public.attestor_role NOT NULL,
  attestor_org text,
  statement text NOT NULL,
  evidence_ref text,
  evidence_hash text,
  effective_at date NOT NULL DEFAULT current_date,
  expires_at date,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.compliance_attestations TO authenticated;
GRANT ALL ON public.compliance_attestations TO service_role;
ALTER TABLE public.compliance_attestations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members read attestations" ON public.compliance_attestations
  FOR SELECT TO authenticated USING (public.is_my_hospital(hospital_id));
CREATE POLICY "attestors record attestations" ON public.compliance_attestations
  FOR INSERT TO authenticated WITH CHECK (public.is_my_hospital(hospital_id) AND attestor_id = auth.uid());
CREATE TRIGGER deny_attestation_change BEFORE UPDATE OR DELETE ON public.compliance_attestations
  FOR EACH ROW EXECUTE FUNCTION public.deny_mutation();

CREATE OR REPLACE FUNCTION public.enforce_compliance_requirement()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $fn$
BEGIN
  IF NEW.applicability <> 'undetermined' THEN
    IF coalesce(NEW.applicability_rationale,'') = '' OR NEW.applicability_decided_by IS NULL THEN
      RAISE EXCEPTION 'an applicability decision requires a documented rationale and a named counsel or compliance decision maker';
    END IF;
    NEW.applicability_decided_at := coalesce(NEW.applicability_decided_at, now());
  END IF;
  IF TG_OP = 'UPDATE' THEN
    IF NEW.hospital_id <> OLD.hospital_id THEN RAISE EXCEPTION 'a requirement cannot move between facilities'; END IF;
    IF EXISTS (SELECT 1 FROM public.compliance_assessments a WHERE a.requirement_id = NEW.id AND a.status = 'externally_verified')
       AND (NEW.criterion <> OLD.criterion OR NEW.framework_ref <> OLD.framework_ref) THEN
      RAISE EXCEPTION 'an externally verified requirement version is immutable; create a new version instead';
    END IF;
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END $fn$;
CREATE TRIGGER enforce_compliance_requirement BEFORE INSERT OR UPDATE ON public.compliance_requirements
  FOR EACH ROW EXECUTE FUNCTION public.enforce_compliance_requirement();

CREATE OR REPLACE FUNCTION public.enforce_compliance_attestation()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $fn$
DECLARE r record;
BEGIN
  SELECT req.owner_user_id, req.created_by AS req_author, a.hospital_id, a.created_by AS assessment_author
    INTO r
    FROM public.compliance_assessments a
    JOIN public.compliance_requirements req ON req.id = a.requirement_id
   WHERE a.id = NEW.assessment_id;
  IF r IS NULL OR r.hospital_id <> NEW.hospital_id THEN
    RAISE EXCEPTION 'an attestation must stay inside the facility that owns the assessment';
  END IF;
  IF NEW.attestor_role IN ('independent_assessor','external_counsel') THEN
    IF NEW.attestor_id = r.owner_user_id OR NEW.attestor_id = r.req_author OR NEW.attestor_id = r.assessment_author THEN
      RAISE EXCEPTION 'separation of duties: the implementer cannot act as the independent assessor';
    END IF;
    IF coalesce(NEW.attestor_org,'') = '' OR coalesce(NEW.evidence_hash,'') = '' THEN
      RAISE EXCEPTION 'an independent attestation requires the attesting organization and an evidence hash';
    END IF;
  END IF;
  IF NEW.expires_at IS NOT NULL AND NEW.expires_at < NEW.effective_at THEN
    RAISE EXCEPTION 'an attestation cannot expire before it takes effect';
  END IF;
  RETURN NEW;
END $fn$;
CREATE TRIGGER enforce_compliance_attestation BEFORE INSERT ON public.compliance_attestations
  FOR EACH ROW EXECUTE FUNCTION public.enforce_compliance_attestation();

CREATE OR REPLACE FUNCTION public.enforce_compliance_assessment()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $fn$
DECLARE r record; att_ok boolean;
BEGIN
  SELECT * INTO r FROM public.compliance_requirements WHERE id = NEW.requirement_id;
  IF r IS NULL OR r.hospital_id <> NEW.hospital_id THEN
    RAISE EXCEPTION 'an assessment must stay inside the facility that owns the requirement';
  END IF;
  IF TG_OP = 'UPDATE' THEN
    IF NEW.hospital_id <> OLD.hospital_id OR NEW.requirement_id <> OLD.requirement_id THEN
      RAISE EXCEPTION 'the facility and requirement of an assessment are immutable';
    END IF;
    IF NEW.lock_version <> OLD.lock_version + 1 THEN
      RAISE EXCEPTION 'this assessment was changed by someone else; reload and retry';
    END IF;
    IF OLD.status = 'externally_verified'
       AND (NEW.evidence_ref IS DISTINCT FROM OLD.evidence_ref
         OR NEW.evidence_hash IS DISTINCT FROM OLD.evidence_hash
         OR NEW.tested_at IS DISTINCT FROM OLD.tested_at
         OR NEW.assessor_id IS DISTINCT FROM OLD.assessor_id
         OR NEW.authority IS DISTINCT FROM OLD.authority) THEN
      RAISE EXCEPTION 'externally verified evidence is immutable';
    END IF;
  END IF;
  IF NEW.status = 'not_applicable' AND r.applicability <> 'not_applicable' THEN
    RAISE EXCEPTION 'a requirement can only be marked not applicable after a documented applicability decision';
  END IF;
  IF NEW.status = 'internally_ready' AND coalesce(NEW.evidence_ref,'') = '' THEN
    RAISE EXCEPTION 'internal readiness requires an internal control or evidence reference';
  END IF;
  IF NEW.status = 'externally_verified' THEN
    IF coalesce(NEW.evidence_ref,'') = '' OR coalesce(NEW.evidence_hash,'') = ''
       OR NEW.tested_at IS NULL OR NEW.assessor_id IS NULL OR coalesce(NEW.authority,'') = '' THEN
      RAISE EXCEPTION 'external verification requires evidence, an evidence hash, a test date, an assessor and a named authority';
    END IF;
    IF NEW.assessor_id = r.owner_user_id OR NEW.assessor_id = r.created_by
       OR NEW.assessor_id = NEW.created_by OR NEW.assessor_id = auth.uid() THEN
      RAISE EXCEPTION 'separation of duties: an implementer cannot verify their own control';
    END IF;
    IF NEW.expires_at IS NOT NULL AND NEW.expires_at < current_date THEN
      RAISE EXCEPTION 'an expired attestation cannot mark a requirement externally verified';
    END IF;
    SELECT EXISTS (
      SELECT 1 FROM public.compliance_attestations t
       WHERE t.assessment_id = NEW.id
         AND t.attestor_role IN ('independent_assessor','external_counsel')
         AND t.attestor_id = NEW.assessor_id
         AND coalesce(t.evidence_hash,'') = NEW.evidence_hash
         AND (t.expires_at IS NULL OR t.expires_at >= current_date)) INTO att_ok;
    IF NOT att_ok THEN
      RAISE EXCEPTION 'external verification requires a current independent attestation matching the evidence hash';
    END IF;
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END $fn$;
CREATE TRIGGER enforce_compliance_assessment BEFORE INSERT OR UPDATE ON public.compliance_assessments
  FOR EACH ROW EXECUTE FUNCTION public.enforce_compliance_assessment();

CREATE OR REPLACE FUNCTION public.compliance_readiness(p_hospital_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SET search_path TO 'public' AS $fn$
DECLARE rows_out jsonb := '[]'::jsonb; blockers text[] := '{}'; g record;
BEGIN
  IF NOT public.is_my_hospital(p_hospital_id) THEN RETURN jsonb_build_object('authorized', false); END IF;
  FOR g IN
    SELECT r.domain, r.framework_ref, r.criterion, r.title, r.external_dependency,
           r.applicability::text AS applicability, coalesce(a.status,'not_started')::text AS status,
           a.blocker, a.target_date, a.expires_at, a.authority, a.assessor_org, a.tested_at
      FROM public.compliance_requirements r
      LEFT JOIN public.compliance_assessments a ON a.requirement_id = r.id
     WHERE r.hospital_id = p_hospital_id AND NOT r.retired
     ORDER BY r.domain, r.framework_ref, r.criterion
  LOOP
    rows_out := rows_out || to_jsonb(g);
    IF g.applicability = 'not_applicable' AND g.status = 'not_applicable' THEN CONTINUE; END IF;
    IF g.applicability = 'undetermined'
       OR (g.external_dependency AND (g.status <> 'externally_verified' OR (g.expires_at IS NOT NULL AND g.expires_at < current_date)))
       OR (NOT g.external_dependency AND g.status NOT IN ('internally_ready','externally_verified')) THEN
      blockers := blockers || (g.domain || ':' || g.criterion);
    END IF;
  END LOOP;
  RETURN jsonb_build_object('authorized', true, 'requirements', rows_out, 'blockers', to_jsonb(blockers),
    'internal_ready', array_length(blockers,1) IS NULL,
    'note', 'internal readiness only; nothing here asserts certification, compliance or an executed external contract');
END $fn$;
REVOKE ALL ON FUNCTION public.compliance_readiness(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.compliance_readiness(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.compliance_readiness(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.gate_compliance_availability()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $fn$
DECLARE bad text;
BEGIN
  IF NEW.status = 'available' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'available') THEN
    SELECT string_agg(r.domain || ':' || r.criterion, ', ') INTO bad
      FROM public.compliance_requirements r
      LEFT JOIN public.compliance_assessments a ON a.requirement_id = r.id
     WHERE r.hospital_id = NEW.hospital_id AND NOT r.retired
       AND NOT (r.applicability = 'not_applicable' AND coalesce(a.status,'not_started') = 'not_applicable')
       AND (r.applicability = 'undetermined'
         OR (r.external_dependency AND (coalesce(a.status,'not_started') <> 'externally_verified'
             OR (a.expires_at IS NOT NULL AND a.expires_at < current_date)))
         OR (NOT r.external_dependency AND coalesce(a.status,'not_started') NOT IN ('internally_ready','externally_verified')));
    IF bad IS NOT NULL THEN
      RAISE EXCEPTION 'production release is blocked by unverified compliance gates: %', bad;
    END IF;
  END IF;
  RETURN NEW;
END $fn$;
CREATE TRIGGER gate_compliance_availability BEFORE INSERT OR UPDATE ON public.state_service_availability
  FOR EACH ROW EXECUTE FUNCTION public.gate_compliance_availability();

INSERT INTO public.compliance_requirements (hospital_id, domain, framework_ref, criterion, title, description, external_dependency)
SELECT h.id, c.domain, c.framework_ref, c.criterion, c.title, c.description, c.external_dependency
FROM public.hospitals h
CROSS JOIN (VALUES
 ('certification','ONC Health IT Certification','applicability','ONC certification applicability determination','Counsel and compliance must determine whether certification applies to this deployment model.',true),
 ('certification','ONC Health IT Certification','170.315(g)(10)','Standardized API for patient and population services','Requires an authorized testing and certification body result.',true),
 ('interoperability','USCDI / FHIR R4 / US Core','uscdi-coverage','USCDI data element coverage','Internal conformance review plus validation evidence.',false),
 ('interoperability','SMART App Launch','smart-launch','SMART App Launch conformance','Requires third-party conformance testing evidence.',true),
 ('interoperability','Information blocking','ib-practices','Information blocking practices and exceptions review','Requires counsel review of practices and documented exceptions.',true),
 ('privacy','HIPAA Security Rule','risk-analysis','Formal security risk analysis','Requires a completed independent risk analysis report.',true),
 ('privacy','HIPAA Privacy Rule','privacy-program','Privacy policies, notice and workforce training','Internal program documentation plus counsel review.',true),
 ('privacy','HIPAA Breach Notification','breach-plan','Breach assessment and notification procedure','Internal runbook plus counsel review.',true),
 ('assurance','SOC 2 or equivalent','soc2-type2','Independent assurance report','Requires an independent auditor engagement and report.',true),
 ('security','Penetration testing','pentest','Independent penetration test and remediation','Requires an independent testing firm report.',true),
 ('security','Vulnerability management','vuln-sla','Vulnerability remediation SLAs and evidence','Internal policy plus scanner evidence.',false),
 ('security','Audit logging','audit-retention','Audit log retention and tamper evidence','Internal control with retention evidence.',false),
 ('resilience','Backup and disaster recovery','dr-exercise','Backup restore and DR exercise results','Internal exercise evidence with results.',false),
 ('accessibility','WCAG 2.1 AA','accessibility-audit','Accessibility conformance evaluation','Requires an independent accessibility audit.',true),
 ('performance','Performance and load','load-test','Documented load and performance test results','Internal test evidence.',false),
 ('vendor','BAAs and vendor risk','baa-inventory','Executed BAAs and vendor risk reviews','Requires executed agreements with each PHI vendor.',true),
 ('eprescribing','Surescripts / eRx','surescripts','eRx network certification and connectivity','Requires network certification and a production connection.',true),
 ('eprescribing','EPCS','epcs','Electronic prescribing of controlled substances audit','Requires a qualified third-party audit or certification.',true),
 ('eprescribing','PDMP','pdmp-connectivity','State PDMP integration authorization','Requires state or hub authorization per state.',true),
 ('revenue','Clearinghouse and payer','clearinghouse','Clearinghouse contract and payer enrollment','Requires executed clearinghouse and payer enrollments.',true),
 ('diagnostics','Lab, imaging and HIE','diagnostic-connectivity','Lab, imaging and HIE production interfaces','Requires signed vendor interfaces and validation.',true),
 ('identity','Identity proofing','idp-assurance','Identity proofing assurance level evidence','Requires an identity provider assurance attestation.',true),
 ('payments','Payments and PCI','payments','Payment processing and PCI responsibilities','Requires processor attestation of compliance.',true),
 ('workforce','Provider licensing','licensing','State licensure verification coverage','Primary source verification evidence per state.',true),
 ('workforce','Credentialing and enrollment','credentialing','Credentialing, privileging and payer enrollment','Requires primary source and payer evidence.',true),
 ('workforce','Malpractice coverage','malpractice','Malpractice coverage certificates','Requires carrier certificates.',true),
 ('state','State telehealth rules','telehealth-rules','State telehealth modality and consent rules','Requires counsel review per state.',true),
 ('state','State prescribing rules','prescribing-rules','State remote prescribing constraints','Requires counsel review per state.',true),
 ('clinical','Clinical protocol governance','protocol-approval','Approved protocols and order sets','Internal governance evidence.',false),
 ('operations','Quality, incident and support','ops-program','Quality measures, incident response and support operations','Internal program evidence.',false)
) AS c(domain, framework_ref, criterion, title, description, external_dependency)
ON CONFLICT DO NOTHING;

INSERT INTO public.compliance_assessments (hospital_id, requirement_id, status, blocker)
SELECT r.hospital_id, r.id, 'not_started',
  CASE WHEN r.external_dependency
       THEN 'No external evidence on file: no engaged assessor, executed contract or authorized attestation'
       ELSE 'No internal control evidence recorded yet' END
FROM public.compliance_requirements r
ON CONFLICT (requirement_id) DO NOTHING;