import express from "express";
import fs from "fs";
import cors from "cors";
import path from "path";
import crypto from "crypto";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const DATA_PATH = process.env.DATA_PATH || "./data/data.json";
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

app.use(cors());
app.use(express.json({ limit: "2mb" }));

const clients = [];
const sessions = new Map();
let ignoreWatchUntil = 0;
let lastDataHash = "";
let notifyTimer = null;

function readData() {
  return JSON.parse(fs.readFileSync(DATA_PATH, "utf8"));
}

function hashBuffer(buf) {
  return crypto.createHash("sha1").update(buf).digest("hex");
}

function currentDataHash() {
  try {
    return hashBuffer(fs.readFileSync(DATA_PATH));
  } catch {
    return "";
  }
}

function writeData(data) {
  const json = JSON.stringify(data, null, 2);
  ignoreWatchUntil = Date.now() + 2500;
  fs.writeFileSync(DATA_PATH, json);
  lastDataHash = hashBuffer(json);
}

function ensureDataShape(data) {
  if (!Array.isArray(data.machines)) data.machines = [];
  if (!Array.isArray(data.tickets)) data.tickets = [];
  if (!Array.isArray(data.users)) data.users = [];
  if (!Array.isArray(data.history)) data.history = [];
  return data;
}

function hashPassword(password, salt = crypto.randomBytes(16).toString("hex")) {
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return { salt, hash };
}

function verifyPassword(password, salt, hash) {
  const candidate = crypto.scryptSync(password, salt, 64).toString("hex");
  return crypto.timingSafeEqual(Buffer.from(candidate, "hex"), Buffer.from(hash, "hex"));
}

function sanitizeUser(user) {
  return {
    id: user.id,
    username: user.username,
    role: user.role,
    displayName: user.displayName,
  };
}

function seedDefaultAdmin() {
  const data = ensureDataShape(readData());
  if (data.users.length > 0) return;

  const { salt, hash } = hashPassword("admin");
  data.users.push({
    id: 1,
    username: "admin",
    displayName: "Administrateur",
    role: "admin",
    salt,
    passwordHash: hash,
  });

  writeData(data);
  console.warn(
    "Compte admin initial créé — identifiant: admin / mot de passe: admin (à changer immédiatement)",
  );
}

function getToken(req) {
  const header = req.headers.authorization;
  if (header?.startsWith("Bearer ")) return header.slice(7);
  return req.headers["x-auth-token"];
}

function authMiddleware(req, res, next) {
  const token = getToken(req);
  if (!token) {
    return res.status(401).json({ error: "Authentification requise" });
  }

  const session = sessions.get(token);
  if (!session || session.expiresAt < Date.now()) {
    sessions.delete(token);
    return res.status(401).json({ error: "Session expirée" });
  }

  req.user = session.user;
  req.token = token;
  next();
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: "Accès refusé" });
    }
    next();
  };
}

function isMpMachine(machine) {
  return !machine.name.toLowerCase().startsWith("access");
}

function todayKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function monthKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

function maybeResetMonthlyMaint() {
  const now = new Date();
  const today = todayKey(now);
  const thisMonth = monthKey(now);
  const data = readData();

  if (data.lastMonthlyMaintReset === today) {
    return { performed: false, reason: "already-reset-today" };
  }

  const lastReset = data.lastMonthlyMaintReset ?? "";
  if (lastReset.startsWith(thisMonth)) {
    return { performed: false, reason: "already-reset-this-month" };
  }

  let resetCount = 0;

  for (const machine of data.machines) {
    if (isMpMachine(machine) && machine.monthlyMaint === "done") {
      machine.monthlyMaint = "not_done";
      resetCount++;
    }
  }

  data.lastMonthlyMaintReset = today;
  writeData(data);

  if (resetCount > 0) {
    console.log(
      `Maintenance mensuelle MP réinitialisée (${resetCount} machine(s)) — ${today}`,
    );
    notifyClients();
  }

  return { performed: true, resetCount, date: today };
}

function scheduleMonthlyMaintCheck() {
  setInterval(() => {
    maybeResetMonthlyMaint();
  }, 60 * 60 * 1000);
}

function notifyClients() {
  if (notifyTimer) return;
  notifyTimer = setTimeout(() => {
    notifyTimer = null;
    const payload = `data: ${JSON.stringify({ type: "data-updated" })}\n\n`;
    clients.forEach((client) => client.write(payload));
  }, 400);
}

function nextId(items) {
  return items.reduce((max, item) => Math.max(max, item.id), 0) + 1;
}

function findMachine(data, machineId) {
  return data.machines.find((m) => m.id === Number(machineId));
}

function machineListForCategory(machine, category) {
  if (category === "flag") {
    if (!Array.isArray(machine.flags)) machine.flags = [];
    return machine.flags;
  }
  if (category === "probleme") {
    if (!Array.isArray(machine.problems)) machine.problems = [];
    return machine.problems;
  }
  return null;
}

function addTicketToMachineCategory(machine, category, text, ticketId) {
  const list = machineListForCategory(machine, category);
  if (!list) return false;

  if (ticketId != null) {
    const byId = list.find((item) => Number(item.ticketId) === Number(ticketId));
    if (byId) {
      let changed = false;
      if (byId.text !== text) {
        byId.text = text;
        changed = true;
      }
      if (byId.completed) {
        byId.completed = false;
        delete byId.completedDate;
        changed = true;
      }
      return changed;
    }
  }

  const byText = list.find(
    (item) => item.text === text && item.completed !== true,
  );
  if (byText) {
    if (ticketId != null && Number(byText.ticketId) !== Number(ticketId)) {
      byText.ticketId = ticketId;
      return true;
    }
    return false;
  }

  list.push({
    text,
    completed: false,
    ...(ticketId != null ? { ticketId } : {}),
  });
  return true;
}

function completeTicketOnMachine(machine, category, text, ticketId) {
  const list = machineListForCategory(machine, category);
  if (!list) return false;

  const item =
    (ticketId != null &&
      list.find((entry) => Number(entry.ticketId) === Number(ticketId))) ||
    list.find((entry) => entry.text === text && entry.completed !== true);

  if (!item) return false;

  let changed = false;
  if (!item.completed) {
    item.completed = true;
    item.completedDate = new Date().toLocaleDateString("fr-FR");
    changed = true;
  }
  if (ticketId != null && Number(item.ticketId) !== Number(ticketId)) {
    item.ticketId = ticketId;
    changed = true;
  }
  return changed;
}

function removeTicketFromMachine(machine, ticketId) {
  if (ticketId == null) return false;
  let changed = false;

  for (const key of ["flags", "problems"]) {
    const list = machine[key];
    if (!Array.isArray(list)) continue;
    const next = list.filter(
      (item) => Number(item.ticketId) !== Number(ticketId),
    );
    if (next.length !== list.length) {
      machine[key] = next;
      changed = true;
    }
  }

  return changed;
}

function closeTicketById(data, ticketId, closedBy) {
  const ticket = data.tickets.find((t) => t.id === Number(ticketId));
  if (!ticket || ticket.status !== "open") return false;

  const now = new Date().toISOString().slice(0, 19);
  ticket.status = "closed";
  ticket.closedAt = now;
  ticket.closedBy = closedBy;
  ticket.updatedAt = now;
  return true;
}

function closeMatchingOpenTickets(data, machineId, category, text, closedBy) {
  const now = new Date().toISOString().slice(0, 19);
  let changed = false;

  for (const ticket of data.tickets) {
    if (
      ticket.machineId === Number(machineId) &&
      ticket.status === "open" &&
      ticket.category === category &&
      ticket.comment === text
    ) {
      ticket.status = "closed";
      ticket.closedAt = now;
      ticket.closedBy = closedBy;
      ticket.updatedAt = now;
      changed = true;
    }
  }

  return changed;
}

function closeTicketsForCompletedItems(data, machine, closedBy) {
  let changed = false;

  for (const item of machine.problems ?? []) {
    if (!item?.completed) continue;
    if (item.ticketId != null) {
      if (closeTicketById(data, item.ticketId, closedBy)) changed = true;
    } else if (item.text) {
      if (
        closeMatchingOpenTickets(
          data,
          machine.id,
          "probleme",
          item.text,
          closedBy,
        )
      ) {
        changed = true;
      }
    }
  }

  for (const item of machine.flags ?? []) {
    if (!item?.completed) continue;
    if (item.ticketId != null) {
      if (closeTicketById(data, item.ticketId, closedBy)) changed = true;
    } else if (item.text) {
      if (
        closeMatchingOpenTickets(data, machine.id, "flag", item.text, closedBy)
      ) {
        changed = true;
      }
    }
  }

  return changed;
}

/** Réinjecte les tickets ouverts manquants dans flags / problems des machines. */
function syncOpenTicketsIntoMachines(data) {
  let changed = false;

  for (const ticket of data.tickets) {
    if (ticket.category !== "flag" && ticket.category !== "probleme") continue;

    const machine = findMachine(data, ticket.machineId);
    if (!machine) continue;

    if (ticket.status === "open") {
      if (
        addTicketToMachineCategory(
          machine,
          ticket.category,
          ticket.comment,
          ticket.id,
        )
      ) {
        changed = true;
      }
    } else if (
      completeTicketOnMachine(
        machine,
        ticket.category,
        ticket.comment,
        ticket.id,
      )
    ) {
      changed = true;
    }
  }

  return changed;
}

function detectChanges(oldData, newData) {
  const events = [];

  if (!oldData) return events;

  //
  // Tickets créés
  //
  const oldTicketIds = new Set(
    (oldData.tickets || []).map((t) => t.id),
  );

  for (const ticket of newData.tickets || []) {
    if (!oldTicketIds.has(ticket.id)) {
      events.push({
        type: "ticket-created",
        ticketId: ticket.id,
        machineId: ticket.machineId,
        category: ticket.category,
        comment: ticket.comment,
        createdBy: ticket.createdByName,
      });
    }
  }

  //
  // Tickets clôturés
  //
  const oldTickets = new Map(
    (oldData.tickets || []).map((t) => [t.id, t]),
  );

  for (const ticket of newData.tickets || []) {
    const oldTicket = oldTickets.get(ticket.id);

    if (
      oldTicket &&
      oldTicket.status === "open" &&
      ticket.status === "closed"
    ) {
      events.push({
        type: "ticket-closed",
        ticketId: ticket.id,
        machineId: ticket.machineId,
        closedBy: ticket.closedBy,
      });
    }
  }

  //
  // Changements machines
  //
  const oldMachines = new Map(
    (oldData.machines || []).map((m) => [m.id, m]),
  );

  for (const machine of newData.machines || []) {
    const oldMachine = oldMachines.get(machine.id);

    if (!oldMachine) continue;

    //
    // Status machine
    //
    if (oldMachine.status !== machine.status) {
      events.push({
        type: "machine-status-changed",
        machine: machine.name,
        oldStatus: oldMachine.status,
        newStatus: machine.status,
      });
    }

    //
    // ASD
    //
    if (oldMachine.asdStatus !== machine.asdStatus) {
      events.push({
        type: "asd-changed",
        machine: machine.name,
        oldStatus: oldMachine.asdStatus,
        newStatus: machine.asdStatus,
      });
    }

    //
    // Nouveaux flags
    //
    const oldFlags = new Set(
      (oldMachine.flags || []).map((f) => f.text),
    );

    for (const flag of machine.flags || []) {
      if (!oldFlags.has(flag.text)) {
        events.push({
          type: "flag-added",
          machine: machine.name,
          text: flag.text,
        });
      }
    }

    //
    // Nouveaux problèmes
    //
    const oldProblems = new Set(
      (oldMachine.problems || []).map((p) => p.text),
    );

    for (const problem of machine.problems || []) {
      if (!oldProblems.has(problem.text)) {
        events.push({
          type: "problem-added",
          machine: machine.name,
          text: problem.text,
        });
      }
    }
  }

  return events;
}

function setupDataWatch() {
  if (!fs.existsSync(DATA_PATH)) {
    console.warn(`${DATA_PATH} introuvable`);
    return;
  }

  lastDataHash = currentDataHash();

  // Polling sur le contenu réel uniquement.
  // fs.watch sur le dossier data/ envoie trop d'événements (Box/OneDrive, indexation…)
  // et relançait le toast « Base de données mise à jour » en boucle.
  setInterval(() => {
    if (Date.now() < ignoreWatchUntil) return;
    const hash = currentDataHash();
    if (!hash || hash === lastDataHash) return;
    lastDataHash = hash;
    console.log("data.json modifié (changement de contenu)");
    notifyClients();
  }, 4000);
}

//
// Auth
//

app.post("/api/auth/login", (req, res) => {
  const { username, password } = req.body ?? {};

  if (!username?.trim() || !password) {
    return res.status(400).json({ error: "Identifiant et mot de passe requis" });
  }

  const data = ensureDataShape(readData());
  const user = data.users.find(
    (u) => u.username.toLowerCase() === username.trim().toLowerCase(),
  );

  if (!user || !verifyPassword(password, user.salt, user.passwordHash)) {
    return res.status(401).json({ error: "Identifiants invalides" });
  }

  const token = crypto.randomBytes(32).toString("hex");
  const safeUser = sanitizeUser(user);

  sessions.set(token, {
    user: safeUser,
    expiresAt: Date.now() + SESSION_TTL_MS,
  });

  res.json({ token, user: safeUser });
});

app.post("/api/auth/logout", authMiddleware, (req, res) => {
  sessions.delete(req.token);
  res.json({ ok: true });
});

app.get("/api/auth/me", authMiddleware, (req, res) => {
  res.json({ user: req.user });
});

app.post("/api/auth/change-password", authMiddleware, (req, res) => {
  const { currentPassword, newPassword } = req.body ?? {};

  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: "Mot de passe actuel et nouveau requis" });
  }

  if (newPassword.length < 4) {
    return res.status(400).json({ error: "Mot de passe trop court" });
  }

  const data = ensureDataShape(readData());
  const user = data.users.find((u) => u.id === req.user.id);

  if (!user || !verifyPassword(currentPassword, user.salt, user.passwordHash)) {
    return res.status(401).json({ error: "Mot de passe actuel incorrect" });
  }

  const { salt, hash } = hashPassword(newPassword);
  user.salt = salt;
  user.passwordHash = hash;
  writeData(data);

  res.json({ ok: true });
});

//
// Users (admin)
//

app.get("/api/users", authMiddleware, requireRole("admin"), (req, res) => {
  const data = ensureDataShape(readData());
  res.json({ users: data.users.map(sanitizeUser) });
});

app.post("/api/users", authMiddleware, requireRole("admin"), (req, res) => {
  const { username, password, role, displayName } = req.body ?? {};
  const allowedRoles = ["admin", "technicien", "operateur"];

  if (!username?.trim() || !password || !allowedRoles.includes(role)) {
    return res.status(400).json({ error: "Données utilisateur invalides" });
  }

  const data = ensureDataShape(readData());

  if (
    data.users.some(
      (u) => u.username.toLowerCase() === username.trim().toLowerCase(),
    )
  ) {
    return res.status(409).json({ error: "Cet identifiant existe déjà" });
  }

  const { salt, hash } = hashPassword(password);
  const user = {
    id: nextId(data.users),
    username: username.trim(),
    displayName: displayName?.trim() || username.trim(),
    role,
    salt,
    passwordHash: hash,
  };

  data.users.push(user);
  writeData(data);

  res.status(201).json(sanitizeUser(user));
});

app.delete("/api/users/:id", authMiddleware, requireRole("admin"), (req, res) => {
  const id = Number(req.params.id);
  const data = ensureDataShape(readData());
  const index = data.users.findIndex((u) => u.id === id);

  if (index === -1) {
    return res.status(404).json({ error: "Utilisateur introuvable" });
  }

  if (data.users[index].id === req.user.id) {
    return res.status(400).json({ error: "Vous ne pouvez pas supprimer votre propre compte" });
  }

  data.users.splice(index, 1);
  writeData(data);

  res.json({ ok: true });
});

app.post(
  "/api/users/:id/reset-password",
  authMiddleware,
  requireRole("admin"),
  (req, res) => {
    const id = Number(req.params.id);
    const { password } = req.body ?? {};

    if (!password || password.length < 4) {
      return res.status(400).json({ error: "Mot de passe trop court" });
    }

    const data = ensureDataShape(readData());
    const user = data.users.find((u) => u.id === id);

    if (!user) {
      return res.status(404).json({ error: "Utilisateur introuvable" });
    }

    const { salt, hash } = hashPassword(password);
    user.salt = salt;
    user.passwordHash = hash;
    writeData(data);

    res.json({ ok: true });
  },
);

//
// Tickets
//

app.get("/api/tickets", authMiddleware, (req, res) => {
  const data = ensureDataShape(readData());
  const machineId = req.query.machineId ? Number(req.query.machineId) : null;

  let tickets = data.tickets;
  if (machineId) {
    tickets = tickets.filter((t) => t.machineId === machineId);
  }

  res.json({ tickets });
});

app.post("/api/tickets", authMiddleware, (req, res) => {
  const { machineId, category, comment } = req.body ?? {};
  const allowedCategories = ["probleme", "flag"];

  if (!machineId || !allowedCategories.includes(category) || !comment?.trim()) {
    return res.status(400).json({
      error: "Ticket invalide (catégorie : problème ou flag)",
    });
  }

  const data = ensureDataShape(readData());
  const machineIndex = data.machines.findIndex(
    (m) => Number(m.id) === Number(machineId),
  );
  if (machineIndex === -1) {
    return res.status(404).json({ error: "Machine introuvable" });
  }

  const machine = data.machines[machineIndex];
  const now = new Date().toISOString().slice(0, 19);
  const text = comment.trim();
  const ticket = {
    id: nextId(data.tickets),
    machineId: Number(machineId),
    category,
    comment: text,
    status: "open",
    createdBy: req.user.id,
    createdByName: req.user.displayName,
    createdAt: now,
    updatedAt: now,
  };

  addTicketToMachineCategory(machine, category, text, ticket.id);
  data.machines[machineIndex] = machine;
  data.tickets.push(ticket);
  writeData(data);
  notifyClients();

  res.status(201).json({ ticket, machine });
});

app.put("/api/tickets/:id", authMiddleware, requireRole("admin", "technicien"), (req, res) => {
  const id = Number(req.params.id);
  const data = ensureDataShape(readData());
  const index = data.tickets.findIndex((t) => t.id === id);

  if (index === -1) {
    return res.status(404).json({ error: "Ticket introuvable" });
  }

  const current = data.tickets[index];
  const { category, comment, status } = req.body ?? {};
  const allowedStatus = ["open", "closed"];

  if (category && !["probleme", "flag"].includes(category)) {
    return res.status(400).json({
      error: "Catégorie invalide (problème ou flag uniquement)",
    });
  }

  if (status && !allowedStatus.includes(status)) {
    return res.status(400).json({ error: "Statut invalide" });
  }

  const updated = {
    ...current,
    category: category ?? current.category,
    comment: comment?.trim() ? comment.trim() : current.comment,
    status: status ?? current.status,
    updatedAt: new Date().toISOString().slice(0, 19),
  };

  if (status === "closed" && current.status !== "closed") {
    updated.closedAt = updated.updatedAt;
    updated.closedBy = req.user.displayName;
  }

  if (status === "open") {
    updated.closedAt = undefined;
    updated.closedBy = undefined;
  }

  data.tickets[index] = updated;

  const machine = findMachine(data, updated.machineId);
  if (machine) {
    // Retirer l'ancien lien si la catégorie change
    if (current.category !== updated.category) {
      for (const key of ["flags", "problems"]) {
        const list = machine[key];
        if (!Array.isArray(list)) continue;
        const linked = list.find((item) => item.ticketId === updated.id);
        if (linked) delete linked.ticketId;
      }
    }

    if (updated.status === "open") {
      addTicketToMachineCategory(
        machine,
        updated.category,
        updated.comment,
        updated.id,
      );
    } else {
      completeTicketOnMachine(
        machine,
        updated.category,
        updated.comment,
        updated.id,
      );
    }
  }

  writeData(data);
  notifyClients();

  res.json({ ticket: updated, machine: machine ?? null });
});

app.delete(
  "/api/tickets/:id",
  authMiddleware,
  requireRole("admin", "technicien"),
  (req, res) => {
    const id = Number(req.params.id);
    const data = ensureDataShape(readData());
    const index = data.tickets.findIndex((t) => t.id === id);

    if (index === -1) {
      return res.status(404).json({ error: "Ticket introuvable" });
    }

    const [removed] = data.tickets.splice(index, 1);
    const machine = findMachine(data, removed.machineId);
    if (machine) {
      removeTicketFromMachine(machine, removed.id);
      // Fallback si l'item n'avait pas encore de ticketId
      if (removed.category === "flag" || removed.category === "probleme") {
        const key = removed.category === "flag" ? "flags" : "problems";
        if (Array.isArray(machine[key])) {
          machine[key] = machine[key].filter(
            (item) =>
              Number(item.ticketId) !== Number(removed.id) &&
              !(item.ticketId == null && item.text === removed.comment),
          );
        }
      }
    }

    writeData(data);
    notifyClients();

    res.json({ ok: true, machine: machine ?? null });
  },
);

//
// Machines
//

app.get("/api/events", (req, res) => {
  const token = getToken(req) || req.query.token;
  if (!token) {
    return res.status(401).end();
  }

  const session = sessions.get(token);
  if (!session || session.expiresAt < Date.now()) {
    sessions.delete(token);
    return res.status(401).end();
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  clients.push(res);

  req.on("close", () => {
    const index = clients.indexOf(res);
    if (index !== -1) clients.splice(index, 1);
  });
});

app.get("/api/machines", authMiddleware, (req, res) => {
  const data = ensureDataShape(readData());
  res.json({ machines: data.machines });
});

app.put(
  "/api/machines/:id",
  authMiddleware,
  requireRole("admin", "technicien"),
  (req, res) => {
    const data = ensureDataShape(readData());
    const id = Number(req.params.id);
    const index = data.machines.findIndex((m) => m.id === id);

    if (index === -1) {
      return res.status(404).json({ error: "Machine introuvable" });
    }

    const machine = { ...req.body, id };
    data.machines[index] = machine;
    closeTicketsForCompletedItems(data, machine, req.user.displayName);
    writeData(data);
    notifyClients();

    res.json(machine);
  },
);

app.post(
  "/api/machines",
  authMiddleware,
  requireRole("admin", "technicien"),
  (req, res) => {
    const data = ensureDataShape(readData());
    const newMachine = {
      ...req.body,
      id: nextId(data.machines),
    };

    if (!newMachine.name?.trim()) {
      return res.status(400).json({ error: "Le nom de la machine est requis" });
    }

    if (
      data.machines.some(
        (machine) =>
          machine.name.toLowerCase() === newMachine.name.trim().toLowerCase(),
      )
    ) {
      return res.status(409).json({ error: "Une machine avec ce nom existe déjà" });
    }

    data.machines.push(newMachine);
    writeData(data);
    notifyClients();

    res.status(201).json(newMachine);
  },
);

app.delete(
  "/api/machines/:id",
  authMiddleware,
  requireRole("admin", "technicien"),
  (req, res) => {
    const data = ensureDataShape(readData());
    const id = Number(req.params.id);
    const index = data.machines.findIndex((m) => m.id === id);

    if (index === -1) {
      return res.status(404).json({ error: "Machine introuvable" });
    }

    data.machines.splice(index, 1);
    data.tickets = data.tickets.filter((t) => t.machineId !== id);
    writeData(data);
    notifyClients();

    res.json({ ok: true });
  },
);

//
// Front React compilé
//

app.use(express.static(path.join(__dirname, "dist")));

app.get("/{*splat}", (req, res) => {
  res.sendFile(path.join(__dirname, "dist", "index.html"));
});

if (!fs.existsSync(path.dirname(DATA_PATH))) {
  fs.mkdirSync(path.dirname(DATA_PATH), { recursive: true });
}

if (!fs.existsSync(DATA_PATH)) {
  writeData({
    machines: [],
    tickets: [],
    users: [],
    history: [],
  });
}

seedDefaultAdmin();
setupDataWatch();

app.listen(PORT, () => {
  console.log(`Serveur lancé sur http://localhost:${PORT}`);

  const reset = maybeResetMonthlyMaint();
  if (reset.performed) {
    console.log(
      `Vérification maintenance mensuelle au démarrage: ${reset.resetCount} MP réinitialisée(s)`,
    );
  }

  scheduleMonthlyMaintCheck();
});
