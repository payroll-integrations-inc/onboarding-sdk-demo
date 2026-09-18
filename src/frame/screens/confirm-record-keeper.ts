import { api } from "../api";
import { errorMessage, refreshOnboardingUser, viewAfterRecordkeeper } from "../flow";
import { navigate } from "../router";
import { onboardingPlan, planRecordkeeper, showRecordkeeperSelection, state } from "../state";
import { button, dualLogoHeader } from "../ui/components";
import { element, html, query } from "../../shared/dom";
import { renderView, toast } from "../ui/shell";

/** Port of onboarding-confirm-record-keeper.component.html: the user supplies the plan id their recordkeeper gave them. */
export function renderConfirmRecordKeeper(): void {
  const plan = onboardingPlan();
  const recordkeeper = planRecordkeeper();
  if (!plan || !recordkeeper) {
    navigate(showRecordkeeperSelection() ? "select-record-keeper" : "error", { query: { reason: "No onboarding in progress. Please contact your recordkeeper." }, replace: true });
    return;
  }
  const locked = !plan.userProvideRecordkeeperIdentifier && Boolean(plan.recordKeeperCompanyIdentifier);
  const label = `${recordkeeper.displayName} Plan ID`;
  const description = locked
    ? "This identifier was provided by your recordkeeper."
    : `Enter the plan identifier ${recordkeeper.displayName} provided for ${plan.name}. Letters, digits and dashes, at least 3 characters.`;

  const confirm = button({ label: "Confirm", className: "w-full", onClick: () => void handleConfirm() });
  const view = element(html`
    <div class="flex-1 flex flex-col gap-4">
      ${dualLogoHeader(recordkeeper.displayName, `Confirm your ${recordkeeper.displayName} plan`)}
      <div class="flex flex-col gap-4 w-full items-center">
        <div class="flex flex-col mt-4 w-full gap-1">
          <label for="plan-id" class="font-medium">${locked ? "" : html`<span class="text-error select-none mr-1">*</span>`}<span>${label}</span></label>
          <input id="plan-id" type="text" class="input w-full" autocomplete="off" value="${plan.recordKeeperCompanyIdentifier ?? ""}" ${locked ? "disabled" : ""} placeholder="e.g. PLAN-001" />
          <span class="text-xs text-muted">${description}</span>
          <span class="text-xs text-error hidden" data-error></span>
        </div>
        <div class="flex flex-col mt-6 gap-3 w-60 items-stretch" data-actions></div>
      </div>
    </div>
  `);
  const input = query<HTMLInputElement>(view, "#plan-id");
  const error = query(view, "[data-error]");
  const actions = query(view, "[data-actions]");
  actions.appendChild(confirm);
  if (showRecordkeeperSelection()) {
    actions.appendChild(button({ label: "Change recordkeeper", variant: "ghost", className: "w-full", onClick: () => navigate("select-record-keeper") }));
  }
  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter") void handleConfirm();
  });
  renderView(view);
  if (!locked) input.focus();

  async function handleConfirm() {
    const value = input.value.trim();
    if (!locked && !/^[A-Za-z0-9-]{3,}$/.test(value)) {
      error.textContent = "Plan ID must be at least 3 letters, digits or dashes.";
      error.classList.remove("hidden");
      input.classList.add("input-error");
      return;
    }
    error.classList.add("hidden");
    input.classList.remove("input-error");
    confirm.setLoading(true);
    try {
      if (!locked) {
        await api.updateOnboardingPlan(state.onboardingUser!.id, plan!.id, { recordKeeperCompanyIdentifier: value });
        await refreshOnboardingUser();
      }
      navigate(viewAfterRecordkeeper());
    } catch (err) {
      toast(errorMessage(err), "error");
      confirm.setLoading(false);
    }
  }
}
