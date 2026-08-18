import type { Machine, MachineStatus } from "@/lib/types";

export const STATUS_LABELS: Record<MachineStatus, string> = {
  ok: "OK",
  maintenance: "Maintenance",
  danger: "Problème",
};

export function hasOpenProblems(machine: Machine): boolean {
  return (machine.problems ?? []).some((item) => !item.completed);
}

/** État affiché / filtré : un problème ouvert compte comme « Problème ». */
export function effectiveStatus(machine: Machine): MachineStatus {
  if (machine.status === "danger" || hasOpenProblems(machine)) return "danger";
  if (machine.status === "maintenance") return "maintenance";
  return "ok";
}
