import { getErrorText } from "../flow";
import type { RouteContext } from "../router";
import { logo } from "../ui/components";
import { element, html } from "../../shared/dom";
import { renderView } from "../ui/shell";
import { sendError } from "../window-messages";

/** Port of onboarding-error.component.html; posts the `error` message the SDK forwards to `callbacks.error`. */
export function renderError(ctx: RouteContext): void {
  const reason = ctx.query.get("reason");
  const text = getErrorText(reason) ?? reason ?? "An unknown error occurred.";
  renderView(
    element(html`
      <div class="flex-1 flex flex-col gap-4">
        <div class="flex justify-center mb-8"><div class="max-w-72 w-full">${logo()}</div></div>
        <div>
          <p>Oops, something went wrong.</p>
          <p>Please reply to the email invitation for more help.</p>
          <div role="alert" class="alert alert-error text-sm mt-4"><span>${text}</span></div>
        </div>
      </div>
    `),
  );
  sendError(text);
}
