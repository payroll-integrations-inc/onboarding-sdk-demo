import { DEMO_CHANNEL } from "./messages";

/**
 * Demo-only telemetry from the sandbox frame to the host page's developer panel.
 *
 * The sandbox onboarding-ui (pi/onboarding-ui, `sandbox` build) reports each call its
 * emulated backend served as `window.parent.postMessage({ source: "pi-demo", type: "api",
 * method, path, status, request, response }, hostOrigin)`. It is cross-origin, so this is
 * the only channel. `pi-demo` is a distinct source string, so these are never confused
 * with the real SDK contract (`pi-sdk` / `pi-app`).
 */
export interface ApiLogEntry {
  /** When the host page received the entry; the frame does not send a timestamp. */
  at: number;
  method: string;
  path: string;
  status: number;
  request?: unknown;
  response?: unknown;
}

interface DemoApiMessage {
  source: typeof DEMO_CHANNEL;
  type: "api";
  method: string;
  path: string;
  status: number;
  request?: unknown;
  response?: unknown;
}

function isDemoApiMessage(data: unknown): data is DemoApiMessage {
  if (typeof data !== "object" || data === null) return false;
  const d = data as Record<string, unknown>;
  return (
    d.source === DEMO_CHANNEL &&
    d.type === "api" &&
    typeof d.method === "string" &&
    typeof d.path === "string" &&
    typeof d.status === "number"
  );
}

export interface SubscribeOptions {
  /** Only messages from this origin (the sandbox frame) are accepted. */
  expectedOrigin: string;
  target?: Window;
}

export function subscribeDemoEvents(listener: (entry: ApiLogEntry) => void, options: SubscribeOptions): () => void {
  const { expectedOrigin, target = window } = options;
  const onMessage = (event: MessageEvent) => {
    if (event.origin !== expectedOrigin || !isDemoApiMessage(event.data)) return;
    const { method, path, status, request, response } = event.data;
    listener({ at: Date.now(), method, path, status, request, response });
  };
  target.addEventListener("message", onMessage);
  return () => target.removeEventListener("message", onMessage);
}
