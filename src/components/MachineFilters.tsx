import { useState } from "react";
import {
  AlertCircle,
  Calendar,
  ChevronDown,
  Flag,
  FlaskConical,
  Lightbulb,
  Microchip,
  RotateCcw,
  SlidersHorizontal,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";

export type TypeFilter = "all" | "mp" | "access";
export type StatusFilter = "all" | "ok" | "maintenance" | "danger";
export type PmFilter = "all" | "pm-overdue" | "pm-current" | "pm-next";
export type TrackFilter = "all" | "flags" | "improve" | "asd-pending";

export interface MachineFiltersState {
  type: TypeFilter;
  status: StatusFilter;
  pm: PmFilter;
  track: TrackFilter;
}

export const defaultFilters: MachineFiltersState = {
  type: "all",
  status: "all",
  pm: "all",
  track: "all",
};

export interface FilterStats {
  total: number;
  mp: number;
  access: number;
  ok: number;
  maintenance: number;
  danger: number;
  flags: number;
  improve: number;
  asdPending: number;
  pmCurrent: number;
  pmNext: number;
  pmOverdue: number;
  activeProblems: number;
}

export function hasActiveFilters(filters: MachineFiltersState) {
  return (
    filters.type !== "all" ||
    filters.status !== "all" ||
    filters.pm !== "all" ||
    filters.track !== "all"
  );
}

interface Props {
  filters: MachineFiltersState;
  stats: FilterStats;
  onChange: (filters: MachineFiltersState) => void;
  onReset: () => void;
}

type GroupId = "type" | "status" | "pm" | "track";

const groupLabels: Record<GroupId, string> = {
  type: "Type",
  status: "État",
  pm: "PM",
  track: "Suivi",
};

function activeLabel(filters: MachineFiltersState, group: GroupId): string | null {
  switch (group) {
    case "type":
      if (filters.type === "mp") return "DXI 9000";
      if (filters.type === "access") return "Access 2";
      return null;
    case "status":
      if (filters.status === "ok") return "OK";
      if (filters.status === "maintenance") return "Maint.";
      if (filters.status === "danger") return "Problèmes";
      return null;
    case "pm":
      if (filters.pm === "pm-overdue") return "Retard";
      if (filters.pm === "pm-current") return "Ce mois";
      if (filters.pm === "pm-next") return "Suivant";
      return null;
    case "track":
      if (filters.track === "flags") return "Flags";
      if (filters.track === "improve") return "Improv.";
      if (filters.track === "asd-pending") return "ASD";
      return null;
  }
}

function groupAlert(stats: FilterStats, group: GroupId): boolean {
  switch (group) {
    case "type":
      return false;
    case "status":
      return stats.danger > 0 || stats.maintenance > 0 || stats.activeProblems > 0;
    case "pm":
      return stats.pmOverdue > 0 || stats.pmCurrent > 0;
    case "track":
      return stats.flags > 0 || stats.improve > 0 || stats.asdPending > 0;
  }
}

export function MachineFilters({ filters, stats, onChange, onReset }: Props) {
  const [openGroup, setOpenGroup] = useState<GroupId | null>(null);

  const set = <K extends keyof MachineFiltersState>(key: K, value: MachineFiltersState[K]) =>
    onChange({ ...filters, [key]: value });

  const groups: GroupId[] = ["type", "status", "pm", "track"];

  return (
    <section className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className="mr-1 hidden items-center gap-1 text-[11px] font-medium uppercase tracking-wider text-muted-foreground sm:inline-flex">
          <SlidersHorizontal className="h-3.5 w-3.5" />
          Filtres
        </span>

        {groups.map((group) => (
          <FilterBanner
            key={group}
            id={group}
            label={groupLabels[group]}
            activeLabel={activeLabel(filters, group)}
            alert={groupAlert(stats, group)}
            open={openGroup === group}
            onOpen={() => setOpenGroup(group)}
            onClose={() => setOpenGroup((g) => (g === group ? null : g))}
          >
            {group === "type" && (
              <>
                <Chip active={filters.type === "all"} onClick={() => set("type", "all")}>
                  Toutes ({stats.total})
                </Chip>
                <Chip active={filters.type === "mp"} onClick={() => set("type", "mp")} tone="mp">
                  <Microchip className="h-3 w-3" /> DXI 9000 ({stats.mp})
                </Chip>
                <Chip
                  active={filters.type === "access"}
                  onClick={() => set("type", "access")}
                  tone="access"
                >
                  <FlaskConical className="h-3 w-3" /> Access 2 ({stats.access})
                </Chip>
              </>
            )}

            {group === "status" && (
              <>
                <Chip active={filters.status === "all"} onClick={() => set("status", "all")}>
                  Tous
                </Chip>
                <Chip
                  active={filters.status === "ok"}
                  onClick={() => set("status", "ok")}
                  tone="success"
                >
                  OK ({stats.ok})
                </Chip>
                <Chip
                  active={filters.status === "maintenance"}
                  onClick={() => set("status", "maintenance")}
                  tone="maintenance"
                >
                  Maintenance ({stats.maintenance})
                </Chip>
                <Chip
                  active={filters.status === "danger"}
                  onClick={() => set("status", "danger")}
                  tone="danger"
                >
                  Problèmes ({stats.danger})
                </Chip>
              </>
            )}

            {group === "pm" && (
              <>
                <Chip active={filters.pm === "all"} onClick={() => set("pm", "all")}>
                  Toutes
                </Chip>
                <Chip
                  active={filters.pm === "pm-overdue"}
                  onClick={() => set("pm", "pm-overdue")}
                  tone="danger"
                >
                  En retard ({stats.pmOverdue})
                </Chip>
                <Chip
                  active={filters.pm === "pm-current"}
                  onClick={() => set("pm", "pm-current")}
                  tone="maintenance"
                >
                  Ce mois ({stats.pmCurrent})
                </Chip>
                <Chip
                  active={filters.pm === "pm-next"}
                  onClick={() => set("pm", "pm-next")}
                  tone="warning"
                >
                  Mois suivant ({stats.pmNext})
                </Chip>
              </>
            )}

            {group === "track" && (
              <>
                <Chip active={filters.track === "all"} onClick={() => set("track", "all")}>
                  Tous
                </Chip>
                <Chip
                  active={filters.track === "flags"}
                  onClick={() => set("track", "flags")}
                  tone="warning"
                >
                  <Flag className="h-3 w-3" /> Flags ({stats.flags})
                </Chip>
                <Chip
                  active={filters.track === "improve"}
                  onClick={() => set("track", "improve")}
                  tone="improve"
                >
                  <Lightbulb className="h-3 w-3" /> Improv. ({stats.improve})
                </Chip>
                <Chip
                  active={filters.track === "asd-pending"}
                  onClick={() => set("track", "asd-pending")}
                  tone="warning"
                >
                  ASD ({stats.asdPending})
                </Chip>
              </>
            )}
          </FilterBanner>
        ))}

        {hasActiveFilters(filters) && (
          <button
            type="button"
            onClick={onReset}
            className="inline-flex h-8 items-center gap-1 rounded-lg px-2 text-xs font-medium text-muted-foreground transition hover:bg-secondary hover:text-foreground"
          >
            <RotateCcw className="h-3 w-3" />
            Effacer
          </button>
        )}
      </div>

      {hasActiveFilters(filters) && (
        <div className="flex flex-wrap items-center gap-1.5">
          {groups.map((group) => {
            const label = activeLabel(filters, group);
            if (!label) return null;
            const key = group === "type" ? "type" : group === "status" ? "status" : group === "pm" ? "pm" : "track";
            return (
              <button
                key={group}
                type="button"
                onClick={() => set(key, "all")}
                className="inline-flex items-center gap-1 rounded-full border bg-card px-2 py-0.5 text-[11px] font-medium"
              >
                {groupLabels[group]}: {label}
                <X className="h-2.5 w-2.5 text-muted-foreground" />
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}

function FilterBanner({
  id,
  label,
  activeLabel,
  alert,
  open,
  onOpen,
  onClose,
  children,
}: {
  id: GroupId;
  label: string;
  activeLabel: string | null;
  alert: boolean;
  open: boolean;
  onOpen: () => void;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const icons: Record<GroupId, React.ReactNode> = {
    type: <Microchip className="h-3.5 w-3.5" />,
    status: <AlertCircle className="h-3.5 w-3.5" />,
    pm: <Calendar className="h-3.5 w-3.5" />,
    track: <Flag className="h-3.5 w-3.5" />,
  };

  return (
    <div
      className="relative"
      onMouseEnter={onOpen}
      onMouseLeave={onClose}
    >
      <button
        type="button"
        onClick={() => (open ? onClose() : onOpen())}
        className={cn(
          "inline-flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-xs font-medium transition",
          open || activeLabel
            ? "border-primary/40 bg-primary/5 text-foreground"
            : "border-border bg-card text-muted-foreground hover:border-primary/30 hover:bg-secondary hover:text-foreground",
        )}
      >
        <span className="text-muted-foreground">{icons[id]}</span>
        <span>{label}</span>
        {activeLabel && (
          <span className="rounded bg-primary/15 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
            {activeLabel}
          </span>
        )}
        {alert && (
          <AlertCircle className="h-3.5 w-3.5 shrink-0 text-danger" aria-label="Attention requise" />
        )}
        <ChevronDown
          className={cn("h-3 w-3 text-muted-foreground transition", open && "rotate-180")}
        />
      </button>

      <div
        className={cn(
          "absolute left-0 top-[calc(100%+4px)] z-30 min-w-[220px] rounded-xl border bg-popover p-2 shadow-lg transition-all",
          open
            ? "pointer-events-auto visible translate-y-0 opacity-100"
            : "pointer-events-none invisible -translate-y-1 opacity-0",
        )}
      >
        <div className="flex flex-wrap gap-1.5">{children}</div>
      </div>
    </div>
  );
}

function Chip({
  active,
  onClick,
  children,
  tone = "neutral",
}: {
  active?: boolean;
  onClick: () => void;
  children: React.ReactNode;
  tone?: "neutral" | "mp" | "access" | "success" | "danger" | "maintenance" | "warning" | "improve";
}) {
  const activeCls = {
    neutral: "bg-foreground text-background border-foreground",
    mp: "bg-mp text-white border-mp",
    access: "bg-access text-white border-access",
    success: "bg-success text-white border-success",
    danger: "bg-danger text-white border-danger",
    maintenance: "bg-maintenance text-white border-maintenance",
    warning: "bg-warning text-white border-warning",
    improve: "bg-improve text-white border-improve",
  }[tone];

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-medium transition",
        active ? activeCls : "border-border bg-background hover:bg-secondary",
      )}
    >
      {children}
    </button>
  );
}
