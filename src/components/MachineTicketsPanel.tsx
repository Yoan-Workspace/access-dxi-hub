import { useEffect, useState } from "react";
import { Loader2, Trash2 } from "lucide-react";
import type { ChecklistItem, Ticket, TicketCategory } from "@/lib/types";
import {
  TICKET_CATEGORY_LABELS,
  TICKET_EDIT_CATEGORIES,
  canDeleteTicket,
  canEditTicket,
} from "@/lib/permissions";
import { useAuth } from "@/lib/auth";
import { ItemChecklist } from "@/components/ItemChecklist";
import { ProgressRing, ProgressStatusBadge } from "@/components/ProgressRing";
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

const categories: TicketCategory[] = TICKET_EDIT_CATEGORIES;

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
    input: Partial<Pick<Ticket, "category" | "comment" | "status" | "checklist">>,
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
  const [checklist, setChecklist] = useState<ChecklistItem[]>(ticket.checklist ?? []);
  const [tasksOpen, setTasksOpen] = useState(false);

  useEffect(() => {
    setCategory(ticket.category);
    setComment(ticket.comment);
    setChecklist(ticket.checklist ?? []);
  }, [ticket.category, ticket.comment, ticket.checklist]);

  const saveCategory = async (next: TicketCategory) => {
    if (next === ticket.category) return;
    setCategory(next);
    setSaving(true);
    try {
      await onUpdate(ticket.id, { category: next });
    } catch {
      setCategory(ticket.category);
    } finally {
      setSaving(false);
    }
  };

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

  const persistChecklist = async (next: ChecklistItem[]) => {
    const previous = checklist;
    setChecklist(next);
    try {
      await onUpdate(ticket.id, { checklist: next });
    } catch {
      setChecklist(previous);
    }
  };

  return (
    <li className="rounded-xl border bg-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <button
            type="button"
            onClick={() => setTasksOpen((v) => !v)}
            className="rounded-full p-0.5 transition hover:bg-muted/70 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            title={tasksOpen ? "Réduire les tâches" : "Afficher les tâches"}
            aria-expanded={tasksOpen}
            aria-label={tasksOpen ? "Réduire les tâches" : "Afficher les tâches"}
          >
            <ProgressRing items={checklist} />
          </button>
          <div className="min-w-0 flex-1">
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
                {TICKET_CATEGORY_LABELS[ticket.category] ?? ticket.category}
              </span>
              <ProgressStatusBadge items={checklist} />
            </div>
            <p className="mt-2 text-sm whitespace-pre-wrap">{ticket.comment}</p>
            <p className="mt-2 text-[11px] text-muted-foreground">
              Par {ticket.createdByName} · {fmtDate(ticket.createdAt)}
              {ticket.closedAt && ` · Fermé le ${fmtDate(ticket.closedAt)}`}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {editable && ticket.category !== "amelioration" && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => void saveCategory("amelioration")}
              disabled={saving}
            >
              Passer en Improvement
            </Button>
          )}
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

      <div className="mt-2">
        <ItemChecklist
          items={checklist}
          onChange={(next) => void persistChecklist(next)}
          readOnly={!editable}
          open={tasksOpen}
          onOpenChange={setTasksOpen}
        />
      </div>

      {editing && editable && (
        <div className="mt-4 space-y-3 border-t pt-4">
          <div className="space-y-1.5">
            <Label>Catégorie</Label>
            <Select
              value={category}
              onValueChange={(v) => void saveCategory(v as TicketCategory)}
              disabled={saving}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="z-[200]">
                {(categories.includes(category) ? categories : [category, ...categories]).map(
                  (c) => (
                    <SelectItem key={c} value={c}>
                      {TICKET_CATEGORY_LABELS[c] ?? c}
                    </SelectItem>
                  ),
                )}
              </SelectContent>
            </Select>
            <p className="text-[11px] text-muted-foreground">
              Le changement de catégorie est enregistré tout de suite.
            </p>
          </div>
          <div className="space-y-1.5">
            <Label>Commentaire</Label>
            <Textarea value={comment} onChange={(e) => setComment(e.target.value)} rows={3} />
          </div>
          <Button size="sm" onClick={() => void save()} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Enregistrer le commentaire"}
          </Button>
        </div>
      )}
    </li>
  );
}

