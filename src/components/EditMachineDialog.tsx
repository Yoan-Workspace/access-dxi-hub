import { useEffect, useState } from "react";
import { Plus, Trash2, Check } from "lucide-react";
import type { Machine, TodoItem } from "@/lib/types";
import { machineKind } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

export type EditMachineTab =
  | "general"
  | "flags"
  | "problems"
  | "repairs"
  | "improvements";

interface Props {
  machine: Machine | null;
  open: boolean;
  initialTab?: EditMachineTab;
  onOpenChange: (open: boolean) => void;
  onSave: (m: Machine) => Promise<void> | void;
  onDelete?: (id: number) => Promise<void> | void;
}

const months = [
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

function getNextPmInfo(pmRef: {
  period: number;
  month: string;
  year: number;
}) {
  const date = new Date(
    pmRef.year,
    monthMap[pmRef.month],
    1,
  );

  // Une PM est faite tous les 6 mois
  date.setMonth(date.getMonth() + 6);

  return {
    date,
    nextType: pmRef.period === 6 ? 12 : 6,
  };
}

export function EditMachineDialog({
  machine,
  open,
  initialTab = "general",
  onOpenChange,
  onSave,
  onDelete,
}: Props) {
  const [draft, setDraft] = useState<Machine | null>(machine);
  const [tab, setTab] = useState<EditMachineTab>(initialTab);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [lastDateEdited, setLastDateEdited] = useState(false);

  useEffect(() => {
    if (open && machine) {
      setDraft(structuredClone(machine));
      setTab(initialTab);
      setConfirmDelete(false);
      setLastDateEdited(false);
    } else if (!machine) {
      setDraft(null);
      setConfirmDelete(false);
      setLastDateEdited(false);
    }
  }, [machine, open, initialTab]);

  if (!draft) return null;

  const kind = machineKind(draft);
  const nextPm = draft.pmRef ? getNextPmInfo(draft.pmRef) : null;


  const set = <K extends keyof Machine>(k: K, v: Machine[K]) =>
    setDraft((d) => (d ? { ...d, [k]: v } : d));

  
const save = async () => {
  if (!draft) return;

  // La date de dernière intervention est mise à jour automatiquement à
  // l'enregistrement, sauf si elle a été renseignée manuellement.
  const payload = lastDateEdited
    ? draft
    : { ...draft, lastDate: new Date().toISOString().slice(0, 19) };

  setSaving(true);

  try {
    await onSave(payload);
  } finally {
    setSaving(false);
  }
};

const remove = async () => {
  if (!draft || !onDelete) return;

  setConfirmDelete(false);
  setDeleting(true);

  try {
    await onDelete(draft.id);
  } finally {
    setDeleting(false);
  }
};


  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-hidden p-0">
        <DialogHeader className="border-b px-6 py-4">
          <DialogTitle className="flex items-center gap-2 text-base">
            <span className="text-muted-foreground">Édition —</span>
            <span className="font-semibold">{draft.name}</span>
          </DialogTitle>
        </DialogHeader>

        <Tabs
          value={tab}
          onValueChange={(v) => setTab(v as EditMachineTab)}
          className="flex max-h-[70vh] flex-col"
        >
          <TabsList className="mx-6 mt-4 w-fit">
            <TabsTrigger value="general">Général</TabsTrigger>
            <TabsTrigger value="flags">Flags</TabsTrigger>
            <TabsTrigger value="problems">Problèmes</TabsTrigger>
            <TabsTrigger value="repairs">Réparations</TabsTrigger>
            <TabsTrigger value="improvements">Improvements</TabsTrigger>
          </TabsList>

          <div className="flex-1 overflow-y-auto px-6 pb-6 pt-4">
            <TabsContent value="general" className="mt-0 space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <Field label="Nom">
                  <Input value={draft.name} onChange={(e) => set("name", e.target.value)} />
                </Field>
                <Field label="Localisation">
                  <Input
                    value={draft.localisation}
                    onChange={(e) => set("localisation", e.target.value)}
                  />
                </Field>
                <Field label="Version SW">
                  <Input value={draft.sw} onChange={(e) => set("sw", e.target.value)} />
                </Field>
                <Field label="Dernière intervention">
                  <Input
                    type="datetime-local"
                    value={toLocalInput(draft.lastDate)}
                    onChange={(e) => {
                      setLastDateEdited(true);
                      set("lastDate", new Date(e.target.value).toISOString().slice(0, 19));
                    }}
                  />
                  <p className="text-[11px] text-muted-foreground">
                    {lastDateEdited
                      ? "Date renseignée manuellement."
                      : "Mise à jour automatiquement à l'enregistrement."}
                  </p>
                </Field>

                <Field label="Status">
                  <Select
                    value={draft.status}
                    onValueChange={(v) => set("status", v as Machine["status"])}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ok">OK</SelectItem>
                      <SelectItem value="maintenance">Maintenance</SelectItem>
                      <SelectItem value="danger">Problème</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="ADAM">
                  <Select
                    value={draft.adam}
                    onValueChange={(v) => set("adam", v as Machine["adam"])}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="fonctionnelle">Fonctionnelle</SelectItem>
                      <SelectItem value="non_fonctionnelle">Non fonctionnelle</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                {kind === "ACCESS" ? (
                  <Field label="System Check">
                    <Select
                      value={draft.asdStatus === "valid" ? "valid" : "invalid"}
                      onValueChange={(v) => {
                        set("asdStatus", v as Machine["asdStatus"]);
                        set("asdLabel", "System Check");
                      }}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="valid">Valide</SelectItem>
                        <SelectItem value="invalid">Non valide</SelectItem>
                      </SelectContent>
                    </Select>
                  </Field>
                ) : (
                  <>
                    <Field label="ASD">
                      <Select
                        value={draft.asdStatus}
                        onValueChange={(v) => set("asdStatus", v as Machine["asdStatus"])}
                      >
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="valid">Fonctionnel</SelectItem>
                          <SelectItem value="non_functional">Non fonctionnel</SelectItem>
                          <SelectItem value="fail_low_volume">Low Volume Failed</SelectItem>
                          <SelectItem value="fail_precision">
                            Precision pipettors Failed
                          </SelectItem>
                          {draft.asdStatus === "pending" && (
                            <SelectItem value="pending">À faire</SelectItem>
                          )}
                        </SelectContent>
                      </Select>
                    </Field>
                    <Field label="Maintenance mensuelle">
                      <Select
                        value={draft.monthlyMaint ?? "not_done"}
                        onValueChange={(v) => set("monthlyMaint", v as Machine["monthlyMaint"])}
                      >
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="done">Faite</SelectItem>
                          <SelectItem value="not_done">À faire</SelectItem>
                        </SelectContent>
                      </Select>
                    </Field>
                  </>
                )}
              </div>

              <div className="rounded-xl border bg-muted/40 p-4 space-y-4">
  <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
    Maintenance Préventive
  </div>

  <div className="grid grid-cols-2 gap-4">
    <div className="rounded-lg border bg-background p-3">
      <div className="text-xs text-muted-foreground">
        Dernière PM réalisée
      </div>

      {draft.pmRef ? (
  <>
    <div className="mt-2 font-medium">
      {draft.pmRef.month} {draft.pmRef.year}
    </div>

    <div className="mt-1 text-sm text-muted-foreground">
      PM {draft.pmRef.period} mois
    </div>
  </>
) : (
  <div className="mt-2 text-sm text-muted-foreground">
    Aucune PM enregistrée
  </div>
)}
    </div>

    <div className="rounded-lg border bg-background p-3">
      <div className="text-xs text-muted-foreground">
        Prochaine PM prévue
      </div>

      {nextPm ? (
  <>
    <div className="mt-2 font-medium">
      {months[nextPm.date.getMonth()]}{" "}
      {nextPm.date.getFullYear()}
    </div>

    <div className="mt-1 text-sm text-muted-foreground">
      PM {nextPm.nextType} mois
    </div>
  </>
) : (
  <div className="mt-2 text-sm text-muted-foreground">
    PM non planifiée
  </div>
)}
    </div>
  </div>

  <div className="grid grid-cols-3 gap-4">
    <Field label="Type de PM réalisée">
      <Select
        value={draft.pmRef ? String(draft.pmRef.period) : ""}
        onValueChange={(v) =>
          set("pmRef", {
            ...draft.pmRef,
            period: Number(v),
          })
        }
      >
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>

        <SelectContent>
          <SelectItem value="6">
            PM 6 mois
          </SelectItem>

          <SelectItem value="12">
            PM 12 mois
          </SelectItem>
        </SelectContent>
      </Select>
    </Field>

    <Field label="Mois réalisé">
      <Select
        value={draft.pmRef.month}
        onValueChange={(v) =>
          set("pmRef", {
            ...draft.pmRef,
            month: v,
          })
        }
      >
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>

        <SelectContent>
          {months.map((m) => (
            <SelectItem
              key={m}
              value={m}
            >
              {m}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </Field>

    <Field label="Année réalisée">
      <Input
        type="number"
        value={draft.pmRef.year}
        onChange={(e) =>
          set("pmRef", {
            ...draft.pmRef,
            year: Number(e.target.value),
          })
        }
      />
    </Field>
  </div>
</div>
            </TabsContent>

            <TabsContent value="flags" className="mt-0">
              <TodoEditor
                items={draft.flags}
                onChange={(items) => set("flags", items)}
                placeholder="Nouveau flag…"
              />
            </TabsContent>
            <TabsContent value="problems" className="mt-0">
              <TodoEditor
                items={draft.problems}
                onChange={(items) => set("problems", items)}
                placeholder="Nouveau problème…"
              />
            </TabsContent>
            <TabsContent value="repairs" className="mt-0">
              <TodoEditor
                items={draft.repairs}
                onChange={(items) => set("repairs", items)}
                placeholder="Nouvelle réparation…"
              />
            </TabsContent>
            <TabsContent value="improvements" className="mt-0">
              <TodoEditor
                items={draft.improvements}
                onChange={(items) => set("improvements", items)}
                placeholder="Nouvelle amélioration…"
              />
            </TabsContent>
          </div>
        </Tabs>

        <DialogFooter className="flex-col gap-3 border-t bg-muted/30 px-6 py-3 sm:flex-row sm:items-center sm:justify-between">
          {onDelete ? (
            <Button
              type="button"
              variant="outline"
              className="w-full border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive sm:w-auto"
              disabled={saving || deleting}
              onClick={() => setConfirmDelete(true)}
            >
              <Trash2 className="h-4 w-4" />
              Supprimer
            </Button>
          ) : (
            <span />
          )}

          <div className="flex w-full gap-2 sm:w-auto">
            <Button
              variant="ghost"
              onClick={() => onOpenChange(false)}
              disabled={saving || deleting}
              className="flex-1 sm:flex-none"
            >
              Annuler
            </Button>
            <Button onClick={save} disabled={saving || deleting} className="flex-1 sm:flex-none">
              {saving ? "Enregistrement…" : "Enregistrer"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Supprimer {draft.name} ?</AlertDialogTitle>
          <AlertDialogDescription>
            Cette action est irréversible. La machine sera retirée de la base de
            données.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={deleting}>Annuler</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              void remove();
            }}
            disabled={deleting}
            className="bg-destructive text-white hover:bg-destructive/90"
          >
            {deleting ? "Suppression…" : "Supprimer définitivement"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    </>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

function TodoEditor({
  items,
  onChange,
  placeholder,
}: {
  items: TodoItem[];
  onChange: (items: TodoItem[]) => void;
  placeholder: string;
}) {
  const [text, setText] = useState("");

  const add = () => {
    const t = text.trim();
    if (!t) return;
    onChange([...items, { text: t, completed: false }]);
    setText("");
  };

  const toggle = (i: number) => {
    onChange(
      items.map((it, idx) =>
        idx === i
          ? it.completed
            ? { text: it.text, completed: false }
            : { ...it, completed: true, completedDate: todayFr() }
          : it,
      ),
    );
  };

  const remove = (i: number) => onChange(items.filter((_, idx) => idx !== i));
  const updateText = (i: number, t: string) =>
    onChange(items.map((it, idx) => (idx === i ? { ...it, text: t } : it)));

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <Input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={placeholder}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
        />
        <Button onClick={add} type="button" variant="secondary">
          <Plus className="h-4 w-4" /> Ajouter
        </Button>
      </div>

      {items.length === 0 ? (
        <p className="rounded-lg border border-dashed py-6 text-center text-sm text-muted-foreground">
          Aucun élément.
        </p>
      ) : (
        <ul className="space-y-1.5">
          {items.map((it, i) => (
            <li
              key={i}
              className={cn(
                "group flex items-center gap-2 rounded-lg border bg-card px-2.5 py-1.5",
                it.completed && "opacity-60",
              )}
            >
              <button
                type="button"
                onClick={() => toggle(i)}
                className={cn(
                  "flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition",
                  it.completed
                    ? "border-success bg-success text-white"
                    : "border-border hover:border-primary",
                )}
                aria-label="Toggle"
              >
                {it.completed && <Check className="h-3.5 w-3.5" />}
              </button>
              <input
                value={it.text}
                onChange={(e) => updateText(i, e.target.value)}
                className={cn(
                  "min-w-0 flex-1 bg-transparent text-sm outline-none",
                  it.completed && "line-through",
                )}
              />
              {it.completed && it.completedDate && (
                <span className="shrink-0 text-xs text-muted-foreground">
                  {it.completedDate}
                </span>
              )}
              <button
                type="button"
                onClick={() => remove(i)}
                className="rounded-md p-1 text-muted-foreground opacity-0 transition hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100"
                aria-label="Supprimer"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function todayFr() {
  const d = new Date();
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}

function toLocalInput(iso: string) {
  try {
    const d = new Date(iso);
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  } catch {
    return "";
  }
}


