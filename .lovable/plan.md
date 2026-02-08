
# Demo Readiness Improvement Plan

## Current State Assessment

After reviewing the codebase, mobile/desktop views, and feature implementations, here's what needs work:

### Issues Identified

**1. Responsive Layout Problems**
- The dashboard uses `lg:grid-cols-[1fr_700px]` which hides the ALIS panel entirely on mobile
- The ALIS panel is marked `hidden lg:block` - mobile users can't access the AI assistant at all
- TopBar logo and controls overflow on smaller screens
- Hospital selector cards don't stack properly on mobile

**2. Logo Formatting Issues**
- TopBar uses `virtualis-logo.png` but the ALIS logo is more recognizable
- Logo sizing inconsistent: 12px in TopBar, 32px in HospitalSelector, 20px on mobile Auth
- No wordmark or clear branding hierarchy

**3. Provider Onboarding via ALIS**
- ALIS currently has NO tool-calling capabilities for provider management
- The edge function only streams conversation responses
- Cannot add users, send invites, or manage access

**4. Communication Features Not Demonstrable**
- TeamChatPanel exists but requires database channels to be created first
- DirectMessageSidebar works but needs multiple users in the hospital
- No demo data for conversations - they appear empty
- Cannot show the flow without multiple logged-in users

**5. Ordering System Limitations**
- StagedOrdersPanel displays hardcoded `demoStagedOrders` from demoData.ts
- Approve/Cancel only updates local React state - not persisted
- ALIS cannot programmatically stage orders via tool calls
- No database integration for order management

---

## Implementation Plan

### Phase 1: Mobile Responsive Layout

**TopBar.tsx Changes:**
- Add hamburger menu for mobile with slide-out drawer
- Stack hospital badge vertically on smaller screens
- Make scenario selector full-width on mobile
- Hide secondary controls (time, AI status) behind menu

**Dashboard.tsx Changes:**
- Replace hidden ALIS panel with a mobile FAB (Floating Action Button)
- Open ALIS in a full-screen Sheet/Drawer on mobile
- Add bottom navigation for key actions
- Make patient dashboard full-width on all screens

**PatientDashboard.tsx Changes:**
- Reduce padding on mobile (p-4 instead of p-8)
- Stack insight cards vertically
- Make trend charts horizontally scrollable

**HospitalSelector.tsx Changes:**
- Force single-column grid on mobile/tablet
- Increase touch target sizes
- Improve card spacing

### Phase 2: Logo and Branding Consistency

**Consolidate to ALIS branding across all pages:**
- TopBar: Replace virtualis-logo with ALIS logo + "ALIS" wordmark
- Standardize sizes: 40px desktop header, 32px mobile
- Add proper alt text and accessibility labels
- Consider adding a favicon update if needed

### Phase 3: ALIS Tool Capabilities for Provider Management

**Expand the alis-chat edge function to support tools:**

```text
New tool definitions for ALIS:
- invite_provider: Sends email invite to join hospital
- list_providers: Shows current providers for the hospital
- update_provider_role: Changes access level for a user
- deactivate_provider: Removes provider access
```

**Implementation approach:**
1. Add OpenAI-compatible function calling to the edge function
2. Create corresponding database RPCs for each action
3. Have ALIS parse tool calls and execute them
4. Return structured responses to the frontend

### Phase 4: Communication Demo Flow

**Seed demo conversations:**
- Create 2-3 demo team channels with pre-populated messages
- Add sample direct message threads
- Show realistic clinical handoff examples

**Create demo mode toggle:**
- When enabled, inject demo data into channels/messages
- Shows consult requests in progress
- Simulates real-time message arrival

**Improve empty states:**
- Better onboarding UI when no channels exist
- Quick-create buttons for common channel types

### Phase 5: Order Staging with AI Integration

**Database integration for orders:**
- Use existing `staged_orders` table for persistence
- Hook ALIS tool calls to create orders
- Real-time subscription for order updates

**ALIS order capabilities:**
- "Stage a CT-PA for this patient" creates an actual staged order
- "What orders are pending?" queries the database
- Approval/cancellation persists to database

**Demo order bundle:**
- Pre-stage a PE workup bundle when entering Day 2 scenario
- Show the full approve/reject workflow

---

## Technical Changes Summary

| File | Changes |
|------|---------|
| `src/components/virtualis/TopBar.tsx` | Mobile menu drawer, responsive logo |
| `src/pages/Dashboard.tsx` | Mobile FAB for ALIS, Sheet integration |
| `src/components/virtualis/ALISPanel.tsx` | Sheet wrapper for mobile |
| `src/components/virtualis/PatientDashboard.tsx` | Responsive padding, card layout |
| `src/pages/HospitalSelector.tsx` | Mobile grid improvements |
| `supabase/functions/alis-chat/index.ts` | Add tool calling support |
| `src/hooks/useALISChat.ts` | Handle tool call responses |
| `src/data/demoData.ts` | Add demo conversations, messages |
| `src/hooks/useTeamChat.ts` | Demo mode injection |
| `src/components/virtualis/StagedOrdersPanel.tsx` | Database integration |

---

## Priority Order for Demo

1. **Mobile responsive layout** - Critical for any demo on phones/tablets
2. **Logo consistency** - Quick visual polish
3. **Demo communication data** - Makes the app look "lived in"
4. **Order database integration** - Shows the workflow actually works
5. **ALIS tool calling** - Advanced feature for later demos

---

## Estimated Effort

- Phase 1 (Mobile): 3-4 changes, medium complexity
- Phase 2 (Logo): 2-3 changes, low complexity  
- Phase 3 (ALIS Tools): 1 edge function + frontend, high complexity
- Phase 4 (Demo Data): Seed data + hooks, medium complexity
- Phase 5 (Orders): Database integration, medium complexity

The mobile responsive fixes and branding should be prioritized first as they're immediately visible to any demo audience.
