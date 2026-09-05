import { playbookFor } from "@/lib/engine";
import { useDraft } from "@/lib/store";
import { cn } from "@/lib/utils";
import { SeatRing } from "@/components/SeatRing";

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
    <main className="relative z-[60] flex min-h-dvh items-center justify-center px-4 py-16 text-fg">
      <div className="fd-glass w-full min-w-0 max-w-lg space-y-5 p-6 sm:p-8">
        <p className="font-mono text-[11px] font-bold tracking-[0.35em] text-accent-bright">BOOT LOAD</p>
        <h1 className="title-glow font-display text-4xl font-extrabold tracking-tight">Lock the room</h1>
        <p className="text-sm text-muted">
          Nothing is locked yet. Tap YOUR real seat (it turns blue). Tap it again to move. Then tap humans (red).
        </p>

        <div className="fd-glass p-4">
          <p className="mb-3 font-mono text-[10px] font-bold tracking-widest text-subtle">TEAMS</p>
          <div className="grid grid-cols-3 gap-3">
            {[10, 11, 12].map((n) => (
              <button
                key={n}
                type="button"
                data-qa={`teams-${n}`}
                onClick={() => setTeams(n)}
                className={cn(
                  "h-16 font-mono text-2xl font-extrabold",
                  teams === n ? "fd-btn" : "fd-ghost",
                )}
              >
                {n}
              </button>
            ))}
          </div>
        </div>

        <div className="fd-glass min-w-0 p-4">
          <p className="mb-3 font-mono text-[10px] font-bold tracking-widest text-subtle">YOUR SEAT</p>
          <SeatRing teams={teams} slot={slot} humanSlots={humanSlots} onCycle={cycleSeat} />
          <p className="mt-3 text-xs text-muted">
            Blue = you. Red = live humans. Gray = ESPN auto. Tap your blue seat to unlock if it is the wrong number.
          </p>
        </div>

        {book && (
          <p className="fd-glass px-4 py-3 text-sm text-accent-bright">
            {BOOKS[book]} · slot {slot} of {teams}
          </p>
        )}

        <button
          type="button"
          data-qa="lock-room"
          disabled={slot < 1}
          onClick={lockRoom}
          className="fd-btn h-16 w-full text-lg font-extrabold tracking-widest disabled:opacity-40"
        >
          LOCK ROOM
        </button>
      </div>
    </main>
  );
}
