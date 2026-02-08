

# Fix ALIS Chat Experience

## Problem Identified

When chatting with ALIS in **Demo Mode**, you're getting generic responses like:
> "I can help you with that. In production, I would access real-time clinical data..."

This happens because Demo Mode is designed for **scripted button-driven flows**, not free-form chat. The fallback responses are confusing and unhelpful.

---

## Root Cause

In `useDemoConversation.ts`, the `handleDemoMessage` function has hardcoded fallback responses for any typed message:

```typescript
let response = "I can help you with that. In production, I would access...";
```

This creates two problems:
1. Free-form typing feels broken in Demo Mode
2. Users don't realize they need to click "AI Live" for real AI responses

---

## Solution

### Two-Pronged Approach

**Option A: Improve Demo Mode** - Make it clear that Demo Mode is scripted and guide users to use the action buttons

**Option B: Default to AI Mode** - Start users in AI Mode so they get real responses immediately

I recommend **Option A** + better UX guidance

---

## Implementation Plan

### 1. Improve Demo Mode Fallback Responses

Instead of generic "in production" responses, provide helpful guidance:

```text
Before (current):
"I can help you with that. In production, I would access real-time clinical data..."

After (improved):
"In Demo Mode, I follow a scripted clinical scenario to showcase ALIS capabilities.

To explore this case:
• Click 'Show me' above to see my trajectory analysis
• Or switch to **AI Live** mode (button in top bar) for real-time AI responses

Would you like me to continue with the demonstration?"
```

### 2. Add Visual Mode Indicator in Chat

Add a small banner at the top of the chat that explains the current mode:

**Demo Mode banner:**
```text
📝 Demo Mode: Following a scripted PE detection scenario. 
   Use action buttons below or switch to "AI Live" for free-form chat.
```

**AI Live banner:**
```text
⚡ AI Live: Ask me anything about this patient's clinical data.
```

### 3. Better Action Button Visibility

When the initial message has action buttons (like "Show me"), make them more prominent with:
- Pulsing/glowing effect on primary action
- Clear CTA styling

### 4. Scenario-Aware Fallback Messages

Make fallback responses match the current scenario:

| Scenario | Better Fallback |
|----------|-----------------|
| Day 1 | "I'm currently monitoring Margaret for any changes. Try selecting 'Day 2 - Trajectory Shift' from the dropdown to see how I detect concerning patterns." |
| Day 2 | "Let me walk you through my analysis. Click 'Show me' above to see the trajectory concerns I've identified." |
| Prevention | "The case has concluded successfully. Switch to 'Day 2' to see how I detected the PE, or enable 'AI Live' to ask questions." |

---

## File Changes

| File | Change |
|------|--------|
| `src/hooks/useDemoConversation.ts` | Smarter fallback responses based on scenario and conversation state |
| `src/components/virtualis/ALISPanel.tsx` | Add mode indicator banner at top of chat |
| `src/components/virtualis/ChatMessage.tsx` | Make action buttons more prominent with animations |

---

## Technical Details

### Updated `handleDemoMessage` function

```typescript
const handleDemoMessage = useCallback(
  async (content: string) => {
    // ... add user message ...

    let response = '';
    
    // Scenario-specific helpful responses
    if (conversationState === 'initial' && scenario === 'day2') {
      response = `Great question! I have important findings to share about Margaret's trajectory.

Click the **"Show me"** button above to see my analysis, or switch to **AI Live** mode in the top bar for real-time AI chat.`;
    } else if (conversationState === 'analysis') {
      response = `I can prepare a complete PE workup bundle. Click **"Yes, prepare orders"** above to continue, or ask me specific questions in AI Live mode.`;
    } else {
      // Generic but helpful fallback
      response = `I'm in Demo Mode, following a scripted scenario. 

Try:
• Using the action buttons in messages above
• Switching to **AI Live** (top bar) for free-form AI chat
• Selecting a different scenario from the dropdown`;
    }
    
    // ... add response message ...
  },
  [conversationState, scenario]
);
```

### Mode Indicator Component

```tsx
{/* Mode Banner */}
<div className={cn(
  "px-4 py-2 text-xs flex items-center gap-2 border-b",
  isAIMode 
    ? "bg-primary/5 border-primary/20 text-primary" 
    : "bg-amber-500/5 border-amber-500/20 text-amber-600"
)}>
  {isAIMode ? (
    <>
      <Zap className="w-3 h-3" />
      <span>AI Live: Ask me anything about this patient</span>
    </>
  ) : (
    <>
      <FileText className="w-3 h-3" />
      <span>Demo Mode: Use action buttons or switch to AI Live for free chat</span>
    </>
  )}
</div>
```

---

## User Flow After Fix

1. **User opens dashboard** → Demo Mode with Day 2 scenario
2. **Sees mode banner** → "Demo Mode: Use action buttons..."
3. **Types a message** → Gets helpful guidance pointing to buttons
4. **Clicks "Show me"** → Scripted flow continues smoothly
5. **OR clicks "AI Live"** → Switches to real AI mode
6. **Types in AI Live** → Gets streaming real-time responses

---

## Summary

| What | How |
|------|-----|
| Clearer Demo Mode | Better fallback responses, mode banner |
| Guided UX | Point users to action buttons or AI Live |
| No confusion | Users understand the two modes |
| Real AI works | AI Live mode uses streaming Gemini responses |

