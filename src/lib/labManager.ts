const LAB_MANAGER_HOST = "http://cciaappserver01";

export const FALCON_MP_LAB_DASHBOARD_URL =
  `${LAB_MANAGER_HOST}/LabManager/Home/LabIndex?platform=FalconMP&location=Marseille`;

/** MP11 → DXI300011, MP89 → DXI300089 */
export function mpInstrumentInstId(name: string): string | null {
  const match = name.match(/^mp\s*(\d+)/i);
  if (!match) return null;
  return `DXI300${match[1].padStart(3, "0")}`;
}

export function mpInstrumentHomeUrl(name: string): string | null {
  const instId = mpInstrumentInstId(name);
  if (!instId) return null;
  return `${LAB_MANAGER_HOST}/LabManager/Home/InstrumentHome?instID=${instId}`;
}
