/** Minimal DOM helpers: an escaping `html` tag, element creation from markup, and typed lookups. */

export function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Marker for markup that has already been escaped / is trusted. */
export class RawHtml {
  readonly value: string;
  constructor(value: string) {
    this.value = value;
  }
}
export const raw = (value: string) => new RawHtml(value);

/** Tagged template: interpolations are escaped unless wrapped with `raw()`; arrays are joined. */
export function html(strings: TemplateStringsArray, ...values: unknown[]): RawHtml {
  let out = "";
  strings.forEach((chunk, i) => {
    out += chunk;
    if (i < values.length) out += render(values[i]);
  });
  return new RawHtml(out);
}

function render(value: unknown): string {
  if (value instanceof RawHtml) return value.value;
  if (Array.isArray(value)) return value.map(render).join("");
  if (value === null || value === undefined || value === false) return "";
  return escapeHtml(value);
}

export function element<T extends HTMLElement = HTMLElement>(markup: RawHtml): T {
  const template = document.createElement("template");
  template.innerHTML = markup.value.trim();
  const first = template.content.firstElementChild;
  if (!first) throw new Error("element(): markup produced no element");
  return first as T;
}

export function query<T extends Element = HTMLElement>(root: ParentNode, selector: string): T {
  const found = root.querySelector<T>(selector);
  if (!found) throw new Error(`query(): no element matches ${selector}`);
  return found;
}

export function queryAll<T extends Element = HTMLElement>(root: ParentNode, selector: string): T[] {
  return Array.from(root.querySelectorAll<T>(selector));
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]!.toUpperCase())
    .join("");
}
