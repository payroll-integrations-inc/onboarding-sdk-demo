import { isPopupCompleteMessage } from "../shared/messages";

/**
 * Port of pi/onboarding-ui/src/app/shared/services/popup-window.service.ts.
 * Opens the payroll platform's authorization page in a centred 600x700 popup and
 * waits for the `popup-complete` message the callback page posts to its opener.
 *
 * Demo addition: when the popup is blocked, the consent page (opened in a tab from
 * the fallback link) writes its result to localStorage and we pick it up by polling.
 */
export const POPUP_RESULT_KEY = (state: string) => `pi-demo-oauth:${state}`;

export function openPopupWindow(url: string, width = 600, height = 700): Window | null {
  const left = window.screenX + Math.max(0, (window.outerWidth - width) / 2);
  const top = window.screenY + Math.max(0, (window.outerHeight - height) / 2);
  const features = `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes,noopener=no`;
  return window.open(url, "pi-onboarding-popup", features);
}

export function popupCallback(popup: Window | null, oauthState: string, pollMs = 500): Promise<Record<string, string>> {
  return new Promise((resolve, reject) => {
    let done = false;
    const finish = (fn: () => void) => {
      if (done) return;
      done = true;
      window.removeEventListener("message", onMessage);
      clearInterval(timer);
      fn();
    };
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== location.origin || !isPopupCompleteMessage(event.data)) return;
      const { source: _source, type: _type, ...params } = event.data;
      finish(() => resolve(params));
    };
    const timer = setInterval(() => {
      let stored: string | null = null;
      try {
        stored = localStorage.getItem(POPUP_RESULT_KEY(oauthState));
      } catch {
        /* privacy mode */
      }
      if (stored) {
        try {
          localStorage.removeItem(POPUP_RESULT_KEY(oauthState));
        } catch {
          /* ignore */
        }
        finish(() => resolve(JSON.parse(stored!) as Record<string, string>));
        return;
      }
      if (popup && popup.closed) finish(() => reject(new Error("The authorization window was closed before completing.")));
    }, pollMs);
    window.addEventListener("message", onMessage);
  });
}
