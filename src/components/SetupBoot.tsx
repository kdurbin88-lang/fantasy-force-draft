import { playbookFor } from "@/lib/engine";
import { useDraft } from "@/lib/store";
import { cn } from "@/lib/utils";

const BOOKS: Record<string, string> = {
  wheel: "You pick on the turn — pair up.",
  mid: "Watch the seat next to you every round.",
  anchor: "The wrap can double-tap. Have a backup.",
};

export function SetupBoot() {
  const teams = useDraft((s) => s.teams);
  const slot = useDraft((s) => s.slot);
  const setSlot = useDraft((s) => s.setSlot);
  const lockRoom = useDraft((s) => s.lockRoom);
  const book = slot >= 1 ? playbookFor(slot, teams) : null;

  return (
    <main className="relative z-[60] flex min-h-dvh items-center justify-center px-4 py-16 text-fg">
      <div className="fd-glass w-full min-w-0 max-w-lg space-y-5 p-6 sm:p-8">
        <p className="font-mono text-[11px] font-bold tracking-[0.35em] text-accent-bright">LIVE DRAFT</p>
        <h1 className="title-glow font-display text-4xl font-extrabold tracking-tight">You’re pick 3</h1>
        <p className="text-sm text-muted">
          12-team · 2 WR · 2 RB · FLEX. Confirm seat 3 and lock. This board saves from here — no more practice wipes.
        </p>

        <div className="fd-glass min-w-0 p-4">
          <p className="mb-3 font-mono text-[10px] font-bold tracking-widest text-subtle">YOUR PICK</p>
          <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
            {Array.from({ length: teams }, (_, i) => i + 1).map((n) => {
              const mine = n === slot;
              return (
                <button
                  key={n}
                  type="button"
                  data-qa={`seat-${n}`}
                  onClick={() => setSlot(n)}
                  className={cn(
                    "flex aspect-square w-full min-w-0 flex-col items-center justify-center rounded-full font-display text-2xl font-extrabold",
                    mine ? "fd-btn" : "fd-glass text-fg",
                  )}
                >
                  {n}
                  {mine ? <span className="font-mono text-[9px] tracking-widest">YOU</span> : null}
                </button>
              );
            })}
          </div>
        </div>

        {book && (
          <p className="fd-glass px-4 py-3 text-sm text-accent-bright">
            Slot {slot} · {BOOKS[book]}
          </p>
        )}

        <button
          type="button"
          data-qa="lock-room"
          disabled={slot < 1}
          onClick={lockRoom}
          className="fd-btn h-16 w-full text-lg font-extrabold tracking-widest disabled:opacity-40"
        >
          {slot < 1 ? "TAP YOUR PICK FIRST" : `LOCK IN PICK ${slot}`}
        </button>
      </div>
    </main>
  );
}
