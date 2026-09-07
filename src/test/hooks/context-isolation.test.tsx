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
const inserts: { table: string; payload: Record<string, unknown> }[] = [];

function defer(table: string): Deferred {
  let resolve!: (v: unknown) => void;
  const promise = new Promise((r) => { resolve = r; });
  const d = { resolve, promise };
  (pending[table] ||= []).push(d);
  return d;
}

function flush(table: string, data: unknown) {
  const queue = pending[table] || [];
  const list = queue.splice(0, queue.length);
  list.forEach((d) => d.resolve({ data, error: null }));
  return list.length;
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
    channel: () => {
      const ch: Record<string, unknown> = { id: Math.random() };
      ch.on = () => ch;
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
const channelB = { ...channelA, id: 'chan-B', hospital_id: 'hosp-B', name: 'B' };

beforeEach(() => {
  for (const k of Object.keys(pending)) delete pending[k];
  removedChannels.length = 0;
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

    await act(async () => { void result.current.selectChannel(channelA); });
    await act(async () => {
      flush('team_messages', [{ id: 'm1', channel_id: 'chan-A', sender_id: 'user-1', content: 'hi', message_type: 'text', reply_to_id: null, read_by: [], created_at: '2026-01-01T00:00:00Z' }]);
      flush('channel_members', [{ id: 'cm1', channel_id: 'chan-A', user_id: 'user-1', joined_at: '2026-01-01T00:00:00Z' }]);
      flush('profiles', []);
      flush('profiles', []);
    });
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
    await act(async () => { void result.current.selectChannel(channelA); });
    await act(async () => {
      flush('team_messages', []); flush('channel_members', []);
      flush('profiles', []); flush('profiles', []);
    });
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
