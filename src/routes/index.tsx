import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Activity,
  Loader2,
  Moon,
  Plus,
  Search,
  Sun,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { MachineCard } from "@/components/MachineCard";
import { EditMachineDialog, type EditMachineTab } from "@/components/EditMachineDialog";
import { AddMachineDialog } from "@/components/AddMachineDialog";
import {
  defaultFilters,
  MachineFilters,
  type MachineFiltersState,
} from "@/components/MachineFilters";
import {
  API_CONFIGURED,
  createMachine,
  deleteMachine,
  fetchMachines,
  updateMachine,
} from "@/lib/api";
import type { Machine } from "@/lib/types";
import { machineKind } from "@/lib/types";
import { useTheme } from "@/lib/theme";
import { toast } from "sonner";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Status Machines — DXI 9000 & ACCESS" },
      {
        name: "description",
        content:
          "Suivi et maintenance des machines DXI 9000 (Falcon / MP) et Access 2 : status, PM, ASD, problèmes et améliorations.",
      },
      { property: "og:title", content: "Status Machines — DXI 9000 & ACCESS" },
      {
        property: "og:description",
        content: "Suivi et maintenance des machines DXI 9000 et Access 2.",
      },
    ],
  }),
  component: HomePage,
});

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
  const nextPmDate = new Date(lastPmDate);
  nextPmDate.setMonth(nextPmDate.getMonth() + 6);

  return {
    dueDate: nextPmDate,
    nextType: machine.pmRef.period === 6 ? 12 : 6,
  };
}

function matchesPmFilter(machine: Machine, pm: MachineFiltersState["pm"]) {
  if (pm === "all") return true;

  const { dueDate } = getNextPm(machine);
  const now = new Date();
  const nextMonth = new Date();
  nextMonth.setMonth(nextMonth.getMonth() + 1);
  const currentMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  switch (pm) {
    case "pm-current":
      return (
        dueDate.getMonth() === now.getMonth() &&
        dueDate.getFullYear() === now.getFullYear()
      );
    case "pm-next":
      return (
        dueDate.getMonth() === nextMonth.getMonth() &&
        dueDate.getFullYear() === nextMonth.getFullYear()
      );
    case "pm-overdue":
      return dueDate < currentMonth;
    default:
      return true;
  }
}

function HomePage() {
  const { theme, toggle } = useTheme();
  const qc = useQueryClient();
  const { data: machines = [], isLoading, error } = useQuery({
    queryKey: ["machines"],
    queryFn: fetchMachines,
  });

  useEffect(() => {
    if (!API_CONFIGURED) return;

    const apiBase = import.meta.env.VITE_API_URL?.replace(/\/$/, "");
    if (!apiBase) return;

    const source = new EventSource(`${apiBase}/api/events`);
    source.onmessage = () => {
      toast.info("Base de données mise à jour");
      void qc.invalidateQueries({ queryKey: ["machines"] });
    };

    return () => source.close();
  }, [qc]);

  const updateMutation = useMutation({
    mutationFn: updateMachine,
    onSuccess: (updated) => {
      qc.setQueryData<Machine[]>(["machines"], (prev) =>
        prev?.map((m) => (m.id === updated.id ? updated : m)) ?? prev,
      );
      toast.success("Machine mise à jour");
    },
    onError: (e) => toast.error(`Échec de la sauvegarde : ${(e as Error).message}`),
  });

  const createMutation = useMutation({
    mutationFn: createMachine,
    onSuccess: (created) => {
      qc.setQueryData<Machine[]>(["machines"], (prev) =>
        prev ? [...prev, created] : [created],
      );
      toast.success(`Machine ${created.name} créée`);
    },
    onError: (e) => toast.error(`Échec de la création : ${(e as Error).message}`),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteMachine,
    onSuccess: (_data, id) => {
      qc.setQueryData<Machine[]>(["machines"], (prev) =>
        prev?.filter((m) => m.id !== id) ?? prev,
      );
      setEditing(null);
      toast.success("Machine supprimée");
    },
    onError: (e) => toast.error(`Échec de la suppression : ${(e as Error).message}`),
  });

  const [filters, setFilters] = useState<MachineFiltersState>(defaultFilters);
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<Machine | null>(null);
  const [editTab, setEditTab] = useState<EditMachineTab>("general");
  const [adding, setAdding] = useState(false);

  const openEdit = (machine: Machine, tab: EditMachineTab = "general") => {
    setEditing(machine);
    setEditTab(tab);
  };

  const stats = useMemo(() => {
    const now = new Date();
    const nextMonth = new Date();
    nextMonth.setMonth(nextMonth.getMonth() + 1);
    const pending = (items: { completed: boolean }[]) =>
      items.some((x) => !x.completed);

    return {
      total: machines.length,
      mp: machines.filter((m) => machineKind(m) === "MP").length,
      access: machines.filter((m) => machineKind(m) === "ACCESS").length,
      ok: machines.filter((m) => m.status === "ok").length,
      maintenance: machines.filter((m) => m.status === "maintenance").length,
      danger: machines.filter((m) => m.status === "danger").length,
      activeProblems: machines.filter((m) => m.problems.some((p) => !p.completed)).length,
      flags: machines.filter((m) => pending(m.flags)).length,
      improve: machines.filter((m) => pending(m.improvements)).length,
      asdPending: machines.filter((m) => m.asdStatus !== "valid").length,
      pmCurrent: machines.filter((m) => matchesPmFilter(m, "pm-current")).length,
      pmNext: machines.filter((m) => matchesPmFilter(m, "pm-next")).length,
      pmOverdue: machines.filter((m) => matchesPmFilter(m, "pm-overdue")).length,
    };
  }, [machines]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();

    return machines.filter((m) => {
      if (
        q &&
        !m.name.toLowerCase().includes(q) &&
        !m.localisation.toLowerCase().includes(q)
      ) {
        return false;
      }

      if (filters.type === "mp" && machineKind(m) !== "MP") return false;
      if (filters.type === "access" && machineKind(m) !== "ACCESS") return false;
      if (filters.status !== "all" && m.status !== filters.status) return false;
      if (!matchesPmFilter(m, filters.pm)) return false;

      if (filters.track === "flags" && !m.flags.some((f) => !f.completed)) return false;
      if (filters.track === "improve" && !m.improvements.some((f) => !f.completed)) {
        return false;
      }
      if (filters.track === "asd-pending" && m.asdStatus === "valid") return false;

      return true;
    });
  }, [machines, filters, query]);

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-20 border-b bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Activity className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-base font-semibold tracking-tight">Status Machines</h1>
              <p className="text-xs text-muted-foreground">
                DXI 9000 (Falcon / MP) & Access 2
              </p>
            </div>
          </div>

          <div className="hidden flex-1 max-w-md md:block">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Rechercher par nom ou localisation…"
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
            <Button
              onClick={() => setAdding(true)}
              disabled={!API_CONFIGURED}
              title={
                API_CONFIGURED
                  ? "Ajouter une machine"
                  : "Configurez VITE_API_URL pour ajouter une machine"
              }
            >
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">Nouvelle machine</span>
            </Button>
            <Button variant="outline" size="icon" onClick={toggle} aria-label="Thème">
              {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-8">
        <MachineFilters
          filters={filters}
          stats={stats}
          onChange={setFilters}
          onReset={() => setFilters(defaultFilters)}
        />

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
              Aucune machine ne correspond aux critères sélectionnés.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {filtered.map((m) => (
                <MachineCard key={m.id} machine={m} onEdit={(tab) => openEdit(m, tab)} />
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
        initialTab={editTab}
        onOpenChange={(o) => {
          if (!o) {
            setEditing(null);
            setEditTab("general");
          }
        }}
        onSave={async (m) => {
          await updateMutation.mutateAsync(m);
        }}
        onDelete={
          API_CONFIGURED
            ? async (id) => {
                await deleteMutation.mutateAsync(id);
              }
            : undefined
        }
      />

      <AddMachineDialog
        open={adding}
        onOpenChange={setAdding}
        onCreate={async (machine) => {
          await createMutation.mutateAsync(machine);
        }}
      />
    </div>
  );
}
