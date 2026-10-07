import { DEMO_CHANNEL } from "./messages";

/**
 * Demo-only telemetry from the frame to the host page's developer panel.
 *
 * Today's frame (src/frame/**) is same-origin with the host and publishes over a
 * BroadcastChannel. Once the frame moves to the PI-15486 sandbox origin it becomes
 * genuinely cross-origin, so it will publish via `window.parent.postMessage({source:
 * "pi-demo", event}, hostOrigin)` instead — a channel name and BroadcastChannel can't
 * cross origins. `subscribeDemoEvents` listens on both so this side of the switch can
 * ship ahead of the cutover: BroadcastChannel keeps today's interim frame working, and
 * the window-message listener is ready for the sandbox frame the moment frameHost
 * changes. Neither publish side is confused with the real SDK contract (`pi-sdk` /
 * `pi-app` sources) or with each other, since `pi-demo` is a distinct source string.
 */
export interface ApiLogEntry {
  kind: "api";
  id: string;
  at: number;
  method: string;
  path: string;
  status: number;
  durationMs: number;
  request?: unknown;
  response?: unknown;
}

/** A message the frame received from the SDK (token / style), echoed so the panel can show both directions. */
export interface FrameReceivedEntry {
  kind: "frame-received";
  id: string;
  at: number;
  origin: string;
  data: unknown;
}

export type DemoEvent = ApiLogEntry | FrameReceivedEntry;

/** Wire shape for the cross-origin path: `{ source: "pi-demo", event }` posted to the host's own origin. */
interface DemoPostMessage {
  source: typeof DEMO_CHANNEL;
  event: DemoEvent;
}

function isDemoPostMessage(data: unknown): data is DemoPostMessage {
  return typeof data === "object" && data !== null && (data as { source?: unknown }).source === DEMO_CHANNEL;
}

type Listener = (event: DemoEvent) => void;

export interface SubscribeOptions {
  /** When set, also listens for `pi-demo` window messages from this origin (the sandbox frame). */
  expectedOrigin?: string;
  target?: Window;
}

const localListeners = new Set<Listener>();

function channel(): BroadcastChannel | undefined {
  // jsdom and some privacy modes lack BroadcastChannel; the demo still works, only the panel goes quiet.
  return typeof BroadcastChannel === "undefined" ? undefined : new BroadcastChannel(DEMO_CHANNEL);
}

export function publishDemoEvent(event: DemoEvent): void {
  for (const listener of localListeners) listener(event);
  const bc = channel();
  if (!bc) return;
  try {
    bc.postMessage(event);
  } finally {
    bc.close();
  }
}

export function publishApiLog(entry: Omit<ApiLogEntry, "kind">): void {
  publishDemoEvent({ kind: "api", ...entry });
}

export function publishFrameReceived(data: unknown, origin: string): void {
  publishDemoEvent({ kind: "frame-received", id: crypto.randomUUID(), at: Date.now(), origin, data });
}

export function subscribeDemoEvents(listener: Listener, options: SubscribeOptions = {}): () => void {
  localListeners.add(listener);
  const bc = channel();
  const onChannelMessage = (event: MessageEvent<DemoEvent>) => listener(event.data);
  bc?.addEventListener("message", onChannelMessage);

  const { expectedOrigin, target = window } = options;
  const onWindowMessage = expectedOrigin
    ? (event: MessageEvent) => {
        if (event.origin !== expectedOrigin || !isDemoPostMessage(event.data)) return;
        listener(event.data.event);
      }
    : undefined;
  if (onWindowMessage) target.addEventListener("message", onWindowMessage);

  return () => {
    localListeners.delete(listener);
    bc?.removeEventListener("message", onChannelMessage);
    bc?.close();
    if (onWindowMessage) target.removeEventListener("message", onWindowMessage);
  };
}
