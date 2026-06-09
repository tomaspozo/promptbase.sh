import type { Metadata } from "next";
import {
  Hanken_Grotesk,
  IBM_Plex_Mono,
  DM_Mono,
  DM_Sans,
} from "next/font/google";
import { ThemeProvider } from "next-themes";
import "./globals.css";

const defaultUrl = process.env.VERCEL_URL
  ? `https://${process.env.VERCEL_URL}`
  : "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(defaultUrl),
  title: "promptbase.sh — prompt management you own",
  description:
    "Version-controlled system prompts and message templates that run in your own Supabase — easily editable by your team.",
};

// Swiss minimalist type stack — Hanken Grotesk for sans, IBM Plex Mono for
// numerical data and labels. Both bound to Tailwind's --font-sans and
// --font-mono via the body class so utility classes (e.g. `font-mono`,
// the `.label` helper) pick them up automatically.
const hankenGrotesk = Hanken_Grotesk({
  variable: "--font-sans",
  display: "swap",
  subsets: ["latin"],
});

const ibmPlexMono = IBM_Plex_Mono({
  variable: "--font-mono",
  display: "swap",
  weight: ["400", "500", "600"],
  subsets: ["latin"],
});

// promptbase.sh brand stack — DM Mono for the display headline + labels/code,
// DM Sans for body. Exposed as CSS variables and consumed by the landing page
// styles (app/landing.module.css).
const dmMono = DM_Mono({
  variable: "--font-dm-mono",
  display: "swap",
  weight: ["400", "500"],
  subsets: ["latin"],
});

const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  display: "swap",
  weight: ["400", "500"],
  subsets: ["latin"],
});

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${hankenGrotesk.variable} ${ibmPlexMono.variable} ${dmMono.variable} ${dmSans.variable} antialiased`}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
