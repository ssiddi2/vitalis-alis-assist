import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";

const IntegrationSpec = () => {
  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Print button - hidden on print */}
      <div className="print:hidden fixed top-4 right-4 z-50">
        <Button onClick={() => window.print()} className="gap-2">
          <Printer className="h-4 w-4" />
          Print / Save as PDF
        </Button>
      </div>

      <div className="max-w-4xl mx-auto px-8 py-12 print:px-0 print:py-0 print:max-w-none">
        {/* Cover / Header */}
        <header className="mb-12 border-b-2 border-primary pb-8 print:mb-8">
          <p className="text-sm font-mono text-muted-foreground uppercase tracking-widest mb-2">Confidential — For InterSystems Discussion Only</p>
          <h1 className="text-4xl font-bold tracking-tight mb-2">Virtualis × InterSystems</h1>
          <h2 className="text-2xl text-muted-foreground font-light mb-4">Technical Integration Specification</h2>
          <p className="text-lg text-muted-foreground">Multi-EMR Clinical Intelligence Platform — FHIR R4 Integration via InterSystems IRIS / HealthShare</p>
          <div className="mt-4 flex gap-6 text-sm text-muted-foreground font-mono">
            <span>Version 1.0</span>
            <span>Date: {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</span>
            <span>Status: Draft</span>
          </div>
        </header>

        {/* Table of Contents */}
        <nav className="mb-12 print:mb-8">
          <h3 className="text-lg font-semibold mb-3">Table of Contents</h3>
          <ol className="list-decimal list-inside space-y-1 text-sm text-muted-foreground">
            <li><a href="#executive-summary" className="hover:text-foreground">Executive Summary</a></li>
            <li><a href="#architecture" className="hover:text-foreground">System Architecture</a></li>
            <li><a href="#fhir-mappings" className="hover:text-foreground">FHIR R4 Resource Mappings</a></li>
            <li><a href="#api-contracts" className="hover:text-foreground">API Contracts</a></li>
            <li><a href="#authentication" className="hover:text-foreground">Authentication — SMART on FHIR</a></li>
            <li><a href="#session-model" className="hover:text-foreground">Per-Facility Session Model</a></li>
            <li><a href="#write-back" className="hover:text-foreground">Write-Back Specifications</a></li>
            <li><a href="#event-subscriptions" className="hover:text-foreground">Event Subscriptions</a></li>
            <li><a href="#data-model" className="hover:text-foreground">Internal Data Model Reference</a></li>
            <li><a href="#security" className="hover:text-foreground">Security & Compliance</a></li>
          </ol>
        </nav>

        {/* Section 1 */}
        <section id="executive-summary" className="mb-12 print:mb-8 print:break-inside-avoid">
          <h2 className="text-2xl font-bold mb-4 border-b border-border pb-2">1. Executive Summary</h2>
          <p className="mb-4 leading-relaxed">
            <strong>Virtualis</strong> is a clinical intelligence platform that provides physicians with a unified workspace 
            for managing patients across multiple hospital facilities, each running a different Electronic Medical Record (EMR) system. 
            The platform's AI assistant, <strong>ALIS (Adaptive Learning Intelligence System)</strong>, operates as a real-time 
            clinical co-pilot — ingesting patient data, generating clinical notes (SOAP), staging orders, managing billing capture, 
            and facilitating specialist consultations.
          </p>
          <p className="mb-4 leading-relaxed">
            <strong>The Integration Challenge:</strong> A single physician may round at 3+ facilities running Epic, Cerner (Oracle Health), 
            and Meditech Expanse respectively. ALIS must read from and write back to each EMR in real-time during the physician's session. 
            There is <em>no requirement</em> for cross-EMR patient matching (MPI) — each facility's patient population is independent.
          </p>
          <p className="mb-4 leading-relaxed">
            <strong>InterSystems' Role:</strong> InterSystems IRIS for Health / HealthShare serves as the <strong>normalization proxy</strong> — 
            translating each EMR's native interface (HL7v2, proprietary FHIR variants, Meditech APIs) into a single, 
            consistent <strong>FHIR R4</strong> interface that ALIS consumes. This eliminates the need for Virtualis to maintain 
            per-EMR adapters and allows rapid onboarding of new facilities.
          </p>

          <div className="bg-muted/50 border border-border rounded-lg p-4 mt-4">
            <h4 className="font-semibold mb-2">Key Principle</h4>
            <p className="text-sm">
              Virtualis speaks <strong>one language: FHIR R4</strong>. InterSystems handles all EMR-specific translation, 
              credential management, and protocol bridging. Each facility maps to a unique InterSystems tenant/channel 
              identified by the facility's <code className="bg-muted px-1 rounded font-mono text-xs">hospital_id</code>.
            </p>
          </div>
        </section>

        {/* Section 2 */}
        <section id="architecture" className="mb-12 print:mb-8 print:break-before-page">
          <h2 className="text-2xl font-bold mb-4 border-b border-border pb-2">2. System Architecture</h2>
          <p className="mb-4 leading-relaxed">
            The architecture follows a hub-and-spoke model where InterSystems IRIS sits between Virtualis and each EMR:
          </p>

          <pre className="bg-muted text-muted-foreground p-6 rounded-lg text-xs font-mono overflow-x-auto leading-relaxed mb-6">{`
┌─────────────────────────────────────────────────────────────────────────┐
│                        VIRTUALIS PLATFORM                              │
│                                                                         │
│  ┌──────────┐  ┌──────────────┐  ┌────────────┐  ┌──────────────────┐  │
│  │ Hospital  │  │   Patient    │  │   ALIS     │  │  Backend Edge    │  │
│  │ Selector  │──│   Census     │──│  AI Chat   │──│  Functions       │  │
│  │           │  │   Dashboard  │  │  Orders    │  │  (Supabase)      │  │
│  └──────────┘  └──────────────┘  │  Notes     │  └────────┬─────────┘  │
│       │                           │  Billing   │           │            │
│       │ hospital_id               └────────────┘           │            │
│       ▼                                                     │            │
│  ┌──────────────────────────────────────────────────────────┘            │
│  │  FHIR R4 Client Layer                                                │
│  │  - Per-facility session routing                                      │
│  │  - SMART on FHIR token management                                    │
│  │  - Resource read/write operations                                    │
│  └──────────────────────────────────┬───────────────────────────────────┘
                                      │
                                      │ HTTPS / FHIR R4
                                      ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                    INTERSYSTEMS IRIS FOR HEALTH                          │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │  Tenant Router                                                   │    │
│  │  hospital_id → EMR Connection Profile                            │    │
│  └────────┬──────────────────┬──────────────────┬──────────────────┘    │
│           │                  │                  │                        │
│  ┌────────▼───────┐ ┌───────▼────────┐ ┌───────▼────────┐             │
│  │  Epic Adapter   │ │ Cerner Adapter  │ │Meditech Adapter│             │
│  │  FHIR R4 Native │ │ FHIR R4 Native  │ │HL7v2 → FHIR R4│             │
│  └────────┬───────┘ └───────┬────────┘ └───────┬────────┘             │
│           │                  │                  │                        │
└───────────┼──────────────────┼──────────────────┼───────────────────────┘
            │                  │                  │
            ▼                  ▼                  ▼
     ┌──────────┐      ┌──────────┐      ┌──────────────┐
     │   Epic   │      │  Cerner  │      │   Meditech   │
     │  MyChart │      │  (Oracle │      │   Expanse    │
     │  Hypersp.│      │  Health) │      │              │
     └──────────┘      └──────────┘      └──────────────┘
`}</pre>

          <h3 className="text-lg font-semibold mb-2">Data Flow Summary</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border border-border">
              <thead>
                <tr className="bg-muted">
                  <th className="text-left p-3 border-b border-border font-semibold">Direction</th>
                  <th className="text-left p-3 border-b border-border font-semibold">Trigger</th>
                  <th className="text-left p-3 border-b border-border font-semibold">Data</th>
                  <th className="text-left p-3 border-b border-border font-semibold">Latency Target</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-border">
                  <td className="p-3 font-mono text-xs">EMR → ALIS</td>
                  <td className="p-3">Physician selects facility</td>
                  <td className="p-3">Patient census, demographics, active problems</td>
                  <td className="p-3">&lt; 3 seconds</td>
                </tr>
                <tr className="border-b border-border">
                  <td className="p-3 font-mono text-xs">EMR → ALIS</td>
                  <td className="p-3">Physician opens patient chart</td>
                  <td className="p-3">Vitals, labs, meds, imaging, encounters</td>
                  <td className="p-3">&lt; 2 seconds</td>
                </tr>
                <tr className="border-b border-border">
                  <td className="p-3 font-mono text-xs">ALIS → EMR</td>
                  <td className="p-3">Physician approves staged order</td>
                  <td className="p-3">ServiceRequest (lab, imaging, consult orders)</td>
                  <td className="p-3">&lt; 1 second</td>
                </tr>
                <tr className="border-b border-border">
                  <td className="p-3 font-mono text-xs">ALIS → EMR</td>
                  <td className="p-3">Physician signs clinical note</td>
                  <td className="p-3">DocumentReference (SOAP note, consult note)</td>
                  <td className="p-3">&lt; 2 seconds</td>
                </tr>
                <tr>
                  <td className="p-3 font-mono text-xs">EMR → ALIS</td>
                  <td className="p-3">Real-time event</td>
                  <td className="p-3">ADT (admit/discharge/transfer), new results</td>
                  <td className="p-3">&lt; 5 seconds</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* Section 3 */}
        <section id="fhir-mappings" className="mb-12 print:mb-8 print:break-before-page">
          <h2 className="text-2xl font-bold mb-4 border-b border-border pb-2">3. FHIR R4 Resource Mappings</h2>
          <p className="mb-4 leading-relaxed">
            The following table maps each FHIR R4 resource to Virtualis internal database tables, 
            specifying the direction of data flow and key field mappings.
          </p>

          <div className="overflow-x-auto">
            <table className="w-full text-sm border border-border">
              <thead>
                <tr className="bg-muted">
                  <th className="text-left p-3 border-b border-border font-semibold">FHIR R4 Resource</th>
                  <th className="text-left p-3 border-b border-border font-semibold">Virtualis Table</th>
                  <th className="text-left p-3 border-b border-border font-semibold">Direction</th>
                  <th className="text-left p-3 border-b border-border font-semibold">Key FHIR Paths → DB Columns</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-border">
                  <td className="p-3 font-mono text-xs">Patient</td>
                  <td className="p-3 font-mono text-xs">patients</td>
                  <td className="p-3">Read</td>
                  <td className="p-3 text-xs">
                    <code>Patient.identifier[MRN].value</code> → <code>mrn</code><br />
                    <code>Patient.name[0].text</code> → <code>name</code><br />
                    <code>Patient.gender</code> → <code>sex</code><br />
                    <code>Patient.birthDate</code> → <code>age</code> (calculated)<br />
                    <code>Patient.contact[0]</code> → <code>emergency_contact</code>
                  </td>
                </tr>
                <tr className="border-b border-border">
                  <td className="p-3 font-mono text-xs">Encounter</td>
                  <td className="p-3 font-mono text-xs">encounters</td>
                  <td className="p-3">Read / Write</td>
                  <td className="p-3 text-xs">
                    <code>Encounter.status</code> → <code>status</code><br />
                    <code>Encounter.class</code> → <code>encounter_type</code><br />
                    <code>Encounter.reasonCode[0].text</code> → <code>visit_reason</code><br />
                    <code>Encounter.location[0].location.display</code> → <code>room_number</code><br />
                    <code>Encounter.period.start</code> → <code>check_in_at</code>
                  </td>
                </tr>
                <tr className="border-b border-border">
                  <td className="p-3 font-mono text-xs">Observation</td>
                  <td className="p-3 font-mono text-xs">patient_vitals</td>
                  <td className="p-3">Read</td>
                  <td className="p-3 text-xs">
                    <code>Observation.code (LOINC)</code> → vitals category<br />
                    <code>Observation.valueQuantity</code> → <code>trends[].value</code><br />
                    <code>Observation.effectiveDateTime</code> → <code>trends[].timestamp</code><br />
                    <code>Observation.interpretation</code> → <code>insights[]</code>
                  </td>
                </tr>
                <tr className="border-b border-border">
                  <td className="p-3 font-mono text-xs">Observation (Lab)</td>
                  <td className="p-3 font-mono text-xs">patient_vitals</td>
                  <td className="p-3">Read</td>
                  <td className="p-3 text-xs">
                    <code>Observation.code (LOINC)</code> → lab panel identifier<br />
                    <code>Observation.valueQuantity</code> → result value<br />
                    <code>Observation.referenceRange</code> → normal range<br />
                    <code>Observation.status</code> → final/preliminary
                  </td>
                </tr>
                <tr className="border-b border-border">
                  <td className="p-3 font-mono text-xs">MedicationRequest</td>
                  <td className="p-3 font-mono text-xs">prescriptions<br/>patient_medications</td>
                  <td className="p-3">Read / Write</td>
                  <td className="p-3 text-xs">
                    <code>MedicationRequest.medicationCodeableConcept.text</code> → <code>medication_name</code><br />
                    <code>MedicationRequest.dosageInstruction[0].text</code> → <code>sig</code><br />
                    <code>MedicationRequest.dosageInstruction[0].doseAndRate[0]</code> → <code>dose</code><br />
                    <code>MedicationRequest.dispenseRequest.quantity</code> → <code>quantity</code><br />
                    <code>MedicationRequest.dispenseRequest.numberOfRepeatsAllowed</code> → <code>refills</code>
                  </td>
                </tr>
                <tr className="border-b border-border">
                  <td className="p-3 font-mono text-xs">ServiceRequest</td>
                  <td className="p-3 font-mono text-xs">staged_orders</td>
                  <td className="p-3">Write</td>
                  <td className="p-3 text-xs">
                    <code>ServiceRequest.code.text</code> ← <code>order_data.name</code><br />
                    <code>ServiceRequest.category</code> ← <code>order_type</code><br />
                    <code>ServiceRequest.reasonCode[0].text</code> ← <code>rationale</code><br />
                    <code>ServiceRequest.status</code> ← <code>status</code> (mapped)<br />
                    <code>ServiceRequest.subject</code> ← <code>patient_id</code> (→ Patient ref)
                  </td>
                </tr>
                <tr className="border-b border-border">
                  <td className="p-3 font-mono text-xs">DocumentReference</td>
                  <td className="p-3 font-mono text-xs">clinical_notes</td>
                  <td className="p-3">Write</td>
                  <td className="p-3 text-xs">
                    <code>DocumentReference.type</code> ← <code>note_type</code> (LOINC mapped)<br />
                    <code>DocumentReference.content[0].attachment.data</code> ← <code>content</code> (Base64)<br />
                    <code>DocumentReference.status</code> ← <code>status</code><br />
                    <code>DocumentReference.date</code> ← <code>signed_at</code><br />
                    <code>DocumentReference.author</code> ← <code>author_id</code> (→ Practitioner ref)
                  </td>
                </tr>
                <tr className="border-b border-border">
                  <td className="p-3 font-mono text-xs">AllergyIntolerance</td>
                  <td className="p-3 font-mono text-xs">patient_allergies</td>
                  <td className="p-3">Read</td>
                  <td className="p-3 text-xs">
                    <code>AllergyIntolerance.code.text</code> → <code>allergen</code><br />
                    <code>AllergyIntolerance.reaction[0].manifestation[0].text</code> → <code>reaction</code><br />
                    <code>AllergyIntolerance.criticality</code> → <code>severity</code>
                  </td>
                </tr>
                <tr className="border-b border-border">
                  <td className="p-3 font-mono text-xs">Condition</td>
                  <td className="p-3 font-mono text-xs">patient_problems</td>
                  <td className="p-3">Read</td>
                  <td className="p-3 text-xs">
                    <code>Condition.code.coding[ICD-10].code</code> → <code>icd10_code</code><br />
                    <code>Condition.code.text</code> → <code>description</code><br />
                    <code>Condition.clinicalStatus</code> → <code>status</code><br />
                    <code>Condition.onsetDateTime</code> → <code>onset_date</code>
                  </td>
                </tr>
                <tr className="border-b border-border">
                  <td className="p-3 font-mono text-xs">ImagingStudy</td>
                  <td className="p-3 font-mono text-xs">imaging_studies</td>
                  <td className="p-3">Read</td>
                  <td className="p-3 text-xs">
                    <code>ImagingStudy.modality</code> → <code>modality</code><br />
                    <code>ImagingStudy.description</code> → <code>study_type</code><br />
                    <code>ImagingStudy.started</code> → <code>study_date</code><br />
                    <code>ImagingStudy.series[0].bodySite</code> → <code>body_part</code>
                  </td>
                </tr>
                <tr>
                  <td className="p-3 font-mono text-xs">Immunization</td>
                  <td className="p-3 font-mono text-xs">immunizations</td>
                  <td className="p-3">Read / Write</td>
                  <td className="p-3 text-xs">
                    <code>Immunization.vaccineCode.text</code> → <code>vaccine_name</code><br />
                    <code>Immunization.vaccineCode.coding[CVX].code</code> → <code>cvx_code</code><br />
                    <code>Immunization.occurrenceDateTime</code> → <code>administered_date</code><br />
                    <code>Immunization.lotNumber</code> → <code>lot_number</code><br />
                    <code>Immunization.site</code> → <code>site</code>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* Section 4 */}
        <section id="api-contracts" className="mb-12 print:mb-8 print:break-before-page">
          <h2 className="text-2xl font-bold mb-4 border-b border-border pb-2">4. API Contracts</h2>
          <p className="mb-4 leading-relaxed">
            Virtualis expects InterSystems to expose a unified FHIR R4 REST API per facility tenant. 
            The base URL is configurable per hospital and stored in the facility's connection profile.
          </p>

          <h3 className="text-lg font-semibold mb-3">4.1 Base URL Pattern</h3>
          <pre className="bg-muted text-muted-foreground p-4 rounded-lg text-sm font-mono mb-6">
{`GET https://{intersystems-host}/fhir/r4/{tenant-id}/Patient?identifier=MRN|{mrn}

Where:
  {intersystems-host}  = InterSystems IRIS endpoint (e.g., iris.virtualis-health.com)
  {tenant-id}          = Maps to hospital_id / facility code (e.g., "mercy-general", "st-luke")
`}
          </pre>

          <h3 className="text-lg font-semibold mb-3">4.2 Required Endpoints</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border border-border">
              <thead>
                <tr className="bg-muted">
                  <th className="text-left p-3 border-b border-border font-semibold">Operation</th>
                  <th className="text-left p-3 border-b border-border font-semibold">HTTP Method</th>
                  <th className="text-left p-3 border-b border-border font-semibold">Endpoint</th>
                  <th className="text-left p-3 border-b border-border font-semibold">Use Case</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-border">
                  <td className="p-3">Patient Search</td>
                  <td className="p-3 font-mono text-xs">GET</td>
                  <td className="p-3 font-mono text-xs">/Patient?_list=current-inpatients</td>
                  <td className="p-3">Load facility census</td>
                </tr>
                <tr className="border-b border-border">
                  <td className="p-3">Patient Read</td>
                  <td className="p-3 font-mono text-xs">GET</td>
                  <td className="p-3 font-mono text-xs">/Patient/{`{id}`}</td>
                  <td className="p-3">Patient demographics</td>
                </tr>
                <tr className="border-b border-border">
                  <td className="p-3">Encounter Search</td>
                  <td className="p-3 font-mono text-xs">GET</td>
                  <td className="p-3 font-mono text-xs">/Encounter?patient={`{id}`}&status=in-progress</td>
                  <td className="p-3">Active encounters</td>
                </tr>
                <tr className="border-b border-border">
                  <td className="p-3">Vitals Bundle</td>
                  <td className="p-3 font-mono text-xs">GET</td>
                  <td className="p-3 font-mono text-xs">/Observation?patient={`{id}`}&category=vital-signs&_sort=-date&_count=50</td>
                  <td className="p-3">Vitals panel</td>
                </tr>
                <tr className="border-b border-border">
                  <td className="p-3">Lab Results</td>
                  <td className="p-3 font-mono text-xs">GET</td>
                  <td className="p-3 font-mono text-xs">/Observation?patient={`{id}`}&category=laboratory&_sort=-date</td>
                  <td className="p-3">Lab results panel</td>
                </tr>
                <tr className="border-b border-border">
                  <td className="p-3">Medications</td>
                  <td className="p-3 font-mono text-xs">GET</td>
                  <td className="p-3 font-mono text-xs">/MedicationRequest?patient={`{id}`}&status=active</td>
                  <td className="p-3">Active med list</td>
                </tr>
                <tr className="border-b border-border">
                  <td className="p-3">Allergies</td>
                  <td className="p-3 font-mono text-xs">GET</td>
                  <td className="p-3 font-mono text-xs">/AllergyIntolerance?patient={`{id}`}</td>
                  <td className="p-3">Allergy panel</td>
                </tr>
                <tr className="border-b border-border">
                  <td className="p-3">Problems</td>
                  <td className="p-3 font-mono text-xs">GET</td>
                  <td className="p-3 font-mono text-xs">/Condition?patient={`{id}`}&clinical-status=active</td>
                  <td className="p-3">Problem list</td>
                </tr>
                <tr className="border-b border-border">
                  <td className="p-3">Imaging</td>
                  <td className="p-3 font-mono text-xs">GET</td>
                  <td className="p-3 font-mono text-xs">/ImagingStudy?patient={`{id}`}&_sort=-date</td>
                  <td className="p-3">Imaging panel</td>
                </tr>
                <tr className="border-b border-border">
                  <td className="p-3">Immunizations</td>
                  <td className="p-3 font-mono text-xs">GET</td>
                  <td className="p-3 font-mono text-xs">/Immunization?patient={`{id}`}</td>
                  <td className="p-3">Immunization history</td>
                </tr>
                <tr className="border-b border-border">
                  <td className="p-3">Post Order</td>
                  <td className="p-3 font-mono text-xs">POST</td>
                  <td className="p-3 font-mono text-xs">/ServiceRequest</td>
                  <td className="p-3">Stage approved order</td>
                </tr>
                <tr className="border-b border-border">
                  <td className="p-3">Post Prescription</td>
                  <td className="p-3 font-mono text-xs">POST</td>
                  <td className="p-3 font-mono text-xs">/MedicationRequest</td>
                  <td className="p-3">e-Prescribe</td>
                </tr>
                <tr>
                  <td className="p-3">Post Note</td>
                  <td className="p-3 font-mono text-xs">POST</td>
                  <td className="p-3 font-mono text-xs">/DocumentReference</td>
                  <td className="p-3">Signed clinical note</td>
                </tr>
              </tbody>
            </table>
          </div>

          <h3 className="text-lg font-semibold mt-6 mb-3">4.3 Expected Response Format</h3>
          <p className="mb-3 text-sm">All search endpoints return FHIR R4 <code className="bg-muted px-1 rounded font-mono text-xs">Bundle</code> resources with type <code className="bg-muted px-1 rounded font-mono text-xs">searchset</code>:</p>
          <pre className="bg-muted text-muted-foreground p-4 rounded-lg text-xs font-mono overflow-x-auto">
{`{
  "resourceType": "Bundle",
  "type": "searchset",
  "total": 23,
  "entry": [
    {
      "resource": {
        "resourceType": "Patient",
        "id": "abc-123",
        "identifier": [
          {
            "type": { "coding": [{ "code": "MR" }] },
            "value": "MRN-001234"
          }
        ],
        "name": [{ "text": "Johnson, Robert" }],
        "gender": "male",
        "birthDate": "1958-03-15"
      }
    }
  ]
}`}
          </pre>
        </section>

        {/* Section 5 */}
        <section id="authentication" className="mb-12 print:mb-8 print:break-before-page">
          <h2 className="text-2xl font-bold mb-4 border-b border-border pb-2">5. Authentication — SMART on FHIR</h2>
          <p className="mb-4 leading-relaxed">
            Virtualis uses <strong>SMART on FHIR Backend Services</strong> (client_credentials grant) for server-to-server 
            authentication. This flow does not require user interaction and is suitable for backend Edge Functions 
            that need to access EMR data on behalf of the platform.
          </p>

          <h3 className="text-lg font-semibold mb-3">5.1 Authentication Flow</h3>
          <pre className="bg-muted text-muted-foreground p-4 rounded-lg text-xs font-mono overflow-x-auto mb-6">
{`1. Virtualis Edge Function reads facility credentials from hospital connection profile
2. Constructs a signed JWT assertion:
   {
     "iss": "{client_id}",           // Per-facility client ID
     "sub": "{client_id}",
     "aud": "{token_endpoint}",      // InterSystems token endpoint
     "exp": {now + 300},
     "jti": "{unique_id}"
   }
3. POST to InterSystems token endpoint:
   POST /oauth2/token
   Content-Type: application/x-www-form-urlencoded
   
   grant_type=client_credentials
   &client_assertion_type=urn:ietf:params:oauth:client-assertion-type:jwt-bearer
   &client_assertion={signed_jwt}
   &scope=system/*.read system/ServiceRequest.write system/DocumentReference.write

4. Receive access_token (short-lived, ~5 min)
5. Use token in Authorization header for all FHIR requests:
   GET /fhir/r4/{tenant}/Patient
   Authorization: Bearer {access_token}`}
          </pre>

          <h3 className="text-lg font-semibold mb-3">5.2 Required Scopes</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border border-border">
              <thead>
                <tr className="bg-muted">
                  <th className="text-left p-3 border-b border-border font-semibold">Scope</th>
                  <th className="text-left p-3 border-b border-border font-semibold">Purpose</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-border">
                  <td className="p-3 font-mono text-xs">system/Patient.read</td>
                  <td className="p-3">Census, demographics</td>
                </tr>
                <tr className="border-b border-border">
                  <td className="p-3 font-mono text-xs">system/Encounter.read</td>
                  <td className="p-3">Active encounters</td>
                </tr>
                <tr className="border-b border-border">
                  <td className="p-3 font-mono text-xs">system/Observation.read</td>
                  <td className="p-3">Vitals, lab results</td>
                </tr>
                <tr className="border-b border-border">
                  <td className="p-3 font-mono text-xs">system/MedicationRequest.read</td>
                  <td className="p-3">Active medications</td>
                </tr>
                <tr className="border-b border-border">
                  <td className="p-3 font-mono text-xs">system/MedicationRequest.write</td>
                  <td className="p-3">e-Prescribe write-back</td>
                </tr>
                <tr className="border-b border-border">
                  <td className="p-3 font-mono text-xs">system/AllergyIntolerance.read</td>
                  <td className="p-3">Allergy list</td>
                </tr>
                <tr className="border-b border-border">
                  <td className="p-3 font-mono text-xs">system/Condition.read</td>
                  <td className="p-3">Problem list</td>
                </tr>
                <tr className="border-b border-border">
                  <td className="p-3 font-mono text-xs">system/ServiceRequest.write</td>
                  <td className="p-3">Order write-back</td>
                </tr>
                <tr>
                  <td className="p-3 font-mono text-xs">system/DocumentReference.write</td>
                  <td className="p-3">Clinical note posting</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* Section 6 */}
        <section id="session-model" className="mb-12 print:mb-8 print:break-before-page">
          <h2 className="text-2xl font-bold mb-4 border-b border-border pb-2">6. Per-Facility Session Model</h2>
          <p className="mb-4 leading-relaxed">
            When a physician logs into Virtualis, they select a facility from the Hospital Selector. 
            This selection maps to a <code className="bg-muted px-1 rounded font-mono text-xs">hospital_id</code> which 
            determines the InterSystems tenant/channel for all subsequent FHIR operations.
          </p>

          <h3 className="text-lg font-semibold mb-3">6.1 Hospital Connection Profile</h3>
          <p className="mb-3 text-sm">Each facility requires the following connection configuration stored securely:</p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border border-border">
              <thead>
                <tr className="bg-muted">
                  <th className="text-left p-3 border-b border-border font-semibold">Field</th>
                  <th className="text-left p-3 border-b border-border font-semibold">Example</th>
                  <th className="text-left p-3 border-b border-border font-semibold">Description</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-border">
                  <td className="p-3 font-mono text-xs">hospital_id</td>
                  <td className="p-3 font-mono text-xs">uuid</td>
                  <td className="p-3">Internal Virtualis facility identifier</td>
                </tr>
                <tr className="border-b border-border">
                  <td className="p-3 font-mono text-xs">emr_system</td>
                  <td className="p-3 font-mono text-xs">epic | cerner | meditech</td>
                  <td className="p-3">EMR vendor (informational)</td>
                </tr>
                <tr className="border-b border-border">
                  <td className="p-3 font-mono text-xs">fhir_base_url</td>
                  <td className="p-3 font-mono text-xs">https://iris.example.com/fhir/r4/mercy</td>
                  <td className="p-3">InterSystems FHIR endpoint for this tenant</td>
                </tr>
                <tr className="border-b border-border">
                  <td className="p-3 font-mono text-xs">client_id</td>
                  <td className="p-3 font-mono text-xs">virtualis-mercy-prod</td>
                  <td className="p-3">SMART client ID for this facility</td>
                </tr>
                <tr className="border-b border-border">
                  <td className="p-3 font-mono text-xs">token_endpoint</td>
                  <td className="p-3 font-mono text-xs">https://iris.example.com/oauth2/token</td>
                  <td className="p-3">OAuth2 token endpoint</td>
                </tr>
                <tr>
                  <td className="p-3 font-mono text-xs">private_key_id</td>
                  <td className="p-3 font-mono text-xs">vault reference</td>
                  <td className="p-3">Reference to signing key (stored in vault)</td>
                </tr>
              </tbody>
            </table>
          </div>

          <h3 className="text-lg font-semibold mt-6 mb-3">6.2 Session Lifecycle</h3>
          <pre className="bg-muted text-muted-foreground p-4 rounded-lg text-xs font-mono overflow-x-auto">
{`Physician Login
    │
    ▼
Hospital Selector (UI)
    │ selects "Mercy General Hospital"
    │ hospital_id = "abc-123"
    │ emr_system = "epic"
    ▼
Load Connection Profile
    │ fhir_base_url = "https://iris.virtualis.com/fhir/r4/mercy"
    │ client_id = "virtualis-mercy-prod"
    ▼
Acquire SMART Token (Edge Function)
    │ POST /oauth2/token → access_token (5 min TTL)
    │ Cache token per hospital_id
    ▼
Patient Census Load
    │ GET {fhir_base_url}/Patient?_list=current-inpatients
    │ Populate patients table (hospital_id scoped)
    ▼
Patient Chart Open
    │ Parallel FHIR reads: Observation, MedicationRequest,
    │ AllergyIntolerance, Condition, Encounter, ImagingStudy
    ▼
ALIS Session Active
    │ AI processes patient data
    │ Generates notes, stages orders, captures billing
    ▼
Write-Back (on physician approval)
    │ POST ServiceRequest, DocumentReference, MedicationRequest
    │ → InterSystems → EMR
    ▼
Session End / Facility Switch
    │ Invalidate token, clear patient context
    │ Return to Hospital Selector`}
          </pre>
        </section>

        {/* Section 7 */}
        <section id="write-back" className="mb-12 print:mb-8 print:break-before-page">
          <h2 className="text-2xl font-bold mb-4 border-b border-border pb-2">7. Write-Back Specifications</h2>
          <p className="mb-4 leading-relaxed">
            Write-back operations occur when a physician approves an ALIS-generated artifact. 
            All writes go through InterSystems, which translates the FHIR R4 resource into the target EMR's native format.
          </p>

          <h3 className="text-lg font-semibold mb-3">7.1 ServiceRequest (Staged Orders)</h3>
          <p className="mb-3 text-sm">When a physician approves a staged order, Virtualis posts a <code className="bg-muted px-1 rounded font-mono text-xs">ServiceRequest</code>:</p>
          <pre className="bg-muted text-muted-foreground p-4 rounded-lg text-xs font-mono overflow-x-auto mb-6">
{`POST /fhir/r4/{tenant}/ServiceRequest
Content-Type: application/fhir+json
Authorization: Bearer {token}

{
  "resourceType": "ServiceRequest",
  "status": "active",
  "intent": "order",
  "category": [{
    "coding": [{
      "system": "http://snomed.info/sct",
      "code": "108252007",
      "display": "Laboratory procedure"
    }]
  }],
  "code": {
    "coding": [{
      "system": "http://loinc.org",
      "code": "2160-0",
      "display": "Creatinine [Mass/volume] in Serum or Plasma"
    }],
    "text": "Basic Metabolic Panel"
  },
  "subject": {
    "reference": "Patient/{fhir_patient_id}"
  },
  "encounter": {
    "reference": "Encounter/{fhir_encounter_id}"
  },
  "requester": {
    "reference": "Practitioner/{fhir_practitioner_id}"
  },
  "reasonCode": [{
    "text": "Monitoring renal function - patient on ACE inhibitor"
  }],
  "note": [{
    "text": "Generated by ALIS clinical intelligence"
  }]
}`}
          </pre>

          <h3 className="text-lg font-semibold mb-3">7.2 DocumentReference (Clinical Notes)</h3>
          <p className="mb-3 text-sm">Signed clinical notes are posted as <code className="bg-muted px-1 rounded font-mono text-xs">DocumentReference</code> with Base64-encoded content:</p>
          <pre className="bg-muted text-muted-foreground p-4 rounded-lg text-xs font-mono overflow-x-auto mb-6">
{`POST /fhir/r4/{tenant}/DocumentReference
Content-Type: application/fhir+json

{
  "resourceType": "DocumentReference",
  "status": "current",
  "type": {
    "coding": [{
      "system": "http://loinc.org",
      "code": "11506-3",
      "display": "Progress note"
    }]
  },
  "subject": { "reference": "Patient/{id}" },
  "date": "2026-03-11T14:30:00Z",
  "author": [{ "reference": "Practitioner/{id}" }],
  "content": [{
    "attachment": {
      "contentType": "text/html",
      "data": "{base64_encoded_soap_note}",
      "title": "Progress Note - Dr. Smith"
    }
  }],
  "context": {
    "encounter": [{ "reference": "Encounter/{id}" }]
  }
}`}
          </pre>

          <h3 className="text-lg font-semibold mb-3">7.3 MedicationRequest (e-Prescribe)</h3>
          <pre className="bg-muted text-muted-foreground p-4 rounded-lg text-xs font-mono overflow-x-auto">
{`POST /fhir/r4/{tenant}/MedicationRequest
Content-Type: application/fhir+json

{
  "resourceType": "MedicationRequest",
  "status": "active",
  "intent": "order",
  "medicationCodeableConcept": {
    "coding": [{
      "system": "http://www.nlm.nih.gov/research/umls/rxnorm",
      "code": "860975",
      "display": "Metformin 500 MG Oral Tablet"
    }],
    "text": "Metformin 500mg"
  },
  "subject": { "reference": "Patient/{id}" },
  "encounter": { "reference": "Encounter/{id}" },
  "requester": { "reference": "Practitioner/{id}" },
  "dosageInstruction": [{
    "text": "Take 1 tablet by mouth twice daily with meals",
    "timing": { "repeat": { "frequency": 2, "period": 1, "periodUnit": "d" } },
    "doseAndRate": [{
      "doseQuantity": { "value": 500, "unit": "mg" }
    }]
  }],
  "dispenseRequest": {
    "quantity": { "value": 60, "unit": "tablets" },
    "numberOfRepeatsAllowed": 3,
    "expectedSupplyDuration": { "value": 30, "unit": "days" }
  }
}`}
          </pre>
        </section>

        {/* Section 8 */}
        <section id="event-subscriptions" className="mb-12 print:mb-8 print:break-before-page">
          <h2 className="text-2xl font-bold mb-4 border-b border-border pb-2">8. Event Subscriptions</h2>
          <p className="mb-4 leading-relaxed">
            For real-time updates during an active session, Virtualis requires event-driven notifications 
            from InterSystems when key clinical events occur in the source EMR.
          </p>

          <h3 className="text-lg font-semibold mb-3">8.1 Required Event Types</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border border-border">
              <thead>
                <tr className="bg-muted">
                  <th className="text-left p-3 border-b border-border font-semibold">Event</th>
                  <th className="text-left p-3 border-b border-border font-semibold">FHIR Subscription Criteria</th>
                  <th className="text-left p-3 border-b border-border font-semibold">Webhook Payload</th>
                  <th className="text-left p-3 border-b border-border font-semibold">Use Case</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-border">
                  <td className="p-3">ADT — Admit</td>
                  <td className="p-3 font-mono text-xs">Encounter?status=in-progress</td>
                  <td className="p-3 text-xs">Encounter resource</td>
                  <td className="p-3">New patient on census</td>
                </tr>
                <tr className="border-b border-border">
                  <td className="p-3">ADT — Discharge</td>
                  <td className="p-3 font-mono text-xs">Encounter?status=finished</td>
                  <td className="p-3 text-xs">Encounter resource</td>
                  <td className="p-3">Remove from active census</td>
                </tr>
                <tr className="border-b border-border">
                  <td className="p-3">ADT — Transfer</td>
                  <td className="p-3 font-mono text-xs">Encounter?location-changed=true</td>
                  <td className="p-3 text-xs">Encounter + Location</td>
                  <td className="p-3">Update bed/unit assignment</td>
                </tr>
                <tr className="border-b border-border">
                  <td className="p-3">New Lab Result</td>
                  <td className="p-3 font-mono text-xs">Observation?category=laboratory&status=final</td>
                  <td className="p-3 text-xs">Observation resource</td>
                  <td className="p-3">Alert ALIS to new results</td>
                </tr>
                <tr className="border-b border-border">
                  <td className="p-3">Critical Result</td>
                  <td className="p-3 font-mono text-xs">Observation?interpretation=critical</td>
                  <td className="p-3 text-xs">Observation + flag</td>
                  <td className="p-3">Critical value alert</td>
                </tr>
                <tr>
                  <td className="p-3">Order Status Update</td>
                  <td className="p-3 font-mono text-xs">ServiceRequest?status=completed</td>
                  <td className="p-3 text-xs">ServiceRequest resource</td>
                  <td className="p-3">Order completion tracking</td>
                </tr>
              </tbody>
            </table>
          </div>

          <h3 className="text-lg font-semibold mt-6 mb-3">8.2 Webhook Configuration</h3>
          <pre className="bg-muted text-muted-foreground p-4 rounded-lg text-xs font-mono overflow-x-auto">
{`Webhook Endpoint: POST https://{supabase-project}.supabase.co/functions/v1/fhir-webhook
Headers:
  X-InterSystems-Signature: {HMAC-SHA256 signature}
  X-Tenant-ID: {hospital_code}
  Content-Type: application/fhir+json

The Edge Function validates the signature, maps the tenant to hospital_id,
and updates the corresponding Virtualis tables via Supabase client.`}
          </pre>
        </section>

        {/* Section 9 */}
        <section id="data-model" className="mb-12 print:mb-8 print:break-before-page">
          <h2 className="text-2xl font-bold mb-4 border-b border-border pb-2">9. Internal Data Model Reference</h2>
          <p className="mb-4 leading-relaxed">
            The following tables represent Virtualis's internal data model that maps to FHIR R4 resources. 
            InterSystems should understand this mapping for bidirectional synchronization.
          </p>

          <div className="overflow-x-auto">
            <table className="w-full text-sm border border-border">
              <thead>
                <tr className="bg-muted">
                  <th className="text-left p-3 border-b border-border font-semibold">Table</th>
                  <th className="text-left p-3 border-b border-border font-semibold">Primary FHIR Resource</th>
                  <th className="text-left p-3 border-b border-border font-semibold">Key Columns</th>
                  <th className="text-left p-3 border-b border-border font-semibold">Notes</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-border">
                  <td className="p-3 font-mono text-xs">hospitals</td>
                  <td className="p-3 font-mono text-xs">Organization</td>
                  <td className="p-3 text-xs">id, name, code, emr_system</td>
                  <td className="p-3 text-xs">Maps to InterSystems tenant</td>
                </tr>
                <tr className="border-b border-border">
                  <td className="p-3 font-mono text-xs">patients</td>
                  <td className="p-3 font-mono text-xs">Patient</td>
                  <td className="p-3 text-xs">id, mrn, name, sex, age, hospital_id</td>
                  <td className="p-3 text-xs">Scoped by hospital_id</td>
                </tr>
                <tr className="border-b border-border">
                  <td className="p-3 font-mono text-xs">encounters</td>
                  <td className="p-3 font-mono text-xs">Encounter</td>
                  <td className="p-3 text-xs">id, patient_id, status, encounter_type, room_number</td>
                  <td className="p-3 text-xs">Supports inpatient + outpatient</td>
                </tr>
                <tr className="border-b border-border">
                  <td className="p-3 font-mono text-xs">patient_vitals</td>
                  <td className="p-3 font-mono text-xs">Observation (vital-signs)</td>
                  <td className="p-3 text-xs">patient_id, trends (JSONB), insights (JSONB)</td>
                  <td className="p-3 text-xs">Aggregated vitals with AI insights</td>
                </tr>
                <tr className="border-b border-border">
                  <td className="p-3 font-mono text-xs">patient_medications</td>
                  <td className="p-3 font-mono text-xs">MedicationRequest</td>
                  <td className="p-3 text-xs">patient_id, name, dose, frequency, status</td>
                  <td className="p-3 text-xs">Active medication list</td>
                </tr>
                <tr className="border-b border-border">
                  <td className="p-3 font-mono text-xs">prescriptions</td>
                  <td className="p-3 font-mono text-xs">MedicationRequest</td>
                  <td className="p-3 text-xs">patient_id, medication_name, sig, quantity, refills</td>
                  <td className="p-3 text-xs">New prescriptions for write-back</td>
                </tr>
                <tr className="border-b border-border">
                  <td className="p-3 font-mono text-xs">staged_orders</td>
                  <td className="p-3 font-mono text-xs">ServiceRequest</td>
                  <td className="p-3 text-xs">patient_id, order_type, order_data (JSONB), status</td>
                  <td className="p-3 text-xs">AI-staged, physician-approved</td>
                </tr>
                <tr className="border-b border-border">
                  <td className="p-3 font-mono text-xs">clinical_notes</td>
                  <td className="p-3 font-mono text-xs">DocumentReference</td>
                  <td className="p-3 text-xs">patient_id, note_type, content (JSONB), status</td>
                  <td className="p-3 text-xs">SOAP notes, consult notes</td>
                </tr>
                <tr className="border-b border-border">
                  <td className="p-3 font-mono text-xs">patient_allergies</td>
                  <td className="p-3 font-mono text-xs">AllergyIntolerance</td>
                  <td className="p-3 text-xs">patient_id, allergen, reaction, severity</td>
                  <td className="p-3 text-xs">Read-only from EMR</td>
                </tr>
                <tr className="border-b border-border">
                  <td className="p-3 font-mono text-xs">patient_problems</td>
                  <td className="p-3 font-mono text-xs">Condition</td>
                  <td className="p-3 text-xs">patient_id, description, icd10_code, status</td>
                  <td className="p-3 text-xs">Active problem list</td>
                </tr>
                <tr className="border-b border-border">
                  <td className="p-3 font-mono text-xs">imaging_studies</td>
                  <td className="p-3 font-mono text-xs">ImagingStudy</td>
                  <td className="p-3 text-xs">patient_id, study_type, modality, status</td>
                  <td className="p-3 text-xs">Radiology studies</td>
                </tr>
                <tr className="border-b border-border">
                  <td className="p-3 font-mono text-xs">immunizations</td>
                  <td className="p-3 font-mono text-xs">Immunization</td>
                  <td className="p-3 text-xs">patient_id, vaccine_name, cvx_code, administered_date</td>
                  <td className="p-3 text-xs">Vaccine history</td>
                </tr>
                <tr>
                  <td className="p-3 font-mono text-xs">billing_events</td>
                  <td className="p-3 font-mono text-xs">Claim (future)</td>
                  <td className="p-3 text-xs">patient_id, cpt_codes, icd10_codes, status</td>
                  <td className="p-3 text-xs">Auto-captured billing codes</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* Section 10 */}
        <section id="security" className="mb-12 print:mb-8 print:break-before-page">
          <h2 className="text-2xl font-bold mb-4 border-b border-border pb-2">10. Security & Compliance</h2>

          <h3 className="text-lg font-semibold mb-3">10.1 HIPAA Compliance</h3>
          <ul className="list-disc list-inside space-y-2 mb-6 text-sm">
            <li>All data in transit encrypted via TLS 1.3</li>
            <li>All data at rest encrypted (AES-256) in Virtualis database</li>
            <li>PHI never stored in client-side storage (localStorage, cookies)</li>
            <li>Session tokens are short-lived (5 min SMART tokens, 60 min user sessions)</li>
            <li>Automatic session termination after 15 minutes of inactivity</li>
            <li>BAA (Business Associate Agreement) required between Virtualis ↔ InterSystems</li>
          </ul>

          <h3 className="text-lg font-semibold mb-3">10.2 Row-Level Security (RLS)</h3>
          <p className="mb-3 text-sm">
            All Virtualis database tables enforce Row-Level Security policies ensuring:
          </p>
          <ul className="list-disc list-inside space-y-2 mb-6 text-sm">
            <li>Physicians can only access patients at facilities they are credentialed at</li>
            <li>Hospital-scoped data isolation — <code className="bg-muted px-1 rounded font-mono text-xs">hospital_id</code> filtering on all queries</li>
            <li>Role-based access: admin, physician, consultant roles with distinct permissions</li>
            <li>All data mutations require authenticated user context</li>
          </ul>

          <h3 className="text-lg font-semibold mb-3">10.3 Audit Logging</h3>
          <p className="mb-3 text-sm">
            Every data access and mutation is logged in the <code className="bg-muted px-1 rounded font-mono text-xs">audit_logs</code> table:
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border border-border">
              <thead>
                <tr className="bg-muted">
                  <th className="text-left p-3 border-b border-border font-semibold">Field</th>
                  <th className="text-left p-3 border-b border-border font-semibold">Description</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-border">
                  <td className="p-3 font-mono text-xs">user_id</td>
                  <td className="p-3">Authenticated physician</td>
                </tr>
                <tr className="border-b border-border">
                  <td className="p-3 font-mono text-xs">action_type</td>
                  <td className="p-3">view, create, update, delete, export, login, logout</td>
                </tr>
                <tr className="border-b border-border">
                  <td className="p-3 font-mono text-xs">resource_type</td>
                  <td className="p-3">patient, order, note, prescription, etc.</td>
                </tr>
                <tr className="border-b border-border">
                  <td className="p-3 font-mono text-xs">patient_id</td>
                  <td className="p-3">Patient context (if applicable)</td>
                </tr>
                <tr className="border-b border-border">
                  <td className="p-3 font-mono text-xs">hospital_id</td>
                  <td className="p-3">Facility context</td>
                </tr>
                <tr className="border-b border-border">
                  <td className="p-3 font-mono text-xs">ip_address</td>
                  <td className="p-3">Client IP for forensic tracing</td>
                </tr>
                <tr>
                  <td className="p-3 font-mono text-xs">metadata</td>
                  <td className="p-3">Additional context (JSONB)</td>
                </tr>
              </tbody>
            </table>
          </div>

          <h3 className="text-lg font-semibold mt-6 mb-3">10.4 InterSystems Security Requirements</h3>
          <ul className="list-disc list-inside space-y-2 text-sm">
            <li>Mutual TLS (mTLS) for server-to-server communication</li>
            <li>HMAC-SHA256 webhook signature validation</li>
            <li>IP whitelisting for Virtualis Edge Function egress IPs</li>
            <li>Separate client credentials per facility (no shared secrets)</li>
            <li>Token refresh must not require user interaction</li>
            <li>Audit trail of all FHIR operations accessible to Virtualis for compliance reporting</li>
          </ul>
        </section>

        {/* Footer */}
        <footer className="border-t-2 border-primary pt-6 mt-12 print:mt-8">
          <div className="flex justify-between items-center text-sm text-muted-foreground">
            <div>
              <p className="font-semibold text-foreground">Virtualis Health Technologies</p>
              <p>Confidential — For InterSystems Discussion Only</p>
            </div>
            <div className="text-right">
              <p>Document Version 1.0</p>
              <p>{new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
            </div>
          </div>
        </footer>
      </div>

      {/* Print styles */}
      <style>{`
        @media print {
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          @page { margin: 1in 0.75in; size: letter; }
          pre { white-space: pre-wrap !important; word-break: break-all; }
          table { font-size: 10px; }
          h2 { page-break-after: avoid; }
          section { page-break-inside: avoid; }
        }
      `}</style>
    </div>
  );
};

export default IntegrationSpec;
