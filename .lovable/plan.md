
# Virtualis + ALIS: Ambient Clinical Intelligence Platform

## Overview
A functional prototype of a clinical intelligence system that monitors patient trajectories, surfaces insights, and assists clinicians with AI-powered decision support. The platform will have both a demo mode (for showcasing) and real AI integration (for testing).

---

## Phase 1: Foundation & Core UI

### Patient Dashboard
- **Patient header** with key demographics (name, MRN, age, location, admission info)
- **"What Matters Now" section** - prioritized clinical insights with severity badges (Critical/Warning)
- **Clinical Trends panel** - key metrics with directional indicators (↑↓→)
- **Source attribution tags** showing data origins (Nursing Flowsheets, MAR, PT Eval, etc.)

### ALIS Chat Interface
- Elegant side panel with real-time conversation
- Typing indicators and smooth message animations
- Action buttons within messages (e.g., "Show me", "Prepare orders")
- Message timestamps and visual distinction between ALIS and user messages

---

## Phase 2: Demo Mode

### Scenario Selector
- **Day 1 – Admission**: Initial stable state, routine monitoring
- **Day 2 – Trajectory Shift**: Concerning patterns detected, escalating alerts
- **Prevention – Action Bundle**: Resolution and outcome demonstration

### Scripted Conversations
- Pre-built conversation flows that demonstrate ALIS capabilities
- Interactive buttons that advance the narrative
- Realistic clinical reasoning walkthrough

---

## Phase 3: AI Integration

### Real ALIS Chat
- Integration with Lovable AI (Gemini) for dynamic clinical conversations
- Medical-context system prompts for appropriate clinical reasoning
- Streaming responses for natural conversation feel
- Toggle between demo mode and live AI mode

---

## Phase 4: Clinical Workflows

### Order Review Modal
- Pre-populated order bundles (labs, imaging, consults)
- Priority badges (STAT, Urgent, Today)
- Clinical rationale for each order
- Approve/Edit actions

### Progress Note Generator
- ALIS-assisted clinical documentation
- Structured format (Subjective, Objective, Assessment, Plan)
- Auto-populated with relevant clinical data
- Review and sign workflow

---

## Phase 5: Data & Backend

### Database Structure (via Lovable Cloud)
- **Patients** - demographics, admission info, current status
- **Clinical insights** - alerts, severity, timestamps, source attributions
- **Trends** - metric values over time
- **Conversations** - chat history with ALIS
- **Orders** - order bundles and approval status
- **Notes** - progress notes and signatures

---

## Design Approach
Building on your dark theme aesthetic with:
- Refined color palette with critical (red), warning (amber), and info (blue) accents
- Clean typography hierarchy using Inter and monospace for clinical data
- Subtle animations for state transitions
- Responsive layout (though desktop-first for clinical workflows)
- Professional, medical-grade look and feel

---

## Outcome
A working prototype that:
1. Demonstrates the vision with polished scripted scenarios
2. Enables real AI interaction for testing clinical conversations
3. Stores patient data and conversation history
4. Provides a foundation for future EMR integration concepts
