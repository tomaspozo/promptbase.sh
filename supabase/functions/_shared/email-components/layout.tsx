import * as React from 'npm:react@18.3.1'
import {
  Body,
  Container,
  Font,
  Head,
  Html,
  Preview,
  Section,
  Text,
} from 'npm:@react-email/components@0.0.22'
import { layout as layoutStyles, typography } from './styles.ts'

export interface EmailLayoutProps {
  children: React.ReactNode
  /** Subject-line preview text shown in inbox previews. */
  preview: string
  /**
   * Small uppercase mono label shown on the right of the header,
   * mirroring the website's `<brand> ─── <label>` pattern.
   * Examples: "Sign in", "Confirm email", "Reset password".
   */
  label?: string
  /** Optional html lang attribute. Defaults to "en". */
  lang?: string
}

/**
 * Full email document for transactional emails.
 *
 * Mirrors the frontend's Swiss-minimalist chrome:
 *   ┌──────────────────────────────────────┐
 *   │  AppName            CONFIRM EMAIL    │  ← brand left, mono label right
 *   ├──────────────────────────────────────┤  ← hairline rule
 *   │  <body>                              │
 *   ├──────────────────────────────────────┤  ← hairline rule
 *   │  © 2026 · APPNAME                    │  ← mono footer label
 *   └──────────────────────────────────────┘
 *
 * Renders the entire `<html>` document — templates simply do:
 *
 *   <EmailLayout preview="..." label="Confirm email">
 *     ...body...
 *   </EmailLayout>
 *
 * Brand text comes from the APP_NAME environment variable; defaults to
 * "App". Hanken Grotesk + IBM Plex Mono are loaded via React Email's
 * Font component so clients that support web fonts (Apple Mail, Gmail
 * web) match the website's type stack. Other clients fall back to the
 * stack defined in styles.ts.
 */
export function EmailLayout({
  children,
  preview,
  label,
  lang = 'en',
}: EmailLayoutProps) {
  const appName = Deno.env.get('APP_NAME') ?? 'App'

  return (
    <Html lang={lang}>
      <Head>
        <Font
          fontFamily="Hanken Grotesk"
          fallbackFontFamily="Helvetica"
          webFont={{
            url: 'https://fonts.gstatic.com/s/hankengrotesk/v8/ieVq2YZDLWuGJpnzaiwFXS9tYvBRz4QWY1g.woff2',
            format: 'woff2',
          }}
          fontWeight={400}
          fontStyle="normal"
        />
        <Font
          fontFamily="Hanken Grotesk"
          fallbackFontFamily="Helvetica"
          webFont={{
            url: 'https://fonts.gstatic.com/s/hankengrotesk/v8/ieVq2YZDLWuGJpnzaiwFXS9tWfFRz4QWY1g.woff2',
            format: 'woff2',
          }}
          fontWeight={500}
          fontStyle="normal"
        />
        <Font
          fontFamily="IBM Plex Mono"
          fallbackFontFamily="monospace"
          webFont={{
            url: 'https://fonts.gstatic.com/s/ibmplexmono/v19/-F63fjptAgt5VM-kVkqdyU8n5igg1l9kn-s.woff2',
            format: 'woff2',
          }}
          fontWeight={400}
          fontStyle="normal"
        />
      </Head>
      <Preview>{preview}</Preview>
      <Body style={layoutStyles.main}>
        <Container style={layoutStyles.container}>
          <Section style={layoutStyles.header}>
            <table
              style={layoutStyles.headerRow}
              cellPadding={0}
              cellSpacing={0}
              role="presentation"
            >
              <tbody>
                <tr>
                  <td style={layoutStyles.headerBrandCell}>
                    <Text style={typography.brandName}>{appName}</Text>
                  </td>
                  <td style={layoutStyles.headerLabelCell}>
                    {label ? <Text style={typography.label}>{label}</Text> : null}
                  </td>
                </tr>
              </tbody>
            </table>
          </Section>

          <Section style={layoutStyles.content}>{children}</Section>

          <Section style={layoutStyles.footer}>
            <Text style={typography.footerText}>
              &copy; {new Date().getFullYear()} &middot; {appName}
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  )
}

export default EmailLayout
