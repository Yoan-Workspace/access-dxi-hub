import {
  AlertTriangle,
  CheckCircle2,
  Flag,
  Lightbulb,
  MapPin,
  Pencil,
  Wrench,
  XCircle,
  Calendar,
  Activity,
} from "lucide-react";
import type { Machine } from "@/lib/types";
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

function pendingCount(items: { completed: boolean }[]) {
  return items.filter((i) => !i.completed).length;
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

export function MachineCard({
  machine,
  onEdit,
}: {
  machine: Machine;
  onEdit: () => void;
}) {
  const kind = machineKind(machine);
  const s = statusMap[machine.status];

  const flagsP = pendingCount(machine.flags);
  const improvP = pendingCount(machine.improvements);
  const probsP = pendingCount(machine.problems);
  const repairsP = pendingCount(machine.repairs);

  return (
    <div
      onClick={() => {
        console.log("Carte cliquée :", machine.name);
        onEdit();
      }}
      className={cn(
        "group relative flex cursor-pointer flex-col gap-4 rounded-2xl border bg-card p-5",
        "transition-all duration-200",
        "hover:-translate-y-1",
        "hover:border-primary/40",
        "hover:shadow-[0_8px_30px_-12px_rgba(0,0,0,0.12)]"
      )}
    >
      <span
        className={cn(
          "absolute left-5 right-5 top-0 h-[3px] rounded-b-full",
          kind === "MP" ? "bg-mp" : "bg-access"
        )}
      />

      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span
              className={cn(
                "inline-flex h-5 items-center rounded-full px-2 text-[10px] font-semibold tracking-wider uppercase",
                kind === "MP"
                  ? "bg-mp/10 text-mp"
                  : "bg-access/10 text-access"
              )}
            >
              {kind === "MP" ? "DXI 9000" : "ACCESS"}
            </span>

            <span
              className={cn(
                "inline-flex items-center gap-1 text-xs",
                s.color
              )}
            >
              <span
                className={cn("h-1.5 w-1.5 rounded-full", s.ring)}
              />
              {s.label}
            </span>
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
          </div>
        </div>

        <button
          onClick={(e) => {
            e.stopPropagation();
            onEdit();
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
          label={`ADAM ${
            machine.adam === "fonctionnelle" ? "OK" : "KO"
          }`}
          tone={
            machine.adam === "fonctionnelle"
              ? "success"
              : "danger"
          }
        />

        <Badge
          icon={<CheckCircle2 className="h-3 w-3" />}
          label={`ASD ${asdLabel(machine.asdStatus)}`}
          tone={asdTone(machine.asdStatus)}
        />

        <Badge
          icon={<Wrench className="h-3 w-3" />}
          label={`Maint. mensuelle ${
            machine.monthlyMaint === "done" ? "✓" : "✗"
          }`}
          tone={
            machine.monthlyMaint === "done"
              ? "success"
              : "danger"
          }
        />

        <Badge
          icon={<Calendar className="h-3 w-3" />}
          label={`PM ${machine.pmRef.period}m · ${machine.pmRef.month} ${machine.pmRef.year}`}
          tone="neutral"
        />
      </div>

      <div className="grid grid-cols-4 gap-2">
        <Counter
          icon={<Flag className="h-3.5 w-3.5" />}
          pending={flagsP}
          total={machine.flags.length}
          label="Flags"
          tone="warning"
        />

        <Counter
          icon={<XCircle className="h-3.5 w-3.5" />}
          pending={probsP}
          total={machine.problems.length}
          label="Problèmes"
          tone="danger"
        />

        <Counter
          icon={<AlertTriangle className="h-3.5 w-3.5" />}
          pending={repairsP}
          total={machine.repairs.length}
          label="Réparations"
          tone="warning"
        />

        <Counter
          icon={<Lightbulb className="h-3.5 w-3.5" />}
          pending={improvP}
          total={machine.improvements.length}
          label="Improv."
          tone="improve"
        />
      </div>
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
        toneCls
      )}
    >
      {icon}
      {label}
    </span>
  );
}

function Counter({
  icon,
  pending,
  total,
  label,
  tone,
}: {
  icon: React.ReactNode;
  pending: number;
  total: number;
  label: string;
  tone: "danger" | "warning" | "improve";
}) {
  const active = pending > 0;

  const toneCls = active
    ? {
        danger: "text-danger",
        warning: "text-warning",
        improve: "text-improve",
      }[tone]
    : "text-muted-foreground";

  return (
    <div className="rounded-lg border bg-background/40 px-2 py-1.5">
      <div
        className={cn(
          "flex items-center gap-1 text-[11px] font-medium",
          toneCls
        )}
      >
        {icon}
        <span>{label}</span>
      </div>

      <div className="mt-0.5 text-sm font-semibold tabular-nums">
        <span
          className={cn(
            active ? toneCls : "text-foreground"
          )}
        >
          {pending}
        </span>
        <span className="text-muted-foreground">/{total}</span>
      </div>
    </div>
  );
}

function asdLabel(s: Machine["asdStatus"]) {
  switch (s) {
    case "valid":
      return "valide";
    case "pending":
      return "à faire";
    case "fail_precision":
      return "échec";
    default:
      return s;
  }
}

function asdTone(
  s: Machine["asdStatus"]
): "success" | "danger" | "warning" | "neutral" {
  switch (s) {
    case "valid":
      return "success";
    case "fail_precision":
      return "danger";
    case "pending":
      return "warning";
    default:
      return "neutral";
  }
}