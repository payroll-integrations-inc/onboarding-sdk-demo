/**
 * Window-message `source` strings the host page listens for.
 *
 * `pi-app` mirrors the real contract (onboarding-sdk/src/constants.ts and
 * pi/onboarding-ui/src/app/shared/constants/window-messages.ts): the frame's replies to the SDK.
 * `pi-demo` is demo-only plumbing (emulated API log) and is deliberately a different source
 * string so it can never be mistaken for part of the real contract.
 */
export const APP_SOURCE = "pi-app" as const;
export const DEMO_CHANNEL = "pi-demo" as const;
