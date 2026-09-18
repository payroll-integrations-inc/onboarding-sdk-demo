/**
 * postMessage contract between the SDK (parent page) and the onboarding frame.
 *
 * Mirrors:
 *  - onboarding-sdk/src/constants.ts + interfaces.ts (SDK side)
 *  - pi/onboarding-ui/src/app/shared/constants/window-messages.ts (frame side)
 *
 * `pi-demo` is demo-only plumbing (mock API log) and is deliberately a different
 * source string so it can never be mistaken for part of the real contract.
 */
export const SDK_SOURCE = "pi-sdk" as const;
export const APP_SOURCE = "pi-app" as const;
export const POPUP_COMPLETE = "popup-complete" as const;
export const DEMO_CHANNEL = "pi-demo" as const;

/** Messages the SDK posts into the frame. */
export type SdkToAppMessage = { source: typeof SDK_SOURCE } & (
  | { type: "token"; value: string }
  | { type: "style"; value: { height: string; width: string } }
);

/** Messages the frame posts back to the SDK. */
export type AppToSdkMessageType = "success" | "error" | "message";
export interface AppToSdkMessage {
  source: typeof APP_SOURCE;
  type: AppToSdkMessageType;
  value: unknown;
}

/** Message the OAuth popup posts to its opener (intra-frame plumbing, not part of the SDK contract). */
export interface PopupCompleteMessage {
  source: typeof APP_SOURCE;
  type: typeof POPUP_COMPLETE;
  [param: string]: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function isSdkToAppMessage(data: unknown): data is SdkToAppMessage {
  if (!isRecord(data) || data.source !== SDK_SOURCE) return false;
  if (data.type === "token") return typeof data.value === "string";
  if (data.type === "style") {
    return isRecord(data.value) && typeof data.value.height === "string" && typeof data.value.width === "string";
  }
  return false;
}

export function isPopupCompleteMessage(data: unknown): data is PopupCompleteMessage {
  return isRecord(data) && data.source === APP_SOURCE && data.type === POPUP_COMPLETE;
}
