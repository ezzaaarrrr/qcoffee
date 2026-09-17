import type { FormStatus } from "@/lib/domain";
import { cn } from "@/lib/utils";

const STYLES: Record<FormStatus, string> = {
  Draft: "border-border bg-surface-muted text-muted-foreground",
  "Pending QC": "border-warning/40 bg-warning/10 text-warning",
  Approved: "border-success/40 bg-success/10 text-success",
  Rejected: "border-destructive/40 bg-destructive/10 text-destructive",
};

export function StatusBadge({ status, className }: { status: FormStatus; className?: string }) {
  return (
    <span
      className={cn(
        "inline-block border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide",
        STYLES[status],
        className,
      )}
    >
      {status}
    </span>
  );
}
