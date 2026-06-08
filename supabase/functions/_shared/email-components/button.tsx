import * as React from 'npm:react@18.3.1'
import { Link, Section } from 'npm:@react-email/components@0.0.22'
import { button as buttonStyles } from './styles.ts'

export interface EmailButtonProps {
  href: string
  children: React.ReactNode
  /** Override the default left alignment (matches the website's CTA placement). */
  align?: 'left' | 'center'
  style?: React.CSSProperties
}

/**
 * Solid near-black CTA with 2px radius — matches the website's primary
 * button. Wrapped in a Section so the button always sits on its own line
 * with consistent vertical breathing room.
 */
export function EmailButton({
  href,
  children,
  align = 'left',
  style,
}: EmailButtonProps) {
  return (
    <Section style={{ textAlign: align, margin: '24px 0' }}>
      <Link href={href} style={{ ...buttonStyles, ...style }}>
        {children}
      </Link>
    </Section>
  )
}

export default EmailButton
