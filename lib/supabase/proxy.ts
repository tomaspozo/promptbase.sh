import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@/types/database";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      db: { schema: "api" },
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const { data } = await supabase.auth.getClaims();
  const user = data?.claims;

  // OPTIONAL coarse permission gate at the middleware layer. Default: OFF —
  // permission gating lives in per-section server guards (e.g.
  // app/settings/layout.tsx via requirePermission), which sit next to the
  // routes they protect. Uncomment + fill PERMISSION_ROUTES to ALSO enforce
  // here. Reuses the getClaims() result above (no extra decode). Keep the map
  // in sync with your route tree. The backend auth_verify_access() guard in
  // each RPC is the real gate regardless.
  //
  // import { permissionsFromClaims } from "@/lib/permissions";
  // const PERMISSION_ROUTES: Array<{ prefix: string; permission: string }> = [
  //   { prefix: "/settings/members", permission: "membership.read" },
  // ];
  // const rule = PERMISSION_ROUTES.find((r) =>
  //   request.nextUrl.pathname.startsWith(r.prefix),
  // );
  // if (user && rule && !permissionsFromClaims(user).includes(rule.permission)) {
  //   const url = request.nextUrl.clone();
  //   url.pathname = "/forbidden";
  //   return NextResponse.redirect(url);
  // }

  // Allowlist for unauth-accessible paths.
  //   /                — public landing
  //   /auth/*          — sign-in, sign-up, check-inbox, forgot-password, confirm
  //   /update-password — recovery destination (single-purpose session lives here)
  //   /accept-invite   — workspace invitation acceptance (handles both new and existing users)
  const path = request.nextUrl.pathname;
  const isAuthPath =
    path === "/" ||
    path.startsWith("/auth") ||
    path.startsWith("/update-password") ||
    path.startsWith("/accept-invite");

  if (!user && !isAuthPath) {
    const url = request.nextUrl.clone();
    url.pathname = "/auth/sign-in";
    url.searchParams.set("next", path);
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
