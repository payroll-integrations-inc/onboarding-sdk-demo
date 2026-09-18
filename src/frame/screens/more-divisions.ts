import { api } from "../api";
import { errorMessage, refreshOnboardingUser } from "../flow";
import { navigate } from "../router";
import { onboardingPlan, state, updatePlanDivisionIds } from "../state";
import { button, logo } from "../ui/components";
import { element, html, query } from "../../shared/dom";
import { renderView, toast } from "../ui/shell";

/** Port of onboarding-more-divisions.component.html / .ts */
export async function renderMoreDivisions(): Promise<void> {
  const plan = onboardingPlan();
  const user = state.onboardingUser;
  if (!plan || !user) {
    navigate("start", { replace: true });
    return;
  }
  const external = user.source === "EXTERNAL";
  const another = button({
    label: external ? "Add an additional company" : "Connect another payroll account",
    variant: "outline",
    size: "sm",
    onClick: () => void handleYes(),
  });
  const view = element(html`
    <div class="flex-1 flex flex-col gap-4">
      <div class="max-w-72 w-full">${logo()}</div>
      <div class="flex-1 flex flex-col justify-center items-center">
        <div class="text-center">
          <h2 class="text-2xl font-semibold">Almost there!</h2>
          <p class="my-8">Your connection is almost done! We just need to verify your information and you'll be all set.</p>
          <div data-complete></div>
        </div>
      </div>
      <div class="mt-12 text-center flex flex-col items-center gap-2">
        <p class="text-sm m-0">${external ? "Have another company to connect?" : "Have another payroll account on your plan?"}</p>
        <div data-another></div>
      </div>
    </div>
  `);
  query(view, "[data-complete]").appendChild(button({ label: "Complete Connection", onClick: () => navigate("end") }));
  query(view, "[data-another]").appendChild(another);
  renderView(view);

  try {
    // Reaching this screen marks the plan complete; "connect another" reopens it below.
    if (!plan.complete) {
      await api.updateOnboardingPlan(user.id, plan.id, { complete: true });
      await refreshOnboardingUser();
    }
  } catch (error) {
    toast(errorMessage(error), "error");
  }

  async function handleYes() {
    another.setLoading(true);
    try {
      await api.updateOnboardingPlan(user!.id, plan!.id, { complete: false });
      const division = await api.createOnboardingDivision(user!.id, plan!.id);
      await refreshOnboardingUser();
      updatePlanDivisionIds(plan!.id, division.id);
      navigate("select-payroll-platform");
    } catch (error) {
      toast(errorMessage(error), "error");
      another.setLoading(false);
    }
  }
}
