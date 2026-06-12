export type MachineStatus = "ok" | "maintenance" | "danger";
export type AsdStatus = "valid" | "pending" | "fail_precision" | "warning";
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
  monthlyMaint: MonthlyMaint;
}

export type MachineKind = "MP" | "ACCESS";

export function machineKind(m: Pick<Machine, "name">): MachineKind {
  return m.name.toLowerCase().startsWith("access") ? "ACCESS" : "MP";
}
