import { useEffect, useState } from "react";
import { Bell, Loader2, Zap } from "lucide-react";
import { roleLabel } from "@/lib/permissions";
import type { PresenceUser } from "@/lib/api";
import { requestWizzNotifications } from "@/lib/wizz";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export function PresenceDialog({
  open,
  onOpenChange,
  users,
  currentUserId,
  sendingId,
  onWizz,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  users: PresenceUser[];
  currentUserId?: number;
  sendingId: number | null;
  onWizz: (user: PresenceUser) => void;
}) {
  const others = users.filter((user) => user.id !== currentUserId);
  const me = users.find((user) => user.id === currentUserId);
  const [notifPermission, setNotifPermission] = useState<NotificationPermission>(() =>
    typeof Notification === "undefined" ? "denied" : Notification.permission,
  );

  useEffect(() => {
    if (!open) return;
    void requestWizzNotifications().then(setNotifPermission);
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Connectés</DialogTitle>
          <p className="text-xs text-muted-foreground">
            Clique sur une personne pour lui envoyer un wizz, comme sur MSN.
          </p>
        </DialogHeader>

        {typeof Notification !== "undefined" && notifPermission !== "granted" && (
          <button
            type="button"
            onClick={() => void requestWizzNotifications().then(setNotifPermission)}
            className="flex w-full items-center gap-2 rounded-lg border border-dashed px-3 py-2 text-left text-xs text-muted-foreground transition hover:border-primary/40 hover:text-foreground"
          >
            <Bell className="h-3.5 w-3.5 shrink-0" />
            {notifPermission === "denied"
              ? "Notifications bloquées dans le navigateur — autorise-les pour voir un wizz hors de la page."
              : "Autoriser les notifications pour recevoir un wizz même si tu n’es pas sur la page."}
          </button>
        )}

        <div className="max-h-[60vh] space-y-1 overflow-y-auto">
          {me && (
            <div className="flex items-center gap-3 rounded-lg border border-transparent px-2 py-2">
              <span className="relative flex h-8 w-8 items-center justify-center rounded-full bg-success/15 text-xs font-semibold text-success">
                {initials(me.displayName || me.username)}
                <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-background bg-success" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">
                  {me.displayName}{" "}
                  <span className="text-xs font-normal text-muted-foreground">(vous)</span>
                </p>
                <p className="text-[11px] text-muted-foreground">{roleLabel(me.role)}</p>
              </div>
            </div>
          )}

          {others.length === 0 && (
            <p className="px-2 py-6 text-center text-sm text-muted-foreground">
              Personne d’autre n’est connecté pour le moment.
            </p>
          )}

          {others.map((user) => (
            <button
              key={user.id}
              type="button"
              onClick={() => onWizz(user)}
              disabled={sendingId === user.id}
              className={cn(
                "flex w-full items-center gap-3 rounded-lg border border-transparent px-2 py-2 text-left transition",
                "hover:border-primary/30 hover:bg-secondary/70",
                "disabled:cursor-wait disabled:opacity-70",
              )}
              title={`Envoyer un wizz à ${user.displayName}`}
            >
              <span className="relative flex h-8 w-8 items-center justify-center rounded-full bg-mp/15 text-xs font-semibold text-mp">
                {initials(user.displayName || user.username)}
                <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-background bg-success" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{user.displayName}</p>
                <p className="text-[11px] text-muted-foreground">{roleLabel(user.role)}</p>
              </div>
              {sendingId === user.id ? (
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              ) : (
                <Zap className="h-4 w-4 text-warning" />
              )}
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

export function PresenceButton({
  count,
  onClick,
}: {
  count: number;
  onClick: () => void;
}) {
  return (
    <Button variant="outline" onClick={onClick} title="Personnes connectées">
      <span className="relative">
        <Zap className="h-4 w-4" />
        <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-success" />
      </span>
      <span className="hidden sm:inline">
        {count} {count > 1 ? "connectés" : "connecté"}
      </span>
    </Button>
  );
}
