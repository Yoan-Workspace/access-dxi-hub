import type { Machine, Ticket, User } from "./types";

function resolveApiBase(): string | undefined {
  // En production le front est servi par server.js : toujours la même origine.
  // Sinon VITE_API_URL=localhost dans .env.local casse le live update sur les autres PC.
  if (import.meta.env.PROD) return "";
  const fromEnv = (import.meta as { env?: Record<string, string | undefined> }).env
    ?.VITE_API_URL?.replace(/\/$/, "");
  if (fromEnv) return fromEnv;
  return undefined;
}

const API_BASE = resolveApiBase();

export const API_CONFIGURED = API_BASE !== undefined;

export function getApiBase() {
  return API_BASE ?? "";
}

const AUTH_KEY = "dxi-auth-token";

export function getStoredToken() {
  return localStorage.getItem(AUTH_KEY);
}

export function setStoredToken(token: string | null) {
  if (token) localStorage.setItem(AUTH_KEY, token);
  else localStorage.removeItem(AUTH_KEY);
}

async function apiFetch(path: string, init: RequestInit = {}) {
  if (!API_CONFIGURED) throw new Error("API non configurée");

  const headers = new Headers(init.headers);
  if (!headers.has("Content-Type") && init.body) {
    headers.set("Content-Type", "application/json");
  }

  const token = getStoredToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const res = await fetch(`${API_BASE ?? ""}${path}`, { ...init, headers });

  if (res.status === 401) {
    setStoredToken(null);
    throw new Error("SESSION_EXPIRED");
  }

  if (!res.ok) {
    let message = `Erreur ${res.status}`;
    try {
      const body = (await res.json()) as { error?: string };
      if (body.error) message = body.error;
    } catch {
      /* ignore */
    }
    throw new Error(message);
  }

  if (res.status === 204) return null;
  return res.json();
}

export async function login(username: string, password: string) {
  if (!API_CONFIGURED) throw new Error("API non configurée");

  const res = await fetch(`${API_BASE ?? ""}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });

  if (!res.ok) {
    let message = "Identifiants invalides";
    try {
      const body = (await res.json()) as { error?: string };
      if (body.error) message = body.error;
    } catch {
      /* ignore */
    }
    throw new Error(message);
  }

  const data = (await res.json()) as { token: string; user: User };
  setStoredToken(data.token);
  return data.user;
}

export async function logout() {
  try {
    await apiFetch("/api/auth/logout", { method: "POST" });
  } finally {
    setStoredToken(null);
  }
}

export async function fetchCurrentUser(): Promise<User | null> {
  if (!API_CONFIGURED || !getStoredToken()) return null;
  const data = (await apiFetch("/api/auth/me")) as { user: User };
  return data.user;
}

export async function changePassword(currentPassword: string, newPassword: string) {
  await apiFetch("/api/auth/change-password", {
    method: "POST",
    body: JSON.stringify({ currentPassword, newPassword }),
  });
}

export async function fetchMachines(): Promise<Machine[]> {
  if (API_CONFIGURED) {
    const data = (await apiFetch("/api/machines")) as { machines: Machine[] };
    return data.machines;
  }
  const res = await fetch("/machines.json");
  if (!res.ok) throw new Error("Impossible de charger /machines.json");
  const data = (await res.json()) as { machines: Machine[] };
  return data.machines;
}

export async function createMachine(machine: Omit<Machine, "id">): Promise<Machine> {
  return (await apiFetch("/api/machines", {
    method: "POST",
    body: JSON.stringify(machine),
  })) as Machine;
}

export async function updateMachine(
  m: Machine,
): Promise<{ machine: Machine; createdTickets: Ticket[]; tickets: Ticket[] }> {
  const data = (await apiFetch(`/api/machines/${m.id}`, {
    method: "PUT",
    body: JSON.stringify(m),
  })) as
    | Machine
    | { machine?: Machine; createdTickets?: Ticket[]; tickets?: Ticket[] };

  if (data && typeof data === "object" && "machine" in data && data.machine) {
    const createdTickets = Array.isArray(data.createdTickets)
      ? data.createdTickets
      : [];
    return {
      machine: data.machine,
      createdTickets,
      tickets: Array.isArray(data.tickets) ? data.tickets : createdTickets,
    };
  }

  return { machine: data as Machine, createdTickets: [], tickets: [] };
}

export async function deleteMachine(id: number): Promise<void> {
  await apiFetch(`/api/machines/${id}`, { method: "DELETE" });
}

export async function fetchTickets(machineId?: number): Promise<Ticket[]> {
  if (!API_CONFIGURED) return [];
  const query = machineId ? `?machineId=${machineId}` : "";
  const data = (await apiFetch(`/api/tickets${query}`)) as { tickets: Ticket[] };
  return data.tickets;
}

export async function createTicket(input: {
  machineId: number;
  category: Ticket["category"];
  comment: string;
  itemId?: number;
}): Promise<{ ticket: Ticket; machine?: Machine }> {
  const data = (await apiFetch("/api/tickets", {
    method: "POST",
    body: JSON.stringify(input),
  })) as Ticket | { ticket: Ticket; machine?: Machine };

  // Ancien format (ticket brut) ou nouveau format ({ ticket, machine })
  if (data && typeof data === "object" && "ticket" in data && data.ticket) {
    return { ticket: data.ticket, machine: data.machine };
  }

  const ticket = data as Ticket;
  if (!ticket?.machineId) {
    throw new Error("Réponse ticket invalide du serveur");
  }

  return { ticket };
}

export async function updateTicket(
  id: number,
  input: Partial<Pick<Ticket, "category" | "comment" | "status" | "checklist">>,
): Promise<{ ticket: Ticket; machine?: Machine | null }> {
  const data = (await apiFetch(`/api/tickets/${id}`, {
    method: "PUT",
    body: JSON.stringify(input),
  })) as Ticket | { ticket: Ticket; machine?: Machine | null };

  if (data && typeof data === "object" && "ticket" in data && data.ticket) {
    return { ticket: data.ticket, machine: data.machine };
  }

  return { ticket: data as Ticket };
}

export async function updateMachineItemChecklist(
  machineId: number,
  itemId: number,
  checklist: Ticket["checklist"],
): Promise<{ machine: Machine; ticket?: Ticket | null }> {
  return (await apiFetch(`/api/machines/${machineId}/items/${itemId}/checklist`, {
    method: "PUT",
    body: JSON.stringify({ checklist: checklist ?? [] }),
  })) as { machine: Machine; ticket?: Ticket | null };
}

export async function deleteTicket(
  id: number,
): Promise<{ ok: boolean; machine?: Machine | null }> {
  const data = (await apiFetch(`/api/tickets/${id}`, {
    method: "DELETE",
  })) as { ok: boolean; machine?: Machine | null };

  return data ?? { ok: true };
}

export async function fetchUsers(): Promise<User[]> {
  const data = (await apiFetch("/api/users")) as { users: User[] };
  return data.users;
}

export async function createUser(input: {
  username: string;
  password: string;
  role: User["role"];
  displayName?: string;
}): Promise<User> {
  return (await apiFetch("/api/users", {
    method: "POST",
    body: JSON.stringify(input),
  })) as User;
}

export async function deleteUser(id: number): Promise<void> {
  await apiFetch(`/api/users/${id}`, { method: "DELETE" });
}

export async function resetUserPassword(id: number, password: string): Promise<void> {
  await apiFetch(`/api/users/${id}/reset-password`, {
    method: "POST",
    body: JSON.stringify({ password }),
  });
}

export const LIVE_POLL_INTERVAL_MS = 5 * 60 * 1000;

export interface LiveStatus {
  color: "red" | "green" | "blue" | "unknown";
  checkedAt: string | null;
  error: string | null;
}

export interface LiveStatusSnapshot {
  statuses: Record<number, LiveStatus>;
  polling: boolean;
  pollIntervalMs: number;
  nextPollAt: string | null;
  lastPollStartedAt: string | null;
  lastPollFinishedAt: string | null;
}

const EMPTY_LIVE_STATUS: LiveStatusSnapshot = {
  statuses: {},
  polling: false,
  pollIntervalMs: LIVE_POLL_INTERVAL_MS,
  nextPollAt: null,
  lastPollStartedAt: null,
  lastPollFinishedAt: null,
};

function isLiveStatusEntry(value: unknown): value is LiveStatus {
  return Boolean(value) && typeof value === "object" && "color" in value;
}

function deriveNextPollAt(
  statuses: Record<number, LiveStatus>,
  pollIntervalMs: number,
): string | null {
  let latest = 0;
  for (const entry of Object.values(statuses)) {
    if (!entry?.checkedAt) continue;
    const t = Date.parse(entry.checkedAt);
    if (Number.isFinite(t) && t > latest) latest = t;
  }
  if (!latest) return null;
  return new Date(latest + pollIntervalMs).toISOString();
}

function parseLiveStatusSnapshot(data: unknown): LiveStatusSnapshot {
  if (!data || typeof data !== "object") return EMPTY_LIVE_STATUS;

  const raw = data as Record<string, unknown>;
  let statuses: Record<number, LiveStatus> = {};
  let polling = false;
  let pollIntervalMs = LIVE_POLL_INTERVAL_MS;
  let nextPollAt: string | null = null;
  let lastPollStartedAt: string | null = null;
  let lastPollFinishedAt: string | null = null;

  if (raw.statuses && typeof raw.statuses === "object") {
    statuses = raw.statuses as Record<number, LiveStatus>;
    polling = Boolean(raw.polling);
    pollIntervalMs =
      typeof raw.pollIntervalMs === "number" ? raw.pollIntervalMs : LIVE_POLL_INTERVAL_MS;
    nextPollAt = typeof raw.nextPollAt === "string" ? raw.nextPollAt : null;
    lastPollStartedAt =
      typeof raw.lastPollStartedAt === "string" ? raw.lastPollStartedAt : null;
    lastPollFinishedAt =
      typeof raw.lastPollFinishedAt === "string" ? raw.lastPollFinishedAt : null;
  } else {
    for (const [key, value] of Object.entries(raw)) {
      const id = Number(key);
      if (!Number.isFinite(id) || !isLiveStatusEntry(value)) continue;
      statuses[id] = value;
    }
  }

  if (!nextPollAt) {
    nextPollAt = deriveNextPollAt(statuses, pollIntervalMs);
  }

  return {
    statuses,
    polling,
    pollIntervalMs,
    nextPollAt,
    lastPollStartedAt,
    lastPollFinishedAt,
  };
}

function isNotFoundError(err: unknown) {
  return err instanceof Error && /\b404\b/.test(err.message);
}

export async function fetchAllLiveStatus(): Promise<LiveStatusSnapshot> {
  if (!API_CONFIGURED) return EMPTY_LIVE_STATUS;
  return parseLiveStatusSnapshot(await apiFetch("/api/machines/live-status"));
}

export async function refreshAllLiveStatus(
  machineIds: number[] = [],
): Promise<LiveStatusSnapshot> {
  try {
    return parseLiveStatusSnapshot(
      await apiFetch("/api/machines/live-status/refresh", { method: "POST" }),
    );
  } catch (err) {
    if (!isNotFoundError(err)) throw err;
  }

  let ids = machineIds.filter((id) => Number.isFinite(id) && id > 0);
  if (ids.length === 0) {
    ids = Object.keys((await fetchAllLiveStatus()).statuses)
      .map(Number)
      .filter((id) => Number.isFinite(id) && id > 0);
  }
  if (ids.length === 0) {
    throw new Error("Impossible de rafraîchir le statut live");
  }

  for (const id of ids) {
    try {
      await apiFetch(`/api/machines/${id}/live-status?refresh=true`);
    } catch {
      /* Access 2 or unreachable instrument */
    }
  }

  const snapshot = await fetchAllLiveStatus();
  if (snapshot.nextPollAt) return snapshot;
  return {
    ...snapshot,
    nextPollAt: new Date(Date.now() + snapshot.pollIntervalMs).toISOString(),
  };
}

export interface PresenceUser {
  id: number;
  username: string;
  displayName: string;
  role: User["role"];
  lastSeen: number;
}

export async function fetchPresence(): Promise<PresenceUser[]> {
  if (!API_CONFIGURED) return [];
  const data = (await apiFetch("/api/presence")) as { users?: PresenceUser[] };
  return Array.isArray(data.users) ? data.users : [];
}

const PRESENCE_SESSION_KEY = "dxi-presence-session";

export function getPresenceSessionId() {
  try {
    let id = sessionStorage.getItem(PRESENCE_SESSION_KEY);
    if (!id) {
      id =
        typeof crypto !== "undefined" && crypto.randomUUID
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
      sessionStorage.setItem(PRESENCE_SESSION_KEY, id);
    }
    return id;
  } catch {
    return `tab-${Date.now()}`;
  }
}

export async function presenceHello(): Promise<PresenceUser[]> {
  const data = (await apiFetch("/api/presence/hello", {
    method: "POST",
    body: JSON.stringify({ sessionId: getPresenceSessionId() }),
  })) as { users?: PresenceUser[] };
  return Array.isArray(data.users) ? data.users : [];
}

export function presenceBye() {
  if (!API_CONFIGURED) return;
  const token = getStoredToken();
  if (!token) return;
  const url = `${getApiBase()}/api/presence/bye?token=${encodeURIComponent(token)}&sessionId=${encodeURIComponent(getPresenceSessionId())}`;
  try {
    navigator.sendBeacon(url);
  } catch {
    void fetch(url, { method: "POST", keepalive: true }).catch(() => undefined);
  }
}

export async function sendWizz(userId: number): Promise<void> {
  await apiFetch("/api/wizz", {
    method: "POST",
    body: JSON.stringify({ userId }),
  });
}
