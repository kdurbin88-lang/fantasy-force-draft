import { cn } from "@/lib/utils";

type SeatRingProps = {
  teams: number;
  slot: number;
  humanSlots: number[];
  onCycle: (n: number) => void;
};

export function SeatRing({ teams, slot, humanSlots, onCycle }: SeatRingProps) {
  const printers = Math.max(0, teams - 1 - humanSlots.length - (slot >= 1 ? 1 : 0));
  return (
    <div className="w-full min-w-0">
      <div className="grid w-full grid-cols-4 gap-1.5 sm:grid-cols-6 sm:gap-2">
        {Array.from({ length: teams }, (_, i) => i + 1).map((n) => {
          const mine = n === slot;
          const live = humanSlots.includes(n);
          return (
            <button
              key={n}
              type="button"
              data-qa={`seat-${n}`}
              onClick={() => onCycle(n)}
              className={cn(
                "flex aspect-square w-full min-w-0 flex-col items-center justify-center rounded-full font-mono text-[10px] font-bold sm:text-xs",
                mine && "bg-accent text-accent-fg",
                !mine && live && "border-2 border-danger bg-danger/20 text-danger",
                !mine && !live && "border border-border bg-elevated text-muted",
              )}
            >
              <span>{n}</span>
              <span className="max-w-full truncate tracking-wide">
                {mine ? "YOU" : live ? "H" : "CPU"}
              </span>
            </button>
          );
        })}
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2 font-mono text-[10px] font-bold tracking-widest">
        <div className="rounded-full border border-border px-2 py-2 text-center">YOU {slot || "—"}</div>
        <div className="rounded-full border border-danger/50 px-2 py-2 text-center text-danger">
          HUMAN {humanSlots.length}
        </div>
        <div className="rounded-full border border-border px-2 py-2 text-center">CPU {printers}</div>
      </div>
    </div>
  );
}
