ALTER TABLE public.acuity_scores REPLICA IDENTITY FULL;
ALTER TABLE public.consult_requests REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.acuity_scores;
ALTER PUBLICATION supabase_realtime ADD TABLE public.consult_requests;