/**
 * Deployment mode controls which surfaces of the EMR are exposed.
 * - `ambulatory`: single-clinic primary-care mode (6-week launch target).
 * - `inpatient` : full hospital build (multi-hospital selector, census, quality, consults).
 *
 * Switch via VITE_DEPLOYMENT_MODE at build time. Defaults to ambulatory.
 */
export type DeploymentMode = 'ambulatory' | 'inpatient';

export const DEPLOYMENT_MODE: DeploymentMode =
  (import.meta.env.VITE_DEPLOYMENT_MODE as DeploymentMode) ?? 'ambulatory';

export const isAmbulatory = DEPLOYMENT_MODE === 'ambulatory';
export const isInpatient = DEPLOYMENT_MODE === 'inpatient';
