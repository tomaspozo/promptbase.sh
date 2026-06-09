import { useEffect, useState } from "react";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { Mail } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { permissionsFromClaims, hasPermissions } from "@/lib/permissions";
import { useHasPermission } from "@/hooks/use-has-permission";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

/**
 * Settings · Members. Permission gate runs in beforeLoad using the JWT claims
 * from the root context (replaces the Next.js settings/layout.tsx
 * requirePermission). Management controls are additionally gated with
 * useHasPermission (UX only — the backend auth_verify_access() guard in each
 * RPC is the real gate).
 */
export const Route = createFileRoute("/_auth/settings/members")({
  beforeLoad: ({ context }) => {
    const perms = permissionsFromClaims(context.user);
    if (!hasPermissions(perms, ["membership.read"])) {
      throw redirect({ to: "/forbidden" });
    }
  },
  component: MembersPage,
});

interface Member {
  id: string;
  user_id: string;
  role: string;
  email: string | null;
  display_name: string | null;
  created_at: string;
}

interface Invitation {
  id: string;
  email: string;
  role: string;
  invited_by: string;
  expires_at: string;
  created_at: string;
}

const ROLES = ["admin", "member", "viewer"] as const;

function MembersPage() {
  const [members, setMembers] = useState<Member[] | null>(null);
  const [invitations, setInvitations] = useState<Invitation[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    const supabase = createClient();
    const [m, i] = await Promise.all([
      supabase.rpc("membership_list"),
      supabase.rpc("invitation_list"),
    ]);
    if (m.error) setError(m.error.message);
    else setMembers(m.data as unknown as Member[]);
    if (i.error) setError(i.error.message);
    else setInvitations(i.data as unknown as Invitation[]);
  }

  useEffect(() => {
    void refresh();
  }, []);

  return (
    <div className="mx-auto max-w-4xl px-6 py-12">
      <div className="rule pt-4">
        <p className="label">Settings · Members</p>
      </div>

      <div className="mt-12 animate-rise space-y-12">
        <header>
          <h1 className="text-3xl font-medium tracking-[-0.02em] sm:text-4xl">
            Workspace members
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Invite teammates, change roles, and remove access. Role changes
            take effect on the affected user&apos;s next sign-in.
          </p>
        </header>

        {error && (
          <p
            role="alert"
            className="border border-[color:var(--down)]/30 bg-[color:var(--down)]/5 px-3 py-2 font-mono text-xs text-[color:var(--down)]"
          >
            {error}
          </p>
        )}

        <section className="space-y-4">
          <h2 className="label">Invite</h2>
          <InviteForm
            onInvited={() => {
              setError(null);
              void refresh();
            }}
            onError={setError}
          />
        </section>

        <section className="space-y-4">
          <h2 className="label">Pending invitations</h2>
          {invitations === null ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : invitations.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border bg-card/40 py-12 text-center">
              <div className="mb-4 rounded-lg bg-muted p-4">
                <Mail className="size-6 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold">No pending invitations</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Invite teammates above to get started.
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Expires</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invitations.map((inv) => (
                  <InvitationRow
                    key={inv.id}
                    invitation={inv}
                    onChange={() => void refresh()}
                    onError={setError}
                  />
                ))}
              </TableBody>
            </Table>
          )}
        </section>

        <section className="space-y-4">
          <h2 className="label">Members</h2>
          {members === null ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Member</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {members.map((m) => (
                  <MemberRow
                    key={m.id}
                    member={m}
                    onChange={() => void refresh()}
                    onError={setError}
                  />
                ))}
              </TableBody>
            </Table>
          )}
        </section>
      </div>
    </div>
  );
}

function InviteForm({
  onInvited,
  onError,
}: {
  onInvited: () => void;
  onError: (msg: string) => void;
}) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<string>("member");
  const [loading, setLoading] = useState(false);
  const canInvite = useHasPermission("invitation.create");

  async function handle(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.rpc("invitation_create", {
        p_email: email,
        p_role: role,
      });
      if (error) {
        onError(error.message);
        return;
      }
      setEmail("");
      onInvited();
    } finally {
      setLoading(false);
    }
  }

  return (
    <form
      onSubmit={handle}
      className="flex flex-col gap-3 sm:flex-row sm:items-end"
    >
      <div className="flex-1 space-y-2">
        <Label htmlFor="invite-email">Email</Label>
        <Input
          id="invite-email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="h-11 rounded-md"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="invite-role">Role</Label>
        <RoleSelect current={role} onChange={setRole} id="invite-role" />
      </div>
      <Button
        type="submit"
        disabled={loading || !canInvite}
        title={
          canInvite ? undefined : "You don't have permission to invite members"
        }
        className="h-11"
      >
        {loading ? "Inviting…" : "Send invite"}
      </Button>
    </form>
  );
}

function InvitationRow({
  invitation,
  onChange,
  onError,
}: {
  invitation: Invitation;
  onChange: () => void;
  onError: (msg: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const canResend = useHasPermission("invitation.create");
  const canRevoke = useHasPermission("invitation.delete");

  async function call(rpc: "invitation_resend" | "invitation_revoke") {
    setBusy(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.rpc(rpc, {
        p_invitation_id: invitation.id,
      });
      if (error) onError(error.message);
      else onChange();
    } finally {
      setBusy(false);
    }
  }

  return (
    <TableRow>
      <TableCell className="font-mono text-sm">{invitation.email}</TableCell>
      <TableCell>
        <Badge variant="outline">{invitation.role}</Badge>
      </TableCell>
      <TableCell className="tnum text-xs text-muted-foreground">
        {new Date(invitation.expires_at).toLocaleDateString()}
      </TableCell>
      <TableCell className="text-right">
        {canResend && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => call("invitation_resend")}
            disabled={busy}
          >
            Resend
          </Button>
        )}
        {canRevoke && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => call("invitation_revoke")}
            disabled={busy}
          >
            Revoke
          </Button>
        )}
      </TableCell>
    </TableRow>
  );
}

function MemberRow({
  member,
  onChange,
  onError,
}: {
  member: Member;
  onChange: () => void;
  onError: (msg: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const canManageRoles = useHasPermission("membership.update");
  const canRemove = useHasPermission("membership.delete");

  async function changeRole(role: string) {
    setBusy(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.rpc("membership_update_role", {
        p_membership_id: member.id,
        p_role: role,
      });
      if (error) onError(error.message);
      else onChange();
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    setBusy(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.rpc("membership_remove", {
        p_membership_id: member.id,
      });
      if (error) onError(error.message);
      else onChange();
    } finally {
      setBusy(false);
    }
  }

  return (
    <TableRow>
      <TableCell>{member.display_name ?? "—"}</TableCell>
      <TableCell className="font-mono text-sm">{member.email ?? "—"}</TableCell>
      <TableCell>
        {member.role === "owner" ? (
          <Badge>{member.role}</Badge>
        ) : (
          <RoleSelect
            current={member.role}
            onChange={changeRole}
            disabled={busy || !canManageRoles}
          />
        )}
      </TableCell>
      <TableCell className="text-right">
        {member.role !== "owner" && canRemove && (
          <Button variant="ghost" size="sm" onClick={remove} disabled={busy}>
            Remove
          </Button>
        )}
      </TableCell>
    </TableRow>
  );
}

function RoleSelect({
  current,
  onChange,
  id,
  disabled,
}: {
  current: string;
  onChange: (role: string) => void;
  id?: string;
  disabled?: boolean;
}) {
  return (
    <select
      id={id}
      value={current}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      className="h-11 rounded-md border border-input bg-background px-3 text-sm"
    >
      {ROLES.map((r) => (
        <option key={r} value={r}>
          {r}
        </option>
      ))}
    </select>
  );
}
