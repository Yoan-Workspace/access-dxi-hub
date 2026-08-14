import { DXI_WAVE_LEGEND } from "@/lib/machineWave";

export function DxiWaveNote() {
  return (
    <aside className="rounded-xl border bg-card px-3 py-2.5 text-xs text-muted-foreground">
      <p className="font-medium text-foreground">DXI 9000 — versions Wave</p>
      <ul className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1">
        {DXI_WAVE_LEGEND.map((item) => (
          <li key={item.wave}>
            <span className="font-semibold text-mp">{item.wave}</span>
            <span> : {item.range}</span>
          </li>
        ))}
      </ul>
    </aside>
  );
}
