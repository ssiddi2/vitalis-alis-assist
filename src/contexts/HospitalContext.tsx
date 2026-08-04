import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
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
  status: 'connecting' | 'connected' | 'error';
  emr: string;
  facilityId: string;
  /** true when resolved through a synthetic sandbox issuer rather than a live EHR session. */
  sandbox: boolean;
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

export function HospitalProvider({ children }: { children: ReactNode }) {
  const [hospitals, setHospitals] = useState<Hospital[]>([]);
  // Hydrate from sessionStorage as a stub; reconciled once hospitals load.
  const [selectedHospital, setSelectedHospitalState] = useState<Hospital | null>(() => {
    const id = readStored(HOSPITAL_KEY);
    return id ? ({ id } as Hospital) : null;
  });
  const [selectedPatientId, setSelectedPatientIdState] = useState<string | null>(
    () => readStored(PATIENT_KEY)
  );
  const [activeEncounterId, setActiveEncounterId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user, loading: authLoading } = useAuth();

  const setSelectedHospital = (h: Hospital | null) => {
    setSelectedHospitalState(h);
    writeStored(HOSPITAL_KEY, h?.id ?? null);
  };
  const setSelectedPatientId = (id: string | null) => {
    setSelectedPatientIdState(id);
    writeStored(PATIENT_KEY, id);
  };

  useEffect(() => {
    async function fetchHospitals() {
      if (authLoading) return;

      if (!user) {
        setHospitals([]);
        setSelectedHospitalState(null);
        writeStored(HOSPITAL_KEY, null);
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);

        const { data: hospitalsData, error: hospitalsError } = await supabase
          .from('hospitals')
          .select('*');

        if (hospitalsError) throw hospitalsError;

        const hospitalsWithCounts = await Promise.all(
          (hospitalsData || []).map(async (hospital) => {
            const { count: patientCount } = await supabase
              .from('patients')
              .select('*', { count: 'exact', head: true })
              .eq('hospital_id', hospital.id);

            const { count: alertCount } = await supabase
              .from('patients')
              .select('*', { count: 'exact', head: true })
              .eq('hospital_id', hospital.id)
              .in('status', ['critical', 'warning']);

            return {
              ...hospital,
              patientCount: patientCount || 0,
              alertCount: alertCount || 0,
            } as Hospital;
          })
        );

        setHospitals(hospitalsWithCounts);

        // Reconcile any hydrated stub against the freshly fetched list.
        setSelectedHospitalState((prev) => {
          if (!prev) return prev;
          const full = hospitalsWithCounts.find((h) => h.id === prev.id);
          if (full) return full;
          // Hydrated id no longer accessible — clear it.
          writeStored(HOSPITAL_KEY, null);
          return null;
        });
      } catch (err) {
        console.error('Error fetching hospitals:', err);
        setError(err instanceof Error ? err.message : 'Failed to load hospitals');
      } finally {
        setLoading(false);
      }
    }

    fetchHospitals();
  }, [user, authLoading]);

  return (
    <HospitalContext.Provider value={{ hospitals, selectedHospital, setSelectedHospital, selectedPatientId, setSelectedPatientId, activeEncounterId, setActiveEncounterId, loading, error }}>
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
