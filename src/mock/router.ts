/** Tiny method + path-pattern router for the emulated backend. Patterns use `:name` segments. */

export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export interface RequestContext {
  method: HttpMethod;
  path: string;
  params: Record<string, string>;
  query: URLSearchParams;
  body: unknown;
}

export interface HandlerResult {
  status?: number;
  body?: unknown;
}

export type Handler = (ctx: RequestContext) => HandlerResult | Promise<HandlerResult>;

interface Route<H> {
  method: HttpMethod;
  segments: string[];
  handler: H;
}

/** Generic over the handler type so the frame can reuse it for hash routing. */
export class Router<H = Handler> {
  private readonly routes: Route<H>[] = [];

  add(method: HttpMethod, pattern: string, handler: H): this {
    this.routes.push({ method, segments: splitPath(pattern), handler });
    return this;
  }

  match(method: string, path: string): { handler: H; params: Record<string, string> } | undefined {
    const segments = splitPath(path);
    for (const route of this.routes) {
      if (route.method !== method || route.segments.length !== segments.length) continue;
      const params = matchSegments(route.segments, segments);
      if (params) return { handler: route.handler, params };
    }
    return undefined;
  }
}

export function splitPath(path: string): string[] {
  return path.split("/").filter((segment) => segment.length > 0);
}

function matchSegments(pattern: string[], actual: string[]): Record<string, string> | undefined {
  const params: Record<string, string> = {};
  for (let i = 0; i < pattern.length; i++) {
    const expected = pattern[i]!;
    const value = actual[i]!;
    if (expected.startsWith(":")) {
      params[expected.slice(1)] = decodeURIComponent(value);
    } else if (expected !== value) {
      return undefined;
    }
  }
  return params;
}
