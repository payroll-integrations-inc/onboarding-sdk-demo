# Onboarding SDK demo

Public, credential-free walkthrough of the Payroll Integrations onboarding SDK.

**Live:** https://sdk-demo.payrollintegrationsdemo.com

The page has one button, **Connect with Payroll Integrations**, and nothing else. Append
`?developer=true` for the developer view: scenario picker, status, and a panel showing SDK callbacks,
postMessage traffic, emulated API calls and the integration snippet
(https://sdk-demo.payrollintegrationsdemo.com/?developer=true).

Clicking the button calls `bootstrap()` from the
*real, published* [`@payroll-integrations/onboarding-sdk`](https://www.npmjs.com/package/@payroll-integrations/onboarding-sdk).
Everything behind the iframe the SDK mounts is emulated on the same site:

| Layer | What it is here | What it is in production |
|---|---|---|
| SDK | `@payroll-integrations/onboarding-sdk@1.0.0` from npm, bundled unchanged | same |
| Onboarding frame (`/link/start`) | `link/start.html` + `src/frame/**`: a stand-in for the hosted onboarding app with the same screens, server-driven step definitions and postMessage contract | `secure.payrollintegrationsapp.com/link/start` |
| Backend | `src/mock/**`: an in-browser implementation of the onboarding REST surface with fictional payroll providers | `api.payrollintegrationsapp.com` |

Nothing leaves the browser. There is no analytics, no network traffic beyond loading the static site, and
all provider and recordkeeper names are fictional.

## Status (2026-09-22)

The frame and backend above (`src/frame/**`, `src/mock/**`) are an **interim stopgap**, not the long-term
design. [PI-15486](https://payroll-integrations.atlassian.net/browse/PI-15486) is porting the real
`pi/onboarding-ui` Angular app into a `sandbox` build configuration — its own HTTP layer swapped for an
in-browser emulation — deployed to its own origin (`sandbox.secure.payrollintegrationsdemo.com`). Once that
ships, this repo's phase 2 is: point `frameHost` at the sandbox origin, delete `src/frame/**` and
`src/mock/**` entirely, and this demo embeds the real onboarding UI instead of a hand-ported copy.

Current state of that work:

- **Code: done.** [pi#6513](https://github.com/payroll-integrations-inc/pi/pull/6513) (draft) has the sandbox
  build configuration, emulated backend, and sandbox-only OAuth/billing screens. 459 unit tests, 6 Playwright
  e2e specs (run live, not just written), lint and typecheck all pass. Building it surfaced and fixed several
  real bugs in the onboarding app itself along the way (e.g. `divisionId` was never set for OAuth platforms
  like Northwind, so billing silently never loaded).
- **Not done: infra.** The sandbox origin has no AWS resources yet (S3 bucket, CloudFront distribution, ACM
  cert, Route53 record, GitHub Environment). That's tracked as its own ticket,
  [PI-15552](https://payroll-integrations.atlassian.net/browse/PI-15552), deliberately scoped to run only
  *after* PR #6513 is approved — the PR is a draft for that reason. Until it lands, there is no sandbox origin
  for this demo to point at.
- **Scope change to note:** the sandbox port dropped the third fictional platform, **Contoso Pay** (no e2e
  coverage, no test proved its marketplace-link flow worked end to end). This repo's interim frame still has
  it — that scenario disappears when `src/frame/**` is deleted at cutover, alongside Acme (credentials flow)
  and Northwind (OAuth flow) which remain in the real port.

The token contract stays as-is across the cutover: this repo keeps minting the unsigned, JWT-shaped token
(`src/shared/token.ts`); the sandbox's ported exchange handler decodes it. Demo telemetry already speaks the
sandbox's wire format — `subscribeDemoEvents` (`src/shared/demo-log.ts`) accepts `pi-demo` window messages
from `frameHost` in addition to today's same-origin `BroadcastChannel`, so the developer panel needs no
further changes when `frameHost` switches over.

## Why a custom domain is required

The SDK filters incoming messages with `message.origin === frameHost` (strict string equality) and loads the
frame from `{frameHost}/link/start`. An origin has no path, so a project Pages URL such as
`payroll-integrations-inc.github.io/onboarding-sdk-demo/` can never satisfy both. The site therefore lives
at the root of `sdk-demo.payrollintegrationsdemo.com` and passes `frameHost: location.origin`. The same
trick makes `pnpm dev` work on `http://localhost:5173`.

## Things to try

Scenarios are chosen in the developer view (`?developer=true`); inputs work in both modes.

| Scenario / input | What happens |
|---|---|
| Happy path, **Acme Payroll** | Credentials form → consent link + confirmation → billing → complete. `callbacks.success` fires with the plan sponsor id. |
| **Northwind HR** | OAuth popup (`oauth.html`), automatic verification step, then billing. Deny in the popup to see the error toast. |
| **Contoso Pay** | Marketplace-style link step; billing is skipped (`skipStripe`). |
| Scenario **Recordkeeper not preselected** | Adds the recordkeeper picker before plan confirmation. |
| Scenario **Payroll connection fails**, or Acme Company ID `FAIL0000`, or API key `fail` | `PAYROLL_PLATFORM_COULD_NOT_CONNECT` → error screen → `callbacks.error`. |
| Scenario **Invalid onboarding token** | `TOKEN_VALIDATION_FAILED` on exchange → error screen → `callbacks.error` **and** `callbacks.message`. |
| Card `4000 0000 0000 0002` | Declined payment toast; any other 16 digits succeed. |
| Reload the frame mid-flow | The emulated session survives (sessionStorage) and the start screen resumes where you left off. |

In the developer view the panel beside the frame shows the SDK callbacks, the raw `postMessage` traffic
in both directions, every emulated API call with request/response bodies, and the copy-paste integration
snippet (npm and CDN flavours). The mode is decided by an inline script in `index.html` that sets
`html.developer` before first paint; elements marked `data-developer` only render in that mode and
`data-basic` elements only in basic mode (`src/style.css`).

## SDK behaviour surfaced by the demo

These are real SDK behaviours, shown rather than hidden:

- `error` messages invoke `callbacks.error` **and** `callbacks.message` (`onboarding-sdk/src/main.ts`, the
  `message` callback sits in the `else` of the `success` check).
- Configuration problems (missing token, missing host element) call `callbacks.error` and then **throw**;
  wrap `bootstrap()` in `try/catch`.
- The package's `exports` map has no `types` entry, so with `moduleResolution: bundler` TypeScript cannot
  find its declarations. This repo maps them via `tsconfig.json` `paths`. Upstream fix: add `"types"` to the
  `exports["."]` object.
- The SDK repo's own testbed passes `onboardingUrl`; the correct key is `onboardingLink`.

## Development

Prerequisites: Node 22 and pnpm 11 (`corepack enable` picks the pinned version up from `package.json`).

```bash
pnpm install
pnpm dev          # http://localhost:5173 — host page, frame at /link/start, popup at /oauth.html
pnpm test         # vitest (jsdom), includes a contract test against the real SDK
pnpm typecheck
pnpm build        # dist/ with index.html, link/start.html, oauth.html, CNAME
pnpm preview
```

### Project layout

```
index.html              host page (the "customer" site)
link/start.html         emulated onboarding frame, served at /link/start
oauth.html              emulated provider pages: OAuth consent, approval portal, marketplace form
src/host/               bootstrap() wiring, developer panel, snippet
src/frame/              frame app: hash router, state, flow engine, screens, dynamic-form renderer
src/mock/               emulated backend: DTO subsets, fixtures, in-memory DB, router, handlers, fetch shim
src/shared/             postMessage constants, demo token, demo telemetry channel, DOM helpers
public/                 CNAME, favicon, 404 redirect, PI logos
```

The frame is a port of the real Angular app in the `pi` monorepo (`onboarding-ui`); file headers cite the
source each module mirrors. Step definitions in `src/mock/fixtures.ts` copy the *shape* of real platform
configs (Paychex-style credentials + consent, QuickBooks-style OAuth, Paylocity-style marketplace) under
fictional names.

## Deployment

Pushes to `main` build and deploy via GitHub Actions (`.github/workflows/deploy-pages.yml`) using
`actions/deploy-pages`. Pages is configured with **Source: GitHub Actions** and the custom domain from
`public/CNAME`.

DNS (Route53, zone `payrollintegrationsdemo.com`):

```
sdk-demo.payrollintegrationsdemo.com.  300  IN  CNAME  payroll-integrations-inc.github.io.
```

After the certificate is issued, HTTPS enforcement is turned on in the repository's Pages settings.
Verifying the domain at the organisation level (Settings → Pages → Verified domains) is recommended so the
subdomain cannot be claimed by another Pages site if this repository is ever removed.

## Tickets

- [PI-15484](https://payroll-integrations.atlassian.net/browse/PI-15484) — Faux Embedded Onboarding via
  Emulated Backend (this repo). Externally blocked on PI-15486.
- [PI-15486](https://payroll-integrations.atlassian.net/browse/PI-15486) — sandbox build of `pi/onboarding-ui`
  (in the `pi` monorepo). Code complete, see [pi#6513](https://github.com/payroll-integrations-inc/pi/pull/6513) (draft).
- [PI-15552](https://payroll-integrations.atlassian.net/browse/PI-15552) — provision the sandbox origin's AWS
  infra, scoped to start after PI-15486 merges.
