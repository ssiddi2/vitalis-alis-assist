import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { FlaskConical, TrendingUp, TrendingDown, Minus, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface LabResult {
  name: string;
  value: string;
  unit: string;
  reference_range: string;
  is_abnormal: boolean;
  direction: 'up' | 'down' | 'stable';
  timestamp: string;
}

interface LabResultsProps {
  patientId: string;
}

// Generate demo lab data from patient vitals trends
function generateDemoLabs(): LabResult[] {
  return [
    { name: 'WBC', value: '12.4', unit: 'K/uL', reference_range: '4.5-11.0', is_abnormal: true, direction: 'up', timestamp: new Date().toISOString() },
    { name: 'Hemoglobin', value: '13.2', unit: 'g/dL', reference_range: '12.0-17.5', is_abnormal: false, direction: 'stable', timestamp: new Date().toISOString() },
    { name: 'Platelets', value: '245', unit: 'K/uL', reference_range: '150-400', is_abnormal: false, direction: 'stable', timestamp: new Date().toISOString() },
    { name: 'Sodium', value: '138', unit: 'mEq/L', reference_range: '136-145', is_abnormal: false, direction: 'stable', timestamp: new Date().toISOString() },
    { name: 'Potassium', value: '3.4', unit: 'mEq/L', reference_range: '3.5-5.0', is_abnormal: true, direction: 'down', timestamp: new Date().toISOString() },
    { name: 'Creatinine', value: '1.8', unit: 'mg/dL', reference_range: '0.7-1.3', is_abnormal: true, direction: 'up', timestamp: new Date().toISOString() },
    { name: 'BUN', value: '28', unit: 'mg/dL', reference_range: '7-20', is_abnormal: true, direction: 'up', timestamp: new Date().toISOString() },
    { name: 'Glucose', value: '142', unit: 'mg/dL', reference_range: '70-100', is_abnormal: true, direction: 'up', timestamp: new Date().toISOString() },
    { name: 'Lactate', value: '1.2', unit: 'mmol/L', reference_range: '0.5-2.0', is_abnormal: false, direction: 'down', timestamp: new Date().toISOString() },
    { name: 'Troponin', value: '<0.01', unit: 'ng/mL', reference_range: '<0.04', is_abnormal: false, direction: 'stable', timestamp: new Date().toISOString() },
  ];
}

const DirectionIcon = ({ direction }: { direction: string }) => {
  if (direction === 'up') return <TrendingUp className="w-3 h-3 text-critical" />;
  if (direction === 'down') return <TrendingDown className="w-3 h-3 text-warning" />;
  return <Minus className="w-3 h-3 text-muted-foreground" />;
};

export function LabResultsPanel({ patientId }: LabResultsProps) {
  const labs = generateDemoLabs();

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 mb-3">
        <FlaskConical className="w-4 h-4 text-primary" />
        <h3 className="text-sm font-semibold text-foreground">Lab Results</h3>
        <span className="text-[10px] text-muted-foreground ml-auto">Last updated: Today</span>
      </div>

      <div className="rounded-xl border border-border overflow-hidden">
        <div className="grid grid-cols-[1fr_auto_auto_auto_auto] gap-x-3 px-3 py-2 bg-muted/50 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
          <span>Test</span>
          <span className="text-right">Value</span>
          <span className="text-right">Unit</span>
          <span className="text-right">Ref Range</span>
          <span className="text-center">Trend</span>
        </div>
        {labs.map((lab, i) => (
          <div
            key={lab.name}
            className={cn(
              'grid grid-cols-[1fr_auto_auto_auto_auto] gap-x-3 px-3 py-2.5 items-center text-xs border-t border-border/50',
              lab.is_abnormal && 'bg-critical/5'
            )}
          >
            <div className="flex items-center gap-1.5">
              {lab.is_abnormal && <AlertTriangle className="w-3 h-3 text-critical flex-shrink-0" />}
              <span className={cn('font-medium', lab.is_abnormal ? 'text-critical' : 'text-foreground')}>{lab.name}</span>
            </div>
            <span className={cn('text-right font-mono font-semibold', lab.is_abnormal ? 'text-critical' : 'text-foreground')}>
              {lab.value}
            </span>
            <span className="text-right text-muted-foreground">{lab.unit}</span>
            <span className="text-right text-muted-foreground">{lab.reference_range}</span>
            <div className="flex justify-center">
              <DirectionIcon direction={lab.direction} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
