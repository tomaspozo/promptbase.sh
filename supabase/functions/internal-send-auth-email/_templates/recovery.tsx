import * as React from 'npm:react@18.3.1'
import { Heading, Text } from 'npm:@react-email/components@0.0.22'
import { EmailLayout } from '../../_shared/email-components/layout.tsx'
import { EmailButton } from '../../_shared/email-components/button.tsx'
import { OtpCode } from '../../_shared/email-components/otp-code.tsx'
import { typography } from '../../_shared/email-components/styles.ts'

export interface RecoveryEmailProps {
  verificationUrl: string
  /**
   * 6/8-digit OTP rendered alongside the link. Pasting the code on
   * /auth/check-inbox?type=recovery is the cross-device fallback for
   * users who open the email on a different device than the one they
   * requested the reset from — PKCE's code_verifier sits in localStorage
   * on the originating device, so link-clicks on a phone don't have it.
   */
  token: string
}

export function RecoveryEmail({ verificationUrl, token }: RecoveryEmailProps) {
  return (
    <EmailLayout preview="Reset your password" label="Reset password">
      <Heading as="h1" style={typography.title}>
        Reset your password
      </Heading>
      <Text style={typography.text}>
        We received a request to reset your password. Use the code below or
        click the button to choose a new one.
      </Text>
      <OtpCode code={token} label="Reset code" />
      <Text style={typography.text}>Or click the link below:</Text>
      <EmailButton href={verificationUrl}>Reset password →</EmailButton>
      <Text style={typography.textSmall}>
        If you didn&rsquo;t request a password reset, you can safely ignore
        this email. Your password will not be changed.
      </Text>
    </EmailLayout>
  )
}

export default RecoveryEmail
