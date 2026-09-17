import { sameChecklist } from "@/lib/checklist";
import type { Machine, Ticket, TodoItem } from "@/lib/types";

function todayFr() {
  return new Date().toLocaleDateString("fr-FR");
}

function sameId(a: number | string | undefined, b: number | string | undefined) {
  return Number(a) === Number(b);
}

type LinkedListKey = "problems" | "flags" | "improvements";

const LINKED_LIST_KEYS = ["flags", "problems", "improvements"] as const;

function listKeyForCategory(category: Ticket["category"]): LinkedListKey | null {
  if (category === "probleme") return "problems";
  if (category === "flag") return "flags";
  if (category === "amelioration") return "improvements";
  return null;
}

function categoryForListKey(key: LinkedListKey): "probleme" | "flag" | "amelioration" {
  if (key === "flags") return "flag";
  if (key === "improvements") return "amelioration";
  return "probleme";
}

function isLinkedTicket(ticket: Ticket) {
  return (
    ticket.category === "probleme" ||
    ticket.category === "flag" ||
    ticket.category === "amelioration"
  );
}

export function overlayLinkedLists(current: Machine, machine: Machine): Machine {
  return {
    ...current,
    flags: machine.flags ?? current.flags,
    problems: machine.problems ?? current.problems,
    improvements: machine.improvements ?? current.improvements,
  };
}

/**
 * Fusionne les tickets problème / flag / improvement dans les listes de la machine
 * pour qu'elles restent liées (ticketId + texte + statut).
 */
export function applyTicketsToMachine(
  machine: Machine,
  tickets: Ticket[],
  options: { pruneMissing?: boolean } = {},
): Machine {
  const pruneMissing = options.pruneMissing ?? true;
  const next: Machine = {
    ...machine,
    flags: (machine.flags ?? []).map((item) => ({ ...item })),
    problems: (machine.problems ?? []).map((item) => ({ ...item })),
    improvements: (machine.improvements ?? []).map((item) => ({ ...item })),
  };

  const related = tickets.filter(
    (t) => sameId(t.machineId, machine.id) && isLinkedTicket(t),
  );

  // Ne pas retirer les lignes liées tant que la liste des tickets n'est pas chargée :
  // tickets=[] au premier rendu ferait disparaître les problèmes / flags.
  if (pruneMissing) {
    for (const key of LINKED_LIST_KEYS) {
      const category = categoryForListKey(key);
      const ids = new Set(
        related.filter((ticket) => ticket.category === category).map((ticket) => Number(ticket.id)),
      );
      next[key] = next[key].filter(
        (item) => item.ticketId == null || ids.has(Number(item.ticketId)),
      );
    }
  }

  for (const ticket of related) {
    const key = listKeyForCategory(ticket.category);
    if (!key) continue;

    const list = next[key];
    let item =
      list.find((entry) => sameId(entry.ticketId, ticket.id)) ??
      (ticket.itemId != null
        ? list.find((entry) => sameId(entry.id, ticket.itemId))
        : undefined) ??
      list.find(
        (entry) =>
          entry.ticketId == null &&
          entry.text === ticket.comment &&
          (ticket.status === "open" ? entry.completed !== true : true),
      );

    if (!item) {
      list.push({
        id: ticket.itemId,
        text: ticket.comment,
        completed: ticket.status === "closed",
        ticketId: ticket.id,
        checklist: ticket.checklist ?? [],
        ...(ticket.status === "closed" ? { completedDate: todayFr() } : {}),
      });
      continue;
    }

    item.ticketId = ticket.id;
    if (ticket.itemId != null && item.id == null) item.id = ticket.itemId;
    const ticketList = ticket.checklist ?? [];
    const itemList = item.checklist ?? [];
    if (!sameChecklist(itemList, ticketList) && !(ticketList.length === 0 && itemList.length > 0)) {
      item.checklist = ticketList;
    }
    // Ne pas écraser le texte machine par un ticket périmé : les deux
    // sont synchronisés à l'écriture (PUT machine / PUT ticket).

    if (ticket.status === "closed" && !item.completed) {
      item.completed = true;
      item.completedDate = item.completedDate ?? todayFr();
    }

    if (ticket.status === "open" && item.completed) {
      item.completed = false;
      delete item.completedDate;
    }
  }

  return next;
}

export function applyTicketsToMachines(
  machines: Machine[],
  tickets: Ticket[],
  options?: { pruneMissing?: boolean },
): Machine[] {
  return machines.map((machine) => applyTicketsToMachine(machine, tickets, options));
}

export function findLinkedTicket(
  tickets: Ticket[],
  category: "probleme" | "flag" | "amelioration",
  item: TodoItem,
): Ticket | undefined {
  if (item.ticketId != null) {
    return tickets.find((t) => sameId(t.id, item.ticketId));
  }

  return tickets.find(
    (t) =>
      t.category === category &&
      t.comment === item.text &&
      t.status === "open",
  );
}

/**
 * Attache les ticketId manquants sans modifier le texte saisi.
 * Sert quand les items machine n'ont pas encore de ticketId en base.
 */
export function linkTicketIdsPreserveText(
  machine: Machine,
  tickets: Ticket[],
): Machine {
  const next: Machine = {
    ...machine,
    flags: (machine.flags ?? []).map((item) => ({ ...item })),
    problems: (machine.problems ?? []).map((item) => ({ ...item })),
    improvements: (machine.improvements ?? []).map((item) => ({ ...item })),
  };

  let changed = false;

  for (const key of LINKED_LIST_KEYS) {
    const category = categoryForListKey(key);
    const list = next[key];
    const related = tickets.filter(
      (ticket) =>
        sameId(ticket.machineId, machine.id) && ticket.category === category,
    );
    const taken = new Set(
      list
        .filter((item) => item.ticketId != null)
        .map((item) => Number(item.ticketId)),
    );

    for (const item of list) {
      if (item.ticketId != null) continue;
      const match =
        related.find(
          (ticket) =>
            !taken.has(Number(ticket.id)) &&
            item.id != null &&
            sameId(ticket.itemId, item.id),
        ) ??
        related.find(
          (ticket) =>
            !taken.has(Number(ticket.id)) && ticket.comment === item.text,
        );
      if (!match) continue;
      item.ticketId = match.id;
      if (match.itemId != null && item.id == null) item.id = match.itemId;
      taken.add(Number(match.id));
      changed = true;
    }
  }

  return changed ? next : machine;
}

/** Ajoute les tickets apparus pendant l'édition, sans écraser le brouillon. */
export function mergeNewTicketItems(machine: Machine, tickets: Ticket[]): Machine {
  let changed = false;
  const next: Machine = {
    ...machine,
    flags: [...(machine.flags ?? [])],
    problems: [...(machine.problems ?? [])],
    improvements: [...(machine.improvements ?? [])],
  };

  for (const ticket of tickets) {
    if (!sameId(ticket.machineId, machine.id)) continue;
    const key = listKeyForCategory(ticket.category);
    if (!key) continue;
    if (next[key].some((item) => sameId(item.ticketId, ticket.id))) continue;
    const byItemId =
      ticket.itemId != null
        ? next[key].find(
            (item) => item.ticketId == null && sameId(item.id, ticket.itemId),
          )
        : undefined;
    const byText = next[key].find(
      (item) => item.ticketId == null && item.text === ticket.comment,
    );
    const existing = byItemId ?? byText;
    if (existing) {
      existing.ticketId = ticket.id;
      if (ticket.itemId != null && existing.id == null) existing.id = ticket.itemId;
      changed = true;
      continue;
    }
    changed = true;
    next[key] = [
      ...next[key],
      {
        id: ticket.itemId,
        text: ticket.comment,
        completed: ticket.status === "closed",
        ticketId: ticket.id,
        checklist: ticket.checklist ?? [],
        ...(ticket.status === "closed" ? { completedDate: todayFr() } : {}),
      },
    ];
  }

  return changed ? next : machine;
}

/** Aligne les checklists des flags / problèmes / improvements sur les tickets liés. */
export function syncChecklistsFromTickets(machine: Machine, tickets: Ticket[]): Machine {
  let changed = false;
  const next: Machine = {
    ...machine,
    flags: (machine.flags ?? []).map((item) => ({ ...item })),
    problems: (machine.problems ?? []).map((item) => ({ ...item })),
    improvements: (machine.improvements ?? []).map((item) => ({ ...item })),
  };

  for (const key of LINKED_LIST_KEYS) {
    next[key] = next[key].map((item) => {
      if (item.ticketId == null) return item;
      const ticket = tickets.find((entry) => sameId(entry.id, item.ticketId));
      if (!ticket) return item;
      const ticketList = ticket.checklist ?? [];
      const itemList = item.checklist ?? [];
      if (sameChecklist(itemList, ticketList)) return item;
      if (ticketList.length === 0 && itemList.length > 0) return item;
      changed = true;
      return { ...item, checklist: ticketList };
    });
  }

  return changed ? next : machine;
}
