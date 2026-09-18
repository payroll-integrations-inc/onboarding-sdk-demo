import { button } from "./components";
import { element, escapeHtml, html, query, queryAll, raw, type RawHtml } from "../../shared/dom";
import type {
  DynamicFormControl,
  DynamicFormInputText,
  OnboardingActionButton,
  OnboardingDynamicField,
} from "../../mock/types";
import { getPath } from "../flow";

/**
 * Renderer for server-driven onboarding steps, a port of
 * pi/onboarding-ui/src/app/shared/components/onboarding-dynamic-form.
 *
 * Supported: text, divider, link (incl. `dynamic` + `requiresClick`), copyText,
 * inputText, inputPassword, select, radio, binaryCheckbox; buttons submit,
 * submitWithConfirm, redirect, connect. Anything else renders a visible
 * "not implemented" note, as the real component's default branch does.
 */
export interface DynamicFormOptions {
  fields: OnboardingDynamicField[];
  dynamicData: Record<string, unknown>;
  submitButton: OnboardingActionButton;
  showBackButton: boolean;
  header?: RawHtml;
  onSubmit: (value: Record<string, unknown>) => void | Promise<void>;
  onBack: () => void;
}

export interface DynamicFormHandle {
  root: HTMLElement;
  setLoading(loading: boolean): void;
}

const FORM_CONTROL_TYPES = new Set(["inputText", "inputPassword", "select", "radio", "binaryCheckbox"]);

function isFormControl(field: OnboardingDynamicField): field is DynamicFormControl {
  return FORM_CONTROL_TYPES.has(field.type);
}

function displayValue(field: { value?: unknown; dynamic?: boolean }, dynamicData: Record<string, unknown>): string {
  if (field.dynamic && typeof field.value === "string") {
    const resolved = getPath(dynamicData, field.value);
    return resolved === undefined || resolved === null ? "" : String(resolved);
  }
  return field.value === undefined || field.value === null ? "" : String(field.value);
}

function fieldMarkup(field: OnboardingDynamicField, dynamicData: Record<string, unknown>): RawHtml {
  switch (field.type) {
    case "text":
      return html`<p class="m-0 whitespace-pre-line" id="${field.id}">${displayValue(field as { value: string }, dynamicData)}</p>`;
    case "divider":
      return html`<div class="divider my-1" id="${field.id}"></div>`;
    case "link": {
      const link = field as Extract<OnboardingDynamicField, { type: "link" }>;
      const href = displayValue(link, dynamicData);
      return html`
        <div class="flex justify-center">
          <a id="${field.id}" class="link link-primary font-medium" href="${href || "#"}" target="_blank" rel="noreferrer" data-link data-requires-click="${link.requiresClick ? "true" : "false"}">${link.label}</a>
        </div>
        ${link.requiresClick ? html`<p class="text-xs text-muted text-center m-0" data-link-hint="${field.id}">Open the link above to continue.</p>` : ""}
      `;
    }
    case "copyText": {
      const copy = field as Extract<OnboardingDynamicField, { type: "copyText" }>;
      const value = displayValue(copy, dynamicData);
      return html`
        <div class="flex flex-col gap-1" id="${field.id}">
          ${copy.label ? html`<span class="font-medium">${copy.label}</span>` : ""}
          <div class="join w-full">
            <input class="input join-item flex-1 font-mono text-sm" readonly value="${value}" />
            <button type="button" class="btn join-item" data-copy="${value}">Copy</button>
          </div>
          ${copy.description ? html`<span class="text-xs text-muted">${copy.description}</span>` : ""}
        </div>
      `;
    }
    case "inputText":
    case "inputPassword": {
      const control = field as DynamicFormInputText;
      const required = control.validators?.required?.value ? html`<span class="text-error select-none mr-1">*</span>` : "";
      return html`
        <div class="flex flex-col gap-1">
          <label class="font-medium" for="${field.id}">${required}${control.label}</label>
          <input id="${field.id}" name="${field.id}" class="input w-full" type="${field.type === "inputPassword" ? "password" : "text"}"
            placeholder="${control.placeholder ?? ""}" value="${control.initialValue ?? ""}" autocomplete="off" data-control />
          ${control.description ? html`<span class="text-xs text-muted">${control.description}</span>` : ""}
          <span class="text-xs text-error hidden" data-error-for="${field.id}"></span>
        </div>
      `;
    }
    case "select": {
      const control = field as Extract<DynamicFormControl, { type: "select" }>;
      return html`
        <div class="flex flex-col gap-1">
          <label class="font-medium" for="${field.id}">${control.label}</label>
          <select id="${field.id}" name="${field.id}" class="select w-full" data-control>
            <option value="" disabled ${control.initialValue ? "" : "selected"}>${control.placeholder ?? "Select…"}</option>
            ${control.options.map((o) => html`<option value="${o.value}" ${o.value === control.initialValue ? "selected" : ""}>${o.label}</option>`)}
          </select>
          ${control.description ? html`<span class="text-xs text-muted">${control.description}</span>` : ""}
          <span class="text-xs text-error hidden" data-error-for="${field.id}"></span>
        </div>
      `;
    }
    case "radio": {
      const control = field as Extract<DynamicFormControl, { type: "radio" }>;
      return html`
        <fieldset class="flex flex-col gap-1" data-radio="${field.id}">
          <legend class="font-medium">${control.label}</legend>
          ${control.options.map(
            (o) => html`<label class="flex items-center gap-2 cursor-pointer"><input type="radio" class="radio radio-primary radio-sm" name="${field.id}" value="${o.value}" ${o.value === control.initialValue ? "checked" : ""} />${o.label}</label>`,
          )}
          <span class="text-xs text-error hidden" data-error-for="${field.id}"></span>
        </fieldset>
      `;
    }
    case "binaryCheckbox": {
      const control = field as Extract<DynamicFormControl, { type: "binaryCheckbox" }>;
      return html`
        <label class="flex items-start gap-2 cursor-pointer">
          <input id="${field.id}" name="${field.id}" type="checkbox" class="checkbox checkbox-primary checkbox-sm mt-0.5" ${control.initialValue ? "checked" : ""} data-control />
          <span>${control.label}</span>
        </label>
      `;
    }
    default:
      return html`<div class="alert alert-warning text-xs"><span><code>${field.type}</code> field type is not implemented in this demo.</span></div>`;
  }
}

function validate(control: DynamicFormControl, value: unknown): string | null {
  const validators = control.validators as DynamicFormInputText["validators"] | undefined;
  const empty = value === undefined || value === null || value === "" || value === false;
  if (validators?.required?.value && empty) return validators.required.errorText ?? "This field is required.";
  if (typeof value !== "string" || value === "") return null;
  if (validators?.minLength && value.length < validators.minLength.value) return validators.minLength.errorText ?? `Must be at least ${validators.minLength.value} characters.`;
  if (validators?.maxLength && value.length > validators.maxLength.value) return validators.maxLength.errorText ?? `Must be at most ${validators.maxLength.value} characters.`;
  if (validators?.pattern && !new RegExp(validators.pattern.value).test(value)) return validators.pattern.errorText ?? "Invalid format.";
  if (validators?.email?.value && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value)) return validators.email.errorText ?? "Enter a valid email address.";
  return null;
}

function submitLabel(button: OnboardingActionButton): string {
  switch (button.type) {
    case "connect":
      return "Connect";
    case "redirect":
      return button.text ?? "Continue";
    default:
      return button.text ?? "Submit";
  }
}

export function renderDynamicForm(options: DynamicFormOptions): DynamicFormHandle {
  const { fields, submitButton } = options;
  const controls = fields.filter(isFormControl);
  const confirm = submitButton.type === "submitWithConfirm" ? submitButton : undefined;

  const form = element<HTMLFormElement>(html`
    <form class="flex-1 flex flex-col justify-between gap-6" novalidate>
      <div class="flex flex-col gap-5">
        ${options.header ?? ""}
        <div class="flex flex-col gap-4" data-fields>${fields.map((field) => fieldMarkup(field, options.dynamicData))}</div>
        ${confirm
          ? html`<label class="flex items-start gap-2 cursor-pointer text-sm">
              <input type="checkbox" class="checkbox checkbox-primary checkbox-sm mt-0.5" data-confirm />
              <span>${confirm.confirmText}</span>
            </label>`
          : ""}
      </div>
      <div class="flex flex-col items-center gap-2" data-actions></div>
    </form>
  `);

  // Links that must be opened before the user can proceed (paychex/paylocity style consent links).
  const gatingLinks = queryAll<HTMLAnchorElement>(form, "a[data-requires-click='true']");
  const clickedLinks = new Set<HTMLAnchorElement>();
  for (const link of gatingLinks) {
    link.addEventListener("click", () => {
      clickedLinks.add(link);
      form.querySelector(`[data-link-hint="${link.id}"]`)?.classList.add("hidden");
      updateSubmitState();
    });
  }

  for (const copyBtn of queryAll<HTMLButtonElement>(form, "[data-copy]")) {
    copyBtn.addEventListener("click", async () => {
      await navigator.clipboard?.writeText(copyBtn.dataset.copy ?? "");
      copyBtn.textContent = "Copied";
      setTimeout(() => (copyBtn.textContent = "Copy"), 1500);
    });
  }

  const confirmBox = form.querySelector<HTMLInputElement>("[data-confirm]");
  confirmBox?.addEventListener("change", updateSubmitState);

  const actions = query(form, "[data-actions]");
  const primary =
    submitButton.type === "redirect"
      ? undefined
      : button({ label: submitLabel(submitButton), type: "submit", className: "w-52", color: submitButton.type === "connect" ? "primary" : "primary" });
  if (submitButton.type === "redirect") {
    actions.appendChild(element(html`<a class="btn btn-primary w-52" href="${submitButton.href}" target="_blank" rel="noreferrer">${submitLabel(submitButton)}</a>`));
  } else if (primary) {
    actions.appendChild(primary);
  }
  if (options.showBackButton) {
    actions.appendChild(button({ label: "Back", variant: "ghost", className: "w-52", onClick: () => options.onBack() }));
  }

  function readValue(control: DynamicFormControl): unknown {
    if (control.type === "radio") {
      return form.querySelector<HTMLInputElement>(`input[name="${control.id}"]:checked`)?.value ?? "";
    }
    const input = form.querySelector<HTMLInputElement | HTMLSelectElement>(`[name="${control.id}"]`);
    if (!input) return undefined;
    if (control.type === "binaryCheckbox") return (input as HTMLInputElement).checked;
    return input.value;
  }

  function updateSubmitState() {
    if (!primary) return;
    const linksOk = gatingLinks.every((link) => clickedLinks.has(link));
    const confirmOk = !confirmBox || confirmBox.checked;
    primary.disabled = !(linksOk && confirmOk);
  }
  updateSubmitState();

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    let valid = true;
    const value: Record<string, unknown> = {};
    for (const control of controls) {
      const current = readValue(control);
      value[control.id] = current;
      const error = validate(control, current);
      const errorEl = form.querySelector<HTMLElement>(`[data-error-for="${control.id}"]`);
      if (errorEl) {
        errorEl.textContent = error ?? "";
        errorEl.classList.toggle("hidden", !error);
      }
      form.querySelector(`[name="${control.id}"]`)?.classList.toggle("input-error", Boolean(error));
      if (error) valid = false;
    }
    if (!valid) return;
    await options.onSubmit(value);
  });

  return {
    root: form,
    setLoading(loading: boolean) {
      primary?.setLoading(loading);
      for (const input of queryAll<HTMLInputElement>(form, "[data-control], [data-confirm]")) input.disabled = loading;
    },
  };
}

/** Renders the raw marketplace/consent HTML the API occasionally ships (kept for parity; unused by the fixtures). */
export function trustedHtml(markup: string): RawHtml {
  return raw(markup.replace(/<script[\s\S]*?<\/script>/gi, "")); // strip scripts, everything else came from our own fixtures
}

export { escapeHtml };
