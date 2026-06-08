import * as React from 'npm:react@18.3.1'
import { Heading, Text } from 'npm:@react-email/components@0.0.22'
import { EmailLayout } from '../../_shared/email-components/layout.tsx'
import { EmailButton } from '../../_shared/email-components/button.tsx'
import { OtpCode } from '../../_shared/email-components/otp-code.tsx'
import { typography } from '../../_shared/email-components/styles.ts'

export interface ConfirmationEmailProps {
  verificationUrl: string
  /**
   * 6/8-digit OTP rendered alongside the link. Pasting the code on
   * /auth/check-inbox?type=signup is the cross-device fallback for
   * users who open the email on a different device than the one they
   * signed up from — PKCE's code_verifier sits in localStorage on the
   * originating device, so link-clicks elsewhere don't have it.
   */
  token: string
}

export function ConfirmationEmail({
  verificationUrl,
  token,
}: ConfirmationEmailProps) {
  return (
    <EmailLayout preview="Confirm your email address" label="Confirm email">
      <Heading as="h1" style={typography.title}>
        Confirm your email
      </Heading>
      <Text style={typography.text}>
        Thanks for signing up. Use the code below to confirm your email
        address, or click the button.
      </Text>
      <OtpCode code={token} label="Verification code" />
      <Text style={typography.text}>Or click the link below:</Text>
      <EmailButton href={verificationUrl}>Confirm email →</EmailButton>
      <Text style={typography.textSmall}>
        If you didn&rsquo;t create an account, you can safely ignore this
        email.
      </Text>
    </EmailLayout>
  )
}

export default ConfirmationEmail
