import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

function formatCountdown(ms: number) {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

export function LivePollControl({
  nextPollAt,
  polling,
  onRefresh,
  refreshing = false,
}: {
  nextPollAt: string | null;
  polling: boolean;
  onRefresh: () => void;
  refreshing?: boolean;
}) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const busy = polling || refreshing;
  const remainingMs = nextPollAt ? Date.parse(nextPollAt) - now : null;
  const countdown =
    remainingMs == null || Number.isNaN(remainingMs) ? "—" : formatCountdown(remainingMs);
  const label = busy ? "en cours" : countdown;

  return (
    <button
      type="button"
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        if (!busy) onRefresh();
      }}
      disabled={busy}
      aria-label="Rafraîchir le statut live"
      title="Prochaine vérification auto du statut live — toutes les DXI, toutes les 5 min. Cliquer pour rafraîchir maintenant."
      className="inline-flex items-center gap-0.5 rounded-md border border-border/70 bg-muted/50 py-0.5 pl-1.5 pr-0.5 text-[11px] font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-60"
    >
      <span className="tabular-nums">Live {label}</span>
      <span className="inline-flex h-5 w-5 items-center justify-center rounded-sm">
        <RefreshCw className={cn("h-3 w-3", busy && "animate-spin")} />
      </span>
    </button>
  );
}
