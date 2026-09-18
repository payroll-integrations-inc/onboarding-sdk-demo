import { beforeEach, describe, expect, test } from "vitest";
import { resetDb } from "./db";
import { mockFetch, mockFetchOptions } from "./mock-fetch";
import { Router } from "./router";
import type { OnboardingAggregate, OnboardingApiErrorBody, OnboardingStep, OnboardingTokenExchangeResponse } from "./types";
import { makeDemoToken, type Scenario } from "../shared/token";

mockFetchOptions.latency = [0, 0];

async function call<T>(method: string, path: string, body?: unknown): Promise<{ status: number; body: T }> {
  const response = await mockFetch(path, { method, body: body === undefined ? undefined : JSON.stringify(body) });
  const text = await response.text();
  return { status: response.status, body: (text ? JSON.parse(text) : undefined) as T };
}

async function exchange(scenario: Scenario = "happy") {
  const token = makeDemoToken(scenario);
  return call<OnboardingTokenExchangeResponse & OnboardingApiErrorBody>("POST", `/api/onboarding/exchange?token=${token}`);
}

const divisionPath = (uid: string, pid: string, did: string) => `/api/onboarding/users/${uid}/plans/${pid}/divisions/${did}`;

describe("router", () => {
  test("matches literal and parameterised segments", () => {
    const router = new Router().add("GET", "a/:id/b", () => ({}));
    expect(router.match("GET", "/a/42/b")?.params).toEqual({ id: "42" });
    expect(router.match("GET", "a/42/c")).toBeUndefined();
    expect(router.match("POST", "a/42/b")).toBeUndefined();
  });
});

describe("emulated onboarding API", () => {
  beforeEach(() => resetDb());

  test("unknown routes return 404", async () => {
    const { status } = await call("GET", "/api/nope");
    expect(status).toBe(404);
  });

  test("exchange rejects malformed and bad-token scenarios with TOKEN_VALIDATION_FAILED", async () => {
    const malformed = await call<OnboardingApiErrorBody>("POST", "/api/onboarding/exchange?token=not-a-jwt");
    expect(malformed.status).toBe(401);
    expect(malformed.body.reason).toBe("TOKEN_VALIDATION_FAILED");

    const bad = await exchange("bad-token");
    expect(bad.status).toBe(401);
    expect(bad.body.reason).toBe("TOKEN_VALIDATION_FAILED");
  });

  test("exchange seeds a user + plan + division and opens a session", async () => {
    const { status, body } = await exchange();
    expect(status).toBe(200);
    expect(body.onboardingPlanId).toBe("3");

    const me = await call<OnboardingAggregate>("GET", "/api/onboarding/me");
    expect(me.status).toBe(200);
    expect(me.body.id).toBe(body.onboardingUserId);
    expect(me.body.plans[0]?.divisions[0]?.connectionStatus).toBe("NOT_STARTED");
    expect(me.body.plans[0]?.recordKeeperId).toBe("1");
  });

  test("select-recordkeeper scenario leaves the recordkeeper unset", async () => {
    await exchange("select-recordkeeper");
    const me = await call<OnboardingAggregate>("GET", "/api/onboarding/me");
    expect(me.body.plans[0]?.recordKeeperId).toBeNull();
    expect(me.body.plans[0]?.userSelectRecordKeeper).toBe(true);
  });

  test("me without a session is 401", async () => {
    const me = await call("GET", "/api/onboarding/me");
    expect(me.status).toBe(401);
  });

  test("plan identifier is validated", async () => {
    const { body } = await exchange();
    const uid = body.onboardingUserId;
    const bad = await call<OnboardingApiErrorBody>("PATCH", `/api/onboarding/users/${uid}/plans/3`, { recordKeeperCompanyIdentifier: "!" });
    expect(bad.status).toBe(400);
    expect(bad.body.reason).toBe("INVALID_COMPANY_IDENTIFIER");
    const ok = await call("PATCH", `/api/onboarding/users/${uid}/plans/3`, { recordKeeperCompanyIdentifier: "PLAN-001" });
    expect(ok.status).toBe(204);
  });

  test("steps are served per platform and omitted from the list", async () => {
    const list = await call<{ name: string; steps: unknown[] }[]>("GET", "/api/onboarding/payroll-platforms?onboardingPlanId=3");
    expect(list.body.map((p) => p.name)).toEqual(["acme_payroll", "northwind_hr", "contoso_pay"]);
    expect(list.body.every((p) => p.steps.length === 0)).toBe(true);
    const steps = await call<OnboardingStep[]>("GET", "/api/onboarding/payroll-platforms/steps?payrollPlatformName=acme_payroll&onboardingPlanId=3");
    expect(steps.body).toHaveLength(2);
    const unknown = await call("GET", "/api/onboarding/payroll-platforms/steps?payrollPlatformName=nope");
    expect(unknown.status).toBe(404);
  });

  test("credentials platform: division lifecycle through to complete", async () => {
    const { body } = await exchange();
    const uid = body.onboardingUserId;
    const path = divisionPath(uid, "3", "1001");

    await call("PATCH", path, { divisionInfo: { payrollPlatformName: "acme_payroll", payrollPlatformCompanyDisplayId: "ACME1234", apiKey: "secret" } });
    const created = await call<OnboardingAggregate>("PUT", `${path}/create-division`);
    expect(created.status).toBe(200);
    const division = created.body.plans[0]!.divisions[0]!;
    expect(division.divisionId).not.toBeNull();
    expect(division.connectionStatus).toBe("IN_PROGRESS");
    expect(created.body.plans[0]!.planSponsorId).not.toBeNull();

    const firstVerify = await call<{ accessGranted: boolean; approvalLink?: string }>("POST", `${path}/verify`);
    expect(firstVerify.body.accessGranted).toBe(false);
    expect(firstVerify.body.approvalLink).toContain("mode=approval");
    const secondVerify = await call<{ accessGranted: boolean }>("POST", `${path}/verify`);
    expect(secondVerify.body.accessGranted).toBe(true);

    const billing = await call<{ setupIntent: { client_secret: string } }>("GET", `/api/onboarding/billing?divisionId=${division.divisionId}`);
    expect(billing.body.setupIntent.client_secret).toMatch(/^seti_demo_/);
    const declined = await call<{ status: boolean }>("POST", `/api/onboarding/billing?divisionId=${division.divisionId}&paymentMethodId=pm_card_declined`);
    expect(declined.body.status).toBe(false);
    const paid = await call<{ status: boolean }>("POST", `/api/onboarding/billing?divisionId=${division.divisionId}&paymentMethodId=pm_card_visa`);
    expect(paid.body.status).toBe(true);
    const again = await call<OnboardingApiErrorBody>("GET", `/api/onboarding/billing?divisionId=${division.divisionId}`);
    expect(again.body.reason).toBe("BILLING_ALREADY_COMPLETE");

    const complete = await call<OnboardingAggregate>("PUT", `${path}/complete`);
    expect(complete.body.plans[0]!.divisions[0]!.connectionStatus).toBe("COMPLETE");
    expect(complete.body.plans[0]!.divisions[0]!.billingStatus).toBe("ACTIVE");

    const end = await call("POST", `/api/onboarding/users/${uid}/plans/3/end`);
    expect(end.status).toBe(204);
    const me = await call<OnboardingAggregate>("GET", "/api/onboarding/me");
    expect(me.body.plans[0]!.complete).toBe(true);
  });

  test("connection failures: FAIL0000, api key 'fail', and the connect-fail scenario", async () => {
    const happy = await exchange();
    const path = divisionPath(happy.body.onboardingUserId, "3", "1001");
    await call("PATCH", path, { divisionInfo: { payrollPlatformName: "acme_payroll", payrollPlatformCompanyDisplayId: "FAIL0000" } });
    let failed = await call<OnboardingApiErrorBody>("PUT", `${path}/create-division`);
    expect(failed.status).toBe(400);
    expect(failed.body.reason).toBe("PAYROLL_PLATFORM_COULD_NOT_CONNECT");

    await call("PATCH", path, { divisionInfo: { payrollPlatformCompanyDisplayId: "ACME1234", apiKey: "fail" } });
    failed = await call<OnboardingApiErrorBody>("PUT", `${path}/create-division`);
    expect(failed.body.reason).toBe("PAYROLL_PLATFORM_COULD_NOT_CONNECT");

    resetDb();
    const scenario = await exchange("connect-fail");
    const path2 = divisionPath(scenario.body.onboardingUserId, "3", "1001");
    await call("PATCH", path2, { divisionInfo: { payrollPlatformName: "contoso_pay", payrollPlatformCompanyDisplayId: "CONT01" } });
    failed = await call<OnboardingApiErrorBody>("PUT", `${path2}/create-division`);
    expect(failed.body.reason).toBe("PAYROLL_PLATFORM_COULD_NOT_CONNECT");
  });

  test("oauth platform: redirect until authorized, then verify succeeds", async () => {
    const { body } = await exchange();
    const path = divisionPath(body.onboardingUserId, "3", "1001");
    await call("PATCH", path, { divisionInfo: { payrollPlatformName: "northwind_hr" } });

    const redirect = await call<{ redirectURI: string }>("PUT", `${path}/create-division`);
    expect(redirect.body.redirectURI).toContain("/oauth.html?platform=northwind_hr");

    const unauthorized = await call<{ accessGranted: boolean; error?: string }>("POST", `${path}/verify`);
    expect(unauthorized.body.accessGranted).toBe(false);

    const missingCode = await call("POST", `${path}/oauth-authorize`, {});
    expect(missingCode.status).toBe(400);
    const authorized = await call("POST", `${path}/oauth-authorize`, { code: "demo" });
    expect(authorized.status).toBe(204);

    const created = await call<OnboardingAggregate>("PUT", `${path}/create-division`);
    expect(created.body.plans[0]!.divisions[0]!.divisionId).not.toBeNull();
    const verified = await call<{ accessGranted: boolean }>("POST", `${path}/verify`);
    expect(verified.body.accessGranted).toBe(true);
  });

  test("exchange refuses a plan that is already complete", async () => {
    const first = await exchange();
    const uid = first.body.onboardingUserId;
    await call("POST", `/api/onboarding/users/${uid}/plans/3/end`);
    // Re-exchange a token for the same user id
    const token = makeDemoToken("happy").split(".");
    const payload = JSON.parse(atob(token[1]!.replace(/-/g, "+").replace(/_/g, "/")));
    payload.onboardingUserId = uid;
    token[1] = btoa(JSON.stringify(payload)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    const second = await call<OnboardingApiErrorBody>("POST", `/api/onboarding/exchange?token=${token.join(".")}`);
    expect(second.status).toBe(400);
    expect(second.body.reason).toBe("NO_ACTIVE_ONBOARDING");
  });
});
