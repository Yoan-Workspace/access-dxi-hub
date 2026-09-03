import { useState } from "react";
import { Check, ChevronRight, Plus, Trash2 } from "lucide-react";
import {
  addChecklistItem,
  CHECKLIST_STATUS_LABELS,
  checklistProgress,
  removeChecklistItem,
  toggleChecklistItem,
} from "@/lib/checklist";
import type { ChecklistItem } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";

export function ItemChecklist({
  items,
  onChange,
  readOnly = false,
  compact = false,
  open,
  onOpenChange,
  defaultOpen = false,
}: {
  items: ChecklistItem[];
  onChange: (items: ChecklistItem[]) => void;
  readOnly?: boolean;
  compact?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  defaultOpen?: boolean;
}) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(defaultOpen);
  const isOpen = open ?? uncontrolledOpen;
  const setOpen = onOpenChange ?? setUncontrolledOpen;
  const [draft, setDraft] = useState("");
  const { completed, total, status } = checklistProgress(items);

  const add = () => {
    const next = addChecklistItem(items, draft);
    if (next === items) return;
    setDraft("");
    onChange(next);
  };

  const summary =
    total === 0
      ? CHECKLIST_STATUS_LABELS.empty
      : `${completed}/${total} · ${CHECKLIST_STATUS_LABELS[status]}`;

  return (
    <Collapsible open={isOpen} onOpenChange={setOpen}>
      <CollapsibleTrigger asChild>
        <button
          type="button"
          className={cn(
            "flex w-full items-center gap-2 rounded-lg px-1.5 py-1.5 text-left transition",
            "hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
          )}
          aria-label={isOpen ? "Réduire les tâches" : "Afficher les tâches"}
        >
          <ChevronRight
            className={cn(
              "h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform duration-200",
              isOpen && "rotate-90",
            )}
          />
          <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            Tâches
          </span>
          <span className="ml-auto text-[11px] tabular-nums text-muted-foreground">{summary}</span>
        </button>
      </CollapsibleTrigger>

      <CollapsibleContent className={cn("space-y-2 overflow-hidden", compact ? "pt-1" : "pt-2")}>
        {items.length === 0 && readOnly && (
          <p className="rounded-lg border border-dashed px-3 py-2 text-xs text-muted-foreground">
            Aucune action définie pour le moment.
          </p>
        )}

        {items.length > 0 && (
          <ul className="space-y-1">
            {items.map((item) => (
              <li
                key={item.id}
                className={cn(
                  "group flex items-start gap-2 rounded-lg px-1.5 py-1 transition",
                  item.completed ? "opacity-70" : "hover:bg-muted/50",
                )}
              >
                <button
                  type="button"
                  onClick={() => onChange(toggleChecklistItem(items, item.id))}
                  disabled={readOnly}
                  className={cn(
                    "mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-md border transition",
                    item.completed
                      ? "border-success bg-success text-white"
                      : "border-border bg-background hover:border-primary",
                    readOnly && "cursor-default",
                  )}
                  aria-label={item.completed ? "Marquer à faire" : "Marquer comme fait"}
                >
                  {item.completed && <Check className="h-3 w-3" />}
                </button>
                <span
                  className={cn(
                    "min-w-0 flex-1 text-sm leading-5",
                    item.completed && "text-muted-foreground line-through",
                  )}
                >
                  {item.text}
                </span>
                {!readOnly && (
                  <button
                    type="button"
                    onClick={() => onChange(removeChecklistItem(items, item.id))}
                    className="rounded-md p-1 text-muted-foreground opacity-0 transition hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100"
                    aria-label="Supprimer la tâche"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}

        {!readOnly && (
          <div className="flex gap-2 px-1.5 pb-1">
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Ajouter une action…"
              className="h-8 min-w-0 flex-1 rounded-md border border-input bg-transparent px-2.5 text-sm outline-none placeholder:text-muted-foreground focus-visible:ring-1 focus-visible:ring-ring"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  add();
                }
              }}
            />
            <Button
              type="button"
              size="sm"
              variant="secondary"
              className="h-8 px-2.5"
              onClick={add}
              disabled={!draft.trim()}
            >
              <Plus className="h-3.5 w-3.5" />
              Ajouter
            </Button>
          </div>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
}
