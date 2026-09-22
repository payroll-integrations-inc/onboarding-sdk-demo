import { describe, expect, test, vi } from "vitest";
import { subscribeDemoEvents, type ApiLogEntry } from "./demo-log";

const entry: ApiLogEntry = { kind: "api", id: "1", at: 0, method: "GET", path: "onboarding/me", status: 200, durationMs: 5 };

describe("subscribeDemoEvents cross-origin path", () => {
  test("accepts a pi-demo message from the expected origin", () => {
    const listener = vi.fn();
    const unsubscribe = subscribeDemoEvents(listener, { expectedOrigin: "https://sandbox.secure.payrollintegrationsdemo.com" });
    window.dispatchEvent(
      new MessageEvent("message", {
        origin: "https://sandbox.secure.payrollintegrationsdemo.com",
        data: { source: "pi-demo", event: entry },
      }),
    );
    expect(listener).toHaveBeenCalledWith(entry);
    unsubscribe();
  });

  test("ignores messages from any other origin", () => {
    const listener = vi.fn();
    const unsubscribe = subscribeDemoEvents(listener, { expectedOrigin: "https://sandbox.secure.payrollintegrationsdemo.com" });
    window.dispatchEvent(new MessageEvent("message", { origin: "https://evil.example", data: { source: "pi-demo", event: entry } }));
    expect(listener).not.toHaveBeenCalled();
    unsubscribe();
  });

  test("ignores same-origin messages that aren't pi-demo, e.g. the real SDK contract", () => {
    const listener = vi.fn();
    const unsubscribe = subscribeDemoEvents(listener, { expectedOrigin: "https://sandbox.secure.payrollintegrationsdemo.com" });
    window.dispatchEvent(
      new MessageEvent("message", { origin: "https://sandbox.secure.payrollintegrationsdemo.com", data: { source: "pi-app", type: "success", value: "1" } }),
    );
    expect(listener).not.toHaveBeenCalled();
    unsubscribe();
  });

  test("without expectedOrigin, no window-message listener is installed", () => {
    const listener = vi.fn();
    const unsubscribe = subscribeDemoEvents(listener);
    window.dispatchEvent(new MessageEvent("message", { origin: "https://sandbox.secure.payrollintegrationsdemo.com", data: { source: "pi-demo", event: entry } }));
    expect(listener).not.toHaveBeenCalled();
    unsubscribe();
  });

  test("unsubscribe removes the window-message listener", () => {
    const listener = vi.fn();
    const unsubscribe = subscribeDemoEvents(listener, { expectedOrigin: "https://sandbox.secure.payrollintegrationsdemo.com" });
    unsubscribe();
    window.dispatchEvent(
      new MessageEvent("message", { origin: "https://sandbox.secure.payrollintegrationsdemo.com", data: { source: "pi-demo", event: entry } }),
    );
    expect(listener).not.toHaveBeenCalled();
  });
});
