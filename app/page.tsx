//
// This is an empty frontend scaffold. No design has been applied yet.
// Use the `frontend-design` skill to design pages and components.
//
// Available UI primitives:  Button, Card, Input, Label, DropdownMenu  →  components/ui/
// Available auth components: LoginForm, SignUpForm, AuthButton  →  components/
// Supabase clients:          createClient (browser/server)  →  lib/supabase/
//
// Replace this page with your app's actual UI.
//

export default function Home() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-3 text-center px-6">
      <h1 className="text-2xl font-semibold tracking-tight">my-app</h1>
      <p className="text-sm text-muted-foreground">
        Frontend scaffold — no design applied yet
      </p>
      <p className="text-xs text-muted-foreground/60">
        Edit <code className="bg-muted px-1 py-0.5 rounded font-mono text-muted-foreground">app/page.tsx</code> to start building
      </p>
    </main>
  );
}
