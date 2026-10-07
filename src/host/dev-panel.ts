import { cdnSnippet, npmSnippet, type SnippetInput } from "./snippet";
import { subscribeDemoEvents, type ApiLogEntry, type DemoEvent } from "../shared/demo-log";
import { element, html, query, queryAll, type RawHtml } from "../shared/dom";
import { APP_SOURCE, SDK_SOURCE } from "../shared/messages";

/**
 * Developer panel beside the iframe:
 *  - SDK callbacks   what `bootstrap()`'s callbacks received (what a customer's code sees)
 *  - postMessage     raw traffic in both directions, like the SDK repo's testbed page
 *  - Mock API        every emulated backend call the frame made
 *  - Snippet         the integration code, npm and CDN flavours
 */
export interface DevPanel {
  logCallback(name: "success" | "error" | "message" | "throw", value: unknown): void;
  logTraffic(direction: "sdk → frame" | "frame → sdk", data: unknown, origin: string): void;
  setSnippet(input: SnippetInput): void;
  clear(): void;
}

const time = (at = Date.now()) => new Date(at).toLocaleTimeString(undefined, { hour12: false });

function pre(value: unknown): RawHtml {
  const text = typeof value === "string" ? value : JSON.stringify(value, undefined, 2);
  return html`<pre class="font-mono text-xs whitespace-pre-wrap break-all m-0">${text ?? ""}</pre>`;
}

export function createDevPanel(root: HTMLElement, frameHost: string): DevPanel {
  const panel = element(html`
    <div class="flex flex-col gap-3">
      <div role="tablist" class="tabs tabs-lift">
        <input type="radio" name="dev-tabs" role="tab" class="tab" aria-label="SDK callbacks" checked />
        <div role="tabpanel" class="tab-content bg-base-100 border-base-300 p-3">
          <p class="text-xs text-muted mt-0">What your <code>callbacks</code> receive. Note the real SDK quirk: an <code>error</code> also invokes <code>message</code>.</p>
          <ol class="flex flex-col gap-2 m-0 p-0 list-none max-h-[26rem] overflow-auto" data-callbacks>
            <li class="text-sm text-muted italic" data-empty>Nothing yet. Click the connect button.</li>
          </ol>
        </div>

        <input type="radio" name="dev-tabs" role="tab" class="tab" aria-label="postMessage" />
        <div role="tabpanel" class="tab-content bg-base-100 border-base-300 p-3">
          <p class="text-xs text-muted mt-0">Raw window messages with <code>source</code> <code>pi-sdk</code> or <code>pi-app</code>, both directions.</p>
          <ol class="flex flex-col gap-2 m-0 p-0 list-none max-h-[26rem] overflow-auto" data-traffic>
            <li class="text-sm text-muted italic" data-empty>Nothing yet.</li>
          </ol>
        </div>

        <input type="radio" name="dev-tabs" role="tab" class="tab" aria-label="Mock API" />
        <div role="tabpanel" class="tab-content bg-base-100 border-base-300 p-3">
          <p class="text-xs text-muted mt-0">Every call the frame made to the emulated backend. Nothing leaves your browser.</p>
          <ol class="flex flex-col gap-1 m-0 p-0 list-none max-h-[26rem] overflow-auto" data-api>
            <li class="text-sm text-muted italic" data-empty>Nothing yet.</li>
          </ol>
        </div>

        <input type="radio" name="dev-tabs" role="tab" class="tab" aria-label="Snippet" />
        <div role="tabpanel" class="tab-content bg-base-100 border-base-300 p-3">
          <div class="flex items-center justify-between gap-2 mb-2">
            <div class="join">
              <button type="button" class="btn btn-xs join-item btn-active" data-flavour="npm">npm</button>
              <button type="button" class="btn btn-xs join-item" data-flavour="cdn">CDN (no bundler)</button>
            </div>
            <button type="button" class="btn btn-xs btn-outline" data-copy-snippet>Copy</button>
          </div>
          <pre class="font-mono text-xs whitespace-pre-wrap break-all bg-base-200 rounded-box p-3 m-0 max-h-[26rem] overflow-auto" data-snippet>Click the connect button to generate a link.</pre>
        </div>
      </div>
    </div>
  `);
  root.replaceChildren(panel);

  const callbacks = query<HTMLOListElement>(panel, "[data-callbacks]");
  const traffic = query<HTMLOListElement>(panel, "[data-traffic]");
  const apiList = query<HTMLOListElement>(panel, "[data-api]");
  const snippetEl = query<HTMLPreElement>(panel, "[data-snippet]");
  let snippetInput: SnippetInput | undefined;
  let flavour: "npm" | "cdn" = "npm";

  function append(list: HTMLOListElement, item: HTMLElement) {
    list.querySelector("[data-empty]")?.remove();
    list.appendChild(item);
    item.scrollIntoView({ block: "nearest" });
  }

  function renderSnippet() {
    if (!snippetInput) return;
    snippetEl.textContent = flavour === "npm" ? npmSnippet(snippetInput) : cdnSnippet(snippetInput);
  }
  for (const btn of queryAll<HTMLButtonElement>(panel, "[data-flavour]")) {
    btn.addEventListener("click", () => {
      flavour = btn.dataset.flavour as "npm" | "cdn";
      for (const other of queryAll<HTMLButtonElement>(panel, "[data-flavour]")) other.classList.toggle("btn-active", other === btn);
      renderSnippet();
    });
  }
  query<HTMLButtonElement>(panel, "[data-copy-snippet]").addEventListener("click", async (event) => {
    const btn = event.currentTarget as HTMLButtonElement;
    await navigator.clipboard?.writeText(snippetEl.textContent ?? "");
    btn.textContent = "Copied";
    setTimeout(() => (btn.textContent = "Copy"), 1500);
  });

  function apiItem(entry: ApiLogEntry): HTMLElement {
    const ok = entry.status < 400;
    return element(html`
      <li>
        <details class="collapse collapse-arrow bg-base-200 rounded-box">
          <summary class="collapse-title min-h-0 py-2 px-3 text-xs font-mono flex items-center gap-2">
            <span class="badge badge-xs ${ok ? "badge-success" : "badge-error"}">${entry.status}</span>
            <span class="font-semibold w-12">${entry.method}</span>
            <span class="truncate flex-1">${entry.path}</span>
            <span class="text-muted">${entry.durationMs} ms</span>
          </summary>
          <div class="collapse-content text-xs flex flex-col gap-2">
            ${entry.request !== undefined ? html`<div><span class="font-semibold">request</span>${pre(entry.request)}</div>` : ""}
            <div><span class="font-semibold">response</span>${entry.response === undefined ? html`<pre class="font-mono text-xs m-0 text-muted">(empty)</pre>` : pre(entry.response)}</div>
          </div>
        </details>
      </li>
    `);
  }

  const onDemoEvent = (event: DemoEvent) => {
    if (event.kind === "api") {
      append(apiList, apiItem(event));
    } else if (event.kind === "frame-received") {
      api.logTraffic("sdk → frame", event.data, event.origin);
    }
  };
  // BroadcastChannel covers today's same-origin frame; the window-message path is ready
  // for the PI-15486 sandbox frame, which is cross-origin and can't use BroadcastChannel.
  subscribeDemoEvents(onDemoEvent, { expectedOrigin: frameHost });

  const api: DevPanel = {
    logCallback(name, value) {
      const badge = { success: "badge-success", error: "badge-error", message: "badge-info", throw: "badge-warning" }[name];
      append(
        callbacks,
        element(html`
          <li class="flex flex-col gap-1 bg-base-200 rounded-box p-2">
            <div class="flex items-center gap-2 text-xs"><span class="badge badge-xs ${badge}">${name}</span><span class="text-muted">${time()}</span><code class="text-muted">callbacks.${name === "throw" ? "error → throw" : name}</code></div>
            ${pre(value)}
          </li>
        `),
      );
    },
    logTraffic(direction, data, origin) {
      const outbound = direction === "sdk → frame";
      append(
        traffic,
        element(html`
          <li class="flex flex-col gap-1 rounded-box p-2 ${outbound ? "bg-secondary/15" : "bg-primary/15"}">
            <div class="flex items-center gap-2 text-xs"><span class="font-semibold">${direction}</span><span class="text-muted">${time()}</span><span class="text-muted truncate">origin ${origin}</span></div>
            ${pre(data)}
          </li>
        `),
      );
    },
    setSnippet(input) {
      snippetInput = input;
      renderSnippet();
    },
    clear() {
      for (const list of [callbacks, traffic, apiList]) {
        list.replaceChildren(element(html`<li class="text-sm text-muted italic" data-empty>Nothing yet.</li>`));
      }
    },
  };

  // Frame → SDK traffic arrives on this window; mirror it like the SDK repo's testbed does.
  window.addEventListener("message", (event: MessageEvent) => {
    const source = (event.data as { source?: unknown } | null)?.source;
    if (source === APP_SOURCE || source === SDK_SOURCE) api.logTraffic("frame → sdk", event.data, event.origin);
  });

  return api;
}
