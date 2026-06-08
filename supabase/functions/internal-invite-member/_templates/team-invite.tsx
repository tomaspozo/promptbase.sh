import * as React from 'npm:react@18.3.1'
import { Heading, Text } from 'npm:@react-email/components@0.0.22'
import { EmailLayout } from '../../_shared/email-components/layout.tsx'
import { EmailButton } from '../../_shared/email-components/button.tsx'
import { typography } from '../../_shared/email-components/styles.ts'

export interface TeamInviteEmailProps {
  inviteUrl: string
  tenantName: string
  appName: string
}

/**
 * Workspace-level invitation email — fires from `internal-invite-member`
 * when an admin invites a teammate via `api.invitation_create`. The
 * inviteUrl points at /accept-invite?token=… (with optional &code= for
 * new users created via auth.admin.generateLink).
 */
export function TeamInviteEmail({
  inviteUrl,
  tenantName,
  appName,
}: TeamInviteEmailProps) {
  return (
    <EmailLayout
      preview={`You've been invited to join ${tenantName} on ${appName}`}
      label="Workspace invitation"
    >
      <Heading as="h1" style={typography.title}>
        Join {tenantName}
      </Heading>
      <Text style={typography.text}>
        You&rsquo;ve been invited to join{' '}
        <strong style={{ color: '#0a0a0a' }}>{tenantName}</strong> on{' '}
        {appName}. Click the button below to accept the invitation.
      </Text>
      <EmailButton href={inviteUrl}>Accept invitation →</EmailButton>
      <Text style={typography.textSmall}>
        If you weren&rsquo;t expecting this invitation, you can safely
        ignore this email.
      </Text>
    </EmailLayout>
  )
}

export default TeamInviteEmail
