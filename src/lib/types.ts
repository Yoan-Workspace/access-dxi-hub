export type MachineStatus = "ok" | "maintenance" | "danger";
export type AsdStatus =
  | "valid"
  | "non_functional"
  | "fail_low_volume"
  | "fail_precision"
  | "pending"
  | "invalid";
export type AdamStatus = "fonctionnelle" | "non_fonctionnelle";
export type MonthlyMaint = "done" | "not_done";
export type Localisation = "BSL2" | "Thermal" | string;

export interface TodoItem {
  text: string;
  completed: boolean;
  completedDate?: string;
}

export interface PmRef {
  period: number;
  month: string;
  year: number;
}

export interface Machine {
  id: number;
  name: string;
  lastDate: string;
  flags: TodoItem[];
  pmRef: PmRef;
  sw: string;
  status: MachineStatus;
  adam: AdamStatus;
  improvements: TodoItem[];
  problems: TodoItem[];
  repairs: TodoItem[];
  localisation: Localisation;
  asdStatus: AsdStatus;
  asdLabel?: string;
  pmHistory?: unknown[];
  monthlyMaint?: MonthlyMaint;
}

export type MachineKind = "MP" | "ACCESS";

export type UserRole = "admin" | "technicien" | "operateur";

export type TicketCategory = "reparation" | "probleme" | "flag" | "non_classe";

export type TicketStatus = "open" | "closed";

export interface User {
  id: number;
  username: string;
  displayName: string;
  role: UserRole;
}

export interface Ticket {
  id: number;
  machineId: number;
  category: TicketCategory;
  comment: string;
  status: TicketStatus;
  createdBy: number;
  createdByName: string;
  createdAt: string;
  updatedAt: string;
  closedAt?: string;
  closedBy?: string;
}

export function machineKind(m: Pick<Machine, "name">): MachineKind {
  const name = m.name.toLowerCase();
  if (name.startsWith("access")) return "ACCESS";
  // DXI 9000 : MP, Falcon, Machine Prototype…
  return "MP";
}
