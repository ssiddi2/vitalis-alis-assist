
DO $$
DECLARE
  H uuid := '11111111-1111-1111-1111-111111111111';
  prov uuid := '3ea2e18e-a468-42c0-97c5-162fb9fccfa0';
  p_chen uuid := '2887cfc2-9a39-49e2-b838-01c1e0463b51';
  p_santos uuid := '77f4db2e-9d3b-47aa-8d56-71e84129b300';
  p_thomp uuid := '7ddc5fc4-597d-42ce-b0db-53ff7391eab8';
  p_will uuid := '2af62d29-02ee-44f5-b708-f4c8290de779';
  p_ander uuid := '4f8084f1-18bb-4bb4-8804-bde640f7c574';
BEGIN
  DELETE FROM public.patient_problems WHERE patient_id IN (p_chen, p_santos, p_thomp, p_will, p_ander);
  INSERT INTO public.patient_problems (patient_id, description, icd10_code, status, onset_date) VALUES
    (p_chen,   'Type 2 Diabetes Mellitus',                       'E11.9',  'active', current_date - 800),
    (p_chen,   'Essential Hypertension',                          'I10',    'active', current_date - 700),
    (p_chen,   'Hyperlipidemia',                                  'E78.5',  'active', current_date - 600),
    (p_santos, 'Asthma, moderate persistent',                     'J45.40', 'active', current_date - 1200),
    (p_santos, 'Seasonal allergic rhinitis',                      'J30.2',  'active', current_date - 900),
    (p_thomp,  'Chronic Kidney Disease, stage 3',                 'N18.30', 'active', current_date - 400),
    (p_thomp,  'Atrial fibrillation',                             'I48.91', 'active', current_date - 300),
    (p_will,   'Osteoarthritis of knee',                          'M17.11', 'active', current_date - 1500),
    (p_will,   'GERD',                                            'K21.9',  'active', current_date - 500),
    (p_ander,  'Major depressive disorder, recurrent, moderate', 'F33.1',  'active', current_date - 200);

  DELETE FROM public.patient_medications WHERE patient_id IN (p_chen, p_santos, p_thomp, p_will, p_ander);
  INSERT INTO public.patient_medications (patient_id, name, dose, route, frequency, start_date, status, prescriber) VALUES
    (p_chen,   'Metformin',                     '1000 mg', 'PO',  'BID',         current_date - 700, 'active', 'Dr. Sarah Kim'),
    (p_chen,   'Lisinopril',                    '20 mg',   'PO',  'Daily',       current_date - 650, 'active', 'Dr. Sarah Kim'),
    (p_chen,   'Atorvastatin',                  '40 mg',   'PO',  'Daily at HS', current_date - 600, 'active', 'Dr. Sarah Kim'),
    (p_santos, 'Fluticasone-Salmeterol 250/50', '1 puff',  'INH', 'BID',         current_date - 1100,'active', 'Dr. Sarah Kim'),
    (p_santos, 'Albuterol HFA',                 '90 mcg',  'INH', 'PRN',         current_date - 1100,'active', 'Dr. Sarah Kim'),
    (p_thomp,  'Apixaban',                      '5 mg',    'PO',  'BID',         current_date - 290, 'active', 'Dr. Sarah Kim'),
    (p_thomp,  'Metoprolol succinate',          '50 mg',   'PO',  'Daily',       current_date - 290, 'active', 'Dr. Sarah Kim'),
    (p_will,   'Omeprazole',                    '20 mg',   'PO',  'Daily',       current_date - 480, 'active', 'Dr. Sarah Kim'),
    (p_will,   'Acetaminophen',                 '500 mg',  'PO',  'TID PRN',     current_date - 200, 'active', 'Dr. Sarah Kim'),
    (p_ander,  'Sertraline',                    '100 mg',  'PO',  'Daily',       current_date - 180, 'active', 'Dr. Sarah Kim');

  DELETE FROM public.patient_allergies WHERE patient_id IN (p_chen, p_santos, p_thomp, p_will, p_ander);
  INSERT INTO public.patient_allergies (patient_id, allergen, reaction, severity, onset_date) VALUES
    (p_chen,   'Penicillin',     'Hives, rash',  'moderate', current_date - 3000),
    (p_santos, 'Sulfa drugs',    'Anaphylaxis',  'severe',   current_date - 4000),
    (p_thomp,  'Iodine contrast','Bronchospasm', 'moderate', current_date - 2000);

  DELETE FROM public.patient_insurance WHERE patient_id IN (p_chen, p_santos, p_thomp, p_will, p_ander);
  INSERT INTO public.patient_insurance (patient_id, rank, payer_name, member_id, group_number, plan_name, subscriber_name, relationship_to_subscriber, copay_amount, active) VALUES
    (p_chen,   'primary', 'Blue Cross Blue Shield', 'XJM834221',     'GRP-44521', 'PPO Gold',         'Robert Chen',      'self', 30, true),
    (p_santos, 'primary', 'Aetna',                  'W918226732',    'GRP-88312', 'HMO Standard',     'Maria Santos',     'self', 25, true),
    (p_thomp,  'primary', 'Medicare',               '1EG4-TE5-MK72', '',          'Medicare Part B',  'William Thompson', 'self', 0,  true),
    (p_will,   'primary', 'United Healthcare',      'UH-44219876',   'GRP-21100', 'Choice Plus',      'Dorothy Williams', 'self', 35, true),
    (p_ander,  'primary', 'Cigna',                  'U773221145',    'GRP-66721', 'Open Access',      'James Anderson',   'self', 40, true);

  DELETE FROM public.fee_schedule WHERE hospital_id = H;
  INSERT INTO public.fee_schedule (hospital_id, code_type, code, description, amount) VALUES
    (H,'cpt','99202','New patient, straightforward, 15-29 min',    175),
    (H,'cpt','99203','New patient, low complexity, 30-44 min',     245),
    (H,'cpt','99204','New patient, moderate complexity, 45-59 min',365),
    (H,'cpt','99212','Established patient, straightforward, 10-19 min',110),
    (H,'cpt','99213','Established patient, low complexity, 20-29 min', 165),
    (H,'cpt','99214','Established patient, moderate complexity, 30-39 min',235),
    (H,'cpt','99215','Established patient, high complexity, 40-54 min', 330),
    (H,'cpt','99396','Preventive visit, established, age 40-64',    285),
    (H,'cpt','36415','Routine venipuncture',                          15),
    (H,'cpt','85025','CBC with differential',                         45),
    (H,'cpt','80053','Comprehensive metabolic panel',                 55),
    (H,'cpt','83036','Hemoglobin A1c',                                40),
    (H,'cpt','93000','EKG, 12-lead with interpretation',             120);

  DELETE FROM public.appointments WHERE hospital_id = H AND start_time::date = current_date;

  INSERT INTO public.appointments
    (patient_id, hospital_id, provider_id, encounter_type, visit_reason, start_time, end_time, duration_minutes, status)
  SELECT pid, H, prov, etype::text::encounter_type, reason,
         (current_date::timestamptz + (h_off || ' hours')::interval),
         (current_date::timestamptz + (h_off || ' hours')::interval + (dur || ' minutes')::interval),
         dur, 'scheduled'
  FROM (VALUES
    (p_chen,   'follow_up',       'Diabetes follow-up & A1c review', 9,  30),
    (p_santos, 'office_visit',    'Asthma exacerbation',             10, 30),
    (p_thomp,  'follow_up',       'Anticoagulation check, INR',      11, 30),
    (p_will,   'annual_physical', 'Annual wellness visit',           13, 45),
    (p_ander,  'office_visit',    'Medication management',           14, 30)
  ) v(pid, etype, reason, h_off, dur);
END $$;

CREATE OR REPLACE FUNCTION public.reset_demo_data()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE H uuid := '11111111-1111-1111-1111-111111111111';
BEGIN
  DELETE FROM public.superbills     WHERE hospital_id = H;
  DELETE FROM public.staged_orders  WHERE patient_id IN (SELECT id FROM public.patients WHERE hospital_id = H);
  DELETE FROM public.encounters     WHERE hospital_id = H AND scheduled_at::date = current_date;
  DELETE FROM public.appointments   WHERE hospital_id = H AND start_time::date = current_date;
  DELETE FROM public.clinical_notes WHERE patient_id IN (SELECT id FROM public.patients WHERE hospital_id = H)
    AND created_at > now() - interval '1 day';
  RETURN 'demo reset ok';
END;
$func$;
GRANT EXECUTE ON FUNCTION public.reset_demo_data() TO authenticated;
