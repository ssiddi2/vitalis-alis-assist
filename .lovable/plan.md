

# Plan: Integration Specification Document Page

Build a printable `/integration-spec` page that renders the full technical integration specification as a structured, print-optimized document. The user can open it in a browser and use Ctrl+P / Cmd+P to save as PDF.

## What it contains

A comprehensive document covering:
1. **Executive Summary** — Virtualis/ALIS platform overview, InterSystems role as normalization proxy
2. **Architecture Diagram** (ASCII) — ALIS → InterSystems IRIS → EMR (Epic/Cerner/Meditech) data flow
3. **FHIR R4 Resource Mappings** — Table mapping each FHIR resource to internal DB tables with direction (read/write/both), fields, and FHIR paths
4. **API Contracts** — Expected InterSystems endpoints (per-facility FHIR base URL, auth, patient search, resource read/write)
5. **Authentication** — SMART on FHIR Backend Services flow
6. **Per-Facility Session Model** — How `hospitals` table maps to InterSystems tenant routing (hospital_id → FHIR base URL + credentials)
7. **Write-Back Specifications** — ServiceRequest (staged orders), DocumentReference (clinical notes), ConsultationNote posting
8. **Event Subscriptions** — Required FHIR Subscriptions / ADT triggers
9. **Data Model Reference** — Key internal tables and their FHIR equivalents
10. **Security & Compliance** — HIPAA, RLS, audit logging

## Implementation

### Files to create
| File | Purpose |
|------|---------|
| `src/pages/IntegrationSpec.tsx` | Single page component with all spec content, print-optimized CSS |

### Files to edit
| File | Change |
|------|--------|
| `src/App.tsx` | Add `/integration-spec` route (public, no auth required) |

### Design approach
- Pure React component with Tailwind `prose` styling and `@media print` optimizations
- No database calls — all content is static reference documentation
- Includes a "Print / Save as PDF" button in the header (hidden on print)
- Professional document layout: numbered sections, tables, monospace for technical values
- Branded with Virtualis header

