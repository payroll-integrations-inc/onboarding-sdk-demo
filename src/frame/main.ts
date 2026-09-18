import "../style.css";
import { api } from "./api";
import { errorMessage, resume } from "./flow";
import { navigate, parseHash, resolve, routes } from "./router";
import { renderBilling } from "./screens/billing";
import { renderConfirmRecordKeeper } from "./screens/confirm-record-keeper";
import { renderConnectPayrollPlatform } from "./screens/connect-payroll-platform";
import { renderEnd } from "./screens/end";
import { renderError } from "./screens/error";
import { renderMoreDivisions } from "./screens/more-divisions";
import { renderSelectPayrollPlatform } from "./screens/select-payroll-platform";
import { renderSelectRecordKeeper } from "./screens/select-record-keeper";
import { renderStart } from "./screens/start";
import { state } from "./state";
import { applyStyle, mountShell, renderView, loader } from "./ui/shell";
import { installInboundListener } from "./window-messages";

/**
 * Emulated onboarding frame. The real SDK loads this page at `{frameHost}/link/start`
 * and posts the token on iframe `load`; module scripts run before that event, so the
 * listener below is always in place first.
 */
installInboundListener({ onStyle: applyStyle });

const directToken = new URLSearchParams(location.search).get("token");
if (directToken) state.token = directToken;

const root = document.getElementById("app");
if (!root) throw new Error("Frame root #app missing");
mountShell(root);

// Routes mirror pi/onboarding-ui/src/app/app.routes.ts (children of `/link`).
const PUBLIC_ROUTES = new Set(["start", "error"]);
routes
  .add("GET", "start", renderStart)
  .add("GET", "error", renderError)
  .add("GET", "select-record-keeper", renderSelectRecordKeeper)
  .add("GET", "confirm-record-keeper", renderConfirmRecordKeeper)
  .add("GET", "select-payroll-platform", renderSelectPayrollPlatform)
  .add("GET", "connect-payroll-platform/:name/steps", renderConnectPayrollPlatform)
  .add("GET", "connect-payroll-platform/:name/steps/:step", renderConnectPayrollPlatform)
  .add("GET", "billing", renderBilling)
  .add("GET", "more-divisions", renderMoreDivisions)
  .add("GET", "end", renderEnd);

let navigationId = 0;
let lastPageViewedTimer: ReturnType<typeof setTimeout> | undefined;

async function handleRoute(): Promise<void> {
  const current = ++navigationId;
  const resolved = resolve(location.hash);
  if (!resolved) {
    navigate("start", { replace: true });
    return;
  }
  const { render, ctx } = resolved;

  if (!PUBLIC_ROUTES.has(parseHash(location.hash).path.split("/")[0] ?? "")) {
    if (!state.onboardingUser) {
      renderView(loader("Resuming your onboarding…"));
      try {
        await resume();
      } catch (error) {
        if (current !== navigationId) return;
        navigate("error", { query: { reason: errorMessage(error) }, replace: true });
        return;
      }
      if (current !== navigationId) return;
    }
    recordLastPageViewed(ctx.path);
  }
  await render(ctx);
}

/** The real app PATCHes `lastPageViewed` on every navigation (debounced) so an invite can resume later. */
function recordLastPageViewed(path: string) {
  const user = state.onboardingUser;
  if (!user) return;
  clearTimeout(lastPageViewedTimer);
  lastPageViewedTimer = setTimeout(() => {
    void api.updateOnboardingUser(user.id, { lastPageViewed: `/link/${path}` }).catch(() => undefined);
  }, 500);
}

window.addEventListener("hashchange", () => void handleRoute());
void handleRoute();
