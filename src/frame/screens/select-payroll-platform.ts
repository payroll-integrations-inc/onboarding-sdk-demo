import { api } from "../api";
import { errorMessage, loadPayrollPlatforms, refreshOnboardingUser } from "../flow";
import { navigate } from "../router";
import { onboardingPlan, requireIds } from "../state";
import { button, pageHeading, selectorList } from "../ui/components";
import { element, html, query } from "../../shared/dom";
import { loader, renderView, toast } from "../ui/shell";

/** Port of onboarding-select-payroll-platform.component.html */
export async function renderSelectPayrollPlatform(): Promise<void> {
  const plan = onboardingPlan();
  renderView(loader("Loading payroll providers…"));
  let platforms;
  try {
    platforms = await loadPayrollPlatforms();
  } catch (error) {
    navigate("error", { query: { reason: errorMessage(error) }, replace: true });
    return;
  }

  const list = selectorList({
    items: platforms.filter((p) => !p.hidden).map((p) => ({ id: p.name, displayName: p.displayName })),
    searchPlaceholder: "Search payroll providers",
    emptyMessage: "No matching payroll provider found",
    onSelect: async (item) => {
      list.setDisabled(true);
      try {
        await api.updateOnboardingDivision(requireIds(), { divisionInfo: { payrollPlatformName: item.id } });
        await refreshOnboardingUser();
        navigate(`connect-payroll-platform/${item.id}/steps/1`);
      } catch (error) {
        toast(errorMessage(error), "error");
        list.setDisabled(false);
      }
    },
  });

  const view = element(html`
    <div class="flex-1 flex flex-col gap-4 min-h-0">
      ${pageHeading("Let's connect", "Select your payroll software for", plan ? `${plan.name} (ID: ${plan.recordKeeperCompanyIdentifier ?? ""})` : undefined)}
      <div class="flex-1 flex flex-col gap-3 justify-between min-h-0" data-body></div>
    </div>
  `);
  const body = query(view, "[data-body]");
  body.appendChild(list);
  const back = element(html`<div class="flex justify-center"></div>`);
  back.appendChild(button({ label: "Back", variant: "ghost", className: "w-40", onClick: () => navigate("confirm-record-keeper") }));
  body.appendChild(back);
  renderView(view);
}
