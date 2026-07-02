import { useEffect, useState } from "react";
import type { Machine, MachineKind } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { cn } from "@/lib/utils";

const months = [
  "Janvier",
  "Février",
  "Mars",
  "Avril",
  "Mai",
  "Juin",
  "Juillet",
  "Août",
  "Septembre",
  "Octobre",
  "Novembre",
  "Décembre",
];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreate: (machine: Omit<Machine, "id">) => Promise<void> | void;
}

function defaultDraft(kind: MachineKind): Omit<Machine, "id"> {
  const now = new Date();
  return {
    name: kind === "ACCESS" ? "Access2 #" : "MP",
    lastDate: now.toISOString().slice(0, 19),
    flags: [],
    pmRef: {
      period: 12,
      month: months[now.getMonth()],
      year: now.getFullYear(),
    },
    sw: kind === "ACCESS" ? "4.1.0" : "1.20.0.22",
    status: "ok",
    adam: "fonctionnelle",
    improvements: [],
    problems: [],
    repairs: [],
    localisation: "BSL2",
    ...(kind === "ACCESS"
      ? { asdStatus: "valid" as const, asdLabel: "System Check" }
      : { asdStatus: "valid" as const, monthlyMaint: "not_done" as const }),
  };
}

export function AddMachineDialog({ open, onOpenChange, onCreate }: Props) {
  const [kind, setKind] = useState<MachineKind>("MP");
  const [draft, setDraft] = useState<Omit<Machine, "id">>(() => defaultDraft("MP"));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setKind("MP");
      setDraft(defaultDraft("MP"));
    }
  }, [open]);

  const setKindAndReset = (next: MachineKind) => {
    setKind(next);
    setDraft(defaultDraft(next));
  };

  const set = <K extends keyof Omit<Machine, "id">>(
    key: K,
    value: Omit<Machine, "id">[K],
  ) => setDraft((d) => ({ ...d, [key]: value }));

  const save = async () => {
    const name = draft.name.trim();
    if (!name) return;

    setSaving(true);
    try {
      await onCreate({ ...draft, name });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Nouvelle machine</DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          <div className="space-y-2">
            <Label className="text-xs font-medium text-muted-foreground">Type</Label>
            <div className="grid grid-cols-2 gap-2">
              <TypeOption
                active={kind === "MP"}
                title="DXI 9000"
                subtitle="Falcon / MP"
                onClick={() => setKindAndReset("MP")}
              />
              <TypeOption
                active={kind === "ACCESS"}
                title="Access 2"
                subtitle="ACCESS"
                onClick={() => setKindAndReset("ACCESS")}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Nom">
              <Input
                value={draft.name}
                onChange={(e) => set("name", e.target.value)}
                placeholder={kind === "ACCESS" ? "Access2 #511531" : "MP99"}
              />
            </Field>
            <Field label="Localisation">
              <Select
                value={draft.localisation}
                onValueChange={(v) => set("localisation", v)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="BSL2">BSL2</SelectItem>
                  <SelectItem value="Thermal">Thermal</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Version SW">
              <Input value={draft.sw} onChange={(e) => set("sw", e.target.value)} />
            </Field>
            <Field label="État initial">
              <Select
                value={draft.status}
                onValueChange={(v) => set("status", v as Machine["status"])}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ok">OK</SelectItem>
                  <SelectItem value="maintenance">Maintenance</SelectItem>
                  <SelectItem value="danger">Problème</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          </div>

          <p className="text-xs text-muted-foreground">
            La PM par défaut est planifiée sur 12 mois. Les champs de suivi pourront être
            complétés après création via l&apos;édition de la machine.
          </p>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>
            Annuler
          </Button>
          <Button onClick={save} disabled={saving || !draft.name.trim()}>
            {saving ? "Création…" : "Créer la machine"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function TypeOption({
  active,
  title,
  subtitle,
  onClick,
}: {
  active: boolean;
  title: string;
  subtitle: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-xl border px-3 py-3 text-left transition",
        active
          ? "border-primary bg-primary/5 ring-1 ring-primary/30"
          : "border-border bg-card hover:bg-secondary",
      )}
    >
      <div className="text-sm font-semibold">{title}</div>
      <div className="text-xs text-muted-foreground">{subtitle}</div>
    </button>
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
