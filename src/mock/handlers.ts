import { flagsFor, getDb, nextId } from "./db";
import { ApiError } from "./errors";
import { DEMO_PLAN_ID, FOUND_PAY_CODES, PAYROLL_PLATFORMS, PLATFORM_BEHAVIOR, RECORD_KEEPERS, seedAggregate } from "./fixtures";
import { Router, type RequestContext } from "./router";
import {
  OnboardingApiErrorReason as Reason,
  type ConfirmBillingResponse,
  type ListPaycodesResponse,
  type OnboardingAggregate,
  type OnboardingAggregateDivision,
  type OnboardingAggregatePlan,
  type OnboardingCreateDivisionResponse,
  type OnboardingTokenExchangeResponse,
  type OnboardingUpdateDivision,
  type OnboardingUpdatePlan,
  type StartSubscriptionCheckoutResponse,
} from "./types";
import { decodeDemoToken } from "../shared/token";

/**
 * Emulation of pi-api's public-api-onboarding resources, keyed by the same
 * method + path the real frame calls (pi/onboarding-ui/.../onboarding-api.service.ts).
 *
 * Demo levers (all documented on the host page):
 *  - token scenario `bad-token`     -> exchange returns 401 TOKEN_VALIDATION_FAILED
 *  - token scenario `connect-fail`  -> create-division returns 400 PAYROLL_PLATFORM_COULD_NOT_CONNECT
 *  - Acme company id `FAIL0000` or API key `fail` -> same connection failure
 *  - card number 4000 0000 0000 0002 -> billing confirmation returns { status: false }
 */
export const router = new Router();

const COMPANY_IDENTIFIER_PATTERN = /^[A-Za-z0-9-]{3,}$/;
const DECLINED_PAYMENT_METHOD = "pm_card_declined";

const nowIso = () => new Date().toISOString();

function requireSession(): { user: OnboardingAggregate; scenario: string } {
  const db = getDb();
  const session = db.session;
  const user = session ? db.users[session.onboardingUserId] : undefined;
  if (!session || !user) {
    throw new ApiError(401, Reason.TokenValidation, "No onboarding session. Exchange a token first.");
  }
  return { user, scenario: session.scenario };
}

function requireUser(uid: string): OnboardingAggregate {
  const user = getDb().users[uid];
  if (!user) throw new ApiError(404, Reason.UserNotFound, `Onboarding user ${uid} not found.`);
  return user;
}

function requirePlan(user: OnboardingAggregate, pid: string): OnboardingAggregatePlan {
  const plan = user.plans.find((p) => p.id === pid);
  if (!plan) throw new ApiError(404, Reason.PlanSponsorNotFound, `Onboarding plan ${pid} not found.`);
  return plan;
}

function requireDivision(plan: OnboardingAggregatePlan, did: string): OnboardingAggregateDivision {
  const division = plan.divisions.find((d) => d.id === did);
  if (!division) throw new ApiError(404, Reason.DivisionNotFound, `Onboarding division ${did} not found.`);
  return division;
}

function locate(ctx: RequestContext) {
  const user = requireUser(ctx.params.uid!);
  const plan = requirePlan(user, ctx.params.pid!);
  return { user, plan };
}

function locateDivision(ctx: RequestContext) {
  const { user, plan } = locate(ctx);
  const division = requireDivision(plan, ctx.params.did!);
  return { user, plan, division };
}

function findDivisionById(divisionId: string): { plan: OnboardingAggregatePlan; division: OnboardingAggregateDivision } {
  for (const user of Object.values(getDb().users)) {
    for (const plan of user.plans) {
      const division = plan.divisions.find((d) => d.divisionId === divisionId || d.id === divisionId);
      if (division) return { plan, division };
    }
  }
  throw new ApiError(404, Reason.DivisionNotFound, `Division ${divisionId} not found.`);
}

function touch(...records: { updatedAt: string }[]) {
  const stamp = nowIso();
  for (const record of records) record.updatedAt = stamp;
}

function body<T>(ctx: RequestContext): T {
  return (ctx.body ?? {}) as T;
}

// ----- Session -----

router.add("POST", "onboarding/exchange", (ctx) => {
  const token = ctx.query.get("token");
  const payload = decodeDemoToken(token);
  if (!payload || payload.scenario === "bad-token") {
    throw new ApiError(401, Reason.TokenValidation, "The onboarding token could not be validated.");
  }
  const db = getDb();
  const user = (db.users[payload.onboardingUserId] ??= seedAggregate(payload.onboardingUserId, payload.scenario, nowIso()));
  const plan = user.plans.find((p) => p.id === `${payload.plan}`) ?? user.plans[0];
  if (plan?.complete) {
    throw new ApiError(400, Reason.NoActiveOnboarding, "This onboarding was already completed.");
  }
  db.session = { onboardingUserId: user.id, scenario: payload.scenario };
  const response: OnboardingTokenExchangeResponse = { onboardingUserId: user.id, onboardingPlanId: plan?.id ?? DEMO_PLAN_ID };
  return { body: response };
});

router.add("POST", "onboarding/users/:uid/accept-terms", (ctx) => {
  const user = requireUser(ctx.params.uid!);
  user.userInfo.acceptedTermsOfServiceVersion = Number(ctx.query.get("version") ?? 2);
  touch(user);
  return { status: 204 };
});

router.add("GET", "onboarding/me", () => {
  const { user } = requireSession();
  return { body: structuredClone(user) };
});

router.add("PATCH", "onboarding/users/:uid", (ctx) => {
  const user = requireUser(ctx.params.uid!);
  const patch = body<{ lastPageViewed?: string | null }>(ctx);
  if (patch.lastPageViewed !== undefined) user.lastPageViewed = patch.lastPageViewed;
  touch(user);
  return { status: 204 };
});

// ----- Catalogue -----

router.add("GET", "onboarding/record-keepers", () => ({ body: RECORD_KEEPERS.filter((rk) => !rk.hidden) }));

router.add("GET", "onboarding/payroll-platforms", () => ({
  // The list endpoint omits steps, exactly like pi-api's shared.ts:33; steps come from the endpoint below.
  body: PAYROLL_PLATFORMS.map((platform) => ({ ...platform, steps: [] })),
}));

router.add("GET", "onboarding/payroll-platforms/steps", (ctx) => {
  const name = ctx.query.get("payrollPlatformName");
  const platform = PAYROLL_PLATFORMS.find((p) => p.name === name);
  if (!platform) throw new ApiError(404, Reason.BadRequest, `Unknown payroll platform ${name}.`);
  return { body: structuredClone(platform.steps) };
});

// ----- Plan -----

router.add("PATCH", "onboarding/users/:uid/plans/:pid", (ctx) => {
  const { user, plan } = locate(ctx);
  const patch = body<OnboardingUpdatePlan>(ctx);
  if (patch.recordKeeperCompanyIdentifier !== undefined && patch.recordKeeperCompanyIdentifier !== null) {
    if (!COMPANY_IDENTIFIER_PATTERN.test(patch.recordKeeperCompanyIdentifier)) {
      throw new ApiError(400, Reason.InvalidCompanyIdentifier, "The recordkeeper company identifier is invalid.");
    }
    plan.recordKeeperCompanyIdentifier = patch.recordKeeperCompanyIdentifier;
  }
  if (patch.recordKeeperId !== undefined) plan.recordKeeperId = patch.recordKeeperId;
  if (patch.payrollPlatformName !== undefined) plan.payrollPlatformName = patch.payrollPlatformName;
  if (patch.complete !== undefined) plan.complete = patch.complete;
  touch(user, plan);
  return { status: 204 };
});

router.add("POST", "onboarding/users/:uid/plans/:pid/end", (ctx) => {
  const { user, plan } = locate(ctx);
  plan.complete = true;
  touch(user, plan);
  return { status: 204 };
});

// ----- Divisions -----

router.add("POST", "onboarding/users/:uid/plans/:pid/divisions", (ctx) => {
  const { user, plan } = locate(ctx);
  const stamp = nowIso();
  const division: OnboardingAggregateDivision = {
    id: nextId("10"),
    onboardingPlanId: plan.id,
    divisionId: null,
    payrollPlatformIntegrationId: null,
    divisionInfo: {},
    contacts: [],
    connectionStatus: "NOT_STARTED",
    createdAt: stamp,
    updatedAt: stamp,
  };
  plan.divisions.push(division);
  touch(user, plan);
  return { body: structuredClone(division) };
});

router.add("PATCH", "onboarding/users/:uid/plans/:pid/divisions/:did", (ctx) => {
  const { user, plan, division } = locateDivision(ctx);
  const patch = body<OnboardingUpdateDivision>(ctx);
  if (patch.divisionInfo) division.divisionInfo = { ...division.divisionInfo, ...patch.divisionInfo };
  if (patch.connectionStatus) division.connectionStatus = patch.connectionStatus;
  if (patch.contacts) division.contacts = [...patch.contacts];
  if (patch.divisionId !== undefined) division.divisionId = patch.divisionId;
  if (patch.payrollPlatformIntegrationId !== undefined) division.payrollPlatformIntegrationId = patch.payrollPlatformIntegrationId;
  touch(user, plan, division);
  return { body: structuredClone(division) };
});

router.add("PUT", "onboarding/users/:uid/plans/:pid/divisions/:did/create-integration", (ctx) => {
  const { user, plan, division } = locateDivision(ctx);
  division.payrollPlatformIntegrationId ??= nextId("90");
  touch(user, plan, division);
  return { body: { id: division.payrollPlatformIntegrationId, status: "CONNECTED" } };
});

router.add("PUT", "onboarding/users/:uid/plans/:pid/divisions/:did/create-division", (ctx) => {
  const { user, plan, division: d } = locateDivision(ctx);
  const scenario = getDb().session?.scenario;
  const info = d.divisionInfo;
  const platformName = info.payrollPlatformName ?? "";
  const failsToConnect =
    scenario === "connect-fail" || info.payrollPlatformCompanyDisplayId?.toUpperCase() === "FAIL0000" || info.apiKey?.toLowerCase() === "fail";
  if (failsToConnect) {
    throw new ApiError(400, Reason.PayrollPlatformCouldNotConnect, "Could not connect to the payroll platform.");
  }
  if (PLATFORM_BEHAVIOR[platformName]?.oauth && !flagsFor(d.id).oauthAuthorized) {
    // OAuth platforms hand back a redirect the frame opens in a popup (cf. quickbooks_online).
    const redirect: OnboardingCreateDivisionResponse = {
      redirectURI: `/oauth.html?platform=${encodeURIComponent(platformName)}&state=${encodeURIComponent(d.id)}`,
    };
    return { body: redirect };
  }
  d.divisionId ??= nextId("50");
  d.payrollPlatformIntegrationId ??= nextId("90");
  d.connectionStatus = d.connectionStatus === "NOT_STARTED" ? "IN_PROGRESS" : d.connectionStatus;
  plan.planSponsorId ??= nextId("70");
  touch(user, plan, d);
  return { body: structuredClone(user) };
});

router.add("POST", "onboarding/users/:uid/plans/:pid/divisions/:did/verify", (ctx) => {
  const { user, plan, division: d } = locateDivision(ctx);
  const flags = flagsFor(d.id);
  flags.verifyCount += 1;
  const platformName = d.divisionInfo.payrollPlatformName ?? "";
  let response: ListPaycodesResponse;
  if (PLATFORM_BEHAVIOR[platformName]?.oauth) {
    response = flags.oauthAuthorized
      ? { accessGranted: true, foundPayComponentCodes: FOUND_PAY_CODES }
      : { accessGranted: false, foundPayComponentCodes: [], error: "Authorization was not completed." };
  } else if (flags.verifyCount === 1) {
    // First verification: the platform reports the app has not been approved yet and provides the approval portal link.
    d.divisionInfo.approvalLink = `/oauth.html?mode=approval&platform=${encodeURIComponent(platformName)}&state=${encodeURIComponent(d.id)}`;
    response = { accessGranted: false, foundPayComponentCodes: [], approvalLink: d.divisionInfo.approvalLink };
  } else {
    response = { accessGranted: true, foundPayComponentCodes: FOUND_PAY_CODES };
  }
  touch(user, plan, d);
  return { body: response };
});

/** Demo-only: the OAuth popup is a separate window, so the frame reports the authorization result here. */
router.add("POST", "onboarding/users/:uid/plans/:pid/divisions/:did/oauth-authorize", (ctx) => {
  const { division } = locateDivision(ctx);
  const { code } = body<{ code?: string }>(ctx);
  if (!code) throw new ApiError(400, Reason.BadRequest, "Authorization code missing.");
  flagsFor(division.id).oauthAuthorized = true;
  return { status: 204 };
});

router.add("PUT", "onboarding/users/:uid/plans/:pid/divisions/:did/complete", (ctx) => {
  const { user, plan, division: d } = locateDivision(ctx);
  d.connectionStatus = "COMPLETE";
  d.billingStatus ??= "ACTIVE";
  touch(user, plan, d);
  return { body: structuredClone(user) };
});

// ----- Billing -----

router.add("GET", "onboarding/billing", (ctx) => {
  const { division } = findDivisionById(ctx.query.get("divisionId") ?? "");
  if (division.billingStatus === "ACTIVE") {
    throw new ApiError(400, Reason.BillingAlreadyComplete, "Billing has already been completed for this division.");
  }
  division.billingStatus = "PENDING";
  const response: StartSubscriptionCheckoutResponse = {
    setupIntent: { client_secret: `seti_demo_${division.id}_secret_${nextId()}` },
    customerSession: `cuses_demo_${nextId()}`,
  };
  return { body: response };
});

router.add("POST", "onboarding/billing", (ctx) => {
  const { plan, division } = findDivisionById(ctx.query.get("divisionId") ?? "");
  const paymentMethodId = ctx.query.get("paymentMethodId") ?? "";
  const declined = paymentMethodId === DECLINED_PAYMENT_METHOD;
  if (!declined) division.billingStatus = "ACTIVE";
  touch(plan, division);
  const response: ConfirmBillingResponse = { status: !declined };
  return { body: response };
});
