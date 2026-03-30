

# ALIS Voice — ElevenLabs Conversational Agent

## Why it failed before
The `ELEVENLABS_API_KEY` secret was never added. Edge functions returned 500 because `Deno.env.get("ELEVENLABS_API_KEY")` was undefined.

## Fix: Use the ElevenLabs Connector
There's a built-in ElevenLabs connector available. I'll link it to the project — this automatically provisions the API key as an environment variable. No manual secret entry needed.

## Architecture

The ElevenLabs Conversational Agent handles **both** STT and TTS in a single WebRTC session — the user speaks, the agent responds with George's British voice. No separate STT/TTS edge functions needed.

```text
ALISPanel
  ├── Text Mode (existing) → alis-chat edge function → Gemini
  └── Voice Mode (new)     → ElevenLabs Agent (WebRTC)
                               ├── STT: scribe built-in
                               ├── LLM: ElevenLabs-hosted (with ALIS system prompt)
                               └── TTS: George voice (British English)
```

## Setup Required (on ElevenLabs)
You'll need to create an Agent on [elevenlabs.io/conversational-ai](https://elevenlabs.io) with:
- Voice: **George** (British English)
- System prompt: ALIS clinical assistant prompt (I'll provide it)
- Then paste the Agent ID into the app

## Implementation

### Step 1: Connect ElevenLabs
Link the ElevenLabs connector to get the API key automatically.

### Step 2: Edge Function — Token Generation
Create `supabase/functions/elevenlabs-conversation-token/index.ts` that generates a single-use WebRTC token for the agent. Takes `agent_id` from request body, calls ElevenLabs token endpoint.

### Step 3: Voice Hook
Create `src/hooks/useALISVoice.ts`:
- Uses `useConversation` from `@elevenlabs/react`
- Manages `voiceEnabled` state
- Fetches token from edge function, starts WebRTC session
- Injects patient context via `overrides.agent.prompt` so the agent knows the current patient
- Exposes `startVoice()`, `stopVoice()`, `isSpeaking`, `status`

### Step 4: Wire into ALISPanel
Add a **Voice Mode** toggle button in the header. When active:
- Shows pulsing indicator + "ALIS Listening"
- Hides text input area
- Shows real-time status (listening / speaking)
- Transcripts from `onMessage` callbacks get appended to the chat message list for context

### Files

| Action | File |
|--------|------|
| Create | `supabase/functions/elevenlabs-conversation-token/index.ts` |
| Create | `src/hooks/useALISVoice.ts` |
| Edit   | `src/components/virtualis/ALISPanel.tsx` — voice toggle + status |
| Edit   | `supabase/config.toml` — add function entry |

### Dependencies
- `@elevenlabs/react`

### Build Order
1. Link ElevenLabs connector
2. Create token edge function
3. Install `@elevenlabs/react`
4. Build `useALISVoice` hook
5. Wire into ALISPanel UI
6. User creates agent on ElevenLabs and provides Agent ID

