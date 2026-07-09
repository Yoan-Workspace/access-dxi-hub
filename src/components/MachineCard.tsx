import {
  Activity,
  AlertTriangle,
  Calendar,
  CheckCircle2,
  ExternalLink,
  Flag,
  Lightbulb,
  MapPin,
  Pencil,
  Ticket,
  Wrench,
  XCircle,
} from "lucide-react";
import type { EditMachineTab } from "@/components/EditMachineDialog";
import type { Machine } from "@/lib/types";
import { mpInstrumentHomeUrl } from "@/lib/labManager";
import { machineKind } from "@/lib/types";
import { cn } from "@/lib/utils";

const statusMap: Record<
  Machine["status"],
  { label: string; color: string; ring: string }
> = {
  ok: {
    label: "OK",
    color: "text-success",
    ring: "bg-success",
  },
  maintenance: {
    label: "Maintenance",
    color: "text-maintenance",
    ring: "bg-maintenance",
  },
  danger: {
    label: "Problème",
    color: "text-danger",
    ring: "bg-danger",
  },
};

function pendingCount(items: { completed: boolean }[] | undefined) {
  return (items ?? []).filter((i) => !i.completed).length;
}

function doneCount(items: { completed: boolean }[] | undefined) {
  return (items ?? []).filter((i) => i.completed).length;
}

function fmtDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString("fr-FR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

const monthNames = [
  "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
  "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre",
];

const monthMap: Record<string, number> = {
  Janvier: 0,
  Février: 1,
  Mars: 2,
  Avril: 3,
  Mai: 4,
  Juin: 5,
  Juillet: 6,
  Août: 7,
  Septembre: 8,
  Octobre: 9,
  Novembre: 10,
  Décembre: 11,
};

function getNextPm(machine: Machine) {
  const lastPmDate = new Date(
    machine.pmRef.year,
    monthMap[machine.pmRef.month],
    1,
  );
  const dueDate = new Date(lastPmDate);
  dueDate.setMonth(dueDate.getMonth() + 6);

  return {
    dueDate,
    nextType: machine.pmRef.period === 6 ? 12 : 6,
  };
}

function pmDueThisMonthLabel(machine: Machine): string | null {
  const { dueDate, nextType } = getNextPm(machine);
  const now = new Date();

  if (
    dueDate.getMonth() !== now.getMonth() ||
    dueDate.getFullYear() !== now.getFullYear()
  ) {
    return null;
  }

  return `PM ${nextType} · ${monthNames[dueDate.getMonth()]}`;
}

function maintenanceDue(machine: Machine, kind: ReturnType<typeof machineKind>) {
  if (kind === "MP" && (machine.monthlyMaint ?? "not_done") === "not_done") {
    return true;
  }

  if (
    machine.asdStatus !== "valid" &&
    machine.asdStatus !== "fail_precision"
  ) {
    return true;
  }

  const { dueDate } = getNextPm(machine);
  const now = new Date();
  const currentMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  if (dueDate < currentMonth) return true;

  return (
    dueDate.getMonth() === now.getMonth() &&
    dueDate.getFullYear() === now.getFullYear()
  );
}

function cardTopBarClass(
  machine: Machine,
  kind: ReturnType<typeof machineKind>,
  activeProblems: number,
) {
  if (activeProblems > 0 || machine.status === "danger") return "bg-danger";
  if (machine.status === "maintenance") return "bg-maintenance";
  if (maintenanceDue(machine, kind)) return "bg-warning";
  return "bg-success";
}

export function MachineCard({
  machine,
  ticketsOpen = 0,
  ticketsClosed = 0,
  onEdit,
}: {
  machine: Machine;
  ticketsOpen?: number;
  ticketsClosed?: number;
  onEdit: (tab?: EditMachineTab) => void;
}) {
  const kind = machineKind(machine);
  const s = statusMap[machine.status];
  const liveUrl = kind === "MP" ? mpInstrumentHomeUrl(machine.name) : null;

  const flagsInProgress = pendingCount(machine.flags);
  const flagsDone = doneCount(machine.flags);
  const improvInProgress = pendingCount(machine.improvements);
  const improvDone = doneCount(machine.improvements);
  const probsInProgress = pendingCount(machine.problems);
  const probsDone = doneCount(machine.problems);
  const repairsInProgress = pendingCount(machine.repairs);
  const repairsDone = doneCount(machine.repairs);
  const topBarClass = cardTopBarClass(machine, kind, probsInProgress);
  const pmThisMonth = pmDueThisMonthLabel(machine);

  return (
    <div
      onClick={() => onEdit("general")}
      className={cn(
        "group relative flex cursor-pointer flex-col gap-4 rounded-2xl border bg-card p-5",
        "transition-all duration-200",
        "hover:-translate-y-1",
        "hover:border-primary/40",
        "hover:shadow-[0_8px_30px_-12px_rgba(0,0,0,0.12)]",
      )}
    >
      <span
        className={cn(
          "absolute left-5 right-5 top-0 h-[3px] rounded-b-full",
          topBarClass,
        )}
      />

      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={cn(
                "inline-flex h-5 items-center rounded-full px-2 text-[10px] font-semibold tracking-wider uppercase",
                kind === "MP" ? "bg-mp/10 text-mp" : "bg-access/10 text-access",
              )}
            >
              {kind === "MP" ? "DXI 9000" : "Access 2"}
            </span>

            <span className={cn("inline-flex items-center gap-1 text-xs", s.color)}>
              <span className={cn("h-1.5 w-1.5 rounded-full", s.ring)} />
              {s.label}
            </span>

            {pmThisMonth && (
              <span className="inline-flex items-center gap-1 rounded-full bg-warning/15 px-2 py-0.5 text-[10px] font-semibold text-warning">
                <Calendar className="h-3 w-3" />
                {pmThisMonth}
              </span>
            )}
          </div>

          <h3 className="mt-1.5 truncate text-lg font-semibold tracking-tight">
            {machine.name}
          </h3>

          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <MapPin className="h-3 w-3" />
              {machine.localisation}
            </span>

            <span className="inline-flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              {fmtDate(machine.lastDate)}
            </span>

            <span>SW {machine.sw}</span>

            {liveUrl && (
              <a
                href={liveUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="inline-flex items-center gap-1 font-medium text-mp transition hover:text-mp/80 hover:underline"
              >
                <ExternalLink className="h-3 w-3" />
                Voir en direct
              </a>
            )}
          </div>
        </div>

        <button
          onClick={(e) => {
            e.stopPropagation();
            onEdit("general");
          }}
          aria-label="Éditer"
          className="rounded-lg border border-transparent p-1.5 text-muted-foreground transition hover:border-border hover:bg-secondary hover:text-foreground"
        >
          <Pencil className="h-4 w-4" />
        </button>
      </div>

      <div className="flex flex-wrap gap-1.5 text-[11px]">
        <Badge
          icon={<Activity className="h-3 w-3" />}
          label={`ADAM ${machine.adam === "fonctionnelle" ? "OK" : "KO"}`}
          tone={machine.adam === "fonctionnelle" ? "success" : "danger"}
        />

        {kind === "ACCESS" ? (
          <Badge
            icon={<CheckCircle2 className="h-3 w-3" />}
            label={`System Check ${systemCheckLabel(machine.asdStatus)}`}
            tone={systemCheckTone(machine.asdStatus)}
          />
        ) : (
          <>
            <Badge
              icon={<CheckCircle2 className="h-3 w-3" />}
              label={`ASD ${asdLabel(machine.asdStatus)}`}
              tone={asdTone(machine.asdStatus)}
            />
            <Badge
              icon={<Wrench className="h-3 w-3" />}
              label={`Maint. mensuelle ${machine.monthlyMaint === "done" ? "✓" : "✗"}`}
              tone={machine.monthlyMaint === "done" ? "success" : "danger"}
            />
          </>
        )}

        <Badge
          icon={<Calendar className="h-3 w-3" />}
          label={`PM ${machine.pmRef.period}m · ${machine.pmRef.month} ${machine.pmRef.year}`}
          tone="neutral"
        />
      </div>

      <div className="grid grid-cols-4 gap-1.5">
        <Counter
          icon={<Flag className="h-3.5 w-3.5 shrink-0" />}
          inProgress={flagsInProgress}
          done={flagsDone}
          label="Flags"
          tone="warning"
          onClick={() => onEdit("flags")}
        />

        <Counter
          icon={<XCircle className="h-3.5 w-3.5 shrink-0" />}
          inProgress={probsInProgress}
          done={probsDone}
          label="Probl."
          tone="danger"
          onClick={() => onEdit("problems")}
        />

        <Counter
          icon={<AlertTriangle className="h-3.5 w-3.5 shrink-0" />}
          inProgress={repairsInProgress}
          done={repairsDone}
          label="Répar."
          tone="warning"
          onClick={() => onEdit("repairs")}
        />

        <Counter
          icon={<Lightbulb className="h-3.5 w-3.5 shrink-0" />}
          inProgress={improvInProgress}
          done={improvDone}
          label="Improv."
          tone="improve"
          onClick={() => onEdit("improvements")}
        />
      </div>

      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onEdit("tickets");
        }}
        className={cn(
          "flex w-full items-center justify-between rounded-lg border bg-background/50 px-3 py-2 text-left transition",
          "hover:border-primary/30 hover:bg-secondary/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
          ticketsOpen > 0
            ? "border-warning/30 text-warning"
            : "border-border text-muted-foreground",
        )}
      >
        <span className="flex items-center gap-1.5 text-[10px] font-medium">
          <Ticket className="h-3.5 w-3.5 shrink-0" />
          Tickets
        </span>
        <span className="text-xs font-semibold tabular-nums">
          <span className={ticketsOpen > 0 ? "text-warning" : "text-foreground"}>
            {ticketsOpen} ouvert{ticketsOpen > 1 ? "s" : ""}
          </span>
          <span className="mx-1 text-muted-foreground">·</span>
          <span className="text-muted-foreground">
            {ticketsClosed} fermé{ticketsClosed > 1 ? "s" : ""}
          </span>
        </span>
      </button>
    </div>
  );
}

function Badge({
  icon,
  label,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  tone: "success" | "danger" | "warning" | "neutral" | "maintenance";
}) {
  const toneCls = {
    success: "bg-success/10 text-success",
    danger: "bg-danger/10 text-danger",
    warning: "bg-warning/15 text-warning",
    maintenance: "bg-maintenance/10 text-maintenance",
    neutral: "bg-secondary text-secondary-foreground",
  }[tone];

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md px-2 py-0.5 font-medium",
        toneCls,
      )}
    >
      {icon}
      {label}
    </span>
  );
}

function Counter({
  icon,
  inProgress,
  done,
  label,
  tone,
  onClick,
}: {
  icon: React.ReactNode;
  inProgress: number;
  done: number;
  label: string;
  tone: "danger" | "warning" | "improve";
  onClick: () => void;
}) {
  const active = inProgress > 0;

  const toneCls = active
    ? {
        danger: "border-danger/30 hover:bg-danger/10",
        warning: "border-warning/30 hover:bg-warning/10",
        improve: "border-improve/30 hover:bg-improve/10",
      }[tone]
    : "border-border hover:border-primary/30 hover:bg-secondary/80";

  const inProgressCls = active
    ? {
        danger: "text-danger",
        warning: "text-warning",
        improve: "text-improve",
      }[tone]
    : "text-foreground";

  const labelCls = active
    ? {
        danger: "text-danger",
        warning: "text-warning",
        improve: "text-improve",
      }[tone]
    : "text-muted-foreground";

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className={cn(
        "flex min-h-[4.25rem] w-full flex-col items-stretch justify-center gap-1 rounded-lg border bg-background/50 px-1.5 py-2 text-center transition",
        "hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
        toneCls,
      )}
    >
      <div
        className={cn(
          "flex items-center justify-center gap-1 text-[10px] font-medium leading-none",
          labelCls,
        )}
      >
        {icon}
        <span className="truncate">{label}</span>
      </div>

      <div className="space-y-0.5 text-[10px] leading-tight tabular-nums">
        <div className={cn("font-semibold", inProgressCls)}>
          {inProgress} en cours
        </div>
        <div className="font-medium text-muted-foreground">
          {done} terminé{done > 1 ? "s" : ""}
        </div>
      </div>
    </button>
  );
}

function systemCheckLabel(s: Machine["asdStatus"]) {
  return s === "valid" ? "valide" : "non valide";
}

function systemCheckTone(
  s: Machine["asdStatus"],
): "success" | "danger" | "warning" | "neutral" {
  return s === "valid" ? "success" : "danger";
}

function asdLabel(s: Machine["asdStatus"]) {
  switch (s) {
    case "valid":
      return "fonctionnel";
    case "non_functional":
      return "non fonctionnel";
    case "fail_low_volume":
      return "low volume failed";
    case "fail_precision":
      return "precision failed";
    case "pending":
      return "à faire";
    default:
      return s;
  }
}

function asdTone(
  s: Machine["asdStatus"],
): "success" | "danger" | "warning" | "neutral" {
  switch (s) {
    case "valid":
      return "success";
    case "non_functional":
      return "danger";
    case "fail_low_volume":
    case "fail_precision":
    case "pending":
      return "warning";
    default:
      return "neutral";
  }
}
