import { api } from "../api";
import { errorMessage, finalizeDivisionOnboarding } from "../flow";
import { navigate } from "../router";
import { onboardingDivision, planRecordkeeper } from "../state";
import { button, logo, priceTierList } from "../ui/components";
import { element, html, query } from "../../shared/dom";
import { loader, renderView, toast } from "../ui/shell";
import { PRICE_TIERS } from "../../mock/fixtures";

const DECLINE_CARD = "4000000000000002";

/**
 * Port of onboarding-billing.component.html. The real screen embeds a Stripe Payment
 * Element; a public demo has no Stripe key, so a plain card form stands in and the
 * "payment method" is chosen from the card number (4000 0000 0000 0002 declines).
 */
export async function renderBilling(): Promise<void> {
  const division = onboardingDivision();
  const recordkeeper = planRecordkeeper();
  if (!division?.divisionId) {
    navigate("start", { replace: true });
    return;
  }
  renderView(loader("Preparing billing…"));
  try {
    await api.getBilling(division.divisionId);
  } catch (error) {
    navigate("error", { query: { reason: errorMessage(error) }, replace: true });
    return;
  }

  const tiers = PRICE_TIERS[recordkeeper?.pricingTiers ?? "RETIREMENT"] ?? PRICE_TIERS.RETIREMENT!;
  const submit = button({ label: "Submit payment information", type: "submit", className: "w-full" });
  const view = element(html`
    <form class="flex-1 flex flex-col gap-5" novalidate>
      <div class="flex justify-center"><div class="max-w-60 w-full">${logo()}</div></div>
      ${priceTierList(tiers, "*Billed monthly per connected payroll account, based on the number of employees paid. Demo pricing.")}
      <div class="flex flex-col gap-3">
        <div role="note" class="alert alert-info text-xs py-2"><span>Demo — no payment is processed. Use card <code>4000 0000 0000 0002</code> to see a declined payment.</span></div>
        <label class="flex flex-col gap-1 text-sm font-medium">Card number
          <input name="card" class="input w-full font-mono" inputmode="numeric" autocomplete="off" value="4242 4242 4242 4242" />
        </label>
        <div class="grid grid-cols-2 gap-3">
          <label class="flex flex-col gap-1 text-sm font-medium">Expiry
            <input name="exp" class="input w-full" autocomplete="off" value="12 / 34" />
          </label>
          <label class="flex flex-col gap-1 text-sm font-medium">CVC
            <input name="cvc" class="input w-full" autocomplete="off" value="123" />
          </label>
        </div>
        <span class="text-xs text-error hidden" data-error></span>
      </div>
      <div class="flex justify-center" data-actions></div>
    </form>
  `);
  query(view, "[data-actions]").appendChild(submit);
  const error = query(view, "[data-error]");
  view.addEventListener("submit", async (event) => {
    event.preventDefault();
    const card = query<HTMLInputElement>(view, "[name=card]").value.replace(/\s+/g, "");
    if (!/^\d{16}$/.test(card)) {
      error.textContent = "Enter a 16-digit card number.";
      error.classList.remove("hidden");
      return;
    }
    error.classList.add("hidden");
    submit.setLoading(true);
    try {
      const paymentMethodId = card === DECLINE_CARD ? "pm_card_declined" : "pm_card_visa";
      const result = await api.confirmBilling(division!.divisionId!, paymentMethodId);
      if (!result.status) {
        toast("We could not start the subscription with the provided payment method. Please try another card.", "error", "Payment declined");
        submit.setLoading(false);
        return;
      }
      await finalizeDivisionOnboarding();
      navigate("more-divisions", { replace: true });
    } catch (err) {
      toast(errorMessage(err), "error");
      submit.setLoading(false);
    }
  });
  renderView(view);
}
