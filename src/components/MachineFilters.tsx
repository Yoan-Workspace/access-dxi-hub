import {
  AlertTriangle,
  Flag,
  FlaskConical,
  Lightbulb,
  Microchip,
  RotateCcw,
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

export function MachineFilters({ filters, stats, onChange, onReset }: Props) {
  const set = <K extends keyof MachineFiltersState>(key: K, value: MachineFiltersState[K]) =>
    onChange({ ...filters, [key]: value });

  const activeTags = [
    filters.type !== "all" && {
      key: "type",
      label:
        filters.type === "mp"
          ? "DXI 9000 / Falcon"
          : "Access 2",
    },
    filters.status !== "all" && {
      key: "status",
      label:
        filters.status === "ok"
          ? "OK"
          : filters.status === "maintenance"
            ? "Maintenance"
            : "Problèmes",
    },
    filters.pm !== "all" && {
      key: "pm",
      label:
        filters.pm === "pm-overdue"
          ? "PM en retard"
          : filters.pm === "pm-current"
            ? "PM ce mois"
            : "PM mois suivant",
    },
    filters.track !== "all" && {
      key: "track",
      label:
        filters.track === "flags"
          ? "Flags"
          : filters.track === "improve"
            ? "Improvements"
            : "ASD à faire",
    },
  ].filter(Boolean) as { key: keyof MachineFiltersState; label: string }[];

  return (
    <section className="rounded-2xl border bg-card/60 p-4 shadow-sm">
      {activeTags.length > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-muted-foreground">Filtres actifs</span>
          {activeTags.map((tag) => (
            <button
              key={tag.key}
              type="button"
              onClick={() => set(tag.key, "all")}
              className="inline-flex items-center gap-1 rounded-full border bg-background px-2.5 py-1 text-xs font-medium transition hover:bg-secondary"
            >
              {tag.label}
              <X className="h-3 w-3 text-muted-foreground" />
            </button>
          ))}
          <button
            type="button"
            onClick={onReset}
            className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium text-primary transition hover:bg-primary/10"
          >
            <RotateCcw className="h-3 w-3" />
            Tout effacer
          </button>
        </div>
      )}

      <FilterGroup label="Type de machine">
        <Chip active={filters.type === "all"} onClick={() => set("type", "all")}>
          Toutes ({stats.total})
        </Chip>
        <Chip
          active={filters.type === "mp"}
          onClick={() => set("type", "mp")}
          tone="mp"
        >
          <Microchip className="h-3.5 w-3.5" />
          DXI 9000 / Falcon ({stats.mp})
        </Chip>
        <Chip
          active={filters.type === "access"}
          onClick={() => set("type", "access")}
          tone="access"
        >
          <FlaskConical className="h-3.5 w-3.5" />
          Access 2 ({stats.access})
        </Chip>
      </FilterGroup>

      <FilterGroup label="État">
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
      </FilterGroup>

      <FilterGroup label="Maintenance préventive">
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
      </FilterGroup>

      <FilterGroup label="Suivi" last>
        <Chip active={filters.track === "all"} onClick={() => set("track", "all")}>
          Tous
        </Chip>
        <Chip
          active={filters.track === "flags"}
          onClick={() => set("track", "flags")}
          tone="warning"
        >
          <Flag className="h-3.5 w-3.5" />
          Flags ({stats.flags})
        </Chip>
        <Chip
          active={filters.track === "improve"}
          onClick={() => set("track", "improve")}
          tone="improve"
        >
          <Lightbulb className="h-3.5 w-3.5" />
          Improvements ({stats.improve})
        </Chip>
        <Chip
          active={filters.track === "asd-pending"}
          onClick={() => set("track", "asd-pending")}
          tone="warning"
        >
          <AlertTriangle className="h-3.5 w-3.5" />
          ASD à faire ({stats.asdPending})
        </Chip>
      </FilterGroup>
    </section>
  );
}

function FilterGroup({
  label,
  children,
  last,
}: {
  label: string;
  children: React.ReactNode;
  last?: boolean;
}) {
  return (
    <div className={cn("flex flex-col gap-2 sm:flex-row sm:items-center", !last && "mb-3 pb-3 border-b border-border/60")}>
      <span className="w-full shrink-0 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground sm:w-36">
        {label}
      </span>
      <div className="flex flex-wrap gap-1.5">{children}</div>
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
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition",
        active ? activeCls : "border-border bg-background hover:bg-secondary",
      )}
    >
      {children}
    </button>
  );
}
