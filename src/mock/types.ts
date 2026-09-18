/**
 * Minimal copies of the Payroll Integrations DTOs the onboarding frame consumes.
 *
 * Sources (pi monorepo, branch development):
 *  - dtos/src/configuration-types.ts      OnboardingStep, dynamic fields, actions, buttons
 *  - dtos/src/onboarding.dtos.ts          RecordKeeperForOnboarding, PayrollPlatformForOnboarding,
 *                                         OnboardingTokenExchangeResponse, OnboardingApiErrorReason
 *  - dtos/src/onboarding.interface.ts     OnboardingAggregate + plan / division / user info
 *  - dtos/src/verify-division.dtos.ts     ListPaycodesResponse
 *  - configuration/src/configuration/billing/pricing-tiers.ts   PriceTier
 *
 * Simplifications: DbInt8 -> string, DateTime -> ISO string. Only the field types the demo
 * renders are modelled precisely; the rest fall into `UnsupportedDynamicField`.
 */

export type DbInt8 = string;
export type IsoDateTime = string;

// ----- Dynamic step definitions (configuration-types.ts) -----

export interface DynamicElementBase<T extends string> {
  id: string;
  type: T;
  style?: string;
}

export interface DynamicDisplayElementBase<T extends string, V = string> extends DynamicElementBase<T> {
  value: V;
  /** If true, then `value` is a key path into the current dynamic data (e.g. `divisionInfo.approvalLink`). */
  dynamic?: boolean;
}

export type DynamicDisplayText = DynamicDisplayElementBase<"text">;
export type DynamicDisplayDivider = DynamicDisplayElementBase<"divider">;
export interface DynamicDisplayLink extends DynamicDisplayElementBase<"link"> {
  label: string;
  /** If true, user must click this link before they can proceed to the next step. */
  requiresClick?: boolean;
}
export interface DynamicDisplayCopyText extends DynamicDisplayElementBase<"copyText"> {
  label?: string;
  description?: string;
}

export type DynamicDisplayElement = DynamicDisplayText | DynamicDisplayDivider | DynamicDisplayLink | DynamicDisplayCopyText;

export type DynamicFormControlValidator<T> = { value: T; errorText?: string };

export interface DynamicFormControlBase<T extends string, V> extends DynamicElementBase<T> {
  /** Key path in the PATCH body, e.g. `divisionInfo.payrollPlatformCompanyDisplayId`. */
  key?: string;
  label: string;
  description?: string;
  validators?: { required?: DynamicFormControlValidator<boolean> };
  initialValue?: V;
  /** Id of another control whose truthy value enables this one; `'confirm'` gates on the submitWithConfirm checkbox. */
  enabledBy?: string;
}

export interface DynamicFormInputText extends DynamicFormControlBase<"inputText", string> {
  placeholder?: string;
  validators?: DynamicFormControlBase<"inputText", string>["validators"] & {
    email?: DynamicFormControlValidator<boolean>;
    minLength?: DynamicFormControlValidator<number>;
    maxLength?: DynamicFormControlValidator<number>;
    pattern?: DynamicFormControlValidator<string>;
  };
}
export interface DynamicFormInputPassword extends DynamicFormControlBase<"inputPassword", string> {
  placeholder?: string;
}
export interface DynamicFormSelect extends DynamicFormControlBase<"select", string> {
  placeholder?: string;
  options: { label: string; value: string }[];
}
export interface DynamicFormRadio extends DynamicFormControlBase<"radio", string> {
  options: { label: string; value: string }[];
}
export type DynamicFormBinaryCheckbox = DynamicFormControlBase<"binaryCheckbox", boolean>;

export type DynamicFormControl =
  | DynamicFormInputText
  | DynamicFormInputPassword
  | DynamicFormSelect
  | DynamicFormRadio
  | DynamicFormBinaryCheckbox;

/** Field types the real frame supports but this demo does not render (progress, image, multiselect, ...). */
export interface UnsupportedDynamicField extends DynamicElementBase<string> {
  label?: string;
}

export type OnboardingDynamicField = DynamicDisplayElement | DynamicFormControl | UnsupportedDynamicField;

export type OnboardingStepAction =
  | { type: "update" }
  | { type: "create-integration" }
  | { type: "create-division" }
  | { type: "verify-division"; ignoreVerificationFailure?: boolean }
  | { type: "get-group-codes"; retryCount?: number; retryDelayMs?: number }
  | { type: "apply-group-codes"; applyAllCodes?: boolean };

export type OnboardingActionButton =
  | { type: "submitWithConfirm"; confirmText: string; text?: string }
  | { type: "submit"; text?: string }
  | { type: "redirect"; text?: string; href: string }
  | { type: "connect"; platformName: string; text?: undefined };

export type OnboardingStep = {
  id: string;
  errorAction?: "default" | "message";
  /** Steps tagged `failedVerificationRedirect` are where a failed verification sends the user back to. */
  redirectId?: string;
} & (
  | {
      type?: "form";
      fields: OnboardingDynamicField[];
      actions: OnboardingStepAction[];
      actionButton: OnboardingActionButton;
      backButtonEnabled?: boolean;
    }
  | { type: "message"; message: string; actions: OnboardingStepAction[]; actionButton: OnboardingActionButton }
  | { type: "automatic"; actions: OnboardingStepAction[] }
);

// ----- Catalogue DTOs (onboarding.dtos.ts) -----

export type PriceTierType = "RETIREMENT" | "SFRP" | "HSA" | "PAYCHEX_RK" | "UBIQUITY_RK" | "FLAT" | "VESTWELL_STATE";

export interface RecordKeeperForOnboarding {
  id: DbInt8;
  identifier: string;
  displayName: string;
  img: string;
  hidden: boolean;
  stripeEnabled: boolean;
  pricingTiers: PriceTierType;
}

export interface PayrollPlatformForOnboarding {
  /** Payroll platform id */
  name: string;
  displayName: string;
  hidden?: boolean;
  /** Path to the logo image; empty in the demo (initials tile is rendered instead). */
  img: string;
  /** Header text shown next to the logos on the connect screens */
  headerText: string;
  preferredPriority?: number;
  steps: OnboardingStep[];
  /** Whether or not to skip the billing step */
  skipStripe: boolean;
}

export type OnboardingCreateDivisionResponse = string | { redirectURI: string } | OnboardingAggregate;

export interface OnboardingTokenExchangeResponse {
  onboardingUserId: string;
  onboardingPlanId: DbInt8 | null;
}

export const OnboardingApiErrorReason = {
  TokenValidation: "TOKEN_VALIDATION_FAILED",
  TermsNotAccepted: "TERMS_NOT_ACCEPTED",
  PlanSponsorNotFound: "PLAN_SPONSOR_NOT_FOUND",
  DivisionNotFound: "DIVISION_NOT_FOUND",
  PayrollPlatformCouldNotConnect: "PAYROLL_PLATFORM_COULD_NOT_CONNECT",
  BadRequest: "BAD_REQUEST",
  UserNotFound: "USER_NOT_FOUND",
  BillingAlreadyComplete: "BILLING_ALREADY_COMPLETE",
  NoActiveOnboarding: "NO_ACTIVE_ONBOARDING",
  InvalidCompanyIdentifier: "INVALID_COMPANY_IDENTIFIER",
} as const;
export type OnboardingApiErrorReason = (typeof OnboardingApiErrorReason)[keyof typeof OnboardingApiErrorReason];

/** Error body shape returned by pi-api's onboarding resources. */
export interface OnboardingApiErrorBody {
  reason: OnboardingApiErrorReason | string;
  message: string;
  metadata?: Record<string, string>;
}

// ----- Aggregate (onboarding.interface.ts) -----

export interface UserInfo {
  acceptedTermsOfServiceVersion?: number;
}

export interface DivisionInfo {
  name?: string;
  payrollPlatformCompanyDisplayId?: string;
  payrollPlatformName?: string;
  onboardingCode?: string;
  approvalLink?: string;
  activationDate?: string;
  groupCode?: string;
  /** Demo-only: credential captured by the Acme "API key" field (never stored by the real product). */
  apiKey?: string;
}

export type ConnectionStatus = "NOT_STARTED" | "IN_PROGRESS" | "COMPLETE";
export type BillingStatus = "ACTIVE" | "DELINQUENT" | "INACTIVE" | "LEGACY" | "PENDING" | "REQUIRES_ACTION";

export interface OnboardingAggregateDivision {
  id: DbInt8;
  onboardingPlanId: DbInt8;
  divisionId: DbInt8 | null;
  payrollPlatformIntegrationId: DbInt8 | null;
  divisionInfo: DivisionInfo;
  contacts: string[];
  connectionStatus: ConnectionStatus;
  billingStatus?: BillingStatus;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
}

export type OnboardingUpdateDivision = Partial<
  Pick<OnboardingAggregateDivision, "divisionId" | "payrollPlatformIntegrationId" | "divisionInfo" | "contacts" | "connectionStatus">
>;

export type OnboardingSource = "EXTERNAL" | "PUBLIC_API" | "RECORDKEEPER_INVITE" | "TPA_INVITE";
export type OnboardingProduct = "360" | "TPA";

export interface OnboardingAggregatePlan {
  id: DbInt8;
  onboardingUserId: string;
  planSponsorId: DbInt8 | null;
  planInfo: Record<string, unknown>;
  complete: boolean;
  archived: boolean;
  contacts?: string[];
  name: string | null;
  userSelectRecordKeeper: boolean;
  userProvideRecordkeeperIdentifier: boolean;
  recordKeeperId: DbInt8 | null;
  recordKeeperCompanyIdentifier: string | null;
  payrollPlatformName: string | null;
  notes: string | null;
  tpeIdentifier: string | null;
  tpaPlanId: string | null;
  redirectUrl: string | null;
  product: OnboardingProduct;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
  lastEmailSentAt: IsoDateTime | null;
  divisions: OnboardingAggregateDivision[];
  notificationSent: boolean;
  createdBy: DbInt8 | null;
}

export type OnboardingUpdatePlan = Partial<
  Pick<OnboardingAggregatePlan, "recordKeeperId" | "recordKeeperCompanyIdentifier" | "complete" | "payrollPlatformName">
>;

export interface OnboardingAggregate {
  id: string;
  email: string;
  userId: DbInt8 | null;
  reservationId: DbInt8 | null;
  userInfo: UserInfo;
  url: string | null;
  source: OnboardingSource;
  reservationEmailSentAt: IsoDateTime | null;
  lastPageViewed: string | null;
  createdBy: DbInt8 | null;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
  plans: OnboardingAggregatePlan[];
}

// ----- Verification / billing -----

export interface ListPaycodeDetailsResponse {
  code: string;
  description: string;
  isEarning: boolean;
  occurrenceCount: number;
}

export interface ListPaycodesResponse {
  accessGranted: boolean;
  foundPayComponentCodes: ListPaycodeDetailsResponse[];
  /** Payroll platform provided link for the user to approve the integration. */
  approvalLink?: string;
  error?: string;
}

export interface PriceTier {
  tierName: string;
  tierMin: number;
  tierMax: number;
  tierDescription: string;
  price: number;
  pricePeriod: string;
}

export interface StartSubscriptionCheckoutResponse {
  setupIntent: { client_secret: string };
  customerSession: string;
}

export interface ConfirmBillingResponse {
  status: boolean;
}
