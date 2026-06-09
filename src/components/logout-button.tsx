import { useRouter } from "@tanstack/react-router";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";

export function LogoutButton() {
  const router = useRouter();

  const logout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    // Re-run the root beforeLoad so context.user clears, then land on home.
    await router.invalidate();
    router.navigate({ to: "/" });
  };

  return (
    <Button onClick={logout} variant="outline" size="sm">
      Logout
    </Button>
  );
}
