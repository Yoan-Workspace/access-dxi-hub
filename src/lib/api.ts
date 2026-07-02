import type { Machine } from "./types";

// Configure ton serveur Express via VITE_API_URL (.env.local).
// Exemple: VITE_API_URL=http://localhost:3000
// Contrat attendu:
//   GET    {API}/api/machines           -> { machines: Machine[] }
//   POST   {API}/api/machines           -> Machine (body: Machine sans id)
//   PUT    {API}/api/machines/:id       -> Machine (body: Machine)
// Si VITE_API_URL n'est pas défini, on lit /machines.json (mode démo, lecture seule).

const API_BASE = (import.meta as { env?: Record<string, string | undefined> }).env
  ?.VITE_API_URL?.replace(/\/$/, "");

export const API_CONFIGURED = Boolean(API_BASE);

export async function fetchMachines(): Promise<Machine[]> {
  if (API_BASE) {
    const res = await fetch(`${API_BASE}/api/machines`);
    if (!res.ok) throw new Error(`GET /api/machines: ${res.status}`);
    const data = (await res.json()) as { machines: Machine[] };
    return data.machines;
  }
  const res = await fetch("/machines.json");
  if (!res.ok) throw new Error("Impossible de charger /machines.json");
  const data = (await res.json()) as { machines: Machine[] };
  return data.machines;
}

export async function createMachine(machine: Omit<Machine, "id">): Promise<Machine> {
  if (!API_BASE) {
    throw new Error("API non configurée — impossible d'ajouter une machine");
  }

  const res = await fetch(`${API_BASE}/api/machines`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(machine),
  });

  if (!res.ok) throw new Error(`POST /api/machines: ${res.status}`);

  return (await res.json()) as Machine;
}

export async function updateMachine(m: Machine): Promise<Machine> {
  if (!API_BASE) {
    throw new Error("API non configurée — impossible de modifier une machine");
  }

  const res = await fetch(`${API_BASE}/api/machines/${m.id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(m),
  });

  if (!res.ok) throw new Error(`PUT /api/machines/${m.id}: ${res.status}`);

  return (await res.json()) as Machine;
}
