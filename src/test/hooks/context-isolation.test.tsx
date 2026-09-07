import { describe, expect, it, beforeEach, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';

/**
 * Behavioural regression gate for cross-facility / cross-note data bleed.
 *
 * These tests drive the real hooks against a controllable fake backend where
 * every query's resolution is held open, so a response from a *previous*
 * facility/user/note can land after the context already switched.
 */

type Deferred = { resolve: (v: unknown) => void; promise: Promise<unknown> };

const pending: Record<string, Deferred[]> = {};
const removedChannels: unknown[] = [];
type RtSub = { name: string; handler: (p: { new: unknown }) => void };
const realtime: RtSub[] = [];
const inserts: { table: string; payload: Record<string, unknown> }[] = [];

function defer(table: string): Deferred {
  let resolve!: (v: unknown) => void;
  const promise = new Promise((r) => { resolve = r; });
  const d = { resolve, promise };
  (pending[table] ||= []).push(d);
  return d;
}

/** Resolve the OLDEST in-flight query for a table (later ones stay pending). */
function flush(table: string, data: unknown) {
  const d = (pending[table] || []).shift();
  d?.resolve({ data, error: null });
}

/** Wait for a query to be issued, then resolve it. */
async function settle(table: string, data: unknown) {
  await waitFor(() => expect(pending[table]?.length).toBeGreaterThan(0));
  await act(async () => { flush(table, data); });
}

function builder(table: string) {
  const d = defer(table);
  const chain: Record<string, unknown> = {};
  for (const m of ['select', 'eq', 'order', 'in', 'single']) {
    chain[m] = () => chain;
  }
  chain.insert = (payload: Record<string, unknown>) => {
    inserts.push({ table, payload });
    d.resolve({ data: { id: 'new-row', ...payload }, error: null });
    return chain;
  };
  chain.then = (onOk: (v: unknown) => unknown, onErr?: (e: unknown) => unknown) =>
    d.promise.then(onOk, onErr);
  return chain;
}

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: (table: string) => builder(table),
    channel: (name: string) => {
      const ch: Record<string, unknown> = { id: Math.random() };
      ch.on = (_evt: unknown, _cfg: unknown, handler: (p: { new: unknown }) => void) => {
        realtime.push({ name, handler });
        return ch;
      };
      ch.subscribe = () => ch;
      return ch;
    },
    removeChannel: (ch: unknown) => { removedChannels.push(ch); },
  },
}));

let currentUser: { id: string } | null = { id: 'user-1' };
let currentHospital: { id: string } | null = { id: 'hosp-A' };

vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: currentUser }) }));
vi.mock('@/contexts/HospitalContext', () => ({
  useHospital: () => ({ selectedHospital: currentHospital }),
}));

import { useTeamChat } from '@/hooks/useTeamChat';
import { useNoteIntegrity } from '@/hooks/useNoteIntegrity';

const channelA = {
  id: 'chan-A', hospital_id: 'hosp-A', patient_id: null, name: 'A',
  channel_type: 'department' as const, created_by: 'user-1',
  created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z',
};
const channelA2 = { ...channelA, id: 'chan-A2', name: 'A2' };
const channelB = { ...channelA, id: 'chan-B', hospital_id: 'hosp-B', name: 'B' };

const msg = (id: string, channelId: string) => ({
  id, channel_id: channelId, sender_id: 'user-1', content: id, message_type: 'text',
  reply_to_id: null, read_by: [], created_at: '2026-01-01T00:00:00Z',
});

/** Load channel A into the active conversation with empty messages/members. */
async function openChannel(result: { current: ReturnType<typeof useTeamChat> }, channel = channelA) {
  act(() => { void result.current.selectChannel(channel); });
  await settle('team_messages', []);
  await settle('profiles', []);
  await settle('channel_members', []);
  await settle('profiles', []);
  await waitFor(() => expect(result.current.activeChannel?.id).toBe(channel.id));
}

beforeEach(() => {
  for (const k of Object.keys(pending)) delete pending[k];
  removedChannels.length = 0;
  realtime.length = 0;
  inserts.length = 0;
  currentUser = { id: 'user-1' };
  currentHospital = { id: 'hosp-A' };
});

describe('useTeamChat facility isolation', () => {
  it('discards a channel list that resolves after the facility changed', async () => {
    const { result, rerender } = renderHook(() => useTeamChat());
    await waitFor(() => expect(pending.team_channels?.length).toBeGreaterThan(0));

    // Facility switches while the hosp-A query is still in flight.
    currentHospital = { id: 'hosp-B' };
    rerender();
    await act(async () => { flush('team_channels', [channelA]); });

    expect(result.current.channels).toEqual([]);

    // The new facility's response is accepted.
    await waitFor(() => expect(pending.team_channels?.length).toBeGreaterThan(0));
    await act(async () => { flush('team_channels', [channelB]); });
    await waitFor(() => expect(result.current.channels).toEqual([channelB]));
  });

  it('clears conversation, members and errors when the facility changes', async () => {
    const { result, rerender } = renderHook(() => useTeamChat());
    await act(async () => { flush('team_channels', [channelA]); });

    act(() => { void result.current.selectChannel(channelA); });
    await settle('team_messages', [{ id: 'm1', channel_id: 'chan-A', sender_id: 'user-1', content: 'hi', message_type: 'text', reply_to_id: null, read_by: [], created_at: '2026-01-01T00:00:00Z' }]);
    await settle('profiles', []);
    await settle('channel_members', [{ id: 'cm1', channel_id: 'chan-A', user_id: 'user-1', joined_at: '2026-01-01T00:00:00Z' }]);
    await settle('profiles', []);
    await waitFor(() => expect(result.current.messages).toHaveLength(1));
    expect(result.current.activeChannel?.id).toBe('chan-A');

    currentHospital = { id: 'hosp-B' };
    rerender();

    await waitFor(() => {
      expect(result.current.activeChannel).toBeNull();
      expect(result.current.messages).toEqual([]);
      expect(result.current.members).toEqual([]);
      expect(result.current.channels).toEqual([]);
      expect(result.current.error).toBeNull();
    });
  });

  it('clears everything when the authenticated user changes', async () => {
    const { result, rerender } = renderHook(() => useTeamChat());
    await act(async () => { flush('team_channels', [channelA]); });
    await waitFor(() => expect(result.current.channels).toHaveLength(1));

    currentUser = { id: 'user-2' };
    rerender();
    await waitFor(() => expect(result.current.channels).toEqual([]));
  });

  it('unsubscribes the old realtime channel when the active channel or facility changes', async () => {
    const { result, rerender } = renderHook(() => useTeamChat());
    await act(async () => { flush('team_channels', [channelA]); });
    act(() => { void result.current.selectChannel(channelA); });
    await settle('team_messages', []);
    await settle('profiles', []);
    await settle('channel_members', []);
    await settle('profiles', []);
    expect(removedChannels).toHaveLength(0);

    currentHospital = { id: 'hosp-B' };
    rerender();
    await waitFor(() => expect(removedChannels).toHaveLength(1));
  });

  it('refuses to select a channel from another facility', async () => {
    const { result } = renderHook(() => useTeamChat());
    await act(async () => { flush('team_channels', []); });

    await act(async () => { void result.current.selectChannel(channelB); });
    await waitFor(() => expect(result.current.error).toMatch(/another facility/i));
    expect(result.current.activeChannel).toBeNull();
    expect(inserts).toHaveLength(0);
  });

  it('refuses to send to a channel that is not the active in-facility channel', async () => {
    const { result } = renderHook(() => useTeamChat());
    await act(async () => { flush('team_channels', []); });

    let sent: unknown = 'unset';
    await act(async () => { sent = await result.current.sendMessage({ channel_id: 'chan-B', content: 'leak' }); });
    expect(sent).toBeNull();
    expect(inserts.filter((i) => i.table === 'team_messages')).toHaveLength(0);
  });

  it('refuses to create a channel for a different facility', async () => {
    const { result } = renderHook(() => useTeamChat());
    await act(async () => { flush('team_channels', []); });

    let created: unknown = 'unset';
    await act(async () => { created = await result.current.createChannel({ hospital_id: 'hosp-B', name: 'x', channel_type: 'department' }); });
    expect(created).toBeNull();
    expect(inserts.filter((i) => i.table === 'team_channels')).toHaveLength(0);
  });

  it('stamps created channels with the current facility', async () => {
    const { result } = renderHook(() => useTeamChat());
    await act(async () => { flush('team_channels', []); });

    await act(async () => { await result.current.createChannel({ hospital_id: '', name: 'x', channel_type: 'department' }); });
    const insert = inserts.find((i) => i.table === 'team_channels');
    expect(insert?.payload.hospital_id).toBe('hosp-A');
  });

  it('drops a same-facility channel A response that lands after switching to channel B', async () => {
    const { result } = renderHook(() => useTeamChat());
    await act(async () => { flush('team_channels', [channelA, channelA2]); });

    // Open A but leave its message query in flight.
    act(() => { void result.current.selectChannel(channelA); });
    await waitFor(() => expect(pending.team_messages?.length).toBeGreaterThan(0));

    // Switch to A2 (same facility, different channel) before A resolves.
    act(() => { void result.current.selectChannel(channelA2); });
    await waitFor(() => expect(pending.team_messages?.length).toBe(2));

    await act(async () => { flush('team_messages', [msg('from-A', 'chan-A')]); });
    expect(result.current.messages).toEqual([]);
    expect(result.current.activeChannel?.id).toBe('chan-A2');

    await act(async () => { flush('team_messages', [msg('from-A2', 'chan-A2')]); });
    await settle('profiles', []);
    await waitFor(() => expect(result.current.messages.map((m) => m.id)).toEqual(['from-A2']));
  });

  it('drops a facility A response after an A -> B -> A round trip', async () => {
    const { result, rerender } = renderHook(() => useTeamChat());
    await waitFor(() => expect(pending.team_channels?.length).toBe(1));

    currentHospital = { id: 'hosp-B' };
    rerender();
    await waitFor(() => expect(pending.team_channels?.length).toBe(2));
    currentHospital = { id: 'hosp-A' };
    rerender();
    await waitFor(() => expect(pending.team_channels?.length).toBe(3));

    // The FIRST hosp-A request resolves last: same facility, superseded generation.
    await act(async () => { flush('team_channels', [channelA]); });
    expect(result.current.channels).toEqual([]);

    await act(async () => { flush('team_channels', [channelB]); }); // stale hosp-B
    expect(result.current.channels).toEqual([]);

    await act(async () => { flush('team_channels', [channelA2]); }); // current generation
    await waitFor(() => expect(result.current.channels).toEqual([channelA2]));
  });

  it('drops a note-style A -> B -> A conversation response for the first A selection', async () => {
    const { result } = renderHook(() => useTeamChat());
    await act(async () => { flush('team_channels', [channelA, channelA2]); });

    act(() => { void result.current.selectChannel(channelA); });
    await waitFor(() => expect(pending.team_messages?.length).toBe(1));
    act(() => { void result.current.selectChannel(channelA2); });
    await waitFor(() => expect(pending.team_messages?.length).toBe(2));
    act(() => { void result.current.selectChannel(channelA); });
    await waitFor(() => expect(pending.team_messages?.length).toBe(3));

    await act(async () => { flush('team_messages', [msg('stale-A', 'chan-A')]); });
    expect(result.current.messages).toEqual([]);
  });

  it('ignores a realtime callback retained from a previous channel selection', async () => {
    const { result } = renderHook(() => useTeamChat());
    await act(async () => { flush('team_channels', [channelA, channelA2]); });
    await openChannel(result, channelA);
    await waitFor(() => expect(realtime.length).toBe(1));
    const staleHandler = realtime[0].handler;

    await openChannel(result, channelA2);
    await waitFor(() => expect(removedChannels).toHaveLength(1));

    await act(async () => { staleHandler({ new: msg('leaked', 'chan-A') }); });
    expect(result.current.messages).toEqual([]);

    const liveHandler = realtime[realtime.length - 1].handler;
    await act(async () => { liveHandler({ new: msg('live', 'chan-A2') }); });
    await waitFor(() => expect(result.current.messages.map((m) => m.id)).toEqual(['live']));
  });

  it('rejects a mutation callback retained from a superseded facility', async () => {
    const { result, rerender } = renderHook(() => useTeamChat());
    await act(async () => { flush('team_channels', [channelA]); });
    await openChannel(result, channelA);

    const staleCreate = result.current.createChannel;
    const staleSend = result.current.sendMessage;
    const staleAdd = result.current.addMember;

    currentHospital = { id: 'hosp-B' };
    rerender();
    await waitFor(() => expect(result.current.channels).toEqual([]));
    const writesBefore = inserts.length;

    let created: unknown = 'unset';
    let sent: unknown = 'unset';
    await act(async () => {
      created = await staleCreate({ hospital_id: 'hosp-A', name: 'stale', channel_type: 'department' });
      sent = await staleSend({ channel_id: 'chan-A', content: 'stale' });
      await staleAdd('chan-A', 'user-9');
    });

    expect(created).toBeNull();
    expect(sent).toBeNull();
    expect(inserts).toHaveLength(writesBefore);
    expect(result.current.activeChannel).toBeNull();
  });

  it('addMember refuses a channel that is not the active selection', async () => {
    const { result } = renderHook(() => useTeamChat());
    await act(async () => { flush('team_channels', [channelA, channelA2]); });
    await openChannel(result, channelA);
    const writesBefore = inserts.length;

    await act(async () => { await result.current.addMember('chan-A2', 'user-9'); });
    expect(inserts).toHaveLength(writesBefore);

    await act(async () => { await result.current.addMember('chan-B', 'user-9'); });
    expect(inserts).toHaveLength(writesBefore);

    // The active channel is accepted and does write.
    act(() => { void result.current.addMember('chan-A', 'user-9'); });
    await waitFor(() => expect(inserts.filter((i) => i.table === 'channel_members')).toHaveLength(1));
  });

  it('a create that resolves after a facility switch neither returns nor writes into the new context', async () => {
    const { result, rerender } = renderHook(() => useTeamChat());
    await act(async () => { flush('team_channels', [channelA]); });

    let created: unknown = 'unset';
    const call = act(async () => {
      created = await result.current.createChannel({ hospital_id: 'hosp-A', name: 'late', channel_type: 'department' });
    });
    currentHospital = { id: 'hosp-B' };
    rerender();
    await call;

    expect(created).toBeNull();
    expect(result.current.channels).toEqual([]);
  });
});

describe('useNoteIntegrity note isolation', () => {
  const version = (noteTag: string) => [{ id: `v-${noteTag}`, version: 1, content_hash: 'h', signed_at: '2026-01-01T00:00:00Z', author_id: 'user-1' }];

  it('clears previous note state immediately when the note id changes', async () => {
    const { result, rerender } = renderHook(({ id }: { id: string }) => useNoteIntegrity(id), {
      initialProps: { id: 'note-1' },
    });
    await act(async () => { flush('note_versions', version('1')); flush('note_addenda', []); });
    await waitFor(() => expect(result.current.versions).toHaveLength(1));

    rerender({ id: 'note-2' });
    expect(result.current.versions).toEqual([]);
    expect(result.current.addenda).toEqual([]);
  });

  it('ignores a response that resolves after the note switched', async () => {
    const { result, rerender } = renderHook(({ id }: { id: string }) => useNoteIntegrity(id), {
      initialProps: { id: 'note-1' },
    });
    await waitFor(() => expect(pending.note_versions?.length).toBeGreaterThan(0));

    rerender({ id: 'note-2' });
    // note-1's late response lands now and must be dropped.
    await act(async () => { flush('note_versions', version('1')); flush('note_addenda', []); });
    expect(result.current.versions).toEqual([]);

    await waitFor(() => expect(pending.note_versions?.length).toBeGreaterThan(0));
    await act(async () => { flush('note_versions', version('2')); flush('note_addenda', []); });
    await waitFor(() => expect(result.current.versions[0].id).toBe('v-2'));
  });

  it('drops a note A response after an A -> B -> A round trip', async () => {
    const { result, rerender } = renderHook(({ id }: { id: string }) => useNoteIntegrity(id), {
      initialProps: { id: 'note-1' },
    });
    await waitFor(() => expect(pending.note_versions?.length).toBe(1));
    rerender({ id: 'note-2' });
    await waitFor(() => expect(pending.note_versions?.length).toBe(2));
    rerender({ id: 'note-1' });
    await waitFor(() => expect(pending.note_versions?.length).toBe(3));

    // First note-1 request resolves last — same note id, superseded generation.
    await act(async () => { flush('note_versions', version('stale')); flush('note_addenda', []); });
    expect(result.current.versions).toEqual([]);

    await act(async () => { flush('note_versions', version('b')); flush('note_addenda', []); });
    expect(result.current.versions).toEqual([]);

    await act(async () => { flush('note_versions', version('current')); flush('note_addenda', []); });
    await waitFor(() => expect(result.current.versions[0].id).toBe('v-current'));
  });

  it('exposes nothing from the previous note on the transition render', async () => {
    const seen: string[][] = [];
    const { rerender } = renderHook(({ id }: { id: string }) => {
      const r = useNoteIntegrity(id);
      seen.push(r.versions.map((v) => v.id));
      return r;
    }, { initialProps: { id: 'note-1' } });
    await act(async () => { flush('note_versions', version('1')); flush('note_addenda', []); });
    await waitFor(() => expect(seen[seen.length - 1]).toEqual(['v-1']));

    const before = seen.length;
    rerender({ id: 'note-2' });
    // Every render after the switch must be empty — including the first one.
    expect(seen.slice(before).every((v) => v.length === 0)).toBe(true);
  });

  it('clears state when the hook is disabled', async () => {
    const { result, rerender } = renderHook(({ on }: { on: boolean }) => useNoteIntegrity('note-1', on), {
      initialProps: { on: true },
    });
    await act(async () => { flush('note_versions', version('1')); flush('note_addenda', []); });
    await waitFor(() => expect(result.current.versions).toHaveLength(1));

    rerender({ on: false });
    expect(result.current.versions).toEqual([]);
    expect(result.current.loading).toBe(false);
  });
});
