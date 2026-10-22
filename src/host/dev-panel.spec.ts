import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { createDevPanel, type DevPanel } from "./dev-panel";
import { SANDBOX_ORIGIN } from "../shared/sandbox";

function post(data: unknown, origin = SANDBOX_ORIGIN) {
  window.dispatchEvent(new MessageEvent("message", { origin, data }));
}

const items = (root: HTMLElement, list: string) =>
  Array.from(root.querySelectorAll(`[${list}] li:not([data-empty])`)).map((li) => li.textContent?.replace(/\s+/g, " ").trim());

describe("developer panel", () => {
  let root: HTMLElement;
  let panel: DevPanel;
  beforeEach(() => {
    root = document.createElement("div");
    document.body.appendChild(root);
    Element.prototype.scrollIntoView = () => undefined;
    panel = createDevPanel(root, SANDBOX_ORIGIN);
  });
  afterEach(() => root.remove());

  test("lists the sandbox frame's emulated API calls", () => {
    post({ source: "pi-demo", type: "api", method: "POST", path: "onboarding/exchange", status: 401, request: { token: "t" } });
    const [row] = items(root, "data-api");
    expect(row).toContain("401");
    expect(row).toContain("POST");
    expect(row).toContain("onboarding/exchange");
    expect(root.querySelector("[data-api] .badge")?.className).toContain("badge-error");
  });

  test("mirrors pi-app replies from the frame, and nothing from other origins or sources", () => {
    post({ source: "pi-app", type: "success", value: "703" });
    post({ source: "pi-app", type: "success", value: "spoofed" }, "https://evil.example");
    post({ source: "pi-demo", type: "api", method: "GET", path: "x", status: 200 }, "https://evil.example");
    post({ source: "pi-sdk", type: "token", value: "t" });
    const traffic = items(root, "data-traffic");
    expect(traffic).toHaveLength(1);
    expect(traffic[0]).toContain("frame → sdk");
    expect(traffic[0]).toContain('"703"');
    expect(items(root, "data-api")).toHaveLength(0);
  });

  test("clear() empties every list", () => {
    panel.logCallback("success", "703");
    post({ source: "pi-app", type: "success", value: "703" });
    post({ source: "pi-demo", type: "api", method: "GET", path: "onboarding/me", status: 200 });
    panel.clear();
    for (const list of ["data-callbacks", "data-traffic", "data-api"]) expect(items(root, list)).toHaveLength(0);
  });
});
