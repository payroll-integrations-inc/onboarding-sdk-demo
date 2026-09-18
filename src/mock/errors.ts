import type { OnboardingApiErrorBody, OnboardingApiErrorReason } from "./types";

/** Thrown by handlers; the fetch shim turns it into the `{ reason, message }` body pi-api returns. */
export class ApiError extends Error {
  public readonly status: number;
  public readonly reason: OnboardingApiErrorReason | string;
  public readonly metadata: Record<string, string> | undefined;

  constructor(status: number, reason: OnboardingApiErrorReason | string, message?: string, metadata?: Record<string, string>) {
    super(message ?? reason);
    this.name = "ApiError";
    this.status = status;
    this.reason = reason;
    this.metadata = metadata;
  }

  toBody(): OnboardingApiErrorBody {
    return this.metadata ? { reason: this.reason, message: this.message, metadata: this.metadata } : { reason: this.reason, message: this.message };
  }
}

export function isApiErrorBody(value: unknown): value is OnboardingApiErrorBody {
  return typeof value === "object" && value !== null && typeof (value as OnboardingApiErrorBody).reason === "string";
}
