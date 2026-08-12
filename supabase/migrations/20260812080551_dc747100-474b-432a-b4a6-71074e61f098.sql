ALTER TYPE public.prescription_status ADD VALUE IF NOT EXISTS 'ready_for_review';
ALTER TYPE public.prescription_status ADD VALUE IF NOT EXISTS 'transmission_pending';
ALTER TYPE public.prescription_status ADD VALUE IF NOT EXISTS 'transmitted';
ALTER TYPE public.prescription_status ADD VALUE IF NOT EXISTS 'accepted';
ALTER TYPE public.prescription_status ADD VALUE IF NOT EXISTS 'errored';
ALTER TYPE public.prescription_status ADD VALUE IF NOT EXISTS 'discontinued';