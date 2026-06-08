import * as React from 'npm:react@18.3.1'
import { Section, Text } from 'npm:@react-email/components@0.0.22'
import { otpCode as otpStyles } from './styles.ts'

export interface OtpCodeProps {
  code: string
  label?: string
}

/**
 * Hairline-bordered card with a small mono label and a large mono code.
 * Mirrors the website's editorial label + tabular-figures pattern.
 */
export function OtpCode({ code, label }: OtpCodeProps) {
  return (
    <Section style={otpStyles.box}>
      {label ? <Text style={otpStyles.label}>{label}</Text> : null}
      <Text style={otpStyles.code}>{code}</Text>
    </Section>
  )
}

export default OtpCode
