ALTER TYPE public.order_status ADD VALUE IF NOT EXISTS 'signed';
ALTER TYPE public.order_status ADD VALUE IF NOT EXISTS 'pushed';
ALTER TYPE public.order_status ADD VALUE IF NOT EXISTS 'push_failed';
ALTER TYPE public.order_status ADD VALUE IF NOT EXISTS 'rejected';