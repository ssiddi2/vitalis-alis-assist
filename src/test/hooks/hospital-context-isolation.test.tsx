import { describe, expect, it, beforeEach, vi } from 'vitest';
import { act, render, renderHook, waitFor } from '@testing-library/react';
import { ReactNode } from 'react';

/**
 * Behavioural gate for facility/identity isolation in HospitalContext.
 * Every hospital-list query is held open so a response from a PREVIOUS user,
 * facility generation or auth-loading window can land after the switch.
 * Synthetic fixtures only — no live backend.
 */

type Deferred = { resolve: (v: unknown) => void; reject: (e: unknown) => void; promise: Promise<unknown> };
const pendingHospitals: Deferred[] = [];

const H = (id: string, name: string, emr = 'epic') => ({
  id, name, code: id.toUpperCase(), emr_system: emr,
  address: null, logo_url: null, connection_status: 'active',
});

function hospitalsBuilder(): Record<string, unknown> {
  let resolve!: (v: unknown) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
  pendingHospitals.push({ resolve, reject, promise });
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

async function nextRequest(): Promise<Deferred> {
  await waitFor(() => expect(pendingHospitals.length).toBeGreaterThan(0));
  return pendingHospitals.shift()!;
}
async function settleHospitals(rows: unknown[]) {
  const d = await nextRequest();
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

  it('rejects an encounter without a selected patient', async () => {
    const { result } = renderHook(() => useHospital(), { wrapper });
    await settleHospitals([H('a', 'Alpha')]);
    act(() => { result.current.setSelectedHospital(result.current.hospitals[0]); });

    act(() => { result.current.setActiveEncounterId('e-1'); });
    expect(result.current.activeEncounterId).toBeNull();

    act(() => { result.current.setSelectedPatientId('p-1'); });
    act(() => { result.current.setActiveEncounterId('e-1'); });
    expect(result.current.activeEncounterId).toBe('e-1');

    // Changing patient drops the encounter.
    act(() => { result.current.setSelectedPatientId('p-2'); });
    expect(result.current.activeEncounterId).toBeNull();
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

  it('never exposes previous-user state in any render of the switched tree', async () => {
    const seen: { user: string | null; hospitals: number; patient: string | null; facility: string | null }[] = [];
    let api: ReturnType<typeof useHospital> | null = null;
    function Probe() {
      const h = useHospital();
      api = h;
      seen.push({
        user: authState.user?.id ?? null,
        hospitals: h.hospitals.length,
        patient: h.selectedPatientId,
        facility: h.selectedHospital?.id ?? null,
      });
      return null;
    }
    const { rerender } = render(<HospitalProvider><Probe /></HospitalProvider>);
    await settleHospitals([H('a', 'Alpha')]);
    act(() => { api!.setSelectedHospital(api!.hospitals[0]); });
    act(() => { api!.setSelectedPatientId('p-1'); });

    // Sanity: the u1 tree really did carry populated state (guards vacuous every()).
    const u1Renders = seen.filter(s => s.user === 'u1');
    expect(u1Renders.some(s => s.hospitals > 0 && s.patient === 'p-1' && s.facility === 'a')).toBe(true);

    seen.length = 0;
    authState = { user: { id: 'u2' }, loading: false };
    await act(async () => { rerender(<HospitalProvider><Probe /></HospitalProvider>); });

    const u2Renders = seen.filter(s => s.user === 'u2');
    expect(u2Renders.length).toBeGreaterThan(0);
    expect(u2Renders.every(s => s.hospitals === 0 && s.patient === null && s.facility === null)).toBe(true);
  });

  it('re-entering auth-loading for the SAME user hides everything and revalidates', async () => {
    const seen: { loading: boolean; hospitals: number; patient: string | null }[] = [];
    let api: ReturnType<typeof useHospital> | null = null;
    function Probe() {
      const h = useHospital();
      api = h;
      seen.push({ loading: authState.loading, hospitals: h.hospitals.length, patient: h.selectedPatientId });
      return null;
    }
    const { rerender } = render(<HospitalProvider><Probe /></HospitalProvider>);
    await settleHospitals([H('a', 'Alpha'), H('b', 'Beta')]);
    act(() => { api!.setSelectedHospital(api!.hospitals[0]); });
    act(() => { api!.setSelectedPatientId('p-1'); });
    expect(seen.some(s => s.hospitals === 2 && s.patient === 'p-1')).toBe(true);

    const heldSetter = api!.setSelectedPatientId;
    seen.length = 0;
    authState = { user: { id: 'u1' }, loading: true };
    await act(async () => { rerender(<HospitalProvider><Probe /></HospitalProvider>); });

    // Fully hidden while re-authenticating, even though the user id is unchanged.
    const during = seen.filter(s => s.loading);
    expect(during.length).toBeGreaterThan(0);
    expect(during.every(s => s.hospitals === 0 && s.patient === null)).toBe(true);
    expect(api!.loading).toBe(true);
    expect(api!.selectedHospital).toBeNull();

    // Setters retained across the auth-loading edge are dead.
    act(() => { heldSetter('p-hacked'); });
    expect(api!.selectedPatientId).toBeNull();

    // Resolution revalidates against a freshly authorized (now reduced) list.
    authState = { user: { id: 'u1' }, loading: false };
    await act(async () => { rerender(<HospitalProvider><Probe /></HospitalProvider>); });
    await settleHospitals([H('b', 'Beta')]);
    expect(api!.hospitals.map(h => h.id)).toEqual(['b']);
    expect(api!.selectedHospital).toBeNull();
    expect(api!.selectedPatientId).toBeNull();
  });

  it('a response issued before auth-loading cannot restore revoked facilities', async () => {
    const { result, rerender } = renderHook(() => useHospital(), { wrapper });
    const preAuth = await nextRequest();

    authState = { user: { id: 'u1' }, loading: true };
    await act(async () => { rerender(); });
    authState = { user: { id: 'u1' }, loading: false };
    await act(async () => { rerender(); });

    await act(async () => { preAuth.resolve({ data: [H('revoked', 'Revoked')], error: null }); });
    expect(result.current.hospitals).toEqual([]);

    await settleHospitals([H('a', 'Alpha')]);
    expect(result.current.hospitals.map(h => h.id)).toEqual(['a']);
  });

  it('discards a late hospital-list response from a superseded generation (A→B→A)', async () => {
    const { result, rerender } = renderHook(() => useHospital(), { wrapper });
    const first = await nextRequest();

    authState = { user: { id: 'u2' }, loading: false };
    await act(async () => { rerender(); });
    authState = { user: { id: 'u1' }, loading: false };
    await act(async () => { rerender(); });

    await act(async () => { first.resolve({ data: [H('ghost', 'Ghost Facility')], error: null }); });
    expect(result.current.hospitals.map(h => h.id)).not.toContain('ghost');

    await settleHospitals([H('u2-only', 'Other Tenant')]);
    expect(result.current.hospitals).toEqual([]);

    await settleHospitals([H('a', 'Alpha')]);
    expect(result.current.hospitals.map(h => h.id)).toEqual(['a']);
  });

  it('overlapping refreshes for the same user: only the newest request may write', async () => {
    const { result } = renderHook(() => useHospital(), { wrapper });
    await settleHospitals([H('a', 'Alpha'), H('b', 'Beta')]);
    act(() => { result.current.setSelectedHospital(result.current.hospitals[0]); });

    act(() => { result.current.refresh(); });
    const stale = await nextRequest();
    act(() => { result.current.refresh(); });
    const fresh = await nextRequest();

    await act(async () => { stale.resolve({ data: [H('a', 'Alpha'), H('ghost', 'Ghost')], error: null }); });
    expect(result.current.hospitals.map(h => h.id)).toEqual(['a', 'b']);

    await act(async () => { fresh.resolve({ data: [H('a', 'Alpha')], error: null }); });
    expect(result.current.hospitals.map(h => h.id)).toEqual(['a']);
    expect(result.current.selectedHospital?.id).toBe('a');
  });

  it('a failed authorization read fails closed', async () => {
    const { result } = renderHook(() => useHospital(), { wrapper });
    await settleHospitals([H('a', 'Alpha')]);
    act(() => { result.current.setSelectedHospital(result.current.hospitals[0]); });
    act(() => { result.current.setSelectedPatientId('p-1'); });

    act(() => { result.current.refresh(); });
    const req = await nextRequest();
    await act(async () => { req.resolve({ data: null, error: { message: 'permission denied' } }); });

    expect(result.current.hospitals).toEqual([]);
    expect(result.current.selectedHospital).toBeNull();
    expect(result.current.selectedPatientId).toBeNull();
    expect(result.current.error).toBeTruthy();
    expect(sessionStorage.getItem('virtualis.selectedHospitalId')).toBeNull();
  });

  it('setters retained from facility A cannot write after A→B, nor after A→B→A', async () => {
    const { result } = renderHook(() => useHospital(), { wrapper });
    await settleHospitals([H('a', 'Alpha'), H('b', 'Beta')]);
    const [a, b] = result.current.hospitals;

    act(() => { result.current.setSelectedHospital(a); });
    const heldPatient = result.current.setSelectedPatientId;
    const heldEncounter = result.current.setActiveEncounterId;
    act(() => { heldPatient('p-a'); });
    act(() => { heldEncounter('e-a'); });
    expect(result.current.activeEncounterId).toBe('e-a');

    // A → B: the A-bound callbacks are dead.
    act(() => { result.current.setSelectedHospital(b); });
    act(() => { heldPatient('p-a'); });
    act(() => { heldEncounter('e-a'); });
    expect(result.current.selectedHospital?.id).toBe('b');
    expect(result.current.selectedPatientId).toBeNull();
    expect(result.current.activeEncounterId).toBeNull();

    // A → B → A (batched): scope advances twice, so the old callbacks stay dead.
    act(() => {
      result.current.setSelectedHospital(a);
      result.current.setSelectedHospital(b);
      result.current.setSelectedHospital(a);
    });
    act(() => { heldPatient('p-a'); });
    act(() => { heldEncounter('e-a'); });
    expect(result.current.selectedHospital?.id).toBe('a');
    expect(result.current.selectedPatientId).toBeNull();
    expect(result.current.activeEncounterId).toBeNull();

    // Freshly bound setters still work.
    act(() => { result.current.setSelectedPatientId('p-new'); });
    expect(result.current.selectedPatientId).toBe('p-new');
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

    act(() => { result.current.setSelectedHospital({ id: 'evil', name: 'Not Mine' } as Hospital); });
    expect(result.current.selectedHospital?.id).toBe('a');
    expect(sessionStorage.getItem('virtualis.selectedHospitalId')).toBe('a');
  });

  it('a SMART session from another issuer is never reported as connected', async () => {
    smartSession = { iss: 'https://other-facility.example.org/fhir', access_token: 'tok' };
    const { result } = renderHook(() => useHospital(), { wrapper });
    await settleHospitals([H('a', 'Alpha')]);
    act(() => { result.current.setSelectedHospital(result.current.hospitals[0]); });

    expect(result.current.emrConnection?.status).not.toBe('connected');
    expect(result.current.emrConnection?.sandbox).toBe(false);
  });

  it('with no connector configured it reports the neutral standalone state immediately', async () => {
    const { result } = renderHook(() => useHospital(), { wrapper });
    await settleHospitals([H('a', 'Alpha')]);
    act(() => { result.current.setSelectedHospital(result.current.hospitals[0]); });

    // No pretend "connecting" spinner, no error: standalone on the very next render.
    expect(result.current.emrConnection).toEqual({
      status: 'standalone', emr: 'epic', facilityId: 'a', sandbox: false,
      reason: 'external_ehr_not_configured',
    });
    // Clinical scope stays fully usable while standalone.
    act(() => { result.current.setSelectedPatientId('p-1'); });
    act(() => { result.current.setActiveEncounterId('e-1'); });
    expect(result.current.activeEncounterId).toBe('e-1');
  });


  it('reports loading while auth is resolving and issues no request', async () => {
    authState = { user: null, loading: true };
    const { result } = renderHook(() => useHospital(), { wrapper });
    expect(result.current.loading).toBe(true);
    expect(result.current.hospitals).toEqual([]);
    expect(result.current.selectedHospital).toBeNull();
    expect(pendingHospitals.length).toBe(0);
  });

  it('works under React StrictMode (mount flag restored on re-setup)', async () => {
    const { StrictMode } = await import('react');
    const strictWrapper = ({ children }: { children: ReactNode }) => (
      <StrictMode><HospitalProvider>{children}</HospitalProvider></StrictMode>
    );
    const { result } = renderHook(() => useHospital(), { wrapper: strictWrapper });
    // StrictMode double-invokes effects; drain every issued request with the same rows.
    await waitFor(() => expect(pendingHospitals.length).toBeGreaterThan(0));
    await act(async () => {
      while (pendingHospitals.length) {
        pendingHospitals.shift()!.resolve({ data: [H('a', 'Alpha'), H('b', 'Beta')], error: null });
        await Promise.resolve();
      }
    });
    await waitFor(() => expect(result.current.hospitals.length).toBe(2));

    act(() => { result.current.setSelectedHospital(result.current.hospitals[0]); });
    expect(result.current.selectedHospital?.id).toBe('a');
    act(() => { result.current.setSelectedPatientId('p-1'); });
    expect(result.current.selectedPatientId).toBe('p-1');
    act(() => { result.current.setActiveEncounterId('e-1'); });
    expect(result.current.activeEncounterId).toBe('e-1');
  });

  it('a rejected unauthorized selection leaves the current scope fully usable', async () => {
    const { result } = renderHook(() => useHospital(), { wrapper });
    await settleHospitals([H('a', 'Alpha'), H('b', 'Beta')]);
    vi.useFakeTimers();

    act(() => { result.current.setSelectedHospital(result.current.hospitals[0]); });
    act(() => { result.current.setSelectedPatientId('p-1'); });
    act(() => { result.current.setSelectedHospital({ id: 'evil', name: 'Not Mine' } as Hospital); });

    // Rejected object must not move any counter: fresh updates still land.
    expect(result.current.selectedHospital?.id).toBe('a');
    act(() => { result.current.setSelectedPatientId('p-2'); });
    expect(result.current.selectedPatientId).toBe('p-2');
    act(() => { result.current.setActiveEncounterId('e-2'); });
    expect(result.current.activeEncounterId).toBe('e-2');

    // EMR resolution for the still-selected facility must still complete.
    await act(async () => { vi.advanceTimersByTime(1500); });
    expect(result.current.emrConnection?.status).toBe('standalone');
    expect(result.current.emrConnection?.facilityId).toBe('a');
    vi.useRealTimers();

  });

  it('batched A->B->A still invalidates setters captured at A', async () => {
    const { result } = renderHook(() => useHospital(), { wrapper });
    await settleHospitals([H('a', 'Alpha'), H('b', 'Beta')]);
    act(() => { result.current.setSelectedHospital(result.current.hospitals[0]); });
    const heldPatient = result.current.setSelectedPatientId;

    act(() => {
      result.current.setSelectedHospital(result.current.hospitals[1]);
      result.current.setSelectedHospital(result.current.hospitals[0]);
    });
    act(() => { heldPatient('p-stale'); });
    expect(result.current.selectedHospital?.id).toBe('a');
    expect(result.current.selectedPatientId).toBeNull();
  });
});
