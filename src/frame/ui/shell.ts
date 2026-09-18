import { element, html, query } from "../../shared/dom";

/**
 * Card shell: port of onboarding.component.html + page-footer.component.html.
 * Inside the SDK's fixed 420x600 iframe the real app uses its mobile layout
 * (full height, padded, scrollable), so that is the only layout we build.
 */
let wrapper: HTMLElement | undefined;
let view: HTMLElement | undefined;
let toastHost: HTMLElement | undefined;

const FOOTER_LINKS = [
  { label: "Terms", url: "https://www.payrollintegrations.com/terms-and-conditions" },
  { label: "Privacy", url: "https://www.payrollintegrations.com/privacy-policy" },
  { label: "Contact", url: "https://www.payrollintegrations.com/contact" },
];

export function mountShell(root: HTMLElement): void {
  const year = new Date().getFullYear();
  wrapper = element(html`
    <div id="onboarding-wrapper" class="h-full w-full flex flex-col overflow-auto bg-base-100 text-base-content">
      <div id="toast-host" class="toast toast-top toast-center z-50 w-[calc(100%-2rem)] max-w-sm"></div>
      <!-- shrink-0: tall screens (billing, consent) push the footer down and the wrapper scrolls, instead of overlapping it -->
      <main id="view" class="flex-1 shrink-0 flex flex-col gap-4 p-6"></main>
      <footer class="m-4 flex flex-col items-center gap-2 text-sm">
        <nav>
          <ul class="my-2 p-0 flex gap-4 list-none">
            ${FOOTER_LINKS.map(
              (link) => html`<li><a class="text-muted no-underline hover:underline" href="${link.url}" target="_blank" rel="noreferrer">${link.label}</a></li>`,
            )}
          </ul>
        </nav>
        <div class="text-center text-muted"><span>© 2016-${year} Payroll Integrations Inc.</span><br /><span>All rights reserved.</span></div>
      </footer>
    </div>
  `);
  root.replaceChildren(wrapper);
  view = query(wrapper, "#view");
  toastHost = query(wrapper, "#toast-host");
}

export function renderView(...nodes: (Node | string)[]): void {
  if (!view) throw new Error("Shell not mounted");
  view.replaceChildren(...nodes);
  view.scrollTop = 0;
}

export function applyStyle(style: { height: string; width: string }): void {
  if (!wrapper) return;
  wrapper.style.height = style.height;
  wrapper.style.width = style.width;
}

export type ToastSeverity = "error" | "info" | "success" | "warning";

export function toast(message: string, severity: ToastSeverity = "info", summary?: string, ttlMs = 6000): void {
  if (!toastHost) return;
  const alertClass = { error: "alert-error", info: "alert-info", success: "alert-success", warning: "alert-warning" }[severity];
  const node = element(html`
    <div role="alert" class="alert ${alertClass} text-sm shadow-lg flex flex-col items-start gap-0 text-left">
      ${summary ? html`<span class="font-semibold">${summary}</span>` : ""}
      <span>${message}</span>
    </div>
  `);
  toastHost.appendChild(node);
  setTimeout(() => node.remove(), ttlMs);
}

export function clearToasts(): void {
  toastHost?.replaceChildren();
}

export function loader(text = "Loading…"): HTMLElement {
  return element(html`
    <div class="flex-1 flex flex-col items-center justify-center gap-3 text-muted">
      <span class="loading loading-spinner loading-lg text-primary"></span>
      <span class="text-sm">${text}</span>
    </div>
  `);
}
