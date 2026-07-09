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

function readData() {
  return JSON.parse(fs.readFileSync(DATA_PATH, "utf8"));
}

function writeData(data) {
  fs.writeFileSync(DATA_PATH, JSON.stringify(data, null, 2));
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
  clients.forEach((client) => {
    client.write(
      `data: ${JSON.stringify({
        type: "data-updated",
      })}\n\n`,
    );
  });
}

function nextId(items) {
  return items.reduce((max, item) => Math.max(max, item.id), 0) + 1;
}

function findMachine(data, machineId) {
  return data.machines.find((m) => m.id === Number(machineId));
}

function setupDataWatch() {
  const dataDir = path.dirname(DATA_PATH);
  const fileName = path.basename(DATA_PATH);

  const onChange = () => {
    console.log("data.json modifié");
    notifyClients();
  };

  const startPolling = () => {
    console.warn("Surveillance par polling (fs.watch indisponible sur ce système)");

    let lastMtime = 0;
    try {
      lastMtime = fs.statSync(DATA_PATH).mtimeMs;
    } catch {
      console.warn(`${DATA_PATH} introuvable — surveillance désactivée`);
      return;
    }

    setInterval(() => {
      try {
        const mtime = fs.statSync(DATA_PATH).mtimeMs;
        if (mtime !== lastMtime) {
          lastMtime = mtime;
          onChange();
        }
      } catch {
        /* fichier temporairement inaccessible */
      }
    }, 2000);
  };

  if (!fs.existsSync(DATA_PATH)) {
    console.warn(`${DATA_PATH} introuvable — surveillance désactivée`);
    return;
  }

  try {
    const watcher = fs.watch(dataDir, (event, name) => {
      if (!name || name === fileName) onChange();
    });

    watcher.on("error", (err) => {
      console.warn("fs.watch interrompu:", err.message);
      watcher.close();
      startPolling();
    });
  } catch (err) {
    console.warn("fs.watch indisponible:", err.message);
    startPolling();
  }
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
  const allowedCategories = ["reparation", "probleme", "flag", "non_classe"];

  if (!machineId || !allowedCategories.includes(category) || !comment?.trim()) {
    return res.status(400).json({ error: "Ticket invalide" });
  }

  const data = ensureDataShape(readData());
  if (!findMachine(data, machineId)) {
    return res.status(404).json({ error: "Machine introuvable" });
  }

  const now = new Date().toISOString().slice(0, 19);
  const ticket = {
    id: nextId(data.tickets),
    machineId: Number(machineId),
    category,
    comment: comment.trim(),
    status: "open",
    createdBy: req.user.id,
    createdByName: req.user.displayName,
    createdAt: now,
    updatedAt: now,
  };

  data.tickets.push(ticket);
  writeData(data);
  notifyClients();

  res.status(201).json(ticket);
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
  const allowedCategories = ["reparation", "probleme", "flag", "non_classe"];
  const allowedStatus = ["open", "closed"];

  if (category && !allowedCategories.includes(category)) {
    return res.status(400).json({ error: "Catégorie invalide" });
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
  writeData(data);
  notifyClients();

  res.json(updated);
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

    data.tickets.splice(index, 1);
    writeData(data);
    notifyClients();

    res.json({ ok: true });
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
  maybeResetMonthlyMaint();
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

    data.machines[index] = req.body;
    writeData(data);
    notifyClients();

    res.json(data.machines[index]);
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
