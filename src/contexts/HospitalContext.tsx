import { createContext, useContext, useState, useEffect, useRef, useMemo, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { loadSmartSession } from '@/lib/smart';
import { sandboxForEmr } from '@/data/emrSandboxes';

export interface Hospital {
  id: string;
  name: string;
  code: string;
  emr_system: 'epic' | 'meditech' | 'cerner';
  address: string | null;
  logo_url: string | null;
  connection_status: string;
  patientCount?: number;
  alertCount?: number;
}

export interface EmrConnection {
  /**
   * `unavailable` = we have no authoritative binding proving this facility's EMR
   * session; it is NOT an error and NEVER implies a live connection.
   */
  status: 'connecting' | 'connected' | 'unavailable' | 'error';
  emr: string;
  facilityId: string;
  /** true when resolved through a synthetic sandbox issuer rather than a live EHR session. */
  sandbox: boolean;
  /** machine-readable explanation when not connected. */
  reason?: string;
}

interface HospitalContextType {
  hospitals: Hospital[];
  selectedHospital: Hospital | null;
  setSelectedHospital: (hospital: Hospital | null) => void;
  selectedPatientId: string | null;
  setSelectedPatientId: (id: string | null) => void;
  activeEncounterId: string | null;
  /** Requires a selected patient in the current facility scope; otherwise rejected. */
  setActiveEncounterId: (id: string | null) => void;
  emrConnection: EmrConnection | null;
  loading: boolean;
  error: string | null;
  /** Re-fetch the authorized facility list, invalidating any request in flight. */
  refresh: () => void;
}

const HospitalContext = createContext<HospitalContextType | undefined>(undefined);

const HOSPITAL_KEY = 'virtualis.selectedHospitalId';
const PATIENT_KEY = 'virtualis.selectedPatientId';

const readStored = (key: string): string | null => {
  try { return sessionStorage.getItem(key); } catch { return null; }
};
const writeStored = (key: string, value: string | null) => {
  try {
    if (value) sessionStorage.setItem(key, value);
    else sessionStorage.removeItem(key);
  } catch { /* ignore */ }
};
const clearStored = () => { writeStored(HOSPITAL_KEY, null); writeStored(PATIENT_KEY, null); };

/**
 * Sandbox EMR sessions are demo-only. They are surfaced as a *connected sandbox*
 * ONLY when the deployment explicitly opts in; otherwise every facility reports
 * `unavailable` rather than pretending a production link exists.
 */
const sandboxDemoEnabled = () =>
  String(import.meta.env.VITE_EMR_SANDBOX_DEMO ?? '').toLowerCase() === 'true';

/**
 * Authoritative facility ⇄ FHIR issuer binding.
 *
 * No such binding exists in the current schema or client configuration, so we
 * FAIL CLOSED: a stored SMART access token is never treated as a connection to
 * the selected facility. See docs/virtualis-one-unification.md.
 */
const facilityIssuerBinding = (_hospital: Hospital): string | null => null;

interface ScopedState {
  /** monotonic identity/context generation — bumped on user change and on every auth-loading edge. */
  gen: number;
  /** monotonic facility-selection generation — bumped on EVERY switch, including A→B→A. */
  scope: number;
  userId: string | null;
  hospitals: Hospital[];
  hospital: Hospital | null;
  patientId: string | null;
  encounterId: string | null;
  loading: boolean;
  error: string | null;
}

const emptyState = (gen: number, scope: number, userId: string | null, loading: boolean): ScopedState => ({
  gen, scope, userId, hospitals: [], hospital: null, patientId: null,
  encounterId: null, loading, error: null,
});

export function HospitalProvider({ children }: { children: ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const userId = user?.id ?? null;

  const genRef = useRef(0);
  const scopeRef = useRef(0);
  /** every list request gets a unique id; only the newest may write state. */
  const reqRef = useRef(0);
  const mountedRef = useRef(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const [state, setState] = useState<ScopedState>(() => emptyState(0, 0, null, true));
  const [emrConnection, setEmrConnection] = useState<EmrConnection | null>(null);

  useEffect(() => () => { mountedRef.current = false; reqRef.current += 1; genRef.current += 1; }, []);

  /**
   * Render-time isolation. `authLoading` re-entering for the SAME user hides the
   * whole context immediately — a re-authenticating session may no longer carry
   * the same facility provisioning, so nothing from before may remain visible.
   */
  const hidden = authLoading || state.userId !== userId;
  const view: ScopedState = hidden ? emptyState(state.gen, state.scope, userId, true) : state;

  /**
   * Any identity edge (sign-in, user switch, sign-out, entering OR leaving
   * auth-loading) invalidates the generation, all outstanding requests and every
   * previously handed-out setter callback.
   */
  useEffect(() => {
    genRef.current += 1;
    scopeRef.current += 1;
    reqRef.current += 1;
    clearStored();
    setEmrConnection(null);
    setState(emptyState(genRef.current, scopeRef.current, userId, true));
  }, [userId, authLoading]);

  /** Load the authorized facility list. Fail closed on error; discard stale responses. */
  useEffect(() => {
    if (authLoading) return;
    const gen = genRef.current;
    const req = ++reqRef.current;
    const live = () => mountedRef.current && genRef.current === gen && reqRef.current === req;

    if (!userId) {
      setState(emptyState(gen, scopeRef.current, null, false));
      return;
    }

    (async () => {
      try {
        const { data, error } = await supabase.from('hospitals').select('*');
        if (error) throw error;

        const withCounts = await Promise.all(
          (data || []).map(async (hospital) => {
            const { count: patientCount } = await supabase
              .from('patients').select('*', { count: 'exact', head: true })
              .eq('hospital_id', hospital.id);
            const { count: alertCount } = await supabase
              .from('patients').select('*', { count: 'exact', head: true })
              .eq('hospital_id', hospital.id)
              .in('status', ['critical', 'warning']);
            return { ...hospital, patientCount: patientCount || 0, alertCount: alertCount || 0 } as Hospital;
          })
        );

        if (!live()) return;
        setState((prev) => {
          if (prev.gen !== gen || !live()) return prev;
          // Re-validate the current selection against the freshly authorized list.
          const storedId = prev.hospital?.id ?? readStored(HOSPITAL_KEY);
          const hospital = withCounts.find((h) => h.id === storedId) ?? null;
          const keptSelection = !!hospital && !!prev.hospital && prev.hospital.id === hospital.id;
          if (!hospital) clearStored();
          const patientId = keptSelection ? prev.patientId ?? readStored(PATIENT_KEY) : null;
          return {
            ...prev,
            hospitals: withCounts,
            hospital,
            patientId,
            encounterId: keptSelection && patientId ? prev.encounterId : null,
            loading: false,
            error: null,
          };
        });
      } catch (err) {
        console.error('Error fetching hospitals:', err);
        if (!live()) return;
        // Fail closed: a failed authorization read must not leave a facility usable.
        clearStored();
        scopeRef.current += 1;
        setState((prev) => (prev.gen !== gen || !live() ? prev : {
          ...emptyState(gen, scopeRef.current, userId, false),
          error: err instanceof Error ? err.message : 'Failed to load hospitals',
        }));
      }
    })();

    // Leaving this effect invalidates the request it started.
    return () => { reqRef.current += 1; };
  }, [userId, authLoading, refreshKey]);

  /**
   * Setters are bound to the identity + facility-selection generation that was
   * current when they were handed out. A callback retained from facility A does
   * nothing after a switch to B — including A→B→A, because every switch advances
   * the monotonic scope counter.
   */
  const boundGen = view.gen;
  const boundScope = view.scope;
  const boundHospitalId = view.hospital?.id ?? null;

  const setters = useMemo(() => {
    const identityValid = () => mountedRef.current && genRef.current === boundGen;
    const scopeValid = () => identityValid() && scopeRef.current === boundScope;

    return {
      setSelectedHospital: (hospital: Hospital | null) => {
        if (!identityValid()) return;
        // Advance scope for EVERY switch attempt so batched A→B→A cannot alias.
        setState((prev) => {
          if (prev.gen !== boundGen || !identityValid()) return prev;
          const authorized = hospital ? prev.hospitals.find((h) => h.id === hospital.id) ?? null : null;
          if (hospital && !authorized) {
            console.warn('Rejected facility selection outside the authorized list');
            return prev;
          }
          writeStored(HOSPITAL_KEY, authorized?.id ?? null);
          writeStored(PATIENT_KEY, null);
          return {
            ...prev, scope: prev.scope + 1, hospital: authorized,
            patientId: null, encounterId: null,
          };
        });
        scopeRef.current += 1;
        setEmrConnection(null);
      },

      setSelectedPatientId: (id: string | null) => {
        if (!scopeValid() || !boundHospitalId) return;
        setState((prev) => {
          if (prev.gen !== boundGen || prev.scope !== boundScope) return prev;
          if (prev.hospital?.id !== boundHospitalId) return prev;
          writeStored(PATIENT_KEY, id);
          return { ...prev, patientId: id, encounterId: null };
        });
      },

      setActiveEncounterId: (id: string | null) => {
        if (!scopeValid() || !boundHospitalId) return;
        setState((prev) => {
          if (prev.gen !== boundGen || prev.scope !== boundScope) return prev;
          if (prev.hospital?.id !== boundHospitalId) return prev;
          // An encounter is only meaningful under a selected patient in this scope.
          if (id && !prev.patientId) {
            console.warn('Rejected encounter selection without a selected patient');
            return prev;
          }
          return { ...prev, encounterId: id };
        });
      },

      refresh: () => {
        if (!identityValid()) return;
        reqRef.current += 1;
        setRefreshKey((k) => k + 1);
      },
    };
  }, [boundGen, boundScope, boundHospitalId]);

  /**
   * Facility EMR resolution. A SMART session only counts when its issuer matches
   * an authoritative binding for THIS facility — otherwise unavailable, or an
   * explicitly enabled and clearly labelled sandbox.
   */
  const facilityId = view.hospital?.id;
  const emr = view.hospital?.emr_system;
  const hospital = view.hospital;
  useEffect(() => {
    if (!facilityId || !emr) {
      setEmrConnection(null);
      return;
    }
    const gen = boundGen;
    const scope = boundScope;
    setEmrConnection({ status: 'connecting', emr, facilityId, sandbox: false });

    let cancelled = false;
    const t = setTimeout(() => {
      if (cancelled || genRef.current !== gen || scopeRef.current !== scope) return;
      const session = loadSmartSession();
      const binding = hospital ? facilityIssuerBinding(hospital) : null;
      const bound = !!session?.access_token && !!binding && session.iss === binding;

      if (bound) {
        setEmrConnection({ status: 'connected', emr, facilityId, sandbox: false });
      } else if (sandboxDemoEnabled() && sandboxForEmr(emr)) {
        setEmrConnection({ status: 'connected', emr, facilityId, sandbox: true, reason: 'synthetic_sandbox' });
      } else {
        setEmrConnection({
          status: 'unavailable', emr, facilityId, sandbox: false,
          reason: session?.access_token ? 'smart_session_not_bound_to_facility' : 'no_facility_emr_binding',
        });
      }
    }, 900);

    return () => { cancelled = true; clearTimeout(t); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [facilityId, emr, boundGen, boundScope]);

  const scopedEmr =
    !hidden && emrConnection && emrConnection.facilityId === facilityId ? emrConnection : null;

  return (
    <HospitalContext.Provider
      value={{
        hospitals: view.hospitals,
        selectedHospital: view.hospital,
        selectedPatientId: view.hospital ? view.patientId : null,
        activeEncounterId: view.hospital && view.patientId ? view.encounterId : null,
        emrConnection: scopedEmr,
        loading: view.loading || authLoading,
        error: view.error,
        ...setters,
      }}
    >
      {children}
    </HospitalContext.Provider>
  );
}

export function useHospital() {
  const context = useContext(HospitalContext);
  if (context === undefined) {
    throw new Error('useHospital must be used within a HospitalProvider');
  }
  return context;
}
