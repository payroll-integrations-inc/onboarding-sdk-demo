import { api } from "../api";
import { onboardingPlan, state } from "../state";
import { logo } from "../ui/components";
import { element, html } from "../../shared/dom";
import { renderView } from "../ui/shell";
import { sendSuccess } from "../window-messages";

/** Port of onboarding-end.component.html; posts the `success` message the SDK forwards to `callbacks.success`. */
export async function renderEnd(): Promise<void> {
  const plan = onboardingPlan();
  const user = state.onboardingUser;
  renderView(
    element(html`
      <div class="flex-1 flex flex-col items-center gap-4 text-center">
        <div class="max-w-72 w-full mt-12">${logo()}</div>
        <h1 class="text-3xl font-semibold m-0">Connection complete!</h1>
        ${plan ? html`<div class="flex justify-center text-center">${plan.name} (ID: ${plan.recordKeeperCompanyIdentifier ?? ""})</div>` : ""}
        ${user?.source !== "EXTERNAL" ? html`<p>You will receive further updates on the progress of your integration via email.</p>` : ""}
        <p>You may now close this window.</p>
      </div>
    `),
  );
  // The real screen reports the plan sponsor id created for this employer; '' when none exists.
  sendSuccess(plan?.planSponsorId ?? "");
  if (user && plan && !plan.complete) {
    try {
      await api.endOnboardingPlan(user.id, plan.id);
    } catch {
      /* the user already sees success; the emulated backend state is best-effort here */
    }
  }
}
