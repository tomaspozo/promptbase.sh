/// <reference types="vite/client" />
import {
  HeadContent,
  Outlet,
  Scripts,
  createRootRoute,
} from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { ThemeProvider } from "next-themes";
import type { ReactNode } from "react";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { NotFound } from "@/components/not-found";
import globalCss from "@/styles/globals.css?url";

// Brand type stack, self-hosted via @fontsource (replaces next/font):
// DM Sans for body, DM Mono for labels/code — used app-wide and on the landing.
import "@fontsource-variable/dm-sans";
import "@fontsource/dm-mono/400.css";
import "@fontsource/dm-mono/500.css";

// Reads the session from the request cookies during SSR (and on the server
// during client navigations). Returns the decoded JWT claims or null. The
// @supabase/ssr server client refreshes the cookie here when needed — this
// replaces the old Next.js middleware (proxy.ts).
const fetchUser = createServerFn({ method: "GET" }).handler(async () => {
  const supabase = getSupabaseServerClient();
  const { data } = await supabase.auth.getClaims();
  return data?.claims ?? null;
});

export const Route = createRootRoute({
  beforeLoad: async () => {
    const user = await fetchUser();
    return { user };
  },
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "promptbase.sh — prompt management you own" },
      {
        name: "description",
        content:
          "Version-controlled system prompts and message templates that run in your own Supabase — easily editable by your team.",
      },
    ],
    links: [
      { rel: "stylesheet", href: globalCss },
      { rel: "icon", href: "/favicon.svg", type: "image/svg+xml" },
    ],
  }),
  notFoundComponent: NotFound,
  component: RootComponent,
});

function RootComponent() {
  return (
    <RootDocument>
      <Outlet />
    </RootDocument>
  );
}

function RootDocument({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          {children}
        </ThemeProvider>
        <Scripts />
      </body>
    </html>
  );
}
