import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/**
 * Protected route layout.
 *
 * The proxy middleware (`lib/supabase/proxy.ts`) does a path-based gate
 * for unauth'd users. This layout is the explicit server-side guard for
 * the gated section — it runs AFTER auth cookies are confirmed and gives
 * us a typed `user` for child server components.
 */
export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/sign-in");
  }

  return <>{children}</>;
}
