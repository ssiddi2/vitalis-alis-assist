REVOKE ALL ON FUNCTION public.log_cash_pay_event() FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.enforce_encounter_cash_pay() FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.enforce_obesity_intake_screen() FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.enforce_vendor_identity_mapping() FROM public, anon, authenticated;