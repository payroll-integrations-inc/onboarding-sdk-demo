import type {
  BillingStatus,
  OnboardingAggregate,
  OnboardingAggregateDivision,
  OnboardingAggregatePlan,
  PayrollPlatformForOnboarding,
  RecordKeeperForOnboarding,
} from "../mock/types";
import type { DivisionIds } from "./api";

/**
 * Frame state, a plain-object port of
 * pi/onboarding-ui/src/app/shared/services/onboarding-state.service.ts and the
 * plan/division selection in onboarding.service.ts (`updatePlanDivisionIds`).
 */
export interface FrameState {
  /** Token received from the SDK (or `?token=` when the frame is opened directly). */
  token?: string;
  /** Origin of the page hosting the SDK; every outbound message targets exactly this. */
  frameOrigin?: string;
  onboardingUser?: OnboardingAggregate;
  onboardingPlanId?: string;
  onboardingDivisionId?: string;
  recordKeepers?: RecordKeeperForOnboarding[];
  payrollPlatforms?: PayrollPlatformForOnboarding[];
  /** Step-provided values merged over the current division for `dynamic: true` fields. */
  dynamic: Record<string, unknown>;
}

export const state: FrameState = { dynamic: {} };

const COMPLETE_BILLING_STATUSES: (BillingStatus | undefined)[] = ["ACTIVE", "LEGACY"];

export function resetState(): void {
  for (const key of Object.keys(state) as (keyof FrameState)[]) delete state[key];
  state.dynamic = {};
}

export const onboardingPlan = (): OnboardingAggregatePlan | undefined =>
  state.onboardingPlanId ? state.onboardingUser?.plans.find((p) => p.id === state.onboardingPlanId) : undefined;

export const onboardingDivision = (): OnboardingAggregateDivision | undefined =>
  state.onboardingDivisionId ? onboardingPlan()?.divisions.find((d) => d.id === state.onboardingDivisionId) : undefined;

export const planRecordkeeper = (): RecordKeeperForOnboarding | undefined => {
  const id = onboardingPlan()?.recordKeeperId;
  return id ? state.recordKeepers?.find((rk) => rk.id === id) : undefined;
};

/** Whether the user can currently navigate to recordkeeper selection. */
export function showRecordkeeperSelection(): boolean {
  const plan = onboardingPlan();
  const userSelectRecordKeeper = Boolean(plan?.userSelectRecordKeeper ?? false);
  const hasRecordkeeper = plan?.recordKeeperId !== undefined && plan?.recordKeeperId !== null;
  const hasPlanSponsor = plan?.planSponsorId !== undefined && plan?.planSponsorId !== null;
  return (userSelectRecordKeeper || !hasRecordkeeper) && !hasPlanSponsor;
}

export function dynamicData(): Record<string, unknown> {
  return { ...state.dynamic, ...(onboardingDivision() as Record<string, unknown> | undefined) };
}

export function billingComplete(status: BillingStatus | undefined): boolean {
  return COMPLETE_BILLING_STATUSES.includes(status);
}

export function divisionIsComplete(division: OnboardingAggregateDivision): boolean {
  return division.divisionId !== null && division.connectionStatus === "COMPLETE" && billingComplete(division.billingStatus);
}

export function ids(): DivisionIds | undefined {
  const onboardingUserId = state.onboardingUser?.id;
  if (!onboardingUserId || !state.onboardingPlanId || !state.onboardingDivisionId) return undefined;
  return { onboardingUserId, onboardingPlanId: state.onboardingPlanId, onboardingDivisionId: state.onboardingDivisionId };
}

export function requireIds(): DivisionIds {
  const current = ids();
  if (!current) throw new Error("Plan ID, division ID, and onboarding user ID are required.");
  return current;
}

/** Pick the active plan and division, preferring explicit ids, then the most recent incomplete ones. */
export function updatePlanDivisionIds(onboardingPlanId?: string, onboardingDivisionId?: string): void {
  const user = state.onboardingUser;
  if (!user) {
    state.onboardingPlanId = undefined;
    state.onboardingDivisionId = undefined;
    return;
  }
  // An explicitly requested plan stays selected even once it is marked complete: the
  // more-divisions and end screens still need to show it (and report its plan sponsor id).
  const requestedPlan = onboardingPlanId ? user.plans.find((p) => p.id === onboardingPlanId) : undefined;
  if (requestedPlan) {
    state.onboardingPlanId = requestedPlan.id;
  } else {
    state.onboardingPlanId = user.plans.findLast((p) => !p.complete && p.divisions.length > 0)?.id;
  }

  const plan = onboardingPlan();
  const requestedDivision = onboardingDivisionId ? plan?.divisions.find((d) => d.id === onboardingDivisionId) : undefined;
  // First incomplete division; when all are complete keep the last one so the
  // more-divisions / end screens still have a division to describe.
  state.onboardingDivisionId = requestedDivision ? requestedDivision.id : (plan?.divisions.find((d) => !divisionIsComplete(d)) ?? plan?.divisions.at(-1))?.id;
}
