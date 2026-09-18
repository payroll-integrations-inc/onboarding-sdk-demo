import "../style.css";
import { bootstrap } from "@payroll-integrations/onboarding-sdk";
import { createDevPanel, type DevPanel } from "./dev-panel";
import { query } from "../shared/dom";
import { isScenario, makeDemoToken, type Scenario } from "../shared/token";

/**
 * The "customer" page. Everything on the SDK side of the iframe boundary is the real,
 * published @payroll-integrations/onboarding-sdk; everything behind it is emulated.
 *
 * Two modes, decided by `?developer=true` (index.html sets `html.developer` before paint):
 *  - basic (default): the connect button and the frame, nothing else
 *  - developer: scenario picker, status, and the developer panel
 *
 * `frameHost` must be a bare origin: the SDK compares `message.origin === frameHost`
 * with strict equality before invoking any callback (onboarding-sdk/src/main.ts).
 */
const frameHost = location.origin;
const DEMO_DB_KEY = "pi-demo-db";
export const developerMode = document.documentElement.classList.contains("developer");

const connectButton = query<HTMLButtonElement>(document, "#connect-btn");
const scenarioSelect = query<HTMLSelectElement>(document, "#scenario");
const status = query<HTMLElement>(document, "#status");
const basicStatus = query<HTMLElement>(document, "#basic-status");
const panel: DevPanel | undefined = developerMode ? createDevPanel(query(document, "#dev-panel")) : undefined;

function setStatus(text: string, tone: "neutral" | "success" | "error" = "neutral") {
  status.textContent = text;
  status.className = `badge ${tone === "success" ? "badge-success" : tone === "error" ? "badge-error" : "badge-ghost"}`;
  if (tone === "neutral") {
    basicStatus.classList.add("hidden");
  } else {
    basicStatus.textContent = text;
    basicStatus.className = `m-0 text-sm text-center ${tone === "success" ? "text-success" : "text-error"}`;
  }
}

function currentScenario(): Scenario {
  return developerMode && isScenario(scenarioSelect.value) ? scenarioSelect.value : "happy";
}

function run() {
  const scenario = currentScenario();
  // Fresh emulated backend per run (the frame shares this tab's sessionStorage).
  try {
    sessionStorage.removeItem(DEMO_DB_KEY);
  } catch {
    /* privacy mode */
  }
  panel?.clear();
  setStatus("Onboarding in progress…");

  // In production this link comes from your server via the Create Employer Invite Session endpoint.
  const token = makeDemoToken(scenario, 3);
  const onboardingLink = `https://secure.payrollintegrationsdemo.com/link?token=${token}&plan=3`;
  panel?.setSnippet({ onboardingLink, frameHost });

  try {
    bootstrap({
      onboardingLink,
      selector: "#pi-host",
      frameHost,
      callbacks: {
        success: (value) => {
          panel?.logCallback("success", value);
          setStatus(`Connected · plan sponsor ${value || "(none)"}`, "success");
        },
        error: (value) => {
          panel?.logCallback("error", value);
          setStatus("Onboarding error", "error");
        },
        message: (value) => panel?.logCallback("message", value),
      },
    });
  } catch (error) {
    // The SDK calls callbacks.error and then throws for configuration problems.
    panel?.logCallback("throw", error instanceof Error ? error.message : String(error));
    setStatus("SDK threw", "error");
  }
  connectButton.textContent = "Restart onboarding";
}

connectButton.addEventListener("click", run);
scenarioSelect.addEventListener("change", () => {
  connectButton.textContent = "Connect with Payroll Integrations";
});
