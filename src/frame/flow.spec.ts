import { beforeEach, describe, expect, test } from "vitest";
import { getErrorText, getPath, nextView, redirectStep, resumeStep, setPath, start, submitPayrollPlatformStep, routeAfterStep, loadPayrollPlatform } from "./flow";
import { onboardingDivision, onboardingPlan, resetState, state, updatePlanDivisionIds } from "./state";
import { resetDb } from "../mock/db";
import { PAYROLL_PLATFORMS } from "../mock/fixtures";
import { mockFetchOptions } from "../mock/mock-fetch";
import type { OnboardingAggregate } from "../mock/types";
import { makeDemoToken } from "../shared/token";

mockFetchOptions.latency = [0, 0];

function aggregate(overrides: { divisionId?: string | null; connectionStatus?: "NOT_STARTED" | "IN_PROGRESS" | "COMPLETE"; billingStatus?: "ACTIVE" | "PENDING"; planComplete?: boolean; platform?: string; recordKeeperId?: string | null; planSponsorId?: string | null } = {}): OnboardingAggregate {
  const now = new Date().toISOString();
  return {
    id: "u1", email: "e", userId: null, reservationId: null, userInfo: {}, url: null, source: "PUBLIC_API", reservationEmailSentAt: null, lastPageViewed: null, createdBy: null, createdAt: now, updatedAt: now,
    plans: [{
      id: "3", onboardingUserId: "u1", planSponsorId: overrides.planSponsorId ?? null, planInfo: {}, complete: overrides.planComplete ?? false, archived: false, name: "Plan", userSelectRecordKeeper: false, userProvideRecordkeeperIdentifier: true,
      recordKeeperId: overrides.recordKeeperId === undefined ? "1" : overrides.recordKeeperId, recordKeeperCompanyIdentifier: null, payrollPlatformName: null, notes: null, tpeIdentifier: null, tpaPlanId: null, redirectUrl: null, product: "360", createdAt: now, updatedAt: now, lastEmailSentAt: null, notificationSent: false, createdBy: null,
      divisions: [{ id: "1001", onboardingPlanId: "3", divisionId: overrides.divisionId ?? null, payrollPlatformIntegrationId: null, divisionInfo: overrides.platform ? { payrollPlatformName: overrides.platform } : {}, contacts: [], connectionStatus: overrides.connectionStatus ?? "NOT_STARTED", billingStatus: overrides.billingStatus, createdAt: now, updatedAt: now }],
    }],
  };
}

function load(user: OnboardingAggregate) {
  state.onboardingUser = user;
  updatePlanDivisionIds("3");
}

describe("nextView (start-screen resume routing)", () => {
  beforeEach(() => resetState());

  test("no plan or division -> error", () => {
    state.onboardingUser = aggregate();
    expect(nextView().path).toBe("error");
  });
  test("fresh onboarding with a recordkeeper -> confirm-record-keeper", () => {
    load(aggregate());
    expect(nextView().path).toBe("confirm-record-keeper");
  });
  test("no recordkeeper yet -> select-record-keeper", () => {
    load(aggregate({ recordKeeperId: null }));
    expect(nextView().path).toBe("select-record-keeper");
  });
  test("division created, connection incomplete -> connect steps for that platform", () => {
    load(aggregate({ divisionId: "501", connectionStatus: "IN_PROGRESS", platform: "acme_payroll" }));
    expect(nextView().path).toBe("connect-payroll-platform/acme_payroll/steps");
  });
  test("connected, billing pending -> billing", () => {
    load(aggregate({ divisionId: "501", connectionStatus: "COMPLETE", billingStatus: "PENDING", platform: "acme_payroll" }));
    expect(nextView().path).toBe("billing");
  });
  test("connected and billed, plan not complete -> more-divisions", () => {
    load(aggregate({ divisionId: "501", connectionStatus: "COMPLETE", billingStatus: "ACTIVE", platform: "acme_payroll" }));
    expect(nextView().path).toBe("more-divisions");
  });
  test("a requested plan stays selected once complete so the end screen can show it", () => {
    load(aggregate({ planComplete: true, planSponsorId: "7" }));
    expect(onboardingPlan()?.planSponsorId).toBe("7");
  });
});

describe("step helpers", () => {
  const acme = PAYROLL_PLATFORMS.find((p) => p.name === "acme_payroll")!;
  const contoso = PAYROLL_PLATFORMS.find((p) => p.name === "contoso_pay")!;

  test("setPath / getPath handle dotted keys", () => {
    const target: Record<string, unknown> = {};
    setPath(target, "divisionInfo.payrollPlatformCompanyDisplayId", "ABC");
    expect(target).toEqual({ divisionInfo: { payrollPlatformCompanyDisplayId: "ABC" } });
    expect(getPath(target, "divisionInfo.payrollPlatformCompanyDisplayId")).toBe("ABC");
    expect(getPath(target, "divisionInfo.missing.deeper")).toBeUndefined();
  });

  test("redirectStep finds the failedVerificationRedirect step, defaulting to 1", () => {
    expect(redirectStep(acme)).toBe(2);
    expect(redirectStep(contoso)).toBe(1);
  });

  test("resumeStep is 1 until the division exists, then the step after create-division", () => {
    resetState();
    load(aggregate({ platform: "acme_payroll" }));
    expect(resumeStep(acme)).toBe(1);
    load(aggregate({ divisionId: "501", connectionStatus: "IN_PROGRESS", platform: "acme_payroll" }));
    expect(resumeStep(acme)).toBe(2);
    // contoso creates the division on its last step, so a created division means the last step
    load(aggregate({ divisionId: "501", connectionStatus: "IN_PROGRESS", platform: "contoso_pay" }));
    expect(resumeStep(contoso)).toBe(2);
  });

  test("getErrorText maps known reasons and ignores unknown ones", () => {
    expect(getErrorText("TOKEN_VALIDATION_FAILED")).toBe("Token validation failed.");
    expect(getErrorText("SOMETHING_ELSE")).toBeNull();
    expect(getErrorText(null)).toBeNull();
  });
});

describe("submitPayrollPlatformStep against the emulated backend", () => {
  beforeEach(() => {
    resetDb();
    resetState();
  });

  test("Acme: update + create-division + tolerant verify, then consent verify, then billing", async () => {
    await start(makeDemoToken("happy"));
    const acme = (await loadPayrollPlatform("acme_payroll"))!;
    expect(acme.steps).toHaveLength(2);

    const step1 = await submitPayrollPlatformStep(acme, 1, { acmeId: "ACME1234", acmeApiKey: "k" });
    expect(step1).toEqual({ type: "next" });
    expect(onboardingDivision()?.divisionId).not.toBeNull();
    expect(onboardingDivision()?.divisionInfo.approvalLink).toContain("mode=approval");
    expect(await routeAfterStep(acme, 1)).toBe("connect-payroll-platform/acme_payroll/steps/2");

    const step2 = await submitPayrollPlatformStep(acme, 2, {});
    expect(step2).toEqual({ type: "next" });
    expect(await routeAfterStep(acme, 2)).toBe("billing");
    expect(onboardingDivision()?.connectionStatus).toBe("COMPLETE");
  });

  test("Contoso skips billing and finalizes straight to more-divisions", async () => {
    await start(makeDemoToken("happy"));
    const contoso = (await loadPayrollPlatform("contoso_pay"))!;
    await submitPayrollPlatformStep(contoso, 1, { contosoId: "CONT01" });
    await submitPayrollPlatformStep(contoso, 2, {});
    expect(await routeAfterStep(contoso, 2)).toBe("more-divisions");
    expect(onboardingDivision()?.billingStatus).toBe("ACTIVE");
  });

  test("Northwind returns an external redirect until authorized", async () => {
    await start(makeDemoToken("happy"));
    const northwind = (await loadPayrollPlatform("northwind_hr"))!;
    const result = await submitPayrollPlatformStep(northwind, 1, {});
    expect(result.type).toBe("externalRedirect");
    if (result.type === "externalRedirect") expect(result.url).toContain("platform=northwind_hr");
  });

  test("connect-fail scenario surfaces PAYROLL_PLATFORM_COULD_NOT_CONNECT", async () => {
    await start(makeDemoToken("connect-fail"));
    const acme = (await loadPayrollPlatform("acme_payroll"))!;
    await expect(submitPayrollPlatformStep(acme, 1, { acmeId: "ACME1234", acmeApiKey: "k" })).rejects.toMatchObject({ reason: "PAYROLL_PLATFORM_COULD_NOT_CONNECT" });
  });
});
