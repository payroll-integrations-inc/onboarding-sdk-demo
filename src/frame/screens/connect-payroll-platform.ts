import { api, HttpError } from "../api";
import { errorMessage, loadPayrollPlatform, redirectStep, resumeStep, routeAfterStep, setDivisionConnectionStatus, submitPayrollPlatformStep } from "../flow";
import { openPopupWindow, popupCallback } from "../popup";
import { navigate, type RouteContext } from "../router";
import { dynamicData, onboardingPlan, requireIds } from "../state";
import { dualLogoHeader } from "../ui/components";
import { element, html, query } from "../../shared/dom";
import { renderDynamicForm, type DynamicFormHandle } from "../ui/dynamic-form";
import { clearToasts, loader, renderView, toast } from "../ui/shell";
import type { PayrollPlatformForOnboarding } from "../../mock/types";

/**
 * Port of onboarding-connect-payroll-platform.component.ts: renders the server-driven step,
 * runs its actions, then routes (next step / popup / verification retry / billing / done).
 */
export async function renderConnectPayrollPlatform(ctx: RouteContext): Promise<void> {
  const name = ctx.params.name ?? "";
  renderView(loader());
  let platform: PayrollPlatformForOnboarding | undefined;
  try {
    platform = await loadPayrollPlatform(name);
  } catch (error) {
    navigate("error", { query: { reason: errorMessage(error) }, replace: true });
    return;
  }
  if (!platform) {
    navigate("select-payroll-platform", { replace: true });
    return;
  }

  const stepNumber = ctx.params.step ? Number(ctx.params.step) : resumeStep(platform);
  if (!ctx.params.step) {
    navigate(`connect-payroll-platform/${platform.name}/steps/${stepNumber}`, { replace: true });
    return;
  }
  const step = platform.steps[stepNumber - 1];
  if (!step) {
    navigate(`connect-payroll-platform/${platform.name}/steps/1`, { replace: true });
    return;
  }

  const header = dualLogoHeader(platform.displayName, platform.headerText);
  const preselected = Boolean(onboardingPlan()?.payrollPlatformName);
  const showBackButton = (stepNumber === 1 && !preselected) || ("backButtonEnabled" in step && Boolean(step.backButtonEnabled));

  // Declared before the `automatic` branch below, which submits without rendering a form.
  let form: DynamicFormHandle | undefined;
  const popupNotice = element(html`<div role="status" class="alert alert-info text-sm hidden" data-popup-notice><span>Not seeing a window? Ensure your browser is not blocking popup windows.</span></div>`);
  const fallback = element(html`<div class="text-center text-sm hidden" data-fallback></div>`);

  if (step.type === "automatic") {
    renderView(
      element(html`
        <div class="flex-1 flex flex-col gap-8">
          ${header}
          <div class="flex-1 flex flex-col items-center justify-center gap-3 text-muted">
            <span class="loading loading-spinner loading-lg text-primary"></span>
            <span class="text-sm">Verifying your connection…</span>
          </div>
        </div>
      `),
    );
    await submit({});
    return;
  }

  form = renderDynamicForm({
    fields: step.type === "message" ? [{ id: `${step.id}-message`, type: "text", value: step.message }] : step.fields,
    dynamicData: dynamicData(),
    submitButton: step.actionButton,
    showBackButton,
    header,
    onSubmit: submit,
    onBack,
  });
  const view = element(html`<div class="flex-1 flex flex-col gap-4"></div>`);
  view.append(popupNotice, fallback, form.root);
  renderView(view);

  function onBack() {
    if (stepNumber > 1) navigate(`connect-payroll-platform/${platform!.name}/steps/${stepNumber - 1}`);
    else navigate("select-payroll-platform");
  }

  async function submit(value: Record<string, unknown>) {
    form?.setLoading(true);
    clearToasts();
    try {
      const result = await submitPayrollPlatformStep(platform!, stepNumber, value);
      if (result.type === "next") {
        const next = await routeAfterStep(platform!, stepNumber);
        navigate(next, { replace: true });
      } else if (result.type === "externalRedirect") {
        await handleExternalRedirect(result.url);
      } else {
        toast(result.error, "error", "Could Not Verify Connection");
        navigate(`connect-payroll-platform/${platform!.name}/steps/${redirectStep(platform!)}`, { replace: true });
      }
    } catch (error) {
      const message = errorMessage(error);
      const errorAction = "errorAction" in step! ? step!.errorAction : undefined;
      if (error instanceof HttpError && error.reason !== undefined && (errorAction === undefined || errorAction === "default")) {
        navigate("error", { query: { reason: message }, replace: true });
      } else {
        toast(message, "error");
        form?.setLoading(false);
      }
    }
  }

  async function handleExternalRedirect(url: string) {
    await setDivisionConnectionStatus("IN_PROGRESS");
    const oauthState = requireIds().onboardingDivisionId;
    const popup = openPopupWindow(url);
    const noticeTimer = setTimeout(() => {
      form?.setLoading(false);
      popupNotice.classList.remove("hidden");
      if (!popup) {
        fallback.innerHTML = "";
        fallback.appendChild(element(html`<a class="link link-primary" href="${url}" target="_blank" rel="opener">Open the authorization window</a>`));
        fallback.classList.remove("hidden");
      }
    }, popup ? 3000 : 0);
    try {
      const params = await popupCallback(popup, oauthState);
      clearTimeout(noticeTimer);
      popupNotice.classList.add("hidden");
      fallback.classList.add("hidden");
      clearToasts();
      if (params.error) {
        toast(params.error_description ?? "The payroll platform reported an error while connecting. Please try again.", "error", "Authorization failed");
        form?.setLoading(false);
        return;
      }
      form?.setLoading(true);
      await api.authorizeOAuth(requireIds(), params.code ?? "demo");
      // Re-run this step's actions: with authorization granted, create-division now succeeds.
      const result = await submitPayrollPlatformStep(platform!, stepNumber, {});
      if (result.type !== "next") throw new Error("Unexpected result after authorization.");
      const next = await routeAfterStep(platform!, stepNumber);
      navigate(next, { replace: true });
    } catch (error) {
      clearTimeout(noticeTimer);
      toast(errorMessage(error), "error");
      form?.setLoading(false);
    }
  }
}

export function connectStepPath(platformName: string, step?: number): string {
  return step ? `connect-payroll-platform/${platformName}/steps/${step}` : `connect-payroll-platform/${platformName}/steps`;
}

export { query };
