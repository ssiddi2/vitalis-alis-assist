import { describe, expect, it, beforeEach, vi } from 'vitest';
import { act, render, renderHook, waitFor } from '@testing-library/react';
import { ReactNode } from 'react';

/**
 * Behavioural gate for facility/identity isolation in HospitalContext.
 * Every hospital-list query is held open so a response from a PREVIOUS user or
 * facility generation can land after the context already switched.
 * Synthetic fixtures only — no live backend.
 */

type Deferred = { resolve: (v: unknown) => void; promise: Promise<unknown> };
const pendingHospitals: Deferred[] = [];

const H = (id: string, name: string, emr = 'epic') => ({
  id, name, code: id.toUpperCase(), emr_system: emr,
  address: null, logo_url: null, connection_status: 'active',
});

function hospitalsBuilder(): Record<string, unknown> {
  let resolve!: (v: unknown) => void;
  const promise = new Promise((r) => { resolve = r; });
  pendingHospitals.push({ resolve, promise });
  const chain: Record<string, unknown> = {};
  chain.select = () => chain;
  chain.then = (ok: (v: unknown) => unknown, err?: (e: unknown) => unknown) => promise.then(ok, err);
  return chain;
}

/** patients count queries resolve immediately (not the subject under test). */
function countBuilder(): Record<string, unknown> {
  const chain: Record<string, unknown> = {};
  for (const m of ['select', 'eq', 'in']) chain[m] = () => chain;
  chain.then = (ok: (v: unknown) => unknown) => Promise.resolve({ count: 0, error: null }).then(ok);
  return chain;
}

vi.mock('@/integrations/supabase/client', () => ({
  supabase: { from: (t: string) => (t === 'hospitals' ? hospitalsBuilder() : countBuilder()) },
}));

let authState: { user: { id: string } | null; loading: boolean } = { user: { id: 'u1' }, loading: false };
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => authState }));

let smartSession: { iss: string; access_token: string } | null = null;
vi.mock('@/lib/smart', () => ({ loadSmartSession: () => smartSession }));

import { HospitalProvider, useHospital, Hospital } from '@/contexts/HospitalContext';

async function settleHospitals(rows: unknown[]) {
  await waitFor(() => expect(pendingHospitals.length).toBeGreaterThan(0));
  const d = pendingHospitals.shift()!;
  await act(async () => { d.resolve({ data: rows, error: null }); });
}

const wrapper = ({ children }: { children: ReactNode }) => <HospitalProvider>{children}</HospitalProvider>;

beforeEach(() => {
  pendingHospitals.length = 0;
  sessionStorage.clear();
  smartSession = null;
  authState = { user: { id: 'u1' }, loading: false };
});

describe('HospitalContext isolation', () => {
  it('clears patient and encounter when the facility changes', async () => {
    const { result } = renderHook(() => useHospital(), { wrapper });
    await settleHospitals([H('a', 'Alpha'), H('b', 'Beta')]);

    act(() => { result.current.setSelectedHospital(result.current.hospitals[0]); });
    act(() => { result.current.setSelectedPatientId('p-1'); });
    act(() => { result.current.setActiveEncounterId('e-1'); });
    expect(result.current.selectedPatientId).toBe('p-1');
    expect(result.current.activeEncounterId).toBe('e-1');

    act(() => { result.current.setSelectedHospital(result.current.hospitals[1]); });
    expect(result.current.selectedHospital?.id).toBe('b');
    expect(result.current.selectedPatientId).toBeNull();
    expect(result.current.activeEncounterId).toBeNull();
    expect(sessionStorage.getItem('virtualis.selectedPatientId')).toBeNull();
  });

  it('logout clears persisted facility and patient selections', async () => {
    const { result, rerender } = renderHook(() => useHospital(), { wrapper });
    await settleHospitals([H('a', 'Alpha')]);
    act(() => { result.current.setSelectedHospital(result.current.hospitals[0]); });
    act(() => { result.current.setSelectedPatientId('p-1'); });
    expect(sessionStorage.getItem('virtualis.selectedHospitalId')).toBe('a');

    authState = { user: null, loading: false };
    await act(async () => { rerender(); });

    expect(result.current.selectedHospital).toBeNull();
    expect(result.current.selectedPatientId).toBeNull();
    expect(result.current.hospitals).toEqual([]);
    expect(sessionStorage.getItem('virtualis.selectedHospitalId')).toBeNull();
    expect(sessionStorage.getItem('virtualis.selectedPatientId')).toBeNull();
  });

  it('a user switch never exposes the previous user state, even mid-transition', async () => {
    const seen: { user: string | null; hospitals: number; patient: string | null }[] = [];
    function Probe() {
      const h = useHospital();
      seen.push({ user: authState.user?.id ?? null, hospitals: h.hospitals.length, patient: h.selectedPatientId });
      return null;
    }
    const { result, rerender } = renderHook(() => useHospital(), { wrapper });
    await settleHospitals([H('a', 'Alpha')]);
    act(() => { result.current.setSelectedHospital(result.current.hospitals[0]); });
    act(() => { result.current.setSelectedPatientId('p-1'); });

    render(<HospitalProvider><Probe /></HospitalProvider>);
    await settleHospitals([H('a', 'Alpha')]);
    seen.length = 0;

    authState = { user: { id: 'u2' }, loading: false };
    await act(async () => { rerender(); });

    // Nothing from user u1 leaks into any render observed while u2 is active.
    expect(seen.filter(s => s.user === 'u2').every(s => s.hospitals === 0 && s.patient === null)).toBe(true);
    expect(result.current.selectedPatientId).toBeNull();
    expect(result.current.selectedHospital).toBeNull();
  });

  it('discards a late hospital-list response from a superseded generation (A→B→A)', async () => {
    const { result, rerender } = renderHook(() => useHospital(), { wrapper });
    const first = pendingHospitals[0] ?? (await waitFor(() => pendingHospitals[0]));

    authState = { user: { id: 'u2' }, loading: false };
    await act(async () => { rerender(); });
    authState = { user: { id: 'u1' }, loading: false };
    await act(async () => { rerender(); });

    // The original (generation-1) response lands only now.
    await act(async () => { first.resolve({ data: [H('ghost', 'Ghost Facility')], error: null }); });
    expect(result.current.hospitals.map(h => h.id)).not.toContain('ghost');

    // The u2 generation's response is likewise superseded.
    await settleHospitals([H('u2-only', 'Other Tenant')]);
    expect(result.current.hospitals).toEqual([]);

    // Only the current generation's response is honoured.
    console.log('PENDING', pendingHospitals.length);
    await settleHospitals([H('a', 'Alpha')]);
    console.log('STATE', JSON.stringify(result.current.hospitals), result.current.loading);
    expect(result.current.hospitals.map(h => h.id)).toEqual(['a']);
  });

  it('drops a hydrated facility id that is no longer accessible', async () => {
    sessionStorage.setItem('virtualis.selectedHospitalId', 'revoked');
    sessionStorage.setItem('virtualis.selectedPatientId', 'p-9');
    const { result } = renderHook(() => useHospital(), { wrapper });
    await settleHospitals([H('a', 'Alpha')]);

    expect(result.current.selectedHospital).toBeNull();
    expect(result.current.selectedPatientId).toBeNull();
    expect(sessionStorage.getItem('virtualis.selectedHospitalId')).toBeNull();
  });

  it('refuses a facility object outside the authorized list', async () => {
    const { result } = renderHook(() => useHospital(), { wrapper });
    await settleHospitals([H('a', 'Alpha')]);
    act(() => { result.current.setSelectedHospital(result.current.hospitals[0]); });

    act(() => {
      result.current.setSelectedHospital({ id: 'evil', name: 'Not Mine' } as Hospital);
    });
    expect(result.current.selectedHospital?.id).toBe('a');
    expect(sessionStorage.getItem('virtualis.selectedHospitalId')).toBe('a');
  });

  it('a SMART session from another issuer is never reported as connected', async () => {
    vi.useFakeTimers();
    smartSession = { iss: 'https://other-facility.example.org/fhir', access_token: 'tok' };
    const { result } = renderHook(() => useHospital(), { wrapper });
    await act(async () => {
      const d = pendingHospitals.shift()!;
      d.resolve({ data: [H('a', 'Alpha')], error: null });
      await Promise.resolve();
    });
    act(() => { result.current.setSelectedHospital(result.current.hospitals[0]); });
    await act(async () => { vi.advanceTimersByTime(1500); });

    expect(result.current.emrConnection?.status).toBe('unavailable');
    expect(result.current.emrConnection?.sandbox).toBe(false);
    expect(result.current.emrConnection?.reason).toBe('smart_session_not_bound_to_facility');
    vi.useRealTimers();
  });

  it('reports loading while auth is resolving and exposes nothing', async () => {
    authState = { user: null, loading: true };
    const { result } = renderHook(() => useHospital(), { wrapper });
    expect(result.current.loading).toBe(true);
    expect(result.current.hospitals).toEqual([]);
    expect(result.current.selectedHospital).toBeNull();
    expect(pendingHospitals.length).toBe(0);

    authState = { user: { id: 'u1' }, loading: false };
    await act(async () => { /* flush */ });
  });
});
