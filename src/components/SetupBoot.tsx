import { playbookFor } from "@/lib/engine";
import { useDraft } from "@/lib/store";
import { cn } from "@/lib/utils";

const BOOKS: Record<string, string> = {
  wheel: "WHEEL · you pick on the turn",
  mid: "MID · watch the seat next to you",
  anchor: "ANCHOR · contingency first",
};

export function SetupBoot() {
  const teams = useDraft((s) => s.teams);
  const slot = useDraft((s) => s.slot);
  const humanSlots = useDraft((s) => s.humanSlots);
  const setTeams = useDraft((s) => s.setTeams);
  const cycleSeat = useDraft((s) => s.cycleSeat);
  const lockRoom = useDraft((s) => s.lockRoom);
  const book = slot >= 1 ? playbookFor(slot, teams) : null;

  return (
    <main className="relative z-[60] flex min-h-dvh items-center justify-center bg-[#050814] px-4 py-16 text-fg">
      <div className="w-full max-w-lg space-y-5">
        <p className="font-mono text-[11px] font-bold tracking-[0.35em] text-accent-bright">BOOT LOAD</p>
        <h1 className="font-display text-4xl font-extrabold tracking-tight">Lock the room</h1>
        <p className="text-sm text-muted">Pick league size, tap YOUR seat, then LOCK ROOM.</p>

        <div>
          <p className="mb-2 font-mono text-[10px] font-bold tracking-widest text-subtle">TEAMS</p>
          <div className="grid grid-cols-3 gap-3">
            {[10, 11, 12].map((n) => (
              <button
                key={n}
                type="button"
                data-qa={`teams-${n}`}
                onClick={() => setTeams(n)}
                className={cn(
                  "h-16 rounded-xl font-mono text-2xl font-extrabold",
                  teams === n ? "bg-[#3db4ff] text-black" : "border border-white/30 bg-[#0b1730] text-white",
                )}
              >
                {n}
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="mb-2 font-mono text-[10px] font-bold tracking-widest text-subtle">YOUR SEAT</p>
          <div className="grid grid-cols-6 gap-2">
            {Array.from({ length: teams }, (_, i) => i + 1).map((n) => {
              const mine = n === slot;
              const live = humanSlots.includes(n);
              return (
                <button
                  key={n}
                  type="button"
                  data-qa={`seat-${n}`}
                  onClick={() => cycleSeat(n)}
                  className={cn(
                    "flex h-14 flex-col items-center justify-center rounded-xl font-mono text-xs font-bold",
                    mine && "bg-[#3db4ff] text-black",
                    !mine && live && "border border-red-500 bg-red-950 text-red-100",
                    !mine && !live && "border border-white/20 bg-[#0b1730] text-white",
                  )}
                >
                  <span>{n}</span>
                  <span className="text-[9px] tracking-widest">{mine ? "YOU" : live ? "H" : "CPU"}</span>
                </button>
              );
            })}
          </div>
          <p className="mt-2 text-xs text-muted">Tap other seats to mark humans (red). Leave the rest CPU.</p>
        </div>

        {book && (
          <p className="text-sm text-accent-bright">
            {BOOKS[book]} · slot {slot} of {teams}
          </p>
        )}

        <button
          type="button"
          data-qa="lock-room"
          disabled={slot < 1}
          onClick={lockRoom}
          className="h-16 w-full rounded-2xl bg-[#3db4ff] text-lg font-extrabold tracking-widest text-black disabled:opacity-40"
        >
          LOCK ROOM
        </button>
      </div>
    </main>
  );
}
