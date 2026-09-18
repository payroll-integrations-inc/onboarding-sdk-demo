import { persistDb } from "./db";
import { ApiError } from "./errors";
import { router } from "./handlers";
import type { HttpMethod } from "./router";
import { publishApiLog } from "../shared/demo-log";

/**
 * `fetch`-shaped entry point to the emulated backend.
 *
 * The frame's API client calls `mockFetch("/api/onboarding/...")` exactly where the
 * real one calls `fetch(environment.apiUrl + "onboarding/...")`. Nothing leaves the
 * browser: the request is routed in-process, delayed to feel like a network hop,
 * and every call is published to the developer panel.
 */
export const API_BASE = "/api/";

export const mockFetchOptions = {
  /** [min, max] simulated latency in ms. Tests set this to [0, 0]. */
  latency: [200, 800] as [number, number],
};

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

function randomLatency(): number {
  const [min, max] = mockFetchOptions.latency;
  return min + Math.random() * Math.max(0, max - min);
}

function parseBody(init: RequestInit | undefined): unknown {
  const raw = init?.body;
  if (raw === undefined || raw === null) return undefined;
  if (typeof raw !== "string") return raw;
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}

function toResponse(status: number, payload: unknown): Response {
  if (status === 204 || payload === undefined) return new Response(null, { status });
  return new Response(JSON.stringify(payload), { status, headers: { "content-type": "application/json" } });
}

export async function mockFetch(input: string | URL, init?: RequestInit): Promise<Response> {
  const started = performance.now();
  const url = new URL(input.toString(), "http://emulated.local");
  const method = (init?.method ?? "GET").toUpperCase() as HttpMethod;
  const path = url.pathname.startsWith(API_BASE) ? url.pathname.slice(API_BASE.length) : url.pathname.replace(/^\//, "");
  const requestBody = parseBody(init);

  await sleep(randomLatency());

  let status = 200;
  let payload: unknown;
  const match = router.match(method, path);
  if (!match) {
    status = 404;
    payload = { reason: "NOT_FOUND", message: `No emulated route for ${method} ${path}` };
  } else {
    try {
      const result = await match.handler({ method, path, params: match.params, query: url.searchParams, body: requestBody });
      status = result.status ?? 200;
      payload = result.body;
    } catch (error) {
      if (error instanceof ApiError) {
        status = error.status;
        payload = error.toBody();
      } else {
        status = 500;
        payload = { reason: "INTERNAL_ERROR", message: error instanceof Error ? error.message : String(error) };
      }
    }
  }

  if (method !== "GET") persistDb();

  publishApiLog({
    id: crypto.randomUUID(),
    at: Date.now(),
    method,
    path: `${API_BASE}${path}${url.search}`,
    status,
    durationMs: Math.round(performance.now() - started),
    request: requestBody,
    response: payload,
  });

  return toResponse(status, payload);
}
