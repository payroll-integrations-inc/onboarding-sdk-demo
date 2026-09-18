import { DEMO_CHANNEL } from "./messages";

/**
 * Demo-only telemetry from the frame to the host page's developer panel.
 * Travels over a same-origin BroadcastChannel, so it never touches the SDK's
 * postMessage contract and cannot be confused with it.
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

type Listener = (event: DemoEvent) => void;

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

export function subscribeDemoEvents(listener: Listener): () => void {
  localListeners.add(listener);
  const bc = channel();
  const onMessage = (event: MessageEvent<DemoEvent>) => listener(event.data);
  bc?.addEventListener("message", onMessage);
  return () => {
    localListeners.delete(listener);
    bc?.removeEventListener("message", onMessage);
    bc?.close();
  };
}
