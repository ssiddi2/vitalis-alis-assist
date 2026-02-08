import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

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

interface HospitalContextType {
  hospitals: Hospital[];
  selectedHospital: Hospital | null;
  setSelectedHospital: (hospital: Hospital | null) => void;
  loading: boolean;
  error: string | null;
}

const HospitalContext = createContext<HospitalContextType | undefined>(undefined);

export function HospitalProvider({ children }: { children: ReactNode }) {
  const [hospitals, setHospitals] = useState<Hospital[]>([]);
  const [selectedHospital, setSelectedHospital] = useState<Hospital | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user, loading: authLoading, isAdmin } = useAuth();

  useEffect(() => {
    async function fetchHospitals() {
      // Wait for auth to finish loading
      if (authLoading) {
        return;
      }

      if (!user) {
        setHospitals([]);
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);

        console.log('Fetching hospitals for user:', user.id);

        // Fetch hospitals - admins see all, others see based on hospital_users
        const { data: hospitalsData, error: hospitalsError } = await supabase
          .from('hospitals')
          .select('*');
        
        if (hospitalsError) {
          console.error('Hospitals query error:', hospitalsError);
          throw hospitalsError;
        }

        console.log('Hospitals fetched:', hospitalsData?.length || 0);

        // Fetch patient counts per hospital
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
      } catch (err) {
        console.error('Error fetching hospitals:', err);
        setError(err instanceof Error ? err.message : 'Failed to load hospitals');
      } finally {
        setLoading(false);
      }
    }

    fetchHospitals();
  }, [user, authLoading, isAdmin]);

  return (
    <HospitalContext.Provider value={{ hospitals, selectedHospital, setSelectedHospital, loading, error }}>
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
