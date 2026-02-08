import { useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useHospital } from '@/contexts/HospitalContext';

type AuditActionType = 'view' | 'create' | 'update' | 'delete' | 'export' | 'sign' | 'approve' | 'login' | 'logout';
type ResourceType = 'patient' | 'clinical_note' | 'staged_order' | 'billing_event' | 'conversation' | 'message' | 'auth';

interface AuditLogParams {
  action_type: AuditActionType;
  resource_type: ResourceType | string;
  resource_id?: string;
  patient_id?: string;
  metadata?: Record<string, unknown>;
}

// Generate a session ID that persists for the browser session
const getSessionId = (): string => {
  let sessionId = sessionStorage.getItem('audit_session_id');
  if (!sessionId) {
    sessionId = crypto.randomUUID();
    sessionStorage.setItem('audit_session_id', sessionId);
  }
  return sessionId;
};

export function useAuditLog() {
  const { selectedHospital } = useHospital();
  const pendingLogs = useRef<Map<string, NodeJS.Timeout>>(new Map());

  const logEvent = useCallback(async (params: AuditLogParams): Promise<void> => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        console.debug('Audit log skipped: no active session');
        return;
      }

      const response = await supabase.functions.invoke('audit-log', {
        body: {
          action_type: params.action_type,
          resource_type: params.resource_type,
          resource_id: params.resource_id,
          patient_id: params.patient_id,
          hospital_id: selectedHospital?.id,
          metadata: params.metadata,
          session_id: getSessionId(),
        },
      });

      if (response.error) {
        console.error('Failed to log audit event:', response.error);
      }
    } catch (error) {
      // Fail silently - audit logging shouldn't break the app
      console.error('Audit logging error:', error);
    }
  }, [selectedHospital]);

  // Log view events with debouncing to prevent duplicates
  const logView = useCallback((
    resourceType: ResourceType | string,
    resourceId: string,
    patientId?: string,
    metadata?: Record<string, unknown>
  ): void => {
    const key = `${resourceType}:${resourceId}`;
    
    // Clear any pending log for this resource
    const existing = pendingLogs.current.get(key);
    if (existing) {
      clearTimeout(existing);
    }

    // Debounce view logs by 500ms
    const timeout = setTimeout(() => {
      logEvent({
        action_type: 'view',
        resource_type: resourceType,
        resource_id: resourceId,
        patient_id: patientId,
        metadata,
      });
      pendingLogs.current.delete(key);
    }, 500);

    pendingLogs.current.set(key, timeout);
  }, [logEvent]);

  // Log action events immediately (no debouncing)
  const logAction = useCallback((
    actionType: Exclude<AuditActionType, 'view'>,
    resourceType: ResourceType | string,
    resourceId?: string,
    patientId?: string,
    metadata?: Record<string, unknown>
  ): void => {
    logEvent({
      action_type: actionType,
      resource_type: resourceType,
      resource_id: resourceId,
      patient_id: patientId,
      metadata,
    });
  }, [logEvent]);

  // Convenience methods for common actions
  const logLogin = useCallback(() => {
    logAction('login', 'auth', undefined, undefined, {
      timestamp: new Date().toISOString(),
    });
  }, [logAction]);

  const logLogout = useCallback(() => {
    logAction('logout', 'auth', undefined, undefined, {
      timestamp: new Date().toISOString(),
    });
  }, [logAction]);

  const logSign = useCallback((
    resourceType: ResourceType | string,
    resourceId: string,
    patientId?: string,
    metadata?: Record<string, unknown>
  ) => {
    logAction('sign', resourceType, resourceId, patientId, metadata);
  }, [logAction]);

  const logApprove = useCallback((
    resourceType: ResourceType | string,
    resourceId: string,
    patientId?: string,
    metadata?: Record<string, unknown>
  ) => {
    logAction('approve', resourceType, resourceId, patientId, metadata);
  }, [logAction]);

  return {
    logEvent,
    logView,
    logAction,
    logLogin,
    logLogout,
    logSign,
    logApprove,
  };
}
