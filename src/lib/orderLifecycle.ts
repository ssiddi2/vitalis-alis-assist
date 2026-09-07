import { supabase } from '@/integrations/supabase/client';
import { StagedOrder, OrderStatus } from '@/types/hospital';
import { loadSmartSession } from '@/lib/smart';
import { writeMedicationOrderToEhr, writeServiceRequestToEhr, isExternalWritebackConfigured } from '@/lib/ehrWriteback';

export type OrderLifecycleStatus = OrderStatus;

export const ORDER_STATUS_LABELS: Record<string, string> = {
  staged: 'Staged',
  signed: 'Signed',
  pushed: 'Pushed to EMR',
  push_failed: 'Push failed',
  rejected: 'Rejected',
  approved: 'Signed',
  sent: 'Pushed to EMR',
  cancelled: 'Rejected',
};

export const ORDER_STATUS_CLASSES: Record<string, string> = {
  staged: 'border-slate-200 bg-slate-100 text-slate-600',
  signed: 'border-primary/30 bg-primary/10 text-primary',
  approved: 'border-primary/30 bg-primary/10 text-primary',
  pushed: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-600',
  sent: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-600',
  push_failed: 'border-amber-500/40 bg-amber-500/10 text-amber-600',
  rejected: 'border-slate-200 bg-slate-100 text-slate-400',
  cancelled: 'border-slate-200 bg-slate-100 text-slate-400',
};

type AuditFn = (
  action: string,
  resourceType: string,
  resourceId?: string,
  patientId?: string,
  metadata?: Record<string, unknown>,
) => void;

const SERVICE_TYPES = ['lab', 'imaging', 'procedure', 'consult'];

const persist = async (orderId: string, status: OrderStatus, orderData: Record<string, unknown>) => {
  // Demo/in-memory orders are not persisted
  if (orderId.startsWith('staged-') || orderId.startsWith('demo')) return;
  await supabase
    .from('staged_orders')
    .update({ status, order_data: orderData as never })
    .eq('id', orderId);
};

/** staged → signed → pushed | push_failed. Audits every transition. */
export async function signAndPushOrder(
  order: StagedOrder,
  userId: string | undefined,
  logAudit: AuditFn,
): Promise<{ status: OrderStatus; orderData: Record<string, unknown> }> {
  const name = String(order.order_data?.name || order.order_type);
  const aiGenerated = Boolean(order.order_data?.ai_generated) || !order.created_by;
  const data: Record<string, unknown> = {
    ...order.order_data,
    signed_by: userId ?? null,
    signed_at: new Date().toISOString(),
  };

  const smart = loadSmartSession();
  // A stored SMART session is not authorization to transmit: an authoritative
  // facility/endpoint binding is required, and none exists today.
  const externalConfigured = isExternalWritebackConfigured();
  await persist(order.id, 'signed', data);
  logAudit(externalConfigured && smart?.patient_id ? 'order.signed' : 'order.signed_local', 'staged_order', order.id, order.patient_id, {
    order_type: order.order_type,
    order_name: name,
    ai_generated: aiGenerated,
    priority: order.order_data?.priority ?? 'Routine',
  });

  if (!externalConfigured || !smart?.patient_id) return { status: 'signed', orderData: data };

  const write = order.order_type === 'medication'
    ? writeMedicationOrderToEhr
    : SERVICE_TYPES.includes(order.order_type) ? writeServiceRequestToEhr : null;

  if (!write) return { status: 'signed', orderData: data };

  let status: OrderStatus = 'push_failed';
  try {
    const res = await write(smart.patient_id, name, order.rationale || undefined);
    if (res?.status === 'written') {
      status = 'pushed';
      data.ehr_resource_id = res.id ? `${res.resourceType}/${res.id}` : null;
      data.ehr_status = 'written';
    } else {
      data.ehr_status = res?.reason || res?.status || 'write_failed';
    }
  } catch (e) {
    data.ehr_status = e instanceof Error ? e.message : 'write_error';
  }

  await persist(order.id, status, data);
  logAudit('order.push_to_ehr', 'staged_order', order.id, order.patient_id, {
    order_type: order.order_type,
    order_name: name,
    ai_generated: aiGenerated,
    result: status,
    ehr_status: data.ehr_status,
    ehr_resource_id: data.ehr_resource_id ?? null,
  });

  return { status, orderData: data };
}

/** staged → rejected, audited. */
export async function rejectOrder(
  order: StagedOrder,
  userId: string | undefined,
  logAudit: AuditFn,
): Promise<Record<string, unknown>> {
  const data: Record<string, unknown> = {
    ...order.order_data,
    rejected_by: userId ?? null,
    rejected_at: new Date().toISOString(),
  };
  await persist(order.id, 'rejected', data);
  logAudit('order.rejected', 'staged_order', order.id, order.patient_id, {
    order_type: order.order_type,
    order_name: String(order.order_data?.name || order.order_type),
    ai_generated: Boolean(order.order_data?.ai_generated) || !order.created_by,
  });
  return data;
}
