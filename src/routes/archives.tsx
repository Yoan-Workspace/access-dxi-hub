import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Archive, ArrowLeft, Loader2, MapPin, Search } from "lucide-react";
import { fetchRetiredMachine, fetchRetiredMachines } from "@/lib/api";
import { MachineArchivesPanel } from "@/components/MachineArchivesPanel";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { machineKind } from "@/lib/types";

export const Route = createFileRoute("/archives")({
  component: RetiredMachinesPage,
});

function fmtDate(iso?: string) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("fr-FR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function RetiredMachinesPage() {
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const listQuery = useQuery({
    queryKey: ["retired-machines"],
    queryFn: fetchRetiredMachines,
  });

  const detailQuery = useQuery({
    queryKey: ["retired-machines", selectedId],
    queryFn: () => fetchRetiredMachine(Number(selectedId)),
    enabled: selectedId != null,
  });

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = listQuery.data ?? [];
    if (!q) return list;
    return list.filter((machine) =>
      [machine.name, machine.localisation, machine.retiredBy, String(machine.serialNumber ?? "")]
        .join(" ")
        .toLowerCase()
        .includes(q),
    );
  }, [listQuery.data, query]);

  const snapshot = detailQuery.data;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card/80 px-4 py-4 lg:px-6">
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="outline" size="sm" asChild>
            <Link to="/">
              <ArrowLeft className="h-4 w-4" />
              Tableau de bord
            </Link>
          </Button>
          <div>
            <h1 className="flex items-center gap-2 text-lg font-semibold">
              <Archive className="h-5 w-5 text-muted-foreground" />
              Archives machines
            </h1>
            <p className="text-xs text-muted-foreground">
              Machines remplacées, conservées avec leur historique.
            </p>
          </div>
          <div className="relative ml-auto w-full max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Rechercher une machine archivée…"
              className="pl-9"
            />
          </div>
        </div>
      </header>

      <main className="grid gap-6 px-4 py-6 lg:grid-cols-[20rem_1fr] lg:px-6">
        <section className="space-y-3">
          {listQuery.isLoading ? (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Chargement…
            </p>
          ) : filtered.length === 0 ? (
            <div className="rounded-2xl border border-dashed px-4 py-10 text-center text-sm text-muted-foreground">
              Aucune machine archivée pour l’instant.
            </div>
          ) : (
            filtered.map((machine) => (
              <button
                key={machine.id}
                type="button"
                onClick={() => setSelectedId(machine.id)}
                className={cn(
                  "w-full rounded-2xl border bg-card p-4 text-left transition hover:border-primary/40",
                  selectedId === machine.id && "border-primary ring-1 ring-primary/30",
                )}
              >
                <div className="text-sm font-semibold">{machine.name}</div>
                <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="h-3 w-3" />
                    {machine.localisation || "—"}
                  </span>
                  <span>{fmtDate(machine.retiredAt)}</span>
                </div>
                <div className="mt-2 text-[11px] text-muted-foreground">
                  {machine.archiveCount} archive{machine.archiveCount > 1 ? "s" : ""}
                  {machine.retiredBy ? ` · ${machine.retiredBy}` : ""}
                </div>
              </button>
            ))
          )}
        </section>

        <section>
          {!selectedId ? (
            <div className="rounded-2xl border border-dashed px-6 py-16 text-center text-sm text-muted-foreground">
              Sélectionnez une machine pour consulter son historique.
            </div>
          ) : detailQuery.isLoading ? (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Chargement du dossier…
            </p>
          ) : !snapshot ? (
            <p className="text-sm text-destructive">Dossier introuvable.</p>
          ) : (
            <div className="space-y-5">
              <div className="rounded-2xl border bg-card p-5">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {machineKind(snapshot.machine) === "MP" ? "DXI 9000" : "Access 2"}
                </div>
                <h2 className="mt-1 text-xl font-semibold">{snapshot.name}</h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  Archivée le {fmtDate(snapshot.retiredAt)}
                  {snapshot.retiredBy ? ` par ${snapshot.retiredBy}` : ""}.
                </p>
                <dl className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
                  <div>
                    <dt className="text-xs text-muted-foreground">Localisation</dt>
                    <dd>{snapshot.localisation || "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">N° de série</dt>
                    <dd>{snapshot.serialNumber ?? snapshot.machine.serialNumber ?? "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">Software</dt>
                    <dd>{snapshot.machine.sw || "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">Dernière intervention</dt>
                    <dd>{fmtDate(snapshot.machine.lastDate)}</dd>
                  </div>
                </dl>
              </div>

              <MachineArchivesPanel
                machine={{
                  ...snapshot.machine,
                  flags: [
                    ...(snapshot.machine.flags ?? []).map((item) =>
                      item.archived ? item : { ...item, archived: true, archivedAt: snapshot.retiredAt },
                    ),
                    ...(snapshot.archives?.flags ?? []),
                  ],
                  problems: [
                    ...(snapshot.machine.problems ?? []).map((item) =>
                      item.archived ? item : { ...item, archived: true, archivedAt: snapshot.retiredAt },
                    ),
                    ...(snapshot.archives?.problems ?? []),
                  ],
                  repairs: [
                    ...(snapshot.machine.repairs ?? []).map((item) =>
                      item.archived ? item : { ...item, archived: true, archivedAt: snapshot.retiredAt },
                    ),
                    ...(snapshot.archives?.repairs ?? []),
                  ],
                  improvements: [
                    ...(snapshot.machine.improvements ?? []).map((item) =>
                      item.archived ? item : { ...item, archived: true, archivedAt: snapshot.retiredAt },
                    ),
                    ...(snapshot.archives?.improvements ?? []),
                  ],
                }}
                tickets={snapshot.tickets ?? snapshot.archives?.tickets ?? []}
                canDelete={false}
                onDelete={() => undefined}
              />
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
