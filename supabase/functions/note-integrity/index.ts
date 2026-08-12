import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { userHasHospitalAccess } from "../_shared/auth.ts";
import { envLimit } from "../_shared/rateLimit.ts";
import { guard } from "../_shared/guard.ts";
import { badRequest, venum, vtext, vuuid } from "../_shared/validate.ts";
import { ownedByHospital } from "../_shared/tenancy.ts";

/**
 * Signed-note integrity service.
 *
 * Clients may only mutate DRAFT notes directly (RLS). Signing, addenda and
 * cosigning run here so the integrity hash, immutable snapshot, authorship and
 * audit trail are produced server-side and can never be forged by a caller.
 */

const ACTIONS = ["sign", "addendum", "cosign"] as const;
const SECTIONS = ["subjective", "objective", "assessment", "plan"] as const;
const SIGNED = ["signed", "amended"];

/** Deterministic SHA-256 over canonical (key-sorted) JSON. */
async function contentHash(content: unknown): Promise<string> {
  const canonical = JSON.stringify(content, (_k, v) =>
    v && typeof v === "object" && !Array.isArray(v)
      ? Object.fromEntries(Object.entries(v as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)))
      : v
  );
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(canonical));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** PHI-safe audit trail: identifiers and hashes only, never note content. */
const audit = (
  admin: SupabaseClient,
  row: {
    user_id: string; hospital_id: string; patient_id: string; note_id: string;
    action_type: "sign" | "approve" | "update"; event: string; metadata?: Record<string, unknown>;
  },
) =>
  admin.from("audit_logs").insert({
    user_id: row.user_id,
    hospital_id: row.hospital_id,
    patient_id: row.patient_id,
    action_type: row.action_type,
    resource_type: "clinical_note",
    resource_id: row.note_id,
    metadata: { event: row.event, ...(row.metadata || {}) },
  });

/** Only the sections we own are persisted — arbitrary caller keys are dropped. */
function sanitizeContent(raw: unknown, field: string) {
  const src = (raw ?? {}) as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const s of SECTIONS) out[s] = vtext(src[s], { max: 8000, field: `${field}.${s}` });
  if (Array.isArray(src.billing_codes)) {
    out.billing_codes = src.billing_codes.slice(0, 25).map((c) => vtext(c, { max: 300, field: "billing_codes" }));
  }
  return out;
}

serve(async (req) => {
  const g = await guard(req, { bucket: "note-integrity", limit: envLimit("RL_NOTE_INTEGRITY", 60) });
  if (g.response) return g.response;
  const { user, admin, cors, json } = g;

  try {
    const body = await req.json();
    let action: string | undefined, hospital_id = "", note_id = "", reason = "";
    let content: Record<string, unknown> = {};
    let lock_version: number | undefined;
    try {
      action = venum(body?.action, ACTIONS, "action", { required: true });
      hospital_id = vuuid(body?.hospital_id, "hospital_id", { required: true })!;
      note_id = vuuid(body?.note_id, "note_id", { required: true })!;
      if (action === "sign") {
        content = sanitizeContent(body?.content, "content");
        if (body?.lock_version !== undefined) lock_version = Number(body.lock_version);
      }
      if (action === "addendum") {
        reason = vtext(body?.reason, { max: 500, required: true, field: "reason" });
        content = { text: vtext(body?.content?.text ?? body?.content, { max: 8000, required: true, field: "content" }) };
      }
    } catch (err) {
      return badRequest(err, cors);
    }

    if (!(await userHasHospitalAccess(admin, user.id, hospital_id))) return json({ error: "Forbidden" }, 403);
    if (!(await ownedByHospital(admin, "clinical_notes", note_id, hospital_id))) return json({ error: "Not found" }, 404);

    const { data: note } = await admin
      .from("clinical_notes")
      .select("id, patient_id, status, author_id, signed_by, lock_version, cosign_required, cosigned_by")
      .eq("id", note_id)
      .maybeSingle();
    if (!note) return json({ error: "Not found" }, 404);

    const base = { user_id: user.id, hospital_id, patient_id: note.patient_id, note_id };

    if (action === "sign") {
      if (SIGNED.includes(note.status)) return json({ error: "Note is already signed" }, 409);
      if (lock_version !== undefined && lock_version !== note.lock_version) {
        return json({ error: "This note changed since you opened it — reload and try again" }, 409);
      }

      const hash = await contentHash(content);
      const signed_at = new Date().toISOString();
      const { error: updateError } = await admin
        .from("clinical_notes")
        .update({
          content,
          status: "signed",
          signed_at,
          signed_by: user.id,
          content_hash: hash,
          cosign_required: body?.cosign_required === true,
        })
        .eq("id", note_id)
        .eq("lock_version", note.lock_version);
      if (updateError) {
        console.error("note-integrity sign failed", updateError);
        return json({ error: "Could not sign this note" }, 500);
      }

      const { count } = await admin
        .from("note_versions")
        .select("id", { count: "exact", head: true })
        .eq("note_id", note_id);
      await admin.from("note_versions").insert({
        note_id, version: (count ?? 0) + 1, content, content_hash: hash, author_id: user.id, signed_at,
      });

      await audit(admin, { ...base, action_type: "sign", event: "note.signed", metadata: { content_hash: hash } });
      return json({ ok: true, content_hash: hash, signed_at, version: (count ?? 0) + 1 });
    }

    if (action === "addendum") {
      if (!SIGNED.includes(note.status)) return json({ error: "Addenda can only be added to a signed note" }, 409);

      const hash = await contentHash({ reason, ...content });
      const { count } = await admin
        .from("note_addenda")
        .select("id", { count: "exact", head: true })
        .eq("note_id", note_id);
      const { data: inserted, error: insertError } = await admin
        .from("note_addenda")
        .insert({ note_id, sequence: (count ?? 0) + 1, reason, content, content_hash: hash, author_id: user.id })
        .select("id, sequence, created_at")
        .maybeSingle();
      if (insertError || !inserted) {
        console.error("note-integrity addendum failed", insertError);
        return json({ error: "Could not record this addendum" }, 500);
      }

      await audit(admin, {
        ...base, action_type: "update", event: "note.addendum",
        metadata: { addendum_id: inserted.id, sequence: inserted.sequence, content_hash: hash },
      });
      return json({ ok: true, addendum: inserted, content_hash: hash });
    }

    // cosign — a supervising clinician other than the signer
    if (!SIGNED.includes(note.status)) return json({ error: "Only a signed note can be cosigned" }, 409);
    if (note.cosigned_by) return json({ error: "Note is already cosigned" }, 409);
    if (note.signed_by === user.id || note.author_id === user.id) {
      return json({ error: "A note cannot be cosigned by its own author" }, 403);
    }
    const { data: roles } = await admin.from("user_roles").select("role").eq("user_id", user.id);
    if (!(roles || []).some((r: { role: string }) => r.role === "clinician" || r.role === "admin")) {
      return json({ error: "Forbidden" }, 403);
    }

    const cosigned_at = new Date().toISOString();
    const { error: cosignError } = await admin
      .from("clinical_notes")
      .update({ cosigned_by: user.id, cosigned_at })
      .eq("id", note_id)
      .is("cosigned_by", null);
    if (cosignError) {
      console.error("note-integrity cosign failed", cosignError);
      return json({ error: "Could not cosign this note" }, 500);
    }

    await audit(admin, { ...base, action_type: "approve", event: "note.cosigned" });
    return json({ ok: true, cosigned_at });
  } catch (err) {
    console.error("note-integrity error", err);
    return json({ error: "Request failed" }, 500);
  }
});
