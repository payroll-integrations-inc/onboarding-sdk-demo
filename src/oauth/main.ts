import "../style.css";
import { PAYROLL_PLATFORMS } from "../mock/fixtures";
import { element, html, initials, query } from "../shared/dom";
import { APP_SOURCE, POPUP_COMPLETE, type PopupCompleteMessage } from "../shared/messages";

/**
 * Emulated third-party pages the onboarding frame sends the user to:
 *  - mode=oauth (default)  a payroll provider's OAuth consent screen, opened in the popup
 *                          the frame manages (port of the real /popup-callback round trip)
 *  - mode=approval         a provider's "integrated apps" portal reached via a consent link
 *  - mode=marketplace      a provider's marketplace connector form reached via a link
 */
const params = new URLSearchParams(location.search);
const mode = params.get("mode") ?? "oauth";
const platformName = params.get("platform") ?? "";
const oauthState = params.get("state") ?? "";
const platform = PAYROLL_PLATFORMS.find((p) => p.name === platformName);
const displayName = platform?.displayName ?? "Payroll provider";

const root = query(document, "#app");

function deliver(result: Record<string, string>) {
  const message: PopupCompleteMessage = { ...result, state: oauthState, source: APP_SOURCE, type: POPUP_COMPLETE };
  const opener = window.opener as Window | null;
  if (opener && !opener.closed) {
    opener.postMessage(message, location.origin);
    window.close();
  }
  // Fallback for a blocked popup (opened as a tab): the frame polls localStorage for this key.
  try {
    const { source: _s, type: _t, ...stored } = message;
    localStorage.setItem(`pi-demo-oauth:${oauthState}`, JSON.stringify(stored));
  } catch {
    /* privacy mode */
  }
  root.replaceChildren(
    card(html`
      <h1 class="text-xl font-semibold m-0">${result.error ? "Access denied" : "Authorization complete"}</h1>
      <p class="m-0">You can close this window and return to the onboarding.</p>
    `),
  );
}

function card(content: ReturnType<typeof html>): HTMLElement {
  return element(html`
    <div class="card bg-base-100 shadow-md w-full max-w-md">
      <div class="card-body gap-4">
        <div class="flex items-center gap-3">
          <div aria-hidden="true" class="h-12 w-12 rounded-lg bg-base-200 text-primary font-semibold flex items-center justify-center">${initials(displayName)}</div>
          <div class="flex flex-col"><span class="font-semibold">${displayName}</span><span class="text-xs text-muted">Emulated provider · nothing here is real</span></div>
        </div>
        ${content}
      </div>
    </div>
  `);
}

if (mode === "approval") {
  root.replaceChildren(
    card(html`
      <h1 class="text-xl font-semibold m-0">${displayName} Integrated Apps</h1>
      <p class="m-0">The <strong>Payroll Integrations</strong> app has been approved for your company <span class="text-muted">(simulated)</span>.</p>
      <p class="m-0 text-sm text-muted">Return to the onboarding window, tick the confirmation box and continue.</p>
    `),
  );
} else if (mode === "marketplace") {
  root.replaceChildren(
    card(html`
      <h1 class="text-xl font-semibold m-0">${displayName} Marketplace</h1>
      <p class="m-0">Your request for the <strong>Payroll Integrations</strong> connector has been submitted <span class="text-muted">(simulated)</span>. A ${displayName} representative will follow up.</p>
      <p class="m-0 text-sm text-muted">Return to the onboarding window, tick the confirmation box and continue.</p>
    `),
  );
} else {
  const view = card(html`
    <h1 class="text-xl font-semibold m-0">Sign in to ${displayName}</h1>
    <label class="flex flex-col gap-1 text-sm">Email<input class="input w-full" value="admin@democompany.example" readonly /></label>
    <label class="flex flex-col gap-1 text-sm">Password<input class="input w-full" type="password" value="password" readonly /></label>
    <div class="rounded-box bg-base-200 p-3 text-sm flex flex-col gap-1">
      <span class="font-medium">Payroll Integrations would like to:</span>
      <ul class="m-0 pl-5 list-disc">
        <li>Read payroll runs and pay components</li>
        <li>Read employee census data</li>
        <li>Create and update employee deductions</li>
      </ul>
    </div>
    <div class="flex gap-2 justify-end">
      <button type="button" class="btn btn-ghost" data-deny>Deny</button>
      <button type="button" class="btn btn-primary" data-authorize>Authorize</button>
    </div>
  `);
  query(view, "[data-authorize]").addEventListener("click", () => deliver({ code: `demo-auth-code-${crypto.randomUUID().slice(0, 8)}` }));
  query(view, "[data-deny]").addEventListener("click", () =>
    deliver({ error: "access_denied", error_description: `You declined to grant Payroll Integrations access to ${displayName}.` }),
  );
  root.replaceChildren(view);
}
