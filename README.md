# Onboarding SDK demo

Public, credential-free walkthrough of the Payroll Integrations onboarding SDK.

**Live:** https://sdk-demo.payrollintegrationsdemo.com

The page has one button, **Connect with Payroll Integrations**, and nothing else. Append
`?developer=true` for the developer view: scenario picker, status, and a panel showing SDK callbacks,
postMessage traffic, emulated API calls and the integration snippet
(https://sdk-demo.payrollintegrationsdemo.com/?developer=true).

Clicking the button calls `bootstrap()` from the
*real, published* [`@payroll-integrations/onboarding-sdk`](https://www.npmjs.com/package/@payroll-integrations/onboarding-sdk),
which mounts the *real* onboarding UI from its sandbox stage:

| Layer | What it is here | What it is in production |
|---|---|---|
| SDK | `@payroll-integrations/onboarding-sdk@1.0.0` from npm, bundled unchanged | same |
| Onboarding frame (`/link/start`) | `sandbox.secure.payrollintegrationsdemo.com/link/start`: the `sandbox` build of `pi/onboarding-ui`, built from the same commit and pipeline run as every production deploy | `secure.payrollintegrationsapp.com/link/start` |
| Backend | the sandbox build's in-browser emulation of the onboarding REST surface, with fictional payroll providers | `api.payrollintegrationsapp.com` |
| Billing | the real Stripe Payment Element in test mode | Stripe live mode |

Nothing reaches a Payroll Integrations API, and Stripe only ever sees a `pk_test_` key. All provider and
recordkeeper names are fictional.

This repo holds only the host page: the "customer" site. The frame, its emulated backend and the fake
provider consent pages live in the `pi` monorepo (`onboarding-ui/src/app/sandbox/`) and ship with it.

## Why a custom domain is required

The SDK filters incoming messages with `message.origin === frameHost` (strict string equality) and loads the
frame from `{frameHost}/link/start`. `frameHost` is therefore a bare origin, the sandbox's. The host page
needs a real origin of its own too: the sandbox frame posts its replies (and the demo telemetry below) to the
origin that sent the SDK's token, and an opaque or path-scoped origin can't be targeted. The site lives at the
root of `sdk-demo.payrollintegrationsdemo.com`.

## Things to try

Scenarios are chosen in the developer view (`?developer=true`); inputs work in both modes.

| Scenario / input | What happens |
|---|---|
| Happy path, **Acme Payroll** | Credentials form → approval link + confirmation → billing → complete. `callbacks.success` fires with the plan sponsor id. |
| **Northwind HR** | OAuth popup served by the sandbox, automatic verification step, then billing. |
| Scenario **Recordkeeper not preselected** | Adds the recordkeeper picker before plan confirmation. |
| Scenario **Payroll connection fails**, or Acme Company ID `FAIL0000`, or API key `fail` | `PAYROLL_PLATFORM_COULD_NOT_CONNECT` → error screen → `callbacks.error`. |
| Scenario **Invalid onboarding token** | `TOKEN_VALIDATION_FAILED` on exchange → error screen → `callbacks.error` **and** `callbacks.message`. |
| Billing: card `4242 4242 4242 4242`, any future expiry, CVC and ZIP | Stripe test mode; nothing is charged and no customer or payment method is created. |
| Billing: tick **Simulate a declined card (sandbox only)** | Decline message; the frame stays on billing until a valid submit. |

In the developer view the panel beside the frame shows the SDK callbacks, the raw `pi-app` messages the
frame posts to the page, every emulated API call with request/response bodies, and the copy-paste
integration snippet (npm and CDN flavours). The SDK's own messages into the frame (token, style) are not
shown: they are posted into a cross-origin window, where the host page cannot observe them.

The API log arrives as `window` messages `{ source: "pi-demo", type: "api", method, path, status, request,
response }` from the sandbox frame and is accepted only from `frameHost`
(`src/shared/demo-log.ts`). `pi-demo` is deliberately not one of the SDK contract's `source` strings.

The mode is decided by an inline script in `index.html` that sets `html.developer` before first paint;
elements marked `data-developer` only render in that mode and `data-basic` elements only in basic mode
(`src/style.css`).

## Demo tokens

A real `onboardingLink` carries a signed JWT minted by the PI API. Here `src/shared/token.ts` mints an
unsigned, JWT-shaped token whose payload carries the scenario and a fresh `onboardingUserId` per click; the
sandbox's emulated exchange decodes it. The scenario names must match the sandbox's
(`onboarding-ui/src/app/sandbox/emulated-backend/token.ts`).

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
- The SDK's iframe has no `allow="payment"`, so the browser console logs Google Pay permissions-policy
  errors on the billing step and wallet payment methods don't appear. Card payment is unaffected.

## Development

Prerequisites: Node 22 and pnpm 11 (`corepack enable` picks the pinned version up from `package.json`).

```bash
pnpm install
pnpm dev          # http://localhost:5173, embedding the deployed sandbox frame
pnpm test         # vitest (jsdom), includes a contract test against the real SDK
pnpm typecheck
pnpm build        # dist/ with index.html and CNAME
pnpm preview
```

To embed a locally served sandbox build of `pi/onboarding-ui` instead, set its origin:

```bash
VITE_FRAME_HOST=http://localhost:4200 pnpm dev
```

### Project layout

```
index.html              host page (the "customer" site)
src/host/               bootstrap() wiring, developer panel, snippet
src/shared/             sandbox origin, postMessage source strings, demo token, demo telemetry, DOM helpers
public/                 CNAME, favicon, 404 redirect, PI logos
```

## Deployment

Pushes to `main` build and deploy via GitHub Actions (`.github/workflows/deploy-pages.yml`) using
`actions/deploy-pages`. Pages is configured with **Source: GitHub Actions** and the custom domain from
`public/CNAME`.

DNS (Route53, zone `payrollintegrationsdemo.com`):

```
sdk-demo.payrollintegrationsdemo.com.  300  IN  CNAME  payroll-integrations-inc.github.io.
```

HTTPS enforcement is on in the repository's Pages settings. Verifying the domain at the organisation level
(Settings → Pages → Verified domains) is recommended so the subdomain cannot be claimed by another Pages
site if this repository is ever removed.

The sandbox frame deploys separately, with every production release of the `pi` monorepo (job *Build and
Deploy Onboarding UI (sandbox)*).

## Tickets

- [PI-15484](https://payroll-integrations.atlassian.net/browse/PI-15484): the demo site, first shipped with a
  same-origin stand-in frame.
- [PI-16433](https://payroll-integrations.atlassian.net/browse/PI-16433): cutover to the sandbox frame and
  removal of the stand-in.
- [PI-15486](https://payroll-integrations.atlassian.net/browse/PI-15486): the sandbox build of
  `pi/onboarding-ui` (in the `pi` monorepo).
- [PI-15552](https://payroll-integrations.atlassian.net/browse/PI-15552): the sandbox origin's AWS infra.
