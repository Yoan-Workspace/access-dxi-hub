import fs from "fs";
import path from "path";

export const ITEM_LIST_KEYS = ["flags", "problems", "improvements", "repairs"];

export function storePaths(dataPath) {
  const livePath = path.resolve(dataPath);
  const dir = path.dirname(livePath);
  return {
    dir,
    livePath,
    usersPath: path.join(dir, "users.json"),
    archivesDir: path.join(dir, "archives"),
    retiredDir: path.join(dir, "retired"),
    retiredIndexPath: path.join(dir, "retired", "index.json"),
  };
}

function readJsonFile(filePath, fallback) {
  try {
    const raw = fs.readFileSync(filePath, "utf8");
    if (!String(raw).trim()) return fallback;
    return JSON.parse(raw);
  } catch (err) {
    if (err?.code === "ENOENT") return fallback;
    throw err;
  }
}

export function emptyArchive(machineId) {
  return {
    machineId: Number(machineId),
    flags: [],
    problems: [],
    improvements: [],
    repairs: [],
    tickets: [],
  };
}

export function archivePath(archivesDir, machineId) {
  return path.join(archivesDir, `${Number(machineId)}.json`);
}

export function retiredPath(retiredDir, machineId) {
  return path.join(retiredDir, `${Number(machineId)}.json`);
}

export function normalizeArchive(doc, machineId) {
  const base = emptyArchive(machineId);
  if (!doc || typeof doc !== "object") return base;
  for (const key of ITEM_LIST_KEYS) {
    base[key] = Array.isArray(doc[key]) ? doc[key] : [];
  }
  base.tickets = Array.isArray(doc.tickets) ? doc.tickets : [];
  base.machineId = Number(machineId);
  return base;
}

export function readArchive(paths, machineId) {
  return normalizeArchive(
    readJsonFile(archivePath(paths.archivesDir, machineId), null),
    machineId,
  );
}

export function writeArchive(paths, machineId, doc, atomicWriteJson) {
  fs.mkdirSync(paths.archivesDir, { recursive: true });
  const normalized = normalizeArchive(doc, machineId);
  const empty = ITEM_LIST_KEYS.every((key) => normalized[key].length === 0) &&
    normalized.tickets.length === 0;
  const file = archivePath(paths.archivesDir, machineId);
  if (empty) {
    try {
      fs.unlinkSync(file);
    } catch {
      /* ignore */
    }
    return normalized;
  }
  atomicWriteJson(file, normalized);
  return normalized;
}

export function archiveItemCount(doc) {
  return ITEM_LIST_KEYS.reduce((sum, key) => sum + (doc?.[key]?.length ?? 0), 0);
}

export function countArchivedItems(paths, machineId) {
  return archiveItemCount(readArchive(paths, machineId));
}

export function readUsersDoc(paths) {
  const doc = readJsonFile(paths.usersPath, { users: [] });
  return Array.isArray(doc.users) ? doc.users : [];
}

export function writeUsersDoc(paths, users, atomicWriteJson) {
  fs.mkdirSync(path.dirname(paths.usersPath), { recursive: true });
  atomicWriteJson(paths.usersPath, { users });
}

export function readRetiredIndex(paths) {
  const doc = readJsonFile(paths.retiredIndexPath, { machines: [] });
  return Array.isArray(doc.machines) ? doc.machines : [];
}

export function writeRetiredIndex(paths, machines, atomicWriteJson) {
  fs.mkdirSync(paths.retiredDir, { recursive: true });
  atomicWriteJson(paths.retiredIndexPath, { machines });
}

export function readRetired(paths, machineId) {
  return readJsonFile(retiredPath(paths.retiredDir, machineId), null);
}

export function writeRetired(paths, snapshot, atomicWriteJson) {
  fs.mkdirSync(paths.retiredDir, { recursive: true });
  atomicWriteJson(retiredPath(paths.retiredDir, snapshot.id), snapshot);
  const index = readRetiredIndex(paths).filter((entry) => Number(entry.id) !== Number(snapshot.id));
  index.unshift({
    id: snapshot.id,
    name: snapshot.name,
    localisation: snapshot.localisation ?? "",
    serialNumber: snapshot.serialNumber,
    retiredAt: snapshot.retiredAt,
    retiredBy: snapshot.retiredBy ?? "",
    ticketCount: Array.isArray(snapshot.tickets) ? snapshot.tickets.length : 0,
    archiveCount: archiveItemCount(snapshot.archives),
  });
  writeRetiredIndex(paths, index, atomicWriteJson);
}

export function maxTicketIdInStore(paths, liveTickets) {
  let max = 0;
  for (const ticket of liveTickets || []) {
    const id = Number(ticket?.id) || 0;
    if (id > max) max = id;
  }
  try {
    for (const name of fs.readdirSync(paths.archivesDir)) {
      if (!name.endsWith(".json")) continue;
      const doc = readJsonFile(path.join(paths.archivesDir, name), null);
      for (const ticket of doc?.tickets || []) {
        const id = Number(ticket?.id) || 0;
        if (id > max) max = id;
      }
    }
  } catch {
    /* no archives yet */
  }
  try {
    for (const name of fs.readdirSync(paths.retiredDir)) {
      if (!name.endsWith(".json") || name === "index.json") continue;
      const doc = readJsonFile(path.join(paths.retiredDir, name), null);
      for (const ticket of doc?.tickets || []) {
        const id = Number(ticket?.id) || 0;
        if (id > max) max = id;
      }
    }
  } catch {
    /* no retired yet */
  }
  return max;
}

export function nextLiveMachineId(paths, liveMachines) {
  let max = 0;
  for (const machine of liveMachines || []) {
    const id = Number(machine?.id) || 0;
    if (id > max) max = id;
  }
  for (const entry of readRetiredIndex(paths)) {
    const id = Number(entry?.id) || 0;
    if (id > max) max = id;
  }
  return max + 1;
}

function ticketIdsFromItems(items) {
  const ids = new Set();
  for (const item of items || []) {
    if (item?.ticketId != null) ids.add(Number(item.ticketId));
  }
  return ids;
}

export function appendItems(target, incoming) {
  const seen = new Set(
    (target || []).map((item) => `${item?.id ?? ""}:${item?.ticketId ?? ""}:${item?.text ?? ""}`),
  );
  const next = [...(target || [])];
  for (const item of incoming || []) {
    const key = `${item?.id ?? ""}:${item?.ticketId ?? ""}:${item?.text ?? ""}`;
    if (seen.has(key)) continue;
    seen.add(key);
    next.push(item);
  }
  return next;
}

export function extractArchivedFromMachine(machine, liveTickets) {
  const moved = emptyArchive(machine.id);
  let changed = false;
  const movedTicketIds = new Set();

  for (const key of ITEM_LIST_KEYS) {
    const list = Array.isArray(machine[key]) ? machine[key] : [];
    const live = [];
    const archived = [];
    for (const item of list) {
      if (item?.archived) {
        archived.push(item);
        if (item.ticketId != null) movedTicketIds.add(Number(item.ticketId));
      } else {
        live.push(item);
      }
    }
    if (archived.length) {
      machine[key] = live;
      moved[key] = archived;
      changed = true;
    }
  }

  if (!changed) return null;

  moved.tickets = (liveTickets || []).filter((ticket) => {
    if (Number(ticket.machineId) !== Number(machine.id)) return false;
    return movedTicketIds.has(Number(ticket.id));
  });

  return { moved, movedTicketIds };
}

export function applyArchiveToStore(paths, machine, liveTickets, atomicWriteJson) {
  const extracted = extractArchivedFromMachine(machine, liveTickets);
  if (!extracted) return { changed: false, movedTicketIds: new Set() };

  const current = readArchive(paths, machine.id);
  for (const key of ITEM_LIST_KEYS) {
    current[key] = appendItems(current[key], extracted.moved[key]);
  }
  const ticketIds = new Set(current.tickets.map((ticket) => Number(ticket.id)));
  for (const ticket of extracted.moved.tickets) {
    if (!ticketIds.has(Number(ticket.id))) {
      current.tickets.push(ticket);
      ticketIds.add(Number(ticket.id));
    }
  }
  writeArchive(paths, machine.id, current, atomicWriteJson);
  return { changed: true, movedTicketIds: extracted.movedTicketIds };
}

export function maxItemIdInArchive(paths, machineId) {
  const doc = readArchive(paths, machineId);
  let max = 0;
  for (const key of ITEM_LIST_KEYS) {
    for (const item of doc[key] || []) {
      const id = Number(item?.id) || 0;
      if (id > max) max = id;
    }
  }
  return max;
}

export function moveItemToArchive(paths, machine, found, liveTickets, atomicWriteJson) {
  const now = new Date().toISOString().slice(0, 19);
  if (!found.item.completed) {
    found.item.completed = true;
    found.item.completedDate =
      found.item.completedDate || new Date().toLocaleDateString("fr-FR");
  }
  found.item.archived = true;
  found.item.archivedAt = now;
  if (!found.item.createdAt) found.item.createdAt = now;

  const list = machine[found.key] || [];
  machine[found.key] = list.filter((entry) => Number(entry.id) !== Number(found.item.id));

  const current = readArchive(paths, machine.id);
  current[found.key] = appendItems(current[found.key], [found.item]);

  const ticketId = found.item.ticketId != null ? Number(found.item.ticketId) : null;
  let remainingTickets = liveTickets;
  if (ticketId != null) {
    const ticket = (liveTickets || []).find((entry) => Number(entry.id) === ticketId);
    if (ticket && !current.tickets.some((entry) => Number(entry.id) === ticketId)) {
      current.tickets.push(ticket);
    }
    remainingTickets = (liveTickets || []).filter((entry) => Number(entry.id) !== ticketId);
  }

  writeArchive(paths, machine.id, current, atomicWriteJson);
  return { ticketId, remainingTickets, archive: current };
}

export function deleteArchivedItem(paths, machineId, itemId, listKey, atomicWriteJson) {
  const current = readArchive(paths, machineId);
  let removed = null;
  const keys = listKey && ITEM_LIST_KEYS.includes(listKey) ? [listKey] : ITEM_LIST_KEYS;
  for (const key of keys) {
    const list = current[key] || [];
    const item = list.find((entry) => Number(entry.id) === Number(itemId));
    if (!item) continue;
    current[key] = list.filter((entry) => Number(entry.id) !== Number(itemId));
    removed = { item, key };
    if (item.ticketId != null) {
      current.tickets = current.tickets.filter(
        (ticket) => Number(ticket.id) !== Number(item.ticketId),
      );
    }
    break;
  }
  if (!removed) return null;
  writeArchive(paths, machineId, current, atomicWriteJson);
  return removed;
}

export function migrateMonolithicData(paths, live, atomicWriteJson) {
  const report = { users: false, archives: 0 };
  let changed = false;

  if (Array.isArray(live.users) && live.users.length > 0) {
    const existing = readUsersDoc(paths);
    if (existing.length === 0) {
      writeUsersDoc(paths, live.users, atomicWriteJson);
      report.users = true;
    }
    delete live.users;
    changed = true;
  } else if (Object.prototype.hasOwnProperty.call(live, "users")) {
    delete live.users;
    changed = true;
  }

  const extractedTicketIds = new Set();
  for (const machine of live.machines || []) {
    const extracted = extractArchivedFromMachine(machine, live.tickets);
    if (!extracted) continue;
    const current = readArchive(paths, machine.id);
    for (const key of ITEM_LIST_KEYS) {
      current[key] = appendItems(current[key], extracted.moved[key]);
    }
    const seen = new Set(current.tickets.map((ticket) => Number(ticket.id)));
    for (const ticket of extracted.moved.tickets) {
      if (!seen.has(Number(ticket.id))) {
        current.tickets.push(ticket);
        seen.add(Number(ticket.id));
      }
      extractedTicketIds.add(Number(ticket.id));
    }
    writeArchive(paths, machine.id, current, atomicWriteJson);
    report.archives += 1;
    changed = true;
  }

  if (extractedTicketIds.size > 0) {
    live.tickets = (live.tickets || []).filter(
      (ticket) => !extractedTicketIds.has(Number(ticket.id)),
    );
    changed = true;
  }

  return { changed, report };
}
