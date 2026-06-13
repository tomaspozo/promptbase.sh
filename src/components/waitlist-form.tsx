import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/**
 * Landing-page early-access entry point. Carries the typed email into the
 * sign-up form (which does the real validation). After sign-up + email
 * verification the user lands on /pending until an admin approves them.
 *
 * Left-aligned to sit in the document-style hero; width is controlled here.
 */
export function WaitlistForm() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");

  function submit() {
    const value = email.trim();
    navigate({
      to: "/auth/sign-up",
      search: value ? { email: value } : {},
    });
  }

  return (
    <div className="max-w-[420px]">
      <div className="mb-4 inline-flex items-center gap-1.5 rounded-full border border-border bg-secondary px-2.5 py-1 text-xs text-muted-foreground">
        <span className="size-1.5 animate-pulse rounded-full bg-primary motion-reduce:animate-none" />
        <span>Early access · approval required</span>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <Input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") submit();
          }}
          placeholder="your@email.com"
          autoComplete="email"
        />
        <Button onClick={submit} className="shrink-0">
          Get early access
        </Button>
      </div>

      <p className="mt-3 text-xs text-muted-foreground/70">
        Sign up now — we&apos;ll email you once you&apos;re approved.
      </p>
    </div>
  );
}
