/**
 * Demo onboarding tokens.
 *
 * The real `onboardingLink` carries a signed JWT minted by the PI API
 * (POST /v1/employer-identifiers/{id}/invites/{invite}/session). The SDK only
 * extracts the `token` query param and hands it to the frame, which exchanges it.
 *
 * Here the token is JWT-*shaped* (base64url header.payload.signature) so it looks
 * right in the developer panel, but it is unsigned and the payload carries the
 * demo scenario so the emulated backend knows how to behave.
 */
export const SCENARIOS = ["happy", "select-recordkeeper", "connect-fail", "bad-token"] as const;
export type Scenario = (typeof SCENARIOS)[number];

export interface DemoTokenPayload {
  /** Onboarding user id (uuid). A fresh id per click gives a fresh emulated onboarding. */
  onboardingUserId: string;
  /** Plan id the link was generated for (the real link also has a `&plan=` param). */
  plan: number;
  scenario: Scenario;
  iss: string;
  iat: number;
  exp: number;
}

const HEADER = { alg: "RS256", typ: "JWT", kid: "demo-key-not-verified" };
const TOKEN_TTL_SECONDS = 30 * 60; // real links are valid for 30 minutes

export function isScenario(value: unknown): value is Scenario {
  return typeof value === "string" && (SCENARIOS as readonly string[]).includes(value);
}

export function base64UrlEncode(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function base64UrlDecode(segment: string): string {
  const padded = segment.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(segment.length / 4) * 4, "=");
  const binary = atob(padded);
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

export function makeDemoToken(scenario: Scenario, plan = 3, now = Date.now()): string {
  const iat = Math.floor(now / 1000);
  const payload: DemoTokenPayload = {
    onboardingUserId: crypto.randomUUID(),
    plan,
    scenario,
    iss: "https://sdk-demo.payrollintegrationsdemo.com",
    iat,
    exp: iat + TOKEN_TTL_SECONDS,
  };
  return [
    base64UrlEncode(JSON.stringify(HEADER)),
    base64UrlEncode(JSON.stringify(payload)),
    base64UrlEncode("demo-signature-not-verified"),
  ].join(".");
}

/** Returns the payload, or `undefined` when the token is not a well-formed demo token. */
export function decodeDemoToken(token: string | null | undefined): DemoTokenPayload | undefined {
  if (!token) return undefined;
  const parts = token.split(".");
  if (parts.length !== 3) return undefined;
  try {
    const payload: unknown = JSON.parse(base64UrlDecode(parts[1]!));
    if (typeof payload !== "object" || payload === null) return undefined;
    const p = payload as Record<string, unknown>;
    if (typeof p.onboardingUserId !== "string" || typeof p.plan !== "number" || !isScenario(p.scenario)) {
      return undefined;
    }
    if (typeof p.iat !== "number" || typeof p.exp !== "number" || typeof p.iss !== "string") return undefined;
    return p as unknown as DemoTokenPayload;
  } catch {
    return undefined;
  }
}
