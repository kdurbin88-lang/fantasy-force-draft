import { cn } from "@/lib/utils";

type SeatRingProps = {
  teams: number;
  slot: number;
  humanSlots: number[];
  onCycle: (n: number) => void;
};

export function SeatRing({ teams, slot, humanSlots, onCycle }: SeatRingProps) {
  const liveCount = humanSlots.filter((n) => n !== slot).length;
  const autoCount = Math.max(0, teams - 1 - liveCount);
  return (
    <div className="w-full min-w-0">
      <div className="flex flex-wrap gap-1.5">
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
                "inline-flex h-9 min-w-9 items-center justify-center rounded-full px-2 font-mono text-xs font-bold",
                mine && "fd-btn",
                !mine && live && "fd-glass text-fg",
                !mine && !live && "fd-ghost text-muted",
              )}
            >
              {mine ? "YOU" : n}
            </button>
          );
        })}
        <span className="ml-auto self-center font-mono text-[10px] font-bold tracking-widest text-subtle">
          LIVE {liveCount} · AUTO {autoCount}
        </span>
      </div>
    </div>
  );
}
