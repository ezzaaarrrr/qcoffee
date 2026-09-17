import * as React from "react";
import { Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

interface TimePickerDialogProps {
  /** Current value in HH:mm:ss format */
  value: string;
  onChange: (value: string) => void;
  label?: string;
}

function pad(n: number) {
  return n.toString().padStart(2, "0");
}

function parseTime(val: string): { h: number; m: number; s: number } {
  const parts = val.split(":");
  return {
    h: Number(parts[0] ?? 0) || 0,
    m: Number(parts[1] ?? 0) || 0,
    s: Number(parts[2] ?? 0) || 0,
  };
}

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const MINUTES = Array.from({ length: 60 }, (_, i) => i);
const SECONDS = Array.from({ length: 60 }, (_, i) => i);

function ScrollColumn({
  items,
  selected,
  onSelect,
  label,
}: {
  items: number[];
  selected: number;
  onSelect: (v: number) => void;
  label: string;
}) {
  const ref = React.useRef<HTMLDivElement>(null);

  React.useLayoutEffect(() => {
    if (!ref.current) return;
    const el = ref.current.querySelector(`[data-active="true"]`) as HTMLElement | null;
    if (el) {
      el.scrollIntoView({ block: "center", behavior: "instant" });
    }
  }, [selected]);

  return (
    <div className="flex flex-col items-center gap-1 flex-1">
      <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1">
        {label}
      </span>
      <div
        ref={ref}
        className="h-48 overflow-y-auto overscroll-contain w-full rounded-md border border-border bg-background"
        style={{ scrollbarWidth: "thin" }}
      >
        <div className="py-[84px]">
          {items.map((v) => (
            <button
              key={v}
              type="button"
              data-active={v === selected ? "true" : "false"}
              onClick={() => onSelect(v)}
              className={`w-full px-3 py-1.5 text-sm font-mono text-center transition-colors rounded-sm
                ${
                  v === selected
                    ? "bg-primary text-primary-foreground font-bold"
                    : "text-foreground hover:bg-muted"
                }`}
            >
              {pad(v)}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export function TimePickerDialog({ value, onChange, label = "Pilih Waktu" }: TimePickerDialogProps) {
  const [open, setOpen] = React.useState(false);
  const parsed = parseTime(value);
  const [h, setH] = React.useState(parsed.h);
  const [m, setM] = React.useState(parsed.m);
  const [s, setS] = React.useState(parsed.s);

  const handleOpenChange = (next: boolean) => {
    if (next) {
      const p = parseTime(value);
      setH(p.h);
      setM(p.m);
      setS(p.s);
    }
    setOpen(next);
  };

  const handleConfirm = () => {
    onChange(`${pad(h)}:${pad(m)}:${pad(s)}`);
    setOpen(false);
  };

  const displayValue = value ? value : "—:—:—";

  return (
    <>
      <button
        type="button"
        onClick={() => handleOpenChange(true)}
        className="flex items-center gap-2 w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono text-left shadow-sm transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
      >
        <Clock className="size-4 text-muted-foreground shrink-0" />
        <span className={value ? "text-foreground" : "text-muted-foreground"}>
          {displayValue}
        </span>
      </button>

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="max-w-xs">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Clock className="size-4" />
              {label}
            </DialogTitle>
          </DialogHeader>

          <div className="text-center py-2">
            <span className="text-3xl font-mono font-bold tabular-nums text-primary">
              {pad(h)}:{pad(m)}:{pad(s)}
            </span>
          </div>

          <div className="flex gap-2 px-1">
            <ScrollColumn items={HOURS} selected={h} onSelect={setH} label="Jam" />
            <div className="flex items-center pt-8 text-muted-foreground font-bold text-lg select-none">:</div>
            <ScrollColumn items={MINUTES} selected={m} onSelect={setM} label="Menit" />
            <div className="flex items-center pt-8 text-muted-foreground font-bold text-lg select-none">:</div>
            <ScrollColumn items={SECONDS} selected={s} onSelect={setS} label="Detik" />
          </div>

          <DialogFooter className="mt-2">
            <Button variant="outline" size="sm" onClick={() => setOpen(false)}>
              Batal
            </Button>
            <Button size="sm" onClick={handleConfirm}>
              Konfirmasi
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
