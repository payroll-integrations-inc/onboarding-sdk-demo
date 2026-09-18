import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { bootstrap } from "@payroll-integrations/onboarding-sdk";
import { cdnSnippet, npmSnippet } from "./snippet";
import { makeDemoToken } from "../shared/token";

/**
 * Contract test against the REAL published SDK: proves that the way this demo
 * configures `bootstrap()` (frameHost = location.origin, frame served at /link/start,
 * replies with source 'pi-app') is exactly what the SDK's origin/source filter accepts.
 */
describe("@payroll-integrations/onboarding-sdk contract", () => {
  let host: HTMLDivElement;
  beforeEach(() => {
    host = document.createElement("div");
    host.id = "pi-host";
    document.body.appendChild(host);
  });
  afterEach(() => host.remove());

  const onboardingLink = () => `https://secure.payrollintegrationsdemo.com/link?token=${makeDemoToken("happy")}&plan=3`;

  test("mounts an iframe at {frameHost}/link/start", () => {
    bootstrap({ onboardingLink: onboardingLink(), frameHost: location.origin });
    const iframe = host.querySelector("iframe");
    expect(iframe?.src).toBe(`${location.origin}/link/start`);
    expect(iframe?.style.width).toBe("420px");
    expect(iframe?.style.height).toBe("600px");
  });

  test("forwards pi-app messages from frameHost to the callbacks, and nothing else", () => {
    const success = vi.fn();
    const error = vi.fn();
    const message = vi.fn();
    bootstrap({ onboardingLink: onboardingLink(), frameHost: location.origin, callbacks: { success, error, message } });

    window.dispatchEvent(new MessageEvent("message", { origin: location.origin, data: { source: "pi-app", type: "success", value: "703" } }));
    expect(success).toHaveBeenCalledWith("703");

    // Wrong origin: silently dropped. This is why the demo must be served from an origin root.
    window.dispatchEvent(new MessageEvent("message", { origin: "https://elsewhere.example", data: { source: "pi-app", type: "success", value: "x" } }));
    expect(success).toHaveBeenCalledTimes(1);

    // Real SDK quirk: an error also invokes the message callback.
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    window.dispatchEvent(new MessageEvent("message", { origin: location.origin, data: { source: "pi-app", type: "error", value: "Token validation failed." } }));
    expect(error).toHaveBeenCalledWith("Token validation failed.");
    expect(message).toHaveBeenCalledWith("Token validation failed.");
    consoleError.mockRestore();
  });

  test("a frameHost with a path would never match message.origin", () => {
    const success = vi.fn();
    bootstrap({ onboardingLink: onboardingLink(), frameHost: `${location.origin}/onboarding-sdk-demo`, callbacks: { success } });
    window.dispatchEvent(new MessageEvent("message", { origin: location.origin, data: { source: "pi-app", type: "success", value: "x" } }));
    expect(success).not.toHaveBeenCalled();
  });

  test("calls error and throws when the link has no token", () => {
    const error = vi.fn();
    expect(() => bootstrap({ onboardingLink: "https://example.com/link", frameHost: location.origin, callbacks: { error } })).toThrow(/token/);
    expect(error).toHaveBeenCalled();
  });
});

describe("snippets", () => {
  test("use onboardingLink (not the testbed's onboardingUrl) and the given frameHost", () => {
    const npm = npmSnippet({ onboardingLink: "https://x/link?token=abc", frameHost: "https://demo.example" });
    expect(npm).toContain('import { bootstrap } from "@payroll-integrations/onboarding-sdk"');
    expect(npm).toContain("onboardingLink,");
    expect(npm).not.toContain("onboardingUrl");
    expect(npm).toContain('frameHost: "https://demo.example"');
    const cdn = cdnSnippet({ onboardingLink: "https://x/link?token=abc", frameHost: "https://demo.example" });
    expect(cdn).toContain("cdn.jsdelivr.net/npm/@payroll-integrations/onboarding-sdk@1.0.0/dist/onboarding-sdk.js");
    expect(cdn).toContain('<div id="pi-host"></div>');
  });
});
