import { api } from "../api";
import { errorMessage, nextView, start } from "../flow";
import { navigate } from "../router";
import { state } from "../state";
import { button, logo } from "../ui/components";
import { element, html } from "../../shared/dom";
import { renderView } from "../ui/shell";

/** Port of onboarding-start.component.html / .ts */
export function renderStart(): void {
  const connect = button({ label: "Connect", className: "w-40", onClick: () => void connectClick() });

  const view = element(html`
    <div class="flex-1 flex flex-col justify-between gap-8">
      <div>
        <div class="mb-6 w-full flex justify-center"><div class="max-w-72 w-full">${logo()}</div></div>
        <p>Payroll Integrations connects your benefits and payroll platforms. Connecting will grant the following permissions to Payroll Integrations Inc.</p>
        <ul class="list-disc pl-6">
          <li class="my-1">Sync earnings and deductions</li>
          <li class="my-1">Retrieve historical pay data</li>
          <li class="my-1">Manage employee elections</li>
          <li class="my-1">Maintain employee election history</li>
        </ul>
      </div>
      <div class="flex flex-col gap-6">
        <div class="px-4 text-sm text-center text-muted">
          By continuing, you agree to the Payroll Integrations Inc.
          <a class="link" href="https://www.payrollintegrations.com/terms-and-conditions" target="_blank" rel="noreferrer">Terms&nbsp;and&nbsp;Conditions</a>
        </div>
        <div class="flex justify-center" data-connect></div>
      </div>
    </div>
  `);
  view.querySelector("[data-connect]")!.appendChild(connect);
  renderView(view);

  async function connectClick() {
    connect.setLoading(true);
    try {
      const token = state.token;
      const existingUserId = state.onboardingUser?.id;
      if (existingUserId) {
        await api.acceptTerms(existingUserId);
      } else if (token) {
        await start(token);
        const onboardingUserId = state.onboardingUser?.id;
        if (!onboardingUserId) throw new Error("No active onboarding session. Please contact your recordkeeper.");
        await api.acceptTerms(onboardingUserId);
      } else {
        throw new Error("No active onboarding session. Please contact your recordkeeper.");
      }
      const next = nextView();
      navigate(next.path, { query: next.query, replace: true });
    } catch (error) {
      navigate("error", { query: { reason: errorMessage(error) }, replace: true });
    } finally {
      connect.setLoading(false);
    }
  }
}
