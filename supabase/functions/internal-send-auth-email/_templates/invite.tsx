import * as React from 'npm:react@18.3.1'
import { Heading, Text } from 'npm:@react-email/components@0.0.22'
import { EmailLayout } from '../../_shared/email-components/layout.tsx'
import { EmailButton } from '../../_shared/email-components/button.tsx'
import { typography } from '../../_shared/email-components/styles.ts'

export interface InviteEmailProps {
  verificationUrl: string
}

/**
 * App-level invitation email — fires when an admin uses Supabase Auth's
 * `admin.inviteUserByEmail()` (e.g. via the Supabase Dashboard "Invite
 * user" button). For workspace/tenant-level invitations the
 * internal-invite-member function ships its own template.
 */
export function InviteEmail({ verificationUrl }: InviteEmailProps) {
  const appName = Deno.env.get('APP_NAME') ?? 'App'

  return (
    <EmailLayout preview={`You've been invited to ${appName}`} label="Invitation">
      <Heading as="h1" style={typography.title}>
        You&rsquo;re invited
      </Heading>
      <Text style={typography.text}>
        You&rsquo;ve been invited to join {appName}. Click the button below
        to accept the invitation and create your account.
      </Text>
      <EmailButton href={verificationUrl}>Accept invitation →</EmailButton>
      <Text style={typography.textSmall}>
        If you weren&rsquo;t expecting this invitation, you can safely ignore
        this email.
      </Text>
    </EmailLayout>
  )
}

export default InviteEmail
