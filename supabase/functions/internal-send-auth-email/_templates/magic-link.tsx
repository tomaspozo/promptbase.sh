import * as React from 'npm:react@18.3.1'
import { Heading, Text } from 'npm:@react-email/components@0.0.22'
import { EmailLayout } from '../../_shared/email-components/layout.tsx'
import { EmailButton } from '../../_shared/email-components/button.tsx'
import { OtpCode } from '../../_shared/email-components/otp-code.tsx'
import { typography } from '../../_shared/email-components/styles.ts'

export interface MagicLinkEmailProps {
  verificationUrl: string
  /**
   * 6/8-digit OTP rendered alongside the link. Pasting the code on
   * /auth/check-inbox?type=magiclink is the cross-device fallback for
   * users who open the email on a different device than the one they
   * requested the magic link from.
   */
  token: string
}

export function MagicLinkEmail({
  verificationUrl,
  token,
}: MagicLinkEmailProps) {
  return (
    <EmailLayout preview="Your sign-in link" label="Sign in">
      <Heading as="h1" style={typography.title}>
        Sign in to your account
      </Heading>
      <Text style={typography.text}>
        Use the code below to sign in, or click the button.
      </Text>
      <OtpCode code={token} label="Sign-in code" />
      <Text style={typography.text}>Or click the link below:</Text>
      <EmailButton href={verificationUrl}>Sign in →</EmailButton>
      <Text style={typography.textSmall}>
        If you didn&rsquo;t request this email, you can safely ignore it.
      </Text>
    </EmailLayout>
  )
}

export default MagicLinkEmail
