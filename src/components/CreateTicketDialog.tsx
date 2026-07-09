import { useState } from "react";
import { Loader2 } from "lucide-react";
import type { Machine, TicketCategory } from "@/lib/types";
import { TICKET_CATEGORY_LABELS } from "@/lib/permissions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

const categories: TicketCategory[] = [
  "reparation",
  "probleme",
  "flag",
  "non_classe",
];

interface Props {
  open: boolean;
  machines: Machine[];
  defaultMachineId?: number;
  onOpenChange: (open: boolean) => void;
  onCreate: (input: {
    machineId: number;
    category: TicketCategory;
    comment: string;
  }) => Promise<void>;
}

export function CreateTicketDialog({
  open,
  machines,
  defaultMachineId,
  onOpenChange,
  onCreate,
}: Props) {
  const [machineId, setMachineId] = useState<string>(
    defaultMachineId ? String(defaultMachineId) : "",
  );
  const [category, setCategory] = useState<TicketCategory>("non_classe");
  const [comment, setComment] = useState("");
  const [saving, setSaving] = useState(false);

  const reset = () => {
    setMachineId(defaultMachineId ? String(defaultMachineId) : "");
    setCategory("non_classe");
    setComment("");
  };

  const submit = async () => {
    if (!machineId || !comment.trim()) return;

    setSaving(true);
    try {
      await onCreate({
        machineId: Number(machineId),
        category,
        comment: comment.trim(),
      });
      reset();
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) reset();
        onOpenChange(o);
      }}
    >
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Ouvrir un ticket</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Machine</Label>
            <Select value={machineId} onValueChange={setMachineId}>
              <SelectTrigger>
                <SelectValue placeholder="Sélectionner une machine" />
              </SelectTrigger>
              <SelectContent>
                {machines.map((m) => (
                  <SelectItem key={m.id} value={String(m.id)}>
                    {m.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Catégorie</Label>
            <Select
              value={category}
              onValueChange={(v) => setCategory(v as TicketCategory)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {categories.map((c) => (
                  <SelectItem key={c} value={c}>
                    {TICKET_CATEGORY_LABELS[c]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Commentaire</Label>
            <Textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Décrivez le problème, le flag ou la note…"
              rows={4}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>
            Annuler
          </Button>
          <Button
            onClick={() => void submit()}
            disabled={saving || !machineId || !comment.trim()}
          >
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Création…
              </>
            ) : (
              "Créer le ticket"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
