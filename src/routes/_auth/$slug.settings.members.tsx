import { useEffect, useState } from "react";
import { Loading } from "@/components/loading";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { Mail } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { permissionsFromClaims, hasPermissions } from "@/lib/permissions";
import { useHasPermission } from "@/hooks/use-has-permission";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { EmptyState } from "@/components/empty-state";
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
export const Route = createFileRoute("/_auth/$slug/settings/members")({
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

  const canInvite = useHasPermission("invitation.create");
  const canManageRoles = useHasPermission("membership.update");
  const canRemove = useHasPermission("membership.delete");
  const canManageMembers = canManageRoles || canRemove;

  async function refresh() {
    const supabase = createClient();
    const [m, i] = await Promise.all([
      supabase.rpc("membership_list"),
      supabase.rpc("invitation_list"),
    ]);
    if (m.error) setError(m.error.message);
    else setMembers(m.data as unknown as Member[]);
    // invitation_list is gated by invitation.create; plain members get a 403 we
    // intentionally swallow (the invite UI is hidden for them anyway).
    setInvitations(i.error ? [] : (i.data as unknown as Invitation[]));
  }

  useEffect(() => {
    void refresh();
  }, []);

  return (
    <div className="animate-rise space-y-10">
      <p className="text-sm text-muted-foreground">
        {canManageMembers || canInvite
          ? "Invite teammates, change roles, and remove access. Role changes take effect on the affected user's next sign-in."
          : "Everyone with access to this workspace."}
      </p>

      {error && (
        <p role="alert" className="callout-error">
          {error}
        </p>
      )}

      {canInvite && (
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
      )}

      {canInvite && (
        <section className="space-y-4">
          <h2 className="label">Pending invitations</h2>
          {invitations === null ? (
            <Loading />
          ) : invitations.length === 0 ? (
            <EmptyState icon={Mail} title="No pending invitations">
              Invite teammates above to get started.
            </EmptyState>
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
      )}

      <section className="space-y-4">
        <h2 className="label">Members</h2>
        {members === null ? (
          <Loading />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Member</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                {canManageMembers && (
                  <TableHead className="text-right">Actions</TableHead>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {members.map((m) => (
                <MemberRow
                  key={m.id}
                  member={m}
                  canManageRoles={canManageRoles}
                  canRemove={canRemove}
                  showActions={canManageMembers}
                  onChange={() => void refresh()}
                  onError={setError}
                />
              ))}
            </TableBody>
          </Table>
        )}
      </section>
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
          className="h-10 rounded-md"
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
        className="h-10"
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
  canManageRoles,
  canRemove,
  showActions,
  onChange,
  onError,
}: {
  member: Member;
  canManageRoles: boolean;
  canRemove: boolean;
  showActions: boolean;
  onChange: () => void;
  onError: (msg: string) => void;
}) {
  const [busy, setBusy] = useState(false);

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
        {member.role === "owner" || !canManageRoles ? (
          <Badge variant={member.role === "owner" ? "default" : "outline"}>
            {member.role}
          </Badge>
        ) : (
          <RoleSelect
            current={member.role}
            onChange={changeRole}
            disabled={busy}
          />
        )}
      </TableCell>
      {showActions && (
        <TableCell className="text-right">
          {member.role !== "owner" && canRemove && (
            <Button variant="ghost" size="sm" onClick={remove} disabled={busy}>
              Remove
            </Button>
          )}
        </TableCell>
      )}
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
    <Select
      id={id}
      value={current}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
    >
      {ROLES.map((r) => (
        <option key={r} value={r}>
          {r}
        </option>
      ))}
    </Select>
  );
}
