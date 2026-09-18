import { Router } from "../mock/router";

/**
 * Hash router. Routes mirror pi/onboarding-ui/src/app/app.routes.ts (children of `/link`),
 * e.g. `#/connect-payroll-platform/acme_payroll/steps/2`. Hash routing means GitHub Pages
 * never has to rewrite a deep link.
 */
export interface RouteContext {
  path: string;
  params: Record<string, string>;
  query: URLSearchParams;
}

export type ScreenRenderer = (ctx: RouteContext) => void | Promise<void>;

export const routes = new Router<ScreenRenderer>();

export function parseHash(hash: string): { path: string; query: URLSearchParams } {
  const raw = hash.replace(/^#/, "");
  const [pathPart = "", queryPart = ""] = raw.split("?");
  return { path: pathPart.replace(/^\/+/, ""), query: new URLSearchParams(queryPart) };
}

export function hashFor(path: string, query?: Record<string, string>): string {
  const search = query && Object.keys(query).length ? `?${new URLSearchParams(query)}` : "";
  return `#/${path.replace(/^\/+/, "")}${search}`;
}

export function navigate(path: string, options: { query?: Record<string, string>; replace?: boolean } = {}): void {
  const hash = hashFor(path, options.query);
  if (options.replace) {
    const url = new URL(location.href);
    url.hash = hash;
    history.replaceState(null, "", url);
    dispatchEvent(new HashChangeEvent("hashchange"));
  } else if (location.hash === hash) {
    dispatchEvent(new HashChangeEvent("hashchange"));
  } else {
    location.hash = hash;
  }
}

export function resolve(hash: string): { render: ScreenRenderer; ctx: RouteContext } | undefined {
  const { path, query } = parseHash(hash);
  const match = routes.match("GET", path);
  if (!match) return undefined;
  return { render: match.handler, ctx: { path, params: match.params, query } };
}
