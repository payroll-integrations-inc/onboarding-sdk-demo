import { api, HttpError } from "./api";
import { onboardingDivision, onboardingPlan, planRecordkeeper, requireIds, showRecordkeeperSelection, state, updatePlanDivisionIds, billingComplete } from "./state";
import type { OnboardingStep, OnboardingUpdateDivision, PayrollPlatformForOnboarding } from "../mock/types";

/**
 * Onboarding flow logic, ported from pi/onboarding-ui:
 *  - `nextView`                    onboarding-start.component.ts (resume routing)
 *  - `submitPayrollPlatformStep`   shared/services/onboarding.service.ts
 *  - `routeAfterStep`              onboarding-connect-payroll-platform.component.ts `submitForm`
 *  - `getErrorText`                shared/services/onboarding.service.ts
 */

export type StepResult =
  | { type: "next" }
  | { type: "externalRedirect"; url: string }
  | { type: "verificationFailed"; error: string };

export const FAILED_VERIFICATION_REDIRECT = "failedVerificationRedirect";

export async function refreshOnboardingUser(): Promise<void> {
  state.onboardingUser = await api.getCurrentOnboardingUser();
  updatePlanDivisionIds(state.onboardingPlanId, state.onboardingDivisionId);
}

export async function start(token: string, plan?: string): Promise<void> {
  const exchange = await api.startOnboarding(token);
  state.onboardingUser = await api.getCurrentOnboardingUser();
  updatePlanDivisionIds(plan ?? exchange.onboardingPlanId ?? undefined);
  state.recordKeepers ??= await api.getRecordKeepers();
}

/** Used by guarded routes when the frame was reloaded mid-flow: the session "cookie" still works. */
export async function resume(): Promise<void> {
  if (!state.onboardingUser) {
    state.onboardingUser = await api.getCurrentOnboardingUser();
    updatePlanDivisionIds();
  }
  state.recordKeepers ??= await api.getRecordKeepers();
}

/** Where the start screen sends the user after Connect, based on how far this division got. */
export function nextView(): { path: string; query?: Record<string, string> } {
  const plan = onboardingPlan();
  const division = onboardingDivision();
  if (!plan || !division) {
    return { path: "error", query: { reason: "No onboarding in progress. Please contact your recordkeeper." } };
  }
  if (division.divisionId !== null && division.connectionStatus !== "COMPLETE" && division.divisionInfo.payrollPlatformName) {
    return { path: `connect-payroll-platform/${division.divisionInfo.payrollPlatformName}/steps` };
  }
  if (division.divisionId !== null && division.connectionStatus === "COMPLETE" && !billingComplete(division.billingStatus)) {
    return { path: "billing" };
  }
  if (division.connectionStatus === "COMPLETE" && billingComplete(division.billingStatus) && plan.complete !== true) {
    return { path: "more-divisions" };
  }
  if (showRecordkeeperSelection()) return { path: "select-record-keeper" };
  return { path: "confirm-record-keeper" };
}

/** After the recordkeeper is confirmed: pre-selected platform skips the picker. */
export function viewAfterRecordkeeper(): string {
  const platform = onboardingPlan()?.payrollPlatformName;
  return platform ? `connect-payroll-platform/${platform}/steps` : "select-payroll-platform";
}

export async function loadPayrollPlatforms(): Promise<PayrollPlatformForOnboarding[]> {
  if (!state.payrollPlatforms) {
    const planId = state.onboardingPlanId ?? "";
    const platforms = await api.getPayrollPlatforms(planId);
    state.payrollPlatforms = platforms.sort((a, b) => {
      if (a.preferredPriority !== undefined && b.preferredPriority !== undefined) return a.preferredPriority - b.preferredPriority;
      if (a.preferredPriority !== undefined) return -1;
      if (b.preferredPriority !== undefined) return 1;
      return a.displayName.localeCompare(b.displayName);
    });
  }
  return state.payrollPlatforms;
}

export async function loadPayrollPlatform(name: string): Promise<PayrollPlatformForOnboarding | undefined> {
  const platform = (await loadPayrollPlatforms()).find((p) => p.name === name);
  if (platform && platform.steps.length === 0) {
    platform.steps = await api.getPayrollPlatformSteps(name, state.onboardingPlanId ?? "");
  }
  return platform;
}

/** Sets a dotted key path (`divisionInfo.payrollPlatformCompanyDisplayId`) on a nested object. */
export function setPath(target: Record<string, unknown>, path: string, value: unknown): void {
  const keys = path.split(".");
  let cursor = target;
  for (const key of keys.slice(0, -1)) {
    cursor = (cursor[key] ??= {}) as Record<string, unknown>;
  }
  cursor[keys[keys.length - 1]!] = value;
}

export function getPath(source: Record<string, unknown> | undefined, path: string): unknown {
  return path.split(".").reduce<unknown>((cursor, key) => (cursor as Record<string, unknown> | undefined)?.[key], source);
}

async function submitUpdateStep(platform: PayrollPlatformForOnboarding, step: OnboardingStep, formData: Record<string, unknown>): Promise<void> {
  const patch: Record<string, unknown> = {};
  if (step.type === undefined || step.type === "form") {
    for (const field of step.fields) {
      if ("key" in field && field.key && field.id in formData) setPath(patch, field.key, formData[field.id]);
    }
  }
  setPath(patch, "divisionInfo.payrollPlatformName", platform.name);
  setPath(patch, "divisionInfo.activationDate", new Date().toISOString().slice(0, 10));
  await api.updateOnboardingDivision(requireIds(), patch as OnboardingUpdateDivision);
  await refreshOnboardingUser();
}

export async function submitPayrollPlatformStep(platform: PayrollPlatformForOnboarding, stepNumber: number, formData: Record<string, unknown>): Promise<StepResult> {
  const step = platform.steps[stepNumber - 1];
  if (!step) throw new Error(`Step ${stepNumber} does not exist for ${platform.name}.`);
  const ids = requireIds();

  for (const action of step.actions) {
    switch (action.type) {
      case "update":
        await submitUpdateStep(platform, step, formData);
        break;
      case "create-integration": {
        const result = await api.createIntegration(ids);
        await refreshOnboardingUser();
        if ("redirectURI" in result) return { type: "externalRedirect", url: result.redirectURI };
        break;
      }
      case "create-division": {
        const result = await api.createDivision(ids);
        if (typeof result === "object" && "redirectURI" in result) return { type: "externalRedirect", url: result.redirectURI };
        if (typeof result === "object") {
          state.onboardingUser = result;
          updatePlanDivisionIds(state.onboardingPlanId, state.onboardingDivisionId);
        }
        break;
      }
      case "verify-division": {
        const verification = await api.verifyOnboardingDivision(ids);
        const failed = !verification.accessGranted || Boolean(verification.error);
        if (failed && !action.ignoreVerificationFailure) {
          return { type: "verificationFailed", error: verification.error ?? "Something went wrong when verifying your integration." };
        }
        await refreshOnboardingUser();
        break;
      }
      default:
        throw new Error(`The demo does not implement the "${action.type}" step action.`);
    }
  }
  return { type: "next" };
}

export async function setDivisionConnectionStatus(connectionStatus: "IN_PROGRESS" | "COMPLETE"): Promise<void> {
  await api.updateOnboardingDivision(requireIds(), { connectionStatus });
  await refreshOnboardingUser();
}

export async function finalizeDivisionOnboarding(): Promise<void> {
  state.onboardingUser = await api.completeOnboardingDivision(requireIds());
  updatePlanDivisionIds(state.onboardingPlanId, state.onboardingDivisionId);
}

/** Post-step routing from the connect component's `submitForm`. Returns the next hash path. */
export async function routeAfterStep(platform: PayrollPlatformForOnboarding, stepNumber: number): Promise<string> {
  const isLastStep = stepNumber === platform.steps.length;
  if (!isLastStep) {
    if (onboardingDivision()?.connectionStatus !== "IN_PROGRESS") await setDivisionConnectionStatus("IN_PROGRESS");
    return `connect-payroll-platform/${platform.name}/steps/${stepNumber + 1}`;
  }
  await setDivisionConnectionStatus("COMPLETE");
  const recordkeeper = planRecordkeeper();
  if (!platform.skipStripe && recordkeeper?.stripeEnabled && onboardingPlan()?.product !== "TPA") {
    return "billing";
  }
  await finalizeDivisionOnboarding();
  return "more-divisions";
}

/** 1-based step to return to after a failed verification. */
export function redirectStep(platform: PayrollPlatformForOnboarding): number {
  const index = platform.steps.findIndex((s) => s.redirectId === FAILED_VERIFICATION_REDIRECT);
  return index === -1 ? 1 : index + 1;
}

/**
 * 1-based step to resume at when the route has no explicit step (port of payroll-platform-step.guard.ts):
 * once the division record exists, the user is past every step up to and including the one that created it.
 */
export function resumeStep(platform: PayrollPlatformForOnboarding): number {
  const division = onboardingDivision();
  if (!division || division.divisionId === null) return 1;
  const createIndex = platform.steps.findIndex((s) => s.actions.some((a) => a.type === "create-division"));
  if (createIndex === -1) return 1;
  return Math.min(createIndex + 2, platform.steps.length);
}

export function getErrorText(reason: string | null | undefined): string | null {
  switch (reason) {
    case "PAYROLL_PLATFORM_COULD_NOT_CONNECT":
      return "Could not connect to the payroll platform.";
    case "TOKEN_VALIDATION_FAILED":
      return "Token validation failed.";
    case "TERMS_NOT_ACCEPTED":
      return "Terms and conditions not accepted.";
    case "BILLING_ALREADY_COMPLETE":
      return "Billing has already been completed for this division. If you believe this is in error, please contact your recordkeeper.";
    case "NO_ACTIVE_ONBOARDING":
      return "This onboarding was already completed. If you believe this is in error, please contact your recordkeeper.";
    case "INVALID_COMPANY_IDENTIFIER":
      return "The plan identifier is invalid.";
    default:
      return null;
  }
}

/** Human text for any thrown error, preferring the API's known reasons. */
export function errorMessage(error: unknown): string {
  if (error instanceof HttpError) {
    return getErrorText(error.reason) ?? error.body?.message ?? error.message;
  }
  return error instanceof Error ? error.message : "An unknown error occurred.";
}
