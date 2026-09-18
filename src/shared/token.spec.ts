import { describe, expect, test } from "vitest";
import { decodeDemoToken, makeDemoToken } from "./token";

describe("demo token", () => {
  test("round-trips scenario and plan", () => {
    const token = makeDemoToken("connect-fail", 7);
    expect(token.split(".")).toHaveLength(3);
    const payload = decodeDemoToken(token);
    expect(payload?.scenario).toBe("connect-fail");
    expect(payload?.plan).toBe(7);
    expect(payload?.exp).toBe(payload!.iat + 30 * 60);
  });

  test("every token gets a fresh onboarding user id", () => {
    expect(decodeDemoToken(makeDemoToken("happy"))?.onboardingUserId).not.toBe(decodeDemoToken(makeDemoToken("happy"))?.onboardingUserId);
  });

  test("rejects garbage", () => {
    expect(decodeDemoToken(undefined)).toBeUndefined();
    expect(decodeDemoToken("abc")).toBeUndefined();
    expect(decodeDemoToken("a.b.c")).toBeUndefined();
    const [h, , s] = makeDemoToken("happy").split(".");
    const tampered = btoa(JSON.stringify({ onboardingUserId: "x", plan: 1, scenario: "nope", iss: "i", iat: 1, exp: 2 }));
    expect(decodeDemoToken(`${h}.${tampered}.${s}`)).toBeUndefined();
  });
});
