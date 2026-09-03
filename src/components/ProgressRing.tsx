import { CHECKLIST_STATUS_LABELS, checklistProgress } from "@/lib/checklist";
import type { ChecklistItem } from "@/lib/types";
import { cn } from "@/lib/utils";

export function ProgressRing({
  items,
  size = 40,
  strokeWidth = 3.5,
  className,
}: {
  items?: ChecklistItem[] | null;
  size?: number;
  strokeWidth?: number;
  className?: string;
}) {
  const { percent, status, completed, total } = checklistProgress(items);
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percent / 100) * circumference;

  const tone =
    status === "done"
      ? "text-success"
      : status === "in_progress"
        ? "text-primary"
        : "text-muted-foreground";

  const track =
    status === "done"
      ? "stroke-success/20"
      : status === "in_progress"
        ? "stroke-primary/20"
        : "stroke-muted-foreground/20";

  const label =
    status === "empty"
      ? CHECKLIST_STATUS_LABELS.empty
      : `${CHECKLIST_STATUS_LABELS[status]} · ${completed}/${total}`;

  return (
    <div
      className={cn("relative shrink-0", className)}
      style={{ width: size, height: size }}
      title={label}
      aria-label={label}
    >
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={strokeWidth}
          className={track}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={status === "empty" ? circumference : offset}
          className={cn("transition-[stroke-dashoffset,color] duration-500", tone)}
        />
      </svg>
      <span
        className={cn(
          "absolute inset-0 flex items-center justify-center font-semibold tabular-nums leading-none",
          size >= 40 ? "text-[10px]" : "text-[9px]",
          tone,
        )}
      >
        {status === "empty" ? "—" : `${percent}%`}
      </span>
    </div>
  );
}

export function ProgressStatusBadge({
  items,
  className,
}: {
  items?: ChecklistItem[] | null;
  className?: string;
}) {
  const { status } = checklistProgress(items);
  if (status === "empty") return null;

  const tone =
    status === "done"
      ? "bg-success/15 text-success"
      : status === "in_progress"
        ? "bg-primary/15 text-primary"
        : "bg-muted text-muted-foreground";

  return (
    <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold", tone, className)}>
      {CHECKLIST_STATUS_LABELS[status]}
    </span>
  );
}
