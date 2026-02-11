
-- Order Sets for CPOE
CREATE TABLE public.order_sets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL DEFAULT 'general',
  orders_template JSONB NOT NULL DEFAULT '[]'::jsonb,
  hospital_id UUID REFERENCES public.hospitals(id),
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.order_sets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Clinicians can view order sets"
  ON public.order_sets FOR SELECT
  USING (has_role(auth.uid(), 'clinician'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can manage order sets"
  ON public.order_sets FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Seed common order sets
INSERT INTO public.order_sets (name, description, category, orders_template) VALUES
('Sepsis Bundle', 'CMS SEP-1 early management bundle', 'critical_care', '[
  {"order_type":"lab","name":"Blood Cultures x2","priority":"STAT"},
  {"order_type":"lab","name":"Lactate Level","priority":"STAT"},
  {"order_type":"lab","name":"CBC with Differential","priority":"STAT"},
  {"order_type":"lab","name":"BMP","priority":"STAT"},
  {"order_type":"medication","name":"Normal Saline 30mL/kg IV Bolus","priority":"STAT"},
  {"order_type":"medication","name":"Broad Spectrum Antibiotics","priority":"STAT"}
]'::jsonb),
('Chest Pain Workup', 'ACS rule-out protocol', 'cardiology', '[
  {"order_type":"lab","name":"Troponin I (serial q3h x3)","priority":"STAT"},
  {"order_type":"lab","name":"BMP","priority":"STAT"},
  {"order_type":"lab","name":"CBC","priority":"Today"},
  {"order_type":"imaging","name":"Chest X-Ray PA/Lateral","priority":"STAT"},
  {"order_type":"lab","name":"BNP","priority":"Today"},
  {"order_type":"medication","name":"Aspirin 325mg PO x1","priority":"STAT"}
]'::jsonb),
('DVT Prophylaxis', 'VTE prevention orders', 'general', '[
  {"order_type":"medication","name":"Enoxaparin 40mg SQ Daily","priority":"Today"},
  {"order_type":"procedure","name":"Sequential Compression Devices","priority":"Today"}
]'::jsonb),
('Admission - General Medicine', 'Standard admission order set', 'general', '[
  {"order_type":"lab","name":"CBC with Differential","priority":"Today"},
  {"order_type":"lab","name":"BMP","priority":"Today"},
  {"order_type":"lab","name":"Urinalysis","priority":"Today"},
  {"order_type":"imaging","name":"Chest X-Ray","priority":"Today"},
  {"order_type":"medication","name":"DVT Prophylaxis per protocol","priority":"Today"},
  {"order_type":"procedure","name":"Vital Signs q4h","priority":"Routine"}
]'::jsonb),
('DKA Protocol', 'Diabetic ketoacidosis management', 'endocrine', '[
  {"order_type":"lab","name":"BMP q2h","priority":"STAT"},
  {"order_type":"lab","name":"ABG","priority":"STAT"},
  {"order_type":"lab","name":"Serum Ketones","priority":"STAT"},
  {"order_type":"medication","name":"Insulin Drip per DKA Protocol","priority":"STAT"},
  {"order_type":"medication","name":"Normal Saline 1L/hr IV","priority":"STAT"},
  {"order_type":"lab","name":"Phosphorus, Magnesium","priority":"Today"}
]'::jsonb);
