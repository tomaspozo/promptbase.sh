/**
 * Shared style tokens for email templates.
 *
 * Mirrors the website's Swiss-minimalist design system (see src/index.css):
 * Hanken Grotesk + IBM Plex Mono, near-black on paper, hairline borders,
 * 2px radius, mono uppercase labels with wide tracking.
 *
 * Customize: agents change tokens directly here. Touch `colors.primary` and
 * `fontFamily.sans` first if you want a quick brand pass.
 */

export const colors = {
  // Surfaces
  background: '#fbfbfa', // paper
  surface: '#ffffff', // card
  // Foreground
  text: '#0a0a0a', // near-black
  textMuted: '#6b6b6b', // muted-foreground
  textLight: '#a3a3a3',
  // Lines
  border: '#e5e5e5', // hairline
  // Action
  primary: '#0a0a0a', // near-black (matches website default)
  primaryForeground: '#fbfbfa',
} as const

export const fontFamily = {
  sans: "'Hanken Grotesk', -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif",
  mono: "'IBM Plex Mono', ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
} as const

const RADIUS = '2px'

export const layout = {
  main: {
    backgroundColor: colors.background,
    fontFamily: fontFamily.sans,
    margin: 0,
    padding: '40px 16px',
  },
  container: {
    maxWidth: '520px',
    margin: '0 auto',
    backgroundColor: colors.surface,
    border: `1px solid ${colors.border}`,
    borderRadius: RADIUS,
    overflow: 'hidden' as const,
  },
  // Header: brand on the left, label on the right, hairline rule below.
  // Replicates the website's rule + label pattern.
  header: {
    padding: '20px 32px 16px',
    borderBottom: `1px solid ${colors.border}`,
  },
  headerRow: {
    width: '100%',
    borderCollapse: 'collapse' as const,
  },
  headerBrandCell: {
    textAlign: 'left' as const,
    verticalAlign: 'baseline' as const,
  },
  headerLabelCell: {
    textAlign: 'right' as const,
    verticalAlign: 'baseline' as const,
  },
  content: {
    padding: '32px',
  },
  footer: {
    padding: '20px 32px',
    borderTop: `1px solid ${colors.border}`,
  },
} as const

export const typography = {
  // Brand mark — small medium-weight sans, mirrors website header.
  brandName: {
    margin: 0,
    fontSize: '14px',
    fontWeight: 500,
    color: colors.text,
    fontFamily: fontFamily.sans,
    letterSpacing: '-0.01em',
  },
  // Tiny mono uppercase label with wide tracking — mirrors website `.label`.
  label: {
    margin: 0,
    fontSize: '10.5px',
    fontWeight: 400,
    color: colors.textMuted,
    fontFamily: fontFamily.mono,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.18em',
  },
  // Editorial heading: medium weight, slight negative tracking.
  title: {
    margin: '0 0 12px',
    fontSize: '26px',
    lineHeight: '32px',
    fontWeight: 500,
    color: colors.text,
    letterSpacing: '-0.02em',
    fontFamily: fontFamily.sans,
  },
  // Body copy — relaxed leading, muted-on-paper.
  text: {
    margin: '0 0 16px',
    fontSize: '15px',
    lineHeight: '24px',
    color: colors.textMuted,
    fontFamily: fontFamily.sans,
  },
  // Smaller helper line at the bottom of a body section.
  textSmall: {
    margin: '24px 0 0',
    fontSize: '13px',
    lineHeight: '20px',
    color: colors.textLight,
    fontFamily: fontFamily.sans,
  },
  // Footer line — mono label.
  footerText: {
    margin: 0,
    fontSize: '10.5px',
    fontWeight: 400,
    color: colors.textMuted,
    fontFamily: fontFamily.mono,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.18em',
  },
} as const

// Solid near-black button with 2px radius — matches the website's primary CTA.
export const button = {
  display: 'inline-block',
  padding: '12px 22px',
  backgroundColor: colors.primary,
  color: colors.primaryForeground,
  textDecoration: 'none',
  borderRadius: RADIUS,
  fontSize: '14px',
  fontWeight: 500,
  letterSpacing: '-0.005em',
  fontFamily: fontFamily.sans,
} as const

// OTP container: hairline-bordered, square corners, mono code.
export const otpCode = {
  box: {
    backgroundColor: colors.surface,
    border: `1px solid ${colors.border}`,
    borderRadius: RADIUS,
    padding: '20px 24px',
    textAlign: 'center' as const,
    margin: '24px 0',
  },
  label: {
    margin: '0 0 10px',
    fontSize: '10.5px',
    fontWeight: 400,
    color: colors.textMuted,
    fontFamily: fontFamily.mono,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.18em',
  },
  code: {
    margin: 0,
    fontSize: '30px',
    lineHeight: '36px',
    fontWeight: 500,
    fontFamily: fontFamily.mono,
    color: colors.text,
    letterSpacing: '0.24em',
    fontVariantNumeric: 'tabular-nums lining-nums',
  },
} as const
