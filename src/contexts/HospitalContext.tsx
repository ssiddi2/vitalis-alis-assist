import { createContext, useContext, useState, useEffect, useRef, useCallback, ReactNode } from 'react';
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
  setActiveEncounterId: (id: string | null) => void;
  emrConnection: EmrConnection | null;
  loading: boolean;
  error: string | null;
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
 * No such binding exists in the current schema or client configuration (the
 * `hospitals` row carries no issuer/tenant column, and a SMART session only
 * records the issuer it was launched from). We therefore FAIL CLOSED: a stored
 * SMART access token is never treated as a connection to the selected facility.
 * See docs/virtualis-one-unification.md for the config/schema required to lift this.
 */
const facilityIssuerBinding = (_hospital: Hospital): string | null => null;

interface ScopedState {
  /** monotonic context generation — bumped on every user/identity change. */
  gen: number;
  userId: string | null;
  hospitals: Hospital[];
  hospital: Hospital | null;
  patientId: string | null;
  /** facility the patient/encounter selection belongs to. */
  patientScopeId: string | null;
  encounterId: string | null;
  loading: boolean;
  error: string | null;
}

const emptyState = (gen: number, userId: string | null, loading: boolean): ScopedState => ({
  gen, userId, hospitals: [], hospital: null, patientId: null, patientScopeId: null,
  encounterId: null, loading, error: null,
});

export function HospitalProvider({ children }: { children: ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const userId = user?.id ?? null;

  const genRef = useRef(0);
  const [state, setState] = useState<ScopedState>(() => emptyState(0, null, true));
  const [emrConnection, setEmrConnection] = useState<EmrConnection | null>(null);

  // Render-time isolation: while the identity has changed but the reset effect
  // has not yet run, expose NOTHING from the previous user's context.
  const stale = state.userId !== userId;
  const view: ScopedState = stale ? emptyState(state.gen, userId, true) : state;

  /** Identity change (sign-in, user switch, sign-out) invalidates everything. */
  useEffect(() => {
    genRef.current += 1;
    clearStored();
    setEmrConnection(null);
    setState(emptyState(genRef.current, userId, true));
  }, [userId]);

  /** Load the authorized facility list; discard responses from older generations. */
  useEffect(() => {
    if (authLoading) return;
    const gen = genRef.current;

    if (!userId) {
      setState(emptyState(gen, null, false));
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

        setState((prev) => {
          if (prev.gen !== gen || genRef.current !== gen) return prev; // late response
          // Re-validate the current selection against the freshly authorized list.
          const storedId = prev.hospital?.id ?? readStored(HOSPITAL_KEY);
          const hospital = withCounts.find((h) => h.id === storedId) ?? null;
          if (!hospital) clearStored();
          const keepPatient = !!hospital && prev.patientScopeId === hospital.id;
          return {
            ...prev,
            hospitals: withCounts,
            hospital,
            patientId: keepPatient ? prev.patientId ?? readStored(PATIENT_KEY) : null,
            patientScopeId: hospital && keepPatient ? hospital.id : null,
            encounterId: keepPatient ? prev.encounterId : null,
            loading: false,
            error: null,
          };
        });
      } catch (err) {
        console.error('Error fetching hospitals:', err);
        setState((prev) => (prev.gen !== gen || genRef.current !== gen ? prev : {
          ...prev, loading: false, error: err instanceof Error ? err.message : 'Failed to load hospitals',
        }));
      }
    })();
  }, [userId, authLoading]);

  /** Only a facility from the freshly authorized list may be selected. */
  const setSelectedHospital = useCallback((hospital: Hospital | null) => {
    const gen = genRef.current;
    setState((prev) => {
      if (prev.gen !== gen) return prev;
      const authorized = hospital ? prev.hospitals.find((h) => h.id === hospital.id) ?? null : null;
      if (hospital && !authorized) {
        console.warn('Rejected facility selection outside the authorized list');
        return prev;
      }
      // Switching facilities always clears patient + encounter context.
      writeStored(HOSPITAL_KEY, authorized?.id ?? null);
      writeStored(PATIENT_KEY, null);
      return { ...prev, hospital: authorized, patientId: null, patientScopeId: null, encounterId: null };
    });
    setEmrConnection(null);
  }, []);

  const setSelectedPatientId = useCallback((id: string | null) => {
    const gen = genRef.current;
    setState((prev) => {
      if (prev.gen !== gen || !prev.hospital) return prev;
      writeStored(PATIENT_KEY, id);
      return { ...prev, patientId: id, patientScopeId: id ? prev.hospital.id : null, encounterId: null };
    });
  }, []);

  const setActiveEncounterId = useCallback((id: string | null) => {
    const gen = genRef.current;
    setState((prev) => (prev.gen !== gen || !prev.hospital ? prev : { ...prev, encounterId: id }));
  }, []);

  /**
   * Selecting a facility resets and re-resolves its EMR connection. A SMART
   * session only counts when its issuer matches an authoritative binding for
   * THIS facility — otherwise the pill reports unavailable (or an explicitly
   * enabled, clearly-labelled sandbox).
   */
  const facilityId = view.hospital?.id;
  const emr = view.hospital?.emr_system;
  const gen = view.gen;
  useEffect(() => {
    if (!facilityId || !emr) {
      setEmrConnection(null);
      return;
    }
    setEmrConnection({ status: 'connecting', emr, facilityId, sandbox: false });

    let cancelled = false;
    const t = setTimeout(() => {
      if (cancelled || genRef.current !== gen) return;
      const live = loadSmartSession();
      const binding = view.hospital ? facilityIssuerBinding(view.hospital) : null;
      const boundToFacility = !!live?.access_token && !!binding && live.iss === binding;

      if (boundToFacility) {
        setEmrConnection({ status: 'connected', emr, facilityId, sandbox: false });
      } else if (sandboxDemoEnabled() && sandboxForEmr(emr)) {
        setEmrConnection({ status: 'connected', emr, facilityId, sandbox: true, reason: 'synthetic_sandbox' });
      } else {
        setEmrConnection({
          status: 'unavailable', emr, facilityId, sandbox: false,
          reason: live?.access_token ? 'smart_session_not_bound_to_facility' : 'no_facility_emr_binding',
        });
      }
    }, 900);

    return () => { cancelled = true; clearTimeout(t); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [facilityId, emr, gen]);

  const scopedEmr = emrConnection && emrConnection.facilityId === facilityId ? emrConnection : null;

  return (
    <HospitalContext.Provider
      value={{
        hospitals: view.hospitals,
        selectedHospital: view.hospital,
        setSelectedHospital,
        selectedPatientId: view.hospital ? view.patientId : null,
        setSelectedPatientId,
        activeEncounterId: view.hospital ? view.encounterId : null,
        setActiveEncounterId,
        emrConnection: scopedEmr,
        loading: view.loading || authLoading,
        error: view.error,
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
