/** The integration code a customer pastes, rendered with the live demo values. */

export const SDK_VERSION = "1.0.0";
export const SDK_CDN_URL = `https://cdn.jsdelivr.net/npm/@payroll-integrations/onboarding-sdk@${SDK_VERSION}/dist/onboarding-sdk.js`;

export interface SnippetInput {
  onboardingLink: string;
  frameHost: string;
}

function body({ onboardingLink, frameHost }: SnippetInput): string {
  return `// 1. Your server calls
//      POST /v1/employer-identifiers/{employer_identifier}/invites/{invite}/session
//    and passes the returned onboardingLink to the browser (valid for 30 minutes).
const onboardingLink = ${JSON.stringify(onboardingLink)};

// 2. Mount the onboarding frame into <div id="pi-host"></div>
bootstrap({
  onboardingLink,
  callbacks: {
    success: (planSponsorId) => console.log("Onboarding complete", planSponsorId),
    error: (message) => console.error("Onboarding error", message),
  },
  // Demo only: load the frame from this site instead of secure.payrollintegrationsapp.com.
  // Leave frameHost out in production.
  frameHost: ${JSON.stringify(frameHost)},
});`;
}

export function npmSnippet(input: SnippetInput): string {
  return `import { bootstrap } from "@payroll-integrations/onboarding-sdk";\n\n${body(input)}`;
}

export function cdnSnippet(input: SnippetInput): string {
  return `<div id="pi-host"></div>\n<script type="module">\n  import { bootstrap } from "${SDK_CDN_URL}";\n\n${body(input)
    .split("\n")
    .map((line) => (line ? `  ${line}` : line))
    .join("\n")}\n</script>`;
}
