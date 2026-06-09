import * as React from "npm:react@18.3.1";
import { Heading, Text } from "npm:@react-email/components@0.0.22";
import { EmailLayout } from "../../_shared/email-components/layout.tsx";
import { EmailButton } from "../../_shared/email-components/button.tsx";
import { typography } from "../../_shared/email-components/styles.ts";

export interface ApprovalEmailProps {
  /** Link back into the app — points at /pending, which auto-forwards once approved. */
  signInUrl: string;
  displayName: string | null;
  appName: string;
}

/**
 * Early-access approval email. Fires when an admin flips profiles.allowed to
 * true. Uses the shared brand chrome (EmailLayout + EmailButton + typography).
 */
export function ApprovalEmail({
  signInUrl,
  displayName,
  appName,
}: ApprovalEmailProps) {
  const greeting = displayName ? `Hi ${displayName},` : "Hi,";

  return (
    <EmailLayout
      preview={`Your ${appName} access is approved`}
      label="Early access"
    >
      <Heading as="h1" style={typography.title}>
        You&rsquo;re in.
      </Heading>
      <Text style={typography.text}>{greeting}</Text>
      <Text style={typography.text}>
        Your early-access request has been approved — your {appName} account is
        ready. Sign in to start managing your prompts.
      </Text>
      <EmailButton href={signInUrl}>Open {appName} &rarr;</EmailButton>
      <Text style={typography.textSmall}>
        If the button doesn&rsquo;t work, paste this link into your browser:{" "}
        {signInUrl}
      </Text>
    </EmailLayout>
  );
}

export default ApprovalEmail;
