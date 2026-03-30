

# Voice Conversation with ALIS — British English Accent

## What You'll Get
A toggle in the ALIS panel that enables **voice mode**: you speak to ALIS naturally, and ALIS responds with a refined British English voice. Two modes:
- **Push-to-talk**: Tap the mic, speak, ALIS responds with voice
- **Ambient listening**: ALIS continuously listens, processes speech, and responds vocally — hands-free clinical workflow

## Architecture

```text
┌─────────────────────────────────────────┐
│            ALIS Panel (UI)              │
│  [Voice Mode Toggle]  [Ambient Toggle]  │
│                                         │
│  User speaks ──► ElevenLabs Scribe STT  │
│                    (realtime WebSocket)  │
│                         │               │
│                    transcript            │
│                         ▼               │
│              useALISChat.sendMessage()   │
│                         │               │
│                  AI text response        │
│                         ▼               │
│           ElevenLabs TTS Edge Function  │
│              (British voice: "George")  │
│                         │               │
│                   audio playback        │
└─────────────────────────────────────────┘
```

## Setup Required

**ElevenLabs API Key** — needed for both speech-to-text and text-to-speech. I'll use the `add_secret` tool to securely store it. You'll get the key from [elevenlabs.io](https://elevenlabs.io).

## Implementation

### 1. Edge Functions (2 new)

| Function | Purpose |
|----------|---------|
| `elevenlabs-tts` | Converts ALIS text responses to speech using voice "George" (JBFqnCBsd6RMkjVDRZzb) — refined British English |
| `elevenlabs-scribe-token` | Generates single-use tokens for real-time STT WebSocket |

### 2. New Hook: `useALISVoice`

Encapsulates all voice logic:
- `voiceEnabled` state — toggles TTS for ALIS responses
- `ambientEnabled` state — toggles continuous listening via ElevenLabs Scribe
- `speakResponse(text)` — calls TTS edge function, plays audio
- Auto-triggers `sendMessage()` when ambient transcript commits
- Queues audio playback so responses don't overlap

### 3. UI Changes

**ALISPanel header** — add two compact toggles:
- 🔊 **Voice** — when on, ALIS speaks responses aloud (British accent)
- 🎙️ **Ambient** — when on, continuous listening with real-time partial transcript shown above input

**Input area** — when ambient is active, show live partial transcript with a pulsing indicator

### 4. Voice Selection

Using ElevenLabs voice **"George"** (`JBFqnCBsd6RMkjVDRZzb`) — a natural British English male voice. Clean, professional, appropriate for clinical context.

## Files

| Action | File |
|--------|------|
| Create | `supabase/functions/elevenlabs-tts/index.ts` |
| Create | `supabase/functions/elevenlabs-scribe-token/index.ts` |
| Create | `src/hooks/useALISVoice.ts` |
| Edit | `src/components/virtualis/ALISPanel.tsx` — add voice/ambient toggles, wire hook |
| Edit | `supabase/config.toml` — add function entries |

## Dependencies

- `@elevenlabs/react` — for `useScribe` hook (real-time STT)

## Build Order

1. Add ElevenLabs API key secret
2. Create both edge functions
3. Install `@elevenlabs/react`
4. Build `useALISVoice` hook
5. Wire into ALISPanel UI

