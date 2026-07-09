import { useEffect, useState } from "react";
import { KeyRound, Loader2, Plus, Trash2, Users } from "lucide-react";
import type { User, UserRole } from "@/lib/types";
import { roleLabel } from "@/lib/permissions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  users: User[];
  currentUserId: number;
  onCreate: (input: {
    username: string;
    password: string;
    role: UserRole;
    displayName?: string;
  }) => Promise<void>;
  onDelete: (id: number) => Promise<void>;
  onResetPassword: (id: number, password: string) => Promise<void>;
  onRefresh: () => Promise<void>;
}

export function AdminUsersDialog({
  open,
  onOpenChange,
  users,
  currentUserId,
  onCreate,
  onDelete,
  onResetPassword,
  onRefresh,
}: Props) {
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<UserRole>("operateur");
  const [resetFor, setResetFor] = useState<number | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) void onRefresh();
  }, [open, onRefresh]);

  const create = async () => {
    if (!username.trim() || !password) return;
    setBusy(true);
    try {
      await onCreate({
        username: username.trim(),
        password,
        role,
        displayName: displayName.trim() || undefined,
      });
      setUsername("");
      setDisplayName("");
      setPassword("");
      setRole("operateur");
    } finally {
      setBusy(false);
    }
  };

  const reset = async () => {
    if (!resetFor || !newPassword) return;
    setBusy(true);
    try {
      await onResetPassword(resetFor, newPassword);
      setResetFor(null);
      setNewPassword("");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-hidden p-0">
        <DialogHeader className="border-b px-6 py-4">
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Gestion des utilisateurs
          </DialogTitle>
        </DialogHeader>

        <div className="max-h-[70vh] space-y-6 overflow-y-auto px-6 py-4">
          <section className="space-y-3 rounded-xl border bg-muted/20 p-4">
            <h3 className="text-sm font-semibold">Nouvel utilisateur</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Identifiant">
                <Input value={username} onChange={(e) => setUsername(e.target.value)} />
              </Field>
              <Field label="Nom affiché">
                <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
              </Field>
              <Field label="Mot de passe">
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </Field>
              <Field label="Profil">
                <Select value={role} onValueChange={(v) => setRole(v as UserRole)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Administrateur</SelectItem>
                    <SelectItem value="technicien">Technicien</SelectItem>
                    <SelectItem value="operateur">Opérateur</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
            </div>
            <Button onClick={() => void create()} disabled={busy || !username || !password}>
              <Plus className="h-4 w-4" />
              Créer
            </Button>
          </section>

          <section className="space-y-2">
            <h3 className="text-sm font-semibold">Utilisateurs existants</h3>
            {users.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucun utilisateur.</p>
            ) : (
              <ul className="space-y-2">
                {users.map((user) => (
                  <li
                    key={user.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-card px-3 py-2"
                  >
                    <div>
                      <p className="text-sm font-medium">{user.displayName}</p>
                      <p className="text-xs text-muted-foreground">
                        @{user.username} · {roleLabel(user.role)}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setResetFor(user.id)}
                        disabled={busy}
                      >
                        <KeyRound className="h-3.5 w-3.5" />
                        Réinit. MDP
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-destructive hover:text-destructive"
                        onClick={() => void onDelete(user.id)}
                        disabled={busy || user.id === currentUserId}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {resetFor && (
            <section className="space-y-3 rounded-xl border border-warning/30 bg-warning/5 p-4">
              <h3 className="text-sm font-semibold">Réinitialiser le mot de passe</h3>
              <Field label="Nouveau mot de passe">
                <Input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                />
              </Field>
              <div className="flex gap-2">
                <Button onClick={() => void reset()} disabled={busy || !newPassword}>
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Confirmer"}
                </Button>
                <Button variant="ghost" onClick={() => setResetFor(null)}>
                  Annuler
                </Button>
              </div>
            </section>
          )}
        </div>

        <DialogFooter className="border-t px-6 py-3">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Fermer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}
