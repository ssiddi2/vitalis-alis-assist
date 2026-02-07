import { Patient, ScenarioData, OrderItem, ProgressNote } from '@/types/clinical';
import { StagedOrder, ClinicalNote, BillingEvent } from '@/types/hospital';

// Demo patient
export const demoPatient: Patient = {
  id: 'pt-001',
  name: 'Margaret Chen',
  mrn: '2847563',
  age: 72,
  sex: 'F',
  location: '5 West',
  bed: 'Bed 12',
  admissionDay: 2,
  expectedLOS: 3,
  admissionDiagnosis: 'Community-acquired pneumonia',
};

// Scenario data for each demo mode
export const scenarioData: Record<string, ScenarioData> = {
  day1: {
    insights: [
      {
        id: 'ins-001',
        title: 'New Admission',
        description: 'Community-acquired pneumonia. Initial vitals stable. Started on ceftriaxone + azithromycin.',
        timestamp: 'Day 1, 14:20',
        severity: null,
        sources: ['ED Report', 'Admission Orders', 'Initial Vitals'],
      },
    ],
    trends: [
      { id: 'tr-001', label: 'O₂ Requirement', value: '2L NC', direction: 'stable' },
      { id: 'tr-002', label: 'Heart Rate', value: '78 bpm', direction: 'stable' },
      { id: 'tr-003', label: 'Respiratory Rate', value: '18/min', direction: 'stable' },
      { id: 'tr-004', label: 'Temperature', value: '38.2°C', direction: 'stable' },
    ],
    initialMessage: {
      content: "I'm monitoring Margaret's pneumonia treatment. Initial response to antibiotics appears appropriate. I'll alert you to any concerning changes.",
      timestamp: 'Day 1, 14:45',
    },
  },
  day2: {
    insights: [
      {
        id: 'ins-002',
        title: 'Trajectory Concern',
        description: "Across nursing flowsheets, mobility assessments, and MAR data, I'm seeing a pattern that concerns me. Oxygen needs have doubled, heart rate is climbing, and mobility has declined—all while on appropriate antibiotics.",
        timestamp: 'Day 2, 08:15',
        severity: 'warning',
        sources: ['Nursing Flowsheets', 'PT Eval', 'MAR', 'Vitals Trend'],
      },
      {
        id: 'ins-003',
        title: 'Missed Prophylaxis + History',
        description: "Anticoagulation dose missed yesterday at 18:00. I also found a DVT in 2019 from outside records that wasn't in our current problem list.",
        timestamp: 'Day 2, 08:20',
        severity: 'critical',
        sources: ['MAR', 'Outside Records', 'Problem List'],
      },
    ],
    trends: [
      { id: 'tr-005', label: 'O₂ Requirement', value: '4L NC', direction: 'up', change: '↑ 100%' },
      { id: 'tr-006', label: 'Heart Rate', value: '94 bpm', direction: 'up', change: '↑ 20%' },
      { id: 'tr-007', label: 'Mobility Status', value: 'Assist of 1', direction: 'down' },
      { id: 'tr-008', label: 'Temperature', value: '37.8°C', direction: 'stable' },
    ],
    initialMessage: {
      content: "I need to share something important. I'm observing a concerning pattern in Margaret's clinical trajectory that doesn't match typical pneumonia progression. Would you like me to walk you through what I'm seeing?",
      timestamp: 'Day 2, 08:15',
      actions: [
        { label: 'Show me', action: 'showDay2Analysis', primary: true },
      ],
    },
  },
  prevention: {
    insights: [
      {
        id: 'ins-004',
        title: 'Action Bundle Prepared',
        description: "Based on the trajectory analysis, I've prepared a comprehensive workup for acute PE. All orders are ready for your review and require only your approval.",
        timestamp: 'Day 2, 08:30',
        severity: 'warning',
        sources: ['Evidence Synthesis', 'Clinical Guidelines', 'Patient Context'],
      },
    ],
    trends: [
      { id: 'tr-009', label: 'VTE Risk Score', value: 'High', direction: 'up' },
      { id: 'tr-010', label: 'Wells Criteria', value: '6.5 points', direction: 'up' },
      { id: 'tr-011', label: 'Time to Imaging', value: 'STAT ordered', direction: 'stable' },
      { id: 'tr-012', label: 'Anticoagulation', value: 'Resumed', direction: 'stable' },
    ],
    initialMessage: {
      content: "CTA results are back: Large bilateral pulmonary emboli confirmed.\n\nBecause we acted early based on trajectory analysis, Margaret is stable on therapeutic anticoagulation. Pulmonology is managing her care.\n\nWithout ambient monitoring across systems, this pattern would likely have been missed until she decompensated—possibly with catastrophic consequences.\n\nThe patient never crashed. Care no longer waits to be coordinated.",
      timestamp: 'Day 2, 14:30',
    },
  },
};

// Order bundle for PE workup
export const peOrderBundle: OrderItem[] = [
  {
    id: 'ord-001',
    name: 'CTA Chest with PE Protocol',
    priority: 'STAT',
    details: 'Priority: STAT | With contrast | Reason: Suspected acute PE',
    rationale: 'Progressive hypoxemia + tachycardia + risk factors',
  },
  {
    id: 'ord-002',
    name: 'Laboratory Panel',
    priority: 'STAT',
    details: 'D-dimer, Troponin I, BNP, CBC, CMP',
    rationale: 'Rule out alternative diagnoses, assess cardiac strain',
  },
  {
    id: 'ord-003',
    name: 'Lower Extremity Doppler',
    priority: 'Today',
    details: 'Bilateral | Reason: Evaluate for DVT source',
    rationale: 'Prior VTE history, current immobility',
  },
  {
    id: 'ord-004',
    name: 'Pulmonology Consult',
    priority: 'Urgent',
    details: 'Request same-day evaluation',
    rationale: 'Complex respiratory trajectory, possible PE management',
  },
  {
    id: 'ord-005',
    name: 'Resume Therapeutic Anticoagulation',
    priority: 'Now',
    details: 'Enoxaparin 1mg/kg Q12h | Hold for imaging if needed',
    rationale: 'Missed dose, high clinical suspicion, prior VTE',
  },
];

// Progress note template
export const progressNoteTemplate: ProgressNote = {
  subjective: 'Patient reports increased shortness of breath over past 12 hours. Denies chest pain. Minimal cough production.',
  objective: `• O2 requirement: 2L NC → 4L NC (↑ 100% over 48h)
• HR trend: 78 → 94 bpm (↑ 20%)
• Mobility: Independent → Assist of 1 (per PT eval)
• Anticoagulation: Missed dose noted at 18:00 yesterday
• Remote history: DVT 2019 (outside records)`,
  assessment: `72F admitted for CAP now with concerning trajectory for acute PE given:
1. Progressive hypoxemia despite antibiotics
2. Tachycardia without infectious source
3. Reduced mobility + missed prophylaxis
4. Prior VTE history`,
  plan: `1. CTA chest with PE protocol - STAT
2. D-dimer, troponin, BNP
3. Lower extremity dopplers
4. Resume therapeutic anticoagulation pending imaging
5. Pulmonology consult
6. Hold discharge planning`,
  timestamp: 'Day 2, 08:28',
};

// Scripted conversation flows
export const conversationFlows = {
  day2Analysis: [
    {
      role: 'user' as const,
      content: 'Yes, walk me through it.',
      timestamp: 'Day 2, 08:16',
    },
    {
      role: 'alis' as const,
      content: `Over the past 48 hours, Margaret's oxygen requirement has doubled from 2L to 4L nasal cannula. This isn't typical for pneumonia on appropriate antibiotics.

Simultaneously, her heart rate has increased 20% (78→94 bpm) without fever escalation, and PT documented reduced mobility—she now needs assist of one.

I cross-referenced the MAR and found a missed anticoagulation dose yesterday. When I checked outside records, I found a DVT from 2019 that wasn't carried forward to our problem list.

These elements together suggest we may be looking at an evolving PE rather than treatment failure.`,
      timestamp: 'Day 2, 08:18',
    },
  ],
  sourcesQuestion: [
    {
      role: 'user' as const,
      content: 'What sources did you use?',
      timestamp: 'Day 2, 08:19',
    },
    {
      role: 'alis' as const,
      content: `I synthesized data from:
• Nursing flowsheets (O₂ requirements, vital trends)
• Physical therapy evaluation (mobility decline)
• Medication administration record (missed dose)
• Outside hospital records via Virtualis (prior DVT)
• Current problem list (missing VTE history)
• Antibiotic response timeline

Every data point is timestamped and auditable. Would you like me to prepare a workup bundle?`,
      timestamp: 'Day 2, 08:20',
      actions: [
        { label: 'Yes, prepare orders', action: 'prepareOrders', primary: true },
        { label: 'Show me sources', action: 'showSources' },
      ],
    },
  ],
  prepareOrders: [
    {
      role: 'user' as const,
      content: 'Prepare the PE workup bundle',
      timestamp: 'Day 2, 08:22',
    },
    {
      role: 'alis' as const,
      content: `I've prepared a comprehensive PE evaluation bundle based on clinical guidelines and Margaret's specific context. The bundle includes STAT imaging, confirmatory labs, and consultations.

All orders are staged and require your approval before being sent to the EMR. Would you like to review?`,
      timestamp: 'Day 2, 08:23',
      actions: [
        { label: 'Review orders', action: 'openOrderModal', primary: true },
      ],
    },
  ],
  ordersApproved: [
    {
      role: 'user' as const,
      content: 'Approve and send to EMR',
      timestamp: 'Day 2, 08:25',
    },
    {
      role: 'alis' as const,
      content: `Orders approved and transmitted to EMR at 08:25.

✓ CTA Chest (STAT) - Radiology notified
✓ Labs (STAT) - Sent to lab
✓ LE Doppler - Scheduled 11:00 today
✓ Pulmonology consult - Paged
✓ Anticoagulation - Active in MAR

Full audit trail created. Discharge planning automatically held. Would you like me to generate the progress note?`,
      timestamp: 'Day 2, 08:26',
      actions: [
        { label: 'Generate note', action: 'openNoteModal', primary: true },
      ],
    },
  ],
  noteSigned: [
    {
      role: 'user' as const,
      content: 'Sign note and commit to EMR',
      timestamp: 'Day 2, 08:28',
    },
    {
      role: 'alis' as const,
      content: `Progress note signed and committed to EMR at 08:28.

✓ Billing codes captured (high complexity visit)
✓ Quality metrics documented (VTE prevention)
✓ Audit trail complete
✓ Care team notified

I'll continue monitoring Margaret's trajectory and alert you to any changes in her clinical status or imaging results.`,
      timestamp: 'Day 2, 08:29',
    },
  ],
  showSources: [
    {
      role: 'user' as const,
      content: 'Show me the source documents',
      timestamp: 'Day 2, 08:20',
    },
    {
      role: 'alis' as const,
      content: `Here are the linked sources:

📊 Nursing Flowsheet 2/6 0600-2200
📋 PT Evaluation 2/6 1430
💊 MAR 2/5-2/6
🏥 Outside Records: Memorial Hospital 2019
📝 Current Problem List (last updated 2/5)

Each document is accessible through Virtualis and shows the exact timestamp and value I referenced. All changes are tracked with full audit trail.`,
      timestamp: 'Day 2, 08:21',
    },
  ],
};

// Demo staged orders for the Clinical Actions sidebar
export const demoStagedOrders: StagedOrder[] = [
  {
    id: 'staged-001',
    conversation_id: null,
    patient_id: 'pt-001',
    order_type: 'imaging',
    order_data: { name: 'CTA Chest with PE Protocol', priority: 'STAT' },
    rationale: 'Progressive hypoxemia + tachycardia + risk factors',
    status: 'staged',
    created_by: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'staged-002',
    conversation_id: null,
    patient_id: 'pt-001',
    order_type: 'lab',
    order_data: { name: 'D-dimer, Troponin I, BNP, CBC, CMP', priority: 'STAT' },
    rationale: 'Rule out alternative diagnoses, assess cardiac strain',
    status: 'staged',
    created_by: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'staged-003',
    conversation_id: null,
    patient_id: 'pt-001',
    order_type: 'consult',
    order_data: { name: 'Pulmonology Consult', priority: 'Urgent' },
    rationale: 'Complex respiratory trajectory, possible PE management',
    status: 'staged',
    created_by: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
];

// Demo clinical notes for the Clinical Actions sidebar
export const demoClinicalNotes: ClinicalNote[] = [
  {
    id: 'note-001',
    conversation_id: null,
    patient_id: 'pt-001',
    note_type: 'progress',
    content: {
      subjective: 'Patient reports increased shortness of breath over past 12 hours. Denies chest pain.',
      objective: 'O2 requirement: 2L NC → 4L NC. HR: 78 → 94 bpm. Mobility: Independent → Assist of 1.',
      assessment: '72F admitted for CAP now with concerning trajectory for acute PE.',
      plan: 'CTA chest with PE protocol - STAT. Resume therapeutic anticoagulation.',
    },
    status: 'draft',
    author_id: null,
    signed_at: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
];

// Demo billing events for the Clinical Actions sidebar
export const demoBillingEvents: BillingEvent[] = [
  {
    id: 'bill-001',
    patient_id: 'pt-001',
    note_id: null,
    cpt_codes: ['99223'],
    icd10_codes: [],
    estimated_revenue: 425,
    status: 'pending',
    submitted_at: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'bill-002',
    patient_id: 'pt-001',
    note_id: null,
    cpt_codes: ['71275'],
    icd10_codes: ['I26.99', 'J18.9'],
    estimated_revenue: 1250,
    status: 'pending',
    submitted_at: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
];
