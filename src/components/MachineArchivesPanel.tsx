import { useMemo, useState } from "react";
import { Archive, CalendarDays, Search, Ticket as TicketIcon, Trash2, User } from "lucide-react";
import {
  ARCHIVE_CATEGORY_META,
  archivedItems,
  itemCreatedYear,
  matchesArchiveSearch,
  ticketForArchivedItem,
  type ArchiveListKey,
} from "@/lib/archives";
import type { ChecklistItem, Machine, Ticket, TodoItem } from "@/lib/types";
import { ItemChecklist } from "@/components/ItemChecklist";
import { ProgressRing, ProgressStatusBadge } from "@/components/ProgressRing";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

function fmtDate(iso?: string) {
  if (!iso) return null;
  try {
    return new Date(iso).toLocaleString("fr-FR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: iso.includes("T") ? "2-digit" : undefined,
      minute: iso.includes("T") ? "2-digit" : undefined,
    });
  } catch {
    return iso;
  }
}

const ACCENT: Record<ArchiveListKey, string> = {
  problems: "border-l-danger/70",
  flags: "border-l-warning/70",
  repairs: "border-l-maintenance/70",
  improvements: "border-l-primary/70",
};

export function MachineArchivesPanel({
  machine,
  tickets,
  canDelete,
  onDelete,
}: {
  machine: Machine;
  tickets: Ticket[];
  canDelete: boolean;
  onDelete: (item: TodoItem, listKey: ArchiveListKey) => void;
}) {
  const [year, setYear] = useState("all");
  const [query, setQuery] = useState("");
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({
    problems: true,
    flags: true,
    repairs: true,
    improvements: true,
  });

  const groups = useMemo(() => {
    return ARCHIVE_CATEGORY_META.map((meta) => {
      const items = archivedItems(machine[meta.key]).map((item) => {
        const ticket = ticketForArchivedItem(tickets, item, meta.ticketCategory);
        return {
          item,
          ticket,
          createdYear: itemCreatedYear(item, ticket),
        };
      });
      const years = items
        .map((entry) => entry.createdYear)
        .filter((value): value is number => value != null);
      return { ...meta, items, years };
    });
  }, [machine, tickets]);

  const years = useMemo(() => {
    const set = new Set<number>();
    for (const group of groups) {
      for (const yearValue of group.years) set.add(yearValue);
    }
    return [...set].sort((a, b) => b - a);
  }, [groups]);

  const filteredGroups = useMemo(() => {
    const yearNum = year === "all" ? null : Number(year);
    return groups
      .map((group) => ({
        ...group,
        items: group.items.filter(({ item, ticket, createdYear }) => {
          if (yearNum != null && createdYear !== yearNum) return false;
          return matchesArchiveSearch(item, ticket, group.label, query);
        }),
      }))
      .filter((group) => group.items.length > 0);
  }, [groups, year, query]);

  const totalArchived = groups.reduce((sum, group) => sum + group.items.length, 0);
  const totalShown = filteredGroups.reduce((sum, group) => sum + group.items.length, 0);

  if (totalArchived === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed bg-muted/30 px-6 py-14 text-center">
        <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
          <Archive className="h-5 w-5 text-muted-foreground" />
        </div>
        <p className="text-sm font-medium">Aucune archive pour l’instant</p>
        <p className="mt-1 max-w-sm text-xs text-muted-foreground">
          Les actions terminées restent dans leur onglet. Un administrateur peut les archiver
          pour constituer l’historique de la machine.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Rechercher une action, un auteur, un n° de ticket…"
            className="pl-9"
          />
        </div>
        <Select value={year} onValueChange={setYear}>
          <SelectTrigger className="w-full sm:w-[9.5rem]">
            <SelectValue placeholder="Année" />
          </SelectTrigger>
          <SelectContent className="z-[200]">
            <SelectItem value="all">Tout</SelectItem>
            {years.map((value) => (
              <SelectItem key={value} value={String(value)}>
                {value}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <p className="text-[11px] text-muted-foreground">
        {totalShown} action{totalShown > 1 ? "s" : ""}
        {(year !== "all" || query.trim()) && totalShown !== totalArchived
          ? ` sur ${totalArchived}`
          : ""}{" "}
        · regroupées par catégorie
      </p>

      {filteredGroups.length === 0 ? (
        <p className="rounded-xl border border-dashed py-8 text-center text-sm text-muted-foreground">
          Aucun résultat pour ces filtres.
        </p>
      ) : (
        <div className="space-y-3">
          {filteredGroups.map((group) => {
            const open = openGroups[group.key] !== false;
            return (
              <Collapsible
                key={group.key}
                open={open}
                onOpenChange={(next) =>
                  setOpenGroups((current) => ({ ...current, [group.key]: next }))
                }
                className="overflow-hidden rounded-2xl border bg-card"
              >
                <CollapsibleTrigger asChild>
                  <button
                    type="button"
                    className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition hover:bg-muted/40"
                  >
                    <span className="flex items-center gap-2">
                      <span
                        className={cn(
                          "h-2 w-2 rounded-full",
                          group.key === "problems" && "bg-danger",
                          group.key === "flags" && "bg-warning",
                          group.key === "repairs" && "bg-maintenance",
                          group.key === "improvements" && "bg-primary",
                        )}
                      />
                      <span className="text-sm font-semibold">{group.label}</span>
                    </span>
                    <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium tabular-nums text-muted-foreground">
                      {group.items.length}
                    </span>
                  </button>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <ul className="space-y-2 border-t px-3 py-3">
                    {group.items.map(({ item, ticket }) => (
                      <ArchiveRow
                        key={`${group.key}-${item.id ?? item.ticketId ?? item.text}`}
                        item={item}
                        ticket={ticket}
                        listKey={group.key}
                        canDelete={canDelete}
                        onDelete={() => onDelete(item, group.key)}
                      />
                    ))}
                  </ul>
                </CollapsibleContent>
              </Collapsible>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ArchiveRow({
  item,
  ticket,
  listKey,
  canDelete,
  onDelete,
}: {
  item: TodoItem;
  ticket?: Ticket;
  listKey: ArchiveListKey;
  canDelete: boolean;
  onDelete: () => void;
}) {
  const [tasksOpen, setTasksOpen] = useState(false);
  const checklist: ChecklistItem[] = item.checklist ?? ticket?.checklist ?? [];
  const created = fmtDate(ticket?.createdAt ?? item.createdAt);
  const closed = fmtDate(ticket?.closedAt) ?? item.completedDate;

  return (
    <li className={cn("rounded-xl border bg-background px-3 py-3", "border-l-4", ACCENT[listKey])}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            {ticket && (
              <span className="inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-[10px] font-semibold">
                <TicketIcon className="h-3 w-3" />
                #{ticket.id}
              </span>
            )}
            <ProgressStatusBadge items={checklist} />
            {closed && (
              <span className="text-[11px] text-muted-foreground">Clôturé {closed}</span>
            )}
          </div>
          <p className="mt-1.5 text-sm font-medium leading-snug">{item.text}</p>
          <div className="mt-2 flex flex-col gap-1 text-[11px] text-muted-foreground">
            {ticket ? (
              <>
                <span className="inline-flex items-center gap-1.5">
                  <User className="h-3 w-3 shrink-0" />
                  Ouvert par {ticket.createdByName}
                  {created ? ` · ${created}` : ""}
                </span>
                {(ticket.closedBy || closed) && (
                  <span className="inline-flex items-center gap-1.5">
                    <CalendarDays className="h-3 w-3 shrink-0" />
                    Fermé{ticket.closedBy ? ` par ${ticket.closedBy}` : ""}
                    {closed ? ` · ${closed}` : ""}
                  </span>
                )}
              </>
            ) : (
              created && (
                <span className="inline-flex items-center gap-1.5">
                  <CalendarDays className="h-3 w-3 shrink-0" />
                  Créé · {created}
                </span>
              )
            )}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {checklist.length > 0 && (
            <button
              type="button"
              onClick={() => setTasksOpen((v) => !v)}
              className="rounded-full p-0.5 transition hover:bg-muted/70"
              title={tasksOpen ? "Réduire les tâches" : "Afficher les tâches"}
            >
              <ProgressRing items={checklist} size={32} strokeWidth={3} />
            </button>
          )}
          {canDelete && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="text-destructive hover:text-destructive"
              onClick={onDelete}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </div>
      {checklist.length > 0 && (
        <div className="mt-2">
          <ItemChecklist
            items={checklist}
            onChange={() => {}}
            readOnly
            compact
            open={tasksOpen}
            onOpenChange={setTasksOpen}
          />
        </div>
      )}
    </li>
  );
}
