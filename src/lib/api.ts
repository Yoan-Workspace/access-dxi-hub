import type { Machine, Ticket, User } from "./types";

function resolveApiBase(): string | undefined {
  const fromEnv = (import.meta as { env?: Record<string, string | undefined> }).env
    ?.VITE_API_URL?.replace(/\/$/, "");
  if (fromEnv) return fromEnv;
  if (import.meta.env.PROD) return "";
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

export async function updateMachine(m: Machine): Promise<Machine> {
  return (await apiFetch(`/api/machines/${m.id}`, {
    method: "PUT",
    body: JSON.stringify(m),
  })) as Machine;
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
}): Promise<Ticket> {
  return (await apiFetch("/api/tickets", {
    method: "POST",
    body: JSON.stringify(input),
  })) as Ticket;
}

export async function updateTicket(
  id: number,
  input: Partial<Pick<Ticket, "category" | "comment" | "status">>,
): Promise<Ticket> {
  return (await apiFetch(`/api/tickets/${id}`, {
    method: "PUT",
    body: JSON.stringify(input),
  })) as Ticket;
}

export async function deleteTicket(id: number): Promise<void> {
  await apiFetch(`/api/tickets/${id}`, { method: "DELETE" });
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
