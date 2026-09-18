import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { resetState, state } from "./state";
import { installInboundListener, postToParent } from "./window-messages";

describe("frame side of the postMessage contract", () => {
  let uninstall: (() => void) | undefined;
  beforeEach(() => resetState());
  afterEach(() => uninstall?.());

  test("token is accepted from any origin and the first sender becomes frameOrigin", () => {
    const onToken = vi.fn();
    uninstall = installInboundListener({ onToken });
    window.dispatchEvent(new MessageEvent("message", { origin: "https://customer.example", data: { source: "pi-sdk", type: "token", value: "t1" } }));
    window.dispatchEvent(new MessageEvent("message", { origin: "https://other.example", data: { source: "pi-sdk", type: "token", value: "t2" } }));
    expect(onToken).toHaveBeenCalledTimes(2);
    expect(state.token).toBe("t2");
    expect(state.frameOrigin).toBe("https://customer.example");
  });

  test("style is only honoured from the recorded frameOrigin", () => {
    const onStyle = vi.fn();
    uninstall = installInboundListener({ onStyle });
    window.dispatchEvent(new MessageEvent("message", { origin: "https://customer.example", data: { source: "pi-sdk", type: "token", value: "t" } }));
    window.dispatchEvent(new MessageEvent("message", { origin: "https://evil.example", data: { source: "pi-sdk", type: "style", value: { height: "1px", width: "1px" } } }));
    expect(onStyle).not.toHaveBeenCalled();
    window.dispatchEvent(new MessageEvent("message", { origin: "https://customer.example", data: { source: "pi-sdk", type: "style", value: { height: "700px", width: "500px" } } }));
    expect(onStyle).toHaveBeenCalledWith({ height: "700px", width: "500px" });
  });

  test("unrelated messages are ignored", () => {
    const onToken = vi.fn();
    uninstall = installInboundListener({ onToken });
    window.dispatchEvent(new MessageEvent("message", { origin: "https://x", data: { source: "pi-demo", type: "token", value: "nope" } }));
    window.dispatchEvent(new MessageEvent("message", { origin: "https://x", data: "string" }));
    expect(onToken).not.toHaveBeenCalled();
    expect(state.token).toBeUndefined();
  });

  test("outbound messages target frameOrigin exactly and are dropped without one", () => {
    const parentPost = vi.fn();
    const fakeWindow = { parent: { postMessage: parentPost } } as unknown as Window;
    postToParent("success", "42", fakeWindow);
    expect(parentPost).not.toHaveBeenCalled();
    state.frameOrigin = "https://customer.example";
    postToParent("success", "42", fakeWindow);
    expect(parentPost).toHaveBeenCalledWith({ source: "pi-app", type: "success", value: "42" }, "https://customer.example");
  });
});
