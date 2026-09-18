import type {
  OnboardingAggregate,
  OnboardingAggregateDivision,
  OnboardingAggregatePlan,
  OnboardingStep,
  PayrollPlatformForOnboarding,
  PriceTier,
  RecordKeeperForOnboarding,
} from "./types";
import type { Scenario } from "../shared/token";

/**
 * Emulated catalogue. Platform and recordkeeper names are fictional on purpose:
 * this is a public site and third-party logos/marks are not ours to ship.
 * Step *shapes* are copied from real configs so the dynamic-form renderer is exercised
 * the same way production is:
 *  - acme_payroll  <- configuration/.../individual-configs/paychex.ts (credentials + consent link)
 *  - northwind_hr  <- configuration/.../individual-configs/quickbooks-online.ts (OAuth popup + automatic verify)
 *  - contoso_pay   <- configuration/.../functions/onboarding-payroll-platform-steps-paylocity.ts (marketplace form)
 */

export const DEMO_PLAN_ID = "3";
export const DEMO_RECORDKEEPER_ID = "1";

export const RECORD_KEEPERS: RecordKeeperForOnboarding[] = [
  { id: "1", identifier: "demo_recordkeeper", displayName: "Demo Recordkeeper", img: "", hidden: false, stripeEnabled: true, pricingTiers: "RETIREMENT" },
  { id: "2", identifier: "fabrikam_retirement", displayName: "Fabrikam Retirement", img: "", hidden: false, stripeEnabled: true, pricingTiers: "RETIREMENT" },
  { id: "3", identifier: "woodgrove_benefits", displayName: "Woodgrove Benefits", img: "", hidden: false, stripeEnabled: false, pricingTiers: "FLAT" },
];

/** Demo-only behaviour switches keyed by platform name (the real product derives these from platform config). */
export const PLATFORM_BEHAVIOR: Record<string, { oauth: boolean }> = {
  acme_payroll: { oauth: false },
  northwind_hr: { oauth: true },
  contoso_pay: { oauth: false },
};

const ACME_STEPS: OnboardingStep[] = [
  {
    id: "get-acme-id",
    fields: [
      {
        key: "divisionInfo.payrollPlatformCompanyDisplayId",
        id: "acmeId",
        type: "inputText",
        label: "Acme Company ID",
        description: "Find your Acme Company ID on the top left of your Acme Payroll dashboard. Any 8 letters or digits work in this demo; FAIL0000 simulates a connection failure.",
        placeholder: "e.g. ACME1234",
        validators: {
          required: { value: true },
          pattern: { value: "^[a-zA-Z0-9]{8}$", errorText: "Acme Company ID must be 8 alphanumeric characters." },
        },
      },
      {
        key: "divisionInfo.apiKey",
        id: "acmeApiKey",
        type: "inputPassword",
        label: "Acme API key",
        description: "Generated under Settings → Integrations in Acme Payroll. Anything works here; the key 'fail' simulates an invalid credential.",
        validators: { required: { value: true } },
      },
    ],
    actions: [{ type: "update" }, { type: "create-division" }, { type: "verify-division", ignoreVerificationFailure: true }],
    actionButton: { type: "submit" },
  },
  {
    id: "add-acme-consent",
    redirectId: "failedVerificationRedirect",
    fields: [
      { id: "acme-consent-instructions", type: "text", value: "You need to approve the Payroll Integrations app in the Acme Integrated Apps portal." },
      { id: "acme-consent-link", dynamic: true, type: "link", label: "Acme Integrated Apps", value: "divisionInfo.approvalLink", requiresClick: true },
    ],
    actions: [{ type: "verify-division" }],
    actionButton: { type: "submitWithConfirm", confirmText: "I have granted access to the Payroll Integrations app in the Acme Integrated Apps portal" },
    backButtonEnabled: true,
  },
];

const NORTHWIND_STEPS: OnboardingStep[] = [
  {
    id: "northwind-start",
    redirectId: "failedVerificationRedirect",
    fields: [
      { id: "northwind-instructions", type: "text", value: "Sign in to Northwind HR and authorize Payroll Integrations to access your payroll data. A Northwind sign-in window will open." },
    ],
    actions: [{ type: "update" }, { type: "create-division" }],
    actionButton: { type: "connect", platformName: "northwind_hr" },
  },
  { type: "automatic", id: "northwind-end", actions: [{ type: "verify-division" }] },
];

const CONTOSO_STEPS: OnboardingStep[] = [
  {
    id: "get-contoso-id",
    fields: [
      {
        key: "divisionInfo.payrollPlatformCompanyDisplayId",
        id: "contosoId",
        type: "inputText",
        label: "Contoso ID",
        description: "Find your Contoso ID on your Contoso account page or any mail from Contoso.",
        validators: {
          required: { value: true },
          pattern: { value: "^[a-zA-Z0-9]{4,6}$", errorText: "Contoso ID must be only alphanumeric characters between 4 and 6 characters in length." },
        },
      },
    ],
    actions: [{ type: "update" }],
    actionButton: { type: "submit" },
  },
  {
    id: "contoso-marketplace",
    fields: [
      { id: "contoso-marketplace-instructions-1", type: "text", value: "You need to select the Payroll Integrations connector from the Contoso Marketplace.\n\nPlease click the link below and search for Payroll Integrations to begin." },
      { id: "contoso-marketplace-instructions-2", type: "text", value: "Complete the form in the marketplace. Afterwards, your Contoso Representative will reach out to us and we will coordinate the successful completion of this integration." },
      { id: "contoso-marketplace-link", type: "link", label: "Contoso Marketplace", value: "/oauth.html?mode=marketplace&platform=contoso_pay", requiresClick: true },
    ],
    actions: [{ type: "create-division" }],
    actionButton: { type: "submitWithConfirm", confirmText: "I have completed the Contoso marketplace connection form" },
    backButtonEnabled: true,
  },
];

export const PAYROLL_PLATFORMS: PayrollPlatformForOnboarding[] = [
  { name: "acme_payroll", displayName: "Acme Payroll", img: "", headerText: "Connecting your Acme Payroll account", preferredPriority: 1, steps: ACME_STEPS, skipStripe: false },
  { name: "northwind_hr", displayName: "Northwind HR", img: "", headerText: "Connecting your Northwind HR account", preferredPriority: 2, steps: NORTHWIND_STEPS, skipStripe: false },
  { name: "contoso_pay", displayName: "Contoso Pay", img: "", headerText: "Connecting your Contoso Pay account", preferredPriority: 3, steps: CONTOSO_STEPS, skipStripe: true },
];

/** From configuration/src/configuration/billing/pricing-tiers.ts (RETIREMENT, first five tiers). */
export const PRICE_TIERS: Record<string, PriceTier[]> = {
  RETIREMENT: [
    { tierName: "0-25", tierMin: 0, tierMax: 25, tierDescription: "Employees", price: 40, pricePeriod: "/mo*" },
    { tierName: "26-50", tierMin: 26, tierMax: 50, tierDescription: "Employees", price: 60, pricePeriod: "/mo*" },
    { tierName: "51-100", tierMin: 51, tierMax: 100, tierDescription: "Employees", price: 80, pricePeriod: "/mo*" },
    { tierName: "101-500", tierMin: 101, tierMax: 500, tierDescription: "Employees", price: 120, pricePeriod: "/mo*" },
    { tierName: "501-1000", tierMin: 501, tierMax: 1000, tierDescription: "Employees", price: 175, pricePeriod: "/mo*" },
  ],
  FLAT: [{ tierName: "All", tierMin: 0, tierMax: 100000, tierDescription: "Employees", price: 50, pricePeriod: "/mo" }],
};

export const FOUND_PAY_CODES = [
  { code: "REG", description: "Regular Earnings", isEarning: true, occurrenceCount: 42 },
  { code: "OT", description: "Overtime", isEarning: true, occurrenceCount: 17 },
  { code: "401K", description: "401(k) Employee Deferral", isEarning: false, occurrenceCount: 38 },
];

export function seedAggregate(onboardingUserId: string, scenario: Scenario, now: string): OnboardingAggregate {
  const selectRecordkeeper = scenario === "select-recordkeeper";
  const division: OnboardingAggregateDivision = {
    id: "1001",
    onboardingPlanId: DEMO_PLAN_ID,
    divisionId: null,
    payrollPlatformIntegrationId: null,
    divisionInfo: {},
    contacts: [],
    connectionStatus: "NOT_STARTED",
    createdAt: now,
    updatedAt: now,
  };
  const plan: OnboardingAggregatePlan = {
    id: DEMO_PLAN_ID,
    onboardingUserId,
    planSponsorId: null,
    planInfo: {},
    complete: false,
    archived: false,
    name: "Demo Company 401(k)",
    userSelectRecordKeeper: selectRecordkeeper,
    userProvideRecordkeeperIdentifier: true,
    recordKeeperId: selectRecordkeeper ? null : DEMO_RECORDKEEPER_ID,
    recordKeeperCompanyIdentifier: null,
    payrollPlatformName: null,
    notes: null,
    tpeIdentifier: null,
    tpaPlanId: null,
    redirectUrl: null,
    product: "360",
    createdAt: now,
    updatedAt: now,
    lastEmailSentAt: null,
    divisions: [division],
    notificationSent: false,
    createdBy: null,
  };
  return {
    id: onboardingUserId,
    email: "demo@example.com",
    userId: null,
    reservationId: null,
    userInfo: {},
    url: null,
    source: "PUBLIC_API",
    reservationEmailSentAt: null,
    lastPageViewed: null,
    createdBy: null,
    createdAt: now,
    updatedAt: now,
    plans: [plan],
  };
}
