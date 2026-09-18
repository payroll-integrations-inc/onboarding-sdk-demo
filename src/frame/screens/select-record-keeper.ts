import { api } from "../api";
import { errorMessage, refreshOnboardingUser } from "../flow";
import { navigate } from "../router";
import { onboardingPlan, state } from "../state";
import { button, pageHeading, selectorList } from "../ui/components";
import { element, html } from "../../shared/dom";
import { renderView, toast } from "../ui/shell";

/** Port of onboarding-select-record-keeper.component.html */
export function renderSelectRecordKeeper(): void {
  const plan = onboardingPlan();
  const items = (state.recordKeepers ?? []).filter((rk) => !rk.hidden).map((rk) => ({ ...rk, id: rk.identifier }));
  const list = selectorList({
    items,
    searchPlaceholder: "Search recordkeepers",
    emptyMessage: "No matching recordkeeper found",
    onSelect: async (item) => {
      list.setDisabled(true);
      try {
        const recordKeeper = state.recordKeepers!.find((rk) => rk.identifier === item.identifier)!;
        await api.updateOnboardingPlan(state.onboardingUser!.id, state.onboardingPlanId!, { recordKeeperId: recordKeeper.id });
        await refreshOnboardingUser();
        navigate("confirm-record-keeper");
      } catch (error) {
        toast(errorMessage(error), "error");
        list.setDisabled(false);
      }
    },
  });
  const view = element(html`
    <div class="flex-1 flex flex-col gap-4 min-h-0">
      ${pageHeading("Let's connect", "Select your recordkeeper for", plan ? `${plan.name} (ID: ${plan.recordKeeperCompanyIdentifier ?? "pending"})` : undefined)}
      <div class="flex-1 flex flex-col gap-3 justify-between min-h-0" data-body></div>
    </div>
  `);
  const body = view.querySelector("[data-body]")!;
  body.appendChild(list);
  const back = element(html`<div class="flex justify-center"></div>`);
  back.appendChild(button({ label: "Back", variant: "ghost", className: "w-40", onClick: () => navigate("start") }));
  body.appendChild(back);
  renderView(view);
}
