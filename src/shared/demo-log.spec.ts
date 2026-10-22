import { describe, expect, test, vi } from "vitest";
import { subscribeDemoEvents } from "./demo-log";
import { SANDBOX_ORIGIN } from "./sandbox";

// The exact shape pi/onboarding-ui's sandbox telemetry posts (emulated-backend/telemetry.ts).
const wire = {
  source: "pi-demo",
  type: "api",
  method: "POST",
  path: "onboarding/exchange",
  status: 200,
  request: { token: "t" },
  response: { id: "u1" },
};

function post(data: unknown, origin = SANDBOX_ORIGIN) {
  window.dispatchEvent(new MessageEvent("message", { origin, data }));
}

describe("subscribeDemoEvents", () => {
  test("turns a sandbox pi-demo api message into a log entry", () => {
    const listener = vi.fn();
    const unsubscribe = subscribeDemoEvents(listener, { expectedOrigin: SANDBOX_ORIGIN });
    post(wire);
    expect(listener).toHaveBeenCalledWith({
      at: expect.any(Number),
      method: "POST",
      path: "onboarding/exchange",
      status: 200,
      request: { token: "t" },
      response: { id: "u1" },
    });
    unsubscribe();
  });

  test("ignores messages from any other origin", () => {
    const listener = vi.fn();
    const unsubscribe = subscribeDemoEvents(listener, { expectedOrigin: SANDBOX_ORIGIN });
    post(wire, "https://evil.example");
    expect(listener).not.toHaveBeenCalled();
    unsubscribe();
  });

  test("ignores the real SDK contract and malformed pi-demo messages", () => {
    const listener = vi.fn();
    const unsubscribe = subscribeDemoEvents(listener, { expectedOrigin: SANDBOX_ORIGIN });
    post({ source: "pi-app", type: "success", value: "1" });
    post({ ...wire, type: "other" });
    post({ ...wire, status: "200" });
    post(null);
    expect(listener).not.toHaveBeenCalled();
    unsubscribe();
  });

  test("unsubscribe removes the listener", () => {
    const listener = vi.fn();
    const unsubscribe = subscribeDemoEvents(listener, { expectedOrigin: SANDBOX_ORIGIN });
    unsubscribe();
    post(wire);
    expect(listener).not.toHaveBeenCalled();
  });
});
