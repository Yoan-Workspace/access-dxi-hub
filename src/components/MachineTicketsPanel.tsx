import { useState } from "react";
import { Loader2, Trash2 } from "lucide-react";
import type { Ticket, TicketCategory } from "@/lib/types";
import {
  TICKET_CATEGORY_LABELS,
  canDeleteTicket,
  canEditTicket,
} from "@/lib/permissions";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

const categories: TicketCategory[] = [
  "reparation",
  "probleme",
  "flag",
  "non_classe",
];

function fmtDate(iso: string) {
  try {
    return new Date(iso).toLocaleString("fr-FR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

interface Props {
  tickets: Ticket[];
  onUpdate: (
    id: number,
    input: Partial<Pick<Ticket, "category" | "comment" | "status">>,
  ) => Promise<void>;
  onDelete: (id: number) => Promise<void>;
}

export function MachineTicketsPanel({ tickets, onUpdate, onDelete }: Props) {
  const { user } = useAuth();
  const editable = canEditTicket(user?.role);
  const deletable = canDeleteTicket(user?.role);

  if (tickets.length === 0) {
    return (
      <p className="rounded-lg border border-dashed py-8 text-center text-sm text-muted-foreground">
        Aucun ticket pour cette machine.
      </p>
    );
  }

  return (
    <ul className="space-y-3">
      {tickets.map((ticket) => (
        <TicketRow
          key={ticket.id}
          ticket={ticket}
          editable={editable}
          deletable={deletable}
          onUpdate={onUpdate}
          onDelete={onDelete}
        />
      ))}
    </ul>
  );
}

function TicketRow({
  ticket,
  editable,
  deletable,
  onUpdate,
  onDelete,
}: {
  ticket: Ticket;
  editable: boolean;
  deletable: boolean;
  onUpdate: Props["onUpdate"];
  onDelete: Props["onDelete"];
}) {
  const [editing, setEditing] = useState(false);
  const [category, setCategory] = useState(ticket.category);
  const [comment, setComment] = useState(ticket.comment);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      await onUpdate(ticket.id, { category, comment });
      setEditing(false);
    } finally {
      setSaving(false);
    }
  };

  const toggleStatus = async () => {
    setSaving(true);
    try {
      await onUpdate(ticket.id, {
        status: ticket.status === "open" ? "closed" : "open",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <li className="rounded-xl border bg-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              #{ticket.id}
            </span>
            <span
              className={cn(
                "rounded-full px-2 py-0.5 text-[10px] font-semibold",
                ticket.status === "open"
                  ? "bg-warning/15 text-warning"
                  : "bg-muted text-muted-foreground",
              )}
            >
              {ticket.status === "open" ? "Ouvert" : "Fermé"}
            </span>
            <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-medium">
              {TICKET_CATEGORY_LABELS[ticket.category]}
            </span>
          </div>
          <p className="mt-2 text-sm whitespace-pre-wrap">{ticket.comment}</p>
          <p className="mt-2 text-[11px] text-muted-foreground">
            Par {ticket.createdByName} · {fmtDate(ticket.createdAt)}
            {ticket.closedAt && ` · Fermé le ${fmtDate(ticket.closedAt)}`}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {editable && (
            <>
              <Button
                size="sm"
                variant="outline"
                onClick={() => void toggleStatus()}
                disabled={saving}
              >
                {ticket.status === "open" ? "Fermer" : "Rouvrir"}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setEditing((v) => !v)}
                disabled={saving}
              >
                {editing ? "Annuler" : "Modifier"}
              </Button>
            </>
          )}
          {deletable && (
            <Button
              size="sm"
              variant="outline"
              className="text-destructive hover:text-destructive"
              onClick={() => void onDelete(ticket.id)}
              disabled={saving}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </div>

      {editing && editable && (
        <div className="mt-4 space-y-3 border-t pt-4">
          <div className="space-y-1.5">
            <Label>Catégorie</Label>
            <Select
              value={category}
              onValueChange={(v) => setCategory(v as TicketCategory)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {categories.map((c) => (
                  <SelectItem key={c} value={c}>
                    {TICKET_CATEGORY_LABELS[c]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Commentaire</Label>
            <Textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={3}
            />
          </div>
          <Button size="sm" onClick={() => void save()} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Enregistrer"}
          </Button>
        </div>
      )}
    </li>
  );
}
