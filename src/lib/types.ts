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
  /** Identifiant stable de la ligne (problème / flag) */
  id?: number;
  text: string;
  completed: boolean;
  completedDate?: string;
  /** Lien vers le ticket associé */
  ticketId?: number;
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
  /** N° de série DXI 9000 (ex. MP11 → 300011) */
  serialNumber?: number;
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
  /** Identifiant de la ligne problème / flag liée */
  itemId?: number;
}

export function machineKind(m: Pick<Machine, "name">): MachineKind {
  const name = m.name.toLowerCase();
  if (name.startsWith("access")) return "ACCESS";
  // DXI 9000 : MP, Falcon, Machine Prototype…
  return "MP";
}
