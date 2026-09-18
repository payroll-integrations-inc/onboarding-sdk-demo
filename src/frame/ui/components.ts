import { element, html, initials, query, queryAll, raw, type RawHtml } from "../../shared/dom";
import type { PriceTier } from "../../mock/types";

/** Shared widgets: ports of pi-ui `piButton`, `pay-logo`, `pay-dual-logo-header`, `pay-onboarding-selector`, `pay-price-tier-list`. */

export interface ButtonOptions {
  label: string;
  color?: "primary" | "success" | "neutral";
  variant?: "solid" | "ghost" | "outline";
  size?: "sm" | "md";
  className?: string;
  type?: "button" | "submit";
  disabled?: boolean;
  onClick?: (event: MouseEvent) => void;
}

export function button(options: ButtonOptions): HTMLButtonElement & { setLoading(loading: boolean): void } {
  const color = options.color === "success" ? "btn-success" : options.color === "neutral" ? "btn-neutral" : "btn-primary";
  const variant = options.variant === "ghost" ? "btn-ghost" : options.variant === "outline" ? "btn-outline" : "";
  const size = options.size === "sm" ? "btn-sm" : "";
  const btn = element<HTMLButtonElement>(html`
    <button type="${options.type ?? "button"}" class="btn ${variant ? `${variant} ${options.variant === "outline" ? color : ""}` : color} ${size} ${options.className ?? ""}">
      <span class="loading loading-spinner loading-xs hidden" data-spinner></span>
      <span data-label>${options.label}</span>
    </button>
  `) as HTMLButtonElement & { setLoading(loading: boolean): void };
  btn.disabled = Boolean(options.disabled);
  if (options.onClick) btn.addEventListener("click", options.onClick);
  let wasDisabled = btn.disabled;
  btn.setLoading = (loading: boolean) => {
    query(btn, "[data-spinner]").classList.toggle("hidden", !loading);
    if (loading) {
      wasDisabled = btn.disabled;
      btn.disabled = true;
    } else {
      btn.disabled = wasDisabled;
    }
  };
  return btn;
}

export function logo(fileName = "payrollintegrations.png", className = "max-w-72"): RawHtml {
  return html`<div class="w-full flex justify-center"><img class="${className} w-full" src="/assets/images/logos/${fileName}" alt="Payroll Integrations" /></div>`;
}

/** Stands in for third-party logos, which the public demo does not ship. */
export function initialsTile(name: string, className = "h-16 w-16 text-xl"): RawHtml {
  return html`<div aria-hidden="true" class="${className} rounded-lg bg-base-200 text-primary font-semibold flex items-center justify-center select-none">${initials(name)}</div>`;
}

export function dualLogoHeader(platformName: string, headerText?: string): RawHtml {
  return html`
    <div class="flex flex-col gap-6">
      <div aria-hidden="true" class="flex justify-center items-center gap-2 h-20">
        ${initialsTile(platformName, "h-20 w-20 text-2xl")}
        <span class="text-3xl font-bold select-none">+</span>
        <img class="max-h-full max-w-20" src="/assets/images/logos/PI-logo.png" alt="Payroll Integrations logo" />
      </div>
      ${headerText ? html`<h2 class="text-xl font-normal text-center m-0">${headerText}</h2>` : ""}
    </div>
  `;
}

export interface SelectorItem {
  id: string;
  displayName: string;
}

export interface SelectorOptions<T extends SelectorItem> {
  items: T[];
  searchPlaceholder: string;
  emptyMessage: string;
  onSelect: (item: T) => void;
}

export function selectorList<T extends SelectorItem>(options: SelectorOptions<T>): HTMLElement & { setDisabled(disabled: boolean): void } {
  const root = element(html`
    <div class="flex-1 flex flex-col gap-3 min-h-0">
      <div class="flex justify-center">
        <label class="input w-full max-w-80">
          <input type="search" class="grow" placeholder="${options.searchPlaceholder}" aria-label="${options.searchPlaceholder}" />
          <svg class="h-4 w-4 opacity-50" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>
        </label>
      </div>
      <ul class="m-0 p-0 list-none flex flex-col overflow-auto divide-y divide-base-300" data-list></ul>
    </div>
  `) as HTMLElement & { setDisabled(disabled: boolean): void };
  const list = query<HTMLUListElement>(root, "[data-list]");
  const input = query<HTMLInputElement>(root, "input");
  let disabled = false;

  const renderItems = (term: string) => {
    const needle = term.trim().toLowerCase();
    const visible = options.items.filter((item) => item.displayName.toLowerCase().includes(needle));
    if (visible.length === 0) {
      list.replaceChildren(element(html`<li class="flex justify-center items-center h-40 text-muted">${options.emptyMessage}</li>`));
      return;
    }
    list.replaceChildren(
      ...visible.map((item) => {
        const li = element(html`
          <li>
            <button type="button" class="btn btn-ghost w-full h-[76px] py-0 font-normal justify-between" data-id="${item.id}">
              <span class="text-lg text-left">${item.displayName}</span>
              ${initialsTile(item.displayName, "h-12 w-12 text-base")}
            </button>
          </li>
        `);
        const btn = query<HTMLButtonElement>(li, "button");
        btn.disabled = disabled;
        btn.addEventListener("click", () => options.onSelect(item));
        return li;
      }),
    );
  };
  input.addEventListener("input", () => renderItems(input.value));
  renderItems("");
  root.setDisabled = (value: boolean) => {
    disabled = value;
    for (const btn of queryAll<HTMLButtonElement>(list, "button")) btn.disabled = value;
  };
  return root;
}

export function priceTierList(tiers: PriceTier[], hint: string): RawHtml {
  return html`
    <div class="flex flex-col gap-2">
      <table class="table table-sm">
        <thead><tr><th>${tiers[0]?.tierDescription ?? "Employees"}</th><th class="text-right">Price</th></tr></thead>
        <tbody>
          ${tiers.map((tier) => html`<tr><td>${tier.tierName}</td><td class="text-right font-medium">$${tier.price}<span class="text-muted text-xs">${tier.pricePeriod}</span></td></tr>`)}
        </tbody>
      </table>
      <p class="text-xs text-muted m-0">${raw(hint)}</p>
    </div>
  `;
}

export function pageHeading(title: string, subtitle?: string, detail?: string): RawHtml {
  return html`
    <div class="flex flex-col gap-2">
      <div class="text-4xl text-center">${title}</div>
      ${subtitle ? html`<div class="text-sm text-center">${subtitle}</div>` : ""}
      ${detail ? html`<div class="flex justify-center text-center">${detail}</div>` : ""}
    </div>
  `;
}
