import type { ChecklistItem } from "@/lib/types";

export type ChecklistStatus = "empty" | "not_started" | "in_progress" | "done";

export const CHECKLIST_STATUS_LABELS: Record<ChecklistStatus, string> = {
  empty: "Aucune tâche",
  not_started: "Non commencé",
  in_progress: "En cours",
  done: "Terminé",
};

export function nextChecklistId(items: ChecklistItem[]): number {
  return items.reduce((max, item) => Math.max(max, Number(item.id) || 0), 0) + 1;
}

export function normalizeChecklist(input: unknown): ChecklistItem[] {
  if (!Array.isArray(input)) return [];

  const items: ChecklistItem[] = [];
  const seen = new Set<number>();

  for (const raw of input) {
    if (!raw || typeof raw !== "object") continue;
    const record = raw as Record<string, unknown>;
    const text = String(record.text ?? "")
      .trim()
      .slice(0, 400);
    if (!text) continue;

    let id = Number(record.id);
    if (!Number.isFinite(id) || id <= 0 || seen.has(id)) {
      id = nextChecklistId(items);
    }
    seen.add(id);

    const completed = Boolean(record.completed);
    const item: ChecklistItem = { id, text, completed };
    if (completed) {
      const completedAt = String(record.completedAt ?? "").trim();
      item.completedAt = completedAt || new Date().toISOString().slice(0, 19);
    }
    items.push(item);
  }

  return items;
}

export function checklistProgress(items?: ChecklistItem[] | null) {
  const list = items ?? [];
  const total = list.length;
  const completed = list.filter((item) => item.completed).length;
  const percent = total === 0 ? 0 : Math.round((completed / total) * 100);
  const status: ChecklistStatus =
    total === 0
      ? "empty"
      : completed === 0
        ? "not_started"
        : completed === total
          ? "done"
          : "in_progress";

  return { total, completed, percent, status };
}

export function toggleChecklistItem(
  items: ChecklistItem[],
  id: number,
  completed = !items.find((item) => item.id === id)?.completed,
): ChecklistItem[] {
  const now = new Date().toISOString().slice(0, 19);
  return items.map((item) => {
    if (item.id !== id) return item;
    if (completed) return { ...item, completed: true, completedAt: now };
    const next = { ...item, completed: false };
    delete next.completedAt;
    return next;
  });
}

export function addChecklistItem(items: ChecklistItem[], text: string): ChecklistItem[] {
  const trimmed = text.trim().slice(0, 400);
  if (!trimmed) return items;
  return [...items, { id: nextChecklistId(items), text: trimmed, completed: false }];
}

export function removeChecklistItem(items: ChecklistItem[], id: number): ChecklistItem[] {
  return items.filter((item) => item.id !== id);
}

export function sameChecklist(a?: ChecklistItem[] | null, b?: ChecklistItem[] | null): boolean {
  return JSON.stringify(a ?? []) === JSON.stringify(b ?? []);
}
