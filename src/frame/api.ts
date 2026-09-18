import { isApiErrorBody } from "../mock/errors";
import { API_BASE, mockFetch } from "../mock/mock-fetch";
import type {
  ConfirmBillingResponse,
  ListPaycodesResponse,
  OnboardingAggregate,
  OnboardingAggregateDivision,
  OnboardingApiErrorBody,
  OnboardingCreateDivisionResponse,
  OnboardingStep,
  OnboardingTokenExchangeResponse,
  OnboardingUpdateDivision,
  OnboardingUpdatePlan,
  PayrollPlatformForOnboarding,
  RecordKeeperForOnboarding,
  StartSubscriptionCheckoutResponse,
} from "../mock/types";

/**
 * Typed client mirroring pi/onboarding-ui/src/app/shared/services/onboarding-api.service.ts,
 * method for method. The only difference from production is the transport: `mockFetch`
 * instead of Angular's HttpClient against `environment.apiUrl`.
 */

export class HttpError extends Error {
  readonly status: number;
  readonly body: OnboardingApiErrorBody | undefined;

  constructor(status: number, body: OnboardingApiErrorBody | undefined) {
    super(body?.message ?? `Request failed with status ${status}`);
    this.name = "HttpError";
    this.status = status;
    this.body = body;
  }

  get reason(): string | undefined {
    return this.body?.reason;
  }
}

export interface DivisionIds {
  onboardingUserId: string;
  onboardingPlanId: string;
  onboardingDivisionId: string;
}

async function request<T>(method: string, path: string, options: { query?: Record<string, string>; body?: unknown } = {}): Promise<T> {
  const search = options.query ? `?${new URLSearchParams(options.query)}` : "";
  const response = await mockFetch(`${API_BASE}${path}${search}`, {
    method,
    headers: { "content-type": "application/json", "x-correlation-id": crypto.randomUUID() },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
  const text = await response.text();
  const payload: unknown = text ? JSON.parse(text) : undefined;
  if (!response.ok) {
    throw new HttpError(response.status, isApiErrorBody(payload) ? payload : undefined);
  }
  return payload as T;
}

const divisionPath = ({ onboardingUserId, onboardingPlanId, onboardingDivisionId }: DivisionIds) =>
  `onboarding/users/${onboardingUserId}/plans/${onboardingPlanId}/divisions/${onboardingDivisionId}`;

export const api = {
  startOnboarding: (token: string) => request<OnboardingTokenExchangeResponse>("POST", "onboarding/exchange", { query: { token } }),
  acceptTerms: (onboardingUserId: string) => request<void>("POST", `onboarding/users/${onboardingUserId}/accept-terms`, { query: { version: "2" } }),
  getCurrentOnboardingUser: () => request<OnboardingAggregate>("GET", "onboarding/me"),
  updateOnboardingUser: (onboardingUserId: string, patch: { lastPageViewed: string | null }) =>
    request<void>("PATCH", `onboarding/users/${onboardingUserId}`, { body: patch }),

  getRecordKeepers: () => request<RecordKeeperForOnboarding[]>("GET", "onboarding/record-keepers"),
  getPayrollPlatforms: (onboardingPlanId: string) =>
    request<PayrollPlatformForOnboarding[]>("GET", "onboarding/payroll-platforms", { query: { onboardingPlanId } }),
  getPayrollPlatformSteps: (payrollPlatformName: string, onboardingPlanId: string) =>
    request<OnboardingStep[]>("GET", "onboarding/payroll-platforms/steps", { query: { payrollPlatformName, onboardingPlanId } }),

  updateOnboardingPlan: (onboardingUserId: string, onboardingPlanId: string, patch: OnboardingUpdatePlan) =>
    request<void>("PATCH", `onboarding/users/${onboardingUserId}/plans/${onboardingPlanId}`, { body: patch }),
  endOnboardingPlan: (onboardingUserId: string, onboardingPlanId: string) =>
    request<void>("POST", `onboarding/users/${onboardingUserId}/plans/${onboardingPlanId}/end`),

  createOnboardingDivision: (onboardingUserId: string, onboardingPlanId: string) =>
    request<OnboardingAggregateDivision>("POST", `onboarding/users/${onboardingUserId}/plans/${onboardingPlanId}/divisions`),
  updateOnboardingDivision: (ids: DivisionIds, patch: OnboardingUpdateDivision) =>
    request<OnboardingAggregateDivision>("PATCH", divisionPath(ids), { body: patch }),
  createIntegration: (ids: DivisionIds) => request<{ id: string; status: string } | { redirectURI: string }>("PUT", `${divisionPath(ids)}/create-integration`),
  createDivision: (ids: DivisionIds) => request<OnboardingCreateDivisionResponse>("PUT", `${divisionPath(ids)}/create-division`),
  verifyOnboardingDivision: (ids: DivisionIds) => request<ListPaycodesResponse>("POST", `${divisionPath(ids)}/verify`),
  /** Demo-only: report the OAuth popup result (the popup runs in another window and cannot touch the frame's state). */
  authorizeOAuth: (ids: DivisionIds, code: string) => request<void>("POST", `${divisionPath(ids)}/oauth-authorize`, { body: { code } }),
  completeOnboardingDivision: (ids: DivisionIds) => request<OnboardingAggregate>("PUT", `${divisionPath(ids)}/complete`),

  getBilling: (divisionId: string) => request<StartSubscriptionCheckoutResponse>("GET", "onboarding/billing", { query: { divisionId } }),
  confirmBilling: (divisionId: string, paymentMethodId: string) =>
    request<ConfirmBillingResponse>("POST", "onboarding/billing", { query: { divisionId, paymentMethodId } }),
};
