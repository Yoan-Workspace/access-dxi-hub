import { TICKET_CATEGORY_LABELS } from "@/lib/permissions";
import type { Machine, Ticket, TodoItem } from "@/lib/types";

export const ARCHIVE_LIST_KEYS = [
  "problems",
  "flags",
  "repairs",
  "improvements",
] as const;

export type ArchiveListKey = (typeof ARCHIVE_LIST_KEYS)[number];

export const ARCHIVE_CATEGORY_META: {
  key: ArchiveListKey;
  label: string;
  ticketCategory: Ticket["category"] | null;
}[] = [
  { key: "problems", label: "Problèmes", ticketCategory: "probleme" },
  { key: "flags", label: "Flags", ticketCategory: "flag" },
  { key: "repairs", label: "Réparations", ticketCategory: "reparation" },
  { key: "improvements", label: "Improvements", ticketCategory: "amelioration" },
];

export function isArchived(item: TodoItem | undefined | null): boolean {
  return Boolean(item?.archived);
}

export function liveItems(items?: TodoItem[] | null): TodoItem[] {
  return (items ?? []).filter((item) => !isArchived(item));
}

export function archivedItems(items?: TodoItem[] | null): TodoItem[] {
  return (items ?? []).filter((item) => isArchived(item));
}

export function withArchivedKept(nextLive: TodoItem[], previous: TodoItem[] | undefined): TodoItem[] {
  return [...nextLive, ...archivedItems(previous)];
}

export function archivedTicketIds(machine: Pick<Machine, ArchiveListKey> | null | undefined): Set<number> {
  const ids = new Set<number>();
  if (!machine) return ids;
  for (const key of ARCHIVE_LIST_KEYS) {
    for (const item of machine[key] ?? []) {
      if (isArchived(item) && item.ticketId != null) {
        ids.add(Number(item.ticketId));
      }
    }
  }
  return ids;
}

export function visibleTickets(
  tickets: Ticket[],
  machine: Pick<Machine, ArchiveListKey> | null | undefined,
): Ticket[] {
  const hidden = archivedTicketIds(machine);
  return tickets.filter((ticket) => !hidden.has(Number(ticket.id)));
}

export function ticketForArchivedItem(
  tickets: Ticket[],
  item: TodoItem,
  category: Ticket["category"] | null,
): Ticket | undefined {
  if (item.ticketId != null) {
    return tickets.find((ticket) => Number(ticket.id) === Number(item.ticketId));
  }
  if (!category) return undefined;
  return tickets.find(
    (ticket) =>
      ticket.category === category &&
      Number(ticket.itemId) === Number(item.id),
  );
}

function yearFromIso(value?: string | null): number | null {
  if (!value) return null;
  const year = new Date(value).getFullYear();
  return Number.isFinite(year) ? year : null;
}

function yearFromFrDate(value?: string | null): number | null {
  const match = String(value ?? "").match(/(\d{4})\s*$/);
  if (!match) return null;
  const year = Number(match[1]);
  return Number.isFinite(year) ? year : null;
}

/** Année de création : ticket, sinon createdAt, sinon date de clôture. */
export function itemCreatedYear(item: TodoItem, ticket?: Ticket | null): number | null {
  return (
    yearFromIso(ticket?.createdAt) ??
    yearFromIso(item.createdAt) ??
    yearFromFrDate(item.completedDate) ??
    yearFromIso(item.archivedAt)
  );
}

function fold(value: unknown): string {
  return String(value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "");
}

export function archiveSearchHaystack(
  item: TodoItem,
  ticket: Ticket | undefined,
  categoryLabel: string,
): string {
  const parts = [
    item.text,
    item.completedDate,
    item.createdAt,
    item.archivedAt,
    categoryLabel,
    ...(item.checklist ?? []).flatMap((task) => [task.text, task.completedAt]),
  ];
  if (ticket) {
    parts.push(
      `#${ticket.id}`,
      String(ticket.id),
      ticket.comment,
      ticket.createdByName,
      ticket.closedBy,
      ticket.createdAt,
      ticket.closedAt,
      ticket.category,
      TICKET_CATEGORY_LABELS[ticket.category],
      ...(ticket.checklist ?? []).flatMap((task) => [task.text, task.completedAt]),
    );
  }
  return fold(parts.filter(Boolean).join(" "));
}

export function matchesArchiveSearch(
  item: TodoItem,
  ticket: Ticket | undefined,
  categoryLabel: string,
  query: string,
): boolean {
  const needle = fold(query.trim());
  if (!needle) return true;
  return archiveSearchHaystack(item, ticket, categoryLabel).includes(needle);
}

export function nowIsoStamp(): string {
  return new Date().toISOString().slice(0, 19);
}
