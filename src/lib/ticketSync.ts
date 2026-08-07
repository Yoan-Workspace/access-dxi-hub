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
): Machine {
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

  // Supprime les items liés à un ticket qui n'existe plus
  next.flags = next.flags.filter(
    (item) => item.ticketId == null || existingTicketIds.has(Number(item.ticketId)),
  );
  next.problems = next.problems.filter(
    (item) => item.ticketId == null || existingTicketIds.has(Number(item.ticketId)),
  );

  for (const ticket of related) {
    const key = listKeyForCategory(ticket.category);
    if (!key) continue;

    const list = next[key];
    let item =
      list.find((entry) => sameId(entry.ticketId, ticket.id)) ??
      list.find(
        (entry) =>
          entry.ticketId == null &&
          entry.text === ticket.comment &&
          (ticket.status === "open" ? entry.completed !== true : true),
      );

    if (!item) {
      list.push({
        text: ticket.comment,
        completed: ticket.status === "closed",
        ticketId: ticket.id,
        ...(ticket.status === "closed" ? { completedDate: todayFr() } : {}),
      });
      continue;
    }

    item.ticketId = ticket.id;
    item.text = ticket.comment;

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
): Machine[] {
  return machines.map((machine) => applyTicketsToMachine(machine, tickets));
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
