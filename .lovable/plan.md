

# Update ELEVENLABS_AGENT_ID Secret

## What
Update the `ELEVENLABS_AGENT_ID` secret to the new agent ID: `agent_9601kmyqthb6f849gkvd56d7qf4e`

## Steps
1. Use the `add_secret` tool to update `ELEVENLABS_AGENT_ID` with the provided agent ID
2. Test the edge function to confirm it returns a valid conversation token

## No code changes needed
The edge function and hook already reference `ELEVENLABS_AGENT_ID` — just the secret value needs updating.

