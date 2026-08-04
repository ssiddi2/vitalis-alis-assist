DO $$
DECLARE p record;
BEGIN
  FOR p IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'rate_limits' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.rate_limits', p.policyname);
  END LOOP;
END $$;

REVOKE ALL ON public.rate_limits FROM authenticated;
REVOKE ALL ON public.rate_limits FROM anon;
GRANT ALL ON public.rate_limits TO service_role;
ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;