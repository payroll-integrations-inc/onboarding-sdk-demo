import { publishFrameReceived } from "../shared/demo-log";
import { APP_SOURCE, isSdkToAppMessage, type AppToSdkMessage, type AppToSdkMessageType } from "../shared/messages";
import { state } from "./state";

/**
 * Port of the frame side of the postMessage contract:
 *  - inbound token: onboarding-start.component.ts `handleMessage` (any origin, first sender wins)
 *  - inbound style: onboarding.component.ts (origin must match the recorded frameOrigin)
 *  - outbound:      window-message.service.ts (only ever targets frameOrigin)
 */

export interface InboundHandlers {
  onToken?: (token: string) => void;
  onStyle?: (style: { height: string; width: string }) => void;
}

export function installInboundListener(handlers: InboundHandlers, target: Window = window): () => void {
  const listener = (event: MessageEvent) => {
    const data: unknown = event.data;
    if (!isSdkToAppMessage(data)) return;
    publishFrameReceived(data, event.origin);
    if (data.type === "token") {
      state.token = data.value;
      state.frameOrigin ??= event.origin;
      handlers.onToken?.(data.value);
    } else if (data.type === "style" && event.origin === state.frameOrigin) {
      handlers.onStyle?.(data.value);
    }
  };
  target.addEventListener("message", listener);
  return () => target.removeEventListener("message", listener);
}

export function postToParent(type: AppToSdkMessageType, value: unknown, target: Window = window): void {
  const frameOrigin = state.frameOrigin;
  if (!frameOrigin) return; // opened directly, nobody is listening
  const message: AppToSdkMessage = { source: APP_SOURCE, type, value };
  target.parent.postMessage(message, frameOrigin);
}

export const sendSuccess = (value: unknown) => postToParent("success", value);
export const sendError = (value: unknown) => postToParent("error", value);
