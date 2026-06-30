import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Activity,
  AlertTriangle,
  Flag,
  FlaskConical,
  Lightbulb,
  Loader2,
  Microchip,
  Moon,
  Search,
  Sun,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { MachineCard } from "@/components/MachineCard";
import { EditMachineDialog } from "@/components/EditMachineDialog";
import { API_CONFIGURED, fetchMachines, updateMachine } from "@/lib/api";
import type { Machine } from "@/lib/types";
import { machineKind } from "@/lib/types";
import { useTheme } from "@/lib/theme";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Status Machines — DXI 9000 & ACCESS" },
      {
        name: "description",
        content:
          "Suivi et maintenance des machines DXI 9000 (MP) et ACCESS : status, PM, ASD, problèmes et améliorations.",
      },
      { property: "og:title", content: "Status Machines — DXI 9000 & ACCESS" },
      {
        property: "og:description",
        content: "Suivi et maintenance des machines DXI 9000 et ACCESS.",
      },
    ],
  }),
  component: HomePage,
});

type Filter =
  | "all"
  | "mp"
  | "access"
  | "ok"
  | "maintenance"
  | "danger"
  | "flags"
  | "improve"
  | "asd-pending";

function HomePage() {
  const { theme, toggle } = useTheme();
  const qc = useQueryClient();
  const { data: machines = [], isLoading, error } = useQuery({
    queryKey: ["machines"],
    queryFn: fetchMachines,
  });

  const mutation = useMutation({
    mutationFn: updateMachine,
    onSuccess: (updated) => {
      qc.setQueryData<Machine[]>(["machines"], (prev) =>
        prev?.map((m) => (m.id === updated.id ? updated : m)) ?? prev,
      );
      toast.success("Machine mise à jour");
    },
    onError: (e) => toast.error(`Échec de la sauvegarde : ${(e as Error).message}`),
  });

  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<Machine | null>(null);

  const stats = useMemo(() => {
    const pending = (it: { completed: boolean }[]) => it.some((x) => !x.completed);
    return {
      total: machines.length,
      mp: machines.filter((m) => machineKind(m) === "MP").length,
      access: machines.filter((m) => machineKind(m) === "ACCESS").length,
      ok: machines.filter((m) => m.status === "ok").length,
      maintenance: machines.filter((m) => m.status === "maintenance").length,
      danger: machines.filter((m) => m.status === "danger").length,
      flags: machines.filter((m) => pending(m.flags)).length,
      improve: machines.filter((m) => pending(m.improvements)).length,
      asdPending: machines.filter((m) => m.asdStatus !== "valid").length,
    };
  }, [machines]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return machines.filter((m) => {
      if (q && !m.name.toLowerCase().includes(q) && !m.localisation.toLowerCase().includes(q))
        return false;
      switch (filter) {
        case "mp": return machineKind(m) === "MP";
        case "access": return machineKind(m) === "ACCESS";
        case "ok":
        case "maintenance":
        case "danger":
          return m.status === filter;
        case "flags":
          return m.flags.some((f) => !f.completed);
        case "improve":
          return m.improvements.some((f) => !f.completed);
        case "asd-pending":
          return m.asdStatus !== "valid";
        default:
          return true;
      }
    });
  }, [machines, filter, query]);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-20 border-b bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Activity className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-base font-semibold tracking-tight">Status Machines</h1>
              <p className="text-xs text-muted-foreground">DXI 9000 (MP) & ACCESS</p>
            </div>
          </div>

          <div className="hidden flex-1 max-w-md md:block">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Rechercher une machine…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            {!API_CONFIGURED && (
              <span className="hidden rounded-md border border-warning/40 bg-warning/10 px-2 py-1 text-[11px] font-medium text-warning sm:inline">
                Mode démo — VITE_API_URL non défini
              </span>
            )}
            <Button variant="outline" size="icon" onClick={toggle} aria-label="Thème">
              {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-8">

        {/* Filters */}
        <section className="mt-6 flex flex-wrap items-center gap-2">
          <Chip active={filter === "all"} onClick={() => setFilter("all")}>Toutes ({stats.total})</Chip>
          <Chip active={filter === "mp"} onClick={() => setFilter("mp")} tone="mp">
            <Microchip className="h-3.5 w-3.5" /> MP ({stats.mp})
          </Chip>
          <Chip active={filter === "access"} onClick={() => setFilter("access")} tone="access">
            <FlaskConical className="h-3.5 w-3.5" /> ACCESS ({stats.access})
          </Chip>
          <span className="mx-1 h-5 w-px bg-border" />
          <Chip active={filter === "ok"} onClick={() => setFilter("ok")} tone="success">OK ({stats.ok})</Chip>
          <Chip active={filter === "maintenance"} onClick={() => setFilter("maintenance")} tone="maintenance">
            Maintenance ({stats.maintenance})
          </Chip>
          <Chip active={filter === "danger"} onClick={() => setFilter("danger")} tone="danger">
            Problèmes ({stats.danger})
          </Chip>
          <span className="mx-1 h-5 w-px bg-border" />
          <Chip active={filter === "flags"} onClick={() => setFilter("flags")} tone="warning">
            <Flag className="h-3.5 w-3.5" /> Flags ({stats.flags})
          </Chip>
          <Chip active={filter === "improve"} onClick={() => setFilter("improve")} tone="improve">
            <Lightbulb className="h-3.5 w-3.5" /> Improv. ({stats.improve})
          </Chip>
          <Chip active={filter === "asd-pending"} onClick={() => setFilter("asd-pending")} tone="warning">
            <AlertTriangle className="h-3.5 w-3.5" /> ASD à faire ({stats.asdPending})
          </Chip>
        </section>

        {/* Mobile search */}
        <div className="mt-4 md:hidden">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Rechercher…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>

        {/* Grid */}
        <section className="mt-6">
          {isLoading ? (
            <div className="flex items-center justify-center py-24 text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Chargement…
            </div>
          ) : error ? (
            <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-6 text-sm text-destructive">
              Erreur de chargement : {(error as Error).message}
            </div>
          ) : filtered.length === 0 ? (
            <div className="rounded-xl border border-dashed py-16 text-center text-sm text-muted-foreground">
              Aucune machine ne correspond.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {filtered.map((m) => (
                <MachineCard key={m.id} machine={m} onEdit={() => setEditing(m)} />
              ))}
            </div>
          )}
        </section>

        <footer className="mt-12 text-center text-xs text-muted-foreground">
          {filtered.length} / {stats.total} machines affichées
        </footer>
      </main>

      <EditMachineDialog
        machine={editing}
        open={!!editing}
        onOpenChange={(o) => !o && setEditing(null)}
        onSave={async (m) => {
          await mutation.mutateAsync(m);
        }}
      />
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
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition",
        active ? activeCls : "border-border bg-card hover:bg-secondary",
      )}
    >
      {children}
    </button>
  );
}
