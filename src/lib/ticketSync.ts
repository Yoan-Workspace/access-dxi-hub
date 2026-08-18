import type { Machine, Ticket, TodoItem } from "@/lib/types";

function todayFr() {
  return new Date().toLocaleDateString("fr-FR");
}

function sameId(a: number | string | undefined, b: number | string | undefined) {
  return Number(a) === Number(b);
}

function listKeyForCategory(
  category: Ticket["category"],
): "problems" | "flags" | null {
  if (category === "probleme") return "problems";
  if (category === "flag") return "flags";
  return null;
}

/**
 * Fusionne les tickets problème/flag dans les listes de la machine
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
  };

  const related = tickets.filter(
    (t) =>
      sameId(t.machineId, machine.id) &&
      (t.category === "probleme" || t.category === "flag"),
  );

  const existingTicketIds = new Set(related.map((t) => Number(t.id)));

  // Ne pas retirer les lignes liées tant que la liste des tickets n'est pas chargée :
  // tickets=[] au premier rendu ferait disparaître les problèmes / flags.
  if (pruneMissing) {
    next.flags = next.flags.filter(
      (item) => item.ticketId == null || existingTicketIds.has(Number(item.ticketId)),
    );
    next.problems = next.problems.filter(
      (item) => item.ticketId == null || existingTicketIds.has(Number(item.ticketId)),
    );
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
        ...(ticket.status === "closed" ? { completedDate: todayFr() } : {}),
      });
      continue;
    }

    item.ticketId = ticket.id;
    if (ticket.itemId != null && item.id == null) item.id = ticket.itemId;
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
  category: "probleme" | "flag",
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
  };

  let changed = false;

  for (const key of ["flags", "problems"] as const) {
    const category = key === "flags" ? "flag" : "probleme";
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
        ...(ticket.status === "closed" ? { completedDate: todayFr() } : {}),
      },
    ];
  }

  return changed ? next : machine;
}
