import type { Machine } from "./types";
import { machineKind } from "./types";

export type MachineWave = "Wave 1" | "Wave 2" | "Wave 3";

/** MP11 → 300011, MP89 → 300089 */
export function inferSerialFromName(name: string): number | undefined {
  const match = name.trim().match(/^MP\s*0*(\d+)$/i);
  if (!match) return undefined;
  return 300000 + Number(match[1]);
}

export function resolveSerialNumber(machine: Pick<Machine, "name" | "serialNumber">): number | undefined {
  if (machine.serialNumber != null && Number.isFinite(Number(machine.serialNumber))) {
    return Number(machine.serialNumber);
  }
  return inferSerialFromName(machine.name);
}

export function getMachineWave(serial: number): MachineWave {
  if (serial <= 300051) return "Wave 1";
  if (serial <= 300081) return "Wave 2";
  return "Wave 3";
}

export function waveForMachine(machine: Pick<Machine, "name" | "serialNumber">): MachineWave | undefined {
  if (machineKind(machine) !== "MP") return undefined;
  const serial = resolveSerialNumber(machine);
  if (serial == null) return undefined;
  return getMachineWave(serial);
}

export const DXI_WAVE_LEGEND = [
  { wave: "Wave 1", range: "n° de série 0 à 300051" },
  { wave: "Wave 2", range: "n° de série 300052 à 300081" },
  { wave: "Wave 3", range: "n° de série à partir de 300082" },
] as const;
