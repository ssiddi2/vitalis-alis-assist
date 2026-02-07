// Clinical data types for Virtualis + ALIS

export type SeverityLevel = 'critical' | 'warning' | 'info' | 'success';

export type DemoScenario = 'day1' | 'day2' | 'prevention';

export type TrendDirection = 'up' | 'down' | 'stable';

export interface Patient {
  id: string;
  name: string;
  mrn: string;
  age: number;
  sex: 'M' | 'F';
  location: string;
  bed: string;
  admissionDay: number;
  expectedLOS: number;
  admissionDiagnosis: string;
}

export interface ClinicalInsight {
  id: string;
  title: string;
  description: string;
  timestamp: string;
  severity: SeverityLevel | null;
  sources: string[];
}

export interface ClinicalTrend {
  id: string;
  label: string;
  value: string;
  direction: TrendDirection;
  change?: string;
}

export interface ChatMessage {
  id: string;
  role: 'alis' | 'user';
  content: string;
  timestamp: string;
  actions?: ChatAction[];
}

export interface ChatAction {
  label: string;
  action: string;
  primary?: boolean;
}

export interface OrderItem {
  id: string;
  name: string;
  priority: 'STAT' | 'Urgent' | 'Today' | 'Now';
  details: string;
  rationale: string;
}

export interface ProgressNote {
  subjective: string;
  objective: string;
  assessment: string;
  plan: string;
  timestamp: string;
  signedBy?: string;
}

// Demo data structure for scenarios
export interface ScenarioData {
  insights: ClinicalInsight[];
  trends: ClinicalTrend[];
  initialMessage: {
    content: string;
    timestamp: string;
    actions?: ChatAction[];
  };
}
