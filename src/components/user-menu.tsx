import { useEffect, useState } from "react";
import { Link, useNavigate, useRouter } from "@tanstack/react-router";
import { LogOut, User } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface Profile {
  email: string | null;
  display_name: string | null;
  avatar_url: string | null;
}

function initials(p: Profile): string {
  const n = p.display_name?.trim();
  if (n)
    return n
      .split(/\s+/)
      .slice(0, 2)
      .map((s) => s[0])
      .join("")
      .toUpperCase();
  return (p.email?.[0] ?? "?").toUpperCase();
}

/**
 * Top-right account menu — initials avatar with the user's profile + log out.
 * Personal/account actions live here; workspace actions live in the
 * WorkspaceSwitcher on the left.
 */
export function UserMenu({ slug }: { slug: string }) {
  const navigate = useNavigate();
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data } = await supabase.rpc("profile_get");
      setProfile((data as unknown as Profile) ?? null);
    }
    void load();
  }, []);

  async function logout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    await router.invalidate();
    navigate({ to: "/" });
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label="Account menu"
          className="grid size-8 place-items-center overflow-hidden rounded-full border border-border bg-muted font-mono text-xs font-medium text-foreground outline-none transition-colors hover:border-foreground/40 focus-visible:ring-2 focus-visible:ring-primary/20 data-[state=open]:border-foreground/40"
        >
          {profile?.avatar_url ? (
            <img
              src={profile.avatar_url}
              alt=""
              className="size-full object-cover"
            />
          ) : profile ? (
            initials(profile)
          ) : null}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <div className="px-2 py-1.5">
          <p className="truncate text-sm font-medium">
            {profile?.display_name ?? "Account"}
          </p>
          {profile?.email && (
            <p className="truncate font-mono text-xs text-muted-foreground">
              {profile.email}
            </p>
          )}
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild className="gap-2">
          <Link to="/$slug/profile" params={{ slug }}>
            <User className="size-4" />
            Profile
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem className="gap-2" onClick={logout}>
          <LogOut className="size-4" />
          Log out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
