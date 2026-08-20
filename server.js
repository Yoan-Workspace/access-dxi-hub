import express from "express";
import fs from "fs";
import cors from "cors";
import path from "path";
import crypto from "crypto";
import zlib from "zlib";
import { promisify } from "util";
import { fileURLToPath } from "url";
import jpeg from "jpeg-js";

const inflatePng = promisify(zlib.inflate);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function parseEnvContent(content, { override = false } = {}) {
  if (content.charCodeAt(0) === 0xfeff) content = content.slice(1);
  let lastKey = null;
  const keys = [];
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) {
      if (lastKey && /^(https?:\/\/|&|sig=|sp=|sv=)/i.test(trimmed)) {
        process.env[lastKey] = `${process.env[lastKey] || ""}${trimmed}`;
      }
      continue;
    }
    const key = trimmed.slice(0, eq).trim().replace(/^export\s+/, "");
    const value = trimmed
      .slice(eq + 1)
      .trim()
      .replace(/^["']|["']$/g, "");
    if (!key) continue;
    if (override || process.env[key] === undefined) {
      process.env[key] = value;
      keys.push(key);
    }
    lastKey = key;
  }
  return keys;
}

function loadEnvFile(filename, { override = false } = {}) {
  const candidates = [
    path.join(__dirname, filename),
    path.join(process.cwd(), filename),
  ];
  for (const envPath of candidates) {
    if (!fs.existsSync(envPath)) continue;
    parseEnvContent(fs.readFileSync(envPath, "utf8"), { override });
    return envPath;
  }
  return null;
}

const loadedEnvFiles = [
  loadEnvFile(".env"),
  loadEnvFile(".env.local", { override: true }),
  loadEnvFile(".env.local.txt", { override: true }),
].filter(Boolean);

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const DATA_PATH = process.env.DATA_PATH || "./data/data.json";
const TEAMS_WEBHOOK_URL = process.env.TEAMS_WEBHOOK_URL?.trim() || "";
const APP_PUBLIC_URL = (process.env.APP_PUBLIC_URL || `http://localhost:${PORT}`).replace(
  /\/$/,
  "",
);
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

app.use(cors());
app.use(express.json({ limit: "2mb" }));

const clients = [];
const sessions = new Map();
const SESSIONS_PATH = path.join(path.dirname(path.resolve(DATA_PATH)), "sessions.json");
let lastNotifyAt = 0;
let lastOwnWriteAt = 0;
let notifyTimer = null;

function readData() {
  return JSON.parse(fs.readFileSync(DATA_PATH, "utf8"));
}

function writeData(data) {
  lastOwnWriteAt = Date.now();
  fs.writeFileSync(DATA_PATH, JSON.stringify(data, null, 2));
}

function loadPersistedSessions() {
  try {
    if (!fs.existsSync(SESSIONS_PATH)) return 0;
    const raw = JSON.parse(fs.readFileSync(SESSIONS_PATH, "utf8"));
    let count = 0;
    for (const [token, session] of Object.entries(raw)) {
      if (session?.expiresAt > Date.now() && session.user) {
        sessions.set(token, session);
        count++;
      }
    }
    return count;
  } catch {
    return 0;
  }
}

function persistSessions() {
  const obj = {};
  for (const [token, session] of sessions.entries()) {
    if (session.expiresAt > Date.now()) obj[token] = session;
  }
  fs.writeFileSync(SESSIONS_PATH, JSON.stringify(obj));
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
    lastNotifyAt = Date.now();
    const payload = `data: ${JSON.stringify({ type: "data-updated" })}\n\n`;
    for (let i = clients.length - 1; i >= 0; i--) {
      try {
        clients[i].write(payload);
      } catch {
        clients.splice(i, 1);
      }
    }
  }, 250);
}

function ticketCategoryLabel(category) {
  return category === "flag" ? "Flag" : "Problème";
}

function isOfficeIncomingWebhook(url) {
  return /webhook\.office\.com|outlook\.office\.com\/webhook/i.test(url);
}

function teamsTicketText({ ticket, machine }, event = "opened") {
  const category = ticketCategoryLabel(ticket.category);
  if (event === "closed") {
    return [
      `Ticket #${ticket.id} clôturé`,
      `Machine : ${machine.name}`,
      `Catégorie : ${category}`,
      `Clôturé par : ${ticket.closedBy ?? "—"}`,
      `Commentaire : ${ticket.comment}`,
    ].join("\n");
  }

  return [
    `Nouveau ticket #${ticket.id}`,
    `Machine : ${machine.name}`,
    `Catégorie : ${category}`,
    `Ouvert par : ${ticket.createdByName}`,
    `Commentaire : ${ticket.comment}`,
  ].join("\n");
}

function teamsTicketPayload({ ticket, machine }, event = "opened") {
  const category = ticketCategoryLabel(ticket.category);
  const title =
    event === "closed"
      ? `Ticket #${ticket.id} clôturé — ${machine.name} (${category})`
      : `Nouveau ticket #${ticket.id} — ${machine.name} (${category})`;
  const text = teamsTicketText({ ticket, machine }, event);
  const facts =
    event === "closed"
      ? [
          { name: "Machine", value: String(machine.name ?? "") },
          { name: "Catégorie", value: category },
          { name: "Clôturé par", value: String(ticket.closedBy ?? "") },
          { name: "Date", value: String(ticket.closedAt ?? ticket.updatedAt ?? "") },
        ]
      : [
          { name: "Machine", value: String(machine.name ?? "") },
          { name: "Catégorie", value: category },
          { name: "Ouvert par", value: String(ticket.createdByName ?? "") },
          { name: "Date", value: String(ticket.createdAt ?? "") },
        ];

  if (isOfficeIncomingWebhook(TEAMS_WEBHOOK_URL)) {
    return {
      text,
      "@type": "MessageCard",
      "@context": "https://schema.org/extensions",
      themeColor:
        event === "closed"
          ? "22C55E"
          : ticket.category === "flag"
            ? "EAB308"
            : "EF4444",
      summary: title,
      title,
      sections: [{ facts, text: ticket.comment }],
    };
  }

  return {
    type: "message",
    attachments: [
      {
        contentType: "application/vnd.microsoft.card.adaptive",
        contentUrl: null,
        content: {
          $schema: "http://adaptivecards.io/schemas/adaptive-card.json",
          type: "AdaptiveCard",
          version: "1.2",
          body: [
            {
              type: "TextBlock",
              text: title,
              weight: "Bolder",
              wrap: true,
            },
            {
              type: "TextBlock",
              text,
              wrap: true,
            },
          ],
        },
      },
    ],
  };
}

async function postTeamsWebhook(payload) {
  const response = await fetch(TEAMS_WEBHOOK_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`${response.status} ${body.slice(0, 200)}`);
  }
}

function notifyTeamsTicket(event, { ticket, machine }) {
  if (!TEAMS_WEBHOOK_URL) {
    console.warn("Notification Teams ignorée : TEAMS_WEBHOOK_URL est vide");
    return;
  }

  const payload = teamsTicketPayload({ ticket, machine }, event);
  const label = event === "closed" ? "clôture" : "ouverture";
  postTeamsWebhook(payload)
    .then(() => {
      console.log(`Notification Teams envoyée (${label} ticket #${ticket.id})`);
    })
    .catch(async (error) => {
      try {
        await postTeamsWebhook({
          text: teamsTicketText({ ticket, machine }, event),
        });
        console.log(
          `Notification Teams envoyée en texte (${label} ticket #${ticket.id})`,
        );
      } catch (retryError) {
        console.warn(
          "Notification Teams canal impossible:",
          retryError.message || error.message,
        );
      }
    });
}

function notifyTeamsTicketOpened({ ticket, machine }) {
  notifyTeamsTicket("opened", { ticket, machine });
}

function notifyTeamsTicketClosed({ ticket, machine }) {
  notifyTeamsTicket("closed", { ticket, machine });
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

function nextMachineItemId(machine) {
  let max = 0;
  for (const key of ["flags", "problems", "improvements", "repairs"]) {
    for (const item of machine[key] ?? []) {
      const id = Number(item?.id);
      if (Number.isFinite(id) && id > max) max = id;
    }
  }
  return max + 1;
}

function ensureItemId(machine, item) {
  if (item.id != null && Number.isFinite(Number(item.id))) {
    return Number(item.id);
  }
  item.id = nextMachineItemId(machine);
  return item.id;
}

function bindTicketAndItem(machine, ticket, item) {
  if (!ticket || !item) return;
  ensureItemId(machine, item);
  item.ticketId = ticket.id;
  ticket.itemId = Number(item.id);
}

function findLinkedItem(machine, category, ticket) {
  const list = machineListForCategory(machine, category);
  if (!list || !ticket) return null;
  return (
    list.find((item) => Number(item.ticketId) === Number(ticket.id)) ||
    (ticket.itemId != null
      ? list.find((item) => Number(item.id) === Number(ticket.itemId))
      : null) ||
    null
  );
}

function addTicketToMachineCategory(machine, category, text, ticket) {
  const list = machineListForCategory(machine, category);
  if (!list) return null;
  const ticketId = ticket?.id;
  const itemId = ticket?.itemId;

  let item =
    (ticketId != null &&
      list.find((entry) => Number(entry.ticketId) === Number(ticketId))) ||
    (itemId != null && list.find((entry) => Number(entry.id) === Number(itemId))) ||
    list.find((entry) => entry.text === text && entry.completed !== true);

  if (item) {
    item.text = text;
    if (item.completed) {
      item.completed = false;
      delete item.completedDate;
    }
    if (ticket) bindTicketAndItem(machine, ticket, item);
    else ensureItemId(machine, item);
    return item;
  }

  item = {
    id: itemId ?? nextMachineItemId(machine),
    text,
    completed: false,
  };
  list.push(item);
  if (ticket) bindTicketAndItem(machine, ticket, item);
  return item;
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
  if (!ticket || ticket.status !== "open") return null;

  const now = new Date().toISOString().slice(0, 19);
  ticket.status = "closed";
  ticket.closedAt = now;
  ticket.closedBy = closedBy;
  ticket.updatedAt = now;
  return ticket;
}

function closeMatchingOpenTickets(data, machineId, category, text, closedBy) {
  const now = new Date().toISOString().slice(0, 19);
  const closed = [];

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
      closed.push(ticket);
    }
  }

  return closed;
}

function inheritSameRowTicketId(nextList, prevList) {
  const taken = new Set(
    nextList
      .filter((item) => item.ticketId != null)
      .map((item) => Number(item.ticketId)),
  );

  for (let i = 0; i < nextList.length; i++) {
    const item = nextList[i];
    const prev = prevList[i];
    if (item.id == null && prev?.id != null) item.id = prev.id;
    if (item.ticketId != null) continue;
    if (prev?.ticketId == null) continue;
    const prevId = Number(prev.ticketId);
    if (taken.has(prevId)) continue;
    item.ticketId = prevId;
    taken.add(prevId);
  }
}

function createLinkedTicket(data, machine, user, category, text, completed, now, item) {
  const ticket = {
    id: nextId(data.tickets),
    machineId: Number(machine.id),
    category,
    comment: text,
    status: completed ? "closed" : "open",
    createdBy: user.id,
    createdByName: user.displayName,
    createdAt: now,
    updatedAt: now,
  };
  if (completed) {
    ticket.closedAt = now;
    ticket.closedBy = user.displayName;
  }
  if (item) bindTicketAndItem(machine, ticket, item);
  data.tickets.push(ticket);
  console.log(
    `Ticket #${ticket.id} créé (${category}) pour ${machine.name}${
      ticket.status === "open" ? " — notification Teams" : ""
    }`,
  );
  return ticket;
}

function findTicketForItem(data, machine, category, item) {
  if (item.ticketId != null) {
    const byTicketId = data.tickets.find(
      (entry) => Number(entry.id) === Number(item.ticketId),
    );
    if (byTicketId) return byTicketId;
  }
  if (item.id == null) return null;
  return (
    data.tickets.find(
      (entry) =>
        Number(entry.machineId) === Number(machine.id) &&
        entry.category === category &&
        Number(entry.itemId) === Number(item.id),
    ) ?? null
  );
}

function syncMachineLinkedTickets(data, previous, machine, user) {
  const now = new Date().toISOString().slice(0, 19);
  const created = [];
  const closed = [];
  const pairs = [
    ["problems", "probleme"],
    ["flags", "flag"],
  ];

  for (const [listKey, category] of pairs) {
    const nextList = Array.isArray(machine[listKey]) ? machine[listKey] : [];
    const prevList = Array.isArray(previous[listKey]) ? previous[listKey] : [];
    inheritSameRowTicketId(nextList, prevList);

    const nextIds = new Set(
      nextList
        .filter((item) => item.ticketId != null)
        .map((item) => Number(item.ticketId)),
    );

    for (const old of prevList) {
      if (old.ticketId == null) continue;
      if (nextIds.has(Number(old.ticketId))) continue;
      const index = data.tickets.findIndex(
        (ticket) => Number(ticket.id) === Number(old.ticketId),
      );
      if (index !== -1) data.tickets.splice(index, 1);
    }

    for (const item of nextList) {
      const text = String(item.text ?? "").trim();
      if (!text) continue;
      ensureItemId(machine, item);

      let ticket = findTicketForItem(data, machine, category, item);

      if (!ticket) {
        ticket = createLinkedTicket(
          data,
          machine,
          user,
          category,
          text,
          Boolean(item.completed),
          now,
          item,
        );
        if (ticket.status === "open") created.push({ ticket, machine });
        continue;
      }

      bindTicketAndItem(machine, ticket, item);

      if (ticket.comment !== text) {
        ticket.comment = text;
        ticket.updatedAt = now;
      }

      if (item.completed && ticket.status === "open") {
        const closedTicket = closeTicketById(
          data,
          ticket.id,
          user.displayName,
        );
        if (closedTicket) closed.push({ ticket: closedTicket, machine });
      } else if (!item.completed && ticket.status === "closed") {
        ticket.status = "open";
        delete ticket.closedAt;
        delete ticket.closedBy;
        ticket.updatedAt = now;
      }
    }
  }

  return { created, closed };
}

function closeTicketsForCompletedItems(data, machine, closedBy) {
  const closed = [];

  for (const item of machine.problems ?? []) {
    if (!item?.completed) continue;
    if (item.ticketId != null) {
      const ticket = closeTicketById(data, item.ticketId, closedBy);
      if (ticket) closed.push(ticket);
    } else if (item.text) {
      closed.push(
        ...closeMatchingOpenTickets(
          data,
          machine.id,
          "probleme",
          item.text,
          closedBy,
        ),
      );
    }
  }

  for (const item of machine.flags ?? []) {
    if (!item?.completed) continue;
    if (item.ticketId != null) {
      const ticket = closeTicketById(data, item.ticketId, closedBy);
      if (ticket) closed.push(ticket);
    } else if (item.text) {
      closed.push(
        ...closeMatchingOpenTickets(
          data,
          machine.id,
          "flag",
          item.text,
          closedBy,
        ),
      );
    }
  }

  return closed;
}

/** Réinjecte les tickets ouverts manquants dans flags / problems des machines. */
function syncOpenTicketsIntoMachines(data) {
  let changed = false;

  for (const ticket of data.tickets) {
    if (ticket.category !== "flag" && ticket.category !== "probleme") continue;

    const machine = findMachine(data, ticket.machineId);
    if (!machine) continue;

    if (ticket.status === "open") {
      addTicketToMachineCategory(
        machine,
        ticket.category,
        ticket.comment,
        ticket,
      );
      changed = true;
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

// ---------------------------------------------------------------------------
// Live color detection — bandeau SYSTEM (bas-gauche) : vert / rouge / bleu
// ---------------------------------------------------------------------------

const LAB_MANAGER_HOST = "http://cciaappserver01";
const LIVE_STATUS_CACHE = new Map();
const LIVE_POLL_INTERVAL_MS = 5 * 60 * 1000;

function serialNumberForMachine(machine) {
  if (machine.serialNumber) return String(machine.serialNumber);
  const match = machine.name.match(/^mp\s*(\d+)/i);
  if (!match) return null;
  return `300${match[1].padStart(3, "0")}`;
}

function dxiInstId(serialNumber) {
  return `DXI${serialNumber}`;
}

function absoluteLabUrl(href) {
  if (!href) return null;
  if (/^https?:\/\//i.test(href)) return href;
  if (href.startsWith("//")) return `http:${href}`;
  if (href.startsWith("/")) return `${LAB_MANAGER_HOST}${href}`;
  return `${LAB_MANAGER_HOST}/LabManager/${href.replace(/^\.\//, "")}`;
}

/** Résout l'URL de l'image live depuis InstrumentHome (src img / DXI*.png). */
async function resolveLiveImageUrl(serialNumber) {
  const instId = dxiInstId(serialNumber);
  const pageUrl = `${LAB_MANAGER_HOST}/LabManager/Home/InstrumentHome?instID=${instId}`;
  const candidates = [
    `${LAB_MANAGER_HOST}/LabManager/Content/Images/${instId}.png`,
    `${LAB_MANAGER_HOST}/LabManager/Content/images/${instId}.png`,
    `${LAB_MANAGER_HOST}/LabManager/Images/${instId}.png`,
  ];

  try {
    const pageRes = await fetch(pageUrl, { signal: AbortSignal.timeout(15000) });
    if (pageRes.ok) {
      const html = await pageRes.text();
      const patterns = [
        new RegExp(`src=["']([^"']*${instId}\\.(?:png|jpe?g|gif|webp)[^"']*)["']`, "i"),
        /src=["']([^"']+\.(?:png|jpe?g|gif|webp)[^"']*)["']/i,
        new RegExp(`(["'])([^"']*${instId}\\.(?:png|jpe?g|gif|webp)[^"']*)\\1`, "i"),
      ];
      for (const pattern of patterns) {
        const match = html.match(pattern);
        const href = match?.[1] || match?.[2];
        const absolute = absoluteLabUrl(href);
        if (absolute) {
          candidates.unshift(absolute);
          break;
        }
      }
    }
  } catch {
    /* page inaccessible : on tente les URLs directes */
  }

  let lastError = null;
  for (const url of [...new Set(candidates)]) {
    try {
      const res = await fetch(url, {
        method: "GET",
        signal: AbortSignal.timeout(15000),
      });
      if (!res.ok) {
        lastError = new Error(`HTTP ${res.status} for ${url}`);
        continue;
      }
      const contentType = res.headers.get("content-type") || "";
      const buffer = Buffer.from(await res.arrayBuffer());
      if (
        buffer.length < 100 ||
        (contentType && !/image|octet-stream|png|jpeg|jpg/i.test(contentType) && !url.match(/\.(png|jpe?g|gif|webp)$/i))
      ) {
        lastError = new Error(`Not an image: ${url}`);
        continue;
      }
      return { url, buffer };
    } catch (err) {
      lastError = err;
    }
  }

  throw lastError || new Error(`Image live introuvable pour ${instId}`);
}

/** Vert (OK), rouge (problème), bleu (maintenance) — calé sur le bandeau SYSTEM. */
function classifyStatusColor(avgR, avgG, avgB) {
  const max = Math.max(avgR, avgG, avgB);
  const min = Math.min(avgR, avgG, avgB);
  if (max - min < 25) return "unknown";

  // Bleu = maintenance
  if (avgB > avgR + 25 && avgB > avgG + 15) return "blue";
  // Rouge = problème
  if (avgR > avgG + 25 && avgR > avgB + 25) return "red";
  // Vert lime inclus (ex. ~160,182,55) : G élevé, B bas
  if (avgG >= avgR - 15 && avgG > avgB + 35) return "green";
  return "unknown";
}

/** Décode PNG/JPEG vers RGBA (sans sharp / binaire natif). */
async function decodeImageRgba(buffer) {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    const decoded = jpeg.decode(buffer, { useTArray: true, formatAsRGBA: true });
    return {
      width: decoded.width,
      height: decoded.height,
      rgba: Buffer.from(decoded.data),
    };
  }

  if (
    buffer.length < 24 ||
    buffer[0] !== 0x89 ||
    buffer.toString("ascii", 1, 4) !== "PNG"
  ) {
    throw new Error("Image live non PNG/JPEG");
  }

  let offset = 8;
  let width = 0;
  let height = 0;
  let bitDepth = 0;
  let colorType = -1;
  const idatChunks = [];

  while (offset + 8 <= buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.toString("ascii", offset + 4, offset + 8);
    const dataStart = offset + 8;
    const dataEnd = dataStart + length;
    if (dataEnd + 4 > buffer.length) break;
    const data = buffer.subarray(dataStart, dataEnd);

    if (type === "IHDR") {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      bitDepth = data[8];
      colorType = data[9];
    } else if (type === "IDAT") {
      idatChunks.push(data);
    } else if (type === "IEND") {
      break;
    }

    offset = dataEnd + 4;
  }

  if (!width || !height) throw new Error("PNG invalide (IHDR manquant)");
  if (bitDepth !== 8) throw new Error(`PNG bit depth non supporté: ${bitDepth}`);

  const bytesPerPixel =
    colorType === 2 ? 3 : colorType === 6 ? 4 : colorType === 0 ? 1 : colorType === 4 ? 2 : 0;
  if (!bytesPerPixel) {
    throw new Error(`PNG color type non supporté: ${colorType}`);
  }

  const inflated = await inflatePng(Buffer.concat(idatChunks));
  const stride = width * bytesPerPixel;
  const rgba = Buffer.alloc(width * height * 4);
  let src = 0;
  let prev = Buffer.alloc(stride);

  for (let y = 0; y < height; y++) {
    const filter = inflated[src++];
    const row = Buffer.alloc(stride);
    inflated.copy(row, 0, src, src + stride);
    src += stride;

    for (let i = 0; i < stride; i++) {
      const left = i >= bytesPerPixel ? row[i - bytesPerPixel] : 0;
      const up = prev[i];
      const upLeft = i >= bytesPerPixel ? prev[i - bytesPerPixel] : 0;
      let value = row[i];

      switch (filter) {
        case 1:
          value = (value + left) & 0xff;
          break;
        case 2:
          value = (value + up) & 0xff;
          break;
        case 3:
          value = (value + ((left + up) >> 1)) & 0xff;
          break;
        case 4: {
          const p = left + up - upLeft;
          const pa = Math.abs(p - left);
          const pb = Math.abs(p - up);
          const pc = Math.abs(p - upLeft);
          const pred = pa <= pb && pa <= pc ? left : pb <= pc ? up : upLeft;
          value = (value + pred) & 0xff;
          break;
        }
        case 0:
          break;
        default:
          throw new Error(`PNG filter non supporté: ${filter}`);
      }
      row[i] = value;
    }

    for (let x = 0; x < width; x++) {
      const si = x * bytesPerPixel;
      const di = (y * width + x) * 4;
      if (colorType === 2 || colorType === 6) {
        rgba[di] = row[si];
        rgba[di + 1] = row[si + 1];
        rgba[di + 2] = row[si + 2];
        rgba[di + 3] = colorType === 6 ? row[si + 3] : 255;
      } else if (colorType === 0) {
        rgba[di] = rgba[di + 1] = rgba[di + 2] = row[si];
        rgba[di + 3] = 255;
      } else {
        rgba[di] = rgba[di + 1] = rgba[di + 2] = row[si];
        rgba[di + 3] = row[si + 1];
      }
    }

    prev = row;
  }

  return { width, height, rgba };
}

async function detectColorFromBuffer(buffer) {
  const { width, height, rgba } = await decodeImageRgba(buffer);

  // Bandeau SYSTEM bas-gauche (proportions validées sur capture DXI300011)
  const regionLeft = Math.max(0, Math.round(width * 0.01));
  const regionTop = Math.max(0, Math.round(height * 0.88));
  const regionWidth = Math.max(8, Math.round(width * 0.12));
  const regionHeight = Math.max(8, Math.round(height * 0.08));
  const xEnd = Math.min(width, regionLeft + regionWidth);
  const yEnd = Math.min(height, regionTop + regionHeight);

  let totalR = 0;
  let totalG = 0;
  let totalB = 0;
  let counted = 0;
  let rawR = 0;
  let rawG = 0;
  let rawB = 0;
  let rawCount = 0;

  for (let y = regionTop; y < yEnd; y++) {
    for (let x = regionLeft; x < xEnd; x++) {
      const i = (y * width + x) * 4;
      const r = rgba[i];
      const g = rgba[i + 1];
      const b = rgba[i + 2];
      rawR += r;
      rawG += g;
      rawB += b;
      rawCount++;

      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      if (max > 245 && min > 230) continue;
      if (max - min < 20) continue;
      totalR += r;
      totalG += g;
      totalB += b;
      counted++;
    }
  }

  if (counted < 10) {
    counted = rawCount;
    totalR = rawR;
    totalG = rawG;
    totalB = rawB;
  }

  if (!counted) throw new Error("Zone d'analyse vide");

  return classifyStatusColor(totalR / counted, totalG / counted, totalB / counted);
}

async function refreshLiveStatus(machine) {
  const serial = serialNumberForMachine(machine);
  if (!serial) return null;

  try {
    const { buffer } = await resolveLiveImageUrl(serial);
    const color = await detectColorFromBuffer(buffer);
    const entry = { color, checkedAt: new Date().toISOString(), error: null };
    LIVE_STATUS_CACHE.set(machine.id, entry);
    return entry;
  } catch (err) {
    const entry = {
      color: LIVE_STATUS_CACHE.get(machine.id)?.color ?? "unknown",
      checkedAt: new Date().toISOString(),
      error: err.message,
    };
    LIVE_STATUS_CACHE.set(machine.id, entry);
    return entry;
  }
}

function startLiveStatusPolling() {
  async function poll() {
    try {
      const data = ensureDataShape(readData());
      const mpMachines = data.machines.filter((m) => isMpMachine(m));
      for (const machine of mpMachines) {
        await refreshLiveStatus(machine);
      }
    } catch (err) {
      console.warn("Live status polling error:", err.message);
    }
  }
  poll();
  setInterval(poll, LIVE_POLL_INTERVAL_MS);
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
  // fs.watch skipped: Box/Windows network drives emit uncaught watcher errors (errno -4094).
  // Live updates already go through notifyClients() on writes and frontend polling every 10s.
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
  persistSessions();

  res.json({ token, user: safeUser });
});

app.post("/api/auth/logout", authMiddleware, (req, res) => {
  sessions.delete(req.token);
  persistSessions();
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
  const { machineId, category, comment, itemId } = req.body ?? {};
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
    ...(itemId != null ? { itemId: Number(itemId) } : {}),
  };

  addTicketToMachineCategory(machine, category, text, ticket);
  data.machines[machineIndex] = machine;
  data.tickets.push(ticket);
  writeData(data);
  notifyClients();
  notifyTeamsTicketOpened({ ticket, machine });

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
        updated,
      );
    } else {
      completeTicketOnMachine(
        machine,
        updated.category,
        updated.comment,
        updated.id,
      );
      const linked = findLinkedItem(machine, updated.category, updated);
      if (linked) bindTicketAndItem(machine, updated, linked);
    }
  }

  writeData(data);
  notifyClients();

  if (
    status === "closed" &&
    current.status !== "closed" &&
    machine
  ) {
    notifyTeamsTicketClosed({ ticket: updated, machine });
  }

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
  res.flushHeaders?.();
  res.write(": connected\n\n");

  if (!clients.includes(res)) clients.push(res);

  const keepAlive = setInterval(() => {
    try {
      res.write(": ping\n\n");
    } catch {
      clearInterval(keepAlive);
    }
  }, 25000);

  req.on("close", () => {
    clearInterval(keepAlive);
    const index = clients.indexOf(res);
    if (index !== -1) clients.splice(index, 1);
  });
});

app.get("/api/machines/:id/live-status", authMiddleware, async (req, res) => {
  const id = Number(req.params.id);
  const data = ensureDataShape(readData());
  const machine = findMachine(data, id);
  if (!machine) return res.status(404).json({ error: "Machine introuvable" });
  if (!isMpMachine(machine)) {
    return res.json({ color: "unknown", checkedAt: null, error: "Not a DXI machine" });
  }

  const cached = LIVE_STATUS_CACHE.get(id);
  const forceRefresh = req.query.refresh === "true";

  if (cached && !forceRefresh) {
    return res.json(cached);
  }

  const result = await refreshLiveStatus(machine);
  res.json(result ?? { color: "unknown", checkedAt: null, error: "No serial number" });
});

app.get("/api/machines/live-status", authMiddleware, (_req, res) => {
  const result = {};
  for (const [machineId, entry] of LIVE_STATUS_CACHE.entries()) {
    result[machineId] = entry;
  }
  res.json(result);
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

    const previous = data.machines[index];
    const machine = { ...req.body, id };
    const { created: createdTickets, closed: closedTickets } =
      syncMachineLinkedTickets(data, previous, machine, req.user);
    data.machines[index] = machine;
    writeData(data);
    notifyClients();
    for (const created of createdTickets) {
      notifyTeamsTicketOpened(created);
    }
    for (const closed of closedTickets) {
      notifyTeamsTicketClosed(closed);
    }

    const machineTickets = data.tickets.filter(
      (ticket) => Number(ticket.machineId) === id,
    );

    res.json({
      machine,
      createdTickets: createdTickets.map((entry) => entry.ticket),
      tickets: machineTickets,
    });
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

    const { created: createdTickets, closed: closedTickets } =
      syncMachineLinkedTickets(
        data,
        { flags: [], problems: [] },
        newMachine,
        req.user,
      );
    data.machines.push(newMachine);
    writeData(data);
    notifyClients();
    for (const created of createdTickets) {
      notifyTeamsTicketOpened(created);
    }
    for (const closed of closedTickets) {
      notifyTeamsTicketClosed(closed);
    }

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
const restoredSessions = loadPersistedSessions();
setupDataWatch();

app.listen(PORT, () => {
  console.log(`Serveur lancé sur http://localhost:${PORT}`);
  console.log(`Dossier server.js : ${__dirname}`);
  if (loadedEnvFiles.length > 0) {
    console.log(`Fichiers env lus : ${loadedEnvFiles.join(", ")}`);
  } else {
    console.log("Aucun fichier .env / .env.local trouvé à côté de server.js");
  }
  if (restoredSessions > 0) {
    console.log(`Sessions restaurées : ${restoredSessions}`);
  }
  const webhook = process.env.TEAMS_WEBHOOK_URL?.trim() || "";
  if (webhook) {
    try {
      const host = new URL(webhook).host;
      console.log(`Notifications Teams : canal (${host})`);
    } catch {
      console.log(
        `Notifications Teams : URL webhook invalide (${webhook.slice(0, 40)}…)`,
      );
    }
  } else {
    console.log(
      "Notifications Teams : désactivées — TEAMS_WEBHOOK_URL est vide.",
    );
    console.log(
      "Ajoute dans .env.local (une seule ligne, à côté de server.js) :",
    );
    console.log("TEAMS_WEBHOOK_URL=https://...");
  }

  const reset = maybeResetMonthlyMaint();
  if (reset.performed) {
    console.log(
      `Vérification maintenance mensuelle au démarrage: ${reset.resetCount} MP réinitialisée(s)`,
    );
  }

  scheduleMonthlyMaintCheck();
  startLiveStatusPolling();
  console.log(`Détection couleur live : polling toutes les ${LIVE_POLL_INTERVAL_MS / 1000}s`);
});
